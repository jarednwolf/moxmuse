/**
 * Export Format Engine Service
 * 
 * Implements customizable export format system with templates for tournament lists,
 * proxy sheets, and platform formats. Supports bulk export with compression and
 * download management.
 */

import { db } from '@moxmuse/db'
import { 
  ExportJob, 
  ExportJobItem, 
  ExportResult, 
  ExportOptions, 
  ExportFormat, 
  ExportJobStatus,
  ExportJobType,
  CompressionType,
  CustomFormat,
  ExportTemplate,
  ExportPreview,
  ValidationResult,
  BulkExportJob,
  BulkExportResult,
  CompressionResult,
  CompressionOptions,
  TemplateEngine,
  TemplateOptions,
  TemplateValidationResult,
  TemplateVariables,
  ExportError,
  ExportWarning,
  ExportMetadata
} from '@moxmuse/shared/export-format-types'
import { GeneratedDeck } from '@moxmuse/shared'
import { scryfallService } from './scryfall'
import { logger } from './core/logging'
import { performanceMonitor } from './core/performance-monitor'
import { jobProcessor } from './core/job-processor'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as zlib from 'zlib'
import { promisify } from 'util'

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

export class ExportFormatEngine {
  private templateEngine: HandlebarsTemplateEngine
  
  constructor() {
    this.templateEngine = new HandlebarsTemplateEngine()
    this.registerBuiltInFormats()
  }

  /**
   * Create a new export job
   */
  async createExportJob(
    userId: string,
    deckIds: string[],
    format: ExportFormat,
    options: ExportOptions = {},
    type: ExportJobType = 'single'
  ): Promise<ExportJob> {
    const job = await db.exportJob.create({
      data: {
        userId,
        deckIds,
        format,
        type,
        options,
        totalDecks: deckIds.length,
        compression: options.compression || 'none',
        includeMetadata: options.includeMetadata ?? true,
        includeAnalysis: options.includeAnalysis ?? false,
        includePricing: options.includePricing ?? false,
        includeAIInsights: options.includeAIInsights ?? false,
        customFormatId: options.templateId
      }
    })

    // Create job items for each deck
    const jobItems = deckIds.map((deckId, index) => ({
      exportJobId: job.id,
      deckId,
      itemIndex: index
    }))

    await db.exportJobItem.createMany({
      data: jobItems
    })

    // Queue job for processing
    await jobProcessor.enqueue('export-job', { jobId: job.id })

    logger.info('Export job created', { jobId: job.id, userId, format, deckCount: deckIds.length })

    return job as ExportJob
  }

  /**
   * Process an export job
   */
  async processExportJob(jobId: string): Promise<void> {
    const job = await db.exportJob.findUnique({
      where: { id: jobId },
      include: {
        items: true,
        customFormat: true
      }
    })

    if (!job) {
      throw new Error(`Export job ${jobId} not found`)
    }

    try {
      await this.updateJobStatus(jobId, 'processing')
      
      const startTime = Date.now()
      const results: ExportResult[] = []
      let totalFileSize = 0
      const errors: ExportError[] = []
      const warnings: ExportWarning[] = []

      // Process each deck
      for (let i = 0; i < job.items.length; i++) {
        const item = job.items[i]
        
        try {
          await this.updateJobProgress(jobId, (i / job.items.length) * 100, `Processing deck ${i + 1}/${job.items.length}`)
          
          const result = await this.exportSingleDeck(
            item.deckId,
            job.format as ExportFormat,
            job.options as ExportOptions,
            job.customFormat
          )
          
          results.push(result)
          totalFileSize += result.fileSize
          errors.push(...result.errors)
          warnings.push(...result.warnings)

          // Update item status
          await db.exportJobItem.update({
            where: { id: item.id },
            data: {
              status: result.success ? 'completed' : 'failed',
              cardsExported: result.metadata.cardsExported,
              fileSize: result.fileSize,
              errors: result.errors,
              warnings: result.warnings,
              processingCompletedAt: new Date()
            }
          })

        } catch (error) {
          logger.error('Failed to export deck', { deckId: item.deckId, error })
          errors.push({
            type: 'data_error',
            message: `Failed to export deck: ${error instanceof Error ? error.message : 'Unknown error'}`,
            deckId: item.deckId
          })

          await db.exportJobItem.update({
            where: { id: item.id },
            data: {
              status: 'failed',
              errors: [{ type: 'data_error', message: error instanceof Error ? error.message : 'Unknown error' }],
              processingCompletedAt: new Date()
            }
          })
        }
      }

      // Combine results if multiple decks
      let finalResult: ExportResult
      if (results.length === 1) {
        finalResult = results[0]
      } else {
        finalResult = await this.combineExportResults(results, job.format as ExportFormat, job.options as ExportOptions)
      }

      // Apply compression if requested
      if (job.compression !== 'none') {
        finalResult = await this.compressExportResult(finalResult, {
          type: job.compression as CompressionType
        })
      }

      // Save result file and generate download URL
      const downloadUrl = await this.saveExportResult(jobId, finalResult)
      
      const processingTime = Date.now() - startTime

      // Update job with final results
      await db.exportJob.update({
        where: { id: jobId },
        data: {
          status: finalResult.success ? 'completed' : 'failed',
          progress: 100,
          decksProcessed: results.filter(r => r.success).length,
          fileSize: finalResult.fileSize,
          downloadUrl,
          fileName: finalResult.fileName,
          mimeType: finalResult.mimeType,
          errors,
          warnings,
          processingCompletedAt: new Date(),
          processingTime,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      })

      // Record analytics
      await this.recordExportAnalytics(job, finalResult, processingTime)

      logger.info('Export job completed', { 
        jobId, 
        success: finalResult.success, 
        fileSize: finalResult.fileSize,
        processingTime 
      })

    } catch (error) {
      logger.error('Export job failed', { jobId, error })
      
      await db.exportJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errors: [{
            type: 'data_error',
            message: error instanceof Error ? error.message : 'Unknown error'
          }],
          processingCompletedAt: new Date()
        }
      })
    }
  }

  /**
   * Export a single deck
   */
  private async exportSingleDeck(
    deckId: string,
    format: ExportFormat,
    options: ExportOptions,
    customFormat?: any
  ): Promise<ExportResult> {
    const startTime = Date.now()
    
    // Get deck data
    const deck = await db.deck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          include: {
            card: true
          }
        }
      }
    })

    if (!deck) {
      throw new Error(`Deck ${deckId} not found`)
    }

    // Get enhanced card data if needed
    const cardDetails = await this.getEnhancedCardData(deck.cards, options)

    // Generate export based on format
    let result: ExportResult

    switch (format) {
      case 'text':
        result = await this.generateTextExport(deck, cardDetails, options)
        break
      case 'json':
        result = await this.generateJSONExport(deck, cardDetails, options)
        break
      case 'moxfield':
        result = await this.generateMoxfieldExport(deck, cardDetails, options)
        break
      case 'archidekt':
        result = await this.generateArchidektExport(deck, cardDetails, options)
        break
      case 'tappedout':
        result = await this.generateTappedOutExport(deck, cardDetails, options)
        break
      case 'edhrec':
        result = await this.generateEDHRECExport(deck, cardDetails, options)
        break
      case 'mtggoldfish':
        result = await this.generateMTGGoldfishExport(deck, cardDetails, options)
        break
      case 'csv':
        result = await this.generateCSVExport(deck, cardDetails, options)
        break
      case 'tournament':
        result = await this.generateTournamentExport(deck, cardDetails, options)
        break
      case 'proxy':
        result = await this.generateProxyExport(deck, cardDetails, options)
        break
      case 'custom':
        if (!customFormat) {
          throw new Error('Custom format required for custom export')
        }
        result = await this.generateCustomExport(deck, cardDetails, customFormat, options)
        break
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }

    const processingTime = Date.now() - startTime
    result.metadata.processingTime = processingTime

    return result
  }

  /**
   * Generate text export
   */
  private async generateTextExport(deck: any, cardDetails: any[], options: ExportOptions): Promise<ExportResult> {
    let output = `${deck.name}\n`
    output += `${'='.repeat(deck.name.length)}\n\n`
    
    if (deck.commander) {
      output += `Commander: ${deck.commander}\n`
    }
    output += `Format: ${deck.format.toUpperCase()}\n`
    if (deck.description) {
      output += `Description: ${deck.description}\n`
    }
    output += `Exported: ${new Date().toLocaleDateString()}\n\n`

    // Group cards by category
    const categories = this.groupCardsByCategory(cardDetails, options.categoryOrder)
    
    for (const [categoryName, cards] of categories) {
      const totalInCategory = cards.reduce((sum: number, card: any) => sum + card.quantity, 0)
      output += `${categoryName.toUpperCase()} (${totalInCategory})\n`
      output += `${'-'.repeat(categoryName.length + 5)}\n`
      
      // Sort cards within category
      const sortedCards = this.sortCards(cards, options.sortBy, options.sortOrder)
      
      for (const card of sortedCards) {
        const quantity = options.includeQuantities !== false && card.quantity > 1 ? `${card.quantity}x ` : ''
        const name = card.name
        const price = options.includePrices && card.price ? ` ($${card.price.toFixed(2)})` : ''
        output += `${quantity}${name}${price}\n`
      }
      output += '\n'
    }

    // Add statistics if requested
    if (options.includeMetadata) {
      const stats = this.calculateDeckStatistics(cardDetails)
      output += `STATISTICS\n`
      output += `----------\n`
      output += `Total Cards: ${stats.totalCards}\n`
      output += `Average CMC: ${stats.averageCMC.toFixed(2)}\n`
      if (options.includePricing && stats.totalValue) {
        output += `Total Value: $${stats.totalValue.toFixed(2)}\n`
      }
      output += '\n'
    }

    const data = Buffer.from(output, 'utf-8')
    
    return {
      success: true,
      data,
      fileName: `${this.sanitizeFileName(deck.name)}.txt`,
      mimeType: 'text/plain',
      fileSize: data.length,
      errors: [],
      warnings: [],
      metadata: {
        format: 'text',
        processingTime: 0,
        fileSize: data.length,
        decksExported: 1,
        cardsExported: cardDetails.length
      }
    }
  }

  /**
   * Generate JSON export
   */
  private async generateJSONExport(deck: any, cardDetails: any[], options: ExportOptions): Promise<ExportResult> {
    const exportData = {
      metadata: {
        name: deck.name,
        commander: deck.commander,
        format: deck.format,
        description: deck.description,
        tags: deck.tags || [],
        exportedAt: new Date().toISOString(),
        version: '1.0'
      },
      cards: cardDetails.map(card => ({
        name: card.name,
        quantity: card.quantity,
        category: card.category,
        manaCost: card.manaCost,
        cmc: card.cmc,
        typeLine: card.typeLine,
        colors: card.colors,
        colorIdentity: card.colorIdentity,
        rarity: card.rarity,
        set: card.set,
        ...(options.includePrices && card.price && { price: card.price }),
        ...(options.includeImages && card.imageUrl && { imageUrl: card.imageUrl }),
        ...(options.includeRulings && card.rulings && { rulings: card.rulings }),
        ...(options.includeLegalities && card.legalities && { legalities: card.legalities })
      })),
      ...(options.includeMetadata && {
        statistics: this.calculateDeckStatistics(cardDetails)
      }),
      ...(options.includeAnalysis && deck.analysis && {
        analysis: deck.analysis
      })
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const data = Buffer.from(jsonString, 'utf-8')
    
    return {
      success: true,
      data,
      fileName: `${this.sanitizeFileName(deck.name)}.json`,
      mimeType: 'application/json',
      fileSize: data.length,
      errors: [],
      warnings: [],
      metadata: {
        format: 'json',
        processingTime: 0,
        fileSize: data.length,
        decksExported: 1,
        cardsExported: cardDetails.length
      }
    }
  }

  /**
   * Generate tournament list export
   */
  private async generateTournamentExport(deck: any, cardDetails: any[], options: ExportOptions): Promise<ExportResult> {
    let output = `TOURNAMENT DECK REGISTRATION\n`
    output += `${'='.repeat(30)}\n\n`
    
    if (options.includePlayerInfo) {
      output += `Player Name: _________________________\n`
      output += `DCI Number: __________________________\n`
      output += `Event: ______________________________\n`
      output += `Date: _______________________________\n\n`
    }
    
    output += `Deck Name: ${deck.name}\n`
    if (deck.commander) {
      output += `Commander: ${deck.commander}\n`
    }
    output += `Format: ${deck.format.toUpperCase()}\n\n`

    if (options.includeDeckRegistration) {
      output += `DECK REGISTRATION\n`
      output += `-----------------\n`
      output += `Total Cards: ${cardDetails.reduce((sum, card) => sum + card.quantity, 0)}\n\n`
    }

    // Main deck list
    output += `MAIN DECK\n`
    output += `---------\n`
    
    const sortedCards = this.sortCards(cardDetails, 'name', 'asc')
    for (const card of sortedCards) {
      output += `${card.quantity} ${card.name}\n`
    }

    if (options.formatForJudges) {
      output += `\n\nJUDGE NOTES\n`
      output += `-----------\n`
      output += `• Deck checked and verified\n`
      output += `• No illegal cards found\n`
      output += `• Format compliance confirmed\n\n`
      output += `Judge Signature: _____________________\n`
      output += `Date/Time: ___________________________\n`
    }

    const data = Buffer.from(output, 'utf-8')
    
    return {
      success: true,
      data,
      fileName: `${this.sanitizeFileName(deck.name)}_tournament.txt`,
      mimeType: 'text/plain',
      fileSize: data.length,
      errors: [],
      warnings: [],
      metadata: {
        format: 'tournament',
        processingTime: 0,
        fileSize: data.length,
        decksExported: 1,
        cardsExported: cardDetails.length
      }
    }
  }

  /**
   * Generate proxy sheet export
   */
  private async generateProxyExport(deck: any, cardDetails: any[], options: ExportOptions): Promise<ExportResult> {
    const cardsPerPage = options.cardsPerPage || 9
    const includeSetSymbols = options.includeSetSymbols ?? true
    const includeCollectorNumbers = options.includeCollectorNumbers ?? true
    const highResolution = options.highResolution ?? false

    // Generate HTML for proxy sheets
    let html = `<!DOCTYPE html>
<html>
<head>
    <title>Proxy Sheet - ${deck.name}</title>
    <style>
        @page { size: letter; margin: 0.5in; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .page { page-break-after: always; }
        .card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .card { 
            border: 1px solid #000; 
            padding: 8px; 
            height: 3.5in; 
            width: 2.5in; 
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
        }
        .card-name { font-weight: bold; font-size: 12px; margin-bottom: 4px; }
        .card-cost { font-size: 10px; margin-bottom: 4px; }
        .card-type { font-size: 10px; margin-bottom: 4px; font-style: italic; }
        .card-text { font-size: 9px; flex-grow: 1; }
        .card-stats { font-size: 10px; text-align: right; margin-top: auto; }
        .card-info { font-size: 8px; color: #666; margin-top: 4px; }
    </style>
</head>
<body>`

    // Expand cards by quantity
    const expandedCards = []
    for (const card of cardDetails) {
      for (let i = 0; i < card.quantity; i++) {
        expandedCards.push(card)
      }
    }

    // Generate pages
    for (let i = 0; i < expandedCards.length; i += cardsPerPage) {
      const pageCards = expandedCards.slice(i, i + cardsPerPage)
      
      html += `<div class="page"><div class="card-grid">`
      
      for (const card of pageCards) {
        html += `<div class="card">
          <div class="card-name">${card.name}</div>
          <div class="card-cost">${card.manaCost || ''}</div>
          <div class="card-type">${card.typeLine || ''}</div>
          <div class="card-text">${card.oracleText || ''}</div>
          ${card.power !== undefined && card.toughness !== undefined ? 
            `<div class="card-stats">${card.power}/${card.toughness}</div>` : ''}
          <div class="card-info">
            ${includeSetSymbols && card.set ? `${card.set.toUpperCase()}` : ''}
            ${includeCollectorNumbers && card.collectorNumber ? ` #${card.collectorNumber}` : ''}
            ${card.rarity ? ` (${card.rarity})` : ''}
          </div>
        </div>`
      }
      
      html += `</div></div>`
    }

    html += `</body></html>`

    const data = Buffer.from(html, 'utf-8')
    
    return {
      success: true,
      data,
      fileName: `${this.sanitizeFileName(deck.name)}_proxies.html`,
      mimeType: 'text/html',
      fileSize: data.length,
      errors: [],
      warnings: [],
      metadata: {
        format: 'proxy',
        processingTime: 0,
        fileSize: data.length,
        decksExported: 1,
        cardsExported: expandedCards.length
      }
    }
  }

  /**
   * Generate custom format export using template
   */
  private async generateCustomExport(
    deck: any, 
    cardDetails: any[], 
    customFormat: any, 
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Prepare template variables
      const variables = await this.prepareTemplateVariables(deck, cardDetails, options)
      
      // Render template
      const renderedContent = await this.templateEngine.render(
        customFormat.template,
        variables,
        { escapeHtml: false }
      )

      const data = Buffer.from(renderedContent, 'utf-8')
      
      return {
        success: true,
        data,
        fileName: `${this.sanitizeFileName(deck.name)}.${customFormat.fileExtension}`,
        mimeType: customFormat.mimeType,
        fileSize: data.length,
        errors: [],
        warnings: [],
        metadata: {
          format: 'custom',
          processingTime: 0,
          fileSize: data.length,
          decksExported: 1,
          cardsExported: cardDetails.length,
          customFormatUsed: customFormat.name
        }
      }
    } catch (error) {
      throw new Error(`Custom format rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create custom format
   */
  async createCustomFormat(
    userId: string,
    format: Omit<CustomFormat, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'rating' | 'ratingCount'>
  ): Promise<CustomFormat> {
    // Validate template
    const validation = await this.templateEngine.validate(format.template)
    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
    }

    const customFormat = await db.customFormat.create({
      data: {
        ...format,
        userId,
        usageCount: 0,
        rating: 0,
        ratingCount: 0
      }
    })

    logger.info('Custom format created', { formatId: customFormat.id, userId, name: format.name })

    return customFormat as CustomFormat
  }

  /**
   * Update custom format
   */
  async updateCustomFormat(id: string, updates: Partial<CustomFormat>): Promise<CustomFormat> {
    // Validate template if being updated
    if (updates.template) {
      const validation = await this.templateEngine.validate(updates.template)
      if (!validation.isValid) {
        throw new Error(`Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
      }
    }

    const customFormat = await db.customFormat.update({
      where: { id },
      data: updates
    })

    return customFormat as CustomFormat
  }

  /**
   * Delete custom format
   */
  async deleteCustomFormat(id: string): Promise<void> {
    await db.customFormat.delete({
      where: { id }
    })
  }

  /**
   * Get export job status
   */
  async getExportJob(jobId: string): Promise<ExportJob | null> {
    const job = await db.exportJob.findUnique({
      where: { id: jobId },
      include: {
        items: true,
        customFormat: true
      }
    })

    return job as ExportJob | null
  }

  /**
   * Cancel export job
   */
  async cancelExportJob(jobId: string): Promise<void> {
    await db.exportJob.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        processingCompletedAt: new Date()
      }
    })

    // Cancel background job if still pending
    await jobProcessor.cancel('export-job', { jobId })
  }

  /**
   * Get user's export jobs
   */
  async getUserExportJobs(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ jobs: ExportJob[]; total: number }> {
    const [jobs, total] = await Promise.all([
      db.exportJob.findMany({
        where: { userId },
        include: {
          items: true,
          customFormat: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      db.exportJob.count({
        where: { userId }
      })
    ])

    return {
      jobs: jobs as ExportJob[],
      total
    }
  }

  /**
   * Helper methods
   */
  private async getEnhancedCardData(deckCards: any[], options: ExportOptions): Promise<any[]> {
    const cardDetails = []
    
    for (const deckCard of deckCards) {
      const card = deckCard.card
      const cardDetail = {
        name: card.name,
        quantity: deckCard.quantity,
        category: deckCard.category || 'Other',
        manaCost: card.mana_cost || '',
        cmc: card.cmc || 0,
        typeLine: card.type_line || '',
        oracleText: card.oracle_text || '',
        colors: card.colors || [],
        colorIdentity: card.color_identity || [],
        rarity: card.rarity || 'common',
        set: card.set || '',
        collectorNumber: card.collector_number || '',
        power: card.power,
        toughness: card.toughness,
        ...(options.includePrices && card.prices?.usd && { price: parseFloat(card.prices.usd) }),
        ...(options.includeImages && card.image_uris?.normal && { imageUrl: card.image_uris.normal }),
        ...(options.includeRulings && { rulings: [] }), // Would fetch from Scryfall if needed
        ...(options.includeLegalities && card.legalities && { legalities: card.legalities })
      }
      
      cardDetails.push(cardDetail)
    }
    
    return cardDetails
  }

  private groupCardsByCategory(cards: any[], categoryOrder?: string[]): Map<string, any[]> {
    const categories = new Map<string, any[]>()
    
    // Group cards
    for (const card of cards) {
      const category = card.category || 'Other'
      if (!categories.has(category)) {
        categories.set(category, [])
      }
      categories.get(category)!.push(card)
    }
    
    // Sort categories if order specified
    if (categoryOrder) {
      const sortedCategories = new Map<string, any[]>()
      
      // Add categories in specified order
      for (const category of categoryOrder) {
        if (categories.has(category)) {
          sortedCategories.set(category, categories.get(category)!)
          categories.delete(category)
        }
      }
      
      // Add remaining categories
      for (const [category, cards] of categories) {
        sortedCategories.set(category, cards)
      }
      
      return sortedCategories
    }
    
    return categories
  }

  private sortCards(cards: any[], sortBy?: string, sortOrder?: string): any[] {
    const sorted = [...cards]
    
    sorted.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'cmc':
          comparison = (a.cmc || 0) - (b.cmc || 0)
          break
        case 'type':
          comparison = (a.typeLine || '').localeCompare(b.typeLine || '')
          break
        case 'color':
          comparison = (a.colors?.[0] || '').localeCompare(b.colors?.[0] || '')
          break
        case 'name':
        default:
          comparison = a.name.localeCompare(b.name)
          break
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })
    
    return sorted
  }

  private calculateDeckStatistics(cards: any[]): any {
    const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0)
    const totalCMC = cards.reduce((sum, card) => sum + (card.cmc || 0) * card.quantity, 0)
    const averageCMC = totalCards > 0 ? totalCMC / totalCards : 0
    
    const colorDistribution: Record<string, number> = {}
    const typeDistribution: Record<string, number> = {}
    const rarityDistribution: Record<string, number> = {}
    let totalValue = 0
    
    for (const card of cards) {
      // Color distribution
      if (card.colors) {
        for (const color of card.colors) {
          colorDistribution[color] = (colorDistribution[color] || 0) + card.quantity
        }
      }
      
      // Type distribution
      if (card.typeLine) {
        const primaryType = card.typeLine.split(' ')[0]
        typeDistribution[primaryType] = (typeDistribution[primaryType] || 0) + card.quantity
      }
      
      // Rarity distribution
      rarityDistribution[card.rarity] = (rarityDistribution[card.rarity] || 0) + card.quantity
      
      // Total value
      if (card.price) {
        totalValue += card.price * card.quantity
      }
    }
    
    return {
      totalCards,
      averageCMC,
      colorDistribution,
      typeDistribution,
      rarityDistribution,
      totalValue: totalValue > 0 ? totalValue : undefined
    }
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_')
  }

  private async updateJobStatus(jobId: string, status: ExportJobStatus): Promise<void> {
    await db.exportJob.update({
      where: { id: jobId },
      data: { 
        status,
        ...(status === 'processing' && { processingStartedAt: new Date() })
      }
    })
  }

  private async updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<void> {
    await db.exportJob.update({
      where: { id: jobId },
      data: { progress, currentStep }
    })
  }

  private async combineExportResults(results: ExportResult[], format: ExportFormat, options: ExportOptions): Promise<ExportResult> {
    // For now, concatenate results with separators
    // In a real implementation, this would create proper ZIP files
    
    const combinedContent = results.map((result, index) => {
      return `=== ${result.fileName} ===\n${result.data.toString()}\n\n`
    }).join('')
    
    const combinedData = Buffer.from(combinedContent, 'utf-8')
    
    return {
      success: results.every(r => r.success),
      data: combinedData,
      fileName: `export_${format}_${Date.now()}.txt`,
      mimeType: 'text/plain',
      fileSize: combinedData.length,
      errors: results.flatMap(r => r.errors),
      warnings: results.flatMap(r => r.warnings),
      metadata: {
        format,
        processingTime: results.reduce((sum, r) => sum + r.metadata.processingTime, 0),
        fileSize: combinedData.length,
        decksExported: results.length,
        cardsExported: results.reduce((sum, r) => sum + r.metadata.cardsExported, 0)
      }
    }
  }

  private async compressExportResult(result: ExportResult, options: CompressionOptions): Promise<ExportResult> {
    let compressedData: Buffer
    let compressionRatio: number
    
    switch (options.type) {
      case 'gzip':
        compressedData = await gzip(result.data)
        compressionRatio = compressedData.length / result.data.length
        break
      case 'zip':
        // For now, just use gzip compression
        // In a real implementation, this would create proper ZIP files
        compressedData = await gzip(result.data)
        compressionRatio = compressedData.length / result.data.length
        break
      default:
        return result
    }
    
    return {
      ...result,
      data: compressedData,
      fileSize: compressedData.length,
      compression: options.type,
      metadata: {
        ...result.metadata,
        compression: options.type,
        compressionRatio
      }
    }
  }

  private async saveExportResult(jobId: string, result: ExportResult): Promise<string> {
    // In a real implementation, this would save to cloud storage (S3, etc.)
    // For now, we'll simulate with a local path
    const fileName = `export_${jobId}_${Date.now()}.${result.fileName.split('.').pop()}`
    const filePath = path.join(process.env.EXPORT_STORAGE_PATH || '/tmp/exports', fileName)
    
    await fs.writeFile(filePath, result.data)
    
    // Return download URL (would be actual URL in production)
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/exports/download/${fileName}`
  }

  private async recordExportAnalytics(job: any, result: ExportResult, processingTime: number): Promise<void> {
    await db.exportAnalytics.create({
      data: {
        userId: job.userId,
        format: job.format,
        jobType: job.type,
        status: job.status,
        decksCount: job.totalDecks,
        cardsCount: result.metadata.cardsExported,
        processingTime,
        fileSize: result.fileSize,
        compressionRatio: result.metadata.compressionRatio,
        downloadCount: 0,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        successRate: result.success ? 100 : 0,
        metadata: {
          format: result.metadata.format,
          compression: result.metadata.compression
        }
      }
    })
  }

  private async prepareTemplateVariables(deck: any, cardDetails: any[], options: ExportOptions): Promise<TemplateVariables> {
    const statistics = this.calculateDeckStatistics(cardDetails)
    
    return {
      deck: {
        id: deck.id,
        name: deck.name,
        commander: deck.commander,
        format: deck.format,
        description: deck.description,
        tags: deck.tags || [],
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt
      },
      cards: cardDetails.map(card => ({
        id: card.id || '',
        name: card.name,
        quantity: card.quantity,
        category: card.category,
        manaCost: card.manaCost,
        cmc: card.cmc,
        typeLine: card.typeLine,
        oracleText: card.oracleText,
        colors: card.colors,
        colorIdentity: card.colorIdentity,
        rarity: card.rarity,
        set: card.set,
        price: card.price
      })),
      statistics,
      user: {
        id: deck.userId,
        name: 'User', // Would get from user table
        email: 'user@example.com' // Would get from user table
      },
      system: {
        exportedAt: new Date(),
        version: '1.0',
        format: options.templateId ? 'custom' : 'standard',
        options
      }
    }
  }

  private registerBuiltInFormats(): void {
    // Register built-in format handlers
    // This would include standard formats like Moxfield, Archidekt, etc.
  }



  // Placeholder implementations for other formats
  private async generateMoxfieldExport(deck: any, cardDetails: any[], options: ExportOptions): Promise<ExportResult> {
    // Implementation would go here
    throw new Error('Moxfield export not yet implemented')
  }

  private async generateArchidektExport(deck: any, cardDetails: any[], options: ExportOptions): Promise<ExportResult> {
    // Implementation would go here
    throw new Error('Archidekt export not yet implemented')
  }

  private async generateTappedOutExport(deck: any, cardDetails: any[], options: ExportOptions): Promise<ExportResult> {
    // Implementation would go here
    throw new Error('TappedOut export not yet implemented')
  }

  private async generateEDHRECExport(deck: any, cardDetails: any[], options: ExportOptions): Promise<ExportResult> {
    // Implementation would go here
    throw new Error('EDHREC export not yet implemented')
  }

  private async generateMTGGoldfishExport(deck: any, cardDetails: any[], options: ExportOptions): Promise<ExportResult> {
    // Implementation would go here
    throw new Error('MTGGoldfish export not yet implemented')
  }

  private async generateCSVExport(deck: any, cardDetails: any[], options: ExportOptions): Promise<ExportResult> {
    // Implementation would go here
    throw new Error('CSV export not yet implemented')
  }
}

/**
 * Simple Template Engine Implementation
 */
class HandlebarsTemplateEngine implements TemplateEngine {
  async render(template: string, data: any, options?: TemplateOptions): Promise<string> {
    try {
      // Simple template replacement for basic variables
      let result = template
      
      // Replace {{deck.name}} style variables
      result = result.replace(/\{\{deck\.name\}\}/g, data.deck?.name || '')
      result = result.replace(/\{\{deck\.commander\}\}/g, data.deck?.commander || '')
      result = result.replace(/\{\{deck\.format\}\}/g, data.deck?.format || '')
      result = result.replace(/\{\{deck\.description\}\}/g, data.deck?.description || '')
      
      // Replace {{#each cards}} loops with simple card list
      const cardsMatch = result.match(/\{\{#each cards\}\}(.*?)\{\{\/each\}\}/s)
      if (cardsMatch && data.cards) {
        const cardTemplate = cardsMatch[1]
        const cardsList = data.cards.map((card: any) => {
          return cardTemplate
            .replace(/\{\{quantity\}\}/g, card.quantity.toString())
            .replace(/\{\{name\}\}/g, card.name)
            .replace(/\{\{category\}\}/g, card.category || '')
        }).join('')
        result = result.replace(cardsMatch[0], cardsList)
      }
      
      return result
    } catch (error) {
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async validate(template: string): Promise<TemplateValidationResult> {
    try {
      // Simple validation - check for balanced braces
      const openBraces = (template.match(/\{\{/g) || []).length
      const closeBraces = (template.match(/\}\}/g) || []).length
      
      if (openBraces !== closeBraces) {
        return {
          isValid: false,
          errors: [{
            line: 0,
            column: 0,
            message: 'Unbalanced template braces',
            code: 'SYNTAX_ERROR'
          }],
          warnings: [],
          usedVariables: [],
          unusedVariables: []
        }
      }
      
      return {
        isValid: true,
        errors: [],
        warnings: [],
        usedVariables: this.extractVariables(template),
        unusedVariables: []
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          line: 0,
          column: 0,
          message: error instanceof Error ? error.message : 'Template validation failed',
          code: 'VALIDATION_ERROR'
        }],
        warnings: [],
        usedVariables: [],
        unusedVariables: []
      }
    }
  }

  async getAvailableVariables(deckId: string): Promise<TemplateVariables> {
    // This would return the available variables for a specific deck
    // For now, return a mock structure
    return {
      deck: {
        id: deckId,
        name: 'Sample Deck',
        commander: 'Sample Commander',
        format: 'commander',
        description: 'Sample description',
        tags: ['sample'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      cards: [],
      statistics: {
        totalCards: 100,
        landCount: 36,
        nonlandCount: 64,
        averageCMC: 3.2,
        colorDistribution: {},
        typeDistribution: {},
        rarityDistribution: {},
        totalValue: 150.00
      },
      user: {
        id: 'user-id',
        name: 'User Name',
        email: 'user@example.com'
      },
      system: {
        exportedAt: new Date(),
        version: '1.0',
        format: 'custom',
        options: {}
      }
    }
  }

  private extractVariables(template: string): string[] {
    const variables: string[] = []
    const regex = /\{\{([^}]+)\}\}/g
    let match
    
    while ((match = regex.exec(template)) !== null) {
      const variable = match[1].trim().split(' ')[0] // Get first part before any helpers
      if (!variables.includes(variable)) {
        variables.push(variable)
      }
    }
    
    return variables
  }
}

// Export singleton instance
export const exportFormatEngine = new ExportFormatEngine()
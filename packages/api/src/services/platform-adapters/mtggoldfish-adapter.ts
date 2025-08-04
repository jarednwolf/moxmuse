/**
 * MTGGoldfish Platform Adapter
 * 
 * Handles import/export for MTGGoldfish deck format including tournament data.
 */

import { BasePlatformAdapter } from './base-adapter'
import {
  AdapterCapabilities,
  ParseOptions,
  ExportOptions,
  ParseResult,
  ExportResult,
  StandardDeck,
  StandardCard,
  DeckMetadata,
  MTGGoldfishDeck,
  MTGGoldfishCard
} from '@repo/shared/platform-adapter-types'

export class MTGGoldfishAdapter extends BasePlatformAdapter {
  readonly name = 'MTGGoldfish'
  readonly id = 'mtggoldfish'
  readonly version = '1.0.0'
  readonly supportedFormats = ['mtggoldfish', 'txt']
  readonly capabilities: AdapterCapabilities = {
    canImport: true,
    canExport: true,
    supportsMultipleDecks: false,
    supportsBulkOperations: true,
    supportsMetadata: true,
    supportsCategories: false,
    supportsCustomFields: true,
    requiresAuthentication: false
  }

  private readonly MTGGOLDFISH_URL_REGEX = /https?:\/\/(?:www\.)?mtggoldfish\.com\/(?:deck|archetype)\/(\d+)/
  private readonly MTGGOLDFISH_EXPORT_SUFFIX = '#paper'

  /**
   * Check if input can be handled by this adapter
   */
  async canHandle(input: string | File): Promise<boolean> {
    if (input instanceof File) {
      return input.name.toLowerCase().includes('mtggoldfish') ||
             input.name.toLowerCase().includes('goldfish') ||
             (input.name.toLowerCase().endsWith('.txt') && 
              input.name.toLowerCase().includes('deck'))
    }

    const content = input.trim()
    
    // Check for MTGGoldfish URL
    if (this.MTGGOLDFISH_URL_REGEX.test(content)) {
      return true
    }

    // Check for MTGGoldfish text format
    return this.isMTGGoldfishTextFormat(content)
  }

  /**
   * Parse decks from MTGGoldfish format
   */
  async parseDecks(input: string | File, options?: ParseOptions): Promise<ParseResult> {
    const opts = this.mergeParseOptions(options)
    const startTime = Date.now()

    try {
      let content: string
      
      if (input instanceof File) {
        content = await this.readFileContent(input)
      } else {
        content = input.trim()
      }

      // Handle MTGGoldfish URL
      if (this.MTGGOLDFISH_URL_REGEX.test(content)) {
        const deckId = this.extractDeckId(content)
        if (!deckId) {
          throw new Error('Invalid MTGGoldfish URL format')
        }
        content = await this.fetchDeckFromWeb(deckId)
      }

      // Parse text content
      const mtgGoldfishDeck = this.parseTextFormat(content)
      const standardDeck = this.convertToStandardDeck(mtgGoldfishDeck, opts)

      const processingTime = Date.now() - startTime

      return {
        success: true,
        decks: [standardDeck],
        errors: [],
        warnings: [],
        metadata: {
          source: this.name,
          processingTime,
          cardResolutionRate: 1.0,
          totalCards: standardDeck.cards.length,
          resolvedCards: standardDeck.cards.length,
          unresolvedCards: []
        }
      }
    } catch (error) {
      return {
        success: false,
        decks: [],
        errors: [this.createParseError(
          'parsing_error',
          `Failed to parse MTGGoldfish deck: ${error instanceof Error ? error.message : 'Unknown error'}`
        )],
        warnings: [],
        metadata: {
          source: this.name,
          processingTime: Date.now() - startTime,
          cardResolutionRate: 0,
          totalCards: 0,
          resolvedCards: 0,
          unresolvedCards: []
        }
      }
    }
  }

  /**
   * Export deck to MTGGoldfish format
   */
  async exportDeck(deck: StandardDeck, format: string, options?: ExportOptions): Promise<ExportResult> {
    const opts = this.mergeExportOptions(options)
    const startTime = Date.now()

    try {
      const textContent = this.convertToTextFormat(deck, opts)

      return {
        success: true,
        data: textContent,
        filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}_mtggoldfish.txt`,
        mimeType: 'text/plain',
        errors: [],
        metadata: {
          format: 'mtggoldfish',
          processingTime: Date.now() - startTime,
          fileSize: Buffer.byteLength(textContent, 'utf8')
        }
      }
    } catch (error) {
      return {
        success: false,
        data: '',
        filename: '',
        mimeType: '',
        errors: [{
          type: 'format_error',
          message: `Failed to export to MTGGoldfish format: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        metadata: {
          format: 'mtggoldfish',
          processingTime: Date.now() - startTime,
          fileSize: 0
        }
      }
    }
  }

  /**
   * Check if text content is in MTGGoldfish format
   */
  private isMTGGoldfishTextFormat(content: string): boolean {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    // Look for MTGGoldfish-specific patterns
    const hasMainboard = lines.some(line => line.toLowerCase() === 'mainboard' || line.toLowerCase() === 'main deck')
    const hasSideboard = lines.some(line => line.toLowerCase() === 'sideboard' || line.toLowerCase() === 'side board')
    const hasCardLines = lines.some(line => /^\d+\s+/.test(line))
    const hasPrices = lines.some(line => line.includes('$'))
    
    return hasCardLines && (hasMainboard || hasSideboard || hasPrices)
  }

  /**
   * Extract deck ID from MTGGoldfish URL
   */
  private extractDeckId(url: string): string | null {
    const match = url.match(this.MTGGOLDFISH_URL_REGEX)
    return match ? match[1] : null
  }

  /**
   * Fetch deck data from MTGGoldfish web export
   */
  private async fetchDeckFromWeb(deckId: string): Promise<string> {
    // Note: This is a simplified implementation
    // In practice, you might need to handle authentication or use a different approach
    const exportUrl = `https://www.mtggoldfish.com/deck/download/${deckId}`
    const response = await fetch(exportUrl)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch deck from MTGGoldfish: ${response.status} ${response.statusText}`)
    }

    return await response.text()
  }

  /**
   * Read content from file
   */
  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  /**
   * Parse MTGGoldfish text format
   */
  private parseTextFormat(content: string): MTGGoldfishDeck {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    let deckName = 'MTGGoldfish Deck'
    let format = 'commander'
    let author = 'Unknown'
    let date = new Date().toISOString().split('T')[0]
    
    const mainboard: MTGGoldfishCard[] = []
    const sideboard: MTGGoldfishCard[] = []
    
    let currentSection: 'main' | 'sideboard' = 'main'
    let inMetadata = true
    
    for (const line of lines) {
      // Skip empty lines and comments
      if (line.startsWith('//') || line.startsWith('#')) {
        continue
      }
      
      // Check for section headers
      if (line.toLowerCase() === 'mainboard' || line.toLowerCase() === 'main deck') {
        currentSection = 'main'
        inMetadata = false
        continue
      }
      
      if (line.toLowerCase() === 'sideboard' || line.toLowerCase() === 'side board') {
        currentSection = 'sideboard'
        inMetadata = false
        continue
      }
      
      // Parse metadata from early lines
      if (inMetadata) {
        if (line.toLowerCase().startsWith('deck:') || line.toLowerCase().startsWith('name:')) {
          deckName = line.split(':').slice(1).join(':').trim()
          continue
        }
        
        if (line.toLowerCase().startsWith('format:')) {
          format = line.split(':')[1].trim().toLowerCase()
          continue
        }
        
        if (line.toLowerCase().startsWith('author:') || line.toLowerCase().startsWith('player:')) {
          author = line.split(':')[1].trim()
          continue
        }
        
        if (line.toLowerCase().startsWith('date:')) {
          date = line.split(':')[1].trim()
          continue
        }
      }
      
      // Parse card lines with optional pricing
      const cardMatch = line.match(/^(\d+)\s+(.+?)(?:\s+\$(\d+(?:\.\d+)?))?\s*$/)
      if (cardMatch) {
        inMetadata = false
        const quantity = parseInt(cardMatch[1], 10)
        const cardName = this.normalizeCardName(cardMatch[2])
        const price = cardMatch[3] ? parseFloat(cardMatch[3]) : undefined
        
        const card: MTGGoldfishCard = {
          name: cardName,
          quantity,
          price
        }
        
        if (currentSection === 'sideboard') {
          sideboard.push(card)
        } else {
          mainboard.push(card)
        }
      }
    }
    
    return {
      name: deckName,
      format,
      author,
      date,
      mainboard,
      sideboard
    }
  }

  /**
   * Convert MTGGoldfish deck to standard format
   */
  private convertToStandardDeck(mtgGoldfishDeck: MTGGoldfishDeck, options: Required<ParseOptions>): StandardDeck {
    const cards: StandardCard[] = mtgGoldfishDeck.mainboard.map(card => 
      this.convertMTGGoldfishCard(card)
    )

    const sideboard: StandardCard[] = mtgGoldfishDeck.sideboard.map(card => 
      this.convertMTGGoldfishCard(card)
    )

    // Try to identify commander from cards (for Commander format)
    let commander: StandardCard | undefined
    if (mtgGoldfishDeck.format.toLowerCase() === 'commander' || 
        mtgGoldfishDeck.format.toLowerCase() === 'edh') {
      const commanderIndex = cards.findIndex(card => 
        card.quantity === 1 && 
        card.metadata?.typeLine?.includes('Legendary')
      )
      
      if (commanderIndex >= 0) {
        commander = cards.splice(commanderIndex, 1)[0]
      }
    }

    const metadata: DeckMetadata = {
      source: this.name,
      author: mtgGoldfishDeck.author,
      createdAt: new Date(mtgGoldfishDeck.date),
      customFields: options.includeMetadata ? {
        originalFormat: mtgGoldfishDeck.format,
        totalPrice: this.calculateTotalPrice(mtgGoldfishDeck)
      } : {}
    }

    return {
      name: mtgGoldfishDeck.name,
      format: mtgGoldfishDeck.format,
      commander,
      cards,
      sideboard: sideboard.length > 0 ? sideboard : undefined,
      metadata
    }
  }

  /**
   * Convert MTGGoldfish card to standard format
   */
  private convertMTGGoldfishCard(mtgGoldfishCard: MTGGoldfishCard): StandardCard {
    return {
      name: mtgGoldfishCard.name,
      quantity: mtgGoldfishCard.quantity,
      set: mtgGoldfishCard.set,
      metadata: {
        price: mtgGoldfishCard.price,
        originalSet: mtgGoldfishCard.set
      }
    }
  }

  /**
   * Convert standard deck to MTGGoldfish text format
   */
  private convertToTextFormat(deck: StandardDeck, options: Required<ExportOptions>): string {
    const lines: string[] = []
    
    // Add metadata
    lines.push(`Deck: ${deck.name}`)
    lines.push(`Format: ${deck.format}`)
    if (deck.metadata.author) {
      lines.push(`Author: ${deck.metadata.author}`)
    }
    lines.push(`Date: ${new Date().toISOString().split('T')[0]}`)
    lines.push('')
    
    // Add commander if present
    if (deck.commander) {
      lines.push('Commander')
      lines.push(this.formatCardLine(deck.commander, options))
      lines.push('')
    }
    
    // Add main deck
    lines.push('Mainboard')
    deck.cards.forEach(card => {
      lines.push(this.formatCardLine(card, options))
    })
    
    // Add sideboard if present
    if (deck.sideboard && deck.sideboard.length > 0) {
      lines.push('')
      lines.push('Sideboard')
      deck.sideboard.forEach(card => {
        lines.push(this.formatCardLine(card, options))
      })
    }
    
    return lines.join('\n')
  }

  /**
   * Format a card line for MTGGoldfish export
   */
  private formatCardLine(card: StandardCard, options: Required<ExportOptions>): string {
    let line = `${card.quantity} ${card.name}`
    
    if (options.includePrices && card.metadata?.price) {
      line += ` $${card.metadata.price.toFixed(2)}`
    }
    
    return line
  }

  /**
   * Calculate total deck price
   */
  private calculateTotalPrice(deck: MTGGoldfishDeck): number {
    let total = 0
    
    deck.mainboard.forEach(card => {
      if (card.price) {
        total += card.price * card.quantity
      }
    })
    
    deck.sideboard.forEach(card => {
      if (card.price) {
        total += card.price * card.quantity
      }
    })
    
    return total
  }
}
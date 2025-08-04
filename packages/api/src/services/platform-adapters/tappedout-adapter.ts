/**
 * TappedOut Platform Adapter
 * 
 * Handles import/export for TappedOut deck format including web scraping.
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
  TappedOutDeck,
  TappedOutCard
} from '@repo/shared/platform-adapter-types'

export class TappedOutAdapter extends BasePlatformAdapter {
  readonly name = 'TappedOut'
  readonly id = 'tappedout'
  readonly version = '1.0.0'
  readonly supportedFormats = ['tappedout', 'txt']
  readonly capabilities: AdapterCapabilities = {
    canImport: true,
    canExport: true,
    supportsMultipleDecks: false,
    supportsBulkOperations: true,
    supportsMetadata: true,
    supportsCategories: true,
    supportsCustomFields: false,
    requiresAuthentication: false
  }

  private readonly TAPPEDOUT_URL_REGEX = /https?:\/\/(?:www\.)?tappedout\.net\/mtg-decks\/([^\/]+)/
  private readonly TAPPEDOUT_EXPORT_SUFFIX = '?fmt=txt'

  /**
   * Check if input can be handled by this adapter
   */
  async canHandle(input: string | File): Promise<boolean> {
    if (input instanceof File) {
      return input.name.toLowerCase().includes('tappedout') ||
             input.name.toLowerCase().endsWith('.txt')
    }

    const content = input.trim()
    
    // Check for TappedOut URL
    if (this.TAPPEDOUT_URL_REGEX.test(content)) {
      return true
    }

    // Check for TappedOut text format patterns
    return this.isTappedOutTextFormat(content)
  }

  /**
   * Parse decks from TappedOut format
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

      // Handle TappedOut URL
      if (this.TAPPEDOUT_URL_REGEX.test(content)) {
        const deckSlug = this.extractDeckSlug(content)
        if (!deckSlug) {
          throw new Error('Invalid TappedOut URL format')
        }
        content = await this.fetchDeckFromWeb(deckSlug)
      }

      // Parse text content
      const tappedOutDeck = this.parseTextFormat(content)
      const standardDeck = this.convertToStandardDeck(tappedOutDeck, opts)

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
          `Failed to parse TappedOut deck: ${error instanceof Error ? error.message : 'Unknown error'}`
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
   * Export deck to TappedOut format
   */
  async exportDeck(deck: StandardDeck, format: string, options?: ExportOptions): Promise<ExportResult> {
    const opts = this.mergeExportOptions(options)
    const startTime = Date.now()

    try {
      const textContent = this.convertToTextFormat(deck, opts)

      return {
        success: true,
        data: textContent,
        filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}_tappedout.txt`,
        mimeType: 'text/plain',
        errors: [],
        metadata: {
          format: 'tappedout',
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
          message: `Failed to export to TappedOut format: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        metadata: {
          format: 'tappedout',
          processingTime: Date.now() - startTime,
          fileSize: 0
        }
      }
    }
  }

  /**
   * Check if text content is in TappedOut format
   */
  private isTappedOutTextFormat(content: string): boolean {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    // Look for TappedOut-specific patterns
    const hasMainboard = lines.some(line => line.toLowerCase().includes('mainboard') || line.toLowerCase().includes('main deck'))
    const hasSideboard = lines.some(line => line.toLowerCase().includes('sideboard') || line.toLowerCase().includes('side board'))
    const hasCardLines = lines.some(line => /^\d+x?\s+/.test(line))
    
    return hasCardLines && (hasMainboard || hasSideboard || lines.length > 10)
  }

  /**
   * Extract deck slug from TappedOut URL
   */
  private extractDeckSlug(url: string): string | null {
    const match = url.match(this.TAPPEDOUT_URL_REGEX)
    return match ? match[1] : null
  }

  /**
   * Fetch deck data from TappedOut web export
   */
  private async fetchDeckFromWeb(deckSlug: string): Promise<string> {
    const exportUrl = `https://tappedout.net/mtg-decks/${deckSlug}${this.TAPPEDOUT_EXPORT_SUFFIX}`
    const response = await fetch(exportUrl)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch deck from TappedOut: ${response.status} ${response.statusText}`)
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
   * Parse TappedOut text format
   */
  private parseTextFormat(content: string): TappedOutDeck {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    let deckName = 'Imported Deck'
    let description = ''
    let format = 'commander'
    let user = 'Unknown'
    let url = ''
    
    const cards: TappedOutCard[] = []
    const sideboard: TappedOutCard[] = []
    const maybeboard: TappedOutCard[] = []
    
    let currentSection: 'main' | 'sideboard' | 'maybeboard' = 'main'
    let inMetadata = true
    
    for (const line of lines) {
      // Skip empty lines and comments
      if (line.startsWith('//') || line.startsWith('#')) {
        continue
      }
      
      // Check for section headers
      if (line.toLowerCase().includes('mainboard') || line.toLowerCase().includes('main deck')) {
        currentSection = 'main'
        inMetadata = false
        continue
      }
      
      if (line.toLowerCase().includes('sideboard') || line.toLowerCase().includes('side board')) {
        currentSection = 'sideboard'
        inMetadata = false
        continue
      }
      
      if (line.toLowerCase().includes('maybeboard') || line.toLowerCase().includes('maybe board')) {
        currentSection = 'maybeboard'
        inMetadata = false
        continue
      }
      
      // Parse metadata from early lines
      if (inMetadata) {
        if (line.toLowerCase().startsWith('name:') || line.toLowerCase().startsWith('deck name:')) {
          deckName = line.split(':').slice(1).join(':').trim()
          continue
        }
        
        if (line.toLowerCase().startsWith('format:')) {
          format = line.split(':')[1].trim().toLowerCase()
          continue
        }
        
        if (line.toLowerCase().startsWith('author:') || line.toLowerCase().startsWith('user:')) {
          user = line.split(':')[1].trim()
          continue
        }
        
        if (line.toLowerCase().startsWith('url:')) {
          url = line.split(':').slice(1).join(':').trim()
          continue
        }
      }
      
      // Parse card lines
      const cardMatch = line.match(/^(\d+)x?\s+(.+?)(?:\s+\[([^\]]+)\])?(?:\s*\*F\*)?$/)
      if (cardMatch) {
        inMetadata = false
        const quantity = parseInt(cardMatch[1], 10)
        const cardName = this.normalizeCardName(cardMatch[2])
        const set = cardMatch[3]
        const foil = line.includes('*F*')
        
        const card: TappedOutCard = {
          name: cardName,
          quantity,
          set,
          foil
        }
        
        switch (currentSection) {
          case 'sideboard':
            sideboard.push(card)
            break
          case 'maybeboard':
            maybeboard.push(card)
            break
          default:
            cards.push(card)
        }
      }
    }
    
    return {
      name: deckName,
      description,
      format,
      user,
      url,
      cards,
      sideboard,
      maybeboard
    }
  }

  /**
   * Convert TappedOut deck to standard format
   */
  private convertToStandardDeck(tappedOutDeck: TappedOutDeck, options: Required<ParseOptions>): StandardDeck {
    const cards: StandardCard[] = tappedOutDeck.cards.map(card => 
      this.convertTappedOutCard(card)
    )

    const sideboard: StandardCard[] = tappedOutDeck.sideboard.map(card => 
      this.convertTappedOutCard(card)
    )

    const maybeboard: StandardCard[] = tappedOutDeck.maybeboard.map(card => 
      this.convertTappedOutCard(card)
    )

    // Try to identify commander from cards
    let commander: StandardCard | undefined
    const commanderIndex = cards.findIndex(card => 
      card.quantity === 1 && 
      (card.metadata?.typeLine?.includes('Legendary') || 
       card.category === 'Commander')
    )
    
    if (commanderIndex >= 0) {
      commander = cards.splice(commanderIndex, 1)[0]
    }

    const metadata: DeckMetadata = {
      source: this.name,
      sourceUrl: tappedOutDeck.url,
      author: tappedOutDeck.user,
      customFields: options.includeMetadata ? {
        originalFormat: tappedOutDeck.format
      } : {}
    }

    return {
      name: tappedOutDeck.name,
      description: tappedOutDeck.description,
      format: tappedOutDeck.format,
      commander,
      cards,
      sideboard: sideboard.length > 0 ? sideboard : undefined,
      maybeboard: maybeboard.length > 0 ? maybeboard : undefined,
      metadata
    }
  }

  /**
   * Convert TappedOut card to standard format
   */
  private convertTappedOutCard(tappedOutCard: TappedOutCard): StandardCard {
    return {
      name: tappedOutCard.name,
      quantity: tappedOutCard.quantity,
      isFoil: tappedOutCard.foil,
      set: tappedOutCard.set,
      category: tappedOutCard.category,
      metadata: {
        originalSet: tappedOutCard.set
      }
    }
  }

  /**
   * Convert standard deck to TappedOut text format
   */
  private convertToTextFormat(deck: StandardDeck, options: Required<ExportOptions>): string {
    const lines: string[] = []
    
    // Add metadata if requested
    if (options.includeMetadata) {
      lines.push(`// Deck: ${deck.name}`)
      if (deck.description) {
        lines.push(`// Description: ${deck.description}`)
      }
      lines.push(`// Format: ${deck.format}`)
      if (deck.metadata.author) {
        lines.push(`// Author: ${deck.metadata.author}`)
      }
      lines.push('')
    }
    
    // Add commander if present
    if (deck.commander) {
      lines.push('// Commander')
      lines.push(this.formatCardLine(deck.commander, options))
      lines.push('')
    }
    
    // Add main deck
    lines.push('// Mainboard')
    
    // Group cards by category if requested
    if (options.includeCategories && deck.categories) {
      for (const category of deck.categories) {
        lines.push(`// ${category.name}`)
        const categoryCards = deck.cards.filter(card => 
          category.cards.includes(card.name)
        )
        categoryCards.forEach(card => {
          lines.push(this.formatCardLine(card, options))
        })
        lines.push('')
      }
    } else {
      deck.cards.forEach(card => {
        lines.push(this.formatCardLine(card, options))
      })
    }
    
    // Add sideboard if present
    if (deck.sideboard && deck.sideboard.length > 0) {
      lines.push('')
      lines.push('// Sideboard')
      deck.sideboard.forEach(card => {
        lines.push(this.formatCardLine(card, options))
      })
    }
    
    // Add maybeboard if present
    if (deck.maybeboard && deck.maybeboard.length > 0) {
      lines.push('')
      lines.push('// Maybeboard')
      deck.maybeboard.forEach(card => {
        lines.push(this.formatCardLine(card, options))
      })
    }
    
    return lines.join('\n')
  }

  /**
   * Format a card line for TappedOut export
   */
  private formatCardLine(card: StandardCard, options: Required<ExportOptions>): string {
    let line = `${card.quantity} ${card.name}`
    
    if (card.set) {
      line += ` [${card.set}]`
    }
    
    if (card.isFoil) {
      line += ' *F*'
    }
    
    return line
  }
}
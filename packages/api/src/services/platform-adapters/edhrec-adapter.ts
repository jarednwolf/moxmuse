/**
 * EDHREC Platform Adapter
 * 
 * Handles import/export for EDHREC average decklists and recommendations.
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
  EDHRECDeck,
  EDHRECCard
} from '@repo/shared/platform-adapter-types'

export class EDHRECAdapter extends BasePlatformAdapter {
  readonly name = 'EDHREC'
  readonly id = 'edhrec'
  readonly version = '1.0.0'
  readonly supportedFormats = ['edhrec', 'json', 'txt']
  readonly capabilities: AdapterCapabilities = {
    canImport: true,
    canExport: true,
    supportsMultipleDecks: false,
    supportsBulkOperations: false,
    supportsMetadata: true,
    supportsCategories: false,
    supportsCustomFields: true,
    requiresAuthentication: false
  }

  private readonly EDHREC_URL_REGEX = /https?:\/\/(?:www\.)?edhrec\.com\/commanders\/([^\/\?]+)/
  private readonly EDHREC_API_BASE = 'https://json.edhrec.com/pages/commanders'

  /**
   * Check if input can be handled by this adapter
   */
  async canHandle(input: string | File): Promise<boolean> {
    if (input instanceof File) {
      return input.name.toLowerCase().includes('edhrec') ||
             (input.name.toLowerCase().endsWith('.json') && 
              input.name.toLowerCase().includes('commander'))
    }

    const content = input.trim()
    
    // Check for EDHREC URL
    if (this.EDHREC_URL_REGEX.test(content)) {
      return true
    }

    // Check for EDHREC JSON format
    try {
      const parsed = JSON.parse(content)
      return this.isEDHRECFormat(parsed)
    } catch {
      // Check for EDHREC text format
      return this.isEDHRECTextFormat(content)
    }
  }

  /**
   * Parse decks from EDHREC format
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

      // Handle EDHREC URL
      if (this.EDHREC_URL_REGEX.test(content)) {
        const commanderSlug = this.extractCommanderSlug(content)
        if (!commanderSlug) {
          throw new Error('Invalid EDHREC URL format')
        }
        content = await this.fetchCommanderDataFromAPI(commanderSlug)
      }

      let edhrecDeck: EDHRECDeck

      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(content)
        edhrecDeck = this.parseJSONFormat(parsed)
      } catch {
        // Fall back to text format
        edhrecDeck = this.parseTextFormat(content)
      }

      const standardDeck = this.convertToStandardDeck(edhrecDeck, opts)
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
          `Failed to parse EDHREC deck: ${error instanceof Error ? error.message : 'Unknown error'}`
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
   * Export deck to EDHREC format
   */
  async exportDeck(deck: StandardDeck, format: string, options?: ExportOptions): Promise<ExportResult> {
    const opts = this.mergeExportOptions(options)
    const startTime = Date.now()

    try {
      let content: string
      let filename: string
      let mimeType: string

      if (format === 'json') {
        const edhrecDeck = this.convertFromStandardDeck(deck, opts)
        content = JSON.stringify(edhrecDeck, null, 2)
        filename = `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}_edhrec.json`
        mimeType = 'application/json'
      } else {
        content = this.convertToTextFormat(deck, opts)
        filename = `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}_edhrec.txt`
        mimeType = 'text/plain'
      }

      return {
        success: true,
        data: content,
        filename,
        mimeType,
        errors: [],
        metadata: {
          format: 'edhrec',
          processingTime: Date.now() - startTime,
          fileSize: Buffer.byteLength(content, 'utf8')
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
          message: `Failed to export to EDHREC format: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        metadata: {
          format: 'edhrec',
          processingTime: Date.now() - startTime,
          fileSize: 0
        }
      }
    }
  }

  /**
   * Check if JSON object is in EDHREC format
   */
  private isEDHRECFormat(obj: any): boolean {
    return obj &&
           typeof obj.commander === 'string' &&
           Array.isArray(obj.cards) &&
           obj.cards.every((card: any) => 
             typeof card.name === 'string' && 
             typeof card.quantity === 'number'
           )
  }

  /**
   * Check if text content is in EDHREC format
   */
  private isEDHRECTextFormat(content: string): boolean {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    // Look for EDHREC-specific patterns
    const hasCommander = lines.some(line => 
      line.toLowerCase().includes('commander:') || 
      line.toLowerCase().includes('general:')
    )
    const hasThemes = lines.some(line => 
      line.toLowerCase().includes('themes:') || 
      line.toLowerCase().includes('synergy:')
    )
    const hasCardLines = lines.some(line => /^\d+\s+/.test(line))
    
    return hasCommander || hasThemes || (hasCardLines && lines.length > 20)
  }

  /**
   * Extract commander slug from EDHREC URL
   */
  private extractCommanderSlug(url: string): string | null {
    const match = url.match(this.EDHREC_URL_REGEX)
    return match ? match[1] : null
  }

  /**
   * Fetch commander data from EDHREC API
   */
  private async fetchCommanderDataFromAPI(commanderSlug: string): Promise<string> {
    const response = await fetch(`${this.EDHREC_API_BASE}/${commanderSlug}.json`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch commander data from EDHREC API: ${response.status} ${response.statusText}`)
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
   * Parse EDHREC JSON format
   */
  private parseJSONFormat(data: any): EDHRECDeck {
    // Handle both direct EDHREC format and API response format
    if (data.container && data.container.json_dict) {
      data = data.container.json_dict
    }

    const commander = data.commander || data.cardlists?.[0]?.cardviews?.[0]?.name || 'Unknown Commander'
    const cards: EDHRECCard[] = []

    // Parse cards from different possible structures
    if (data.cards) {
      // Direct format
      cards.push(...data.cards.map((card: any) => ({
        name: card.name,
        quantity: card.quantity || 1,
        synergy: card.synergy,
        saltScore: card.salt_score,
        inclusion: card.inclusion
      })))
    } else if (data.cardlists) {
      // API format
      data.cardlists.forEach((cardlist: any) => {
        if (cardlist.cardviews) {
          cardlist.cardviews.forEach((card: any) => {
            if (card.name !== commander) { // Don't include commander in main deck
              cards.push({
                name: card.name,
                quantity: 1, // EDHREC typically shows singles
                synergy: card.synergy_score,
                saltScore: card.salt_score,
                inclusion: card.num_decks
              })
            }
          })
        }
      })
    }

    return {
      name: `${commander} Average Deck`,
      commander,
      cards,
      themes: data.themes || [],
      saltScore: data.salt_score
    }
  }

  /**
   * Parse EDHREC text format
   */
  private parseTextFormat(content: string): EDHRECDeck {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    let commander = 'Unknown Commander'
    let deckName = 'EDHREC Average Deck'
    const themes: string[] = []
    const cards: EDHRECCard[] = []
    
    for (const line of lines) {
      // Skip comments
      if (line.startsWith('//') || line.startsWith('#')) {
        continue
      }
      
      // Parse commander
      if (line.toLowerCase().startsWith('commander:') || line.toLowerCase().startsWith('general:')) {
        commander = line.split(':')[1].trim()
        deckName = `${commander} Average Deck`
        continue
      }
      
      // Parse themes
      if (line.toLowerCase().startsWith('themes:') || line.toLowerCase().startsWith('synergy:')) {
        const themeText = line.split(':')[1].trim()
        themes.push(...themeText.split(',').map(t => t.trim()))
        continue
      }
      
      // Parse card lines
      const cardMatch = line.match(/^(\d+)\s+(.+?)(?:\s+\((\d+)%\))?(?:\s+\[Salt:\s*(\d+(?:\.\d+)?)\])?$/)
      if (cardMatch) {
        const quantity = parseInt(cardMatch[1], 10)
        const cardName = this.normalizeCardName(cardMatch[2])
        const inclusion = cardMatch[3] ? parseInt(cardMatch[3], 10) : undefined
        const saltScore = cardMatch[4] ? parseFloat(cardMatch[4]) : undefined
        
        cards.push({
          name: cardName,
          quantity,
          inclusion,
          saltScore
        })
      }
    }
    
    return {
      name: deckName,
      commander,
      cards,
      themes
    }
  }

  /**
   * Convert EDHREC deck to standard format
   */
  private convertToStandardDeck(edhrecDeck: EDHRECDeck, options: Required<ParseOptions>): StandardDeck {
    const cards: StandardCard[] = edhrecDeck.cards.map(card => 
      this.convertEDHRECCard(card)
    )

    // Create commander card
    const commander: StandardCard = {
      name: edhrecDeck.commander,
      quantity: 1,
      metadata: {
        isCommander: true
      }
    }

    const metadata: DeckMetadata = {
      source: this.name,
      archetype: edhrecDeck.themes.join(', '),
      customFields: options.includeMetadata ? {
        themes: edhrecDeck.themes,
        saltScore: edhrecDeck.saltScore,
        isAverageDeck: true
      } : {}
    }

    return {
      name: edhrecDeck.name,
      description: `Average ${edhrecDeck.commander} deck based on EDHREC data`,
      format: 'commander',
      commander,
      cards,
      tags: edhrecDeck.themes,
      metadata
    }
  }

  /**
   * Convert EDHREC card to standard format
   */
  private convertEDHRECCard(edhrecCard: EDHRECCard): StandardCard {
    return {
      name: edhrecCard.name,
      quantity: edhrecCard.quantity,
      metadata: {
        synergy: edhrecCard.synergy,
        saltScore: edhrecCard.saltScore,
        inclusion: edhrecCard.inclusion,
        isEDHRECRecommendation: true
      }
    }
  }

  /**
   * Convert standard deck to EDHREC format
   */
  private convertFromStandardDeck(deck: StandardDeck, options: Required<ExportOptions>): EDHRECDeck {
    const cards: EDHRECCard[] = deck.cards.map(card => ({
      name: card.name,
      quantity: card.quantity,
      synergy: card.metadata?.synergy,
      saltScore: card.metadata?.saltScore,
      inclusion: card.metadata?.inclusion
    }))

    return {
      name: deck.name,
      commander: deck.commander?.name || 'Unknown Commander',
      cards,
      themes: deck.tags || [],
      saltScore: deck.metadata.customFields?.saltScore
    }
  }

  /**
   * Convert standard deck to EDHREC text format
   */
  private convertToTextFormat(deck: StandardDeck, options: Required<ExportOptions>): string {
    const lines: string[] = []
    
    // Add metadata
    lines.push(`// ${deck.name}`)
    if (deck.commander) {
      lines.push(`Commander: ${deck.commander.name}`)
    }
    
    if (deck.tags && deck.tags.length > 0) {
      lines.push(`Themes: ${deck.tags.join(', ')}`)
    }
    
    lines.push('')
    
    // Add cards
    deck.cards.forEach(card => {
      let line = `${card.quantity} ${card.name}`
      
      if (card.metadata?.inclusion) {
        line += ` (${card.metadata.inclusion}%)`
      }
      
      if (card.metadata?.saltScore) {
        line += ` [Salt: ${card.metadata.saltScore}]`
      }
      
      lines.push(line)
    })
    
    return lines.join('\n')
  }
}
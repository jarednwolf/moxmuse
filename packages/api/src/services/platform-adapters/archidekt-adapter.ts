/**
 * Archidekt Platform Adapter
 * 
 * Handles import/export for Archidekt deck format including API integration.
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
  ArchidektDeck,
  ArchidektCard,
  DeckCategory
} from '@repo/shared/platform-adapter-types'

export class ArchidektAdapter extends BasePlatformAdapter {
  readonly name = 'Archidekt'
  readonly id = 'archidekt'
  readonly version = '1.0.0'
  readonly supportedFormats = ['archidekt', 'json']
  readonly capabilities: AdapterCapabilities = {
    canImport: true,
    canExport: true,
    supportsMultipleDecks: false,
    supportsBulkOperations: true,
    supportsMetadata: true,
    supportsCategories: true,
    supportsCustomFields: true,
    requiresAuthentication: false
  }

  private readonly ARCHIDEKT_URL_REGEX = /https?:\/\/(?:www\.)?archidekt\.com\/decks\/(\d+)/
  private readonly ARCHIDEKT_API_BASE = 'https://archidekt.com/api/decks'

  /**
   * Check if input can be handled by this adapter
   */
  async canHandle(input: string | File): Promise<boolean> {
    if (input instanceof File) {
      return input.name.toLowerCase().endsWith('.json') || 
             input.name.toLowerCase().includes('archidekt')
    }

    const content = input.trim()
    
    // Check for Archidekt URL
    if (this.ARCHIDEKT_URL_REGEX.test(content)) {
      return true
    }

    // Check for Archidekt JSON format
    try {
      const parsed = JSON.parse(content)
      return this.isArchidektFormat(parsed)
    } catch {
      return false
    }
  }

  /**
   * Parse decks from Archidekt format
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

      // Handle Archidekt URL
      if (this.ARCHIDEKT_URL_REGEX.test(content)) {
        const deckId = this.extractDeckId(content)
        if (!deckId) {
          throw new Error('Invalid Archidekt URL format')
        }
        content = await this.fetchDeckFromAPI(deckId)
      }

      // Parse JSON content
      const archidektDeck: ArchidektDeck = JSON.parse(content)
      const standardDeck = this.convertToStandardDeck(archidektDeck, opts)

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
          `Failed to parse Archidekt deck: ${error instanceof Error ? error.message : 'Unknown error'}`
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
   * Export deck to Archidekt format
   */
  async exportDeck(deck: StandardDeck, format: string, options?: ExportOptions): Promise<ExportResult> {
    const opts = this.mergeExportOptions(options)
    const startTime = Date.now()

    try {
      const archidektDeck = this.convertFromStandardDeck(deck, opts)
      const jsonContent = JSON.stringify(archidektDeck, null, 2)

      return {
        success: true,
        data: jsonContent,
        filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}_archidekt.json`,
        mimeType: 'application/json',
        errors: [],
        metadata: {
          format: 'archidekt',
          processingTime: Date.now() - startTime,
          fileSize: Buffer.byteLength(jsonContent, 'utf8')
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
          message: `Failed to export to Archidekt format: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        metadata: {
          format: 'archidekt',
          processingTime: Date.now() - startTime,
          fileSize: 0
        }
      }
    }
  }

  /**
   * Check if JSON object is in Archidekt format
   */
  private isArchidektFormat(obj: any): boolean {
    return obj &&
           typeof obj.id === 'number' &&
           typeof obj.name === 'string' &&
           typeof obj.format === 'number' &&
           Array.isArray(obj.cards) &&
           Array.isArray(obj.categories) &&
           typeof obj.owner === 'number'
  }

  /**
   * Extract deck ID from Archidekt URL
   */
  private extractDeckId(url: string): string | null {
    const match = url.match(this.ARCHIDEKT_URL_REGEX)
    return match ? match[1] : null
  }

  /**
   * Fetch deck data from Archidekt API
   */
  private async fetchDeckFromAPI(deckId: string): Promise<string> {
    const response = await fetch(`${this.ARCHIDEKT_API_BASE}/${deckId}/`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch deck from Archidekt API: ${response.status} ${response.statusText}`)
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
   * Convert Archidekt deck to standard format
   */
  private convertToStandardDeck(archidektDeck: ArchidektDeck, options: Required<ParseOptions>): StandardDeck {
    const cards: StandardCard[] = []
    let commander: StandardCard | undefined

    // Process cards and identify commander
    archidektDeck.cards.forEach(archCard => {
      const standardCard = this.convertArchidektCard(archCard)
      
      // Check if this is a commander (usually in "Commander" category)
      if (archCard.categories.includes('Commander') || 
          archCard.categories.includes('commander')) {
        commander = standardCard
      } else {
        cards.push(standardCard)
      }
    })

    // Create categories if preserving them
    const categories: DeckCategory[] = options.preserveCategories ? 
      archidektDeck.categories
        .filter(cat => cat.includedInDeck)
        .map(cat => ({
          name: cat.name,
          cards: archidektDeck.cards
            .filter(card => card.categories.includes(cat.name))
            .map(card => card.card.name)
        })) : []

    const metadata: DeckMetadata = {
      source: this.name,
      sourceUrl: `https://www.archidekt.com/decks/${archidektDeck.id}`,
      author: archidektDeck.ownerName,
      createdAt: new Date(archidektDeck.createdAt),
      updatedAt: new Date(archidektDeck.updatedAt),
      customFields: options.includeMetadata ? {
        archidektId: archidektDeck.id,
        formatId: archidektDeck.format,
        ownerId: archidektDeck.owner
      } : {}
    }

    return {
      id: archidektDeck.id.toString(),
      name: archidektDeck.name,
      description: archidektDeck.description,
      format: this.convertFormatIdToName(archidektDeck.format),
      commander,
      cards,
      categories: categories.length > 0 ? categories : undefined,
      metadata
    }
  }

  /**
   * Convert Archidekt card to standard format
   */
  private convertArchidektCard(archCard: ArchidektCard): StandardCard {
    return {
      name: archCard.card.name,
      quantity: archCard.quantity,
      category: archCard.categories.length > 0 ? archCard.categories[0] : undefined,
      set: archCard.card.set,
      collectorNumber: archCard.card.collectorNumber,
      scryfallId: archCard.card.uid,
      metadata: {
        cmc: archCard.card.cmc,
        typeLine: archCard.card.typeLine,
        manaCost: archCard.card.manaCost,
        colors: archCard.card.colors,
        colorIdentity: archCard.card.colorIdentity,
        rarity: archCard.card.rarity,
        categories: archCard.categories,
        archidektId: archCard.id
      }
    }
  }

  /**
   * Convert standard deck to Archidekt format
   */
  private convertFromStandardDeck(deck: StandardDeck, options: Required<ExportOptions>): ArchidektDeck {
    const cards: ArchidektCard[] = []
    let cardId = 1

    // Add commander if present
    if (deck.commander) {
      cards.push(this.convertToArchidektCard(deck.commander, cardId++, ['Commander']))
    }

    // Add main deck cards
    deck.cards.forEach(card => {
      const categories = card.category ? [card.category] : ['Main']
      cards.push(this.convertToArchidektCard(card, cardId++, categories))
    })

    // Create categories
    const categoryNames = new Set<string>()
    cards.forEach(card => card.categories.forEach(cat => categoryNames.add(cat)))
    
    const categories = Array.from(categoryNames).map(name => ({
      name,
      includedInDeck: true,
      isPremier: name === 'Commander'
    }))

    return {
      id: parseInt(deck.id || '0'),
      name: deck.name,
      description: deck.description || '',
      format: this.convertFormatNameToId(deck.format),
      owner: 0,
      ownerName: deck.metadata.author || 'Unknown',
      createdAt: deck.metadata.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: deck.metadata.updatedAt?.toISOString() || new Date().toISOString(),
      cards,
      categories
    }
  }

  /**
   * Convert standard card to Archidekt format
   */
  private convertToArchidektCard(card: StandardCard, id: number, categories: string[]): ArchidektCard {
    return {
      id,
      quantity: card.quantity,
      card: {
        uid: card.scryfallId || '',
        name: card.name,
        cmc: card.metadata?.cmc || 0,
        typeLine: card.metadata?.typeLine || '',
        oracleText: card.metadata?.oracleText || '',
        manaCost: card.metadata?.manaCost || '',
        colors: card.metadata?.colors || [],
        colorIdentity: card.metadata?.colorIdentity || [],
        set: card.set || '',
        collectorNumber: card.collectorNumber || '',
        rarity: card.metadata?.rarity || 'common'
      },
      categories
    }
  }

  /**
   * Convert Archidekt format ID to format name
   */
  private convertFormatIdToName(formatId: number): string {
    const formatMap: Record<number, string> = {
      1: 'standard',
      2: 'modern',
      3: 'legacy',
      4: 'vintage',
      5: 'commander',
      6: 'pauper',
      7: 'frontier',
      8: 'penny',
      9: 'duel',
      10: 'oldschool',
      11: 'premodern',
      12: 'brawl',
      13: 'historic',
      14: 'pioneer',
      15: 'explorer',
      16: 'alchemy',
      17: 'timeless'
    }
    
    return formatMap[formatId] || 'unknown'
  }

  /**
   * Convert format name to Archidekt format ID
   */
  private convertFormatNameToId(formatName: string): number {
    const formatMap: Record<string, number> = {
      'standard': 1,
      'modern': 2,
      'legacy': 3,
      'vintage': 4,
      'commander': 5,
      'edh': 5,
      'pauper': 6,
      'frontier': 7,
      'penny': 8,
      'duel': 9,
      'oldschool': 10,
      'premodern': 11,
      'brawl': 12,
      'historic': 13,
      'pioneer': 14,
      'explorer': 15,
      'alchemy': 16,
      'timeless': 17
    }
    
    return formatMap[formatName.toLowerCase()] || 5 // Default to Commander
  }
}
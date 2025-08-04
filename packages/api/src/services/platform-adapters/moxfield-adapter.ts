/**
 * Moxfield Platform Adapter
 * 
 * Handles import/export for Moxfield deck format including API integration.
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
  MoxfieldDeck,
  MoxfieldCard
} from '@repo/shared/platform-adapter-types'

export class MoxfieldAdapter extends BasePlatformAdapter {
  readonly name = 'Moxfield'
  readonly id = 'moxfield'
  readonly version = '1.0.0'
  readonly supportedFormats = ['moxfield', 'json']
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

  private readonly MOXFIELD_URL_REGEX = /https?:\/\/(?:www\.)?moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/
  private readonly MOXFIELD_API_BASE = 'https://api2.moxfield.com/v3/decks'

  /**
   * Check if input can be handled by this adapter
   */
  async canHandle(input: string | File): Promise<boolean> {
    if (input instanceof File) {
      return input.name.toLowerCase().endsWith('.json') || 
             input.name.toLowerCase().includes('moxfield')
    }

    const content = input.trim()
    
    // Check for Moxfield URL
    if (this.MOXFIELD_URL_REGEX.test(content)) {
      return true
    }

    // Check for Moxfield JSON format
    try {
      const parsed = JSON.parse(content)
      return this.isMoxfieldFormat(parsed)
    } catch {
      return false
    }
  }

  /**
   * Parse decks from Moxfield format
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

      // Handle Moxfield URL
      if (this.MOXFIELD_URL_REGEX.test(content)) {
        const deckId = this.extractDeckId(content)
        if (!deckId) {
          throw new Error('Invalid Moxfield URL format')
        }
        content = await this.fetchDeckFromAPI(deckId)
      }

      // Parse JSON content
      const moxfieldDeck: MoxfieldDeck = JSON.parse(content)
      const standardDeck = this.convertToStandardDeck(moxfieldDeck, opts)

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
          `Failed to parse Moxfield deck: ${error instanceof Error ? error.message : 'Unknown error'}`
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
   * Export deck to Moxfield format
   */
  async exportDeck(deck: StandardDeck, format: string, options?: ExportOptions): Promise<ExportResult> {
    const opts = this.mergeExportOptions(options)
    const startTime = Date.now()

    try {
      const moxfieldDeck = this.convertFromStandardDeck(deck, opts)
      const jsonContent = JSON.stringify(moxfieldDeck, null, 2)

      return {
        success: true,
        data: jsonContent,
        filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}_moxfield.json`,
        mimeType: 'application/json',
        errors: [],
        metadata: {
          format: 'moxfield',
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
          message: `Failed to export to Moxfield format: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        metadata: {
          format: 'moxfield',
          processingTime: Date.now() - startTime,
          fileSize: 0
        }
      }
    }
  }

  /**
   * Check if JSON object is in Moxfield format
   */
  private isMoxfieldFormat(obj: any): boolean {
    return obj &&
           typeof obj.id === 'string' &&
           typeof obj.name === 'string' &&
           typeof obj.format === 'string' &&
           Array.isArray(obj.mainboard) &&
           Array.isArray(obj.commanders) &&
           obj.createdByUser &&
           typeof obj.createdByUser.userName === 'string'
  }

  /**
   * Extract deck ID from Moxfield URL
   */
  private extractDeckId(url: string): string | null {
    const match = url.match(this.MOXFIELD_URL_REGEX)
    return match ? match[1] : null
  }

  /**
   * Fetch deck data from Moxfield API
   */
  private async fetchDeckFromAPI(deckId: string): Promise<string> {
    const response = await fetch(`${this.MOXFIELD_API_BASE}/${deckId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch deck from Moxfield API: ${response.status} ${response.statusText}`)
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
   * Convert Moxfield deck to standard format
   */
  private convertToStandardDeck(moxfieldDeck: MoxfieldDeck, options: Required<ParseOptions>): StandardDeck {
    const cards: StandardCard[] = []
    
    // Add mainboard cards
    moxfieldDeck.mainboard.forEach(moxCard => {
      cards.push(this.convertMoxfieldCard(moxCard))
    })

    // Add commander
    let commander: StandardCard | undefined
    if (moxfieldDeck.commanders.length > 0) {
      commander = this.convertMoxfieldCard(moxfieldDeck.commanders[0])
    }

    // Add sideboard cards
    const sideboard: StandardCard[] = moxfieldDeck.sideboard.map(moxCard => 
      this.convertMoxfieldCard(moxCard)
    )

    // Add maybeboard cards
    const maybeboard: StandardCard[] = moxfieldDeck.maybeboard.map(moxCard => 
      this.convertMoxfieldCard(moxCard)
    )

    const metadata: DeckMetadata = {
      source: this.name,
      sourceUrl: `https://www.moxfield.com/decks/${moxfieldDeck.id}`,
      author: moxfieldDeck.createdByUser.displayName || moxfieldDeck.createdByUser.userName,
      createdAt: new Date(moxfieldDeck.createdAtUtc),
      updatedAt: new Date(moxfieldDeck.lastUpdatedAtUtc),
      colors: commander?.metadata?.colorIdentity as string[] || [],
      customFields: options.includeMetadata ? {
        moxfieldId: moxfieldDeck.id,
        visibility: moxfieldDeck.visibility,
        hubs: moxfieldDeck.hubs
      } : {}
    }

    return {
      id: moxfieldDeck.id,
      name: moxfieldDeck.name,
      description: moxfieldDeck.description,
      format: moxfieldDeck.format,
      commander,
      cards,
      sideboard: sideboard.length > 0 ? sideboard : undefined,
      maybeboard: maybeboard.length > 0 ? maybeboard : undefined,
      tags: moxfieldDeck.hubs,
      metadata
    }
  }

  /**
   * Convert Moxfield card to standard format
   */
  private convertMoxfieldCard(moxCard: MoxfieldCard): StandardCard {
    return {
      name: moxCard.card.name,
      quantity: moxCard.quantity,
      isFoil: moxCard.isFoil,
      set: moxCard.card.set,
      collectorNumber: moxCard.card.collector_number,
      scryfallId: moxCard.card.id,
      metadata: {
        cmc: moxCard.card.cmc,
        typeLine: moxCard.card.type_line,
        manaCost: moxCard.card.mana_cost,
        colors: moxCard.card.colors,
        colorIdentity: moxCard.card.color_identity,
        rarity: moxCard.card.rarity,
        legalities: moxCard.card.legalities,
        isAlter: moxCard.isAlter,
        isProxy: moxCard.isProxy,
        tags: moxCard.tags,
        prices: moxCard.card.prices,
        imageUris: moxCard.card.image_uris
      }
    }
  }

  /**
   * Convert standard deck to Moxfield format
   */
  private convertFromStandardDeck(deck: StandardDeck, options: Required<ExportOptions>): MoxfieldDeck {
    const mainboard: MoxfieldCard[] = deck.cards.map(card => 
      this.convertToMoxfieldCard(card)
    )

    const commanders: MoxfieldCard[] = deck.commander ? 
      [this.convertToMoxfieldCard(deck.commander)] : []

    const sideboard: MoxfieldCard[] = deck.sideboard ? 
      deck.sideboard.map(card => this.convertToMoxfieldCard(card)) : []

    const maybeboard: MoxfieldCard[] = deck.maybeboard ? 
      deck.maybeboard.map(card => this.convertToMoxfieldCard(card)) : []

    return {
      id: deck.id || this.generateDeckId(),
      name: deck.name,
      description: deck.description || '',
      format: deck.format,
      visibility: 'private',
      mainboard,
      sideboard,
      maybeboard,
      commanders,
      hubs: deck.tags || [],
      tokens: [],
      createdByUser: {
        id: 'export-user',
        userName: deck.metadata.author || 'Unknown',
        displayName: deck.metadata.author || 'Unknown'
      },
      createdAtUtc: deck.metadata.createdAt?.toISOString() || new Date().toISOString(),
      lastUpdatedAtUtc: deck.metadata.updatedAt?.toISOString() || new Date().toISOString()
    }
  }

  /**
   * Convert standard card to Moxfield format
   */
  private convertToMoxfieldCard(card: StandardCard): MoxfieldCard {
    return {
      quantity: card.quantity,
      card: {
        id: card.scryfallId || '',
        name: card.name,
        cmc: card.metadata?.cmc || 0,
        type_line: card.metadata?.typeLine || '',
        oracle_text: card.metadata?.oracleText || '',
        mana_cost: card.metadata?.manaCost || '',
        colors: card.metadata?.colors || [],
        color_identity: card.metadata?.colorIdentity || [],
        legalities: card.metadata?.legalities || {},
        set: card.set || '',
        set_name: card.metadata?.setName || '',
        collector_number: card.collectorNumber || '',
        rarity: card.metadata?.rarity || 'common',
        image_uris: card.metadata?.imageUris,
        prices: card.metadata?.prices
      },
      isFoil: card.isFoil || false,
      isAlter: card.metadata?.isAlter || false,
      isProxy: card.metadata?.isProxy || false,
      useCmcOverride: false,
      useManaCostOverride: false,
      useColorIdentityOverride: false,
      tags: card.metadata?.tags || []
    }
  }

  /**
   * Generate a unique deck ID
   */
  private generateDeckId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15)
  }
}
/**
 * Text Format Platform Adapter
 * 
 * Handles import/export for plain text deck formats with configurable parsing rules.
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
  TextFormatOptions
} from '@repo/shared/platform-adapter-types'

export class TextAdapter extends BasePlatformAdapter {
  readonly name = 'Text Format'
  readonly id = 'text'
  readonly version = '1.0.0'
  readonly supportedFormats = ['txt', 'text', 'dec']
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

  private readonly DEFAULT_OPTIONS: TextFormatOptions = {
    quantityFirst: true,
    separator: ' ',
    categoryMarkers: ['//', '#', '---', '==='],
    commentMarkers: ['///', '##', '/*'],
    ignoreEmptyLines: true,
    trimWhitespace: true
  }

  /**
   * Check if input can be handled by this adapter
   */
  async canHandle(input: string | File): Promise<boolean> {
    if (input instanceof File) {
      const extension = input.name.toLowerCase().split('.').pop()
      return ['txt', 'text', 'dec'].includes(extension || '')
    }

    const content = input.trim()
    
    // Check for text format patterns
    return this.isTextFormat(content)
  }

  /**
   * Parse decks from text format
   */
  async parseDecks(input: string | File, options?: ParseOptions): Promise<ParseResult> {
    const opts = this.mergeParseOptions(options)
    const startTime = Date.now()

    try {
      let content: string
      let filename = 'text_deck'
      
      if (input instanceof File) {
        filename = input.name.replace(/\.[^/.]+$/, '')
        content = await this.readFileContent(input)
      } else {
        content = input.trim()
      }

      // Detect format options
      const formatOptions = this.detectTextFormat(content)
      
      // Parse text content
      const standardDeck = this.parseTextContent(content, formatOptions, filename, opts)

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
          `Failed to parse text deck: ${error instanceof Error ? error.message : 'Unknown error'}`
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
   * Export deck to text format
   */
  async exportDeck(deck: StandardDeck, format: string, options?: ExportOptions): Promise<ExportResult> {
    const opts = this.mergeExportOptions(options)
    const startTime = Date.now()

    try {
      const textContent = this.convertToTextFormat(deck, this.DEFAULT_OPTIONS, opts)

      return {
        success: true,
        data: textContent,
        filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}.txt`,
        mimeType: 'text/plain',
        errors: [],
        metadata: {
          format: 'text',
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
          message: `Failed to export to text format: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        metadata: {
          format: 'text',
          processingTime: Date.now() - startTime,
          fileSize: 0
        }
      }
    }
  }

  /**
   * Check if content is in text format
   */
  private isTextFormat(content: string): boolean {
    const lines = content.split('\n').filter(line => line.trim().length > 0)
    
    if (lines.length < 3) return false
    
    // Look for card-like patterns
    const cardPatterns = [
      /^\d+x?\s+.+/,  // "4x Lightning Bolt" or "4 Lightning Bolt"
      /^.+\s+x?\d+$/,  // "Lightning Bolt x4" or "Lightning Bolt 4"
      /^\d+\s+.+/      // "4 Lightning Bolt"
    ]
    
    const cardLines = lines.filter(line => 
      cardPatterns.some(pattern => pattern.test(line.trim()))
    )
    
    // Should have at least 30% card lines for a deck
    return cardLines.length >= Math.min(10, lines.length * 0.3)
  }

  /**
   * Detect text format options from content
   */
  private detectTextFormat(content: string): TextFormatOptions {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    const options = { ...this.DEFAULT_OPTIONS }
    
    // Analyze first few card lines to detect format
    const cardLines = lines.filter(line => 
      /^\d+/.test(line) || /\d+$/.test(line)
    ).slice(0, 10)
    
    if (cardLines.length > 0) {
      // Check if quantity comes first or last
      const quantityFirst = cardLines.filter(line => /^\d+/.test(line)).length
      const quantityLast = cardLines.filter(line => /\d+$/.test(line)).length
      
      options.quantityFirst = quantityFirst >= quantityLast
      
      // Detect separator
      const firstCardLine = cardLines[0]
      if (firstCardLine.includes('\t')) {
        options.separator = '\t'
      } else if (firstCardLine.match(/^\d+x\s/)) {
        options.separator = 'x '
      } else {
        options.separator = ' '
      }
    }
    
    // Detect category markers
    const possibleMarkers = ['///', '//', '##', '#', '---', '===', '***', '***']
    const usedMarkers = possibleMarkers.filter(marker => 
      lines.some(line => line.startsWith(marker))
    )
    
    if (usedMarkers.length > 0) {
      options.categoryMarkers = usedMarkers
    }
    
    return options
  }

  /**
   * Parse text content into standard deck
   */
  private parseTextContent(
    content: string,
    formatOptions: TextFormatOptions,
    filename: string,
    options: Required<ParseOptions>
  ): StandardDeck {
    const lines = content.split('\n')
    
    let deckName = filename.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    let description = ''
    let format = 'commander'
    
    const cards: StandardCard[] = []
    let commander: StandardCard | undefined
    
    let currentCategory = 'Main'
    let inMetadata = true
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      
      if (formatOptions.trimWhitespace) {
        line = line.trim()
      }
      
      if (formatOptions.ignoreEmptyLines && !line) {
        continue
      }
      
      // Skip comment lines
      if (formatOptions.commentMarkers.some(marker => line.startsWith(marker))) {
        continue
      }
      
      // Check for category markers
      const categoryMarker = formatOptions.categoryMarkers.find(marker => 
        line.startsWith(marker)
      )
      
      if (categoryMarker) {
        currentCategory = line.substring(categoryMarker.length).trim() || 'Unnamed Category'
        inMetadata = false
        continue
      }
      
      // Parse metadata from early lines
      if (inMetadata && line.includes(':')) {
        const [key, ...valueParts] = line.split(':')
        const value = valueParts.join(':').trim()
        
        switch (key.toLowerCase().trim()) {
          case 'name':
          case 'deck name':
          case 'title':
            deckName = value
            break
          case 'description':
          case 'desc':
            description = value
            break
          case 'format':
            format = value.toLowerCase()
            break
          case 'commander':
          case 'general':
            commander = {
              name: this.normalizeCardName(value),
              quantity: 1,
              category: 'Commander'
            }
            break
        }
        continue
      }
      
      // Try to parse as card line
      const card = this.parseCardLine(line, formatOptions, currentCategory)
      if (card) {
        inMetadata = false
        
        // Check if this should be the commander
        if (currentCategory.toLowerCase().includes('commander') || 
            currentCategory.toLowerCase().includes('general')) {
          commander = card
        } else {
          cards.push(card)
        }
      }
    }
    
    const metadata: DeckMetadata = {
      source: this.name,
      customFields: options.includeMetadata ? {
        originalFilename: filename,
        textFormat: formatOptions
      } : {}
    }
    
    return {
      name: deckName,
      description: description || undefined,
      format,
      commander,
      cards,
      metadata
    }
  }

  /**
   * Parse a single card line
   */
  private parseCardLine(line: string, options: TextFormatOptions, category: string): StandardCard | null {
    if (!line.trim()) return null
    
    let quantity = 1
    let cardName = ''
    
    if (options.quantityFirst) {
      // Format: "4x Lightning Bolt" or "4 Lightning Bolt"
      const match = line.match(/^(\d+)x?\s+(.+)$/)
      if (match) {
        quantity = parseInt(match[1], 10)
        cardName = match[2].trim()
      } else {
        // No quantity specified, assume 1
        cardName = line.trim()
      }
    } else {
      // Format: "Lightning Bolt x4" or "Lightning Bolt 4"
      const match = line.match(/^(.+?)\s+x?(\d+)$/)
      if (match) {
        cardName = match[1].trim()
        quantity = parseInt(match[2], 10)
      } else {
        // No quantity specified, assume 1
        cardName = line.trim()
      }
    }
    
    if (!cardName) return null
    
    // Clean up card name
    cardName = this.normalizeCardName(cardName)
    
    // Check for additional metadata in the line
    let set: string | undefined
    let isFoil = false
    
    // Look for set codes in brackets
    const setMatch = cardName.match(/^(.+?)\s+\[([^\]]+)\]$/)
    if (setMatch) {
      cardName = setMatch[1].trim()
      set = setMatch[2].trim()
    }
    
    // Look for foil indicators
    if (cardName.includes('*FOIL*') || cardName.includes('(Foil)')) {
      isFoil = true
      cardName = cardName.replace(/\*FOIL\*|\(Foil\)/gi, '').trim()
    }
    
    return {
      name: cardName,
      quantity,
      category: category !== 'Main' ? category : undefined,
      set,
      isFoil,
      metadata: {
        originalLine: line
      }
    }
  }

  /**
   * Convert standard deck to text format
   */
  private convertToTextFormat(
    deck: StandardDeck,
    formatOptions: TextFormatOptions,
    options: Required<ExportOptions>
  ): string {
    const lines: string[] = []
    
    // Add metadata
    lines.push(`Name: ${deck.name}`)
    if (deck.description) {
      lines.push(`Description: ${deck.description}`)
    }
    lines.push(`Format: ${deck.format}`)
    lines.push('')
    
    // Add commander if present
    if (deck.commander) {
      lines.push('// Commander')
      lines.push(this.formatCardLine(deck.commander, formatOptions))
      lines.push('')
    }
    
    // Add main deck
    if (options.includeCategories && deck.categories) {
      // Group by categories
      for (const category of deck.categories) {
        lines.push(`// ${category.name}`)
        
        const categoryCards = deck.cards.filter(card => 
          category.cards.includes(card.name)
        )
        
        categoryCards.forEach(card => {
          lines.push(this.formatCardLine(card, formatOptions))
        })
        
        lines.push('')
      }
    } else {
      // Simple list
      lines.push('// Main Deck')
      deck.cards.forEach(card => {
        lines.push(this.formatCardLine(card, formatOptions))
      })
    }
    
    // Add sideboard if present
    if (deck.sideboard && deck.sideboard.length > 0) {
      lines.push('')
      lines.push('// Sideboard')
      deck.sideboard.forEach(card => {
        lines.push(this.formatCardLine(card, formatOptions))
      })
    }
    
    // Add maybeboard if present
    if (deck.maybeboard && deck.maybeboard.length > 0) {
      lines.push('')
      lines.push('// Maybeboard')
      deck.maybeboard.forEach(card => {
        lines.push(this.formatCardLine(card, formatOptions))
      })
    }
    
    return lines.join('\n')
  }

  /**
   * Format a card line for text export
   */
  private formatCardLine(card: StandardCard, options: TextFormatOptions): string {
    let line = ''
    
    if (options.quantityFirst) {
      line = `${card.quantity}${options.separator}${card.name}`
    } else {
      line = `${card.name}${options.separator}${card.quantity}`
    }
    
    // Add set if available
    if (card.set) {
      line += ` [${card.set}]`
    }
    
    // Add foil indicator
    if (card.isFoil) {
      line += ' *FOIL*'
    }
    
    return line
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
}
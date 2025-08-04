/**
 * CSV Platform Adapter
 * 
 * Handles import/export for CSV and Excel formats with configurable column mapping.
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
  CSVDeckFormat
} from '@repo/shared/platform-adapter-types'

export class CSVAdapter extends BasePlatformAdapter {
  readonly name = 'CSV'
  readonly id = 'csv'
  readonly version = '1.0.0'
  readonly supportedFormats = ['csv', 'tsv', 'xlsx']
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

  private readonly DEFAULT_FORMAT: CSVDeckFormat = {
    nameColumn: 'name',
    quantityColumn: 'quantity',
    setColumn: 'set',
    categoryColumn: 'category',
    priceColumn: 'price',
    foilColumn: 'foil',
    conditionColumn: 'condition',
    hasHeaders: true,
    delimiter: ','
  }

  /**
   * Check if input can be handled by this adapter
   */
  async canHandle(input: string | File): Promise<boolean> {
    if (input instanceof File) {
      const extension = input.name.toLowerCase().split('.').pop()
      return ['csv', 'tsv', 'xlsx', 'xls'].includes(extension || '')
    }

    const content = input.trim()
    
    // Check for CSV format patterns
    return this.isCSVFormat(content)
  }

  /**
   * Parse decks from CSV format
   */
  async parseDecks(input: string | File, options?: ParseOptions): Promise<ParseResult> {
    const opts = this.mergeParseOptions(options)
    const startTime = Date.now()

    try {
      let content: string
      let filename = 'imported_deck'
      
      if (input instanceof File) {
        filename = input.name.replace(/\.[^/.]+$/, '')
        content = await this.readFileContent(input)
      } else {
        content = input.trim()
      }

      // Detect format configuration
      const format = this.detectCSVFormat(content)
      
      // Parse CSV content
      const rows = this.parseCSVContent(content, format)
      const standardDeck = this.convertToStandardDeck(rows, format, filename, opts)

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
          `Failed to parse CSV deck: ${error instanceof Error ? error.message : 'Unknown error'}`
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
   * Export deck to CSV format
   */
  async exportDeck(deck: StandardDeck, format: string, options?: ExportOptions): Promise<ExportResult> {
    const opts = this.mergeExportOptions(options)
    const startTime = Date.now()

    try {
      const csvFormat = this.getExportFormat(format)
      const csvContent = this.convertToCSVFormat(deck, csvFormat, opts)
      
      const extension = format === 'tsv' ? 'tsv' : 'csv'
      const mimeType = format === 'tsv' ? 'text/tab-separated-values' : 'text/csv'

      return {
        success: true,
        data: csvContent,
        filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`,
        mimeType,
        errors: [],
        metadata: {
          format: 'csv',
          processingTime: Date.now() - startTime,
          fileSize: Buffer.byteLength(csvContent, 'utf8')
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
          message: `Failed to export to CSV format: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        metadata: {
          format: 'csv',
          processingTime: Date.now() - startTime,
          fileSize: 0
        }
      }
    }
  }

  /**
   * Check if content is in CSV format
   */
  private isCSVFormat(content: string): boolean {
    const lines = content.split('\n').filter(line => line.trim().length > 0)
    
    if (lines.length < 2) return false
    
    // Check for consistent delimiter usage
    const firstLine = lines[0]
    const delimiters = [',', '\t', ';', '|']
    
    for (const delimiter of delimiters) {
      if (firstLine.includes(delimiter)) {
        const columnCount = firstLine.split(delimiter).length
        
        // Check if other lines have similar column count
        const consistentColumns = lines.slice(1, Math.min(5, lines.length)).every(line => {
          const cols = line.split(delimiter).length
          return Math.abs(cols - columnCount) <= 1 // Allow for slight variation
        })
        
        if (consistentColumns && columnCount >= 2) {
          return true
        }
      }
    }
    
    return false
  }

  /**
   * Detect CSV format configuration from content
   */
  private detectCSVFormat(content: string): CSVDeckFormat {
    const lines = content.split('\n').filter(line => line.trim().length > 0)
    const firstLine = lines[0].toLowerCase()
    
    // Detect delimiter
    let delimiter = ','
    const delimiters = [',', '\t', ';', '|']
    let maxCount = 0
    
    for (const del of delimiters) {
      const count = firstLine.split(del).length
      if (count > maxCount) {
        maxCount = count
        delimiter = del
      }
    }
    
    // Parse headers
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/['"]/g, ''))
    
    // Map common column names
    const format: CSVDeckFormat = {
      ...this.DEFAULT_FORMAT,
      delimiter,
      hasHeaders: this.looksLikeHeaders(headers)
    }
    
    // Find column mappings
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase()
      
      if (normalizedHeader.includes('name') || normalizedHeader.includes('card')) {
        format.nameColumn = index.toString()
      } else if (normalizedHeader.includes('quantity') || normalizedHeader.includes('qty') || normalizedHeader.includes('count')) {
        format.quantityColumn = index.toString()
      } else if (normalizedHeader.includes('set') || normalizedHeader.includes('edition')) {
        format.setColumn = index.toString()
      } else if (normalizedHeader.includes('category') || normalizedHeader.includes('type') || normalizedHeader.includes('section')) {
        format.categoryColumn = index.toString()
      } else if (normalizedHeader.includes('price') || normalizedHeader.includes('cost') || normalizedHeader.includes('value')) {
        format.priceColumn = index.toString()
      } else if (normalizedHeader.includes('foil') || normalizedHeader.includes('premium')) {
        format.foilColumn = index.toString()
      } else if (normalizedHeader.includes('condition') || normalizedHeader.includes('quality')) {
        format.conditionColumn = index.toString()
      }
    })
    
    return format
  }

  /**
   * Check if first row looks like headers
   */
  private looksLikeHeaders(headers: string[]): boolean {
    const headerKeywords = ['name', 'card', 'quantity', 'qty', 'count', 'set', 'edition', 'category', 'type', 'price', 'cost', 'foil', 'condition']
    
    return headers.some(header => 
      headerKeywords.some(keyword => 
        header.toLowerCase().includes(keyword)
      )
    )
  }

  /**
   * Parse CSV content into rows
   */
  private parseCSVContent(content: string, format: CSVDeckFormat): Record<string, string>[] {
    const lines = content.split('\n').filter(line => line.trim().length > 0)
    const rows: Record<string, string>[] = []
    
    const startIndex = format.hasHeaders ? 1 : 0
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const columns = this.parseCSVLine(line, format.delimiter)
      const row: Record<string, string> = {}
      
      columns.forEach((value, index) => {
        row[index.toString()] = value.trim().replace(/^["']|["']$/g, '')
      })
      
      rows.push(row)
    }
    
    return rows
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    let quoteChar = ''
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true
        quoteChar = char
      } else if (inQuotes && char === quoteChar) {
        // Check for escaped quote
        if (i + 1 < line.length && line[i + 1] === quoteChar) {
          current += char
          i++ // Skip next quote
        } else {
          inQuotes = false
          quoteChar = ''
        }
      } else if (!inQuotes && char === delimiter) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current)
    return result
  }

  /**
   * Convert CSV rows to standard deck format
   */
  private convertToStandardDeck(
    rows: Record<string, string>[],
    format: CSVDeckFormat,
    filename: string,
    options: Required<ParseOptions>
  ): StandardDeck {
    const cards: StandardCard[] = []
    
    rows.forEach((row, index) => {
      try {
        const name = this.getColumnValue(row, format.nameColumn)
        const quantityStr = this.getColumnValue(row, format.quantityColumn) || '1'
        
        if (!name) {
          return // Skip rows without card names
        }
        
        const quantity = parseInt(quantityStr, 10) || 1
        const set = this.getColumnValue(row, format.setColumn)
        const category = this.getColumnValue(row, format.categoryColumn)
        const priceStr = this.getColumnValue(row, format.priceColumn)
        const foilStr = this.getColumnValue(row, format.foilColumn)
        const condition = this.getColumnValue(row, format.conditionColumn)
        
        const card: StandardCard = {
          name: this.normalizeCardName(name),
          quantity,
          set: set || undefined,
          category: category || undefined,
          isFoil: this.parseBoolean(foilStr),
          condition: condition || undefined,
          metadata: {
            price: priceStr ? parseFloat(priceStr) : undefined,
            csvRowIndex: index
          }
        }
        
        cards.push(card)
      } catch (error) {
        // Skip invalid rows
      }
    })
    
    const metadata: DeckMetadata = {
      source: this.name,
      customFields: options.includeMetadata ? {
        originalFilename: filename,
        csvFormat: format,
        totalRows: rows.length
      } : {}
    }
    
    return {
      name: filename.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      format: 'commander', // Default format
      cards,
      metadata
    }
  }

  /**
   * Get column value by name or index
   */
  private getColumnValue(row: Record<string, string>, column?: string): string | undefined {
    if (!column) return undefined
    
    // Try as direct column name first
    if (row[column]) {
      return row[column]
    }
    
    // Try as index
    const index = parseInt(column, 10)
    if (!isNaN(index) && row[index.toString()]) {
      return row[index.toString()]
    }
    
    return undefined
  }

  /**
   * Parse boolean value from string
   */
  private parseBoolean(value?: string): boolean {
    if (!value) return false
    
    const normalized = value.toLowerCase().trim()
    return ['true', '1', 'yes', 'y', 'foil', 'premium'].includes(normalized)
  }

  /**
   * Get export format configuration
   */
  private getExportFormat(format: string): CSVDeckFormat {
    const baseFormat = { ...this.DEFAULT_FORMAT }
    
    if (format === 'tsv') {
      baseFormat.delimiter = '\t'
    }
    
    return baseFormat
  }

  /**
   * Convert standard deck to CSV format
   */
  private convertToCSVFormat(deck: StandardDeck, format: CSVDeckFormat, options: Required<ExportOptions>): string {
    const lines: string[] = []
    
    // Add headers
    if (format.hasHeaders) {
      const headers = ['Name', 'Quantity']
      
      if (options.includeCategories) headers.push('Category')
      if (format.setColumn) headers.push('Set')
      if (options.includePrices) headers.push('Price')
      if (format.foilColumn) headers.push('Foil')
      if (format.conditionColumn) headers.push('Condition')
      
      lines.push(headers.join(format.delimiter))
    }
    
    // Add commander if present
    if (deck.commander) {
      lines.push(this.formatCSVRow(deck.commander, format, options, 'Commander'))
    }
    
    // Add main deck cards
    deck.cards.forEach(card => {
      lines.push(this.formatCSVRow(card, format, options))
    })
    
    // Add sideboard if present
    if (deck.sideboard && deck.sideboard.length > 0) {
      deck.sideboard.forEach(card => {
        lines.push(this.formatCSVRow(card, format, options, 'Sideboard'))
      })
    }
    
    return lines.join('\n')
  }

  /**
   * Format a card as CSV row
   */
  private formatCSVRow(
    card: StandardCard,
    format: CSVDeckFormat,
    options: Required<ExportOptions>,
    defaultCategory?: string
  ): string {
    const values: string[] = []
    
    // Name and quantity are always included
    values.push(this.escapeCSVValue(card.name, format.delimiter))
    values.push(card.quantity.toString())
    
    // Add optional columns
    if (options.includeCategories) {
      values.push(this.escapeCSVValue(card.category || defaultCategory || '', format.delimiter))
    }
    
    if (format.setColumn) {
      values.push(this.escapeCSVValue(card.set || '', format.delimiter))
    }
    
    if (options.includePrices) {
      values.push(card.metadata?.price?.toString() || '')
    }
    
    if (format.foilColumn) {
      values.push(card.isFoil ? 'true' : 'false')
    }
    
    if (format.conditionColumn) {
      values.push(this.escapeCSVValue(card.condition || '', format.delimiter))
    }
    
    return values.join(format.delimiter)
  }

  /**
   * Escape CSV value if it contains delimiter or quotes
   */
  private escapeCSVValue(value: string, delimiter: string): string {
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
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
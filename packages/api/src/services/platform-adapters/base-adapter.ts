/**
 * Base Platform Adapter
 * 
 * Abstract base class that provides common functionality for all platform adapters.
 */

import {
  PlatformAdapter,
  AdapterCapabilities,
  ParseOptions,
  ExportOptions,
  ParseResult,
  ExportResult,
  ValidationResult,
  StandardDeck,
  ParseError,
  ParseWarning,
  ValidationError
} from '@repo/shared/platform-adapter-types'

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly name: string
  abstract readonly id: string
  abstract readonly version: string
  abstract readonly supportedFormats: string[]
  abstract readonly capabilities: AdapterCapabilities

  // Abstract methods that must be implemented by subclasses
  abstract canHandle(input: string | File): Promise<boolean>
  abstract parseDecks(input: string | File, options?: ParseOptions): Promise<ParseResult>
  abstract exportDeck(deck: StandardDeck, format: string, options?: ExportOptions): Promise<ExportResult>

  /**
   * Default validation implementation
   * Subclasses can override for platform-specific validation
   */
  async validateInput(input: string | File): Promise<ValidationResult> {
    try {
      const canHandle = await this.canHandle(input)
      
      if (!canHandle) {
        return {
          isValid: false,
          format: null,
          confidence: 0,
          errors: [{
            type: 'format_error',
            message: `Input format not supported by ${this.name} adapter`
          }],
          suggestions: [`Try using a different adapter or check the input format`]
        }
      }

      // Basic validation passed
      return {
        isValid: true,
        format: this.id,
        confidence: 0.8,
        errors: [],
        suggestions: []
      }
    } catch (error) {
      return {
        isValid: false,
        format: null,
        confidence: 0,
        errors: [{
          type: 'validation_error',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        suggestions: ['Check input format and try again']
      }
    }
  }

  /**
   * Helper method to create standardized parse errors
   */
  protected createParseError(
    type: ParseError['type'],
    message: string,
    context?: string,
    line?: number,
    column?: number
  ): ParseError {
    return {
      type,
      message,
      context,
      line,
      column,
      severity: 'error'
    }
  }

  /**
   * Helper method to create standardized parse warnings
   */
  protected createParseWarning(
    type: ParseWarning['type'],
    message: string,
    suggestion?: string,
    context?: string
  ): ParseWarning {
    return {
      type,
      message,
      suggestion,
      context
    }
  }

  /**
   * Helper method to normalize card names
   */
  protected normalizeCardName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
  }

  /**
   * Helper method to parse quantity from text
   */
  protected parseQuantity(text: string): { quantity: number; cardName: string } {
    const match = text.match(/^(\d+)x?\s+(.+)$/) || text.match(/^(\d+)\s+(.+)$/)
    
    if (match) {
      return {
        quantity: parseInt(match[1], 10),
        cardName: this.normalizeCardName(match[2])
      }
    }

    // Default to quantity 1 if no quantity specified
    return {
      quantity: 1,
      cardName: this.normalizeCardName(text)
    }
  }

  /**
   * Helper method to detect file type from content or filename
   */
  protected detectFileType(input: string | File): string {
    if (input instanceof File) {
      const extension = input.name.split('.').pop()?.toLowerCase()
      if (extension) {
        return extension
      }
    }

    // Try to detect from content
    const content = typeof input === 'string' ? input : ''
    
    if (content.startsWith('{') || content.startsWith('[')) {
      return 'json'
    }
    
    if (content.includes('<?xml') || content.includes('<deck')) {
      return 'xml'
    }
    
    if (content.includes(',') && content.includes('\n')) {
      return 'csv'
    }
    
    return 'txt'
  }

  /**
   * Helper method to validate deck format
   */
  protected validateDeckFormat(deck: StandardDeck): ValidationError[] {
    const errors: ValidationError[] = []

    if (!deck.name || deck.name.trim().length === 0) {
      errors.push({
        type: 'data_error',
        message: 'Deck name is required'
      })
    }

    if (!deck.format || deck.format.trim().length === 0) {
      errors.push({
        type: 'data_error',
        message: 'Deck format is required'
      })
    }

    if (!deck.cards || deck.cards.length === 0) {
      errors.push({
        type: 'data_error',
        message: 'Deck must contain at least one card'
      })
    }

    // Validate cards
    deck.cards.forEach((card, index) => {
      if (!card.name || card.name.trim().length === 0) {
        errors.push({
          type: 'data_error',
          message: `Card at index ${index} is missing name`
        })
      }

      if (!card.quantity || card.quantity < 1) {
        errors.push({
          type: 'data_error',
          message: `Card "${card.name}" has invalid quantity: ${card.quantity}`
        })
      }
    })

    return errors
  }

  /**
   * Helper method to merge parse options with defaults
   */
  protected mergeParseOptions(options?: ParseOptions): Required<ParseOptions> {
    return {
      includeMetadata: true,
      validateCards: true,
      resolveCardNames: true,
      preserveCategories: true,
      customFields: [],
      timeout: 30000,
      ...options
    }
  }

  /**
   * Helper method to merge export options with defaults
   */
  protected mergeExportOptions(options?: ExportOptions): Required<ExportOptions> {
    return {
      format: this.supportedFormats[0] || 'txt',
      includeMetadata: true,
      includeCategories: true,
      includePrices: false,
      customTemplate: '',
      compression: false,
      ...options
    }
  }

  /**
   * Helper method to calculate processing time
   */
  protected measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
    const start = Date.now()
    return fn().then(result => ({
      result,
      time: Date.now() - start
    }))
  }

  /**
   * Helper method to handle timeouts
   */
  protected withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      )
    ])
  }
}
/**
 * Custom Format Builder
 * 
 * Allows users to create custom import/export formats with templates and validation rules.
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
  CustomFormatDefinition,
  CustomFormatVariable,
  ValidationRule
} from '@repo/shared/platform-adapter-types'

export class CustomFormatBuilder extends BasePlatformAdapter {
  readonly name = 'Custom Format'
  readonly id = 'custom'
  readonly version = '1.0.0'
  readonly supportedFormats = ['custom']
  readonly capabilities: AdapterCapabilities = {
    canImport: true,
    canExport: true,
    supportsMultipleDecks: false,
    supportsBulkOperations: false,
    supportsMetadata: true,
    supportsCategories: true,
    supportsCustomFields: true,
    requiresAuthentication: false
  }

  private formatDefinition: CustomFormatDefinition | null = null

  constructor(formatDefinition?: CustomFormatDefinition) {
    super()
    this.formatDefinition = formatDefinition || null
  }

  /**
   * Set the format definition for this adapter instance
   */
  setFormatDefinition(definition: CustomFormatDefinition): void {
    this.formatDefinition = definition
  }

  /**
   * Check if input can be handled by this adapter
   */
  async canHandle(input: string | File): Promise<boolean> {
    if (!this.formatDefinition) {
      return false
    }

    if (input instanceof File) {
      const extension = input.name.toLowerCase().split('.').pop()
      return extension === this.formatDefinition.fileExtension
    }

    // Use validation rules to check if content matches format
    return this.validateContent(input)
  }

  /**
   * Parse decks from custom format
   */
  async parseDecks(input: string | File, options?: ParseOptions): Promise<ParseResult> {
    if (!this.formatDefinition) {
      throw new Error('No format definition provided')
    }

    const opts = this.mergeParseOptions(options)
    const startTime = Date.now()

    try {
      let content: string
      let filename = 'custom_deck'
      
      if (input instanceof File) {
        filename = input.name.replace(/\.[^/.]+$/, '')
        content = await this.readFileContent(input)
      } else {
        content = input.trim()
      }

      // Validate content against format rules
      const validationResult = this.validateAgainstRules(content)
      if (!validationResult.isValid) {
        throw new Error(`Content validation failed: ${validationResult.errors.join(', ')}`)
      }

      // Parse using template
      const standardDeck = this.parseWithTemplate(content, filename, opts)

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
          `Failed to parse custom format: ${error instanceof Error ? error.message : 'Unknown error'}`
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
   * Export deck to custom format
   */
  async exportDeck(deck: StandardDeck, format: string, options?: ExportOptions): Promise<ExportResult> {
    if (!this.formatDefinition) {
      throw new Error('No format definition provided')
    }

    const opts = this.mergeExportOptions(options)
    const startTime = Date.now()

    try {
      const content = this.generateWithTemplate(deck, opts)

      return {
        success: true,
        data: content,
        filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}.${this.formatDefinition.fileExtension}`,
        mimeType: this.formatDefinition.mimeType,
        errors: [],
        metadata: {
          format: 'custom',
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
          message: `Failed to export to custom format: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        metadata: {
          format: 'custom',
          processingTime: Date.now() - startTime,
          fileSize: 0
        }
      }
    }
  }

  /**
   * Validate content against format definition
   */
  private validateContent(content: string): boolean {
    if (!this.formatDefinition) return false

    try {
      const result = this.validateAgainstRules(content)
      return result.isValid
    } catch {
      return false
    }
  }

  /**
   * Validate content against validation rules
   */
  private validateAgainstRules(content: string): { isValid: boolean; errors: string[] } {
    if (!this.formatDefinition) {
      return { isValid: false, errors: ['No format definition'] }
    }

    const errors: string[] = []

    for (const rule of this.formatDefinition.validation.rules) {
      const ruleResult = this.validateRule(content, rule)
      if (!ruleResult.isValid) {
        errors.push(ruleResult.error)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate a single rule
   */
  private validateRule(content: string, rule: ValidationRule): { isValid: boolean; error: string } {
    switch (rule.type) {
      case 'required':
        const requiredPattern = rule.parameters.pattern as string
        if (!content.includes(requiredPattern)) {
          return { isValid: false, error: rule.message }
        }
        break

      case 'format':
        const formatRegex = new RegExp(rule.parameters.regex as string)
        if (!formatRegex.test(content)) {
          return { isValid: false, error: rule.message }
        }
        break

      case 'range':
        const lines = content.split('\n').length
        const min = rule.parameters.min as number
        const max = rule.parameters.max as number
        if (lines < min || lines > max) {
          return { isValid: false, error: rule.message }
        }
        break

      case 'custom':
        // Custom validation would be implemented based on specific needs
        break
    }

    return { isValid: true, error: '' }
  }

  /**
   * Parse content using template
   */
  private parseWithTemplate(content: string, filename: string, options: Required<ParseOptions>): StandardDeck {
    if (!this.formatDefinition) {
      throw new Error('No format definition')
    }

    // This is a simplified template parser
    // In a real implementation, you might use a more sophisticated template engine
    const variables = this.extractVariables(content)
    
    const cards: StandardCard[] = []
    let commander: StandardCard | undefined
    
    // Parse cards based on template variables
    if (variables.cards) {
      const cardLines = variables.cards.split('\n').filter(line => line.trim())
      
      for (const line of cardLines) {
        const card = this.parseCardFromTemplate(line, variables)
        if (card) {
          if (card.category === 'Commander') {
            commander = card
          } else {
            cards.push(card)
          }
        }
      }
    }

    const metadata: DeckMetadata = {
      source: this.name,
      customFields: options.includeMetadata ? {
        formatDefinition: this.formatDefinition.id,
        templateVariables: variables
      } : {}
    }

    return {
      name: variables.name || filename,
      description: variables.description,
      format: variables.format || 'commander',
      commander,
      cards,
      metadata
    }
  }

  /**
   * Extract variables from content using template
   */
  private extractVariables(content: string): Record<string, any> {
    if (!this.formatDefinition) return {}

    const variables: Record<string, any> = {}
    
    // Apply default values
    for (const variable of this.formatDefinition.variables) {
      if (variable.defaultValue !== undefined) {
        variables[variable.name] = variable.defaultValue
      }
    }

    // Extract variables using simple pattern matching
    // This is a basic implementation - a real template engine would be more sophisticated
    const template = this.formatDefinition.template
    
    // Look for variable patterns like {{variableName}}
    const variablePattern = /\{\{(\w+)\}\}/g
    let match

    while ((match = variablePattern.exec(template)) !== null) {
      const variableName = match[1]
      const variable = this.formatDefinition.variables.find(v => v.name === variableName)
      
      if (variable) {
        // Extract value based on variable type and position in template
        const value = this.extractVariableValue(content, variableName, variable, template)
        if (value !== undefined) {
          variables[variableName] = value
        }
      }
    }

    return variables
  }

  /**
   * Extract a specific variable value from content
   */
  private extractVariableValue(
    content: string,
    variableName: string,
    variable: CustomFormatVariable,
    template: string
  ): any {
    // This is a simplified extraction - real implementation would be more robust
    const lines = content.split('\n')
    
    switch (variableName) {
      case 'name':
        // Look for name pattern
        const nameLine = lines.find(line => line.toLowerCase().includes('name:'))
        return nameLine ? nameLine.split(':')[1]?.trim() : undefined

      case 'description':
        const descLine = lines.find(line => line.toLowerCase().includes('description:'))
        return descLine ? descLine.split(':')[1]?.trim() : undefined

      case 'format':
        const formatLine = lines.find(line => line.toLowerCase().includes('format:'))
        return formatLine ? formatLine.split(':')[1]?.trim() : undefined

      case 'cards':
        // Extract card lines (lines that look like card entries)
        const cardLines = lines.filter(line => /^\d+\s+/.test(line.trim()))
        return cardLines.join('\n')

      default:
        return undefined
    }
  }

  /**
   * Parse a card from template line
   */
  private parseCardFromTemplate(line: string, variables: Record<string, any>): StandardCard | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    // Basic card parsing - could be enhanced based on template
    const match = trimmed.match(/^(\d+)\s+(.+)$/)
    if (!match) return null

    const quantity = parseInt(match[1], 10)
    const cardName = this.normalizeCardName(match[2])

    return {
      name: cardName,
      quantity,
      metadata: {
        templateParsed: true
      }
    }
  }

  /**
   * Generate content using template
   */
  private generateWithTemplate(deck: StandardDeck, options: Required<ExportOptions>): string {
    if (!this.formatDefinition) {
      throw new Error('No format definition')
    }

    let template = this.formatDefinition.template

    // Replace template variables
    const variables: Record<string, any> = {
      name: deck.name,
      description: deck.description || '',
      format: deck.format,
      cards: this.formatCardsForTemplate(deck.cards, options),
      commander: deck.commander ? this.formatCardForTemplate(deck.commander) : '',
      sideboard: deck.sideboard ? this.formatCardsForTemplate(deck.sideboard, options) : '',
      maybeboard: deck.maybeboard ? this.formatCardsForTemplate(deck.maybeboard, options) : ''
    }

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      template = template.replace(pattern, String(value))
    }

    return template
  }

  /**
   * Format cards for template
   */
  private formatCardsForTemplate(cards: StandardCard[], options: Required<ExportOptions>): string {
    return cards.map(card => this.formatCardForTemplate(card)).join('\n')
  }

  /**
   * Format a single card for template
   */
  private formatCardForTemplate(card: StandardCard): string {
    return `${card.quantity} ${card.name}`
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

/**
 * Custom Format Builder Factory
 * 
 * Creates custom format adapters from format definitions
 */
export class CustomFormatFactory {
  private static formats = new Map<string, CustomFormatDefinition>()

  /**
   * Register a custom format definition
   */
  static registerFormat(definition: CustomFormatDefinition): void {
    this.formats.set(definition.id, definition)
  }

  /**
   * Create an adapter for a specific format
   */
  static createAdapter(formatId: string): CustomFormatBuilder | null {
    const definition = this.formats.get(formatId)
    if (!definition) return null

    return new CustomFormatBuilder(definition)
  }

  /**
   * Get all registered formats
   */
  static getFormats(): CustomFormatDefinition[] {
    return Array.from(this.formats.values())
  }

  /**
   * Create a format definition builder
   */
  static createFormatBuilder(): CustomFormatDefinitionBuilder {
    return new CustomFormatDefinitionBuilder()
  }
}

/**
 * Builder for creating custom format definitions
 */
export class CustomFormatDefinitionBuilder {
  private definition: Partial<CustomFormatDefinition> = {
    variables: [],
    validation: { rules: [] }
  }

  setId(id: string): this {
    this.definition.id = id
    return this
  }

  setName(name: string): this {
    this.definition.name = name
    return this
  }

  setDescription(description: string): this {
    this.definition.description = description
    return this
  }

  setFileExtension(extension: string): this {
    this.definition.fileExtension = extension
    return this
  }

  setMimeType(mimeType: string): this {
    this.definition.mimeType = mimeType
    return this
  }

  setTemplate(template: string): this {
    this.definition.template = template
    return this
  }

  addVariable(variable: CustomFormatVariable): this {
    if (!this.definition.variables) {
      this.definition.variables = []
    }
    this.definition.variables.push(variable)
    return this
  }

  addValidationRule(rule: ValidationRule): this {
    if (!this.definition.validation) {
      this.definition.validation = { rules: [] }
    }
    this.definition.validation.rules.push(rule)
    return this
  }

  build(): CustomFormatDefinition {
    if (!this.definition.id || !this.definition.name || !this.definition.template) {
      throw new Error('Missing required fields: id, name, and template are required')
    }

    return this.definition as CustomFormatDefinition
  }
}
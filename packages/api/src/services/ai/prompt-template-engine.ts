import { z } from 'zod'
import { PromptTemplate, PromptVariable } from './prompt-registry'

// Template context types
export const TemplateContextSchema = z.object({
  user: z.object({
    id: z.string(),
    preferences: z.record(z.any()).optional(),
    history: z.array(z.any()).optional(),
    skillLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  }).optional(),
  deck: z.object({
    commander: z.string().optional(),
    strategy: z.string().optional(),
    powerLevel: z.number().optional(),
    cards: z.array(z.any()).optional(),
  }).optional(),
  collection: z.object({
    ownedCards: z.array(z.string()).optional(),
    budget: z.number().optional(),
    preferences: z.record(z.any()).optional(),
  }).optional(),
  meta: z.object({
    popularStrategies: z.array(z.string()).optional(),
    commonThreats: z.array(z.string()).optional(),
    trendingCards: z.array(z.string()).optional(),
  }).optional(),
  session: z.object({
    id: z.string(),
    previousQueries: z.array(z.string()).optional(),
    context: z.record(z.any()).optional(),
  }).optional(),
})

export type TemplateContext = z.infer<typeof TemplateContextSchema>

// Variable injection types
interface VariableInjectionResult {
  success: boolean
  injectedPrompt: string
  systemPrompt?: string
  errors: string[]
  warnings: string[]
  usedVariables: string[]
  contextEnhancements: string[]
}

interface ConditionalBlock {
  condition: string
  content: string
  elseContent?: string
}

interface LoopBlock {
  variable: string
  array: string
  content: string
}

/**
 * PromptTemplateEngine handles dynamic variable injection and context-aware prompting
 * Supports Handlebars-like syntax with conditional blocks and loops
 */
export class PromptTemplateEngine {
  private contextAdapters: Map<string, ContextAdapter> = new Map()
  private variableValidators: Map<string, VariableValidator> = new Map()

  constructor() {
    this.initializeContextAdapters()
    this.initializeVariableValidators()
  }

  /**
   * Inject variables into a prompt template with context awareness
   */
  injectVariables(
    template: PromptTemplate,
    variables: Record<string, any>,
    context?: TemplateContext
  ): VariableInjectionResult {
    const result: VariableInjectionResult = {
      success: false,
      injectedPrompt: '',
      systemPrompt: template.systemPrompt,
      errors: [],
      warnings: [],
      usedVariables: [],
      contextEnhancements: [],
    }

    try {
      // Validate required variables
      const validationResult = this.validateVariables(template.variables, variables)
      result.errors.push(...validationResult.errors)
      result.warnings.push(...validationResult.warnings)

      if (result.errors.length > 0) {
        return result
      }

      // Enhance variables with context
      const enhancedVariables = this.enhanceWithContext(variables, context, template)
      result.contextEnhancements = enhancedVariables.enhancements

      // Process template with enhanced variables
      const processedTemplate = this.processTemplate(
        template.template,
        enhancedVariables.variables
      )

      // Process system prompt if it exists
      let processedSystemPrompt = template.systemPrompt
      if (processedSystemPrompt) {
        processedSystemPrompt = this.processTemplate(
          processedSystemPrompt,
          enhancedVariables.variables
        )
      }

      result.injectedPrompt = processedTemplate
      result.systemPrompt = processedSystemPrompt
      result.usedVariables = Object.keys(enhancedVariables.variables)
      result.success = true

      console.log(`✅ Successfully injected variables into template ${template.id}`)
      console.log(`Used variables: ${result.usedVariables.join(', ')}`)
      console.log(`Context enhancements: ${result.contextEnhancements.join(', ')}`)

    } catch (error) {
      result.errors.push(`Template processing error: ${error}`)
      console.error('❌ Template injection failed:', error)
    }

    return result
  }

  /**
   * Build a context-aware prompt from scratch
   */
  buildContextAwarePrompt(
    basePrompt: string,
    context: TemplateContext,
    adaptations?: PromptAdaptation[]
  ): string {
    let adaptedPrompt = basePrompt

    // Apply context adaptations
    if (context.user) {
      adaptedPrompt = this.adaptForUser(adaptedPrompt, context.user)
    }

    if (context.deck) {
      adaptedPrompt = this.adaptForDeck(adaptedPrompt, context.deck)
    }

    if (context.collection) {
      adaptedPrompt = this.adaptForCollection(adaptedPrompt, context.collection)
    }

    if (context.meta) {
      adaptedPrompt = this.adaptForMeta(adaptedPrompt, context.meta)
    }

    // Apply custom adaptations
    if (adaptations) {
      for (const adaptation of adaptations) {
        adaptedPrompt = this.applyAdaptation(adaptedPrompt, adaptation)
      }
    }

    return adaptedPrompt
  }

  /**
   * Create a personalized prompt based on user history and preferences
   */
  personalizePrompt(
    template: PromptTemplate,
    variables: Record<string, any>,
    userHistory: UserHistory
  ): string {
    // Analyze user patterns
    const patterns = this.analyzeUserPatterns(userHistory)
    
    // Adapt template based on patterns
    const personalizedVariables = {
      ...variables,
      userPreferences: patterns.preferences,
      userStyle: patterns.communicationStyle,
      experienceLevel: patterns.experienceLevel,
      commonMistakes: patterns.commonMistakes,
      successfulStrategies: patterns.successfulStrategies,
    }

    // Inject personalized variables
    const result = this.injectVariables(template, personalizedVariables)
    
    if (!result.success) {
      console.warn('⚠️ Personalization failed, using base template')
      return template.template
    }

    return result.injectedPrompt
  }

  /**
   * Validate template variables
   */
  private validateVariables(
    templateVariables: PromptVariable[],
    providedVariables: Record<string, any>
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    for (const templateVar of templateVariables) {
      const value = providedVariables[templateVar.name]

      // Check required variables
      if (templateVar.required && (value === undefined || value === null)) {
        if (templateVar.defaultValue !== undefined) {
          providedVariables[templateVar.name] = templateVar.defaultValue
          warnings.push(`Using default value for ${templateVar.name}`)
        } else {
          errors.push(`Required variable '${templateVar.name}' is missing`)
        }
        continue
      }

      // Type validation
      if (value !== undefined && !this.validateVariableType(value, templateVar.type)) {
        errors.push(`Variable '${templateVar.name}' has incorrect type. Expected ${templateVar.type}`)
      }

      // Custom validation
      const validator = this.variableValidators.get(templateVar.name)
      if (validator && value !== undefined) {
        const validationResult = validator(value)
        if (!validationResult.valid) {
          errors.push(`Variable '${templateVar.name}' validation failed: ${validationResult.error}`)
        }
      }
    }

    return { errors, warnings }
  }

  /**
   * Enhance variables with context information
   */
  private enhanceWithContext(
    variables: Record<string, any>,
    context?: TemplateContext,
    template?: PromptTemplate
  ): { variables: Record<string, any>; enhancements: string[] } {
    const enhancedVariables = { ...variables }
    const enhancements: string[] = []

    if (!context) {
      return { variables: enhancedVariables, enhancements }
    }

    // User context enhancements
    if (context.user) {
      if (context.user.skillLevel && !enhancedVariables.skillLevel) {
        enhancedVariables.skillLevel = context.user.skillLevel
        enhancements.push('Added user skill level')
      }

      if (context.user.preferences) {
        enhancedVariables.userPreferences = context.user.preferences
        enhancements.push('Added user preferences')
      }
    }

    // Deck context enhancements
    if (context.deck) {
      if (context.deck.commander && !enhancedVariables.commander) {
        enhancedVariables.commander = context.deck.commander
        enhancements.push('Added commander from context')
      }

      if (context.deck.strategy && !enhancedVariables.strategy) {
        enhancedVariables.strategy = context.deck.strategy
        enhancements.push('Added strategy from context')
      }

      if (context.deck.powerLevel && !enhancedVariables.powerLevel) {
        enhancedVariables.powerLevel = context.deck.powerLevel
        enhancements.push('Added power level from context')
      }
    }

    // Collection context enhancements
    if (context.collection) {
      if (context.collection.budget && !enhancedVariables.budget) {
        enhancedVariables.budget = context.collection.budget
        enhancements.push('Added budget from collection')
      }

      if (context.collection.ownedCards) {
        enhancedVariables.ownedCards = context.collection.ownedCards
        enhancements.push('Added owned cards list')
      }
    }

    // Meta context enhancements
    if (context.meta) {
      enhancedVariables.metaContext = context.meta
      enhancements.push('Added meta context')
    }

    return { variables: enhancedVariables, enhancements }
  }

  /**
   * Process template with Handlebars-like syntax
   */
  private processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template

    // Process conditional blocks {{#if condition}}...{{/if}}
    processed = this.processConditionalBlocks(processed, variables)

    // Process loops {{#each array}}...{{/each}}
    processed = this.processLoopBlocks(processed, variables)

    // Process simple variable substitutions {{variable}}
    processed = this.processVariableSubstitutions(processed, variables)

    return processed
  }

  /**
   * Process conditional blocks
   */
  private processConditionalBlocks(template: string, variables: Record<string, any>): string {
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g
    
    return template.replace(conditionalRegex, (match, condition, content) => {
      const value = this.getNestedValue(variables, condition)
      
      // Check if condition is truthy
      if (this.isTruthy(value)) {
        return content.trim()
      }
      
      return ''
    })
  }

  /**
   * Process loop blocks
   */
  private processLoopBlocks(template: string, variables: Record<string, any>): string {
    const loopRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g
    
    return template.replace(loopRegex, (match, arrayName, content) => {
      const array = this.getNestedValue(variables, arrayName)
      
      if (!Array.isArray(array)) {
        return ''
      }
      
      return array.map((item, index) => {
        let itemContent = content
        
        // Replace {{this}} with current item
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item))
        
        // Replace {{@index}} with current index
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index))
        
        // If item is an object, replace {{property}} with item.property
        if (typeof item === 'object' && item !== null) {
          for (const [key, value] of Object.entries(item)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
            itemContent = itemContent.replace(regex, String(value))
          }
        }
        
        return itemContent
      }).join('\n')
    })
  }

  /**
   * Process simple variable substitutions
   */
  private processVariableSubstitutions(template: string, variables: Record<string, any>): string {
    const variableRegex = /\{\{(\w+(?:\.\w+)*)\}\}/g
    
    return template.replace(variableRegex, (match, variablePath) => {
      const value = this.getNestedValue(variables, variablePath)
      return value !== undefined ? String(value) : match
    })
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  /**
   * Check if value is truthy for conditional blocks
   */
  private isTruthy(value: any): boolean {
    if (value === undefined || value === null) return false
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') return value.length > 0
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object') return Object.keys(value).length > 0
    return Boolean(value)
  }

  /**
   * Validate variable type
   */
  private validateVariableType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number'
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      default:
        return true
    }
  }

  /**
   * Adapt prompt for user context
   */
  private adaptForUser(prompt: string, user: any): string {
    let adapted = prompt

    if (user.skillLevel === 'beginner') {
      adapted += '\n\nPlease provide explanations suitable for a beginner player.'
    } else if (user.skillLevel === 'advanced') {
      adapted += '\n\nProvide advanced analysis and assume familiarity with complex interactions.'
    }

    return adapted
  }

  /**
   * Adapt prompt for deck context
   */
  private adaptForDeck(prompt: string, deck: any): string {
    let adapted = prompt

    if (deck.powerLevel) {
      adapted += `\n\nConsider this is a power level ${deck.powerLevel} deck.`
    }

    return adapted
  }

  /**
   * Adapt prompt for collection context
   */
  private adaptForCollection(prompt: string, collection: any): string {
    let adapted = prompt

    if (collection.budget) {
      adapted += `\n\nBudget constraint: $${collection.budget}`
    }

    if (collection.ownedCards && collection.ownedCards.length > 0) {
      adapted += '\n\nPrioritize recommendations from the user\'s collection when possible.'
    }

    return adapted
  }

  /**
   * Adapt prompt for meta context
   */
  private adaptForMeta(prompt: string, meta: any): string {
    let adapted = prompt

    if (meta.popularStrategies && meta.popularStrategies.length > 0) {
      adapted += `\n\nCurrent popular strategies: ${meta.popularStrategies.join(', ')}`
    }

    if (meta.commonThreats && meta.commonThreats.length > 0) {
      adapted += `\n\nCommon meta threats to consider: ${meta.commonThreats.join(', ')}`
    }

    return adapted
  }

  /**
   * Apply custom adaptation
   */
  private applyAdaptation(prompt: string, adaptation: PromptAdaptation): string {
    switch (adaptation.type) {
      case 'append':
        return prompt + '\n\n' + adaptation.content
      case 'prepend':
        return adaptation.content + '\n\n' + prompt
      case 'replace':
        return prompt.replace(adaptation.target!, adaptation.content)
      default:
        return prompt
    }
  }

  /**
   * Analyze user patterns from history
   */
  private analyzeUserPatterns(history: UserHistory): UserPatterns {
    // This would analyze user interaction history to identify patterns
    // For now, return default patterns
    return {
      preferences: {},
      communicationStyle: 'balanced',
      experienceLevel: 'intermediate',
      commonMistakes: [],
      successfulStrategies: [],
    }
  }

  /**
   * Initialize context adapters
   */
  private initializeContextAdapters(): void {
    // Context adapters would be initialized here
    console.log('✅ Initialized context adapters')
  }

  /**
   * Initialize variable validators
   */
  private initializeVariableValidators(): void {
    // Power level validator
    this.variableValidators.set('powerLevel', (value: any) => {
      if (typeof value !== 'number' || value < 1 || value > 4) {
        return { valid: false, error: 'Power level must be between 1 and 4' }
      }
      return { valid: true }
    })

    // Budget validator
    this.variableValidators.set('budget', (value: any) => {
      if (typeof value !== 'number' || value < 0) {
        return { valid: false, error: 'Budget must be a positive number' }
      }
      return { valid: true }
    })

    // Colors validator
    this.variableValidators.set('colors', (value: any) => {
      if (!Array.isArray(value)) {
        return { valid: false, error: 'Colors must be an array' }
      }
      const validColors = ['W', 'U', 'B', 'R', 'G']
      const invalidColors = value.filter(color => !validColors.includes(color))
      if (invalidColors.length > 0) {
        return { valid: false, error: `Invalid colors: ${invalidColors.join(', ')}` }
      }
      return { valid: true }
    })

    console.log('✅ Initialized variable validators')
  }
}

// Supporting interfaces
interface ContextAdapter {
  adapt(context: any): Record<string, any>
}

interface VariableValidator {
  (value: any): { valid: boolean; error?: string }
}

interface PromptAdaptation {
  type: 'append' | 'prepend' | 'replace'
  content: string
  target?: string
}

interface UserHistory {
  interactions: any[]
  preferences: Record<string, any>
  feedback: any[]
}

interface UserPatterns {
  preferences: Record<string, any>
  communicationStyle: string
  experienceLevel: string
  commonMistakes: string[]
  successfulStrategies: string[]
}

// Export singleton instance
export const promptTemplateEngine = new PromptTemplateEngine()
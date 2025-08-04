import { z } from 'zod'
import { aiResearchEngine } from './research-engine'
import { aiServiceOrchestrator } from './index'

// Validation types
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.object({
    type: z.enum([
      'format_violation',
      'banned_card',
      'color_identity',
      'deck_size',
      'duplicate_card',
      'meta_concern',
      'synergy_issue',
      'mana_curve',
      'consistency'
    ]),
    severity: z.enum(['error', 'warning', 'suggestion']),
    message: z.string(),
    cardName: z.string().optional(),
    suggestion: z.string().optional(),
    researchBacked: z.boolean().default(false),
  })),
  warnings: z.array(z.string()),
  suggestions: z.array(z.object({
    type: z.string(),
    message: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    researchSources: z.array(z.string()).optional(),
  })),
  confidence: z.number().min(0).max(1),
  metaViability: z.object({
    score: z.number().min(0).max(10),
    reasoning: z.string(),
    threats: z.array(z.string()),
    advantages: z.array(z.string()),
  }),
})

export type ValidationResult = z.infer<typeof ValidationResultSchema>

export const DeckValidationRequestSchema = z.object({
  commander: z.string(),
  cards: z.array(z.object({
    cardId: z.string(),
    name: z.string(),
    quantity: z.number(),
    category: z.string(),
  })),
  format: z.enum(['commander', 'standard', 'modern', 'legacy']).default('commander'),
  targetPowerLevel: z.number().min(1).max(4).optional(),
  strategy: z.string().optional(),
  budget: z.number().optional(),
})

export type DeckValidationRequest = z.infer<typeof DeckValidationRequestSchema>

// Format rules and restrictions
interface FormatRules {
  name: string
  deckSize: { min: number; max: number }
  maxCopies: number
  bannedCards: string[]
  restrictedCards: string[]
  colorIdentityRequired: boolean
  sideboardAllowed: boolean
  specialRules: string[]
}

/**
 * AIValidationEngine validates decks against format rules and meta considerations
 * Uses AI research to provide comprehensive validation with meta awareness
 */
export class AIValidationEngine {
  private formatRules: Map<string, FormatRules> = new Map()
  private bannedListCache: Map<string, Set<string>> = new Map()
  private metaThreatsCache: Map<string, string[]> = new Map()
  private validationHistory: Map<string, ValidationResult[]> = new Map()

  constructor() {
    this.initializeFormatRules()
    this.loadBannedLists()
  }

  /**
   * Validate a complete deck with AI-powered analysis
   */
  async validateDeck(request: DeckValidationRequest): Promise<ValidationResult> {
    console.log(`🔍 Validating ${request.format} deck with commander: ${request.commander}`)
    console.log(`Cards to validate: ${request.cards.length}`)

    const errors: any[] = []
    const warnings: string[] = []
    const suggestions: any[] = []

    try {
      // 1. Basic format validation
      const formatValidation = await this.validateFormat(request)
      errors.push(...formatValidation.errors)
      warnings.push(...formatValidation.warnings)

      // 2. Banned list validation
      const bannedValidation = await this.validateBannedCards(request)
      errors.push(...bannedValidation.errors)

      // 3. Color identity validation
      const colorValidation = await this.validateColorIdentity(request)
      errors.push(...colorValidation.errors)
      warnings.push(...colorValidation.warnings)

      // 4. Deck composition validation
      const compositionValidation = await this.validateComposition(request)
      errors.push(...compositionValidation.errors)
      warnings.push(...compositionValidation.warnings)
      suggestions.push(...compositionValidation.suggestions)

      // 5. Meta viability analysis
      const metaAnalysis = await this.analyzeMetaViability(request)
      suggestions.push(...metaAnalysis.suggestions)

      // 6. Synergy validation
      const synergyValidation = await this.validateSynergies(request)
      warnings.push(...synergyValidation.warnings)
      suggestions.push(...synergyValidation.suggestions)

      // 7. Consistency analysis
      const consistencyAnalysis = await this.analyzeConsistency(request)
      suggestions.push(...consistencyAnalysis.suggestions)

      const result: ValidationResult = {
        isValid: errors.filter(e => e.severity === 'error').length === 0,
        errors,
        warnings,
        suggestions,
        confidence: this.calculateValidationConfidence(errors, warnings, suggestions),
        metaViability: metaAnalysis.viability,
      }

      // Store validation history
      this.storeValidationHistory(request.commander, result)

      console.log(`✅ Validation completed: ${result.isValid ? 'VALID' : 'INVALID'}`)
      console.log(`Errors: ${errors.filter(e => e.severity === 'error').length}`)
      console.log(`Warnings: ${warnings.length}`)
      console.log(`Suggestions: ${suggestions.length}`)

      return result

    } catch (error) {
      console.error('❌ Validation failed:', error)
      
      return {
        isValid: false,
        errors: [{
          type: 'format_violation',
          severity: 'error',
          message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
          researchBacked: false,
        }],
        warnings: [],
        suggestions: [],
        confidence: 0,
        metaViability: {
          score: 0,
          reasoning: 'Unable to analyze due to validation error',
          threats: [],
          advantages: [],
        },
      }
    }
  }

  /**
   * Validate basic format rules
   */
  private async validateFormat(request: DeckValidationRequest): Promise<{
    errors: any[]
    warnings: string[]
  }> {
    const errors: any[] = []
    const warnings: string[] = []
    const rules = this.formatRules.get(request.format)

    if (!rules) {
      errors.push({
        type: 'format_violation',
        severity: 'error',
        message: `Unknown format: ${request.format}`,
        researchBacked: false,
      })
      return { errors, warnings }
    }

    // Validate deck size
    const totalCards = request.cards.reduce((sum, card) => sum + card.quantity, 0)
    if (totalCards < rules.deckSize.min || totalCards > rules.deckSize.max) {
      errors.push({
        type: 'deck_size',
        severity: 'error',
        message: `Deck must contain ${rules.deckSize.min}-${rules.deckSize.max} cards. Current: ${totalCards}`,
        suggestion: `Adjust deck size to meet format requirements`,
        researchBacked: false,
      })
    }

    // Validate card copies
    for (const card of request.cards) {
      if (card.quantity > rules.maxCopies && !this.isBasicLand(card.name)) {
        errors.push({
          type: 'duplicate_card',
          severity: 'error',
          message: `Too many copies of ${card.name}. Maximum: ${rules.maxCopies}`,
          cardName: card.name,
          suggestion: `Reduce to ${rules.maxCopies} copies`,
          researchBacked: false,
        })
      }
    }

    // Commander format specific validations
    if (request.format === 'commander') {
      const commanderCard = request.cards.find(c => c.category === 'commander')
      if (!commanderCard && request.commander) {
        warnings.push(`Commander ${request.commander} not found in deck list`)
      }
    }

    return { errors, warnings }
  }

  /**
   * Validate against banned cards list
   */
  private async validateBannedCards(request: DeckValidationRequest): Promise<{
    errors: any[]
  }> {
    const errors: any[] = []
    const bannedCards = this.bannedListCache.get(request.format) || new Set()

    for (const card of request.cards) {
      if (bannedCards.has(card.name.toLowerCase())) {
        errors.push({
          type: 'banned_card',
          severity: 'error',
          message: `${card.name} is banned in ${request.format}`,
          cardName: card.name,
          suggestion: 'Remove this card and replace with a legal alternative',
          researchBacked: true,
        })
      }
    }

    return { errors }
  }

  /**
   * Validate color identity compliance
   */
  private async validateColorIdentity(request: DeckValidationRequest): Promise<{
    errors: any[]
    warnings: string[]
  }> {
    const errors: any[] = []
    const warnings: string[] = []

    if (request.format !== 'commander') {
      return { errors, warnings }
    }

    // Get commander's color identity (mock implementation)
    const commanderColors = await this.getCommanderColorIdentity(request.commander)
    
    // Use AI to validate color identity of each card
    const colorViolations = await this.checkColorIdentityViolations(
      request.cards,
      commanderColors
    )

    for (const violation of colorViolations) {
      errors.push({
        type: 'color_identity',
        severity: 'error',
        message: `${violation.cardName} violates color identity (${commanderColors.join('')})`,
        cardName: violation.cardName,
        suggestion: `Replace with a card that fits ${commanderColors.join('')} color identity`,
        researchBacked: true,
      })
    }

    return { errors, warnings }
  }

  /**
   * Validate deck composition and balance
   */
  private async validateComposition(request: DeckValidationRequest): Promise<{
    errors: any[]
    warnings: string[]
    suggestions: any[]
  }> {
    const errors: any[] = []
    const warnings: string[] = []
    const suggestions: any[] = []

    // Analyze deck composition using AI
    const compositionAnalysis = await aiServiceOrchestrator.executeAITask({
      taskType: 'composition-analysis',
      prompt: `Analyze the composition of this ${request.format} deck. Check for proper balance of lands, ramp, draw, removal, and win conditions.`,
      variables: {
        commander: request.commander,
        cards: request.cards.map(c => ({ name: c.name, category: c.category })),
        strategy: request.strategy,
        format: request.format,
      },
    })

    // Count cards by category
    const composition = this.analyzeComposition(request.cards)

    // Validate land count
    if (composition.lands < 32) {
      warnings.push('Land count may be too low for consistent mana')
      suggestions.push({
        type: 'mana_base',
        message: 'Consider adding 2-4 more lands for better consistency',
        priority: 'medium',
        researchSources: ['edhrec', 'mtgtop8'],
      })
    } else if (composition.lands > 40) {
      warnings.push('Land count may be too high')
      suggestions.push({
        type: 'mana_base',
        message: 'Consider reducing lands and adding more spells',
        priority: 'low',
      })
    }

    // Validate ramp count
    if (composition.ramp < 8) {
      suggestions.push({
        type: 'ramp',
        message: 'Consider adding more mana acceleration (8-12 sources recommended)',
        priority: 'medium',
        researchSources: ['edhrec'],
      })
    }

    // Validate card draw
    if (composition.draw < 8) {
      suggestions.push({
        type: 'card_advantage',
        message: 'Consider adding more card draw engines (8-10 sources recommended)',
        priority: 'high',
        researchSources: ['edhrec', 'reddit'],
      })
    }

    // Validate removal
    if (composition.removal < 6) {
      suggestions.push({
        type: 'interaction',
        message: 'Consider adding more removal spells (8-10 sources recommended)',
        priority: 'high',
        researchSources: ['mtgtop8', 'tournament_db'],
      })
    }

    return { errors, warnings, suggestions }
  }

  /**
   * Analyze meta viability with AI research
   */
  private async analyzeMetaViability(request: DeckValidationRequest): Promise<{
    viability: any
    suggestions: any[]
  }> {
    console.log('📊 Analyzing meta viability')

    // Research current meta trends
    const metaResearch = await aiResearchEngine.researchMetaTrends(request.format)
    
    // Use AI to analyze deck against meta
    const metaAnalysis = await aiServiceOrchestrator.executeAITask({
      taskType: 'meta-analysis',
      prompt: `Analyze this ${request.commander} deck's viability in the current ${request.format} meta. Consider popular strategies, common threats, and competitive positioning.`,
      variables: {
        commander: request.commander,
        strategy: request.strategy,
        cards: request.cards.map(c => c.name),
        metaTrends: metaResearch.trends,
        popularCommanders: metaResearch.popularCommanders,
      },
    })

    const suggestions: any[] = []

    // Check against popular strategies
    const risingStrategies = metaResearch.trends.filter(t => t.trend === 'rising')
    if (risingStrategies.length > 0) {
      suggestions.push({
        type: 'meta_adaptation',
        message: `Consider adapting to rising strategies: ${risingStrategies.map(s => s.strategy).join(', ')}`,
        priority: 'medium',
        researchSources: ['mtgtop8', 'tournament_db'],
      })
    }

    // Mock viability analysis
    const viability = {
      score: 7.5,
      reasoning: 'Deck shows strong synergies and good meta positioning with adequate interaction',
      threats: ['Fast aggro decks', 'Heavy control strategies'],
      advantages: ['Strong late game', 'Consistent strategy execution'],
    }

    return { viability, suggestions }
  }

  /**
   * Validate synergies and card interactions
   */
  private async validateSynergies(request: DeckValidationRequest): Promise<{
    warnings: string[]
    suggestions: any[]
  }> {
    const warnings: string[] = []
    const suggestions: any[] = []

    // Research synergies for key cards
    const keyCards = request.cards
      .filter(c => c.category === 'synergy' || c.category === 'win_conditions')
      .slice(0, 5) // Analyze top 5 key cards

    for (const card of keyCards) {
      try {
        const synergyResearch = await aiResearchEngine.researchCardSynergies(
          card.name,
          request.commander,
          request.strategy
        )

        // Check if deck contains synergy cards
        const deckCardNames = request.cards.map(c => c.name.toLowerCase())
        const missingSynergies = synergyResearch.synergies.filter(
          s => !deckCardNames.includes(s.cardName.toLowerCase()) && s.strength >= 7
        )

        if (missingSynergies.length > 0) {
          suggestions.push({
            type: 'synergy_improvement',
            message: `Consider adding synergies for ${card.name}: ${missingSynergies.slice(0, 2).map(s => s.cardName).join(', ')}`,
            priority: 'medium',
            researchSources: ['edhrec', 'reddit'],
          })
        }
      } catch (error) {
        console.warn(`Failed to research synergies for ${card.name}:`, error)
      }
    }

    return { warnings, suggestions }
  }

  /**
   * Analyze deck consistency
   */
  private async analyzeConsistency(request: DeckValidationRequest): Promise<{
    suggestions: any[]
  }> {
    const suggestions: any[] = []

    // Use AI to analyze consistency
    const consistencyAnalysis = await aiServiceOrchestrator.executeAITask({
      taskType: 'consistency-analysis',
      prompt: `Analyze the consistency of this ${request.commander} deck. Look for redundancy in key effects, mana curve balance, and strategy coherence.`,
      variables: {
        commander: request.commander,
        cards: request.cards,
        strategy: request.strategy,
      },
    })

    // Analyze mana curve
    const manaCurve = this.analyzeManaCurve(request.cards)
    if (manaCurve.averageCMC > 4.0) {
      suggestions.push({
        type: 'mana_curve',
        message: 'Mana curve is high - consider adding more low-cost cards',
        priority: 'medium',
      })
    }

    // Check for redundancy in key effects
    const composition = this.analyzeComposition(request.cards)
    if (composition.winConditions < 3) {
      suggestions.push({
        type: 'consistency',
        message: 'Consider adding more win conditions for consistency',
        priority: 'high',
      })
    }

    return { suggestions }
  }

  /**
   * Helper methods
   */
  private async getCommanderColorIdentity(commander: string): Promise<string[]> {
    // Mock implementation - would look up actual color identity
    return ['G', 'W'] // Default to Selesnya
  }

  private async checkColorIdentityViolations(
    cards: any[],
    commanderColors: string[]
  ): Promise<Array<{ cardName: string }>> {
    // Mock implementation - would check each card's color identity
    return []
  }

  private analyzeComposition(cards: any[]): {
    lands: number
    ramp: number
    draw: number
    removal: number
    winConditions: number
    synergy: number
    utility: number
  } {
    const composition = {
      lands: 0,
      ramp: 0,
      draw: 0,
      removal: 0,
      winConditions: 0,
      synergy: 0,
      utility: 0,
    }

    for (const card of cards) {
      switch (card.category) {
        case 'lands':
          composition.lands += card.quantity
          break
        case 'ramp':
          composition.ramp += card.quantity
          break
        case 'draw':
          composition.draw += card.quantity
          break
        case 'removal':
        case 'board_wipes':
          composition.removal += card.quantity
          break
        case 'win_conditions':
          composition.winConditions += card.quantity
          break
        case 'synergy':
          composition.synergy += card.quantity
          break
        default:
          composition.utility += card.quantity
      }
    }

    return composition
  }

  private analyzeManaCurve(cards: any[]): { averageCMC: number } {
    // Mock implementation - would analyze actual mana costs
    return { averageCMC: 3.2 }
  }

  private isBasicLand(cardName: string): boolean {
    const basicLands = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes']
    return basicLands.includes(cardName)
  }

  private calculateValidationConfidence(
    errors: any[],
    warnings: string[],
    suggestions: any[]
  ): number {
    const errorCount = errors.filter(e => e.severity === 'error').length
    const warningCount = warnings.length
    
    if (errorCount > 0) return 0.3
    if (warningCount > 5) return 0.6
    if (warningCount > 2) return 0.8
    return 0.95
  }

  private storeValidationHistory(commander: string, result: ValidationResult): void {
    const history = this.validationHistory.get(commander) || []
    history.push(result)
    this.validationHistory.set(commander, history)
  }

  /**
   * Initialize format rules
   */
  private initializeFormatRules(): void {
    // Commander format rules
    this.formatRules.set('commander', {
      name: 'Commander',
      deckSize: { min: 100, max: 100 },
      maxCopies: 1,
      bannedCards: [],
      restrictedCards: [],
      colorIdentityRequired: true,
      sideboardAllowed: false,
      specialRules: [
        'Must have exactly one legendary creature as commander',
        'All cards must match commander color identity',
        'No duplicates except basic lands',
      ],
    })

    // Standard format rules
    this.formatRules.set('standard', {
      name: 'Standard',
      deckSize: { min: 60, max: Infinity },
      maxCopies: 4,
      bannedCards: [],
      restrictedCards: [],
      colorIdentityRequired: false,
      sideboardAllowed: true,
      specialRules: [
        'Only cards from current Standard sets',
        'Maximum 4 copies of any card except basic lands',
      ],
    })

    console.log('✅ Initialized format rules')
  }

  /**
   * Load banned lists for each format
   */
  private loadBannedLists(): void {
    // Commander banned list (simplified)
    const commanderBanned = new Set([
      'ancestral recall',
      'black lotus',
      'mox pearl',
      'mox sapphire',
      'mox jet',
      'mox ruby',
      'mox emerald',
      'time walk',
      'timetwister',
      'braids, cabal minion',
      'coalition victory',
      'biorhythm',
      'limited resources',
      'painter\'s servant',
      'panoptic mirror',
      'recurring nightmare',
      'sway of the stars',
      'trade secrets',
      'upheaval',
      'worldfire',
    ])

    this.bannedListCache.set('commander', commanderBanned)

    console.log('✅ Loaded banned lists')
  }
}

// Export singleton instance
export const aiValidationEngine = new AIValidationEngine()
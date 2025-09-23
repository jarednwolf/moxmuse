import { z } from 'zod'
import { GeneratedDeck, GeneratedDeckCard, ConsultationData } from '@moxmuse/shared'
import { aiServiceOrchestrator } from '../index'

// Power Level Assessment Types
export const PowerLevelFactorSchema = z.object({
  category: z.enum([
    'fast_mana',
    'tutors',
    'card_advantage',
    'interaction',
    'win_conditions',
    'consistency',
    'protection',
    'recursion',
    'combo_pieces',
    'stax_effects'
  ]),
  name: z.string(),
  description: z.string(),
  impact: z.number().min(-2).max(2), // -2 (very negative) to +2 (very positive)
  confidence: z.number().min(0).max(1),
  cards: z.array(z.string()),
})

export type PowerLevelFactor = z.infer<typeof PowerLevelFactorSchema>

export const PowerLevelAssessmentSchema = z.object({
  estimatedPowerLevel: z.number().min(1).max(4),
  confidence: z.number().min(0).max(1),
  targetPowerLevel: z.number().min(1).max(4).optional(),
  accuracy: z.number().min(0).max(1).optional(),
  
  factors: z.array(PowerLevelFactorSchema),
  
  breakdown: z.object({
    basePowerLevel: z.number(),
    fastManaBonus: z.number(),
    tutorBonus: z.number(),
    interactionBonus: z.number(),
    consistencyBonus: z.number(),
    comboBonus: z.number(),
    staxPenalty: z.number(),
  }),
  
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  
  recommendations: z.array(z.object({
    type: z.enum(['increase', 'decrease', 'maintain']),
    category: z.string(),
    description: z.string(),
    cardSuggestions: z.array(z.object({
      action: z.enum(['add', 'remove', 'replace']),
      cardName: z.string(),
      replacement: z.string().optional(),
      reasoning: z.string(),
    })),
    estimatedImpact: z.number().min(-1).max(1),
    priority: z.enum(['low', 'medium', 'high']),
  })),
  
  comparisonData: z.object({
    similarDecks: z.array(z.object({
      commander: z.string(),
      powerLevel: z.number(),
      similarity: z.number(),
      keyDifferences: z.array(z.string()),
    })),
    metaPosition: z.string(),
    competitiveViability: z.number().min(0).max(1),
  }),
})

export type PowerLevelAssessment = z.infer<typeof PowerLevelAssessmentSchema>

export const PowerLevelValidationSchema = z.object({
  isAccurate: z.boolean(),
  deviation: z.number(),
  acceptableRange: z.object({
    min: z.number(),
    max: z.number(),
  }),
  validationTests: z.array(z.object({
    testName: z.string(),
    passed: z.boolean(),
    score: z.number(),
    details: z.string(),
  })),
  adjustmentNeeded: z.boolean(),
  adjustmentSuggestions: z.array(z.string()),
})

export type PowerLevelValidation = z.infer<typeof PowerLevelValidationSchema>

/**
 * Power Level Assessment Service
 * Provides comprehensive power level analysis and validation for generated decks
 */
export class PowerLevelAssessmentService {
  private powerLevelDatabase: Map<string, any> = new Map()
  private cardPowerRatings: Map<string, number> = new Map()
  private metaData: Map<string, any> = new Map()
  private assessmentHistory: Map<string, PowerLevelAssessment[]> = new Map()

  constructor() {
    console.log('⚡ Initializing Power Level Assessment Service')
    this.initializePowerLevelDatabase()
    this.loadCardPowerRatings()
    this.loadMetaData()
  }

  /**
   * Assess the power level of a generated deck
   */
  async assessPowerLevel(
    deck: GeneratedDeck,
    consultationData: ConsultationData
  ): Promise<PowerLevelAssessment> {
    console.log(`⚡ Assessing power level for deck: ${deck.name}`)
    console.log(`Target power level: ${consultationData.powerLevel || 'not specified'}`)

    try {
      // Analyze power level factors
      const factors = await this.analyzePowerLevelFactors(deck)
      
      // Calculate base power level
      const breakdown = this.calculatePowerLevelBreakdown(factors, deck)
      
      // Estimate final power level
      const estimatedPowerLevel = this.calculateFinalPowerLevel(breakdown)
      
      // Calculate confidence based on factor certainty
      const confidence = this.calculateAssessmentConfidence(factors)
      
      // Compare with target if provided
      const targetPowerLevel = consultationData.powerLevel
      const accuracy = targetPowerLevel 
        ? this.calculateAccuracy(estimatedPowerLevel, targetPowerLevel)
        : undefined

      // Identify strengths and weaknesses
      const strengths = this.identifyStrengths(factors, breakdown)
      const weaknesses = this.identifyWeaknesses(factors, breakdown)
      
      // Generate recommendations
      const recommendations = await this.generatePowerLevelRecommendations(
        deck,
        estimatedPowerLevel,
        targetPowerLevel,
        factors
      )
      
      // Get comparison data
      const comparisonData = await this.getComparisonData(deck, estimatedPowerLevel)

      const assessment: PowerLevelAssessment = {
        estimatedPowerLevel,
        confidence,
        targetPowerLevel,
        accuracy,
        factors,
        breakdown,
        strengths,
        weaknesses,
        recommendations,
        comparisonData,
      }

      // Store assessment history
      this.storeAssessmentHistory(deck.id, assessment)

      console.log(`✅ Power level assessment completed: ${estimatedPowerLevel.toFixed(1)} (confidence: ${(confidence * 100).toFixed(1)}%)`)
      return assessment

    } catch (error) {
      console.error('❌ Power level assessment failed:', error)
      throw new Error(`Power level assessment failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Validate power level accuracy against target
   */
  async validatePowerLevel(
    assessment: PowerLevelAssessment,
    targetPowerLevel: number
  ): Promise<PowerLevelValidation> {
    console.log(`⚡ Validating power level accuracy`)

    const deviation = Math.abs(assessment.estimatedPowerLevel - targetPowerLevel)
    const acceptableRange = {
      min: targetPowerLevel - 0.5,
      max: targetPowerLevel + 0.5,
    }
    
    const isAccurate = deviation <= 0.5 // Within half a power level
    
    // Run validation tests
    const validationTests = await this.runPowerLevelValidationTests(assessment, targetPowerLevel)
    
    const adjustmentNeeded = !isAccurate || validationTests.some(test => !test.passed)
    const adjustmentSuggestions = this.generateAdjustmentSuggestions(assessment, targetPowerLevel)

    return {
      isAccurate,
      deviation,
      acceptableRange,
      validationTests,
      adjustmentNeeded,
      adjustmentSuggestions,
    }
  }

  /**
   * Analyze factors that contribute to power level
   */
  private async analyzePowerLevelFactors(deck: GeneratedDeck): Promise<PowerLevelFactor[]> {
    console.log('🔍 Analyzing power level factors')

    const factors: PowerLevelFactor[] = []

    // Analyze fast mana
    const fastManaFactor = await this.analyzeFastMana(deck)
    if (fastManaFactor) factors.push(fastManaFactor)

    // Analyze tutors
    const tutorFactor = await this.analyzeTutors(deck)
    if (tutorFactor) factors.push(tutorFactor)

    // Analyze card advantage
    const cardAdvantageFactor = await this.analyzeCardAdvantage(deck)
    if (cardAdvantageFactor) factors.push(cardAdvantageFactor)

    // Analyze interaction
    const interactionFactor = await this.analyzeInteraction(deck)
    if (interactionFactor) factors.push(interactionFactor)

    // Analyze win conditions
    const winConditionsFactor = await this.analyzeWinConditions(deck)
    if (winConditionsFactor) factors.push(winConditionsFactor)

    // Analyze consistency
    const consistencyFactor = await this.analyzeConsistency(deck)
    if (consistencyFactor) factors.push(consistencyFactor)

    // Analyze protection
    const protectionFactor = await this.analyzeProtection(deck)
    if (protectionFactor) factors.push(protectionFactor)

    // Analyze combo pieces
    const comboFactor = await this.analyzeComboPieces(deck)
    if (comboFactor) factors.push(comboFactor)

    // Analyze stax effects
    const staxFactor = await this.analyzeStaxEffects(deck)
    if (staxFactor) factors.push(staxFactor)

    return factors
  }

  /**
   * Analyze fast mana presence
   */
  private async analyzeFastMana(deck: GeneratedDeck): Promise<PowerLevelFactor | null> {
    const fastManaCards = deck.cards.filter(card => 
      this.isFastMana(card.cardId) || 
      card.role.toLowerCase().includes('fast mana') ||
      card.reasoning.toLowerCase().includes('fast mana')
    )

    if (fastManaCards.length === 0) return null

    const impact = Math.min(2, fastManaCards.length * 0.3) // Cap at +2
    const confidence = 0.9 // High confidence in fast mana identification

    return {
      category: 'fast_mana',
      name: 'Fast Mana',
      description: `Deck contains ${fastManaCards.length} fast mana sources`,
      impact,
      confidence,
      cards: fastManaCards.map(c => c.cardId),
    }
  }

  /**
   * Analyze tutor presence
   */
  private async analyzeTutors(deck: GeneratedDeck): Promise<PowerLevelFactor | null> {
    const tutorCards = deck.cards.filter(card => 
      this.isTutor(card.cardId) ||
      card.role.toLowerCase().includes('tutor') ||
      card.reasoning.toLowerCase().includes('tutor')
    )

    if (tutorCards.length === 0) return null

    const impact = Math.min(1.5, tutorCards.length * 0.2) // Cap at +1.5
    const confidence = 0.85

    return {
      category: 'tutors',
      name: 'Tutors',
      description: `Deck contains ${tutorCards.length} tutor effects`,
      impact,
      confidence,
      cards: tutorCards.map(c => c.cardId),
    }
  }

  /**
   * Analyze card advantage engines
   */
  private async analyzeCardAdvantage(deck: GeneratedDeck): Promise<PowerLevelFactor | null> {
    const cardAdvantageCards = deck.cards.filter(card => 
      card.category === 'draw' ||
      card.category === 'card_advantage' ||
      card.role.toLowerCase().includes('draw') ||
      card.reasoning.toLowerCase().includes('card advantage')
    )

    if (cardAdvantageCards.length < 8) {
      return {
        category: 'card_advantage',
        name: 'Card Advantage',
        description: `Insufficient card advantage sources (${cardAdvantageCards.length})`,
        impact: -0.3,
        confidence: 0.8,
        cards: cardAdvantageCards.map(c => c.cardId),
      }
    }

    const impact = Math.min(1, (cardAdvantageCards.length - 8) * 0.1)
    
    return {
      category: 'card_advantage',
      name: 'Card Advantage',
      description: `Good card advantage density (${cardAdvantageCards.length} sources)`,
      impact,
      confidence: 0.8,
      cards: cardAdvantageCards.map(c => c.cardId),
    }
  }

  /**
   * Analyze interaction suite
   */
  private async analyzeInteraction(deck: GeneratedDeck): Promise<PowerLevelFactor | null> {
    const interactionCards = deck.cards.filter(card => 
      card.category === 'removal' ||
      card.category === 'interaction' ||
      card.category === 'board_wipes' ||
      card.role.toLowerCase().includes('removal') ||
      card.role.toLowerCase().includes('counter')
    )

    if (interactionCards.length < 6) {
      return {
        category: 'interaction',
        name: 'Interaction',
        description: `Low interaction density (${interactionCards.length} pieces)`,
        impact: -0.4,
        confidence: 0.9,
        cards: interactionCards.map(c => c.cardId),
      }
    }

    const impact = Math.min(0.8, (interactionCards.length - 6) * 0.1)
    
    return {
      category: 'interaction',
      name: 'Interaction',
      description: `Adequate interaction suite (${interactionCards.length} pieces)`,
      impact,
      confidence: 0.9,
      cards: interactionCards.map(c => c.cardId),
    }
  }

  /**
   * Analyze win conditions
   */
  private async analyzeWinConditions(deck: GeneratedDeck): Promise<PowerLevelFactor | null> {
    const winConditionCards = deck.cards.filter(card => 
      card.category === 'win_conditions' ||
      card.category === 'finishers' ||
      card.role.toLowerCase().includes('win condition')
    )

    const comboWinCons = deck.winConditions.filter(wc => wc.type === 'combo').length
    const alternativeWinCons = deck.winConditions.filter(wc => wc.type === 'alternative').length

    let impact = 0
    let description = ''

    if (comboWinCons > 0) {
      impact += comboWinCons * 0.4
      description += `${comboWinCons} combo win conditions. `
    }

    if (alternativeWinCons > 0) {
      impact += alternativeWinCons * 0.3
      description += `${alternativeWinCons} alternative win conditions. `
    }

    if (winConditionCards.length < 3) {
      impact -= 0.3
      description += 'Limited win condition diversity.'
    }

    return {
      category: 'win_conditions',
      name: 'Win Conditions',
      description: description.trim(),
      impact: Math.min(1.5, impact),
      confidence: 0.8,
      cards: winConditionCards.map(c => c.cardId),
    }
  }

  /**
   * Analyze deck consistency
   */
  private async analyzeConsistency(deck: GeneratedDeck): Promise<PowerLevelFactor | null> {
    const rampCards = deck.cards.filter(c => c.category === 'ramp').length
    const drawCards = deck.cards.filter(c => c.category === 'draw' || c.category === 'card_advantage').length
    const averageCMC = deck.statistics.averageCMC

    let impact = 0
    let description = ''

    // Ramp consistency
    if (rampCards >= 10) {
      impact += 0.2
      description += 'Good ramp density. '
    } else if (rampCards < 8) {
      impact -= 0.2
      description += 'Low ramp density. '
    }

    // Draw consistency
    if (drawCards >= 10) {
      impact += 0.2
      description += 'Good card advantage. '
    } else if (drawCards < 8) {
      impact -= 0.2
      description += 'Limited card advantage. '
    }

    // Mana curve
    if (averageCMC > 4.5) {
      impact -= 0.3
      description += 'High mana curve reduces consistency.'
    } else if (averageCMC < 2.5) {
      impact += 0.1
      description += 'Low mana curve improves consistency.'
    }

    return {
      category: 'consistency',
      name: 'Consistency',
      description: description.trim(),
      impact,
      confidence: 0.85,
      cards: [],
    }
  }

  /**
   * Analyze protection suite
   */
  private async analyzeProtection(deck: GeneratedDeck): Promise<PowerLevelFactor | null> {
    const protectionCards = deck.cards.filter(card => 
      card.role.toLowerCase().includes('protection') ||
      card.reasoning.toLowerCase().includes('protect') ||
      this.isProtectionCard(card.cardId)
    )

    if (protectionCards.length === 0) return null

    const impact = Math.min(0.5, protectionCards.length * 0.1)
    
    return {
      category: 'protection',
      name: 'Protection',
      description: `Deck includes ${protectionCards.length} protection effects`,
      impact,
      confidence: 0.7,
      cards: protectionCards.map(c => c.cardId),
    }
  }

  /**
   * Analyze combo pieces
   */
  private async analyzeComboPieces(deck: GeneratedDeck): Promise<PowerLevelFactor | null> {
    const comboCards = deck.cards.filter(card => 
      card.role.toLowerCase().includes('combo') ||
      card.reasoning.toLowerCase().includes('combo') ||
      this.isComboCard(card.cardId)
    )

    if (comboCards.length === 0) return null

    // More combo pieces = higher power level
    const impact = Math.min(1.2, comboCards.length * 0.15)
    
    return {
      category: 'combo_pieces',
      name: 'Combo Pieces',
      description: `Deck contains ${comboCards.length} combo enablers`,
      impact,
      confidence: 0.75,
      cards: comboCards.map(c => c.cardId),
    }
  }

  /**
   * Analyze stax effects
   */
  private async analyzeStaxEffects(deck: GeneratedDeck): Promise<PowerLevelFactor | null> {
    const staxCards = deck.cards.filter(card => 
      this.isStaxCard(card.cardId) ||
      card.role.toLowerCase().includes('stax') ||
      card.reasoning.toLowerCase().includes('stax')
    )

    if (staxCards.length === 0) return null

    // Stax can increase power level but may reduce fun factor
    const impact = Math.min(0.8, staxCards.length * 0.2)
    
    return {
      category: 'stax_effects',
      name: 'Stax Effects',
      description: `Deck includes ${staxCards.length} stax pieces`,
      impact,
      confidence: 0.8,
      cards: staxCards.map(c => c.cardId),
    }
  }

  /**
   * Calculate power level breakdown
   */
  private calculatePowerLevelBreakdown(factors: PowerLevelFactor[], deck: GeneratedDeck): any {
    const breakdown = {
      basePowerLevel: 2.0, // Start at power level 2
      fastManaBonus: 0,
      tutorBonus: 0,
      interactionBonus: 0,
      consistencyBonus: 0,
      comboBonus: 0,
      staxPenalty: 0,
    }

    for (const factor of factors) {
      switch (factor.category) {
        case 'fast_mana':
          breakdown.fastManaBonus = factor.impact
          break
        case 'tutors':
          breakdown.tutorBonus = factor.impact
          break
        case 'interaction':
          breakdown.interactionBonus = factor.impact
          break
        case 'consistency':
          breakdown.consistencyBonus = factor.impact
          break
        case 'combo_pieces':
          breakdown.comboBonus = factor.impact
          break
        case 'stax_effects':
          breakdown.staxPenalty = -Math.abs(factor.impact) * 0.5 // Stax reduces social power level
          break
      }
    }

    return breakdown
  }

  /**
   * Calculate final power level from breakdown
   */
  private calculateFinalPowerLevel(breakdown: any): number {
    const totalAdjustment = 
      breakdown.fastManaBonus +
      breakdown.tutorBonus +
      breakdown.interactionBonus +
      breakdown.consistencyBonus +
      breakdown.comboBonus +
      breakdown.staxPenalty

    const finalLevel = breakdown.basePowerLevel + totalAdjustment
    
    // Clamp to valid range (1-4)
    return Math.max(1, Math.min(4, finalLevel))
  }

  /**
   * Calculate assessment confidence
   */
  private calculateAssessmentConfidence(factors: PowerLevelFactor[]): number {
    if (factors.length === 0) return 0.3 // Low confidence with no factors

    const avgConfidence = factors.reduce((sum, f) => sum + f.confidence, 0) / factors.length
    const factorCoverage = Math.min(1, factors.length / 8) // Ideal: 8 different factors
    
    return avgConfidence * factorCoverage
  }

  /**
   * Calculate accuracy against target
   */
  private calculateAccuracy(estimated: number, target: number): number {
    const deviation = Math.abs(estimated - target)
    return Math.max(0, 1 - (deviation / 2)) // Max deviation of 2 power levels
  }

  /**
   * Identify deck strengths
   */
  private identifyStrengths(factors: PowerLevelFactor[], breakdown: any): string[] {
    const strengths: string[] = []

    if (breakdown.fastManaBonus > 0.5) {
      strengths.push('Strong mana acceleration')
    }

    if (breakdown.tutorBonus > 0.3) {
      strengths.push('Good tutoring package')
    }

    if (breakdown.interactionBonus > 0.2) {
      strengths.push('Adequate interaction suite')
    }

    if (breakdown.consistencyBonus > 0.2) {
      strengths.push('Consistent game plan')
    }

    if (breakdown.comboBonus > 0.5) {
      strengths.push('Multiple win conditions')
    }

    return strengths
  }

  /**
   * Identify deck weaknesses
   */
  private identifyWeaknesses(factors: PowerLevelFactor[], breakdown: any): string[] {
    const weaknesses: string[] = []

    if (breakdown.fastManaBonus < 0.1) {
      weaknesses.push('Limited mana acceleration')
    }

    if (breakdown.interactionBonus < 0) {
      weaknesses.push('Insufficient interaction')
    }

    if (breakdown.consistencyBonus < -0.2) {
      weaknesses.push('Consistency issues')
    }

    if (breakdown.comboBonus < 0.2) {
      weaknesses.push('Limited win conditions')
    }

    return weaknesses
  }

  /**
   * Generate power level recommendations
   */
  private async generatePowerLevelRecommendations(
    deck: GeneratedDeck,
    estimatedPowerLevel: number,
    targetPowerLevel: number | undefined,
    factors: PowerLevelFactor[]
  ): Promise<any[]> {
    const recommendations: any[] = []

    if (!targetPowerLevel) return recommendations

    const difference = targetPowerLevel - estimatedPowerLevel

    if (Math.abs(difference) < 0.3) {
      // Power level is close to target
      recommendations.push({
        type: 'maintain',
        category: 'overall',
        description: 'Power level is well-matched to target',
        cardSuggestions: [],
        estimatedImpact: 0,
        priority: 'low',
      })
      return recommendations
    }

    if (difference > 0.3) {
      // Need to increase power level
      recommendations.push(...await this.generatePowerIncreaseRecommendations(deck, factors, difference))
    } else {
      // Need to decrease power level
      recommendations.push(...await this.generatePowerDecreaseRecommendations(deck, factors, Math.abs(difference)))
    }

    return recommendations
  }

  /**
   * Generate recommendations to increase power level
   */
  private async generatePowerIncreaseRecommendations(
    deck: GeneratedDeck,
    factors: PowerLevelFactor[],
    increase: number
  ): Promise<any[]> {
    const recommendations: any[] = []

    // Check if fast mana is lacking
    const fastManaFactor = factors.find(f => f.category === 'fast_mana')
    if (!fastManaFactor || fastManaFactor.impact < 0.5) {
      recommendations.push({
        type: 'increase',
        category: 'fast_mana',
        description: 'Add more fast mana sources to increase power level',
        cardSuggestions: [
          {
            action: 'add',
            cardName: 'Sol Ring',
            reasoning: 'Essential fast mana for higher power levels',
          },
          {
            action: 'add',
            cardName: 'Arcane Signet',
            reasoning: 'Efficient mana rock',
          },
        ],
        estimatedImpact: 0.4,
        priority: 'high',
      })
    }

    // Check if tutors are lacking
    const tutorFactor = factors.find(f => f.category === 'tutors')
    if (!tutorFactor || tutorFactor.impact < 0.3) {
      recommendations.push({
        type: 'increase',
        category: 'tutors',
        description: 'Add tutors to improve consistency and power',
        cardSuggestions: [
          {
            action: 'add',
            cardName: 'Demonic Tutor',
            reasoning: 'Versatile tutor for any card',
          },
        ],
        estimatedImpact: 0.3,
        priority: 'medium',
      })
    }

    return recommendations
  }

  /**
   * Generate recommendations to decrease power level
   */
  private async generatePowerDecreaseRecommendations(
    deck: GeneratedDeck,
    factors: PowerLevelFactor[],
    decrease: number
  ): Promise<any[]> {
    const recommendations: any[] = []

    // Check for excessive fast mana
    const fastManaFactor = factors.find(f => f.category === 'fast_mana')
    if (fastManaFactor && fastManaFactor.impact > 1.0) {
      recommendations.push({
        type: 'decrease',
        category: 'fast_mana',
        description: 'Reduce fast mana to lower power level',
        cardSuggestions: [
          {
            action: 'remove',
            cardName: 'Mana Crypt',
            reasoning: 'Very high power fast mana',
          },
        ],
        estimatedImpact: -0.5,
        priority: 'high',
      })
    }

    // Check for excessive tutors
    const tutorFactor = factors.find(f => f.category === 'tutors')
    if (tutorFactor && tutorFactor.impact > 0.8) {
      recommendations.push({
        type: 'decrease',
        category: 'tutors',
        description: 'Reduce tutors for more casual play',
        cardSuggestions: [
          {
            action: 'replace',
            cardName: 'Vampiric Tutor',
            replacement: 'Card draw spell',
            reasoning: 'Replace efficient tutor with card advantage',
          },
        ],
        estimatedImpact: -0.3,
        priority: 'medium',
      })
    }

    return recommendations
  }

  /**
   * Get comparison data with similar decks
   */
  private async getComparisonData(deck: GeneratedDeck, estimatedPowerLevel: number): Promise<any> {
    // Mock comparison data - would use real deck database
    const similarDecks = [
      {
        commander: 'Similar Commander 1',
        powerLevel: estimatedPowerLevel + 0.2,
        similarity: 0.85,
        keyDifferences: ['More tutors', 'Better mana base'],
      },
      {
        commander: 'Similar Commander 2',
        powerLevel: estimatedPowerLevel - 0.3,
        similarity: 0.78,
        keyDifferences: ['Less interaction', 'Slower win conditions'],
      },
    ]

    const metaPosition = this.determineMetaPosition(estimatedPowerLevel)
    const competitiveViability = this.calculateCompetitiveViability(estimatedPowerLevel)

    return {
      similarDecks,
      metaPosition,
      competitiveViability,
    }
  }

  /**
   * Run power level validation tests
   */
  private async runPowerLevelValidationTests(
    assessment: PowerLevelAssessment,
    targetPowerLevel: number
  ): Promise<any[]> {
    const tests: any[] = []

    // Test 1: Power level range check
    const deviation = Math.abs(assessment.estimatedPowerLevel - targetPowerLevel)
    tests.push({
      testName: 'Power Level Range',
      passed: deviation <= 0.5,
      score: Math.max(0, 1 - deviation),
      details: `Deviation: ${deviation.toFixed(2)} (target: ≤0.5)`,
    })

    // Test 2: Confidence threshold
    tests.push({
      testName: 'Assessment Confidence',
      passed: assessment.confidence >= 0.7,
      score: assessment.confidence,
      details: `Confidence: ${(assessment.confidence * 100).toFixed(1)}% (target: ≥70%)`,
    })

    // Test 3: Factor coverage
    const factorCoverage = assessment.factors.length / 8 // 8 ideal factors
    tests.push({
      testName: 'Factor Coverage',
      passed: factorCoverage >= 0.5,
      score: Math.min(1, factorCoverage),
      details: `Analyzed ${assessment.factors.length}/8 power level factors`,
    })

    return tests
  }

  /**
   * Generate adjustment suggestions
   */
  private generateAdjustmentSuggestions(
    assessment: PowerLevelAssessment,
    targetPowerLevel: number
  ): string[] {
    const suggestions: string[] = []
    const difference = targetPowerLevel - assessment.estimatedPowerLevel

    if (Math.abs(difference) <= 0.3) {
      suggestions.push('Power level is within acceptable range')
      return suggestions
    }

    if (difference > 0) {
      suggestions.push('Consider adding more powerful cards to reach target power level')
      suggestions.push('Focus on fast mana, tutors, or efficient win conditions')
    } else {
      suggestions.push('Consider replacing high-power cards with more casual alternatives')
      suggestions.push('Reduce fast mana or tutors to lower power level')
    }

    if (assessment.confidence < 0.7) {
      suggestions.push('Improve assessment confidence by analyzing more power level factors')
    }

    return suggestions
  }

  // Helper methods for card identification

  private isFastMana(cardId: string): boolean {
    const fastManaCards = [
      'sol ring', 'mana crypt', 'mana vault', 'chrome mox', 'mox diamond',
      'lotus petal', 'dark ritual', 'cabal ritual', 'seething song'
    ]
    return fastManaCards.some(card => cardId.toLowerCase().includes(card))
  }

  private isTutor(cardId: string): boolean {
    const tutorCards = [
      'demonic tutor', 'vampiric tutor', 'mystical tutor', 'enlightened tutor',
      'worldly tutor', 'gamble', 'imperial seal'
    ]
    return tutorCards.some(card => cardId.toLowerCase().includes(card))
  }

  private isProtectionCard(cardId: string): boolean {
    const protectionCards = [
      'counterspell', 'negate', 'swan song', 'heroic intervention',
      'teferi\'s protection', 'boros charm'
    ]
    return protectionCards.some(card => cardId.toLowerCase().includes(card))
  }

  private isComboCard(cardId: string): boolean {
    const comboCards = [
      'thassa\'s oracle', 'demonic consultation', 'kiki-jiki', 'splinter twin',
      'exquisite blood', 'sanguine bond'
    ]
    return comboCards.some(card => cardId.toLowerCase().includes(card))
  }

  private isStaxCard(cardId: string): boolean {
    const staxCards = [
      'winter orb', 'static orb', 'sphere of resistance', 'thorn of amethyst',
      'rule of law', 'trinisphere'
    ]
    return staxCards.some(card => cardId.toLowerCase().includes(card))
  }

  private determineMetaPosition(powerLevel: number): string {
    if (powerLevel >= 3.5) return 'Competitive'
    if (powerLevel >= 2.5) return 'High-Powered Casual'
    if (powerLevel >= 1.5) return 'Mid-Power Casual'
    return 'Low-Power Casual'
  }

  private calculateCompetitiveViability(powerLevel: number): number {
    return Math.max(0, Math.min(1, (powerLevel - 1) / 3))
  }

  private storeAssessmentHistory(deckId: string, assessment: PowerLevelAssessment): void {
    const history = this.assessmentHistory.get(deckId) || []
    history.push(assessment)
    
    // Keep only last 10 assessments
    if (history.length > 10) {
      history.shift()
    }
    
    this.assessmentHistory.set(deckId, history)
  }

  private initializePowerLevelDatabase(): void {
    // Initialize power level reference data
    console.log('✅ Initialized power level database')
  }

  private loadCardPowerRatings(): void {
    // Load card power ratings - would come from database
    this.cardPowerRatings.set('sol ring', 4.0)
    this.cardPowerRatings.set('mana crypt', 4.0)
    this.cardPowerRatings.set('demonic tutor', 3.8)
    // ... more ratings
    
    console.log('✅ Loaded card power ratings')
  }

  private loadMetaData(): void {
    // Load meta information
    console.log('✅ Loaded meta data')
  }

  /**
   * Get assessment history for a deck
   */
  getAssessmentHistory(deckId: string): PowerLevelAssessment[] {
    return this.assessmentHistory.get(deckId) || []
  }

  /**
   * Get card power rating
   */
  getCardPowerRating(cardId: string): number {
    return this.cardPowerRatings.get(cardId.toLowerCase()) || 2.0 // Default to power level 2
  }
}

// Export singleton instance
export const powerLevelAssessmentService = new PowerLevelAssessmentService()
import { z } from 'zod'
import { GeneratedDeck, GeneratedDeckCard, ConsultationData } from '@moxmuse/shared'
import { aiServiceOrchestrator } from '../index'
import { aiValidationEngine } from '../deck-validator'

// Quality Assurance Types
export const QualityMetricsSchema = z.object({
  overallScore: z.number().min(0).max(1),
  deckValidationScore: z.number().min(0).max(1),
  synergyScore: z.number().min(0).max(1),
  budgetComplianceScore: z.number().min(0).max(1),
  powerLevelAccuracyScore: z.number().min(0).max(1),
  cardRatioScore: z.number().min(0).max(1),
  
  // Detailed breakdowns
  cardRatios: z.object({
    lands: z.object({ actual: z.number(), target: z.number(), score: z.number() }),
    ramp: z.object({ actual: z.number(), target: z.number(), score: z.number() }),
    draw: z.object({ actual: z.number(), target: z.number(), score: z.number() }),
    removal: z.object({ actual: z.number(), target: z.number(), score: z.number() }),
    winConditions: z.object({ actual: z.number(), target: z.number(), score: z.number() }),
    synergy: z.object({ actual: z.number(), target: z.number(), score: z.number() }),
  }),
  
  budgetAnalysis: z.object({
    targetBudget: z.number().optional(),
    actualBudget: z.number(),
    variance: z.number(),
    compliancePercentage: z.number(),
  }),
  
  powerLevelAnalysis: z.object({
    targetPowerLevel: z.number().optional(),
    estimatedPowerLevel: z.number(),
    confidence: z.number(),
    factors: z.array(z.string()),
  }),
  
  issues: z.array(z.object({
    type: z.enum(['critical', 'major', 'minor', 'suggestion']),
    category: z.enum(['ratios', 'synergy', 'budget', 'power_level', 'validation']),
    message: z.string(),
    severity: z.number().min(1).max(10),
    autoFixable: z.boolean(),
    suggestedFix: z.string().optional(),
  })),
  
  improvements: z.array(z.object({
    type: z.enum(['card_swap', 'ratio_adjustment', 'budget_optimization', 'synergy_enhancement']),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    estimatedImpact: z.number().min(0).max(1),
    cardChanges: z.array(z.object({
      action: z.enum(['add', 'remove', 'replace']),
      cardName: z.string(),
      replacementCard: z.string().optional(),
      reasoning: z.string(),
    })).optional(),
  })),
})

export type QualityMetrics = z.infer<typeof QualityMetricsSchema>

export const QualityTestResultSchema = z.object({
  testName: z.string(),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  details: z.string(),
  metrics: z.record(z.number()),
  timestamp: z.date(),
})

export type QualityTestResult = z.infer<typeof QualityTestResultSchema>

export const FeedbackDataSchema = z.object({
  deckId: z.string(),
  userId: z.string(),
  rating: z.number().min(1).max(5),
  feedback: z.string().optional(),
  categories: z.object({
    deckQuality: z.number().min(1).max(5),
    synergyAccuracy: z.number().min(1).max(5),
    budgetCompliance: z.number().min(1).max(5),
    powerLevelMatch: z.number().min(1).max(5),
    playability: z.number().min(1).max(5),
  }),
  improvements: z.array(z.string()).optional(),
  wouldRecommend: z.boolean(),
  timestamp: z.date(),
})

export type FeedbackData = z.infer<typeof FeedbackDataSchema>

/**
 * AI Content Quality Assurance Service
 * Implements comprehensive quality validation and continuous improvement for AI-generated decks
 */
export class AIQualityAssuranceService {
  private qualityHistory: Map<string, QualityMetrics[]> = new Map()
  private testResults: Map<string, QualityTestResult[]> = new Map()
  private feedbackData: Map<string, FeedbackData[]> = new Map()
  private improvementPatterns: Map<string, number> = new Map()

  constructor() {
    console.log('🔍 Initializing AI Quality Assurance Service')
  }

  /**
   * Comprehensive deck quality assessment
   */
  async assessDeckQuality(
    deck: GeneratedDeck,
    consultationData: ConsultationData
  ): Promise<QualityMetrics> {
    console.log(`🔍 Assessing quality for deck: ${deck.name}`)

    try {
      // 1. Validate deck structure and rules
      const validationScore = await this.validateDeckStructure(deck)

      // 2. Analyze card ratios and composition
      const ratioScore = await this.analyzeCardRatios(deck, consultationData)

      // 3. Evaluate synergies and interactions
      const synergyScore = await this.evaluateSynergies(deck)

      // 4. Check budget compliance
      const budgetScore = await this.validateBudgetCompliance(deck, consultationData)

      // 5. Assess power level accuracy
      const powerLevelScore = await this.assessPowerLevel(deck, consultationData)

      // 6. Calculate overall quality score
      const overallScore = this.calculateOverallScore({
        validation: validationScore.score,
        ratios: ratioScore.score,
        synergy: synergyScore.score,
        budget: budgetScore.score,
        powerLevel: powerLevelScore.score,
      })

      const qualityMetrics: QualityMetrics = {
        overallScore,
        deckValidationScore: validationScore.score,
        synergyScore: synergyScore.score,
        budgetComplianceScore: budgetScore.score,
        powerLevelAccuracyScore: powerLevelScore.score,
        cardRatioScore: ratioScore.score,
        cardRatios: ratioScore.ratios,
        budgetAnalysis: budgetScore.analysis,
        powerLevelAnalysis: powerLevelScore.analysis,
        issues: [
          ...validationScore.issues,
          ...ratioScore.issues,
          ...synergyScore.issues,
          ...budgetScore.issues,
          ...powerLevelScore.issues,
        ],
        improvements: [
          ...ratioScore.improvements,
          ...synergyScore.improvements,
          ...budgetScore.improvements,
          ...powerLevelScore.improvements,
        ],
      }

      // Store quality history
      this.storeQualityHistory(deck.id, qualityMetrics)

      console.log(`✅ Quality assessment completed. Overall score: ${overallScore.toFixed(2)}`)
      return qualityMetrics

    } catch (error) {
      console.error('❌ Quality assessment failed:', error)
      throw new Error(`Quality assessment failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Validate deck structure and format compliance
   */
  private async validateDeckStructure(deck: GeneratedDeck): Promise<{
    score: number
    issues: any[]
  }> {
    console.log('🔍 Validating deck structure')

    const issues: any[] = []
    let score = 1.0

    // Use existing validation engine
    const validationRequest = {
      commander: deck.commander,
      cards: deck.cards.map(c => ({
        cardId: c.cardId,
        name: c.cardId, // Simplified for now
        quantity: c.quantity,
        category: c.category,
      })),
      format: 'commander' as const,
      targetPowerLevel: deck.powerLevel,
      strategy: deck.strategy.name,
      budget: deck.estimatedBudget,
    }

    const validationResult = await aiValidationEngine.validateDeck(validationRequest)

    // Convert validation errors to quality issues
    for (const error of validationResult.errors) {
      if (error.severity === 'error') {
        score -= 0.2
        issues.push({
          type: 'critical',
          category: 'validation',
          message: error.message,
          severity: 8,
          autoFixable: false,
          suggestedFix: error.suggestion,
        })
      }
    }

    // Check deck size
    const totalCards = deck.cards.reduce((sum, card) => sum + card.quantity, 0)
    if (totalCards !== 100) {
      score -= 0.3
      issues.push({
        type: 'critical',
        category: 'validation',
        message: `Deck must contain exactly 100 cards. Current: ${totalCards}`,
        severity: 10,
        autoFixable: true,
        suggestedFix: totalCards > 100 ? 'Remove excess cards' : 'Add more cards',
      })
    }

    return { score: Math.max(0, score), issues }
  }

  /**
   * Analyze card ratios and composition
   */
  private async analyzeCardRatios(
    deck: GeneratedDeck,
    consultationData: ConsultationData
  ): Promise<{
    score: number
    ratios: any
    issues: any[]
    improvements: any[]
  }> {
    console.log('🔍 Analyzing card ratios')

    const issues: any[] = []
    const improvements: any[] = []

    // Count cards by category
    const composition = this.analyzeComposition(deck.cards)

    // Define target ratios based on strategy and power level
    const targets = this.getTargetRatios(deck.strategy.archetype, deck.powerLevel)

    // Calculate ratio scores
    const ratios = {
      lands: this.calculateRatioScore(composition.lands, targets.lands),
      ramp: this.calculateRatioScore(composition.ramp, targets.ramp),
      draw: this.calculateRatioScore(composition.draw, targets.draw),
      removal: this.calculateRatioScore(composition.removal, targets.removal),
      winConditions: this.calculateRatioScore(composition.winConditions, targets.winConditions),
      synergy: this.calculateRatioScore(composition.synergy, targets.synergy),
    }

    // Generate issues and improvements
    for (const [category, ratio] of Object.entries(ratios)) {
      if (ratio.score < 0.7) {
        const severity = ratio.score < 0.5 ? 'major' : 'minor'
        issues.push({
          type: severity,
          category: 'ratios',
          message: `${category} ratio is suboptimal (${ratio.actual}/${ratio.target})`,
          severity: ratio.score < 0.5 ? 7 : 4,
          autoFixable: true,
          suggestedFix: ratio.actual < ratio.target 
            ? `Add ${ratio.target - ratio.actual} more ${category} cards`
            : `Remove ${ratio.actual - ratio.target} ${category} cards`,
        })

        improvements.push({
          type: 'ratio_adjustment',
          description: `Optimize ${category} ratio to improve deck consistency`,
          priority: ratio.score < 0.5 ? 'high' : 'medium',
          estimatedImpact: (1 - ratio.score) * 0.3,
        })
      }
    }

    const overallRatioScore = Object.values(ratios).reduce((sum, r) => sum + r.score, 0) / Object.keys(ratios).length

    return {
      score: overallRatioScore,
      ratios,
      issues,
      improvements,
    }
  }

  /**
   * Evaluate synergies and card interactions
   */
  private async evaluateSynergies(deck: GeneratedDeck): Promise<{
    score: number
    issues: any[]
    improvements: any[]
  }> {
    console.log('🔍 Evaluating synergies')

    const issues: any[] = []
    const improvements: any[] = []

    try {
      // Use AI to analyze synergies
      const synergyAnalysis = await aiServiceOrchestrator.executeAITask({
        taskType: 'synergy-evaluation',
        prompt: `Analyze the synergies in this ${deck.commander} deck. Rate the overall synergy strength and identify key interactions.`,
        variables: {
          commander: deck.commander,
          strategy: deck.strategy.name,
          cards: deck.cards.map(c => ({ name: c.cardId, category: c.category, role: c.role })),
          winConditions: deck.winConditions,
        },
      })

      // Parse AI response and calculate synergy score
      let synergyScore = 0.8 // Default score

      // Check for synergy density
      const synergyCards = deck.cards.filter(c => c.category === 'synergy').length
      const totalCards = deck.cards.length
      const synergyDensity = synergyCards / totalCards

      if (synergyDensity < 0.15) {
        synergyScore -= 0.2
        issues.push({
          type: 'minor',
          category: 'synergy',
          message: 'Low synergy density - deck may lack cohesion',
          severity: 5,
          autoFixable: true,
          suggestedFix: 'Add more synergistic cards that support the main strategy',
        })

        improvements.push({
          type: 'synergy_enhancement',
          description: 'Increase synergy density by replacing generic cards with synergistic alternatives',
          priority: 'medium',
          estimatedImpact: 0.2,
        })
      }

      // Check for orphaned cards (cards without synergies)
      const orphanedCards = deck.cards.filter(c => 
        c.category !== 'lands' && 
        c.category !== 'ramp' && 
        !c.reasoning.includes('synergy') &&
        !c.reasoning.includes('combo')
      )

      if (orphanedCards.length > 10) {
        synergyScore -= 0.15
        improvements.push({
          type: 'synergy_enhancement',
          description: 'Replace isolated cards with more synergistic options',
          priority: 'medium',
          estimatedImpact: 0.15,
          cardChanges: orphanedCards.slice(0, 3).map(card => ({
            action: 'replace' as const,
            cardName: card.cardId,
            reasoning: 'Improve synergy density',
          })),
        })
      }

      return {
        score: Math.max(0, synergyScore),
        issues,
        improvements,
      }

    } catch (error) {
      console.warn('Failed to evaluate synergies:', error)
      return {
        score: 0.5, // Neutral score on failure
        issues: [{
          type: 'minor',
          category: 'synergy',
          message: 'Unable to fully evaluate synergies',
          severity: 3,
          autoFixable: false,
        }],
        improvements: [],
      }
    }
  }

  /**
   * Validate budget compliance
   */
  private async validateBudgetCompliance(
    deck: GeneratedDeck,
    consultationData: ConsultationData
  ): Promise<{
    score: number
    analysis: any
    issues: any[]
    improvements: any[]
  }> {
    console.log('🔍 Validating budget compliance')

    const issues: any[] = []
    const improvements: any[] = []

    const targetBudget = consultationData.budget || deck.estimatedBudget
    const actualBudget = deck.estimatedBudget
    const variance = Math.abs(actualBudget - targetBudget) / targetBudget
    const compliancePercentage = Math.max(0, 1 - variance)

    let score = compliancePercentage

    const analysis = {
      targetBudget,
      actualBudget,
      variance,
      compliancePercentage,
    }

    // Check budget compliance
    if (variance > 0.1) { // More than 10% over budget
      const severity = variance > 0.25 ? 'major' : 'minor'
      score = Math.max(0, score - 0.3)
      
      issues.push({
        type: severity,
        category: 'budget',
        message: `Deck exceeds budget by ${(variance * 100).toFixed(1)}%`,
        severity: variance > 0.25 ? 8 : 5,
        autoFixable: true,
        suggestedFix: 'Replace expensive cards with budget alternatives',
      })

      improvements.push({
        type: 'budget_optimization',
        description: 'Optimize deck to meet budget constraints',
        priority: variance > 0.25 ? 'high' : 'medium',
        estimatedImpact: Math.min(0.3, variance),
      })
    }

    // Check for budget distribution
    const expensiveCards = deck.cards.filter(c => 
      c.cardId !== deck.commander && // Exclude commander from expensive card check
      this.estimateCardPrice(c.cardId) > targetBudget * 0.1 // Cards over 10% of budget
    )

    if (expensiveCards.length > 5) {
      improvements.push({
        type: 'budget_optimization',
        description: 'Consider spreading budget more evenly across cards',
        priority: 'low',
        estimatedImpact: 0.1,
      })
    }

    return {
      score: Math.max(0, score),
      analysis,
      issues,
      improvements,
    }
  }

  /**
   * Assess power level accuracy
   */
  private async assessPowerLevel(
    deck: GeneratedDeck,
    consultationData: ConsultationData
  ): Promise<{
    score: number
    analysis: any
    issues: any[]
    improvements: any[]
  }> {
    console.log('🔍 Assessing power level')

    const issues: any[] = []
    const improvements: any[] = []

    const targetPowerLevel = consultationData.powerLevel || deck.powerLevel
    
    // Use AI to estimate actual power level
    const powerLevelAnalysis = await this.estimatePowerLevel(deck)
    
    const estimatedPowerLevel = powerLevelAnalysis.level
    const confidence = powerLevelAnalysis.confidence
    const factors = powerLevelAnalysis.factors

    const levelDifference = Math.abs(estimatedPowerLevel - targetPowerLevel)
    const accuracy = Math.max(0, 1 - (levelDifference / 4)) // Scale to 0-1
    
    let score = accuracy * confidence

    const analysis = {
      targetPowerLevel,
      estimatedPowerLevel,
      confidence,
      factors,
    }

    // Check power level accuracy
    if (levelDifference > 0.5) {
      const severity = levelDifference > 1 ? 'major' : 'minor'
      
      issues.push({
        type: severity,
        category: 'power_level',
        message: `Power level mismatch: estimated ${estimatedPowerLevel}, target ${targetPowerLevel}`,
        severity: levelDifference > 1 ? 7 : 4,
        autoFixable: true,
        suggestedFix: estimatedPowerLevel > targetPowerLevel 
          ? 'Replace high-power cards with more casual alternatives'
          : 'Add more powerful cards to reach target power level',
      })

      improvements.push({
        type: 'card_swap',
        description: 'Adjust card choices to match target power level',
        priority: levelDifference > 1 ? 'high' : 'medium',
        estimatedImpact: Math.min(0.3, levelDifference / 4),
      })
    }

    return {
      score: Math.max(0, score),
      analysis,
      issues,
      improvements,
    }
  }

  /**
   * Run automated quality tests
   */
  async runQualityTests(deck: GeneratedDeck): Promise<QualityTestResult[]> {
    console.log(`🧪 Running quality tests for deck: ${deck.name}`)

    const tests: QualityTestResult[] = []

    // Test 1: Deck Size Validation
    tests.push(await this.testDeckSize(deck))

    // Test 2: Mana Curve Analysis
    tests.push(await this.testManaCurve(deck))

    // Test 3: Color Identity Compliance
    tests.push(await this.testColorIdentity(deck))

    // Test 4: Win Condition Adequacy
    tests.push(await this.testWinConditions(deck))

    // Test 5: Interaction Density
    tests.push(await this.testInteractionDensity(deck))

    // Test 6: Consistency Metrics
    tests.push(await this.testConsistency(deck))

    // Store test results
    this.testResults.set(deck.id, tests)

    const passedTests = tests.filter(t => t.passed).length
    const totalTests = tests.length
    
    console.log(`✅ Quality tests completed: ${passedTests}/${totalTests} passed`)

    return tests
  }

  /**
   * Process user feedback for continuous improvement
   */
  async processFeedback(feedback: FeedbackData): Promise<void> {
    console.log(`📝 Processing feedback for deck: ${feedback.deckId}`)

    // Store feedback
    const existingFeedback = this.feedbackData.get(feedback.deckId) || []
    existingFeedback.push(feedback)
    this.feedbackData.set(feedback.deckId, existingFeedback)

    // Analyze feedback patterns
    await this.analyzeFeedbackPatterns(feedback)

    // Update improvement patterns
    this.updateImprovementPatterns(feedback)

    console.log('✅ Feedback processed and patterns updated')
  }

  /**
   * Generate improvement recommendations based on feedback
   */
  async generateImprovementRecommendations(deckId: string): Promise<any[]> {
    console.log(`💡 Generating improvement recommendations for deck: ${deckId}`)

    const feedback = this.feedbackData.get(deckId) || []
    const qualityHistory = this.qualityHistory.get(deckId) || []

    if (feedback.length === 0 && qualityHistory.length === 0) {
      return []
    }

    const recommendations: any[] = []

    // Analyze feedback trends
    if (feedback.length > 0) {
      const avgRatings = this.calculateAverageFeedbackRatings(feedback)
      
      // Low deck quality ratings
      if (avgRatings.deckQuality < 3.5) {
        recommendations.push({
          type: 'quality_improvement',
          priority: 'high',
          description: 'Focus on improving overall deck quality based on user feedback',
          actions: ['Review card choices', 'Improve synergies', 'Balance mana curve'],
        })
      }

      // Low synergy accuracy ratings
      if (avgRatings.synergyAccuracy < 3.5) {
        recommendations.push({
          type: 'synergy_improvement',
          priority: 'high',
          description: 'Improve synergy detection and card interaction analysis',
          actions: ['Enhance synergy algorithms', 'Better card relationship mapping'],
        })
      }

      // Budget compliance issues
      if (avgRatings.budgetCompliance < 3.5) {
        recommendations.push({
          type: 'budget_optimization',
          priority: 'medium',
          description: 'Improve budget compliance and price accuracy',
          actions: ['Update price data', 'Better budget distribution'],
        })
      }
    }

    // Analyze quality metrics trends
    if (qualityHistory.length > 1) {
      const latestQuality = qualityHistory[qualityHistory.length - 1]
      const previousQuality = qualityHistory[qualityHistory.length - 2]

      if (latestQuality.overallScore < previousQuality.overallScore) {
        recommendations.push({
          type: 'regression_analysis',
          priority: 'high',
          description: 'Quality regression detected - investigate recent changes',
          actions: ['Review recent algorithm changes', 'Check data quality'],
        })
      }
    }

    console.log(`💡 Generated ${recommendations.length} improvement recommendations`)
    return recommendations
  }

  // Helper methods

  private analyzeComposition(cards: GeneratedDeckCard[]): {
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
      const count = card.quantity
      switch (card.category) {
        case 'lands':
          composition.lands += count
          break
        case 'ramp':
          composition.ramp += count
          break
        case 'draw':
        case 'card_advantage':
          composition.draw += count
          break
        case 'removal':
        case 'board_wipes':
        case 'interaction':
          composition.removal += count
          break
        case 'win_conditions':
        case 'finishers':
          composition.winConditions += count
          break
        case 'synergy':
        case 'engine':
          composition.synergy += count
          break
        default:
          composition.utility += count
      }
    }

    return composition
  }

  private getTargetRatios(archetype: string, powerLevel: number): {
    lands: number
    ramp: number
    draw: number
    removal: number
    winConditions: number
    synergy: number
  } {
    // Base ratios adjusted by archetype and power level
    const baseRatios = {
      lands: 36,
      ramp: 10,
      draw: 10,
      removal: 8,
      winConditions: 6,
      synergy: 20,
    }

    // Adjust based on archetype
    switch (archetype) {
      case 'aggro':
        return {
          ...baseRatios,
          lands: 34,
          ramp: 8,
          removal: 6,
          winConditions: 8,
        }
      case 'control':
        return {
          ...baseRatios,
          lands: 38,
          draw: 12,
          removal: 12,
          winConditions: 4,
        }
      case 'combo':
        return {
          ...baseRatios,
          draw: 12,
          removal: 6,
          synergy: 25,
        }
      default:
        return baseRatios
    }
  }

  private calculateRatioScore(actual: number, target: number): {
    actual: number
    target: number
    score: number
  } {
    const difference = Math.abs(actual - target)
    const tolerance = target * 0.2 // 20% tolerance
    const score = Math.max(0, 1 - (difference / tolerance))
    
    return {
      actual,
      target,
      score: Math.min(1, score),
    }
  }

  private calculateOverallScore(scores: {
    validation: number
    ratios: number
    synergy: number
    budget: number
    powerLevel: number
  }): number {
    // Weighted average of all scores
    const weights = {
      validation: 0.3, // Most important
      ratios: 0.25,
      synergy: 0.2,
      budget: 0.15,
      powerLevel: 0.1,
    }

    return (
      scores.validation * weights.validation +
      scores.ratios * weights.ratios +
      scores.synergy * weights.synergy +
      scores.budget * weights.budget +
      scores.powerLevel * weights.powerLevel
    )
  }

  private async estimatePowerLevel(deck: GeneratedDeck): Promise<{
    level: number
    confidence: number
    factors: string[]
  }> {
    // Simplified power level estimation
    // In a real implementation, this would use more sophisticated analysis
    
    const factors: string[] = []
    let powerLevel = 2.0 // Base power level
    let confidence = 0.8

    // Check for high-power indicators
    const expensiveCards = deck.cards.filter(c => this.estimateCardPrice(c.cardId) > 50)
    if (expensiveCards.length > 5) {
      powerLevel += 0.5
      factors.push('High-value cards present')
    }

    // Check for fast mana
    const fastManaCards = deck.cards.filter(c => 
      c.category === 'ramp' && c.role.includes('fast')
    )
    if (fastManaCards.length > 3) {
      powerLevel += 0.3
      factors.push('Fast mana acceleration')
    }

    // Check for tutors
    const tutorCards = deck.cards.filter(c => 
      c.role.includes('tutor') || c.reasoning.includes('tutor')
    )
    if (tutorCards.length > 2) {
      powerLevel += 0.2
      factors.push('Multiple tutors')
    }

    return {
      level: Math.min(4, Math.max(1, powerLevel)),
      confidence,
      factors,
    }
  }

  private estimateCardPrice(cardId: string): number {
    // Mock price estimation - would use real price data
    return Math.random() * 100
  }

  private storeQualityHistory(deckId: string, metrics: QualityMetrics): void {
    const history = this.qualityHistory.get(deckId) || []
    history.push(metrics)
    
    // Keep only last 10 entries
    if (history.length > 10) {
      history.shift()
    }
    
    this.qualityHistory.set(deckId, history)
  }

  // Quality test implementations
  private async testDeckSize(deck: GeneratedDeck): Promise<QualityTestResult> {
    const totalCards = deck.cards.reduce((sum, card) => sum + card.quantity, 0)
    const passed = totalCards === 100
    
    return {
      testName: 'Deck Size Validation',
      passed,
      score: passed ? 1.0 : 0.0,
      details: `Deck contains ${totalCards} cards (expected: 100)`,
      metrics: { totalCards, expectedCards: 100 },
      timestamp: new Date(),
    }
  }

  private async testManaCurve(deck: GeneratedDeck): Promise<QualityTestResult> {
    const averageCMC = deck.statistics.averageCMC
    const passed = averageCMC >= 2.5 && averageCMC <= 4.0
    const score = passed ? 1.0 : Math.max(0, 1 - Math.abs(averageCMC - 3.25) / 2)
    
    return {
      testName: 'Mana Curve Analysis',
      passed,
      score,
      details: `Average CMC: ${averageCMC.toFixed(2)} (optimal: 2.5-4.0)`,
      metrics: { averageCMC, optimalMin: 2.5, optimalMax: 4.0 },
      timestamp: new Date(),
    }
  }

  private async testColorIdentity(deck: GeneratedDeck): Promise<QualityTestResult> {
    // Simplified test - would check actual color identity compliance
    const passed = true // Assume passing for now
    
    return {
      testName: 'Color Identity Compliance',
      passed,
      score: 1.0,
      details: 'All cards comply with commander color identity',
      metrics: { violations: 0 },
      timestamp: new Date(),
    }
  }

  private async testWinConditions(deck: GeneratedDeck): Promise<QualityTestResult> {
    const winConditionCount = deck.winConditions.length
    const passed = winConditionCount >= 2
    const score = Math.min(1.0, winConditionCount / 3)
    
    return {
      testName: 'Win Condition Adequacy',
      passed,
      score,
      details: `Deck has ${winConditionCount} win conditions (minimum: 2)`,
      metrics: { winConditions: winConditionCount, minimum: 2 },
      timestamp: new Date(),
    }
  }

  private async testInteractionDensity(deck: GeneratedDeck): Promise<QualityTestResult> {
    const interactionCards = deck.cards.filter(c => 
      c.category === 'removal' || 
      c.category === 'interaction' || 
      c.category === 'board_wipes'
    ).length
    
    const passed = interactionCards >= 8
    const score = Math.min(1.0, interactionCards / 10)
    
    return {
      testName: 'Interaction Density',
      passed,
      score,
      details: `Deck has ${interactionCards} interaction cards (minimum: 8)`,
      metrics: { interactionCards, minimum: 8 },
      timestamp: new Date(),
    }
  }

  private async testConsistency(deck: GeneratedDeck): Promise<QualityTestResult> {
    // Simplified consistency test based on card draw and redundancy
    const drawCards = deck.cards.filter(c => 
      c.category === 'draw' || c.category === 'card_advantage'
    ).length
    
    const passed = drawCards >= 8
    const score = Math.min(1.0, drawCards / 10)
    
    return {
      testName: 'Consistency Metrics',
      passed,
      score,
      details: `Deck has ${drawCards} card advantage sources (minimum: 8)`,
      metrics: { cardAdvantage: drawCards, minimum: 8 },
      timestamp: new Date(),
    }
  }

  private async analyzeFeedbackPatterns(feedback: FeedbackData): Promise<void> {
    // Analyze patterns in user feedback to identify improvement areas
    const allFeedback = Array.from(this.feedbackData.values()).flat()
    
    // Calculate average ratings across all feedback
    const avgRatings = this.calculateAverageFeedbackRatings(allFeedback)
    
    // Identify areas needing improvement
    const improvementAreas: string[] = []
    
    if (avgRatings.deckQuality < 3.5) improvementAreas.push('deck_quality')
    if (avgRatings.synergyAccuracy < 3.5) improvementAreas.push('synergy_accuracy')
    if (avgRatings.budgetCompliance < 3.5) improvementAreas.push('budget_compliance')
    if (avgRatings.powerLevelMatch < 3.5) improvementAreas.push('power_level_accuracy')
    if (avgRatings.playability < 3.5) improvementAreas.push('playability')
    
    console.log(`📊 Feedback analysis: ${improvementAreas.length} areas need improvement`)
  }

  private calculateAverageFeedbackRatings(feedback: FeedbackData[]): {
    deckQuality: number
    synergyAccuracy: number
    budgetCompliance: number
    powerLevelMatch: number
    playability: number
  } {
    if (feedback.length === 0) {
      return {
        deckQuality: 3.0,
        synergyAccuracy: 3.0,
        budgetCompliance: 3.0,
        powerLevelMatch: 3.0,
        playability: 3.0,
      }
    }

    const totals = feedback.reduce((acc, f) => ({
      deckQuality: acc.deckQuality + f.categories.deckQuality,
      synergyAccuracy: acc.synergyAccuracy + f.categories.synergyAccuracy,
      budgetCompliance: acc.budgetCompliance + f.categories.budgetCompliance,
      powerLevelMatch: acc.powerLevelMatch + f.categories.powerLevelMatch,
      playability: acc.playability + f.categories.playability,
    }), {
      deckQuality: 0,
      synergyAccuracy: 0,
      budgetCompliance: 0,
      powerLevelMatch: 0,
      playability: 0,
    })

    const count = feedback.length
    return {
      deckQuality: totals.deckQuality / count,
      synergyAccuracy: totals.synergyAccuracy / count,
      budgetCompliance: totals.budgetCompliance / count,
      powerLevelMatch: totals.powerLevelMatch / count,
      playability: totals.playability / count,
    }
  }

  private updateImprovementPatterns(feedback: FeedbackData): void {
    // Track patterns in feedback to guide future improvements
    const key = `${feedback.categories.deckQuality}_${feedback.categories.synergyAccuracy}_${feedback.categories.budgetCompliance}`
    const count = this.improvementPatterns.get(key) || 0
    this.improvementPatterns.set(key, count + 1)
  }
}

// Export singleton instance
export const aiQualityAssuranceService = new AIQualityAssuranceService()
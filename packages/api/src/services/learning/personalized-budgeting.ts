import { prisma as db } from '@moxmuse/db'
import type { 
  PersonalizedBudget,
  UserStyleProfile,
  LearningEvent
} from '../../types/learning'
import { learningEventTracker } from './learning-event-tracker'
import { priceTrackingService } from '../price-tracking'

export class PersonalizedBudgetingEngine {
  /**
   * Create personalized budgeting across multiple decks
   */
  async createPersonalizedBudget(userId: string): Promise<PersonalizedBudget> {
    // Get user data and preferences
    const [userProfile, learningEvents, userDecks] = await Promise.all([
      this.getUserProfile(userId),
      learningEventTracker.getUserLearningEvents(userId),
      this.getUserDecks(userId)
    ])

    // Analyze user's budget behavior and preferences
    const budgetAnalysis = await this.analyzeBudgetBehavior(learningEvents, userProfile)
    
    // Calculate optimal budget allocation across decks
    const deckBudgets = await this.calculateDeckBudgets(userDecks, budgetAnalysis)
    
    // Determine spending priorities based on user preferences and deck needs
    const spendingPriorities = await this.determineSpendingPriorities(
      userDecks,
      userProfile,
      learningEvents
    )
    
    // Set value thresholds for different card categories
    const valueThresholds = this.calculateValueThresholds(budgetAnalysis, userProfile)
    
    // Generate upgrade queue with prioritized improvements
    const upgradeQueue = await this.generateUpgradeQueue(
      userDecks,
      deckBudgets,
      spendingPriorities,
      valueThresholds
    )

    const personalizedBudget: PersonalizedBudget = {
      userId,
      totalBudget: budgetAnalysis.totalBudget,
      deckBudgets,
      spendingPriorities,
      valueThresholds,
      upgradeQueue,
      lastOptimized: new Date()
    }

    // Store budget for future reference
    await this.storeBudget(personalizedBudget)

    return personalizedBudget
  }

  /**
   * Analyze user's budget behavior and preferences
   */
  private async analyzeBudgetBehavior(
    learningEvents: LearningEvent[],
    userProfile: UserStyleProfile
  ): Promise<{
    totalBudget: number
    budgetSensitivity: number
    spendingPatterns: Record<string, number>
    priceThresholds: Record<string, number>
    upgradeFrequency: number
  }> {
    // Filter budget-related events
    const budgetEvents = learningEvents.filter(e => 
      e.context.price || 
      e.context.budget || 
      e.context.cost ||
      e.context.expensive ||
      e.context.budgetConstraint
    )

    // Analyze spending patterns
    const spendingPatterns = this.analyzeSpendingPatterns(budgetEvents)
    
    // Determine budget sensitivity from user behavior
    const budgetSensitivity = this.calculateBudgetSensitivity(budgetEvents, userProfile)
    
    // Estimate total budget from user behavior
    const totalBudget = this.estimateTotalBudget(budgetEvents, spendingPatterns)
    
    // Calculate price thresholds for different categories
    const priceThresholds = this.calculatePriceThresholds(budgetEvents, budgetSensitivity)
    
    // Determine upgrade frequency
    const upgradeFrequency = this.calculateUpgradeFrequency(learningEvents)

    return {
      totalBudget,
      budgetSensitivity,
      spendingPatterns,
      priceThresholds,
      upgradeFrequency
    }
  }

  /**
   * Analyze spending patterns from user events
   */
  private analyzeSpendingPatterns(budgetEvents: LearningEvent[]): Record<string, number> {
    const patterns: Record<string, number> = {
      lands: 0,
      creatures: 0,
      spells: 0,
      artifacts: 0,
      planeswalkers: 0
    }

    for (const event of budgetEvents) {
      const cardType = event.context.cardType
      const price = event.context.price || 0
      
      if (cardType && patterns.hasOwnProperty(cardType)) {
        if (event.outcome === 'accepted' || event.eventType === 'manual_change') {
          patterns[cardType] += price
        }
      }
    }

    // Normalize to percentages
    const total = Object.values(patterns).reduce((sum, val) => sum + val, 0)
    if (total > 0) {
      for (const key of Object.keys(patterns)) {
        patterns[key] = patterns[key] / total
      }
    }

    return patterns
  }

  /**
   * Calculate budget sensitivity from user behavior
   */
  private calculateBudgetSensitivity(
    budgetEvents: LearningEvent[],
    userProfile: UserStyleProfile
  ): number {
    if (budgetEvents.length < 5) {
      return userProfile.budgetSensitivity || 0.5
    }

    let sensitivityScore = 0
    let assessments = 0

    // Analyze price-based rejections
    const priceRejections = budgetEvents.filter(e => 
      e.outcome === 'rejected' && 
      e.context.reason?.toLowerCase().includes('expensive')
    )
    
    if (budgetEvents.length > 0) {
      sensitivityScore += (priceRejections.length / budgetEvents.length) * 0.4
      assessments++
    }

    // Analyze budget constraint mentions
    const budgetConstraints = budgetEvents.filter(e => 
      e.context.budgetConstraint || 
      e.context.reason?.toLowerCase().includes('budget')
    )
    
    if (budgetEvents.length > 0) {
      sensitivityScore += (budgetConstraints.length / budgetEvents.length) * 0.3
      assessments++
    }

    // Analyze price thresholds in decisions
    const priceDecisions = budgetEvents.filter(e => e.context.price)
    if (priceDecisions.length > 0) {
      const acceptedPrices = priceDecisions
        .filter(e => e.outcome === 'accepted')
        .map(e => e.context.price)
      
      const rejectedPrices = priceDecisions
        .filter(e => e.outcome === 'rejected')
        .map(e => e.context.price)
      
      if (acceptedPrices.length > 0 && rejectedPrices.length > 0) {
        const avgAccepted = acceptedPrices.reduce((sum, p) => sum + p, 0) / acceptedPrices.length
        const avgRejected = rejectedPrices.reduce((sum, p) => sum + p, 0) / rejectedPrices.length
        
        // Higher sensitivity if rejected prices are close to accepted prices
        const priceGap = avgRejected - avgAccepted
        const sensitivityFromGap = Math.max(0, 1 - (priceGap / 50)) * 0.3 // Normalize by $50
        sensitivityScore += sensitivityFromGap
        assessments++
      }
    }

    const finalSensitivity = assessments > 0 ? sensitivityScore / assessments : 0.5
    return Math.max(0.1, Math.min(0.9, finalSensitivity))
  }

  /**
   * Estimate total budget from user behavior
   */
  private estimateTotalBudget(
    budgetEvents: LearningEvent[],
    spendingPatterns: Record<string, number>
  ): number {
    // Look for explicit budget mentions
    const explicitBudgets = budgetEvents
      .map(e => e.context.budget || e.context.totalBudget)
      .filter(Boolean)
    
    if (explicitBudgets.length > 0) {
      return Math.max(...explicitBudgets)
    }

    // Estimate from spending behavior
    const spentAmounts = budgetEvents
      .filter(e => e.outcome === 'accepted' && e.context.price)
      .map(e => e.context.price)
    
    if (spentAmounts.length > 0) {
      const totalSpent = spentAmounts.reduce((sum, price) => sum + price, 0)
      // Estimate total budget as 2-3x what they've spent (assuming partial spending)
      return totalSpent * 2.5
    }

    // Default budget based on user profile
    return 300 // Default $300 budget
  }

  /**
   * Calculate price thresholds for different categories
   */
  private calculatePriceThresholds(
    budgetEvents: LearningEvent[],
    budgetSensitivity: number
  ): Record<string, number> {
    const baseThresholds = {
      lands: 25,
      creatures: 20,
      spells: 15,
      artifacts: 18,
      planeswalkers: 30
    }

    // Adjust thresholds based on budget sensitivity
    const sensitivityMultiplier = 1 - (budgetSensitivity * 0.5) // 0.5 to 1.0

    const adjustedThresholds: Record<string, number> = {}
    for (const [category, baseThreshold] of Object.entries(baseThresholds)) {
      adjustedThresholds[category] = baseThreshold * sensitivityMultiplier
    }

    // Further adjust based on actual user behavior
    const categoryPrices: Record<string, number[]> = {}
    
    for (const event of budgetEvents) {
      const cardType = event.context.cardType
      const price = event.context.price
      
      if (cardType && price && event.outcome === 'accepted') {
        if (!categoryPrices[cardType]) {
          categoryPrices[cardType] = []
        }
        categoryPrices[cardType].push(price)
      }
    }

    // Use 75th percentile of accepted prices as threshold
    for (const [category, prices] of Object.entries(categoryPrices)) {
      if (prices.length >= 3) {
        prices.sort((a, b) => a - b)
        const percentile75 = prices[Math.floor(prices.length * 0.75)]
        adjustedThresholds[category] = Math.max(adjustedThresholds[category], percentile75)
      }
    }

    return adjustedThresholds
  }

  /**
   * Calculate upgrade frequency from user behavior
   */
  private calculateUpgradeFrequency(learningEvents: LearningEvent[]): number {
    const upgradeEvents = learningEvents.filter(e => 
      e.eventType === 'manual_change' && 
      e.context.changeType === 'card_added' &&
      e.context.reason?.toLowerCase().includes('upgrade')
    )

    if (upgradeEvents.length === 0) {
      return 0.5 // Default moderate frequency
    }

    // Calculate upgrades per month
    const oldestEvent = new Date(Math.min(...upgradeEvents.map(e => new Date(e.timestamp).getTime())))
    const monthsSinceFirst = (Date.now() - oldestEvent.getTime()) / (30 * 24 * 60 * 60 * 1000)
    
    return upgradeEvents.length / Math.max(monthsSinceFirst, 1)
  }

  /**
   * Calculate optimal budget allocation across decks
   */
  private async calculateDeckBudgets(
    userDecks: any[],
    budgetAnalysis: any
  ): Promise<Record<string, number>> {
    const deckBudgets: Record<string, number> = {}
    
    if (userDecks.length === 0) {
      return deckBudgets
    }

    // Analyze each deck's current value and potential
    const deckAnalyses = await Promise.all(
      userDecks.map(deck => this.analyzeDeckBudgetNeeds(deck))
    )

    // Calculate total budget allocation weights
    let totalWeight = 0
    const deckWeights: Record<string, number> = {}

    for (let i = 0; i < userDecks.length; i++) {
      const deck = userDecks[i]
      const analysis = deckAnalyses[i]
      
      // Weight based on deck usage, potential, and current investment
      const weight = (
        analysis.usageFrequency * 0.4 +
        analysis.improvementPotential * 0.3 +
        analysis.currentInvestment * 0.2 +
        analysis.strategicImportance * 0.1
      )
      
      deckWeights[deck.id] = weight
      totalWeight += weight
    }

    // Allocate budget proportionally
    const availableBudget = budgetAnalysis.totalBudget * 0.8 // Reserve 20% for new decks/emergencies
    
    for (const [deckId, weight] of Object.entries(deckWeights)) {
      deckBudgets[deckId] = (weight / totalWeight) * availableBudget
    }

    return deckBudgets
  }

  /**
   * Analyze a deck's budget needs
   */
  private async analyzeDeckBudgetNeeds(deck: any): Promise<{
    usageFrequency: number
    improvementPotential: number
    currentInvestment: number
    strategicImportance: number
  }> {
    // Estimate usage frequency (would be based on play history)
    const usageFrequency = 0.7 // Default moderate usage

    // Calculate improvement potential
    const currentValue = this.calculateDeckValue(deck)
    const improvementPotential = this.calculateImprovementPotential(deck)

    // Calculate current investment level
    const currentInvestment = Math.min(currentValue / 500, 1) // Normalize by $500

    // Determine strategic importance (based on deck role in collection)
    const strategicImportance = this.calculateStrategicImportance(deck)

    return {
      usageFrequency,
      improvementPotential,
      currentInvestment,
      strategicImportance
    }
  }

  /**
   * Calculate deck value
   */
  private calculateDeckValue(deck: any): number {
    if (!deck.cards) return 0
    
    return deck.cards.reduce((total: number, card: any) => {
      return total + (card.price || 0) * (card.quantity || 1)
    }, 0)
  }

  /**
   * Calculate improvement potential for a deck
   */
  private calculateImprovementPotential(deck: any): number {
    // Analyze deck for obvious upgrade opportunities
    let potential = 0.5 // Base potential

    if (deck.cards) {
      const totalCards = deck.cards.length
      const expensiveCards = deck.cards.filter((c: any) => (c.price || 0) > 20).length
      const budgetCards = deck.cards.filter((c: any) => (c.price || 0) < 2).length

      // Higher potential if many budget cards that could be upgraded
      potential += (budgetCards / totalCards) * 0.3

      // Lower potential if already has many expensive cards
      potential -= (expensiveCards / totalCards) * 0.2
    }

    return Math.max(0.1, Math.min(0.9, potential))
  }

  /**
   * Calculate strategic importance of a deck
   */
  private calculateStrategicImportance(deck: any): number {
    // This would analyze the deck's role in the user's collection
    // For now, use basic heuristics
    
    let importance = 0.5 // Base importance

    // Commander decks are generally more important
    if (deck.format === 'commander') {
      importance += 0.2
    }

    // Competitive decks might be more important
    if (deck.powerLevel && deck.powerLevel > 7) {
      importance += 0.1
    }

    // Unique strategies are more important
    if (deck.strategy && deck.strategy.includes('unique')) {
      importance += 0.1
    }

    return Math.max(0.1, Math.min(0.9, importance))
  }

  /**
   * Determine spending priorities based on user preferences
   */
  private async determineSpendingPriorities(
    userDecks: any[],
    userProfile: UserStyleProfile,
    learningEvents: LearningEvent[]
  ): Promise<string[]> {
    const priorities: Array<{ category: string; score: number }> = []

    // Analyze user's historical spending preferences
    const spendingHistory = learningEvents.filter(e => 
      e.context.price && e.outcome === 'accepted'
    )

    const categorySpending: Record<string, number> = {}
    for (const event of spendingHistory) {
      const category = event.context.cardType || 'other'
      categorySpending[category] = (categorySpending[category] || 0) + event.context.price
    }

    // Convert to priorities
    const totalSpending = Object.values(categorySpending).reduce((sum, val) => sum + val, 0)
    
    for (const [category, spending] of Object.entries(categorySpending)) {
      priorities.push({
        category,
        score: spending / totalSpending
      })
    }

    // Add strategic priorities based on user profile
    if (userProfile.competitiveLevel > 0.7) {
      priorities.push({ category: 'mana_base', score: 0.3 })
      priorities.push({ category: 'interaction', score: 0.25 })
    }

    if (userProfile.budgetSensitivity < 0.3) {
      priorities.push({ category: 'premium_cards', score: 0.2 })
    }

    // Sort and return top priorities
    return priorities
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(p => p.category)
  }

  /**
   * Calculate value thresholds for different categories
   */
  private calculateValueThresholds(
    budgetAnalysis: any,
    userProfile: UserStyleProfile
  ): Record<string, number> {
    const baseThresholds = {
      lands: 15,
      creatures: 12,
      spells: 10,
      artifacts: 12,
      planeswalkers: 20,
      premium_upgrade: 50,
      budget_option: 5
    }

    // Adjust based on budget sensitivity
    const multiplier = 1 + (1 - userProfile.budgetSensitivity) * 0.5

    const adjustedThresholds: Record<string, number> = {}
    for (const [category, threshold] of Object.entries(baseThresholds)) {
      adjustedThresholds[category] = threshold * multiplier
    }

    return adjustedThresholds
  }

  /**
   * Generate prioritized upgrade queue
   */
  private async generateUpgradeQueue(
    userDecks: any[],
    deckBudgets: Record<string, number>,
    spendingPriorities: string[],
    valueThresholds: Record<string, number>
  ): Promise<PersonalizedBudget['upgradeQueue']> {
    const upgradeQueue: PersonalizedBudget['upgradeQueue'] = []

    for (const deck of userDecks) {
      const deckBudget = deckBudgets[deck.id] || 0
      const deckUpgrades = await this.identifyDeckUpgrades(
        deck,
        deckBudget,
        spendingPriorities,
        valueThresholds
      )

      upgradeQueue.push(...deckUpgrades)
    }

    // Sort by priority score (impact / cost ratio)
    return upgradeQueue.sort((a, b) => b.priority - a.priority).slice(0, 20)
  }

  /**
   * Identify upgrade opportunities for a specific deck
   */
  private async identifyDeckUpgrades(
    deck: any,
    budget: number,
    priorities: string[],
    thresholds: Record<string, number>
  ): Promise<Array<{
    deckId: string
    cardId: string
    priority: number
    expectedImpact: number
  }>> {
    const upgrades: Array<{
      deckId: string
      cardId: string
      priority: number
      expectedImpact: number
    }> = []

    if (!deck.cards) return upgrades

    // Analyze each card for upgrade potential
    for (const card of deck.cards) {
      const upgradeOpportunity = await this.analyzeCardUpgradeOpportunity(
        card,
        deck,
        priorities,
        thresholds
      )

      if (upgradeOpportunity && upgradeOpportunity.cost <= budget) {
        upgrades.push({
          deckId: deck.id,
          cardId: upgradeOpportunity.targetCard,
          priority: upgradeOpportunity.impact / upgradeOpportunity.cost,
          expectedImpact: upgradeOpportunity.impact
        })
      }
    }

    return upgrades
  }

  /**
   * Analyze upgrade opportunity for a specific card
   */
  private async analyzeCardUpgradeOpportunity(
    card: any,
    deck: any,
    priorities: string[],
    thresholds: Record<string, number>
  ): Promise<{
    targetCard: string
    cost: number
    impact: number
  } | null> {
    const currentPrice = card.price || 0
    const cardType = card.cardType || 'other'
    
    // Skip if already expensive
    if (currentPrice > thresholds[cardType] * 2) {
      return null
    }

    // Calculate potential upgrade impact
    let impact = 0.5 // Base impact

    // Higher impact for priority categories
    if (priorities.includes(cardType)) {
      impact += 0.3
    }

    // Higher impact for key deck roles
    if (card.role === 'core' || card.strategicImportance > 0.7) {
      impact += 0.2
    }

    // Estimate upgrade cost (simplified)
    const upgradeCost = Math.max(thresholds[cardType] - currentPrice, 5)

    return {
      targetCard: `${card.cardId}_upgrade`, // Simplified - would be actual card ID
      cost: upgradeCost,
      impact
    }
  }

  /**
   * Optimize budget allocation based on performance
   */
  async optimizeBudgetAllocation(userId: string): Promise<{
    recommendations: Array<{
      type: 'reallocation' | 'priority_shift' | 'threshold_adjustment'
      description: string
      impact: number
      effort: number
    }>
    projectedSavings: number
    projectedImpact: number
  }> {
    const budget = await this.createPersonalizedBudget(userId)
    const recommendations: any[] = []

    // Analyze budget efficiency
    const efficiency = await this.analyzeBudgetEfficiency(userId, budget)

    // Generate optimization recommendations
    if (efficiency.underutilizedDecks.length > 0) {
      recommendations.push({
        type: 'reallocation',
        description: `Reallocate budget from underutilized decks: ${efficiency.underutilizedDecks.join(', ')}`,
        impact: 0.7,
        effort: 0.3
      })
    }

    if (efficiency.highImpactCategories.length > 0) {
      recommendations.push({
        type: 'priority_shift',
        description: `Focus spending on high-impact categories: ${efficiency.highImpactCategories.join(', ')}`,
        impact: 0.8,
        effort: 0.4
      })
    }

    if (efficiency.thresholdAdjustments.length > 0) {
      recommendations.push({
        type: 'threshold_adjustment',
        description: 'Adjust price thresholds based on actual value delivered',
        impact: 0.6,
        effort: 0.2
      })
    }

    return {
      recommendations: recommendations.sort((a, b) => (b.impact / b.effort) - (a.impact / a.effort)),
      projectedSavings: efficiency.potentialSavings,
      projectedImpact: efficiency.potentialImpact
    }
  }

  /**
   * Analyze budget efficiency
   */
  private async analyzeBudgetEfficiency(
    userId: string,
    budget: PersonalizedBudget
  ): Promise<{
    underutilizedDecks: string[]
    highImpactCategories: string[]
    thresholdAdjustments: string[]
    potentialSavings: number
    potentialImpact: number
  }> {
    // This would analyze actual spending vs. results
    // For now, return mock analysis
    return {
      underutilizedDecks: [],
      highImpactCategories: ['mana_base', 'interaction'],
      thresholdAdjustments: ['lands'],
      potentialSavings: 50,
      potentialImpact: 0.15
    }
  }

  // Helper methods

  private async getUserProfile(userId: string): Promise<UserStyleProfile> {
    const userData = await db.userLearningData.findUnique({
      where: { userId }
    })

    return userData?.styleProfile as UserStyleProfile || {
      userId,
      preferredStrategies: [],
      avoidedStrategies: [],
      complexityPreference: 'moderate',
      innovationTolerance: 0.5,
      favoriteCardTypes: [],
      preferredManaCosts: [],
      competitiveLevel: 0.5,
      budgetSensitivity: 0.5,
      collectionDependency: 0.5,
      suggestionAcceptanceRate: 0.5,
      preferenceConfidence: 0.3,
      lastUpdated: new Date()
    }
  }

  private async getUserDecks(userId: string): Promise<any[]> {
    const decks = await db.enhancedDeck.findMany({
      where: { userId },
      include: {
        cards: true
      }
    })

    return decks.map(deck => ({
      id: deck.id,
      name: deck.name,
      format: deck.format,
      strategy: deck.strategy,
      cards: deck.cards,
      powerLevel: deck.analysis?.powerLevel
    }))
  }

  private async storeBudget(budget: PersonalizedBudget): Promise<void> {
    try {
      await db.userLearningData.upsert({
        where: { userId: budget.userId },
        update: {
          crossDeckInsights: {
            personalizedBudget: budget
          },
          lastUpdated: new Date()
        },
        create: {
          id: crypto.randomUUID(),
          userId: budget.userId,
          styleProfile: {},
          deckPreferences: {},
          learningEvents: [],
          suggestionFeedback: [],
          deckRelationships: {},
          crossDeckInsights: {
            personalizedBudget: budget
          },
          lastUpdated: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to store personalized budget:', error)
    }
  }
}

export const personalizedBudgetingEngine = new PersonalizedBudgetingEngine()
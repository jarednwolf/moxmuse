import { z } from 'zod'
import { GeneratedDeck, GeneratedDeckCard, ConsultationData } from '@moxmuse/shared'
import { aiServiceOrchestrator } from '../index'

// Budget Compliance Types
export const BudgetAnalysisSchema = z.object({
  targetBudget: z.number(),
  actualBudget: z.number(),
  variance: z.number(),
  compliancePercentage: z.number().min(0).max(1),
  budgetDistribution: z.object({
    commander: z.number(),
    lands: z.number(),
    ramp: z.number(),
    draw: z.number(),
    removal: z.number(),
    winConditions: z.number(),
    synergy: z.number(),
    utility: z.number(),
  }),
  expensiveCards: z.array(z.object({
    cardId: z.string(),
    name: z.string(),
    price: z.number(),
    category: z.string(),
    percentageOfBudget: z.number(),
  })),
  budgetAlternatives: z.array(z.object({
    originalCard: z.string(),
    alternativeCard: z.string(),
    priceDifference: z.number(),
    functionalSimilarity: z.number().min(0).max(1),
    reasoning: z.string(),
  })),
  optimizationSuggestions: z.array(z.object({
    type: z.enum(['downgrade', 'upgrade', 'redistribute', 'substitute']),
    description: z.string(),
    estimatedSavings: z.number(),
    impactOnPower: z.number().min(-1).max(1),
    priority: z.enum(['low', 'medium', 'high']),
  })),
})

export type BudgetAnalysis = z.infer<typeof BudgetAnalysisSchema>

export const BudgetAdjustmentRequestSchema = z.object({
  deck: z.any(), // GeneratedDeck
  targetBudget: z.number(),
  adjustmentStrategy: z.enum(['conservative', 'balanced', 'aggressive']),
  preserveCategories: z.array(z.string()).optional(),
  allowPowerLevelChange: z.boolean().default(false),
  maxPowerLevelReduction: z.number().min(0).max(2).default(0.5),
})

export type BudgetAdjustmentRequest = z.infer<typeof BudgetAdjustmentRequestSchema>

export const BudgetAdjustmentResultSchema = z.object({
  originalBudget: z.number(),
  adjustedBudget: z.number(),
  budgetReduction: z.number(),
  powerLevelChange: z.number(),
  adjustedCards: z.array(z.object({
    action: z.enum(['replace', 'remove', 'downgrade']),
    originalCard: z.string(),
    newCard: z.string().optional(),
    priceDifference: z.number(),
    reasoning: z.string(),
  })),
  qualityImpact: z.object({
    synergyChange: z.number().min(-1).max(1),
    consistencyChange: z.number().min(-1).max(1),
    overallQualityChange: z.number().min(-1).max(1),
  }),
  success: z.boolean(),
  warnings: z.array(z.string()),
})

export type BudgetAdjustmentResult = z.infer<typeof BudgetAdjustmentResultSchema>

/**
 * Budget Compliance Service
 * Handles budget verification, analysis, and automatic adjustments for generated decks
 */
export class BudgetComplianceService {
  private priceCache: Map<string, { price: number; timestamp: Date }> = new Map()
  private budgetTemplates: Map<string, any> = new Map()
  private alternativeCards: Map<string, string[]> = new Map()

  constructor() {
    console.log('💰 Initializing Budget Compliance Service')
    this.initializeBudgetTemplates()
    this.loadAlternativeCards()
  }

  /**
   * Analyze budget compliance for a generated deck
   */
  async analyzeBudgetCompliance(
    deck: GeneratedDeck,
    targetBudget: number
  ): Promise<BudgetAnalysis> {
    console.log(`💰 Analyzing budget compliance for deck: ${deck.name}`)
    console.log(`Target budget: $${targetBudget}, Estimated budget: $${deck.estimatedBudget}`)

    try {
      // Get current prices for all cards
      const cardPrices = await this.getCardPrices(deck.cards)
      
      // Calculate actual budget
      const actualBudget = this.calculateActualBudget(deck.cards, cardPrices)
      
      // Calculate variance and compliance
      const variance = (actualBudget - targetBudget) / targetBudget
      const compliancePercentage = Math.max(0, 1 - Math.abs(variance))

      // Analyze budget distribution
      const budgetDistribution = this.analyzeBudgetDistribution(deck.cards, cardPrices)

      // Identify expensive cards
      const expensiveCards = this.identifyExpensiveCards(deck.cards, cardPrices, targetBudget)

      // Find budget alternatives
      const budgetAlternatives = await this.findBudgetAlternatives(expensiveCards, targetBudget)

      // Generate optimization suggestions
      const optimizationSuggestions = await this.generateOptimizationSuggestions(
        deck,
        cardPrices,
        targetBudget,
        actualBudget
      )

      const analysis: BudgetAnalysis = {
        targetBudget,
        actualBudget,
        variance,
        compliancePercentage,
        budgetDistribution,
        expensiveCards,
        budgetAlternatives,
        optimizationSuggestions,
      }

      console.log(`✅ Budget analysis completed. Compliance: ${(compliancePercentage * 100).toFixed(1)}%`)
      return analysis

    } catch (error) {
      console.error('❌ Budget analysis failed:', error)
      throw new Error(`Budget analysis failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Automatically adjust deck to meet budget constraints
   */
  async adjustDeckToBudget(request: BudgetAdjustmentRequest): Promise<BudgetAdjustmentResult> {
    console.log(`💰 Adjusting deck to budget: $${request.targetBudget}`)

    try {
      const { deck, targetBudget, adjustmentStrategy } = request
      
      // Get current prices
      const cardPrices = await this.getCardPrices(deck.cards)
      const originalBudget = this.calculateActualBudget(deck.cards, cardPrices)

      if (originalBudget <= targetBudget) {
        return {
          originalBudget,
          adjustedBudget: originalBudget,
          budgetReduction: 0,
          powerLevelChange: 0,
          adjustedCards: [],
          qualityImpact: {
            synergyChange: 0,
            consistencyChange: 0,
            overallQualityChange: 0,
          },
          success: true,
          warnings: [],
        }
      }

      const budgetReductionNeeded = originalBudget - targetBudget
      console.log(`Budget reduction needed: $${budgetReductionNeeded.toFixed(2)}`)

      // Identify cards to adjust based on strategy
      const adjustmentPlan = await this.createAdjustmentPlan(
        deck,
        cardPrices,
        budgetReductionNeeded,
        adjustmentStrategy,
        request.preserveCategories || []
      )

      // Execute adjustments
      const adjustedCards = await this.executeAdjustments(adjustmentPlan)
      
      // Calculate new budget and impact
      const adjustedBudget = originalBudget - adjustedCards.reduce((sum, adj) => sum + Math.abs(adj.priceDifference), 0)
      const budgetReduction = originalBudget - adjustedBudget
      
      // Estimate power level and quality impact
      const powerLevelChange = await this.estimatePowerLevelChange(adjustedCards)
      const qualityImpact = await this.estimateQualityImpact(deck, adjustedCards)

      // Check if adjustment was successful
      const success = adjustedBudget <= targetBudget * 1.05 // 5% tolerance
      const warnings = this.generateAdjustmentWarnings(adjustedCards, powerLevelChange, qualityImpact)

      const result: BudgetAdjustmentResult = {
        originalBudget,
        adjustedBudget,
        budgetReduction,
        powerLevelChange,
        adjustedCards,
        qualityImpact,
        success,
        warnings,
      }

      console.log(`✅ Budget adjustment completed. New budget: $${adjustedBudget.toFixed(2)}`)
      return result

    } catch (error) {
      console.error('❌ Budget adjustment failed:', error)
      throw new Error(`Budget adjustment failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Verify budget compliance and suggest improvements
   */
  async verifyBudgetCompliance(
    deck: GeneratedDeck,
    consultationData: ConsultationData
  ): Promise<{
    isCompliant: boolean
    analysis: BudgetAnalysis
    recommendations: string[]
  }> {
    const targetBudget = consultationData.budget || deck.estimatedBudget
    const analysis = await this.analyzeBudgetCompliance(deck, targetBudget)
    
    const isCompliant = analysis.compliancePercentage >= 0.9 // 90% compliance threshold
    const recommendations = this.generateComplianceRecommendations(analysis)

    return {
      isCompliant,
      analysis,
      recommendations,
    }
  }

  /**
   * Get real-time card prices
   */
  private async getCardPrices(cards: GeneratedDeckCard[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>()
    
    for (const card of cards) {
      const price = await this.getCardPrice(card.cardId)
      prices.set(card.cardId, price)
    }

    return prices
  }

  /**
   * Get price for a single card with caching
   */
  private async getCardPrice(cardId: string): Promise<number> {
    // Check cache first
    const cached = this.priceCache.get(cardId)
    if (cached && Date.now() - cached.timestamp.getTime() < 3600000) { // 1 hour cache
      return cached.price
    }

    try {
      // Mock price fetching - would use real price API
      const price = this.mockCardPrice(cardId)
      
      // Cache the price
      this.priceCache.set(cardId, {
        price,
        timestamp: new Date(),
      })

      return price
    } catch (error) {
      console.warn(`Failed to get price for ${cardId}:`, error)
      return 1.0 // Default price
    }
  }

  /**
   * Mock card price - would use real price data
   */
  private mockCardPrice(cardId: string): number {
    // Generate consistent mock prices based on card ID
    const hash = cardId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const basePrice = (hash % 100) / 10 // 0-10 base price
    
    // Add some variation based on card name patterns
    if (cardId.toLowerCase().includes('mox') || cardId.toLowerCase().includes('lotus')) {
      return basePrice * 50 + 100 // Expensive cards
    }
    if (cardId.toLowerCase().includes('basic') || cardId.toLowerCase().includes('land')) {
      return Math.max(0.25, basePrice * 0.5) // Cheap lands
    }
    
    return Math.max(0.5, basePrice * 2) // Regular cards
  }

  /**
   * Calculate actual budget from card prices
   */
  private calculateActualBudget(cards: GeneratedDeckCard[], prices: Map<string, number>): number {
    return cards.reduce((total, card) => {
      const price = prices.get(card.cardId) || 1.0
      return total + (price * card.quantity)
    }, 0)
  }

  /**
   * Analyze how budget is distributed across categories
   */
  private analyzeBudgetDistribution(
    cards: GeneratedDeckCard[],
    prices: Map<string, number>
  ): any {
    const distribution = {
      commander: 0,
      lands: 0,
      ramp: 0,
      draw: 0,
      removal: 0,
      winConditions: 0,
      synergy: 0,
      utility: 0,
    }

    for (const card of cards) {
      const price = prices.get(card.cardId) || 1.0
      const cost = price * card.quantity

      switch (card.category) {
        case 'commander':
          distribution.commander += cost
          break
        case 'lands':
          distribution.lands += cost
          break
        case 'ramp':
          distribution.ramp += cost
          break
        case 'draw':
        case 'card_advantage':
          distribution.draw += cost
          break
        case 'removal':
        case 'interaction':
        case 'board_wipes':
          distribution.removal += cost
          break
        case 'win_conditions':
        case 'finishers':
          distribution.winConditions += cost
          break
        case 'synergy':
        case 'engine':
          distribution.synergy += cost
          break
        default:
          distribution.utility += cost
      }
    }

    return distribution
  }

  /**
   * Identify cards that are expensive relative to budget
   */
  private identifyExpensiveCards(
    cards: GeneratedDeckCard[],
    prices: Map<string, number>,
    targetBudget: number
  ): any[] {
    const expensiveThreshold = targetBudget * 0.05 // 5% of budget
    
    return cards
      .map(card => {
        const price = prices.get(card.cardId) || 1.0
        return {
          cardId: card.cardId,
          name: card.cardId, // Simplified
          price,
          category: card.category,
          percentageOfBudget: price / targetBudget,
        }
      })
      .filter(card => card.price > expensiveThreshold)
      .sort((a, b) => b.price - a.price)
  }

  /**
   * Find budget-friendly alternatives for expensive cards
   */
  private async findBudgetAlternatives(expensiveCards: any[], targetBudget: number): Promise<any[]> {
    const alternatives: any[] = []

    for (const card of expensiveCards.slice(0, 10)) { // Limit to top 10 expensive cards
      try {
        // Use AI to find alternatives
        const alternativeSearch = await aiServiceOrchestrator.executeAITask({
          taskType: 'budget-alternative-search',
          prompt: `Find budget-friendly alternatives for ${card.name} that cost less than $${(card.price * 0.5).toFixed(2)} but provide similar functionality.`,
          variables: {
            originalCard: card.name,
            maxPrice: card.price * 0.5,
            category: card.category,
            targetBudget,
          },
        })

        // Mock alternative - would parse AI response
        const alternativeCard = this.findCachedAlternative(card.cardId) || `Budget ${card.name}`
        const alternativePrice = card.price * 0.3 // 30% of original price

        alternatives.push({
          originalCard: card.name,
          alternativeCard,
          priceDifference: card.price - alternativePrice,
          functionalSimilarity: 0.8, // Mock similarity score
          reasoning: `Budget alternative that provides similar functionality at lower cost`,
        })

      } catch (error) {
        console.warn(`Failed to find alternative for ${card.name}:`, error)
      }
    }

    return alternatives
  }

  /**
   * Generate optimization suggestions
   */
  private async generateOptimizationSuggestions(
    deck: GeneratedDeck,
    prices: Map<string, number>,
    targetBudget: number,
    actualBudget: number
  ): Promise<any[]> {
    const suggestions: any[] = []
    const overBudget = actualBudget > targetBudget
    const budgetDifference = Math.abs(actualBudget - targetBudget)

    if (overBudget) {
      // Suggest downgrades for expensive cards
      const expensiveCards = deck.cards
        .filter(card => {
          const price = prices.get(card.cardId) || 1.0
          return price > targetBudget * 0.1 // More than 10% of budget
        })
        .sort((a, b) => {
          const priceA = prices.get(a.cardId) || 1.0
          const priceB = prices.get(b.cardId) || 1.0
          return priceB - priceA
        })

      for (const card of expensiveCards.slice(0, 3)) {
        const price = prices.get(card.cardId) || 1.0
        suggestions.push({
          type: 'downgrade' as const,
          description: `Consider replacing ${card.cardId} with a budget alternative`,
          estimatedSavings: price * 0.7,
          impactOnPower: -0.1,
          priority: price > targetBudget * 0.15 ? 'high' as const : 'medium' as const,
        })
      }

      // Suggest redistribution
      if (budgetDifference > targetBudget * 0.2) {
        suggestions.push({
          type: 'redistribute' as const,
          description: 'Redistribute budget from expensive categories to essential ones',
          estimatedSavings: budgetDifference * 0.5,
          impactOnPower: -0.05,
          priority: 'medium' as const,
        })
      }
    } else {
      // Under budget - suggest upgrades
      const budgetRemaining = targetBudget - actualBudget
      
      if (budgetRemaining > targetBudget * 0.1) {
        suggestions.push({
          type: 'upgrade' as const,
          description: 'Consider upgrading key cards with remaining budget',
          estimatedSavings: -budgetRemaining * 0.8,
          impactOnPower: 0.2,
          priority: 'low' as const,
        })
      }
    }

    return suggestions
  }

  /**
   * Create adjustment plan based on strategy
   */
  private async createAdjustmentPlan(
    deck: GeneratedDeck,
    prices: Map<string, number>,
    budgetReductionNeeded: number,
    strategy: string,
    preserveCategories: string[]
  ): Promise<any[]> {
    const plan: any[] = []
    let remainingReduction = budgetReductionNeeded

    // Sort cards by price (descending) and filter out preserved categories
    const adjustableCards = deck.cards
      .filter(card => !preserveCategories.includes(card.category))
      .map(card => ({
        ...card,
        price: prices.get(card.cardId) || 1.0,
      }))
      .sort((a, b) => b.price - a.price)

    // Apply strategy-specific adjustments
    switch (strategy) {
      case 'aggressive':
        // Replace most expensive cards first
        for (const card of adjustableCards) {
          if (remainingReduction <= 0) break
          
          const savings = card.price * 0.7 // Assume 70% savings from replacement
          if (savings >= remainingReduction * 0.1) { // Worth at least 10% of needed reduction
            plan.push({
              action: 'replace',
              card,
              expectedSavings: savings,
              priority: 'high',
            })
            remainingReduction -= savings
          }
        }
        break

      case 'balanced':
        // Mix of replacements and removals
        const expensiveCards = adjustableCards.slice(0, Math.ceil(adjustableCards.length * 0.3))
        for (const card of expensiveCards) {
          if (remainingReduction <= 0) break
          
          const savings = card.price * 0.5 // More conservative savings
          plan.push({
            action: 'replace',
            card,
            expectedSavings: savings,
            priority: 'medium',
          })
          remainingReduction -= savings
        }
        break

      case 'conservative':
        // Only replace the most expensive non-essential cards
        const nonEssentialCards = adjustableCards.filter(card => 
          card.category !== 'lands' && 
          card.category !== 'ramp' && 
          card.category !== 'draw'
        )
        
        for (const card of nonEssentialCards.slice(0, 5)) {
          if (remainingReduction <= 0) break
          
          const savings = card.price * 0.3 // Very conservative savings
          plan.push({
            action: 'replace',
            card,
            expectedSavings: savings,
            priority: 'low',
          })
          remainingReduction -= savings
        }
        break
    }

    return plan
  }

  /**
   * Execute the adjustment plan
   */
  private async executeAdjustments(plan: any[]): Promise<any[]> {
    const adjustedCards: any[] = []

    for (const adjustment of plan) {
      try {
        const alternative = await this.findAlternativeCard(adjustment.card, adjustment.expectedSavings)
        
        adjustedCards.push({
          action: adjustment.action,
          originalCard: adjustment.card.cardId,
          newCard: alternative.cardId,
          priceDifference: adjustment.card.price - alternative.price,
          reasoning: `Budget optimization: replaced with functionally similar but less expensive alternative`,
        })

      } catch (error) {
        console.warn(`Failed to execute adjustment for ${adjustment.card.cardId}:`, error)
      }
    }

    return adjustedCards
  }

  /**
   * Find alternative card for budget adjustment
   */
  private async findAlternativeCard(originalCard: any, maxPrice: number): Promise<any> {
    // Mock alternative finding - would use real card database and AI
    const alternativePrice = Math.min(maxPrice, originalCard.price * 0.4)
    
    return {
      cardId: `budget_${originalCard.cardId}`,
      price: alternativePrice,
      category: originalCard.category,
      functionalSimilarity: 0.75,
    }
  }

  /**
   * Estimate power level change from adjustments
   */
  private async estimatePowerLevelChange(adjustedCards: any[]): Promise<number> {
    // Simple estimation - would use more sophisticated analysis
    const majorReplacements = adjustedCards.filter(adj => adj.priceDifference > 20).length
    const minorReplacements = adjustedCards.length - majorReplacements
    
    return -(majorReplacements * 0.1 + minorReplacements * 0.05)
  }

  /**
   * Estimate quality impact from adjustments
   */
  private async estimateQualityImpact(deck: GeneratedDeck, adjustedCards: any[]): Promise<any> {
    // Mock quality impact estimation
    const impactFactor = adjustedCards.length / deck.cards.length
    
    return {
      synergyChange: -impactFactor * 0.1,
      consistencyChange: -impactFactor * 0.05,
      overallQualityChange: -impactFactor * 0.08,
    }
  }

  /**
   * Generate warnings for budget adjustments
   */
  private generateAdjustmentWarnings(
    adjustedCards: any[],
    powerLevelChange: number,
    qualityImpact: any
  ): string[] {
    const warnings: string[] = []

    if (powerLevelChange < -0.3) {
      warnings.push('Significant power level reduction due to budget constraints')
    }

    if (qualityImpact.synergyChange < -0.2) {
      warnings.push('Deck synergies may be affected by budget adjustments')
    }

    if (adjustedCards.length > 10) {
      warnings.push('Large number of card changes may affect deck coherence')
    }

    return warnings
  }

  /**
   * Generate compliance recommendations
   */
  private generateComplianceRecommendations(analysis: BudgetAnalysis): string[] {
    const recommendations: string[] = []

    if (analysis.variance > 0.1) {
      recommendations.push('Consider replacing expensive cards with budget alternatives')
    }

    if (analysis.expensiveCards.length > 5) {
      recommendations.push('Redistribute budget more evenly across card categories')
    }

    if (analysis.budgetDistribution.lands > analysis.targetBudget * 0.4) {
      recommendations.push('Land base may be too expensive - consider budget land alternatives')
    }

    for (const suggestion of analysis.optimizationSuggestions) {
      if (suggestion.priority === 'high') {
        recommendations.push(suggestion.description)
      }
    }

    return recommendations
  }

  /**
   * Find cached alternative card
   */
  private findCachedAlternative(cardId: string): string | null {
    const alternatives = this.alternativeCards.get(cardId)
    return alternatives ? alternatives[0] : null
  }

  /**
   * Initialize budget templates for different strategies
   */
  private initializeBudgetTemplates(): void {
    this.budgetTemplates.set('budget', {
      maxCardPrice: 10,
      landBudgetRatio: 0.25,
      commanderBudgetRatio: 0.15,
      priorityCategories: ['ramp', 'draw', 'removal'],
    })

    this.budgetTemplates.set('mid-range', {
      maxCardPrice: 25,
      landBudgetRatio: 0.35,
      commanderBudgetRatio: 0.20,
      priorityCategories: ['synergy', 'win_conditions'],
    })

    this.budgetTemplates.set('high-end', {
      maxCardPrice: 100,
      landBudgetRatio: 0.45,
      commanderBudgetRatio: 0.25,
      priorityCategories: ['optimization', 'consistency'],
    })

    console.log('✅ Initialized budget templates')
  }

  /**
   * Load alternative card mappings
   */
  private loadAlternativeCards(): void {
    // Mock alternative card mappings - would load from database
    this.alternativeCards.set('expensive_card_1', ['budget_alternative_1', 'budget_alternative_2'])
    this.alternativeCards.set('expensive_card_2', ['budget_alternative_3', 'budget_alternative_4'])
    
    console.log('✅ Loaded alternative card mappings')
  }

  /**
   * Get budget template for strategy
   */
  getBudgetTemplate(strategy: string): any {
    return this.budgetTemplates.get(strategy) || this.budgetTemplates.get('mid-range')
  }

  /**
   * Clear price cache
   */
  clearPriceCache(): void {
    this.priceCache.clear()
    console.log('🗑️ Price cache cleared')
  }

  /**
   * Get price cache statistics
   */
  getPriceCacheStats(): { size: number; oldestEntry: Date | null } {
    const entries = Array.from(this.priceCache.values())
    const oldestEntry = entries.length > 0 
      ? entries.reduce((oldest, entry) => entry.timestamp < oldest ? entry.timestamp : oldest, entries[0].timestamp)
      : null

    return {
      size: this.priceCache.size,
      oldestEntry,
    }
  }
}

// Export singleton instance
export const budgetComplianceService = new BudgetComplianceService()
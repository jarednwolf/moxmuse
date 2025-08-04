import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { redisCache } from '../redis'
import { PriceTrackingService } from '../price-tracking'
import { MetaAnalysisService } from '../meta-analysis'
import { ProactiveSuggestionsService } from './proactive-suggestions'

interface DeckPortfolio {
  userId: string
  decks: PortfolioDeck[]
  totalValue: number
  sharedCards: SharedCardAnalysis[]
  budgetAllocation: BudgetAllocation
  optimizationOpportunities: OptimizationOpportunity[]
  diversityScore: number
  lastOptimized: Date
}

interface PortfolioDeck {
  deckId: string
  name: string
  format: string
  strategy: string
  powerLevel: number
  value: number
  playFrequency: 'high' | 'medium' | 'low'
  lastPlayed?: Date
  priority: 'primary' | 'secondary' | 'experimental'
  cards: PortfolioDeckCard[]
}

interface PortfolioDeckCard {
  cardId: string
  cardName: string
  quantity: number
  category: string
  value: number
  sharedWith: string[] // Other deck IDs that use this card
  uniqueness: number // How unique this card is to this deck (0-1)
}

interface SharedCardAnalysis {
  cardId: string
  cardName: string
  totalQuantityNeeded: number
  currentQuantityOwned: number
  usedInDecks: string[]
  value: number
  priority: 'high' | 'medium' | 'low'
  recommendation: 'buy_more' | 'proxy' | 'rotate' | 'sufficient'
}

interface BudgetAllocation {
  totalBudget: number
  allocations: {
    deckId: string
    deckName: string
    currentValue: number
    recommendedBudget: number
    priority: number
    reasoning: string
  }[]
  sharedCardsBudget: number
  emergencyFund: number
}

interface OptimizationOpportunity {
  type: 'card_sharing' | 'budget_reallocation' | 'deck_consolidation' | 'strategy_diversification'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  estimatedSavings?: number
  estimatedImpact: number
  actions: OptimizationAction[]
  affectedDecks: string[]
}

interface OptimizationAction {
  type: 'move_card' | 'buy_card' | 'sell_card' | 'proxy_card' | 'merge_decks' | 'split_deck'
  cardId?: string
  cardName?: string
  fromDeckId?: string
  toDeckId?: string
  quantity?: number
  reasoning: string
  estimatedCost?: number
  estimatedSavings?: number
}

interface DeckSynergy {
  deck1Id: string
  deck2Id: string
  sharedCards: number
  synergyScore: number
  consolidationPotential: number
  recommendations: string[]
}

interface PortfolioMetrics {
  totalDecks: number
  totalCards: number
  totalValue: number
  averageDeckValue: number
  strategyDiversity: number
  powerLevelSpread: number
  sharedCardEfficiency: number
  budgetUtilization: number
}

export class MultiDeckOptimizerService {
  private readonly CACHE_TTL = 60 * 60 * 2 // 2 hours
  private readonly MAX_DECKS_PER_USER = 50
  
  constructor(
    private prisma: PrismaClient,
    private priceService: PriceTrackingService,
    private metaService: MetaAnalysisService,
    private suggestionsService: ProactiveSuggestionsService
  ) {}

  /**
   * Optimize all decks for a user
   */
  async optimizeUserDecks(
    userId: string,
    budget?: number,
    preferences?: {
      prioritizeSharedCards?: boolean
      allowDeckConsolidation?: boolean
      maxProxyPercentage?: number
    }
  ): Promise<DeckPortfolio> {
    try {
      const cacheKey = `portfolio:${userId}:${budget || 'unlimited'}`
      const cached = await redisCache.get<DeckPortfolio>(cacheKey)
      if (cached && this.isCacheValid(cached.lastOptimized)) {
        return cached
      }

      // Get all user decks
      const userDecks = await this.getUserDecks(userId)
      if (userDecks.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No decks found for user'
        })
      }

      // Build portfolio analysis
      const portfolioDecks = await this.buildPortfolioDecks(userDecks)
      const sharedCards = await this.analyzeSharedCards(portfolioDecks)
      const totalValue = this.calculateTotalValue(portfolioDecks)
      
      // Generate budget allocation
      const budgetAllocation = await this.generateBudgetAllocation(
        portfolioDecks,
        budget,
        preferences
      )

      // Find optimization opportunities
      const optimizationOpportunities = await this.findOptimizationOpportunities(
        portfolioDecks,
        sharedCards,
        budgetAllocation,
        preferences
      )

      // Calculate diversity score
      const diversityScore = this.calculateDiversityScore(portfolioDecks)

      const portfolio: DeckPortfolio = {
        userId,
        decks: portfolioDecks,
        totalValue,
        sharedCards,
        budgetAllocation,
        optimizationOpportunities,
        diversityScore,
        lastOptimized: new Date()
      }

      // Cache the result
      await redisCache.set(cacheKey, portfolio, this.CACHE_TTL)

      return portfolio
    } catch (error) {
      console.error(`Error optimizing decks for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Analyze shared cards across decks
   */
  private async analyzeSharedCards(decks: PortfolioDeck[]): Promise<SharedCardAnalysis[]> {
    const cardUsage = new Map<string, {
      name: string
      decks: string[]
      totalQuantity: number
      value: number
    }>()

    // Collect card usage across all decks
    for (const deck of decks) {
      for (const card of deck.cards) {
        const existing = cardUsage.get(card.cardId)
        if (existing) {
          existing.decks.push(deck.deckId)
          existing.totalQuantity += card.quantity
        } else {
          cardUsage.set(card.cardId, {
            name: card.cardName,
            decks: [deck.deckId],
            totalQuantity: card.quantity,
            value: card.value
          })
        }
      }
    }

    // Analyze shared cards
    const sharedCards: SharedCardAnalysis[] = []
    
    for (const [cardId, usage] of cardUsage) {
      if (usage.decks.length > 1) { // Only shared cards
        // Get user's collection to determine owned quantity
        const ownedQuantity = await this.getUserCardQuantity(cardId, decks[0]?.deckId)
        
        let recommendation: SharedCardAnalysis['recommendation'] = 'sufficient'
        let priority: SharedCardAnalysis['priority'] = 'low'

        if (ownedQuantity < usage.totalQuantity) {
          const shortage = usage.totalQuantity - ownedQuantity
          if (usage.value > 20) {
            recommendation = shortage > 2 ? 'proxy' : 'buy_more'
            priority = 'high'
          } else {
            recommendation = 'buy_more'
            priority = 'medium'
          }
        } else if (ownedQuantity > usage.totalQuantity) {
          recommendation = 'rotate'
          priority = 'low'
        }

        sharedCards.push({
          cardId,
          cardName: usage.name,
          totalQuantityNeeded: usage.totalQuantity,
          currentQuantityOwned: ownedQuantity,
          usedInDecks: usage.decks,
          value: usage.value,
          priority,
          recommendation
        })
      }
    }

    return sharedCards.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * Generate budget allocation recommendations
   */
  private async generateBudgetAllocation(
    decks: PortfolioDeck[],
    totalBudget?: number,
    preferences?: any
  ): Promise<BudgetAllocation> {
    if (!totalBudget) {
      totalBudget = 1000 // Default budget
    }

    const allocations = []
    const totalCurrentValue = decks.reduce((sum, deck) => sum + deck.value, 0)
    
    // Reserve budget for shared cards and emergency fund
    const sharedCardsBudget = totalBudget * 0.2 // 20% for shared cards
    const emergencyFund = totalBudget * 0.1 // 10% emergency fund
    const decksBudget = totalBudget - sharedCardsBudget - emergencyFund

    // Calculate priority scores for each deck
    const deckPriorities = decks.map(deck => ({
      deckId: deck.deckId,
      score: this.calculateDeckPriority(deck)
    }))

    const totalPriorityScore = deckPriorities.reduce((sum, p) => sum + p.score, 0)

    // Allocate budget based on priority
    for (const deck of decks) {
      const priority = deckPriorities.find(p => p.deckId === deck.deckId)?.score || 1
      const priorityRatio = priority / totalPriorityScore
      const recommendedBudget = decksBudget * priorityRatio

      let reasoning = `Allocated ${(priorityRatio * 100).toFixed(1)}% of deck budget based on `
      
      if (deck.priority === 'primary') reasoning += 'primary deck status'
      else if (deck.playFrequency === 'high') reasoning += 'high play frequency'
      else if (deck.powerLevel > 7) reasoning += 'competitive power level'
      else reasoning += 'balanced allocation'

      allocations.push({
        deckId: deck.deckId,
        deckName: deck.name,
        currentValue: deck.value,
        recommendedBudget,
        priority: priority,
        reasoning
      })
    }

    return {
      totalBudget,
      allocations,
      sharedCardsBudget,
      emergencyFund
    }
  }

  /**
   * Find optimization opportunities across the portfolio
   */
  private async findOptimizationOpportunities(
    decks: PortfolioDeck[],
    sharedCards: SharedCardAnalysis[],
    budgetAllocation: BudgetAllocation,
    preferences?: any
  ): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = []

    // Card sharing opportunities
    const cardSharingOps = await this.findCardSharingOpportunities(decks, sharedCards)
    opportunities.push(...cardSharingOps)

    // Budget reallocation opportunities
    const budgetOps = await this.findBudgetReallocationOpportunities(decks, budgetAllocation)
    opportunities.push(...budgetOps)

    // Deck consolidation opportunities
    if (preferences?.allowDeckConsolidation) {
      const consolidationOps = await this.findDeckConsolidationOpportunities(decks)
      opportunities.push(...consolidationOps)
    }

    // Strategy diversification opportunities
    const diversificationOps = await this.findStrategyDiversificationOpportunities(decks)
    opportunities.push(...diversificationOps)

    return opportunities.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return b.estimatedImpact - a.estimatedImpact
    })
  }

  /**
   * Find card sharing optimization opportunities
   */
  private async findCardSharingOpportunities(
    decks: PortfolioDeck[],
    sharedCards: SharedCardAnalysis[]
  ): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = []

    // High-value cards that could be shared
    const expensiveSharedCards = sharedCards.filter(card => 
      card.value > 50 && card.recommendation === 'buy_more'
    )

    for (const card of expensiveSharedCards) {
      const shortage = card.totalQuantityNeeded - card.currentQuantityOwned
      const estimatedSavings = card.value * shortage * 0.7 // 70% savings from proxying

      opportunities.push({
        type: 'card_sharing',
        priority: 'high',
        title: `Optimize ${card.cardName} Sharing`,
        description: `${card.cardName} is used in ${card.usedInDecks.length} decks but you only own ${card.currentQuantityOwned}/${card.totalQuantityNeeded}`,
        estimatedSavings,
        estimatedImpact: 0.8,
        actions: [{
          type: 'proxy_card',
          cardId: card.cardId,
          cardName: card.cardName,
          quantity: shortage,
          reasoning: `Proxy ${shortage} copies to avoid buying expensive duplicates`,
          estimatedSavings
        }],
        affectedDecks: card.usedInDecks
      })
    }

    return opportunities
  }

  /**
   * Find budget reallocation opportunities
   */
  private async findBudgetReallocationOpportunities(
    decks: PortfolioDeck[],
    budgetAllocation: BudgetAllocation
  ): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = []

    // Find decks that are over/under budget
    for (const allocation of budgetAllocation.allocations) {
      const deck = decks.find(d => d.deckId === allocation.deckId)
      if (!deck) continue

      const budgetDifference = allocation.currentValue - allocation.recommendedBudget
      
      if (Math.abs(budgetDifference) > allocation.recommendedBudget * 0.2) { // 20% threshold
        const isOverBudget = budgetDifference > 0

        opportunities.push({
          type: 'budget_reallocation',
          priority: 'medium',
          title: `${isOverBudget ? 'Reduce' : 'Increase'} Budget for ${deck.name}`,
          description: `${deck.name} is ${isOverBudget ? 'over' : 'under'} its recommended budget by $${Math.abs(budgetDifference).toFixed(2)}`,
          estimatedSavings: isOverBudget ? Math.abs(budgetDifference) : undefined,
          estimatedImpact: 0.6,
          actions: [{
            type: isOverBudget ? 'sell_card' : 'buy_card',
            reasoning: `${isOverBudget ? 'Sell expensive cards' : 'Invest in upgrades'} to align with recommended budget`,
            estimatedCost: isOverBudget ? undefined : Math.abs(budgetDifference),
            estimatedSavings: isOverBudget ? Math.abs(budgetDifference) : undefined
          }],
          affectedDecks: [deck.deckId]
        })
      }
    }

    return opportunities
  }

  /**
   * Find deck consolidation opportunities
   */
  private async findDeckConsolidationOpportunities(
    decks: PortfolioDeck[]
  ): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = []

    // Find decks with high synergy that could be consolidated
    for (let i = 0; i < decks.length; i++) {
      for (let j = i + 1; j < decks.length; j++) {
        const synergy = await this.calculateDeckSynergy(decks[i], decks[j])
        
        if (synergy.consolidationPotential > 0.7) {
          const estimatedSavings = Math.min(decks[i].value, decks[j].value) * 0.5

          opportunities.push({
            type: 'deck_consolidation',
            priority: 'low',
            title: `Consider Consolidating ${decks[i].name} and ${decks[j].name}`,
            description: `These decks share ${synergy.sharedCards} cards and have similar strategies`,
            estimatedSavings,
            estimatedImpact: 0.4,
            actions: [{
              type: 'merge_decks',
              fromDeckId: decks[j].deckId,
              toDeckId: decks[i].deckId,
              reasoning: `High card overlap (${synergy.sharedCards} shared cards) suggests consolidation potential`,
              estimatedSavings
            }],
            affectedDecks: [decks[i].deckId, decks[j].deckId]
          })
        }
      }
    }

    return opportunities
  }

  /**
   * Find strategy diversification opportunities
   */
  private async findStrategyDiversificationOpportunities(
    decks: PortfolioDeck[]
  ): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = []

    // Analyze strategy distribution
    const strategies = new Map<string, number>()
    decks.forEach(deck => {
      strategies.set(deck.strategy, (strategies.get(deck.strategy) || 0) + 1)
    })

    // Find over-represented strategies
    const totalDecks = decks.length
    for (const [strategy, count] of strategies) {
      if (count > totalDecks * 0.4) { // More than 40% of decks
        opportunities.push({
          type: 'strategy_diversification',
          priority: 'low',
          title: `Diversify Away from ${strategy} Strategy`,
          description: `${count}/${totalDecks} decks use ${strategy} strategy - consider diversifying`,
          estimatedImpact: 0.3,
          actions: [{
            type: 'split_deck',
            reasoning: `High concentration in ${strategy} strategy reduces portfolio diversity`,
          }],
          affectedDecks: decks.filter(d => d.strategy === strategy).map(d => d.deckId)
        })
      }
    }

    return opportunities
  }

  /**
   * Helper methods
   */
  private async getUserDecks(userId: string): Promise<any[]> {
    return await this.prisma.deck.findMany({
      where: { userId },
      include: {
        cards: {
          include: {
            card: true
          }
        }
      },
      take: this.MAX_DECKS_PER_USER
    })
  }

  private async buildPortfolioDecks(userDecks: any[]): Promise<PortfolioDeck[]> {
    const portfolioDecks: PortfolioDeck[] = []

    for (const deck of userDecks) {
      const cards: PortfolioDeckCard[] = []
      let totalValue = 0

      // Get price data for all cards
      const cardIds = deck.cards.map((c: any) => c.cardId)
      const priceData = await this.priceService.getCardPrices(cardIds)

      for (const deckCard of deck.cards) {
        const price = priceData.get(deckCard.cardId)
        const cardValue = (price?.currentPrice || 0) * deckCard.quantity
        totalValue += cardValue

        cards.push({
          cardId: deckCard.cardId,
          cardName: deckCard.card?.name || 'Unknown',
          quantity: deckCard.quantity,
          category: deckCard.category || 'other',
          value: cardValue,
          sharedWith: [], // Will be populated later
          uniqueness: 1 // Will be calculated later
        })
      }

      portfolioDecks.push({
        deckId: deck.id,
        name: deck.name,
        format: deck.format || 'commander',
        strategy: this.inferDeckStrategy(deck),
        powerLevel: this.estimatePowerLevel(deck),
        value: totalValue,
        playFrequency: this.inferPlayFrequency(deck),
        priority: this.inferDeckPriority(deck),
        cards
      })
    }

    // Calculate card sharing and uniqueness
    this.calculateCardSharing(portfolioDecks)

    return portfolioDecks
  }

  private calculateCardSharing(decks: PortfolioDeck[]): void {
    const cardToDeckMap = new Map<string, string[]>()

    // Build card to deck mapping
    for (const deck of decks) {
      for (const card of deck.cards) {
        const existing = cardToDeckMap.get(card.cardId) || []
        existing.push(deck.deckId)
        cardToDeckMap.set(card.cardId, existing)
      }
    }

    // Update shared information
    for (const deck of decks) {
      for (const card of deck.cards) {
        const sharedDecks = cardToDeckMap.get(card.cardId) || []
        card.sharedWith = sharedDecks.filter(id => id !== deck.deckId)
        card.uniqueness = 1 / sharedDecks.length
      }
    }
  }

  private calculateTotalValue(decks: PortfolioDeck[]): number {
    return decks.reduce((sum, deck) => sum + deck.value, 0)
  }

  private calculateDiversityScore(decks: PortfolioDeck[]): number {
    if (decks.length === 0) return 0

    // Calculate strategy diversity
    const strategies = new Set(decks.map(d => d.strategy))
    const strategyDiversity = strategies.size / decks.length

    // Calculate power level spread
    const powerLevels = decks.map(d => d.powerLevel)
    const avgPowerLevel = powerLevels.reduce((sum, p) => sum + p, 0) / powerLevels.length
    const powerLevelVariance = powerLevels.reduce((sum, p) => sum + Math.pow(p - avgPowerLevel, 2), 0) / powerLevels.length
    const powerLevelDiversity = Math.min(1, powerLevelVariance / 4) // Normalize to 0-1

    // Calculate format diversity
    const formats = new Set(decks.map(d => d.format))
    const formatDiversity = formats.size / decks.length

    // Weighted average
    return (strategyDiversity * 0.5) + (powerLevelDiversity * 0.3) + (formatDiversity * 0.2)
  }

  private calculateDeckPriority(deck: PortfolioDeck): number {
    let score = 1

    // Priority multiplier
    if (deck.priority === 'primary') score *= 2
    else if (deck.priority === 'secondary') score *= 1.5

    // Play frequency multiplier
    if (deck.playFrequency === 'high') score *= 1.8
    else if (deck.playFrequency === 'medium') score *= 1.3

    // Power level bonus
    if (deck.powerLevel > 7) score *= 1.2

    return score
  }

  private async calculateDeckSynergy(deck1: PortfolioDeck, deck2: PortfolioDeck): Promise<DeckSynergy> {
    const deck1Cards = new Set(deck1.cards.map(c => c.cardId))
    const deck2Cards = new Set(deck2.cards.map(c => c.cardId))
    
    const sharedCards = Array.from(deck1Cards).filter(cardId => deck2Cards.has(cardId)).length
    const totalUniqueCards = new Set([...deck1Cards, ...deck2Cards]).size
    
    const synergyScore = sharedCards / totalUniqueCards
    const consolidationPotential = (sharedCards / Math.min(deck1Cards.size, deck2Cards.size))

    return {
      deck1Id: deck1.deckId,
      deck2Id: deck2.deckId,
      sharedCards,
      synergyScore,
      consolidationPotential,
      recommendations: []
    }
  }

  private async getUserCardQuantity(cardId: string, deckId: string): Promise<number> {
    // This would integrate with collection service
    // For now, assume user owns 1 copy of each card
    return 1
  }

  private inferDeckStrategy(deck: any): string {
    // Simple strategy inference based on cards
    const creatureCount = deck.cards.filter((c: any) => 
      c.card?.type_line?.includes('Creature')
    ).length

    if (creatureCount > 30) return 'Aggro'
    if (creatureCount < 15) return 'Control'
    return 'Midrange'
  }

  private estimatePowerLevel(deck: any): number {
    // Simple power level estimation (1-10)
    const avgCmc = deck.cards.reduce((sum: number, c: any) => 
      sum + (c.card?.cmc || 0), 0
    ) / deck.cards.length

    let powerLevel = 5
    if (avgCmc < 3) powerLevel += 1
    if (avgCmc > 4) powerLevel -= 1

    return Math.max(1, Math.min(10, powerLevel))
  }

  private inferPlayFrequency(deck: any): 'high' | 'medium' | 'low' {
    // This would be based on actual play data
    // For now, return medium as default
    return 'medium'
  }

  private inferDeckPriority(deck: any): 'primary' | 'secondary' | 'experimental' {
    // This would be based on user preferences or deck metadata
    // For now, return secondary as default
    return 'secondary'
  }

  private isCacheValid(lastOptimized: Date): boolean {
    const now = new Date()
    const diffHours = (now.getTime() - lastOptimized.getTime()) / (1000 * 60 * 60)
    return diffHours < 2 // Cache valid for 2 hours
  }

  /**
   * Get portfolio metrics for analytics
   */
  async getPortfolioMetrics(userId: string): Promise<PortfolioMetrics> {
    try {
      const portfolio = await this.optimizeUserDecks(userId)
      
      const totalCards = portfolio.decks.reduce((sum, deck) => 
        sum + deck.cards.reduce((cardSum, card) => cardSum + card.quantity, 0), 0
      )

      const averageDeckValue = portfolio.totalValue / portfolio.decks.length

      const powerLevels = portfolio.decks.map(d => d.powerLevel)
      const avgPowerLevel = powerLevels.reduce((sum, p) => sum + p, 0) / powerLevels.length
      const powerLevelSpread = Math.sqrt(
        powerLevels.reduce((sum, p) => sum + Math.pow(p - avgPowerLevel, 2), 0) / powerLevels.length
      )

      const sharedCardEfficiency = portfolio.sharedCards.length > 0 
        ? portfolio.sharedCards.filter(c => c.recommendation === 'sufficient').length / portfolio.sharedCards.length
        : 1

      return {
        totalDecks: portfolio.decks.length,
        totalCards,
        totalValue: portfolio.totalValue,
        averageDeckValue,
        strategyDiversity: portfolio.diversityScore,
        powerLevelSpread,
        sharedCardEfficiency,
        budgetUtilization: 0.8 // Placeholder
      }
    } catch (error) {
      console.error(`Error calculating portfolio metrics for ${userId}:`, error)
      throw error
    }
  }
}
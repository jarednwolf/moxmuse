import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { PriceTrackingService } from './price-tracking'
import { scryfallService } from './scryfall'
import { redisCache } from './redis'

interface MarketAnalysis {
  totalValue: number
  valueDistribution: ValueDistribution
  priceVolatility: number
  budgetOptimization: BudgetOptimization[]
  upgradeTargets: UpgradeTarget[]
  budgetAlternatives: BudgetAlternative[]
  reprints: ReprintAlert[]
  lastUpdated: Date
}

interface ValueDistribution {
  budget: number // Cards under $5
  midRange: number // Cards $5-$25
  expensive: number // Cards $25-$100
  premium: number // Cards over $100
}

interface BudgetOptimization {
  category: 'lands' | 'ramp' | 'draw' | 'removal' | 'threats' | 'utility'
  currentSpend: number
  recommendedSpend: number
  savings: number
  suggestions: OptimizationSuggestion[]
}

interface OptimizationSuggestion {
  action: 'replace' | 'remove' | 'downgrade'
  cardId: string
  cardName: string
  currentPrice: number
  alternativeId?: string
  alternativeName?: string
  alternativePrice?: number
  reasoning: string
  impactScore: number // 1-10, how much this affects deck performance
}

interface UpgradeTarget {
  cardId: string
  cardName: string
  currentPrice: number
  category: string
  priority: 'high' | 'medium' | 'low'
  impactScore: number
  priceEfficiency: number // Performance gain per dollar
  reasoning: string
  alternatives: UpgradeAlternative[]
}

interface UpgradeAlternative {
  cardId: string
  cardName: string
  price: number
  impactScore: number
  priceEfficiency: number
}

interface BudgetAlternative {
  originalCardId: string
  originalName: string
  originalPrice: number
  alternativeId: string
  alternativeName: string
  alternativePrice: number
  savings: number
  performanceLoss: number // 0-1, where 0 is no loss
  category: string
}

interface ReprintAlert {
  cardId: string
  cardName: string
  originalPrice: number
  newPrice: number
  priceDropPercent: number
  reprintSet: string
  alertDate: Date
}

interface DeckMarketIntelligence {
  deckId: string
  totalValue: number
  ownedValue: number
  missingValue: number
  budgetBreakdown: {
    lands: number
    ramp: number
    draw: number
    removal: number
    threats: number
    utility: number
  }
  upgradeRecommendations: UpgradeTarget[]
  budgetOptimizations: BudgetOptimization[]
  priceAlerts: PriceAlert[]
}

interface PriceAlert {
  cardId: string
  cardName: string
  currentPrice: number
  targetPrice: number
  condition: 'below' | 'above'
  reasoning: string
}

export class MarketAnalysisService {
  private readonly CACHE_TTL = 60 * 30 // 30 minutes
  
  constructor(
    private prisma: PrismaClient,
    private priceService: PriceTrackingService
  ) {}

  /**
   * Analyze market conditions for a deck
   */
  async analyzeDeckMarket(
    deckId: string,
    userId: string,
    budget?: number
  ): Promise<DeckMarketIntelligence> {
    try {
      // Check cache first
      const cacheKey = `market:deck:${deckId}:${budget || 'unlimited'}`
      const cached = await redisCache.get<DeckMarketIntelligence>(cacheKey)
      if (cached) return cached

      // Get deck data
      const deck = await this.prisma.deck.findUnique({
        where: { id: deckId },
        include: {
          cards: true
        }
      })

      if (!deck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deck not found'
        })
      }

      // Get user's collection to determine owned cards
      const collection = await this.getUserCollection(userId)
      
      // Get price data for all cards
      const cardIds = deck.cards.map(c => c.cardId)
      const priceData = await this.priceService.getCardPrices(cardIds)

      // Calculate values
      let totalValue = 0
      let ownedValue = 0
      let missingValue = 0
      const budgetBreakdown = {
        lands: 0,
        ramp: 0,
        draw: 0,
        removal: 0,
        threats: 0,
        utility: 0
      }

      for (const deckCard of deck.cards) {
        const price = priceData.get(deckCard.cardId)
        if (!price) continue

        const cardValue = price.currentPrice * deckCard.quantity
        totalValue += cardValue

        // Check if owned
        const ownedQuantity = collection.get(deckCard.cardId) || 0
        const ownedCardValue = Math.min(ownedQuantity, deckCard.quantity) * price.currentPrice
        ownedValue += ownedCardValue
        missingValue += cardValue - ownedCardValue

        // Categorize spending
        const category = this.categorizeCard(deckCard.cardId, deckCard.category || 'utility')
        budgetBreakdown[category] += cardValue
      }

      // Generate upgrade recommendations
      const upgradeRecommendations = await this.generateUpgradeRecommendations(
        deck.cards,
        priceData,
        collection,
        budget
      )

      // Generate budget optimizations
      const budgetOptimizations = await this.generateBudgetOptimizations(
        deck.cards,
        priceData,
        budget
      )

      // Generate price alerts
      const priceAlerts = await this.generatePriceAlerts(
        deck.cards,
        priceData,
        collection
      )

      const result: DeckMarketIntelligence = {
        deckId,
        totalValue,
        ownedValue,
        missingValue,
        budgetBreakdown,
        upgradeRecommendations,
        budgetOptimizations,
        priceAlerts
      }

      // Cache the result
      await redisCache.set(cacheKey, result, this.CACHE_TTL)

      return result
    } catch (error) {
      console.error(`Error analyzing deck market for ${deckId}:`, error)
      throw error
    }
  }

  /**
   * Generate upgrade recommendations based on price efficiency
   */
  private async generateUpgradeRecommendations(
    deckCards: any[],
    priceData: Map<string, any>,
    collection: Map<string, number>,
    budget?: number
  ): Promise<UpgradeTarget[]> {
    const recommendations: UpgradeTarget[] = []

    for (const deckCard of deckCards) {
      const price = priceData.get(deckCard.cardId)
      if (!price) continue

      // Skip if already owned
      const ownedQuantity = collection.get(deckCard.cardId) || 0
      if (ownedQuantity >= deckCard.quantity) continue

      // Skip expensive cards if budget is limited
      if (budget && price.currentPrice > budget * 0.2) continue

      // Get card data for analysis
      const card = await scryfallService.getCard(deckCard.cardId)
      if (!card) continue

      // Calculate upgrade priority based on various factors
      const impactScore = this.calculateImpactScore(card, deckCard.category)
      const priceEfficiency = impactScore / price.currentPrice
      
      let priority: 'high' | 'medium' | 'low' = 'medium'
      if (priceEfficiency > 0.5) priority = 'high'
      else if (priceEfficiency < 0.2) priority = 'low'

      // Find alternatives
      const alternatives = await this.findUpgradeAlternatives(
        card,
        deckCard.category,
        price.currentPrice
      )

      recommendations.push({
        cardId: deckCard.cardId,
        cardName: card.name,
        currentPrice: price.currentPrice,
        category: deckCard.category,
        priority,
        impactScore,
        priceEfficiency,
        reasoning: this.generateUpgradeReasoning(card, impactScore, priceEfficiency),
        alternatives
      })
    }

    // Sort by priority and price efficiency
    return recommendations
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
        if (priorityDiff !== 0) return priorityDiff
        return b.priceEfficiency - a.priceEfficiency
      })
      .slice(0, 10) // Top 10 recommendations
  }

  /**
   * Generate budget optimization suggestions
   */
  private async generateBudgetOptimizations(
    deckCards: any[],
    priceData: Map<string, any>,
    budget?: number
  ): Promise<BudgetOptimization[]> {
    if (!budget) return []

    const optimizations: BudgetOptimization[] = []
    const categories = ['lands', 'ramp', 'draw', 'removal', 'threats', 'utility'] as const

    for (const category of categories) {
      const categoryCards = deckCards.filter(c => 
        this.categorizeCard(c.cardId, c.category) === category
      )

      if (categoryCards.length === 0) continue

      let currentSpend = 0
      const suggestions: OptimizationSuggestion[] = []

      for (const deckCard of categoryCards) {
        const price = priceData.get(deckCard.cardId)
        if (!price) continue

        currentSpend += price.currentPrice * deckCard.quantity

        // Find cheaper alternatives for expensive cards
        if (price.currentPrice > 10) {
          const alternatives = await this.findBudgetAlternatives(
            deckCard.cardId,
            category,
            price.currentPrice * 0.5 // Target 50% price reduction
          )

          for (const alt of alternatives) {
            suggestions.push({
              action: 'replace',
              cardId: deckCard.cardId,
              cardName: alt.originalName,
              currentPrice: price.currentPrice,
              alternativeId: alt.alternativeId,
              alternativeName: alt.alternativeName,
              alternativePrice: alt.alternativePrice,
              reasoning: `Save $${(price.currentPrice - alt.alternativePrice).toFixed(2)} with minimal performance loss`,
              impactScore: Math.max(1, 10 - alt.performanceLoss * 10)
            })
          }
        }
      }

      // Calculate recommended spend (based on deck strategy and budget)
      const recommendedSpend = this.calculateRecommendedSpend(category, budget)
      const savings = Math.max(0, currentSpend - recommendedSpend)

      if (suggestions.length > 0) {
        optimizations.push({
          category,
          currentSpend,
          recommendedSpend,
          savings,
          suggestions: suggestions.slice(0, 3) // Top 3 suggestions per category
        })
      }
    }

    return optimizations
  }

  /**
   * Generate price alerts for cards user might want to buy
   */
  private async generatePriceAlerts(
    deckCards: any[],
    priceData: Map<string, any>,
    collection: Map<string, number>
  ): Promise<PriceAlert[]> {
    const alerts: PriceAlert[] = []

    for (const deckCard of deckCards) {
      const price = priceData.get(deckCard.cardId)
      if (!price) continue

      // Skip if already owned
      const ownedQuantity = collection.get(deckCard.cardId) || 0
      if (ownedQuantity >= deckCard.quantity) continue

      // Only alert for cards with rising trends or high volatility
      if (price.trend === 'rising' || price.volatility > 0.3) {
        const card = await scryfallService.getCard(deckCard.cardId)
        if (!card) continue

        // Set target price based on trend
        let targetPrice = price.currentPrice
        let reasoning = ''

        if (price.trend === 'rising') {
          targetPrice = price.currentPrice * 0.9 // Alert if drops 10%
          reasoning = 'Price is rising - consider buying if it drops'
        } else if (price.volatility > 0.3) {
          targetPrice = price.currentPrice * 0.8 // Alert if drops 20%
          reasoning = 'High price volatility - wait for a dip'
        }

        alerts.push({
          cardId: deckCard.cardId,
          cardName: card.name,
          currentPrice: price.currentPrice,
          targetPrice,
          condition: 'below',
          reasoning
        })
      }
    }

    return alerts.slice(0, 5) // Top 5 alerts
  }

  /**
   * Helper methods
   */
  private async getUserCollection(userId: string): Promise<Map<string, number>> {
    // This would integrate with CollectionProxyService
    // For now, return empty collection
    return new Map()
  }

  private categorizeCard(cardId: string, category: string): keyof DeckMarketIntelligence['budgetBreakdown'] {
    // Simple categorization based on category string
    const lowerCategory = category.toLowerCase()
    
    if (lowerCategory.includes('land')) return 'lands'
    if (lowerCategory.includes('ramp') || lowerCategory.includes('mana')) return 'ramp'
    if (lowerCategory.includes('draw') || lowerCategory.includes('card advantage')) return 'draw'
    if (lowerCategory.includes('removal') || lowerCategory.includes('interaction')) return 'removal'
    if (lowerCategory.includes('threat') || lowerCategory.includes('win') || lowerCategory.includes('creature')) return 'threats'
    
    return 'utility'
  }

  private calculateImpactScore(card: any, category: string): number {
    // Simple impact scoring based on card characteristics
    let score = 5 // Base score

    // EDHREC rank bonus (lower rank = higher impact)
    if (card.edhrec_rank) {
      if (card.edhrec_rank < 1000) score += 3
      else if (card.edhrec_rank < 5000) score += 2
      else if (card.edhrec_rank < 10000) score += 1
    }

    // Rarity bonus
    if (card.rarity === 'mythic') score += 2
    else if (card.rarity === 'rare') score += 1

    // Category-specific bonuses
    if (category.toLowerCase().includes('commander')) score += 3
    if (category.toLowerCase().includes('win')) score += 2

    return Math.min(10, Math.max(1, score))
  }

  private generateUpgradeReasoning(card: any, impactScore: number, priceEfficiency: number): string {
    if (priceEfficiency > 0.5) {
      return `High impact card with excellent price efficiency. Strong upgrade candidate.`
    } else if (impactScore >= 8) {
      return `Very impactful card that significantly improves deck performance.`
    } else if (priceEfficiency > 0.3) {
      return `Good value upgrade that provides solid performance improvement.`
    } else {
      return `Moderate upgrade that fills an important role in the deck.`
    }
  }

  private async findUpgradeAlternatives(
    card: any,
    category: string,
    maxPrice: number
  ): Promise<UpgradeAlternative[]> {
    // This would use AI or database queries to find similar cards
    // For now, return empty array
    return []
  }

  private async findBudgetAlternatives(
    cardId: string,
    category: string,
    targetPrice: number
  ): Promise<BudgetAlternative[]> {
    // This would use AI or database queries to find cheaper alternatives
    // For now, return empty array
    return []
  }

  private calculateRecommendedSpend(
    category: keyof DeckMarketIntelligence['budgetBreakdown'],
    totalBudget: number
  ): number {
    // Recommended budget allocation percentages
    const allocations = {
      lands: 0.35, // 35% for mana base
      ramp: 0.15,  // 15% for ramp
      draw: 0.15,  // 15% for card draw
      removal: 0.15, // 15% for removal
      threats: 0.15, // 15% for threats
      utility: 0.05   // 5% for utility
    }

    return totalBudget * allocations[category]
  }
}
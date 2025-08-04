import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { redisCache } from '../redis'
import { MetaAnalysisService } from '../meta-analysis'
import { PriceTrackingService } from '../price-tracking'
import { SetMonitorService } from './set-monitor'

interface ProactiveSuggestion {
  id: string
  deckId: string
  type: 'meta_adaptation' | 'price_opportunity' | 'new_card' | 'synergy_improvement' | 'budget_optimization'
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  reasoning: string
  confidence: number
  impact: 'high' | 'medium' | 'low'
  timeframe: 'immediate' | 'short_term' | 'long_term'
  actions: SuggestionAction[]
  metadata: Record<string, any>
  createdAt: Date
  expiresAt?: Date
}

interface SuggestionAction {
  type: 'add_card' | 'remove_card' | 'replace_card' | 'adjust_quantity' | 'monitor_price'
  cardId: string
  cardName: string
  quantity?: number
  targetCardId?: string // For replacements
  targetCardName?: string
  reasoning: string
  estimatedCost?: number
}

interface SuggestionContext {
  userId: string
  deckId: string
  userPreferences: UserPreferences
  deckAnalysis: any
  metaData: any
  priceData: Map<string, any>
  recentChanges: DeckChange[]
}

interface UserPreferences {
  budgetSensitivity: 'low' | 'medium' | 'high'
  metaAwareness: 'casual' | 'competitive' | 'tournament'
  innovationTolerance: 'conservative' | 'moderate' | 'experimental'
  suggestionFrequency: 'minimal' | 'regular' | 'frequent'
  preferredCategories: string[]
  avoidedCards: string[]
}

interface DeckChange {
  cardId: string
  action: 'added' | 'removed' | 'quantity_changed'
  timestamp: Date
  reason?: string
}

interface MetaShift {
  archetype: string
  changeType: 'rising' | 'declining' | 'new_threat' | 'strategy_shift'
  magnitude: number
  confidence: number
  timeframe: 'recent' | 'emerging' | 'established'
}

export class ProactiveSuggestionsService {
  private readonly CACHE_TTL = 60 * 30 // 30 minutes
  private readonly SUGGESTION_LIMIT = 10 // Max suggestions per deck
  
  constructor(
    private prisma: PrismaClient,
    private metaService: MetaAnalysisService,
    private priceService: PriceTrackingService,
    private setMonitor: SetMonitorService
  ) {}

  /**
   * Generate proactive suggestions for a specific deck
   */
  async generateProactiveSuggestions(
    deckId: string,
    userId: string
  ): Promise<ProactiveSuggestion[]> {
    try {
      const cacheKey = `suggestions:${deckId}:${userId}`
      const cached = await redisCache.get<ProactiveSuggestion[]>(cacheKey)
      if (cached) return cached

      // Build context for suggestion generation
      const context = await this.buildSuggestionContext(deckId, userId)
      if (!context) return []

      // Generate different types of suggestions
      const suggestions: ProactiveSuggestion[] = []

      // Meta adaptation suggestions
      const metaSuggestions = await this.generateMetaAdaptationSuggestions(context)
      suggestions.push(...metaSuggestions)

      // Price opportunity suggestions
      const priceSuggestions = await this.generatePriceOpportunitySuggestions(context)
      suggestions.push(...priceSuggestions)

      // New card suggestions
      const newCardSuggestions = await this.generateNewCardSuggestions(context)
      suggestions.push(...newCardSuggestions)

      // Synergy improvement suggestions
      const synergySuggestions = await this.generateSynergyImprovementSuggestions(context)
      suggestions.push(...synergySuggestions)

      // Budget optimization suggestions
      const budgetSuggestions = await this.generateBudgetOptimizationSuggestions(context)
      suggestions.push(...budgetSuggestions)

      // Sort by priority and confidence
      const sortedSuggestions = this.prioritizeSuggestions(suggestions, context)
      const finalSuggestions = sortedSuggestions.slice(0, this.SUGGESTION_LIMIT)

      // Cache the results
      await redisCache.set(cacheKey, finalSuggestions, this.CACHE_TTL)

      // Store suggestions in database for tracking
      await this.storeSuggestions(finalSuggestions)

      return finalSuggestions
    } catch (error) {
      console.error(`Error generating proactive suggestions for deck ${deckId}:`, error)
      return []
    }
  }

  /**
   * Generate suggestions based on meta changes
   */
  private async generateMetaAdaptationSuggestions(
    context: SuggestionContext
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = []

    try {
      // Get current meta analysis
      const metaAnalysis = await this.metaService.analyzeDeckMeta(context.deckId)
      if (!metaAnalysis) return suggestions

      // Detect meta shifts
      const metaShifts = await this.detectMetaShifts(context)

      for (const shift of metaShifts) {
        const suggestion = await this.createMetaAdaptationSuggestion(shift, context)
        if (suggestion) {
          suggestions.push(suggestion)
        }
      }

      // Check for unfavorable matchups that have become more popular
      for (const matchup of metaAnalysis.unfavorableMatchups) {
        if (this.isArchetypeRising(matchup.opponentArchetype, metaShifts)) {
          const suggestion = await this.createMatchupCounterSuggestion(matchup, context)
          if (suggestion) {
            suggestions.push(suggestion)
          }
        }
      }

      return suggestions
    } catch (error) {
      console.error('Error generating meta adaptation suggestions:', error)
      return suggestions
    }
  }

  /**
   * Generate suggestions based on price opportunities
   */
  private async generatePriceOpportunitySuggestions(
    context: SuggestionContext
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = []

    try {
      // Only generate price suggestions for budget-conscious users
      if (context.userPreferences.budgetSensitivity === 'low') {
        return suggestions
      }

      // Get deck cards and their price data
      const deck = await this.getDeckWithCards(context.deckId)
      if (!deck) return suggestions

      for (const deckCard of deck.cards) {
        const priceData = context.priceData.get(deckCard.cardId)
        if (!priceData) continue

        // Check for price drop opportunities
        if (priceData.trend === 'falling' && priceData.volatility > 0.2) {
          const suggestion = await this.createPriceDropSuggestion(deckCard, priceData, context)
          if (suggestion) {
            suggestions.push(suggestion)
          }
        }

        // Check for reprint alerts
        const reprintAlerts = await this.priceService.detectReprintAlerts()
        const relevantReprints = reprintAlerts.filter(alert => 
          deck.cards.some(c => c.cardId === alert.cardId)
        )

        for (const reprint of relevantReprints) {
          const suggestion = await this.createReprintOpportunitySuggestion(reprint, context)
          if (suggestion) {
            suggestions.push(suggestion)
          }
        }
      }

      return suggestions
    } catch (error) {
      console.error('Error generating price opportunity suggestions:', error)
      return suggestions
    }
  }

  /**
   * Generate suggestions for new cards from recent sets
   */
  private async generateNewCardSuggestions(
    context: SuggestionContext
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = []

    try {
      // Get recent set analyses
      const setAnalyses = await this.setMonitor.monitorNewSets()
      
      for (const setAnalysis of setAnalyses) {
        // Find cards relevant to this deck
        const relevantCards = setAnalysis.relevantCards.filter(card =>
          card.relevantDecks.some(deck => deck.deckId === context.deckId)
        )

        for (const card of relevantCards) {
          const deckRelevance = card.relevantDecks.find(d => d.deckId === context.deckId)
          if (!deckRelevance) continue

          const suggestion = await this.createNewCardSuggestion(card, deckRelevance, setAnalysis, context)
          if (suggestion) {
            suggestions.push(suggestion)
          }
        }
      }

      return suggestions
    } catch (error) {
      console.error('Error generating new card suggestions:', error)
      return suggestions
    }
  }

  /**
   * Generate suggestions to improve deck synergies
   */
  private async generateSynergyImprovementSuggestions(
    context: SuggestionContext
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = []

    try {
      // Analyze current deck synergies
      const synergyAnalysis = await this.analyzeDeckSynergies(context.deckId)
      
      // Find weak synergy areas
      const weakAreas = synergyAnalysis.categories.filter(cat => cat.strength < 0.6)
      
      for (const area of weakAreas) {
        const suggestion = await this.createSynergyImprovementSuggestion(area, context)
        if (suggestion) {
          suggestions.push(suggestion)
        }
      }

      // Find missed synergy opportunities
      const missedOpportunities = await this.findMissedSynergyOpportunities(context)
      
      for (const opportunity of missedOpportunities) {
        const suggestion = await this.createMissedSynergySuggestion(opportunity, context)
        if (suggestion) {
          suggestions.push(suggestion)
        }
      }

      return suggestions
    } catch (error) {
      console.error('Error generating synergy improvement suggestions:', error)
      return suggestions
    }
  }

  /**
   * Generate budget optimization suggestions
   */
  private async generateBudgetOptimizationSuggestions(
    context: SuggestionContext
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = []

    try {
      // Only for budget-conscious users
      if (context.userPreferences.budgetSensitivity === 'low') {
        return suggestions
      }

      const deck = await this.getDeckWithCards(context.deckId)
      if (!deck) return suggestions

      // Find expensive cards with cheaper alternatives
      const expensiveCards = deck.cards.filter(card => {
        const priceData = context.priceData.get(card.cardId)
        return priceData && priceData.currentPrice > 20
      })

      for (const expensiveCard of expensiveCards) {
        const alternatives = await this.findBudgetAlternatives(expensiveCard, context)
        
        for (const alternative of alternatives) {
          const suggestion = await this.createBudgetOptimizationSuggestion(
            expensiveCard,
            alternative,
            context
          )
          if (suggestion) {
            suggestions.push(suggestion)
          }
        }
      }

      return suggestions
    } catch (error) {
      console.error('Error generating budget optimization suggestions:', error)
      return suggestions
    }
  }

  /**
   * Build context needed for suggestion generation
   */
  private async buildSuggestionContext(
    deckId: string,
    userId: string
  ): Promise<SuggestionContext | null> {
    try {
      // Get user preferences
      const userPreferences = await this.getUserPreferences(userId)
      
      // Get deck analysis
      const deckAnalysis = await this.getDeckAnalysis(deckId)
      
      // Get meta data
      const metaData = await this.metaService.analyzeDeckMeta(deckId)
      
      // Get price data for deck cards
      const deck = await this.getDeckWithCards(deckId)
      if (!deck) return null
      
      const cardIds = deck.cards.map(c => c.cardId)
      const priceData = await this.priceService.getCardPrices(cardIds)
      
      // Get recent deck changes
      const recentChanges = await this.getRecentDeckChanges(deckId)

      return {
        userId,
        deckId,
        userPreferences,
        deckAnalysis,
        metaData,
        priceData,
        recentChanges
      }
    } catch (error) {
      console.error('Error building suggestion context:', error)
      return null
    }
  }

  /**
   * Helper methods for creating specific suggestion types
   */
  private async createMetaAdaptationSuggestion(
    shift: MetaShift,
    context: SuggestionContext
  ): Promise<ProactiveSuggestion | null> {
    try {
      const actions: SuggestionAction[] = []
      
      // Find cards to counter the meta shift
      const counterCards = await this.findMetaCounterCards(shift, context)
      
      for (const card of counterCards.slice(0, 3)) {
        actions.push({
          type: 'add_card',
          cardId: card.id,
          cardName: card.name,
          quantity: 1,
          reasoning: `Counters rising ${shift.archetype} archetype`,
          estimatedCost: card.price
        })
      }

      if (actions.length === 0) return null

      return {
        id: `meta_${context.deckId}_${shift.archetype}_${Date.now()}`,
        deckId: context.deckId,
        type: 'meta_adaptation',
        priority: shift.magnitude > 0.7 ? 'high' : 'medium',
        title: `Adapt to Rising ${shift.archetype} Meta`,
        description: `The ${shift.archetype} archetype is ${shift.changeType} in the meta`,
        reasoning: `Meta analysis shows ${shift.archetype} has increased by ${(shift.magnitude * 100).toFixed(1)}% in recent tournaments`,
        confidence: shift.confidence,
        impact: shift.magnitude > 0.7 ? 'high' : 'medium',
        timeframe: 'short_term',
        actions,
        metadata: { shift },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    } catch (error) {
      console.error('Error creating meta adaptation suggestion:', error)
      return null
    }
  }

  private async createPriceDropSuggestion(
    deckCard: any,
    priceData: any,
    context: SuggestionContext
  ): Promise<ProactiveSuggestion | null> {
    try {
      const actions: SuggestionAction[] = [{
        type: 'monitor_price',
        cardId: deckCard.cardId,
        cardName: deckCard.card.name,
        reasoning: `Price has dropped ${(priceData.volatility * 100).toFixed(1)}% recently`,
        estimatedCost: priceData.currentPrice
      }]

      return {
        id: `price_${context.deckId}_${deckCard.cardId}_${Date.now()}`,
        deckId: context.deckId,
        type: 'price_opportunity',
        priority: 'medium',
        title: `Price Drop Opportunity: ${deckCard.card.name}`,
        description: `${deckCard.card.name} has seen a significant price drop`,
        reasoning: `Price has fallen ${(priceData.volatility * 100).toFixed(1)}% with high volatility, suggesting a good buying opportunity`,
        confidence: 0.7,
        impact: 'medium',
        timeframe: 'immediate',
        actions,
        metadata: { priceData },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
      }
    } catch (error) {
      console.error('Error creating price drop suggestion:', error)
      return null
    }
  }

  private async createNewCardSuggestion(
    card: any,
    deckRelevance: any,
    setAnalysis: any,
    context: SuggestionContext
  ): Promise<ProactiveSuggestion | null> {
    try {
      const actions: SuggestionAction[] = []

      if (deckRelevance.suggestedAction === 'add') {
        actions.push({
          type: 'add_card',
          cardId: card.cardId,
          cardName: card.cardName,
          quantity: 1,
          reasoning: deckRelevance.reasoning
        })
      } else if (deckRelevance.suggestedAction === 'replace' && deckRelevance.targetCard) {
        actions.push({
          type: 'replace_card',
          cardId: card.cardId,
          cardName: card.cardName,
          targetCardId: deckRelevance.targetCard,
          reasoning: deckRelevance.reasoning
        })
      }

      if (actions.length === 0) return null

      return {
        id: `newcard_${context.deckId}_${card.cardId}_${Date.now()}`,
        deckId: context.deckId,
        type: 'new_card',
        priority: card.impactScore > 0.8 ? 'high' : 'medium',
        title: `New Card from ${setAnalysis.setName}: ${card.cardName}`,
        description: `${card.cardName} from ${setAnalysis.setName} shows strong synergy with your deck`,
        reasoning: card.reasoning,
        confidence: deckRelevance.relevanceScore,
        impact: card.impactScore > 0.8 ? 'high' : 'medium',
        timeframe: 'short_term',
        actions,
        metadata: { card, setAnalysis },
        createdAt: new Date()
      }
    } catch (error) {
      console.error('Error creating new card suggestion:', error)
      return null
    }
  }

  /**
   * Utility methods
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    // Default preferences - would be stored in database
    return {
      budgetSensitivity: 'medium',
      metaAwareness: 'competitive',
      innovationTolerance: 'moderate',
      suggestionFrequency: 'regular',
      preferredCategories: [],
      avoidedCards: []
    }
  }

  private async getDeckAnalysis(deckId: string): Promise<any> {
    // Get or create deck analysis
    return {}
  }

  private async getDeckWithCards(deckId: string): Promise<any> {
    return await this.prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          include: {
            card: true
          }
        }
      }
    })
  }

  private async getRecentDeckChanges(deckId: string): Promise<DeckChange[]> {
    // Get recent changes from audit log
    return []
  }

  private async detectMetaShifts(context: SuggestionContext): Promise<MetaShift[]> {
    // Simplified meta shift detection
    return [
      {
        archetype: 'Simic Value',
        changeType: 'rising',
        magnitude: 0.8,
        confidence: 0.9,
        timeframe: 'recent'
      }
    ]
  }

  private isArchetypeRising(archetype: string, shifts: MetaShift[]): boolean {
    return shifts.some(shift => 
      shift.archetype === archetype && shift.changeType === 'rising'
    )
  }

  private async createMatchupCounterSuggestion(
    matchup: any,
    context: SuggestionContext
  ): Promise<ProactiveSuggestion | null> {
    // Create suggestion to counter unfavorable matchup
    return null
  }

  private async createReprintOpportunitySuggestion(
    reprint: any,
    context: SuggestionContext
  ): Promise<ProactiveSuggestion | null> {
    // Create suggestion for reprint opportunity
    return null
  }

  private async analyzeDeckSynergies(deckId: string): Promise<any> {
    // Analyze deck synergies
    return {
      categories: [
        { name: 'Artifact Synergy', strength: 0.4 },
        { name: 'Creature Synergy', strength: 0.8 }
      ]
    }
  }

  private async createSynergyImprovementSuggestion(
    area: any,
    context: SuggestionContext
  ): Promise<ProactiveSuggestion | null> {
    // Create synergy improvement suggestion
    return null
  }

  private async findMissedSynergyOpportunities(context: SuggestionContext): Promise<any[]> {
    // Find missed synergy opportunities
    return []
  }

  private async createMissedSynergySuggestion(
    opportunity: any,
    context: SuggestionContext
  ): Promise<ProactiveSuggestion | null> {
    // Create missed synergy suggestion
    return null
  }

  private async findBudgetAlternatives(expensiveCard: any, context: SuggestionContext): Promise<any[]> {
    // Find budget alternatives
    return []
  }

  private async createBudgetOptimizationSuggestion(
    expensiveCard: any,
    alternative: any,
    context: SuggestionContext
  ): Promise<ProactiveSuggestion | null> {
    // Create budget optimization suggestion
    return null
  }

  private async findMetaCounterCards(shift: MetaShift, context: SuggestionContext): Promise<any[]> {
    // Find cards that counter the meta shift
    return []
  }

  private prioritizeSuggestions(
    suggestions: ProactiveSuggestion[],
    context: SuggestionContext
  ): ProactiveSuggestion[] {
    return suggestions.sort((a, b) => {
      // Priority order
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff

      // Confidence score
      const confidenceDiff = b.confidence - a.confidence
      if (confidenceDiff !== 0) return confidenceDiff

      // Impact score
      const impactOrder = { high: 3, medium: 2, low: 1 }
      return impactOrder[b.impact] - impactOrder[a.impact]
    })
  }

  private async storeSuggestions(suggestions: ProactiveSuggestion[]): Promise<void> {
    // Store suggestions in database for tracking
    try {
      for (const suggestion of suggestions) {
        await this.prisma.deckSuggestion.upsert({
          where: { id: suggestion.id },
          update: {
            priority: suggestion.priority,
            confidence: suggestion.confidence,
            updatedAt: new Date()
          },
          create: {
            id: suggestion.id,
            deckId: suggestion.deckId,
            type: suggestion.type,
            priority: suggestion.priority,
            title: suggestion.title,
            description: suggestion.description,
            reasoning: suggestion.reasoning,
            confidence: suggestion.confidence,
            impact: suggestion.impact,
            timeframe: suggestion.timeframe,
            actions: suggestion.actions,
            metadata: suggestion.metadata,
            expiresAt: suggestion.expiresAt
          }
        })
      }
    } catch (error) {
      console.error('Error storing suggestions:', error)
    }
  }
}
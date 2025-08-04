import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { redisCache } from '../redis'
import { scryfallService } from '../scryfall'
import { MetaAnalysisService } from '../meta-analysis'
import { PriceTrackingService } from '../price-tracking'

interface SetRelease {
  setCode: string
  setName: string
  releaseDate: Date
  cardCount: number
  isDigital: boolean
  setType: 'core' | 'expansion' | 'masters' | 'commander' | 'supplemental'
}

interface NewCardAnalysis {
  cardId: string
  cardName: string
  setCode: string
  relevantDecks: DeckRelevance[]
  impactScore: number
  recommendationType: 'upgrade' | 'replacement' | 'synergy' | 'sideboard'
  reasoning: string
  priceImpact: 'positive' | 'negative' | 'neutral'
  metaImpact: 'high' | 'medium' | 'low'
}

interface DeckRelevance {
  deckId: string
  deckName: string
  relevanceScore: number
  suggestedAction: 'add' | 'replace' | 'consider' | 'monitor'
  targetCard?: string // Card to replace if action is 'replace'
  reasoning: string
}

interface SetImpactAnalysis {
  setCode: string
  setName: string
  releaseDate: Date
  totalNewCards: number
  relevantCards: NewCardAnalysis[]
  affectedDecks: string[]
  overallMetaImpact: 'revolutionary' | 'significant' | 'moderate' | 'minimal'
  priceImpacts: PriceImpact[]
  recommendations: SetRecommendation[]
}

interface PriceImpact {
  cardId: string
  cardName: string
  impactType: 'reprint' | 'power_creep' | 'meta_shift'
  expectedPriceChange: number
  confidence: number
}

interface SetRecommendation {
  type: 'immediate_action' | 'monitor' | 'prepare_budget'
  priority: 'high' | 'medium' | 'low'
  message: string
  affectedDecks: string[]
  timeframe: 'immediate' | 'short_term' | 'long_term'
}

export class SetMonitorService {
  private readonly CACHE_TTL = 60 * 60 * 24 // 24 hours
  private readonly SET_CHECK_INTERVAL = 60 * 60 * 6 // Check every 6 hours
  
  constructor(
    private prisma: PrismaClient,
    private metaService: MetaAnalysisService,
    private priceService: PriceTrackingService
  ) {}

  /**
   * Monitor for new set releases and analyze impact
   */
  async monitorNewSets(): Promise<SetImpactAnalysis[]> {
    try {
      // Get recent and upcoming sets
      const recentSets = await this.getRecentSets()
      const analyses: SetImpactAnalysis[] = []

      for (const set of recentSets) {
        const analysis = await this.analyzeSetImpact(set)
        if (analysis) {
          analyses.push(analysis)
        }
      }

      return analyses
    } catch (error) {
      console.error('Error monitoring new sets:', error)
      throw error
    }
  }

  /**
   * Analyze impact of a specific set on user decks
   */
  async analyzeSetImpact(set: SetRelease): Promise<SetImpactAnalysis | null> {
    try {
      const cacheKey = `set:analysis:${set.setCode}`
      const cached = await redisCache.get<SetImpactAnalysis>(cacheKey)
      if (cached) return cached

      // Get all cards from the set
      const setCards = await this.getSetCards(set.setCode)
      if (setCards.length === 0) return null

      // Analyze each card for relevance to existing decks
      const relevantCards: NewCardAnalysis[] = []
      const affectedDecks = new Set<string>()

      for (const card of setCards) {
        const analysis = await this.analyzeNewCard(card, set.setCode)
        if (analysis && analysis.relevantDecks.length > 0) {
          relevantCards.push(analysis)
          analysis.relevantDecks.forEach(deck => affectedDecks.add(deck.deckId))
        }
      }

      // Calculate overall meta impact
      const overallMetaImpact = this.calculateOverallMetaImpact(relevantCards)

      // Analyze price impacts
      const priceImpacts = await this.analyzePriceImpacts(setCards, set.setCode)

      // Generate recommendations
      const recommendations = this.generateSetRecommendations(
        relevantCards,
        priceImpacts,
        Array.from(affectedDecks)
      )

      const analysis: SetImpactAnalysis = {
        setCode: set.setCode,
        setName: set.setName,
        releaseDate: set.releaseDate,
        totalNewCards: setCards.length,
        relevantCards,
        affectedDecks: Array.from(affectedDecks),
        overallMetaImpact,
        priceImpacts,
        recommendations
      }

      // Cache the analysis
      await redisCache.set(cacheKey, analysis, this.CACHE_TTL)

      return analysis
    } catch (error) {
      console.error(`Error analyzing set impact for ${set.setCode}:`, error)
      return null
    }
  }

  /**
   * Analyze a new card for relevance to existing decks
   */
  private async analyzeNewCard(card: any, setCode: string): Promise<NewCardAnalysis | null> {
    try {
      // Get all user decks that might be relevant
      const potentialDecks = await this.findPotentiallyRelevantDecks(card)
      if (potentialDecks.length === 0) return null

      const relevantDecks: DeckRelevance[] = []

      for (const deck of potentialDecks) {
        const relevance = await this.calculateDeckRelevance(card, deck)
        if (relevance && relevance.relevanceScore > 0.3) {
          relevantDecks.push(relevance)
        }
      }

      if (relevantDecks.length === 0) return null

      // Calculate overall impact score
      const impactScore = this.calculateCardImpactScore(card, relevantDecks)

      // Determine recommendation type
      const recommendationType = this.determineRecommendationType(card, relevantDecks)

      // Analyze price and meta impact
      const priceImpact = await this.analyzePriceImpact(card)
      const metaImpact = this.analyzeMetaImpact(card, relevantDecks)

      return {
        cardId: card.id,
        cardName: card.name,
        setCode,
        relevantDecks,
        impactScore,
        recommendationType,
        reasoning: this.generateCardReasoning(card, relevantDecks, recommendationType),
        priceImpact,
        metaImpact
      }
    } catch (error) {
      console.error(`Error analyzing new card ${card.name}:`, error)
      return null
    }
  }

  /**
   * Find decks that might be relevant for a new card
   */
  private async findPotentiallyRelevantDecks(card: any): Promise<any[]> {
    try {
      const colorIdentity = card.color_identity || []
      const cardTypes = card.type_line?.toLowerCase() || ''
      const keywords = this.extractKeywords(card)

      // Find decks with matching color identity
      const decks = await this.prisma.deck.findMany({
        include: {
          cards: {
            include: {
              card: true
            }
          }
        },
        where: {
          // Basic filtering - would be more sophisticated in real implementation
          format: 'commander'
        }
      })

      // Filter decks based on color identity and strategy compatibility
      return decks.filter(deck => {
        // Check color identity compatibility
        const deckColors = this.getDeckColorIdentity(deck)
        const isColorCompatible = colorIdentity.every((color: string) => 
          deckColors.includes(color)
        )

        if (!isColorCompatible) return false

        // Check strategy compatibility
        const deckStrategy = this.inferDeckStrategy(deck)
        const cardStrategy = this.inferCardStrategy(card)
        
        return this.areStrategiesCompatible(deckStrategy, cardStrategy)
      })
    } catch (error) {
      console.error('Error finding potentially relevant decks:', error)
      return []
    }
  }

  /**
   * Calculate how relevant a card is to a specific deck
   */
  private async calculateDeckRelevance(card: any, deck: any): Promise<DeckRelevance | null> {
    try {
      let relevanceScore = 0
      let suggestedAction: DeckRelevance['suggestedAction'] = 'monitor'
      let targetCard: string | undefined
      let reasoning = ''

      // Check for direct synergies with existing cards
      const synergyScore = await this.calculateSynergyScore(card, deck.cards)
      relevanceScore += synergyScore * 0.4

      // Check for strategy alignment
      const strategyScore = this.calculateStrategyAlignment(card, deck)
      relevanceScore += strategyScore * 0.3

      // Check for power level appropriateness
      const powerScore = this.calculatePowerLevelScore(card, deck)
      relevanceScore += powerScore * 0.2

      // Check for replacement potential
      const replacementAnalysis = await this.findReplacementTargets(card, deck)
      if (replacementAnalysis.score > 0) {
        relevanceScore += replacementAnalysis.score * 0.1
        targetCard = replacementAnalysis.targetCard
      }

      // Determine suggested action based on score
      if (relevanceScore > 0.8) {
        suggestedAction = 'add'
        reasoning = 'High synergy and strategy alignment make this an excellent addition'
      } else if (relevanceScore > 0.6) {
        suggestedAction = replacementAnalysis.targetCard ? 'replace' : 'consider'
        reasoning = replacementAnalysis.targetCard 
          ? `Strong upgrade over ${replacementAnalysis.targetCardName}`
          : 'Good fit for deck strategy and synergies'
      } else if (relevanceScore > 0.3) {
        suggestedAction = 'consider'
        reasoning = 'Moderate synergy potential worth considering'
      } else {
        suggestedAction = 'monitor'
        reasoning = 'Limited immediate impact but worth monitoring'
      }

      return {
        deckId: deck.id,
        deckName: deck.name,
        relevanceScore,
        suggestedAction,
        targetCard,
        reasoning
      }
    } catch (error) {
      console.error('Error calculating deck relevance:', error)
      return null
    }
  }

  /**
   * Get recent and upcoming sets from Scryfall
   */
  private async getRecentSets(): Promise<SetRelease[]> {
    try {
      const cacheKey = 'sets:recent'
      const cached = await redisCache.get<SetRelease[]>(cacheKey)
      if (cached) return cached

      // Get sets from Scryfall API
      const response = await fetch('https://api.scryfall.com/sets')
      const data = await response.json()

      const now = new Date()
      const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000))
      const oneMonthFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000))

      const recentSets: SetRelease[] = data.data
        .filter((set: any) => {
          const releaseDate = new Date(set.released_at)
          return releaseDate >= threeMonthsAgo && releaseDate <= oneMonthFromNow
        })
        .map((set: any) => ({
          setCode: set.code,
          setName: set.name,
          releaseDate: new Date(set.released_at),
          cardCount: set.card_count,
          isDigital: set.digital,
          setType: this.mapSetType(set.set_type)
        }))
        .sort((a: SetRelease, b: SetRelease) => 
          b.releaseDate.getTime() - a.releaseDate.getTime()
        )

      await redisCache.set(cacheKey, recentSets, this.CACHE_TTL)
      return recentSets
    } catch (error) {
      console.error('Error fetching recent sets:', error)
      return []
    }
  }

  /**
   * Get all cards from a specific set
   */
  private async getSetCards(setCode: string): Promise<any[]> {
    try {
      const cacheKey = `set:cards:${setCode}`
      const cached = await redisCache.get<any[]>(cacheKey)
      if (cached) return cached

      const response = await fetch(`https://api.scryfall.com/cards/search?q=set:${setCode}`)
      const data = await response.json()

      if (!data.data) return []

      // Filter for relevant cards (exclude basic lands, tokens, etc.)
      const relevantCards = data.data.filter((card: any) => 
        !card.type_line?.includes('Basic Land') &&
        card.layout !== 'token' &&
        card.layout !== 'emblem' &&
        !card.digital
      )

      await redisCache.set(cacheKey, relevantCards, this.CACHE_TTL)
      return relevantCards
    } catch (error) {
      console.error(`Error fetching cards for set ${setCode}:`, error)
      return []
    }
  }

  /**
   * Helper methods for analysis
   */
  private calculateSynergyScore(card: any, deckCards: any[]): number {
    // Simplified synergy calculation
    // In a real implementation, this would use AI or complex rules
    let score = 0
    
    const cardKeywords = this.extractKeywords(card)
    const cardTypes = card.type_line?.toLowerCase() || ''
    
    for (const deckCard of deckCards) {
      const deckCardKeywords = this.extractKeywords(deckCard.card)
      const deckCardTypes = deckCard.card.type_line?.toLowerCase() || ''
      
      // Check for keyword synergies
      const keywordMatches = cardKeywords.filter(k => deckCardKeywords.includes(k))
      score += keywordMatches.length * 0.1
      
      // Check for type synergies
      if (cardTypes.includes('artifact') && deckCardTypes.includes('artifact')) {
        score += 0.2
      }
      if (cardTypes.includes('enchantment') && deckCardTypes.includes('enchantment')) {
        score += 0.2
      }
    }
    
    return Math.min(1, score / deckCards.length)
  }

  private calculateStrategyAlignment(card: any, deck: any): number {
    const cardStrategy = this.inferCardStrategy(card)
    const deckStrategy = this.inferDeckStrategy(deck)
    
    // Simple strategy matching
    if (cardStrategy === deckStrategy) return 1
    if (this.areStrategiesCompatible(cardStrategy, deckStrategy)) return 0.7
    return 0.3
  }

  private calculatePowerLevelScore(card: any, deck: any): number {
    // Simplified power level calculation
    const cardPowerLevel = this.estimateCardPowerLevel(card)
    const deckPowerLevel = this.estimateDeckPowerLevel(deck)
    
    const difference = Math.abs(cardPowerLevel - deckPowerLevel)
    return Math.max(0, 1 - (difference / 5)) // Normalize to 0-1
  }

  private async findReplacementTargets(card: any, deck: any): Promise<{
    score: number
    targetCard?: string
    targetCardName?: string
  }> {
    // Find cards in the deck that this new card could replace
    let bestScore = 0
    let targetCard: string | undefined
    let targetCardName: string | undefined
    
    for (const deckCard of deck.cards) {
      if (this.isSimilarCard(card, deckCard.card)) {
        const improvementScore = this.calculateImprovementScore(card, deckCard.card)
        if (improvementScore > bestScore) {
          bestScore = improvementScore
          targetCard = deckCard.cardId
          targetCardName = deckCard.card.name
        }
      }
    }
    
    return { score: bestScore, targetCard, targetCardName }
  }

  private extractKeywords(card: any): string[] {
    const keywords: string[] = []
    const text = (card.oracle_text || '').toLowerCase()
    
    // Common MTG keywords
    const keywordList = [
      'flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch',
      'hexproof', 'indestructible', 'flash', 'defender', 'reach',
      'first strike', 'double strike', 'menace', 'prowess'
    ]
    
    keywordList.forEach(keyword => {
      if (text.includes(keyword)) {
        keywords.push(keyword)
      }
    })
    
    return keywords
  }

  private getDeckColorIdentity(deck: any): string[] {
    const colors = new Set<string>()
    
    deck.cards.forEach((deckCard: any) => {
      const cardColors = deckCard.card.color_identity || []
      cardColors.forEach((color: string) => colors.add(color))
    })
    
    return Array.from(colors)
  }

  private inferDeckStrategy(deck: any): string {
    // Simplified strategy inference
    const creatureCount = deck.cards.filter((c: any) => 
      c.card.type_line?.includes('Creature')
    ).length
    
    const instantSorceryCount = deck.cards.filter((c: any) => 
      c.card.type_line?.includes('Instant') || c.card.type_line?.includes('Sorcery')
    ).length
    
    if (creatureCount > 30) return 'aggro'
    if (instantSorceryCount > 20) return 'control'
    return 'midrange'
  }

  private inferCardStrategy(card: any): string {
    const types = card.type_line?.toLowerCase() || ''
    const text = card.oracle_text?.toLowerCase() || ''
    
    if (types.includes('creature') && card.power >= 4) return 'aggro'
    if (types.includes('instant') || types.includes('sorcery')) {
      if (text.includes('counter') || text.includes('draw')) return 'control'
    }
    return 'midrange'
  }

  private areStrategiesCompatible(strategy1: string, strategy2: string): boolean {
    const compatibilityMap: { [key: string]: string[] } = {
      'aggro': ['aggro', 'midrange'],
      'control': ['control', 'midrange'],
      'midrange': ['aggro', 'control', 'midrange'],
      'combo': ['combo', 'control']
    }
    
    return compatibilityMap[strategy1]?.includes(strategy2) || false
  }

  private estimateCardPowerLevel(card: any): number {
    // Simplified power level estimation (1-10 scale)
    let powerLevel = 5 // Base power level
    
    if (card.mana_cost) {
      const cmc = card.cmc || 0
      if (cmc <= 2) powerLevel += 1
      if (cmc >= 7) powerLevel -= 1
    }
    
    if (card.rarity === 'mythic') powerLevel += 1
    if (card.rarity === 'common') powerLevel -= 1
    
    return Math.max(1, Math.min(10, powerLevel))
  }

  private estimateDeckPowerLevel(deck: any): number {
    // Simplified deck power level estimation
    const avgCmc = deck.cards.reduce((sum: number, c: any) => 
      sum + (c.card.cmc || 0), 0
    ) / deck.cards.length
    
    const mythicCount = deck.cards.filter((c: any) => 
      c.card.rarity === 'mythic'
    ).length
    
    let powerLevel = 5
    if (avgCmc < 3) powerLevel += 1
    if (avgCmc > 4) powerLevel -= 1
    if (mythicCount > 10) powerLevel += 1
    
    return Math.max(1, Math.min(10, powerLevel))
  }

  private isSimilarCard(card1: any, card2: any): boolean {
    // Check if cards serve similar functions
    const type1 = card1.type_line?.toLowerCase() || ''
    const type2 = card2.type_line?.toLowerCase() || ''
    
    // Same primary type
    if (type1.split(' ')[0] === type2.split(' ')[0]) return true
    
    // Similar functions (simplified)
    const text1 = card1.oracle_text?.toLowerCase() || ''
    const text2 = card2.oracle_text?.toLowerCase() || ''
    
    const functions = ['draw', 'counter', 'destroy', 'search', 'return']
    for (const func of functions) {
      if (text1.includes(func) && text2.includes(func)) return true
    }
    
    return false
  }

  private calculateImprovementScore(newCard: any, oldCard: any): number {
    // Calculate how much better the new card is
    let score = 0
    
    const newCmc = newCard.cmc || 0
    const oldCmc = oldCard.cmc || 0
    
    // Lower CMC is generally better
    if (newCmc < oldCmc) score += 0.3
    
    // Better stats for creatures
    if (newCard.power && oldCard.power) {
      if (newCard.power > oldCard.power) score += 0.2
    }
    if (newCard.toughness && oldCard.toughness) {
      if (newCard.toughness > oldCard.toughness) score += 0.2
    }
    
    // More abilities/text generally better
    const newTextLength = newCard.oracle_text?.length || 0
    const oldTextLength = oldCard.oracle_text?.length || 0
    if (newTextLength > oldTextLength) score += 0.3
    
    return Math.min(1, score)
  }

  private calculateOverallMetaImpact(relevantCards: NewCardAnalysis[]): 'revolutionary' | 'significant' | 'moderate' | 'minimal' {
    const highImpactCards = relevantCards.filter(c => c.impactScore > 0.8).length
    const mediumImpactCards = relevantCards.filter(c => c.impactScore > 0.5).length
    
    if (highImpactCards > 5) return 'revolutionary'
    if (highImpactCards > 2 || mediumImpactCards > 10) return 'significant'
    if (mediumImpactCards > 5) return 'moderate'
    return 'minimal'
  }

  private async analyzePriceImpacts(setCards: any[], setCode: string): Promise<PriceImpact[]> {
    const impacts: PriceImpact[] = []
    
    for (const card of setCards.slice(0, 20)) { // Analyze top 20 cards
      // Check if this is a reprint
      const existingPrintings = await this.checkForExistingPrintings(card.name)
      
      if (existingPrintings.length > 0) {
        impacts.push({
          cardId: card.id,
          cardName: card.name,
          impactType: 'reprint',
          expectedPriceChange: -0.3, // 30% price drop expected
          confidence: 0.8
        })
      }
    }
    
    return impacts
  }

  private async checkForExistingPrintings(cardName: string): Promise<any[]> {
    try {
      const response = await fetch(`https://api.scryfall.com/cards/search?q=!"${cardName}"`)
      const data = await response.json()
      return data.data || []
    } catch (error) {
      return []
    }
  }

  private generateSetRecommendations(
    relevantCards: NewCardAnalysis[],
    priceImpacts: PriceImpact[],
    affectedDecks: string[]
  ): SetRecommendation[] {
    const recommendations: SetRecommendation[] = []
    
    // High-impact cards recommendation
    const highImpactCards = relevantCards.filter(c => c.impactScore > 0.8)
    if (highImpactCards.length > 0) {
      recommendations.push({
        type: 'immediate_action',
        priority: 'high',
        message: `${highImpactCards.length} high-impact cards detected. Review upgrade recommendations immediately.`,
        affectedDecks,
        timeframe: 'immediate'
      })
    }
    
    // Price impact recommendation
    const significantPriceImpacts = priceImpacts.filter(p => Math.abs(p.expectedPriceChange) > 0.2)
    if (significantPriceImpacts.length > 0) {
      recommendations.push({
        type: 'prepare_budget',
        priority: 'medium',
        message: `${significantPriceImpacts.length} cards may see significant price changes. Consider timing purchases carefully.`,
        affectedDecks,
        timeframe: 'short_term'
      })
    }
    
    return recommendations
  }

  private generateCardReasoning(
    card: any,
    relevantDecks: DeckRelevance[],
    recommendationType: string
  ): string {
    const deckCount = relevantDecks.length
    const avgRelevance = relevantDecks.reduce((sum, d) => sum + d.relevanceScore, 0) / deckCount
    
    let reasoning = `This card shows ${avgRelevance > 0.7 ? 'strong' : 'moderate'} synergy with ${deckCount} of your decks. `
    
    switch (recommendationType) {
      case 'upgrade':
        reasoning += 'It represents a clear upgrade over existing cards.'
        break
      case 'replacement':
        reasoning += 'It could replace less efficient cards in your current builds.'
        break
      case 'synergy':
        reasoning += 'It creates new synergistic opportunities with your existing cards.'
        break
      case 'sideboard':
        reasoning += 'It provides meta-specific answers worth considering.'
        break
    }
    
    return reasoning
  }

  private determineRecommendationType(
    card: any,
    relevantDecks: DeckRelevance[]
  ): 'upgrade' | 'replacement' | 'synergy' | 'sideboard' {
    const hasReplacements = relevantDecks.some(d => d.targetCard)
    if (hasReplacements) return 'replacement'
    
    const avgRelevance = relevantDecks.reduce((sum, d) => sum + d.relevanceScore, 0) / relevantDecks.length
    if (avgRelevance > 0.8) return 'upgrade'
    if (avgRelevance > 0.5) return 'synergy'
    
    return 'sideboard'
  }

  private calculateCardImpactScore(card: any, relevantDecks: DeckRelevance[]): number {
    const avgRelevance = relevantDecks.reduce((sum, d) => sum + d.relevanceScore, 0) / relevantDecks.length
    const deckCount = relevantDecks.length
    
    // Weight by both relevance and number of affected decks
    return (avgRelevance * 0.7) + (Math.min(deckCount / 10, 1) * 0.3)
  }

  private async analyzePriceImpact(card: any): Promise<'positive' | 'negative' | 'neutral'> {
    // Simplified price impact analysis
    const powerLevel = this.estimateCardPowerLevel(card)
    const rarity = card.rarity
    
    if (powerLevel > 7 && (rarity === 'rare' || rarity === 'mythic')) {
      return 'positive' // Likely to increase in price
    }
    
    return 'neutral'
  }

  private analyzeMetaImpact(card: any, relevantDecks: DeckRelevance[]): 'high' | 'medium' | 'low' {
    const avgRelevance = relevantDecks.reduce((sum, d) => sum + d.relevanceScore, 0) / relevantDecks.length
    const deckCount = relevantDecks.length
    
    if (avgRelevance > 0.8 && deckCount > 5) return 'high'
    if (avgRelevance > 0.5 && deckCount > 2) return 'medium'
    return 'low'
  }

  private mapSetType(scryfallType: string): SetRelease['setType'] {
    const typeMap: { [key: string]: SetRelease['setType'] } = {
      'core': 'core',
      'expansion': 'expansion',
      'masters': 'masters',
      'commander': 'commander',
      'supplemental': 'supplemental',
      'draft_innovation': 'supplemental',
      'funny': 'supplemental'
    }
    
    return typeMap[scryfallType] || 'supplemental'
  }
}
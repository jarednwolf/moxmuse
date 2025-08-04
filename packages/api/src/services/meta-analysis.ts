import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { redisCache } from './redis'
import { scryfallService } from './scryfall'
import axios from 'axios'

interface MetaAnalysis {
  format: string
  metaShare: number
  winRate: number
  popularityTrend: 'rising' | 'stable' | 'declining'
  favorableMatchups: MetaMatchup[]
  unfavorableMatchups: MetaMatchup[]
  metaAdaptations: MetaAdaptation[]
  competitiveViability: number
  lastUpdated: Date
}

interface MetaMatchup {
  opponentArchetype: string
  winRate: number
  gameCount: number
  confidence: number
  keyCards: string[]
  strategy: string
}

interface MetaAdaptation {
  reason: string
  cardChanges: CardChange[]
  expectedImpact: number
  confidence: number
  source: 'tournament' | 'community' | 'ai_analysis'
}

interface CardChange {
  action: 'add' | 'remove' | 'replace'
  cardId: string
  cardName: string
  quantity: number
  replacementId?: string
  replacementName?: string
  reasoning: string
}

interface PopularityTrend {
  cardId: string
  cardName: string
  currentPopularity: number
  previousPopularity: number
  trend: 'rising' | 'falling' | 'stable'
  trendStrength: number
  playRate: number
  winRate: number
  format: string
}

interface CompetitiveViability {
  deckId: string
  overallScore: number
  metaPosition: 'tier1' | 'tier2' | 'tier3' | 'rogue'
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  confidenceLevel: number
}

interface TournamentData {
  eventName: string
  date: Date
  format: string
  playerCount: number
  decks: TournamentDeck[]
}

interface TournamentDeck {
  pilot: string
  archetype: string
  placement: number
  winRate: number
  mainboard: string[]
  sideboard: string[]
  commander?: string
}

export class MetaAnalysisService {
  private readonly CACHE_TTL = 60 * 60 * 2 // 2 hours
  private readonly TOURNAMENT_CACHE_TTL = 60 * 60 * 24 // 24 hours
  
  constructor(private prisma: PrismaClient) {}

  /**
   * Analyze deck's position in the current meta
   */
  async analyzeDeckMeta(
    deckId: string,
    format: string = 'commander'
  ): Promise<MetaAnalysis> {
    try {
      // Check cache first
      const cacheKey = `meta:deck:${deckId}:${format}`
      const cached = await redisCache.get<MetaAnalysis>(cacheKey)
      if (cached && this.isCacheValid(cached.lastUpdated)) {
        return cached
      }

      // Get deck data
      const deck = await this.prisma.deck.findUnique({
        where: { id: deckId },
        include: { cards: true }
      })

      if (!deck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deck not found'
        })
      }

      // Identify deck archetype
      const archetype = await this.identifyArchetype(deck)
      
      // Get current meta data
      const metaData = await this.getCurrentMetaData(format)
      
      // Calculate meta share and win rate
      const metaStats = this.calculateMetaStats(archetype, metaData)
      
      // Analyze matchups
      const favorableMatchups = await this.analyzeFavorableMatchups(archetype, metaData)
      const unfavorableMatchups = await this.analyzeUnfavorableMatchups(archetype, metaData)
      
      // Generate meta adaptations
      const metaAdaptations = await this.generateMetaAdaptations(deck, metaData)
      
      // Calculate competitive viability
      const competitiveViability = this.calculateCompetitiveViability(
        archetype,
        metaStats,
        favorableMatchups,
        unfavorableMatchups
      )

      const analysis: MetaAnalysis = {
        format,
        metaShare: metaStats.metaShare,
        winRate: metaStats.winRate,
        popularityTrend: metaStats.trend,
        favorableMatchups,
        unfavorableMatchups,
        metaAdaptations,
        competitiveViability,
        lastUpdated: new Date()
      }

      // Cache the result
      await redisCache.set(cacheKey, analysis, this.CACHE_TTL)

      return analysis
    } catch (error) {
      console.error(`Error analyzing deck meta for ${deckId}:`, error)
      throw error
    }
  }

  /**
   * Get current meta data from various sources
   */
  private async getCurrentMetaData(format: string): Promise<TournamentData[]> {
    try {
      const cacheKey = `meta:data:${format}`
      const cached = await redisCache.get<TournamentData[]>(cacheKey)
      if (cached) return cached

      const metaData: TournamentData[] = []

      // Fetch from EDHREC (for Commander format)
      if (format === 'commander') {
        const edhrecData = await this.fetchEDHRECData()
        metaData.push(...edhrecData)
      }

      // Fetch from MTGTop8
      const mtgtop8Data = await this.fetchMTGTop8Data(format)
      metaData.push(...mtgtop8Data)

      // Fetch from MTGGoldfish
      const goldfishData = await this.fetchMTGGoldfishData(format)
      metaData.push(...goldfishData)

      // Cache the result
      await redisCache.set(cacheKey, metaData, this.TOURNAMENT_CACHE_TTL)

      return metaData
    } catch (error) {
      console.error('Error fetching meta data:', error)
      return []
    }
  }

  /**
   * Fetch data from EDHREC
   */
  private async fetchEDHRECData(): Promise<TournamentData[]> {
    try {
      // EDHREC doesn't have a public API, so we'll simulate data
      // In a real implementation, this would scrape or use an API
      
      const mockData: TournamentData = {
        eventName: 'EDHREC Meta Analysis',
        date: new Date(),
        format: 'commander',
        playerCount: 10000, // Simulated sample size
        decks: [
          {
            pilot: 'Meta Sample',
            archetype: 'Simic Value',
            placement: 1,
            winRate: 0.65,
            mainboard: [],
            sideboard: [],
            commander: 'Kinnan, Bonder Prodigy'
          },
          {
            pilot: 'Meta Sample',
            archetype: 'Golgari Midrange',
            placement: 2,
            winRate: 0.58,
            mainboard: [],
            sideboard: [],
            commander: 'Meren of Clan Nel Toth'
          }
          // More archetypes would be added here
        ]
      }

      return [mockData]
    } catch (error) {
      console.error('Error fetching EDHREC data:', error)
      return []
    }
  }

  /**
   * Fetch data from MTGTop8
   */
  private async fetchMTGTop8Data(format: string): Promise<TournamentData[]> {
    try {
      // MTGTop8 scraping would go here
      // For now, return empty array
      return []
    } catch (error) {
      console.error('Error fetching MTGTop8 data:', error)
      return []
    }
  }

  /**
   * Fetch data from MTGGoldfish
   */
  private async fetchMTGGoldfishData(format: string): Promise<TournamentData[]> {
    try {
      // MTGGoldfish scraping would go here
      // For now, return empty array
      return []
    } catch (error) {
      console.error('Error fetching MTGGoldfish data:', error)
      return []
    }
  }

  /**
   * Identify deck archetype based on cards and commander
   */
  private async identifyArchetype(deck: any): Promise<string> {
    try {
      // Get commander if it exists
      const commander = deck.cards.find((c: any) => c.category === 'commander')
      
      if (commander) {
        const commanderCard = await scryfallService.getCard(commander.cardId)
        if (commanderCard) {
          // Simple archetype identification based on commander colors and name
          const colors = commanderCard.color_identity || []
          
          if (colors.includes('U') && colors.includes('G')) {
            return 'Simic Value'
          } else if (colors.includes('B') && colors.includes('G')) {
            return 'Golgari Midrange'
          } else if (colors.includes('R') && colors.includes('W')) {
            return 'Boros Aggro'
          } else if (colors.includes('U') && colors.includes('W')) {
            return 'Azorius Control'
          } else if (colors.length === 1) {
            return `Mono-${this.getColorName(colors[0])} ${this.guessStrategy(deck.cards)}`
          } else if (colors.length >= 3) {
            return 'Multicolor Goodstuff'
          }
        }
      }

      // Fallback to generic archetype
      return 'Unknown Archetype'
    } catch (error) {
      console.error('Error identifying archetype:', error)
      return 'Unknown Archetype'
    }
  }

  /**
   * Calculate meta statistics for an archetype
   */
  private calculateMetaStats(
    archetype: string,
    metaData: TournamentData[]
  ): { metaShare: number; winRate: number; trend: 'rising' | 'stable' | 'declining' } {
    let totalDecks = 0
    let archetypeDecks = 0
    let totalWins = 0
    let archetypeWins = 0

    for (const tournament of metaData) {
      totalDecks += tournament.decks.length
      
      for (const deck of tournament.decks) {
        if (deck.archetype === archetype) {
          archetypeDecks++
          archetypeWins += deck.winRate
        }
        totalWins += deck.winRate
      }
    }

    const metaShare = totalDecks > 0 ? archetypeDecks / totalDecks : 0
    const winRate = archetypeDecks > 0 ? archetypeWins / archetypeDecks : 0.5

    // Simple trend calculation (would be more sophisticated in real implementation)
    let trend: 'rising' | 'stable' | 'declining' = 'stable'
    if (winRate > 0.55) trend = 'rising'
    else if (winRate < 0.45) trend = 'declining'

    return { metaShare, winRate, trend }
  }

  /**
   * Analyze favorable matchups
   */
  private async analyzeFavorableMatchups(
    archetype: string,
    metaData: TournamentData[]
  ): Promise<MetaMatchup[]> {
    const matchups: MetaMatchup[] = []

    // This would analyze tournament data to find favorable matchups
    // For now, return some mock data based on archetype
    if (archetype === 'Simic Value') {
      matchups.push({
        opponentArchetype: 'Boros Aggro',
        winRate: 0.68,
        gameCount: 50,
        confidence: 0.8,
        keyCards: ['Counterspell', 'Fog'],
        strategy: 'Counter early threats and stabilize with card advantage'
      })
    }

    return matchups
  }

  /**
   * Analyze unfavorable matchups
   */
  private async analyzeUnfavorableMatchups(
    archetype: string,
    metaData: TournamentData[]
  ): Promise<MetaMatchup[]> {
    const matchups: MetaMatchup[] = []

    // This would analyze tournament data to find unfavorable matchups
    // For now, return some mock data based on archetype
    if (archetype === 'Simic Value') {
      matchups.push({
        opponentArchetype: 'Azorius Control',
        winRate: 0.32,
        gameCount: 45,
        confidence: 0.75,
        keyCards: ['Teferi, Time Raveler', 'Wrath of God'],
        strategy: 'Struggle against counterspells and board wipes'
      })
    }

    return matchups
  }

  /**
   * Generate meta adaptation suggestions
   */
  private async generateMetaAdaptations(
    deck: any,
    metaData: TournamentData[]
  ): Promise<MetaAdaptation[]> {
    const adaptations: MetaAdaptation[] = []

    // Analyze current meta threats and suggest adaptations
    const commonThreats = this.identifyCommonThreats(metaData)
    
    for (const threat of commonThreats) {
      const adaptation = await this.suggestAdaptation(deck, threat)
      if (adaptation) {
        adaptations.push(adaptation)
      }
    }

    return adaptations.slice(0, 5) // Top 5 adaptations
  }

  /**
   * Identify common threats in the meta
   */
  private identifyCommonThreats(metaData: TournamentData[]): string[] {
    // This would analyze the most played cards across successful decks
    // For now, return some common threats
    return [
      'Rhystic Study',
      'Smothering Tithe',
      'Dockside Extortionist',
      'Thassa\'s Oracle'
    ]
  }

  /**
   * Suggest adaptation for a specific threat
   */
  private async suggestAdaptation(deck: any, threat: string): Promise<MetaAdaptation | null> {
    try {
      // Find appropriate answers to the threat
      const answers = await this.findAnswers(threat)
      if (answers.length === 0) return null

      const cardChanges: CardChange[] = answers.map(answer => ({
        action: 'add',
        cardId: answer.id,
        cardName: answer.name,
        quantity: 1,
        reasoning: `Answers ${threat} which is prevalent in the current meta`
      }))

      return {
        reason: `${threat} is seeing increased play in the meta`,
        cardChanges,
        expectedImpact: 0.7,
        confidence: 0.8,
        source: 'ai_analysis'
      }
    } catch (error) {
      console.error(`Error suggesting adaptation for ${threat}:`, error)
      return null
    }
  }

  /**
   * Find cards that answer a specific threat
   */
  private async findAnswers(threat: string): Promise<any[]> {
    // This would use card database to find appropriate answers
    // For now, return some generic answers
    const genericAnswers = [
      { id: 'counterspell-id', name: 'Counterspell' },
      { id: 'naturalize-id', name: 'Naturalize' },
      { id: 'swords-to-plowshares-id', name: 'Swords to Plowshares' }
    ]

    return genericAnswers.slice(0, 1) // Return one answer
  }

  /**
   * Calculate competitive viability score
   */
  private calculateCompetitiveViability(
    archetype: string,
    metaStats: any,
    favorableMatchups: MetaMatchup[],
    unfavorableMatchups: MetaMatchup[]
  ): number {
    let score = 50 // Base score

    // Meta share bonus
    score += metaStats.metaShare * 100 * 0.3

    // Win rate bonus
    score += (metaStats.winRate - 0.5) * 100

    // Matchup spread bonus
    const favorableCount = favorableMatchups.length
    const unfavorableCount = unfavorableMatchups.length
    score += (favorableCount - unfavorableCount) * 5

    // Trend bonus
    if (metaStats.trend === 'rising') score += 10
    else if (metaStats.trend === 'declining') score -= 10

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Get popularity trends for cards
   */
  async getPopularityTrends(
    format: string = 'commander',
    timeframe: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<PopularityTrend[]> {
    try {
      const cacheKey = `trends:${format}:${timeframe}`
      const cached = await redisCache.get<PopularityTrend[]>(cacheKey)
      if (cached) return cached

      // This would fetch real trend data
      // For now, return mock data
      const trends: PopularityTrend[] = [
        {
          cardId: 'rhystic-study-id',
          cardName: 'Rhystic Study',
          currentPopularity: 45.2,
          previousPopularity: 42.1,
          trend: 'rising',
          trendStrength: 0.73,
          playRate: 0.452,
          winRate: 0.58,
          format
        }
      ]

      await redisCache.set(cacheKey, trends, this.CACHE_TTL)
      return trends
    } catch (error) {
      console.error('Error fetching popularity trends:', error)
      return []
    }
  }

  /**
   * Assess competitive viability of a deck
   */
  async assessCompetitiveViability(deckId: string): Promise<CompetitiveViability> {
    try {
      const metaAnalysis = await this.analyzeDeckMeta(deckId)
      
      let tier: 'tier1' | 'tier2' | 'tier3' | 'rogue' = 'rogue'
      if (metaAnalysis.competitiveViability >= 80) tier = 'tier1'
      else if (metaAnalysis.competitiveViability >= 65) tier = 'tier2'
      else if (metaAnalysis.competitiveViability >= 50) tier = 'tier3'

      const strengths = this.identifyDeckStrengths(metaAnalysis)
      const weaknesses = this.identifyDeckWeaknesses(metaAnalysis)
      const recommendations = this.generateCompetitiveRecommendations(metaAnalysis)

      return {
        deckId,
        overallScore: metaAnalysis.competitiveViability,
        metaPosition: tier,
        strengths,
        weaknesses,
        recommendations,
        confidenceLevel: 0.8
      }
    } catch (error) {
      console.error(`Error assessing competitive viability for ${deckId}:`, error)
      throw error
    }
  }

  /**
   * Helper methods
   */
  private identifyDeckStrengths(analysis: MetaAnalysis): string[] {
    const strengths: string[] = []
    
    if (analysis.winRate > 0.55) {
      strengths.push('Strong overall win rate in current meta')
    }
    
    if (analysis.favorableMatchups.length > analysis.unfavorableMatchups.length) {
      strengths.push('Favorable matchup spread against popular decks')
    }
    
    if (analysis.popularityTrend === 'rising') {
      strengths.push('Increasing popularity suggests strong performance')
    }

    return strengths
  }

  private identifyDeckWeaknesses(analysis: MetaAnalysis): string[] {
    const weaknesses: string[] = []
    
    if (analysis.winRate < 0.45) {
      weaknesses.push('Below-average win rate in current meta')
    }
    
    if (analysis.unfavorableMatchups.length > analysis.favorableMatchups.length) {
      weaknesses.push('Struggles against popular meta decks')
    }
    
    if (analysis.popularityTrend === 'declining') {
      weaknesses.push('Declining popularity may indicate meta shift')
    }

    return weaknesses
  }

  private generateCompetitiveRecommendations(analysis: MetaAnalysis): string[] {
    const recommendations: string[] = []
    
    if (analysis.metaAdaptations.length > 0) {
      recommendations.push('Consider meta adaptations to improve matchups')
    }
    
    if (analysis.winRate < 0.5) {
      recommendations.push('Focus on improving consistency and power level')
    }
    
    recommendations.push('Monitor meta shifts and adapt accordingly')

    return recommendations
  }

  private getColorName(colorCode: string): string {
    const colorMap: { [key: string]: string } = {
      'W': 'White',
      'U': 'Blue',
      'B': 'Black',
      'R': 'Red',
      'G': 'Green'
    }
    return colorMap[colorCode] || 'Colorless'
  }

  private guessStrategy(cards: any[]): string {
    // Simple strategy guessing based on card count and types
    if (cards.length > 80) return 'Goodstuff'
    if (cards.filter(c => c.category?.includes('creature')).length > 30) return 'Aggro'
    return 'Control'
  }

  private isCacheValid(lastUpdated: Date): boolean {
    const now = new Date()
    const diffHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60)
    return diffHours < 2 // Cache valid for 2 hours
  }
}
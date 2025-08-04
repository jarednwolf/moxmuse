import { prisma as db } from '@moxmuse/db'
import type { 
  PersonalizedMetaAnalysis,
  UserStyleProfile,
  LearningEvent
} from '../../types/learning'
import { learningEventTracker } from './learning-event-tracker'
import { metaAnalysisService } from '../meta-analysis'

export class PersonalizedMetaAnalyzer {
  /**
   * Generate personalized meta analysis based on user's local meta and preferences
   */
  async generatePersonalizedMetaAnalysis(userId: string): Promise<PersonalizedMetaAnalysis> {
    // Get user's learning data and preferences
    const [userProfile, learningEvents, globalMeta] = await Promise.all([
      this.getUserProfile(userId),
      learningEventTracker.getUserLearningEvents(userId),
      metaAnalysisService.getCurrentMeta('commander')
    ])

    // Analyze user's local meta from their game history
    const localMeta = await this.analyzeLocalMeta(learningEvents)
    
    // Analyze user's personal performance against different strategies
    const personalPerformance = await this.analyzePersonalPerformance(learningEvents, localMeta)
    
    // Generate personalized insights and adaptations
    const adaptationSuggestions = await this.generateAdaptationSuggestions(
      userProfile,
      localMeta,
      personalPerformance,
      globalMeta
    )

    const analysis: PersonalizedMetaAnalysis = {
      userId,
      localMeta,
      personalPerformance,
      confidence: this.calculateAnalysisConfidence(learningEvents, localMeta),
      lastUpdated: new Date()
    }

    // Store analysis for future reference
    await this.storePersonalizedAnalysis(analysis)

    return analysis
  }

  /**
   * Analyze user's local meta from game history
   */
  private async analyzeLocalMeta(learningEvents: LearningEvent[]): Promise<{
    popularDecks: string[]
    winRates: Record<string, number>
    trends: Record<string, 'rising' | 'stable' | 'declining'>
  }> {
    // Filter for game performance events
    const gameEvents = learningEvents.filter(e => 
      e.eventType === 'deck_performance' && 
      e.context.opponentDecks &&
      new Date(e.timestamp) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
    )

    if (gameEvents.length < 10) {
      // Not enough data for local meta analysis
      return {
        popularDecks: [],
        winRates: {},
        trends: {}
      }
    }

    // Analyze opponent deck frequency
    const opponentDeckCounts: Record<string, number> = {}
    const opponentWinRates: Record<string, { wins: number; total: number }> = {}

    for (const event of gameEvents) {
      const opponentDecks = event.context.opponentDecks as string[]
      
      for (const opponentDeck of opponentDecks) {
        // Count frequency
        opponentDeckCounts[opponentDeck] = (opponentDeckCounts[opponentDeck] || 0) + 1
        
        // Track win rates against this deck type
        if (!opponentWinRates[opponentDeck]) {
          opponentWinRates[opponentDeck] = { wins: 0, total: 0 }
        }
        
        opponentWinRates[opponentDeck].total++
        if (event.outcome === 'win') {
          opponentWinRates[opponentDeck].wins++
        }
      }
    }

    // Get most popular decks (top 10)
    const popularDecks = Object.entries(opponentDeckCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([deck]) => deck)

    // Calculate win rates
    const winRates: Record<string, number> = {}
    for (const [deck, data] of Object.entries(opponentWinRates)) {
      winRates[deck] = data.total > 0 ? data.wins / data.total : 0
    }

    // Analyze trends (compare recent vs older data)
    const trends = this.analyzeDeckTrends(gameEvents, opponentDeckCounts)

    return {
      popularDecks,
      winRates,
      trends
    }
  }

  /**
   * Analyze deck trends over time
   */
  private analyzeDeckTrends(
    gameEvents: LearningEvent[],
    overallCounts: Record<string, number>
  ): Record<string, 'rising' | 'stable' | 'declining'> {
    const trends: Record<string, 'rising' | 'stable' | 'declining'> = {}
    
    // Split events into recent (last 30 days) and older (30-90 days ago)
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const recentEvents = gameEvents.filter(e => new Date(e.timestamp) > thirtyDaysAgo)
    const olderEvents = gameEvents.filter(e => 
      new Date(e.timestamp) > sixtyDaysAgo && new Date(e.timestamp) <= thirtyDaysAgo
    )

    if (recentEvents.length < 5 || olderEvents.length < 5) {
      // Not enough data for trend analysis
      return trends
    }

    // Count deck appearances in each period
    const recentCounts: Record<string, number> = {}
    const olderCounts: Record<string, number> = {}

    for (const event of recentEvents) {
      for (const deck of event.context.opponentDecks as string[]) {
        recentCounts[deck] = (recentCounts[deck] || 0) + 1
      }
    }

    for (const event of olderEvents) {
      for (const deck of event.context.opponentDecks as string[]) {
        olderCounts[deck] = (olderCounts[deck] || 0) + 1
      }
    }

    // Calculate trends for popular decks
    for (const deck of Object.keys(overallCounts)) {
      const recentFreq = (recentCounts[deck] || 0) / recentEvents.length
      const olderFreq = (olderCounts[deck] || 0) / olderEvents.length
      
      const change = recentFreq - olderFreq
      const threshold = 0.1 // 10% change threshold

      if (change > threshold) {
        trends[deck] = 'rising'
      } else if (change < -threshold) {
        trends[deck] = 'declining'
      } else {
        trends[deck] = 'stable'
      }
    }

    return trends
  }

  /**
   * Analyze user's personal performance against different strategies
   */
  private async analyzePersonalPerformance(
    learningEvents: LearningEvent[],
    localMeta: { popularDecks: string[]; winRates: Record<string, number> }
  ): Promise<{
    bestMatchups: string[]
    worstMatchups: string[]
    adaptationSuggestions: string[]
  }> {
    const gameEvents = learningEvents.filter(e => e.eventType === 'deck_performance')
    
    if (gameEvents.length < 10) {
      return {
        bestMatchups: [],
        worstMatchups: [],
        adaptationSuggestions: []
      }
    }

    // Analyze matchup performance by user's deck strategy
    const matchupData: Record<string, Record<string, { wins: number; total: number }>> = {}

    for (const event of gameEvents) {
      const userStrategy = event.context.deckStrategy || event.context.strategy
      const opponentDecks = event.context.opponentDecks as string[]
      
      if (!userStrategy || !opponentDecks) continue

      if (!matchupData[userStrategy]) {
        matchupData[userStrategy] = {}
      }

      for (const opponentDeck of opponentDecks) {
        if (!matchupData[userStrategy][opponentDeck]) {
          matchupData[userStrategy][opponentDeck] = { wins: 0, total: 0 }
        }

        matchupData[userStrategy][opponentDeck].total++
        if (event.outcome === 'win') {
          matchupData[userStrategy][opponentDeck].wins++
        }
      }
    }

    // Find best and worst matchups across all user strategies
    const allMatchups: Array<{ opponent: string; winRate: number; games: number }> = []

    for (const strategy of Object.keys(matchupData)) {
      for (const [opponent, data] of Object.entries(matchupData[strategy])) {
        if (data.total >= 3) { // Minimum games for statistical relevance
          allMatchups.push({
            opponent,
            winRate: data.wins / data.total,
            games: data.total
          })
        }
      }
    }

    // Sort by win rate and filter for popular opponents
    const popularOpponents = new Set(localMeta.popularDecks)
    const relevantMatchups = allMatchups.filter(m => popularOpponents.has(m.opponent))

    const bestMatchups = relevantMatchups
      .filter(m => m.winRate > 0.6)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5)
      .map(m => m.opponent)

    const worstMatchups = relevantMatchups
      .filter(m => m.winRate < 0.4)
      .sort((a, b) => a.winRate - b.winRate)
      .slice(0, 5)
      .map(m => m.opponent)

    // Generate adaptation suggestions
    const adaptationSuggestions = this.generateMatchupAdaptations(
      worstMatchups,
      matchupData,
      localMeta
    )

    return {
      bestMatchups,
      worstMatchups,
      adaptationSuggestions
    }
  }

  /**
   * Generate matchup adaptation suggestions
   */
  private generateMatchupAdaptations(
    worstMatchups: string[],
    matchupData: Record<string, Record<string, { wins: number; total: number }>>,
    localMeta: { popularDecks: string[]; winRates: Record<string, number> }
  ): string[] {
    const suggestions: string[] = []

    for (const badMatchup of worstMatchups.slice(0, 3)) {
      // Analyze what makes this matchup difficult
      const matchupAnalysis = this.analyzeMatchupWeakness(badMatchup, matchupData)
      
      if (matchupAnalysis) {
        suggestions.push(
          `Against ${badMatchup}: ${matchupAnalysis.suggestion}`
        )
      }
    }

    // General meta adaptation suggestions
    const risingDecks = Object.entries(localMeta.trends || {})
      .filter(([, trend]) => trend === 'rising')
      .map(([deck]) => deck)

    if (risingDecks.length > 0) {
      suggestions.push(
        `Consider adapting to rising threats: ${risingDecks.slice(0, 2).join(', ')}`
      )
    }

    return suggestions
  }

  /**
   * Analyze specific matchup weakness
   */
  private analyzeMatchupWeakness(
    opponent: string,
    matchupData: Record<string, Record<string, { wins: number; total: number }>>
  ): { weakness: string; suggestion: string } | null {
    // This would analyze common patterns in losses against specific archetypes
    // For now, provide generic suggestions based on common archetypes
    
    const archetypeAdaptations: Record<string, { weakness: string; suggestion: string }> = {
      'combo': {
        weakness: 'Insufficient interaction',
        suggestion: 'Add more instant-speed interaction and counterspells'
      },
      'aggro': {
        weakness: 'Slow early game',
        suggestion: 'Include more early game interaction and board wipes'
      },
      'control': {
        weakness: 'Lack of pressure',
        suggestion: 'Add more resilient threats and card advantage engines'
      },
      'stax': {
        weakness: 'Dependency on expensive spells',
        suggestion: 'Include more low-cost utility and artifact removal'
      }
    }

    // Try to match opponent to known archetypes
    for (const [archetype, adaptation] of Object.entries(archetypeAdaptations)) {
      if (opponent.toLowerCase().includes(archetype)) {
        return adaptation
      }
    }

    return {
      weakness: 'Strategy mismatch',
      suggestion: 'Consider sideboard cards or strategy adjustments'
    }
  }

  /**
   * Generate adaptation suggestions based on analysis
   */
  private async generateAdaptationSuggestions(
    userProfile: UserStyleProfile,
    localMeta: any,
    personalPerformance: any,
    globalMeta: any
  ): Promise<string[]> {
    const suggestions: string[] = []

    // Local vs global meta differences
    const localPopular = new Set(localMeta.popularDecks)
    const globalPopular = new Set(globalMeta.popularDecks || [])
    
    const localOnlyDecks = [...localPopular].filter(d => !globalPopular.has(d))
    const globalOnlyDecks = [...globalPopular].filter(d => !localPopular.has(d))

    if (localOnlyDecks.length > 0) {
      suggestions.push(
        `Your local meta features ${localOnlyDecks.slice(0, 2).join(' and ')} more than the global meta`
      )
    }

    if (globalOnlyDecks.length > 0) {
      suggestions.push(
        `Consider preparing for ${globalOnlyDecks.slice(0, 2).join(' and ')} which are popular globally`
      )
    }

    // Performance-based suggestions
    if (personalPerformance.worstMatchups.length > 0) {
      suggestions.push(
        `Focus on improving against ${personalPerformance.worstMatchups[0]} - your most challenging matchup`
      )
    }

    if (personalPerformance.bestMatchups.length > 0) {
      suggestions.push(
        `Leverage your strong performance against ${personalPerformance.bestMatchups[0]} in deck selection`
      )
    }

    // Trend-based suggestions
    const risingThreats = Object.entries(localMeta.trends)
      .filter(([, trend]) => trend === 'rising')
      .map(([deck]) => deck)

    if (risingThreats.length > 0) {
      suggestions.push(
        `Prepare for the rising popularity of ${risingThreats[0]} in your meta`
      )
    }

    return suggestions
  }

  /**
   * Calculate confidence in the analysis
   */
  private calculateAnalysisConfidence(
    learningEvents: LearningEvent[],
    localMeta: any
  ): number {
    const gameEvents = learningEvents.filter(e => e.eventType === 'deck_performance')
    const recentEvents = gameEvents.filter(e => 
      new Date(e.timestamp) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )

    // Base confidence on data quantity and recency
    const dataQuantityScore = Math.min(gameEvents.length / 50, 1) // Max confidence at 50 games
    const recencyScore = Math.min(recentEvents.length / 10, 1) // Max confidence at 10 recent games
    const metaDiversityScore = Math.min(localMeta.popularDecks.length / 8, 1) // Max confidence at 8 different opponents

    return (dataQuantityScore * 0.5 + recencyScore * 0.3 + metaDiversityScore * 0.2)
  }

  /**
   * Get meta adaptation recommendations for specific deck
   */
  async getDeckMetaAdaptations(
    userId: string,
    deckId: string
  ): Promise<Array<{
    type: 'card_addition' | 'card_removal' | 'strategy_shift'
    description: string
    reasoning: string
    impact: number
    difficulty: number
    cards?: string[]
  }>> {
    const analysis = await this.generatePersonalizedMetaAnalysis(userId)
    const adaptations: any[] = []

    // Get deck-specific performance data
    const deckEvents = await learningEventTracker.getUserLearningEvents(userId)
    const deckPerformance = deckEvents.filter(e => 
      e.deckId === deckId && e.eventType === 'deck_performance'
    )

    if (deckPerformance.length < 5) {
      return adaptations // Need more data
    }

    // Analyze deck's worst matchups
    const deckMatchups = this.analyzeDeckMatchups(deckPerformance)
    
    for (const badMatchup of deckMatchups.worst.slice(0, 3)) {
      const adaptation = await this.generateSpecificAdaptation(
        badMatchup,
        analysis.localMeta,
        deckId
      )
      
      if (adaptation) {
        adaptations.push(adaptation)
      }
    }

    // Meta trend adaptations
    const risingThreats = Object.entries(analysis.localMeta.trends)
      .filter(([, trend]) => trend === 'rising')
      .map(([deck]) => deck)

    for (const threat of risingThreats.slice(0, 2)) {
      const trendAdaptation = await this.generateTrendAdaptation(threat, deckId)
      if (trendAdaptation) {
        adaptations.push(trendAdaptation)
      }
    }

    return adaptations.sort((a, b) => (b.impact / b.difficulty) - (a.impact / a.difficulty))
  }

  /**
   * Analyze deck-specific matchups
   */
  private analyzeDeckMatchups(deckPerformance: LearningEvent[]): {
    best: Array<{ opponent: string; winRate: number }>
    worst: Array<{ opponent: string; winRate: number }>
  } {
    const matchups: Record<string, { wins: number; total: number }> = {}

    for (const event of deckPerformance) {
      const opponents = event.context.opponentDecks as string[]
      if (!opponents) continue

      for (const opponent of opponents) {
        if (!matchups[opponent]) {
          matchups[opponent] = { wins: 0, total: 0 }
        }

        matchups[opponent].total++
        if (event.outcome === 'win') {
          matchups[opponent].wins++
        }
      }
    }

    const matchupList = Object.entries(matchups)
      .filter(([, data]) => data.total >= 3)
      .map(([opponent, data]) => ({
        opponent,
        winRate: data.wins / data.total
      }))

    return {
      best: matchupList.filter(m => m.winRate > 0.6).sort((a, b) => b.winRate - a.winRate),
      worst: matchupList.filter(m => m.winRate < 0.4).sort((a, b) => a.winRate - b.winRate)
    }
  }

  /**
   * Generate specific adaptation for a bad matchup
   */
  private async generateSpecificAdaptation(
    badMatchup: { opponent: string; winRate: number },
    localMeta: any,
    deckId: string
  ): Promise<any> {
    // This would use AI to analyze the specific matchup and suggest adaptations
    // For now, provide template-based suggestions
    
    return {
      type: 'card_addition',
      description: `Add targeted interaction for ${badMatchup.opponent}`,
      reasoning: `Your ${Math.round(badMatchup.winRate * 100)}% win rate against ${badMatchup.opponent} suggests need for better interaction`,
      impact: 0.7,
      difficulty: 0.4,
      cards: ['Targeted removal', 'Counterspells', 'Protection']
    }
  }

  /**
   * Generate adaptation for rising meta trend
   */
  private async generateTrendAdaptation(threat: string, deckId: string): Promise<any> {
    return {
      type: 'strategy_shift',
      description: `Adapt to rising ${threat} presence`,
      reasoning: `${threat} is becoming more popular in your local meta`,
      impact: 0.6,
      difficulty: 0.5,
      cards: ['Meta-specific answers', 'Flexible removal']
    }
  }

  /**
   * Store personalized analysis
   */
  private async storePersonalizedAnalysis(analysis: PersonalizedMetaAnalysis): Promise<void> {
    try {
      await db.userLearningData.upsert({
        where: { userId: analysis.userId },
        update: {
          crossDeckInsights: {
            personalizedMetaAnalysis: analysis
          },
          lastUpdated: new Date()
        },
        create: {
          id: crypto.randomUUID(),
          userId: analysis.userId,
          styleProfile: {},
          deckPreferences: {},
          learningEvents: [],
          suggestionFeedback: [],
          deckRelationships: {},
          crossDeckInsights: {
            personalizedMetaAnalysis: analysis
          },
          lastUpdated: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to store personalized meta analysis:', error)
    }
  }

  /**
   * Get user profile
   */
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

  /**
   * Get meta evolution insights for user
   */
  async getMetaEvolutionInsights(userId: string): Promise<{
    metaShifts: Array<{ period: string; changes: string[] }>
    adaptationSuccess: number
    recommendedFocus: string[]
    upcomingThreats: string[]
  }> {
    const analysis = await this.generatePersonalizedMetaAnalysis(userId)
    
    // This would analyze how the user's local meta has evolved over time
    // For now, return basic insights
    return {
      metaShifts: [
        {
          period: 'Last 30 days',
          changes: Object.entries(analysis.localMeta.trends)
            .filter(([, trend]) => trend === 'rising')
            .map(([deck]) => `${deck} increasing in popularity`)
        }
      ],
      adaptationSuccess: 0.7,
      recommendedFocus: analysis.personalPerformance.adaptationSuggestions.slice(0, 3),
      upcomingThreats: Object.entries(analysis.localMeta.trends)
        .filter(([, trend]) => trend === 'rising')
        .map(([deck]) => deck)
        .slice(0, 3)
    }
  }
}

export const personalizedMetaAnalyzer = new PersonalizedMetaAnalyzer()
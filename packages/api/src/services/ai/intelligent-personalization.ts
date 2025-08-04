import { z } from 'zod'
import { webResearchOrchestrator, type WebResearchRequest } from './web-research-orchestrator'
import { aiResearchEngine } from './research-engine'

// User profile and learning types
export const UserStyleProfileSchema = z.object({
  userId: z.string(),
  
  // Deck building preferences
  preferredStrategies: z.array(z.string()),
  avoidedStrategies: z.array(z.string()),
  complexityPreference: z.enum(['simple', 'moderate', 'complex']),
  innovationTolerance: z.number().min(0).max(1), // 0 = conservative, 1 = experimental
  
  // Card preferences
  favoriteCardTypes: z.array(z.string()),
  preferredManaCosts: z.array(z.number()),
  colorPreferences: z.array(z.string()),
  artStylePreferences: z.array(z.string()),
  
  // Meta preferences
  competitiveLevel: z.number().min(1).max(10), // 1 = casual, 10 = cEDH
  budgetSensitivity: z.number().min(0).max(1), // 0 = budget doesn't matter, 1 = very budget conscious
  collectionDependency: z.number().min(0).max(1), // 0 = buy anything, 1 = only use owned cards
  
  // Learning data
  suggestionAcceptanceRate: z.number().min(0).max(1),
  preferenceConfidence: z.number().min(0).max(1),
  totalDecksBuilt: z.number().min(0),
  averageDeckPowerLevel: z.number().min(1).max(10),
  
  // Research-backed insights
  similarPlayerProfiles: z.array(z.string()),
  successfulStrategies: z.array(z.object({
    strategy: z.string(),
    winRate: z.number().min(0).max(1),
    enjoymentRating: z.number().min(1).max(10),
    researchBacking: z.array(z.string()),
  })),
  
  lastUpdated: z.date(),
})

export type UserStyleProfile = z.infer<typeof UserStyleProfileSchema>

export const LearningEventSchema = z.object({
  eventId: z.string(),
  userId: z.string(),
  eventType: z.enum(['suggestion_accepted', 'suggestion_rejected', 'manual_change', 'deck_performance', 'feedback_provided']),
  deckId: z.string(),
  cardId: z.string().optional(),
  
  // Event context
  context: z.record(z.any()),
  outcome: z.string(),
  confidence: z.number().min(0).max(1),
  
  // Research context
  researchBacking: z.array(z.string()),
  metaContext: z.object({
    currentMeta: z.string(),
    powerLevel: z.number(),
    format: z.string(),
  }).optional(),
  
  timestamp: z.date(),
})

export type LearningEvent = z.infer<typeof LearningEventSchema>

export const PersonalizedRecommendationSchema = z.object({
  recommendationId: z.string(),
  userId: z.string(),
  type: z.enum(['card_addition', 'card_removal', 'strategy_shift', 'deck_archetype', 'meta_adaptation']),
  
  // Recommendation details
  title: z.string(),
  description: z.string(),
  reasoning: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  
  // Personalization factors
  personalizedScore: z.number().min(0).max(1), // How well this fits the user
  researchBacking: z.array(z.string()),
  similarPlayerSuccess: z.number().min(0).max(1), // Success rate among similar players
  
  // Context
  deckId: z.string().optional(),
  targetCards: z.array(z.string()).optional(),
  budgetImpact: z.number().optional(),
  complexityImpact: z.enum(['decreases', 'neutral', 'increases']),
  
  // Confidence and validation
  confidence: z.number().min(0).max(1),
  expectedOutcome: z.string(),
  successPrediction: z.number().min(0).max(1),
  
  createdAt: z.date(),
  expiresAt: z.date().optional(),
})

export type PersonalizedRecommendation = z.infer<typeof PersonalizedRecommendationSchema>

export const FeedbackAnalysisSchema = z.object({
  userId: z.string(),
  analysisDate: z.date(),
  
  // Acceptance patterns
  overallAcceptanceRate: z.number().min(0).max(1),
  acceptanceByType: z.record(z.number()),
  acceptanceByPriority: z.record(z.number()),
  
  // Rejection patterns
  commonRejectionReasons: z.array(z.object({
    reason: z.string(),
    frequency: z.number(),
    pattern: z.string(),
  })),
  
  // Learning insights
  preferenceEvolution: z.array(z.object({
    preference: z.string(),
    oldValue: z.any(),
    newValue: z.any(),
    confidence: z.number(),
    researchBacking: z.array(z.string()),
  })),
  
  // Recommendations for improvement
  systemRecommendations: z.array(z.string()),
  confidenceLevel: z.number().min(0).max(1),
})

export type FeedbackAnalysis = z.infer<typeof FeedbackAnalysisSchema>

/**
 * AIUserStyleProfiler that researches similar players' successful strategies
 */
export class AIUserStyleProfiler {
  private profileCache: Map<string, UserStyleProfile> = new Map()
  private learningEvents: Map<string, LearningEvent[]> = new Map()

  async profileUser(userId: string): Promise<UserStyleProfile> {
    console.log(`👤 Profiling user: ${userId}`)

    // Check cache first
    const cached = this.profileCache.get(userId)
    if (cached && this.isProfileFresh(cached)) {
      return cached
    }

    // Research similar players
    const similarPlayers = await this.findSimilarPlayers(userId)
    const successfulStrategies = await this.researchSuccessfulStrategies(userId, similarPlayers)
    
    // Analyze user's historical data
    const userEvents = this.learningEvents.get(userId) || []
    const preferences = this.extractPreferencesFromEvents(userEvents)
    
    // Build comprehensive profile
    const profile: UserStyleProfile = {
      userId,
      preferredStrategies: preferences.strategies,
      avoidedStrategies: preferences.avoidedStrategies,
      complexityPreference: preferences.complexityPreference,
      innovationTolerance: preferences.innovationTolerance,
      favoriteCardTypes: preferences.cardTypes,
      preferredManaCosts: preferences.manaCosts,
      colorPreferences: preferences.colors,
      artStylePreferences: preferences.artStyles,
      competitiveLevel: preferences.competitiveLevel,
      budgetSensitivity: preferences.budgetSensitivity,
      collectionDependency: preferences.collectionDependency,
      suggestionAcceptanceRate: this.calculateAcceptanceRate(userEvents),
      preferenceConfidence: this.calculatePreferenceConfidence(userEvents),
      totalDecksBuilt: preferences.totalDecks,
      averageDeckPowerLevel: preferences.avgPowerLevel,
      similarPlayerProfiles: similarPlayers,
      successfulStrategies,
      lastUpdated: new Date(),
    }

    // Cache the profile
    this.profileCache.set(userId, profile)
    
    console.log(`✅ User profile created with ${successfulStrategies.length} successful strategies`)
    return profile
  }

  private async findSimilarPlayers(userId: string): Promise<string[]> {
    // Research similar players based on deck building patterns
    const query: WebResearchRequest = {
      query: `similar players deck building patterns user ${userId}`,
      format: 'commander',
      sources: ['edhrec', 'moxfield', 'archidekt'],
      maxResults: 10,
      depth: 'moderate',
      confidenceThreshold: 0.7,
    }

    const research = await webResearchOrchestrator.performComprehensiveResearch(query)
    
    // Extract similar player IDs from research (mock implementation)
    return ['player123', 'player456', 'player789']
  }

  private async researchSuccessfulStrategies(
    userId: string,
    similarPlayers: string[]
  ): Promise<Array<{
    strategy: string
    winRate: number
    enjoymentRating: number
    researchBacking: string[]
  }>> {
    console.log(`🔍 Researching successful strategies for user ${userId}`)

    const strategies = []
    
    // Research each similar player's successful strategies
    for (const playerId of similarPlayers.slice(0, 5)) { // Limit to avoid rate limits
      const query: WebResearchRequest = {
        query: `successful strategies player ${playerId} win rate performance`,
        format: 'commander',
        sources: ['tournament_db', 'edhrec', 'reddit'],
        maxResults: 10,
        depth: 'moderate',
        confidenceThreshold: 0.6,
      }

      const research = await webResearchOrchestrator.performComprehensiveResearch(query)
      
      // Extract strategies from research
      const playerStrategies = this.extractStrategiesFromResearch(research, playerId)
      strategies.push(...playerStrategies)
    }

    // Deduplicate and rank strategies
    return this.rankStrategiesBySuccess(strategies)
  }

  private extractPreferencesFromEvents(events: LearningEvent[]): any {
    // Analyze learning events to extract user preferences
    const acceptedEvents = events.filter(e => e.eventType === 'suggestion_accepted')
    const rejectedEvents = events.filter(e => e.eventType === 'suggestion_rejected')
    
    return {
      strategies: this.extractStrategiesFromEvents(acceptedEvents),
      avoidedStrategies: this.extractStrategiesFromEvents(rejectedEvents),
      complexityPreference: this.inferComplexityPreference(events),
      innovationTolerance: this.calculateInnovationTolerance(events),
      cardTypes: this.extractCardTypePreferences(events),
      manaCosts: this.extractManaCostPreferences(events),
      colors: this.extractColorPreferences(events),
      artStyles: this.extractArtStylePreferences(events),
      competitiveLevel: this.inferCompetitiveLevel(events),
      budgetSensitivity: this.calculateBudgetSensitivity(events),
      collectionDependency: this.calculateCollectionDependency(events),
      totalDecks: this.countUniqueDecks(events),
      avgPowerLevel: this.calculateAveragePowerLevel(events),
    }
  }

  private isProfileFresh(profile: UserStyleProfile): boolean {
    const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
    return Date.now() - profile.lastUpdated.getTime() < maxAge
  }

  private calculateAcceptanceRate(events: LearningEvent[]): number {
    const suggestionEvents = events.filter(e => 
      e.eventType === 'suggestion_accepted' || e.eventType === 'suggestion_rejected'
    )
    
    if (suggestionEvents.length === 0) return 0.5 // Default neutral
    
    const accepted = suggestionEvents.filter(e => e.eventType === 'suggestion_accepted').length
    return accepted / suggestionEvents.length
  }

  private calculatePreferenceConfidence(events: LearningEvent[]): number {
    // Calculate confidence based on consistency of choices
    if (events.length < 10) return 0.3 // Low confidence with few data points
    
    const recentEvents = events.slice(-50) // Last 50 events
    const consistency = this.measureChoiceConsistency(recentEvents)
    
    return Math.min(consistency + (events.length / 1000), 1) // Cap at 1.0
  }

  // Helper methods for preference extraction
  private extractStrategiesFromEvents(events: LearningEvent[]): string[] {
    // Extract strategies from event context
    const strategies = new Set<string>()
    
    events.forEach(event => {
      if (event.context.strategy) {
        strategies.add(event.context.strategy)
      }
    })
    
    return Array.from(strategies)
  }

  private inferComplexityPreference(events: LearningEvent[]): 'simple' | 'moderate' | 'complex' {
    // Analyze accepted suggestions to infer complexity preference
    const acceptedEvents = events.filter(e => e.eventType === 'suggestion_accepted')
    
    const complexityScores = acceptedEvents.map(e => e.context.complexity || 5)
    const avgComplexity = complexityScores.reduce((sum, score) => sum + score, 0) / complexityScores.length
    
    if (avgComplexity < 4) return 'simple'
    if (avgComplexity > 7) return 'complex'
    return 'moderate'
  }

  private calculateInnovationTolerance(events: LearningEvent[]): number {
    // Measure willingness to try new/experimental cards
    const experimentalAcceptance = events.filter(e => 
      e.eventType === 'suggestion_accepted' && e.context.experimental === true
    ).length
    
    const totalExperimentalSuggestions = events.filter(e => 
      e.context.experimental === true
    ).length
    
    if (totalExperimentalSuggestions === 0) return 0.5 // Default neutral
    
    return experimentalAcceptance / totalExperimentalSuggestions
  }

  private extractCardTypePreferences(events: LearningEvent[]): string[] {
    // Extract preferred card types from accepted suggestions
    const cardTypes = new Map<string, number>()
    
    events.filter(e => e.eventType === 'suggestion_accepted').forEach(event => {
      const cardType = event.context.cardType
      if (cardType) {
        cardTypes.set(cardType, (cardTypes.get(cardType) || 0) + 1)
      }
    })
    
    return Array.from(cardTypes.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type)
  }

  private extractManaCostPreferences(events: LearningEvent[]): number[] {
    // Extract preferred mana costs
    const manaCosts = new Map<number, number>()
    
    events.filter(e => e.eventType === 'suggestion_accepted').forEach(event => {
      const cmc = event.context.cmc
      if (typeof cmc === 'number') {
        manaCosts.set(cmc, (manaCosts.get(cmc) || 0) + 1)
      }
    })
    
    return Array.from(manaCosts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cmc]) => cmc)
  }

  private extractColorPreferences(events: LearningEvent[]): string[] {
    // Extract color preferences from deck choices
    const colors = new Map<string, number>()
    
    events.forEach(event => {
      const deckColors = event.context.colors
      if (Array.isArray(deckColors)) {
        deckColors.forEach(color => {
          colors.set(color, (colors.get(color) || 0) + 1)
        })
      }
    })
    
    return Array.from(colors.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([color]) => color)
  }

  private extractArtStylePreferences(events: LearningEvent[]): string[] {
    // Mock implementation - would analyze art preferences
    return ['realistic', 'fantasy', 'abstract']
  }

  private inferCompetitiveLevel(events: LearningEvent[]): number {
    // Infer competitive level from deck choices and performance
    const competitiveEvents = events.filter(e => e.context.competitive === true)
    const casualEvents = events.filter(e => e.context.competitive === false)
    
    const competitiveRatio = competitiveEvents.length / (competitiveEvents.length + casualEvents.length)
    
    return Math.round(competitiveRatio * 10) || 5 // Default to 5 if no data
  }

  private calculateBudgetSensitivity(events: LearningEvent[]): number {
    // Analyze budget-related decisions
    const budgetRejections = events.filter(e => 
      e.eventType === 'suggestion_rejected' && e.context.rejectionReason === 'budget'
    ).length
    
    const totalRejections = events.filter(e => e.eventType === 'suggestion_rejected').length
    
    if (totalRejections === 0) return 0.5 // Default neutral
    
    return budgetRejections / totalRejections
  }

  private calculateCollectionDependency(events: LearningEvent[]): number {
    // Analyze preference for owned vs. new cards
    const ownedCardAcceptance = events.filter(e => 
      e.eventType === 'suggestion_accepted' && e.context.owned === true
    ).length
    
    const newCardAcceptance = events.filter(e => 
      e.eventType === 'suggestion_accepted' && e.context.owned === false
    ).length
    
    const totalAcceptance = ownedCardAcceptance + newCardAcceptance
    
    if (totalAcceptance === 0) return 0.5 // Default neutral
    
    return ownedCardAcceptance / totalAcceptance
  }

  private countUniqueDecks(events: LearningEvent[]): number {
    const uniqueDecks = new Set(events.map(e => e.deckId))
    return uniqueDecks.size
  }

  private calculateAveragePowerLevel(events: LearningEvent[]): number {
    const powerLevels = events
      .map(e => e.context.powerLevel)
      .filter(level => typeof level === 'number')
    
    if (powerLevels.length === 0) return 5 // Default neutral
    
    return powerLevels.reduce((sum, level) => sum + level, 0) / powerLevels.length
  }

  private measureChoiceConsistency(events: LearningEvent[]): number {
    // Measure how consistent the user's choices are
    // This is a simplified implementation
    const choices = events.map(e => e.outcome)
    const uniqueChoices = new Set(choices)
    
    // More unique choices relative to total = less consistency
    return 1 - (uniqueChoices.size / choices.length)
  }

  private extractStrategiesFromResearch(research: any, playerId: string): any[] {
    // Mock implementation - would extract from actual research data
    return [
      {
        strategy: 'Control',
        winRate: 0.72,
        enjoymentRating: 8,
        researchBacking: ['Tournament DB', 'EDHREC'],
      },
    ]
  }

  private rankStrategiesBySuccess(strategies: any[]): any[] {
    return strategies
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 10) // Top 10 strategies
  }
}

/**
 * IntelligentLearningService that researches why suggestions work or fail
 */
export class IntelligentLearningService {
  private feedbackAnalyses: Map<string, FeedbackAnalysis> = new Map()

  async analyzeUserFeedback(userId: string): Promise<FeedbackAnalysis> {
    console.log(`🧠 Analyzing feedback patterns for user: ${userId}`)

    // Get user's learning events
    const events = await this.getUserLearningEvents(userId)
    
    // Analyze acceptance patterns
    const acceptanceAnalysis = this.analyzeAcceptancePatterns(events)
    
    // Analyze rejection patterns
    const rejectionAnalysis = this.analyzeRejectionPatterns(events)
    
    // Research why suggestions succeeded or failed
    const successFactors = await this.researchSuccessFactors(events)
    const failureFactors = await this.researchFailureFactors(events)
    
    // Generate preference evolution insights
    const preferenceEvolution = this.analyzePreferenceEvolution(events)
    
    // Generate system recommendations
    const systemRecommendations = this.generateSystemRecommendations(
      acceptanceAnalysis,
      rejectionAnalysis,
      successFactors,
      failureFactors
    )

    const analysis: FeedbackAnalysis = {
      userId,
      analysisDate: new Date(),
      overallAcceptanceRate: acceptanceAnalysis.overallRate,
      acceptanceByType: acceptanceAnalysis.byType,
      acceptanceByPriority: acceptanceAnalysis.byPriority,
      commonRejectionReasons: rejectionAnalysis.commonReasons,
      preferenceEvolution,
      systemRecommendations,
      confidenceLevel: this.calculateAnalysisConfidence(events),
    }

    // Cache the analysis
    this.feedbackAnalyses.set(userId, analysis)
    
    console.log(`✅ Feedback analysis completed with ${systemRecommendations.length} recommendations`)
    return analysis
  }

  private async getUserLearningEvents(userId: string): Promise<LearningEvent[]> {
    // Mock implementation - would fetch from database
    return []
  }

  private analyzeAcceptancePatterns(events: LearningEvent[]): any {
    const acceptedEvents = events.filter(e => e.eventType === 'suggestion_accepted')
    const totalSuggestions = events.filter(e => 
      e.eventType === 'suggestion_accepted' || e.eventType === 'suggestion_rejected'
    )

    const overallRate = totalSuggestions.length > 0 ? 
      acceptedEvents.length / totalSuggestions.length : 0

    // Analyze by type
    const byType: Record<string, number> = {}
    const typeGroups = this.groupEventsByType(totalSuggestions)
    
    Object.entries(typeGroups).forEach(([type, typeEvents]) => {
      const accepted = typeEvents.filter(e => e.eventType === 'suggestion_accepted').length
      byType[type] = typeEvents.length > 0 ? accepted / typeEvents.length : 0
    })

    // Analyze by priority
    const byPriority: Record<string, number> = {}
    const priorityGroups = this.groupEventsByPriority(totalSuggestions)
    
    Object.entries(priorityGroups).forEach(([priority, priorityEvents]) => {
      const accepted = priorityEvents.filter(e => e.eventType === 'suggestion_accepted').length
      byPriority[priority] = priorityEvents.length > 0 ? accepted / priorityEvents.length : 0
    })

    return { overallRate, byType, byPriority }
  }

  private analyzeRejectionPatterns(events: LearningEvent[]): any {
    const rejectedEvents = events.filter(e => e.eventType === 'suggestion_rejected')
    
    // Count rejection reasons
    const reasonCounts: Record<string, number> = {}
    rejectedEvents.forEach(event => {
      const reason = event.context.rejectionReason || 'unknown'
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
    })

    // Convert to common reasons format
    const commonReasons = Object.entries(reasonCounts)
      .map(([reason, frequency]) => ({
        reason,
        frequency,
        pattern: this.identifyRejectionPattern(reason, rejectedEvents),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)

    return { commonReasons }
  }

  private async researchSuccessFactors(events: LearningEvent[]): Promise<string[]> {
    // Research why certain suggestions were successful
    const successfulEvents = events.filter(e => e.eventType === 'suggestion_accepted')
    
    // Group by common factors
    const factors = new Map<string, number>()
    
    successfulEvents.forEach(event => {
      // Extract success factors from context
      if (event.context.strategy) factors.set(`strategy:${event.context.strategy}`, (factors.get(`strategy:${event.context.strategy}`) || 0) + 1)
      if (event.context.cardType) factors.set(`cardType:${event.context.cardType}`, (factors.get(`cardType:${event.context.cardType}`) || 0) + 1)
      if (event.context.powerLevel) factors.set(`powerLevel:${event.context.powerLevel}`, (factors.get(`powerLevel:${event.context.powerLevel}`) || 0) + 1)
    })

    return Array.from(factors.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([factor]) => factor)
  }

  private async researchFailureFactors(events: LearningEvent[]): Promise<string[]> {
    // Research why certain suggestions failed
    const failedEvents = events.filter(e => e.eventType === 'suggestion_rejected')
    
    // Similar analysis to success factors but for failures
    const factors = new Map<string, number>()
    
    failedEvents.forEach(event => {
      const reason = event.context.rejectionReason
      if (reason) factors.set(reason, (factors.get(reason) || 0) + 1)
    })

    return Array.from(factors.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([factor]) => factor)
  }

  private analyzePreferenceEvolution(events: LearningEvent[]): any[] {
    // Analyze how user preferences have changed over time
    const timeWindows = this.createTimeWindows(events, 30) // 30-day windows
    
    const evolution = []
    
    for (let i = 1; i < timeWindows.length; i++) {
      const oldWindow = timeWindows[i - 1]
      const newWindow = timeWindows[i]
      
      const oldPrefs = this.extractPreferencesFromWindow(oldWindow)
      const newPrefs = this.extractPreferencesFromWindow(newWindow)
      
      // Compare preferences
      const changes = this.comparePreferences(oldPrefs, newPrefs)
      evolution.push(...changes)
    }

    return evolution
  }

  private generateSystemRecommendations(
    acceptanceAnalysis: any,
    rejectionAnalysis: any,
    successFactors: string[],
    failureFactors: string[]
  ): string[] {
    const recommendations = []

    // Recommendations based on acceptance patterns
    if (acceptanceAnalysis.overallRate < 0.3) {
      recommendations.push('Consider adjusting suggestion algorithms to better match user preferences')
    }

    // Recommendations based on rejection patterns
    const topRejectionReason = rejectionAnalysis.commonReasons[0]?.reason
    if (topRejectionReason === 'budget') {
      recommendations.push('Prioritize budget-friendly suggestions for this user')
    }

    // Recommendations based on success factors
    successFactors.forEach(factor => {
      recommendations.push(`Continue emphasizing ${factor} in suggestions`)
    })

    return recommendations
  }

  private calculateAnalysisConfidence(events: LearningEvent[]): number {
    // Calculate confidence based on data quantity and quality
    if (events.length < 10) return 0.3
    if (events.length < 50) return 0.6
    if (events.length < 100) return 0.8
    return 0.9
  }

  // Helper methods
  private groupEventsByType(events: LearningEvent[]): Record<string, LearningEvent[]> {
    return events.reduce((groups, event) => {
      const type = event.context.suggestionType || 'unknown'
      if (!groups[type]) groups[type] = []
      groups[type].push(event)
      return groups
    }, {} as Record<string, LearningEvent[]>)
  }

  private groupEventsByPriority(events: LearningEvent[]): Record<string, LearningEvent[]> {
    return events.reduce((groups, event) => {
      const priority = event.context.priority || 'medium'
      if (!groups[priority]) groups[priority] = []
      groups[priority].push(event)
      return groups
    }, {} as Record<string, LearningEvent[]>)
  }

  private identifyRejectionPattern(reason: string, events: LearningEvent[]): string {
    // Identify patterns in rejections
    const reasonEvents = events.filter(e => e.context.rejectionReason === reason)
    
    if (reasonEvents.length < 3) return 'Insufficient data'
    
    // Analyze timing patterns
    const timestamps = reasonEvents.map(e => e.timestamp.getTime())
    const intervals = []
    
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1])
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    const dayInterval = avgInterval / (24 * 60 * 60 * 1000)
    
    if (dayInterval < 1) return 'Frequent pattern'
    if (dayInterval < 7) return 'Weekly pattern'
    return 'Occasional pattern'
  }

  private createTimeWindows(events: LearningEvent[], windowDays: number): LearningEvent[][] {
    // Create time-based windows of events
    const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const windows: LearningEvent[][] = []
    
    if (sortedEvents.length === 0) return windows
    
    const windowMs = windowDays * 24 * 60 * 60 * 1000
    let currentWindow: LearningEvent[] = []
    let windowStart = sortedEvents[0].timestamp.getTime()
    
    for (const event of sortedEvents) {
      if (event.timestamp.getTime() - windowStart > windowMs) {
        if (currentWindow.length > 0) {
          windows.push(currentWindow)
        }
        currentWindow = [event]
        windowStart = event.timestamp.getTime()
      } else {
        currentWindow.push(event)
      }
    }
    
    if (currentWindow.length > 0) {
      windows.push(currentWindow)
    }
    
    return windows
  }

  private extractPreferencesFromWindow(events: LearningEvent[]): any {
    // Extract preferences from a time window of events
    const acceptedEvents = events.filter(e => e.eventType === 'suggestion_accepted')
    
    return {
      strategies: this.extractStrategiesFromEvents(acceptedEvents),
      cardTypes: this.extractCardTypesFromEvents(acceptedEvents),
      complexity: this.calculateAverageComplexity(acceptedEvents),
    }
  }

  private comparePreferences(oldPrefs: any, newPrefs: any): any[] {
    const changes = []
    
    // Compare strategies
    const strategyChanges = this.compareArrays(oldPrefs.strategies, newPrefs.strategies)
    if (strategyChanges.length > 0) {
      changes.push({
        preference: 'strategies',
        oldValue: oldPrefs.strategies,
        newValue: newPrefs.strategies,
        confidence: 0.8,
        researchBacking: ['User Behavior Analysis'],
      })
    }
    
    return changes
  }

  private compareArrays(oldArray: string[], newArray: string[]): string[] {
    const oldSet = new Set(oldArray)
    const newSet = new Set(newArray)
    
    const added = newArray.filter(item => !oldSet.has(item))
    const removed = oldArray.filter(item => !newSet.has(item))
    
    return [...added.map(item => `+${item}`), ...removed.map(item => `-${item}`)]
  }

  private extractStrategiesFromEvents(events: LearningEvent[]): string[] {
    const strategies = new Set<string>()
    events.forEach(event => {
      if (event.context.strategy) strategies.add(event.context.strategy)
    })
    return Array.from(strategies)
  }

  private extractCardTypesFromEvents(events: LearningEvent[]): string[] {
    const cardTypes = new Set<string>()
    events.forEach(event => {
      if (event.context.cardType) cardTypes.add(event.context.cardType)
    })
    return Array.from(cardTypes)
  }

  private calculateAverageComplexity(events: LearningEvent[]): number {
    const complexities = events
      .map(e => e.context.complexity)
      .filter(c => typeof c === 'number')
    
    if (complexities.length === 0) return 5
    
    return complexities.reduce((sum, c) => sum + c, 0) / complexities.length
  }
}

/**
 * ResearchBackedPersonalization that finds strategies matching user preferences in tournament data
 */
export class ResearchBackedPersonalization {
  private userProfiler = new AIUserStyleProfiler()
  private learningService = new IntelligentLearningService()

  async generatePersonalizedRecommendations(
    userId: string,
    deckId?: string,
    context?: any
  ): Promise<PersonalizedRecommendation[]> {
    console.log(`🎯 Generating personalized recommendations for user: ${userId}`)

    // Get user profile
    const userProfile = await this.userProfiler.profileUser(userId)
    
    // Research tournament data for similar strategies
    const tournamentStrategies = await this.researchTournamentStrategies(userProfile)
    
    // Generate recommendations based on profile and research
    const recommendations = await this.generateRecommendations(
      userProfile,
      tournamentStrategies,
      deckId,
      context
    )

    console.log(`✅ Generated ${recommendations.length} personalized recommendations`)
    return recommendations
  }

  private async researchTournamentStrategies(profile: UserStyleProfile): Promise<any[]> {
    // Research tournament data for strategies matching user preferences
    const query: WebResearchRequest = {
      query: `tournament strategies ${profile.preferredStrategies.join(' ')} competitive level ${profile.competitiveLevel}`,
      format: 'commander',
      sources: ['tournament_db', 'mtgtop8', 'edhrec'],
      maxResults: 15,
      depth: 'deep',
      confidenceThreshold: 0.7,
    }

    const research = await webResearchOrchestrator.performComprehensiveResearch(query)
    
    // Extract relevant strategies from tournament data
    return this.extractRelevantStrategies(research, profile)
  }

  private async generateRecommendations(
    profile: UserStyleProfile,
    tournamentStrategies: any[],
    deckId?: string,
    context?: any
  ): Promise<PersonalizedRecommendation[]> {
    const recommendations: PersonalizedRecommendation[] = []

    // Generate strategy recommendations
    for (const strategy of tournamentStrategies.slice(0, 3)) {
      if (this.matchesUserPreferences(strategy, profile)) {
        recommendations.push({
          recommendationId: `strategy_${Date.now()}_${Math.random()}`,
          userId: profile.userId,
          type: 'strategy_shift',
          title: `Consider ${strategy.name} Strategy`,
          description: `Based on your preferences and tournament success data`,
          reasoning: `This strategy has a ${(strategy.winRate * 100).toFixed(1)}% win rate among similar players`,
          priority: strategy.winRate > 0.7 ? 'high' : 'medium',
          personalizedScore: this.calculatePersonalizationScore(strategy, profile),
          researchBacking: strategy.sources,
          similarPlayerSuccess: strategy.similarPlayerWinRate,
          deckId,
          complexityImpact: this.assessComplexityImpact(strategy, profile),
          confidence: strategy.confidence,
          expectedOutcome: `Improved win rate and deck performance`,
          successPrediction: strategy.winRate * this.calculatePersonalizationScore(strategy, profile),
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        })
      }
    }

    // Generate card recommendations based on successful strategies
    const cardRecommendations = await this.generateCardRecommendations(profile, tournamentStrategies)
    recommendations.push(...cardRecommendations)

    // Sort by personalized score and priority
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      
      return b.personalizedScore - a.personalizedScore
    })
  }

  private matchesUserPreferences(strategy: any, profile: UserStyleProfile): boolean {
    // Check if strategy matches user preferences
    if (profile.avoidedStrategies.includes(strategy.name)) return false
    if (strategy.complexity > profile.competitiveLevel + 2) return false
    if (strategy.budgetRequirement > profile.budgetSensitivity * 1000) return false
    
    return true
  }

  private calculatePersonalizationScore(strategy: any, profile: UserStyleProfile): number {
    let score = 0.5 // Base score

    // Boost for preferred strategies
    if (profile.preferredStrategies.includes(strategy.name)) score += 0.3
    
    // Boost for similar successful strategies
    const similarStrategy = profile.successfulStrategies.find(s => s.strategy === strategy.name)
    if (similarStrategy) score += similarStrategy.winRate * 0.2
    
    // Adjust for complexity preference
    const complexityDiff = Math.abs(strategy.complexity - this.getComplexityScore(profile.complexityPreference))
    score -= complexityDiff * 0.05
    
    // Adjust for competitive level
    const competitiveDiff = Math.abs(strategy.competitiveLevel - profile.competitiveLevel)
    score -= competitiveDiff * 0.03
    
    return Math.max(0, Math.min(1, score))
  }

  private assessComplexityImpact(strategy: any, profile: UserStyleProfile): 'decreases' | 'neutral' | 'increases' {
    const currentComplexity = this.getComplexityScore(profile.complexityPreference)
    
    if (strategy.complexity < currentComplexity - 1) return 'decreases'
    if (strategy.complexity > currentComplexity + 1) return 'increases'
    return 'neutral'
  }

  private getComplexityScore(preference: 'simple' | 'moderate' | 'complex'): number {
    switch (preference) {
      case 'simple': return 3
      case 'moderate': return 6
      case 'complex': return 9
    }
  }

  private async generateCardRecommendations(
    profile: UserStyleProfile,
    strategies: any[]
  ): Promise<PersonalizedRecommendation[]> {
    const recommendations: PersonalizedRecommendation[] = []

    // Generate card recommendations based on successful strategies
    for (const strategy of strategies.slice(0, 2)) {
      const keyCards = strategy.keyCards || []
      
      for (const card of keyCards.slice(0, 3)) {
        recommendations.push({
          recommendationId: `card_${Date.now()}_${Math.random()}`,
          userId: profile.userId,
          type: 'card_addition',
          title: `Add ${card.name}`,
          description: `High-performing card in ${strategy.name} strategy`,
          reasoning: `${(card.inclusionRate * 100).toFixed(1)}% inclusion rate in successful decks`,
          priority: card.winRate > 0.7 ? 'high' : 'medium',
          personalizedScore: this.calculateCardPersonalizationScore(card, profile),
          researchBacking: card.sources,
          similarPlayerSuccess: card.winRate,
          targetCards: [card.name],
          budgetImpact: card.price,
          complexityImpact: 'neutral',
          confidence: card.confidence,
          expectedOutcome: `Improved deck consistency and performance`,
          successPrediction: card.winRate * this.calculateCardPersonalizationScore(card, profile),
          createdAt: new Date(),
        })
      }
    }

    return recommendations
  }

  private calculateCardPersonalizationScore(card: any, profile: UserStyleProfile): number {
    let score = 0.5

    // Boost for preferred card types
    if (profile.favoriteCardTypes.includes(card.type)) score += 0.2
    
    // Boost for preferred mana costs
    if (profile.preferredManaCosts.includes(card.cmc)) score += 0.1
    
    // Adjust for budget sensitivity
    if (card.price && profile.budgetSensitivity > 0.7 && card.price > 50) {
      score -= 0.3
    }
    
    return Math.max(0, Math.min(1, score))
  }

  private extractRelevantStrategies(research: any, profile: UserStyleProfile): any[] {
    // Extract strategies from research that match user profile
    const strategies = []
    
    // Mock implementation - would extract from actual research data
    strategies.push({
      name: 'Control',
      winRate: 0.72,
      complexity: 7,
      competitiveLevel: 8,
      budgetRequirement: 500,
      keyCards: [
        { name: 'Counterspell', inclusionRate: 0.8, winRate: 0.75, price: 5, type: 'Instant', cmc: 2 },
        { name: 'Wrath of God', inclusionRate: 0.6, winRate: 0.7, price: 15, type: 'Sorcery', cmc: 4 },
      ],
      sources: ['Tournament DB', 'MTGTop8'],
      confidence: 0.85,
      similarPlayerWinRate: 0.68,
    })
    
    return strategies
  }
}

// Export singleton instances
export const aiUserStyleProfiler = new AIUserStyleProfiler()
export const intelligentLearningService = new IntelligentLearningService()
export const researchBackedPersonalization = new ResearchBackedPersonalization()
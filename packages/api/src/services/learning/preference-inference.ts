import { prisma as db } from '@moxmuse/db'
import type { 
  LearningEvent, 
  PreferenceInference, 
  UserStyleProfile,
  UserBehaviorPattern
} from '../../types/learning'
import { learningEventTracker } from './learning-event-tracker'

export class PreferenceInferenceEngine {
  /**
   * Infer user preferences from learning events
   */
  async inferUserPreferences(userId: string): Promise<UserStyleProfile> {
    const events = await learningEventTracker.getUserLearningEvents(userId)
    const existingProfile = await this.getExistingProfile(userId)
    
    // Analyze different types of preferences
    const [
      strategyPreferences,
      complexityPreference,
      cardTypePreferences,
      manaCostPreferences,
      competitiveLevel,
      budgetSensitivity,
      collectionDependency
    ] = await Promise.all([
      this.inferStrategyPreferences(events),
      this.inferComplexityPreference(events),
      this.inferCardTypePreferences(events),
      this.inferManaCostPreferences(events),
      this.inferCompetitiveLevel(events),
      this.inferBudgetSensitivity(events),
      this.inferCollectionDependency(events)
    ])

    const stats = await learningEventTracker.getUserLearningStats(userId)

    const profile: UserStyleProfile = {
      userId,
      preferredStrategies: strategyPreferences.preferred,
      avoidedStrategies: strategyPreferences.avoided,
      complexityPreference,
      innovationTolerance: this.calculateInnovationTolerance(events),
      favoriteCardTypes: cardTypePreferences,
      preferredManaCosts: manaCostPreferences,
      competitiveLevel,
      budgetSensitivity,
      collectionDependency,
      suggestionAcceptanceRate: stats.suggestionAcceptanceRate,
      preferenceConfidence: this.calculateOverallConfidence(events),
      lastUpdated: new Date()
    }

    // Update database
    await this.updateUserProfile(profile)
    
    return profile
  }

  /**
   * Infer strategy preferences from user behavior
   */
  private async inferStrategyPreferences(events: LearningEvent[]): Promise<{
    preferred: string[]
    avoided: string[]
  }> {
    const strategyEvents = events.filter(e => 
      e.context.strategy || e.context.strategyType || e.context.deckStrategy
    )

    const strategyScores: Record<string, { positive: number; negative: number; total: number }> = {}

    for (const event of strategyEvents) {
      const strategy = event.context.strategy || event.context.strategyType || event.context.deckStrategy
      if (!strategy) continue

      if (!strategyScores[strategy]) {
        strategyScores[strategy] = { positive: 0, negative: 0, total: 0 }
      }

      strategyScores[strategy].total++

      // Score based on event type and outcome
      if (event.eventType === 'suggestion_feedback') {
        if (event.outcome === 'accepted' || event.outcome === 'modified') {
          strategyScores[strategy].positive += (event.confidence || 0.5) * 2
        } else if (event.outcome === 'rejected') {
          strategyScores[strategy].negative += (event.confidence || 0.5) * 2
        }
      } else if (event.eventType === 'manual_change') {
        if (event.context.changeType === 'strategy_changed') {
          if (event.context.newValue === strategy) {
            strategyScores[strategy].positive += 1
          } else if (event.context.previousValue === strategy) {
            strategyScores[strategy].negative += 1
          }
        }
      } else if (event.eventType === 'deck_performance') {
        if (event.outcome === 'win') {
          strategyScores[strategy].positive += (event.confidence || 0.5)
        } else if (event.outcome === 'loss') {
          strategyScores[strategy].negative += (event.confidence || 0.5) * 0.5
        }
      }
    }

    // Calculate preference scores
    const strategies = Object.entries(strategyScores).map(([strategy, scores]) => ({
      strategy,
      score: (scores.positive - scores.negative) / Math.max(scores.total, 1),
      confidence: Math.min(scores.total / 10, 1) // More interactions = higher confidence
    }))

    const preferred = strategies
      .filter(s => s.score > 0.3 && s.confidence > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.strategy)

    const avoided = strategies
      .filter(s => s.score < -0.3 && s.confidence > 0.2)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(s => s.strategy)

    return { preferred, avoided }
  }

  /**
   * Infer complexity preference from user interactions
   */
  private inferComplexityPreference(events: LearningEvent[]): 'simple' | 'moderate' | 'complex' {
    const complexityEvents = events.filter(e => 
      e.context.complexity || e.context.cardComplexity || e.context.strategyComplexity
    )

    if (complexityEvents.length < 5) {
      return 'moderate' // Default for new users
    }

    const complexityScores = { simple: 0, moderate: 0, complex: 0 }

    for (const event of complexityEvents) {
      const complexity = event.context.complexity || event.context.cardComplexity || event.context.strategyComplexity
      const weight = event.confidence || 0.5

      if (event.eventType === 'suggestion_feedback') {
        if (event.outcome === 'accepted' || event.outcome === 'modified') {
          complexityScores[complexity as keyof typeof complexityScores] += weight
        } else if (event.outcome === 'rejected') {
          complexityScores[complexity as keyof typeof complexityScores] -= weight * 0.5
        }
      }
    }

    // Return the complexity level with the highest score
    return Object.entries(complexityScores).reduce((a, b) => 
      complexityScores[a[0] as keyof typeof complexityScores] > complexityScores[b[0] as keyof typeof complexityScores] ? a : b
    )[0] as 'simple' | 'moderate' | 'complex'
  }

  /**
   * Infer favorite card types from user behavior
   */
  private inferCardTypePreferences(events: LearningEvent[]): string[] {
    const cardTypeEvents = events.filter(e => e.cardId && e.context.cardType)
    const typeScores: Record<string, number> = {}

    for (const event of cardTypeEvents) {
      const cardType = event.context.cardType
      if (!cardType) continue

      if (!typeScores[cardType]) {
        typeScores[cardType] = 0
      }

      const weight = event.confidence || 0.5

      if (event.eventType === 'suggestion_feedback' && event.outcome === 'accepted') {
        typeScores[cardType] += weight
      } else if (event.eventType === 'manual_change' && event.context.changeType === 'card_added') {
        typeScores[cardType] += weight * 0.8
      } else if (event.eventType === 'user_interaction' && event.context.action === 'card_favorited') {
        typeScores[cardType] += 1
      }
    }

    return Object.entries(typeScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type)
  }

  /**
   * Infer preferred mana costs from user behavior
   */
  private inferManaCostPreferences(events: LearningEvent[]): number[] {
    const manaCostEvents = events.filter(e => e.cardId && e.context.manaCost !== undefined)
    const costScores: Record<number, number> = {}

    for (const event of manaCostEvents) {
      const manaCost = event.context.manaCost
      if (manaCost === undefined) continue

      if (!costScores[manaCost]) {
        costScores[manaCost] = 0
      }

      const weight = event.confidence || 0.5

      if (event.eventType === 'suggestion_feedback' && event.outcome === 'accepted') {
        costScores[manaCost] += weight
      } else if (event.eventType === 'manual_change' && event.context.changeType === 'card_added') {
        costScores[manaCost] += weight * 0.8
      }
    }

    return Object.entries(costScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([cost]) => parseInt(cost))
  }

  /**
   * Infer competitive level from user behavior
   */
  private inferCompetitiveLevel(events: LearningEvent[]): number {
    const competitiveEvents = events.filter(e => 
      e.context.powerLevel || e.context.competitiveLevel || e.eventType === 'deck_performance'
    )

    if (competitiveEvents.length < 3) {
      return 0.5 // Default moderate competitive level
    }

    let totalScore = 0
    let eventCount = 0

    for (const event of competitiveEvents) {
      if (event.context.powerLevel) {
        totalScore += event.context.powerLevel / 10 // Normalize to 0-1
        eventCount++
      } else if (event.context.competitiveLevel) {
        totalScore += event.context.competitiveLevel
        eventCount++
      } else if (event.eventType === 'deck_performance') {
        // Higher performance suggests higher competitive level
        if (event.outcome === 'win') {
          totalScore += 0.7
        } else if (event.outcome === 'loss') {
          totalScore += 0.3
        } else {
          totalScore += 0.5
        }
        eventCount++
      }
    }

    return eventCount > 0 ? totalScore / eventCount : 0.5
  }

  /**
   * Infer budget sensitivity from user behavior
   */
  private inferBudgetSensitivity(events: LearningEvent[]): number {
    const budgetEvents = events.filter(e => 
      e.context.price || e.context.budget || e.context.costConstraint
    )

    if (budgetEvents.length < 3) {
      return 0.5 // Default moderate budget sensitivity
    }

    let sensitivityScore = 0
    let eventCount = 0

    for (const event of budgetEvents) {
      if (event.eventType === 'suggestion_feedback') {
        if (event.context.price && event.outcome === 'rejected' && event.reason?.includes('expensive')) {
          sensitivityScore += 1
          eventCount++
        } else if (event.context.price && event.outcome === 'accepted') {
          sensitivityScore += 0.3
          eventCount++
        }
      }
    }

    return eventCount > 0 ? Math.min(sensitivityScore / eventCount, 1) : 0.5
  }

  /**
   * Infer collection dependency from user behavior
   */
  private inferCollectionDependency(events: LearningEvent[]): number {
    const collectionEvents = events.filter(e => 
      e.context.owned !== undefined || e.context.inCollection !== undefined
    )

    if (collectionEvents.length < 3) {
      return 0.5 // Default moderate collection dependency
    }

    let dependencyScore = 0
    let eventCount = 0

    for (const event of collectionEvents) {
      if (event.eventType === 'suggestion_feedback') {
        if (event.context.owned === true && event.outcome === 'accepted') {
          dependencyScore += 1
          eventCount++
        } else if (event.context.owned === false && event.outcome === 'rejected') {
          dependencyScore += 0.8
          eventCount++
        }
      }
    }

    return eventCount > 0 ? Math.min(dependencyScore / eventCount, 1) : 0.5
  }

  /**
   * Calculate innovation tolerance from user behavior
   */
  private calculateInnovationTolerance(events: LearningEvent[]): number {
    const innovationEvents = events.filter(e => 
      e.context.isInnovative || e.context.isExperimental || e.context.isUnconventional
    )

    if (innovationEvents.length < 3) {
      return 0.5 // Default moderate innovation tolerance
    }

    let toleranceScore = 0
    let eventCount = 0

    for (const event of innovationEvents) {
      if (event.eventType === 'suggestion_feedback') {
        if (event.outcome === 'accepted' || event.outcome === 'modified') {
          toleranceScore += (event.confidence || 0.5)
        } else if (event.outcome === 'rejected') {
          toleranceScore -= (event.confidence || 0.5) * 0.5
        }
        eventCount++
      }
    }

    return eventCount > 0 ? Math.max(0, Math.min(1, (toleranceScore / eventCount + 1) / 2)) : 0.5
  }

  /**
   * Calculate overall confidence in preferences
   */
  private calculateOverallConfidence(events: LearningEvent[]): number {
    const totalEvents = events.length
    const recentEvents = events.filter(e => 
      new Date(e.timestamp) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length

    // Confidence increases with total events and recent activity
    const eventConfidence = Math.min(totalEvents / 50, 1) // Max confidence at 50 events
    const recencyBonus = Math.min(recentEvents / 10, 0.2) // Up to 20% bonus for recent activity

    return Math.min(eventConfidence + recencyBonus, 1)
  }

  /**
   * Get existing user profile from database
   */
  private async getExistingProfile(userId: string): Promise<UserStyleProfile | null> {
    const userData = await db.userLearningData.findUnique({
      where: { userId }
    })

    return userData?.styleProfile as UserStyleProfile | null
  }

  /**
   * Update user profile in database
   */
  private async updateUserProfile(profile: UserStyleProfile): Promise<void> {
    await db.userLearningData.upsert({
      where: { userId: profile.userId },
      update: {
        styleProfile: profile,
        lastUpdated: new Date()
      },
      create: {
        id: crypto.randomUUID(),
        userId: profile.userId,
        styleProfile: profile,
        deckPreferences: {},
        learningEvents: [],
        suggestionFeedback: [],
        deckRelationships: {},
        crossDeckInsights: {},
        lastUpdated: new Date()
      }
    })
  }

  /**
   * Detect behavior patterns from learning events
   */
  async detectBehaviorPatterns(userId: string): Promise<UserBehaviorPattern[]> {
    const events = await learningEventTracker.getUserLearningEvents(userId)
    const patterns: UserBehaviorPattern[] = []

    // Pattern: Time-based preferences
    const timePattern = this.detectTimeBasedPatterns(events)
    if (timePattern) patterns.push(timePattern)

    // Pattern: Session-based behavior
    const sessionPattern = this.detectSessionPatterns(events)
    if (sessionPattern) patterns.push(sessionPattern)

    // Pattern: Deck-specific preferences
    const deckPatterns = this.detectDeckSpecificPatterns(events)
    patterns.push(...deckPatterns)

    return patterns
  }

  private detectTimeBasedPatterns(events: LearningEvent[]): UserBehaviorPattern | null {
    // Analyze when user is most active and makes best decisions
    const hourlyActivity: Record<number, { count: number; positiveOutcomes: number }> = {}

    for (const event of events) {
      const hour = new Date(event.timestamp).getHours()
      if (!hourlyActivity[hour]) {
        hourlyActivity[hour] = { count: 0, positiveOutcomes: 0 }
      }

      hourlyActivity[hour].count++
      if (event.outcome === 'accepted' || event.outcome === 'win') {
        hourlyActivity[hour].positiveOutcomes++
      }
    }

    const bestHours = Object.entries(hourlyActivity)
      .filter(([, data]) => data.count >= 3) // Minimum activity threshold
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        successRate: data.positiveOutcomes / data.count
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3)

    if (bestHours.length === 0) return null

    return {
      userId: events[0]?.context.userId || '',
      patternType: 'optimal_activity_hours',
      pattern: { bestHours: bestHours.map(h => h.hour) },
      confidence: Math.min(bestHours[0].successRate, 0.9),
      frequency: bestHours.reduce((sum, h) => sum + hourlyActivity[h.hour].count, 0),
      lastObserved: new Date(),
      context: { totalEvents: events.length }
    }
  }

  private detectSessionPatterns(events: LearningEvent[]): UserBehaviorPattern | null {
    // Analyze session length and decision quality correlation
    const sessionData: Record<string, { events: LearningEvent[]; duration?: number }> = {}

    for (const event of events) {
      const sessionId = event.metadata?.sessionId
      if (!sessionId) continue

      if (!sessionData[sessionId]) {
        sessionData[sessionId] = { events: [] }
      }
      sessionData[sessionId].events.push(event)
    }

    // Calculate session durations and success rates
    const sessionAnalysis = Object.values(sessionData)
      .filter(session => session.events.length >= 3)
      .map(session => {
        const events = session.events.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
        const duration = new Date(events[events.length - 1].timestamp).getTime() - 
                        new Date(events[0].timestamp).getTime()
        const positiveOutcomes = events.filter(e => 
          e.outcome === 'accepted' || e.outcome === 'win'
        ).length

        return {
          duration: duration / (1000 * 60), // Convert to minutes
          successRate: positiveOutcomes / events.length,
          eventCount: events.length
        }
      })

    if (sessionAnalysis.length < 3) return null

    const averageDuration = sessionAnalysis.reduce((sum, s) => sum + s.duration, 0) / sessionAnalysis.length
    const averageSuccessRate = sessionAnalysis.reduce((sum, s) => sum + s.successRate, 0) / sessionAnalysis.length

    return {
      userId: events[0]?.context.userId || '',
      patternType: 'session_optimization',
      pattern: { 
        optimalDuration: averageDuration,
        averageSuccessRate,
        recommendedBreakInterval: averageDuration > 30 ? 15 : 10
      },
      confidence: Math.min(sessionAnalysis.length / 10, 0.8),
      frequency: sessionAnalysis.length,
      lastObserved: new Date()
    }
  }

  private detectDeckSpecificPatterns(events: LearningEvent[]): UserBehaviorPattern[] {
    const deckEvents: Record<string, LearningEvent[]> = {}

    for (const event of events) {
      if (!event.deckId) continue
      if (!deckEvents[event.deckId]) {
        deckEvents[event.deckId] = []
      }
      deckEvents[event.deckId].push(event)
    }

    return Object.entries(deckEvents)
      .filter(([, events]) => events.length >= 5)
      .map(([deckId, events]) => {
        const strategies = events
          .map(e => e.context.strategy)
          .filter(Boolean)
        const mostCommonStrategy = this.getMostCommon(strategies)

        const cardTypes = events
          .map(e => e.context.cardType)
          .filter(Boolean)
        const preferredCardTypes = this.getTopN(cardTypes, 3)

        return {
          userId: events[0]?.context.userId || '',
          patternType: 'deck_specific_preferences',
          pattern: {
            deckId,
            preferredStrategy: mostCommonStrategy,
            preferredCardTypes,
            activityLevel: events.length
          },
          confidence: Math.min(events.length / 20, 0.9),
          frequency: events.length,
          lastObserved: new Date(Math.max(...events.map(e => new Date(e.timestamp).getTime()))),
          context: { deckId }
        }
      })
  }

  private getMostCommon<T>(items: T[]): T | null {
    if (items.length === 0) return null
    
    const counts: Record<string, number> = {}
    for (const item of items) {
      const key = String(item)
      counts[key] = (counts[key] || 0) + 1
    }

    const mostCommon = Object.entries(counts).reduce((a, b) => 
      counts[a[0]] > counts[b[0]] ? a : b
    )

    return items.find(item => String(item) === mostCommon[0]) || null
  }

  private getTopN<T>(items: T[], n: number): T[] {
    const counts: Record<string, number> = {}
    for (const item of items) {
      const key = String(item)
      counts[key] = (counts[key] || 0) + 1
    }

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([key]) => items.find(item => String(item) === key))
      .filter(Boolean) as T[]
  }
}

export const preferenceInferenceEngine = new PreferenceInferenceEngine()
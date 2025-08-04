import { prisma as db } from '@moxmuse/db'
import type { 
  LearningEvent, 
  LearningEventType, 
  UserInteraction,
  SuggestionFeedback,
  DeckPerformanceEvent,
  UserBehaviorPattern
} from '../../types/learning'

export interface LearningEventData {
  userId: string
  eventType: LearningEventType
  deckId?: string
  cardId?: string
  suggestionId?: string
  context: Record<string, any>
  outcome?: string
  confidence?: number
  metadata?: Record<string, any>
}

export class LearningEventTracker {
  /**
   * Track user interactions for learning purposes
   */
  async trackUserInteraction(interaction: UserInteraction): Promise<void> {
    const event: LearningEventData = {
      userId: interaction.userId,
      eventType: 'user_interaction',
      deckId: interaction.deckId,
      cardId: interaction.cardId,
      context: {
        action: interaction.action,
        component: interaction.component,
        timestamp: interaction.timestamp,
        sessionId: interaction.sessionId
      },
      metadata: interaction.metadata
    }

    await this.recordLearningEvent(event)
  }

  /**
   * Track suggestion feedback for preference learning
   */
  async trackSuggestionFeedback(feedback: SuggestionFeedback): Promise<void> {
    const event: LearningEventData = {
      userId: feedback.userId,
      eventType: 'suggestion_feedback',
      deckId: feedback.deckId,
      cardId: feedback.cardId,
      suggestionId: feedback.suggestionId,
      context: {
        suggestionType: feedback.suggestionType,
        action: feedback.action,
        reason: feedback.reason,
        alternativeChosen: feedback.alternativeChosen
      },
      outcome: feedback.action,
      confidence: feedback.satisfactionRating ? feedback.satisfactionRating / 5 : undefined,
      metadata: {
        timestamp: feedback.timestamp,
        sessionContext: feedback.sessionContext
      }
    }

    await this.recordLearningEvent(event)
  }

  /**
   * Track deck performance events
   */
  async trackDeckPerformance(performance: DeckPerformanceEvent): Promise<void> {
    const event: LearningEventData = {
      userId: performance.userId,
      eventType: 'deck_performance',
      deckId: performance.deckId,
      context: {
        performanceType: performance.performanceType,
        winRate: performance.winRate,
        gameLength: performance.gameLength,
        opponentDecks: performance.opponentDecks,
        keyCards: performance.keyCards
      },
      outcome: performance.outcome,
      confidence: performance.confidence,
      metadata: {
        timestamp: performance.timestamp,
        gameContext: performance.gameContext
      }
    }

    await this.recordLearningEvent(event)
  }

  /**
   * Track manual deck changes for preference inference
   */
  async trackManualChange(
    userId: string,
    deckId: string,
    changeType: 'card_added' | 'card_removed' | 'card_modified' | 'strategy_changed',
    details: Record<string, any>
  ): Promise<void> {
    const event: LearningEventData = {
      userId,
      eventType: 'manual_change',
      deckId,
      cardId: details.cardId,
      context: {
        changeType,
        previousValue: details.previousValue,
        newValue: details.newValue,
        reason: details.reason
      },
      metadata: {
        timestamp: new Date(),
        changeContext: details.context
      }
    }

    await this.recordLearningEvent(event)
  }

  /**
   * Track strategy evolution events
   */
  async trackStrategyEvolution(
    userId: string,
    deckId: string,
    evolutionType: 'meta_adaptation' | 'power_level_change' | 'budget_adjustment' | 'synergy_discovery',
    details: Record<string, any>
  ): Promise<void> {
    const event: LearningEventData = {
      userId,
      eventType: 'strategy_evolution',
      deckId,
      context: {
        evolutionType,
        previousStrategy: details.previousStrategy,
        newStrategy: details.newStrategy,
        trigger: details.trigger,
        confidence: details.confidence
      },
      outcome: details.outcome,
      metadata: {
        timestamp: new Date(),
        evolutionContext: details.context
      }
    }

    await this.recordLearningEvent(event)
  }

  /**
   * Record learning event to database
   */
  private async recordLearningEvent(event: LearningEventData): Promise<void> {
    try {
      // Store in user_learning_data table
      await db.userLearningData.upsert({
        where: { userId: event.userId },
        update: {
          learningEvents: {
            push: {
              id: crypto.randomUUID(),
              eventType: event.eventType,
              deckId: event.deckId,
              cardId: event.cardId,
              suggestionId: event.suggestionId,
              context: event.context,
              outcome: event.outcome,
              confidence: event.confidence,
              metadata: event.metadata,
              timestamp: new Date()
            }
          },
          lastUpdated: new Date()
        },
        create: {
          id: crypto.randomUUID(),
          userId: event.userId,
          styleProfile: {},
          deckPreferences: {},
          learningEvents: [{
            id: crypto.randomUUID(),
            eventType: event.eventType,
            deckId: event.deckId,
            cardId: event.cardId,
            suggestionId: event.suggestionId,
            context: event.context,
            outcome: event.outcome,
            confidence: event.confidence,
            metadata: event.metadata,
            timestamp: new Date()
          }],
          suggestionFeedback: [],
          deckRelationships: {},
          crossDeckInsights: {},
          lastUpdated: new Date()
        }
      })

      // Also store in separate learning events table for analytics
      await this.storeAnalyticsEvent(event)
    } catch (error) {
      console.error('Failed to record learning event:', error)
      // Don't throw - learning should not break core functionality
    }
  }

  /**
   * Store event for analytics and pattern detection
   */
  private async storeAnalyticsEvent(event: LearningEventData): Promise<void> {
    // This would typically go to a time-series database or analytics service
    // For now, we'll use a simple table structure
    try {
      await db.$executeRaw`
        INSERT INTO learning_events_analytics (
          user_id, event_type, deck_id, card_id, suggestion_id,
          context, outcome, confidence, metadata, timestamp
        ) VALUES (
          ${event.userId}, ${event.eventType}, ${event.deckId}, ${event.cardId}, 
          ${event.suggestionId}, ${JSON.stringify(event.context)}, ${event.outcome},
          ${event.confidence}, ${JSON.stringify(event.metadata)}, NOW()
        )
        ON CONFLICT DO NOTHING
      `
    } catch (error) {
      // Silently fail analytics - core functionality should not be affected
      console.warn('Analytics event storage failed:', error)
    }
  }

  /**
   * Get learning events for a user within a time range
   */
  async getUserLearningEvents(
    userId: string,
    timeRange?: { start: Date; end: Date },
    eventTypes?: LearningEventType[]
  ): Promise<LearningEvent[]> {
    const userData = await db.userLearningData.findUnique({
      where: { userId }
    })

    if (!userData?.learningEvents) {
      return []
    }

    let events = userData.learningEvents as LearningEvent[]

    // Filter by time range
    if (timeRange) {
      events = events.filter(event => {
        const eventTime = new Date(event.timestamp)
        return eventTime >= timeRange.start && eventTime <= timeRange.end
      })
    }

    // Filter by event types
    if (eventTypes && eventTypes.length > 0) {
      events = events.filter(event => eventTypes.includes(event.eventType))
    }

    return events.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }

  /**
   * Get aggregated learning statistics for a user
   */
  async getUserLearningStats(userId: string): Promise<{
    totalEvents: number
    eventsByType: Record<LearningEventType, number>
    suggestionAcceptanceRate: number
    averageConfidence: number
    recentActivity: number
  }> {
    const events = await this.getUserLearningEvents(userId)
    const recentEvents = await this.getUserLearningEvents(userId, {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      end: new Date()
    })

    const eventsByType = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1
      return acc
    }, {} as Record<LearningEventType, number>)

    const suggestionEvents = events.filter(e => e.eventType === 'suggestion_feedback')
    const acceptedSuggestions = suggestionEvents.filter(e => 
      e.outcome === 'accepted' || e.outcome === 'modified'
    )
    const suggestionAcceptanceRate = suggestionEvents.length > 0 
      ? acceptedSuggestions.length / suggestionEvents.length 
      : 0

    const confidenceEvents = events.filter(e => e.confidence !== undefined)
    const averageConfidence = confidenceEvents.length > 0
      ? confidenceEvents.reduce((sum, e) => sum + (e.confidence || 0), 0) / confidenceEvents.length
      : 0

    return {
      totalEvents: events.length,
      eventsByType,
      suggestionAcceptanceRate,
      averageConfidence,
      recentActivity: recentEvents.length
    }
  }
}

export const learningEventTracker = new LearningEventTracker()
import { prisma as db } from '@moxmuse/db'
import type { 
  AdaptiveSuggestion,
  UserStyleProfile,
  LearningEvent,
  DeckRelationship
} from '../../types/learning'
import { learningEventTracker } from './learning-event-tracker'
import { preferenceInferenceEngine } from './preference-inference'
import { openaiService } from '../openai'

export class AdaptiveSuggestionsEngine {
  /**
   * Generate adaptive suggestions that improve over time
   */
  async generateAdaptiveSuggestions(
    userId: string,
    deckId: string,
    context: {
      suggestionType: string
      currentDeck?: any
      budget?: number
      collection?: any[]
      metaContext?: any
    }
  ): Promise<AdaptiveSuggestion[]> {
    // Get user profile and learning history
    const [userProfile, learningEvents, deckRelationships] = await Promise.all([
      preferenceInferenceEngine.inferUserPreferences(userId),
      learningEventTracker.getUserLearningEvents(userId),
      this.getDeckRelationships(userId, deckId)
    ])

    // Generate base suggestions using AI
    const baseSuggestions = await this.generateBaseSuggestions(
      context,
      userProfile,
      learningEvents
    )

    // Personalize suggestions based on learning history
    const personalizedSuggestions = await this.personalizeSuggestions(
      baseSuggestions,
      userProfile,
      learningEvents,
      deckRelationships
    )

    // Score and rank suggestions
    const rankedSuggestions = await this.rankSuggestions(
      personalizedSuggestions,
      userProfile,
      context
    )

    // Store suggestions for feedback tracking
    await this.storeSuggestions(rankedSuggestions)

    return rankedSuggestions
  }

  /**
   * Generate base suggestions using AI
   */
  private async generateBaseSuggestions(
    context: any,
    userProfile: UserStyleProfile,
    learningEvents: LearningEvent[]
  ): Promise<Partial<AdaptiveSuggestion>[]> {
    const prompt = this.buildAdaptivePrompt(context, userProfile, learningEvents)
    
    try {
      const response = await openaiService.generateSuggestions(prompt)
      
      return response.suggestions.map((suggestion: any) => ({
        suggestionType: context.suggestionType,
        suggestion: suggestion.content,
        confidence: suggestion.confidence || 0.5,
        reasoning: suggestion.reasoning || [],
        evidence: this.findSupportingEvidence(suggestion, learningEvents)
      }))
    } catch (error) {
      console.error('Failed to generate base suggestions:', error)
      return []
    }
  }

  /**
   * Personalize suggestions based on user learning history
   */
  private async personalizeSuggestions(
    baseSuggestions: Partial<AdaptiveSuggestion>[],
    userProfile: UserStyleProfile,
    learningEvents: LearningEvent[],
    deckRelationships: DeckRelationship[]
  ): Promise<Partial<AdaptiveSuggestion>[]> {
    return baseSuggestions.map(suggestion => {
      const personalizationScore = this.calculatePersonalizationScore(
        suggestion,
        userProfile,
        learningEvents,
        deckRelationships
      )

      // Adjust confidence based on personalization
      const adjustedConfidence = this.adjustConfidenceForPersonalization(
        suggestion.confidence || 0.5,
        personalizationScore,
        userProfile.preferenceConfidence
      )

      // Add personalized reasoning
      const personalizedReasoning = this.addPersonalizedReasoning(
        suggestion.reasoning || [],
        userProfile,
        learningEvents
      )

      return {
        ...suggestion,
        confidence: adjustedConfidence,
        personalizationScore,
        reasoning: personalizedReasoning
      }
    })
  }

  /**
   * Rank suggestions based on user preferences and context
   */
  private async rankSuggestions(
    suggestions: Partial<AdaptiveSuggestion>[],
    userProfile: UserStyleProfile,
    context: any
  ): Promise<AdaptiveSuggestion[]> {
    const rankedSuggestions = suggestions
      .map(suggestion => ({
        id: crypto.randomUUID(),
        userId: userProfile.userId,
        deckId: context.deckId || '',
        suggestionType: suggestion.suggestionType || context.suggestionType,
        suggestion: suggestion.suggestion || {},
        confidence: suggestion.confidence || 0.5,
        personalizationScore: suggestion.personalizationScore || 0.5,
        reasoning: suggestion.reasoning || [],
        evidence: suggestion.evidence || [],
        createdAt: new Date(),
        expiresAt: this.calculateExpirationDate(suggestion.suggestionType || context.suggestionType)
      }))
      .sort((a, b) => {
        // Primary sort: personalization score
        const personalizationDiff = b.personalizationScore - a.personalizationScore
        if (Math.abs(personalizationDiff) > 0.1) return personalizationDiff

        // Secondary sort: confidence
        const confidenceDiff = b.confidence - a.confidence
        if (Math.abs(confidenceDiff) > 0.1) return confidenceDiff

        // Tertiary sort: evidence strength
        return b.evidence.length - a.evidence.length
      })
      .slice(0, 10) // Limit to top 10 suggestions

    return rankedSuggestions
  }

  /**
   * Calculate personalization score for a suggestion
   */
  private calculatePersonalizationScore(
    suggestion: Partial<AdaptiveSuggestion>,
    userProfile: UserStyleProfile,
    learningEvents: LearningEvent[],
    deckRelationships: DeckRelationship[]
  ): number {
    let score = 0.5 // Base score

    // Strategy alignment
    if (suggestion.suggestion?.strategy) {
      if (userProfile.preferredStrategies.includes(suggestion.suggestion.strategy)) {
        score += 0.2
      } else if (userProfile.avoidedStrategies.includes(suggestion.suggestion.strategy)) {
        score -= 0.3
      }
    }

    // Card type preferences
    if (suggestion.suggestion?.cardType) {
      if (userProfile.favoriteCardTypes.includes(suggestion.suggestion.cardType)) {
        score += 0.15
      }
    }

    // Mana cost preferences
    if (suggestion.suggestion?.manaCost !== undefined) {
      if (userProfile.preferredManaCosts.includes(suggestion.suggestion.manaCost)) {
        score += 0.1
      }
    }

    // Complexity alignment
    if (suggestion.suggestion?.complexity) {
      const complexityMatch = suggestion.suggestion.complexity === userProfile.complexityPreference
      score += complexityMatch ? 0.15 : -0.1
    }

    // Budget sensitivity
    if (suggestion.suggestion?.price !== undefined) {
      const priceScore = this.calculatePriceScore(
        suggestion.suggestion.price,
        userProfile.budgetSensitivity
      )
      score += priceScore * 0.1
    }

    // Collection dependency
    if (suggestion.suggestion?.owned !== undefined) {
      if (suggestion.suggestion.owned && userProfile.collectionDependency > 0.7) {
        score += 0.1
      } else if (!suggestion.suggestion.owned && userProfile.collectionDependency < 0.3) {
        score += 0.05
      }
    }

    // Historical success with similar suggestions
    const historicalScore = this.calculateHistoricalScore(
      suggestion,
      learningEvents
    )
    score += historicalScore * 0.2

    // Cross-deck learning
    const crossDeckScore = this.calculateCrossDeckScore(
      suggestion,
      deckRelationships,
      learningEvents
    )
    score += crossDeckScore * 0.1

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Calculate price score based on budget sensitivity
   */
  private calculatePriceScore(price: number, budgetSensitivity: number): number {
    // Higher budget sensitivity means preference for lower prices
    const priceThreshold = budgetSensitivity * 50 // $0-50 range based on sensitivity
    
    if (price <= priceThreshold) {
      return 1 // Perfect price match
    } else if (price <= priceThreshold * 2) {
      return 0.5 // Acceptable price
    } else {
      return -0.5 // Too expensive
    }
  }

  /**
   * Calculate historical success score
   */
  private calculateHistoricalScore(
    suggestion: Partial<AdaptiveSuggestion>,
    learningEvents: LearningEvent[]
  ): number {
    const similarEvents = learningEvents.filter(event => 
      event.eventType === 'suggestion_feedback' &&
      this.isSimilarSuggestion(event.context, suggestion.suggestion)
    )

    if (similarEvents.length === 0) return 0

    const acceptedEvents = similarEvents.filter(event => 
      event.outcome === 'accepted' || event.outcome === 'modified'
    )

    return acceptedEvents.length / similarEvents.length
  }

  /**
   * Calculate cross-deck learning score
   */
  private calculateCrossDeckScore(
    suggestion: Partial<AdaptiveSuggestion>,
    deckRelationships: DeckRelationship[],
    learningEvents: LearningEvent[]
  ): number {
    // Find similar decks and their successful suggestions
    const relatedDecks = deckRelationships
      .filter(rel => rel.relationshipType === 'similar_strategy')
      .map(rel => rel.deckId2)

    const relatedEvents = learningEvents.filter(event =>
      event.deckId && relatedDecks.includes(event.deckId) &&
      event.eventType === 'suggestion_feedback' &&
      event.outcome === 'accepted'
    )

    const similarSuccessfulEvents = relatedEvents.filter(event =>
      this.isSimilarSuggestion(event.context, suggestion.suggestion)
    )

    return relatedEvents.length > 0 
      ? similarSuccessfulEvents.length / relatedEvents.length 
      : 0
  }

  /**
   * Check if two suggestions are similar
   */
  private isSimilarSuggestion(context1: any, suggestion2: any): boolean {
    // Compare key attributes
    const attributes = ['strategy', 'cardType', 'manaCost', 'category']
    
    let matches = 0
    let comparisons = 0

    for (const attr of attributes) {
      if (context1[attr] !== undefined && suggestion2[attr] !== undefined) {
        comparisons++
        if (context1[attr] === suggestion2[attr]) {
          matches++
        }
      }
    }

    return comparisons > 0 && (matches / comparisons) >= 0.6
  }

  /**
   * Adjust confidence based on personalization
   */
  private adjustConfidenceForPersonalization(
    baseConfidence: number,
    personalizationScore: number,
    userConfidence: number
  ): number {
    // Higher personalization and user confidence boost overall confidence
    const personalizedConfidence = baseConfidence * (0.5 + personalizationScore * 0.5)
    const userAdjustedConfidence = personalizedConfidence * (0.7 + userConfidence * 0.3)
    
    return Math.max(0.1, Math.min(0.95, userAdjustedConfidence))
  }

  /**
   * Add personalized reasoning to suggestions
   */
  private addPersonalizedReasoning(
    baseReasoning: string[],
    userProfile: UserStyleProfile,
    learningEvents: LearningEvent[]
  ): string[] {
    const personalizedReasoning = [...baseReasoning]

    // Add strategy-based reasoning
    if (userProfile.preferredStrategies.length > 0) {
      personalizedReasoning.push(
        `Aligns with your preferred strategies: ${userProfile.preferredStrategies.slice(0, 2).join(', ')}`
      )
    }

    // Add complexity reasoning
    personalizedReasoning.push(
      `Matches your ${userProfile.complexityPreference} complexity preference`
    )

    // Add historical success reasoning
    const recentSuccesses = learningEvents
      .filter(e => 
        e.eventType === 'suggestion_feedback' && 
        e.outcome === 'accepted' &&
        new Date(e.timestamp) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      )
      .length

    if (recentSuccesses > 0) {
      personalizedReasoning.push(
        `Similar to ${recentSuccesses} recent suggestions you accepted`
      )
    }

    return personalizedReasoning
  }

  /**
   * Build adaptive prompt for AI generation
   */
  private buildAdaptivePrompt(
    context: any,
    userProfile: UserStyleProfile,
    learningEvents: LearningEvent[]
  ): string {
    const recentFeedback = learningEvents
      .filter(e => e.eventType === 'suggestion_feedback')
      .slice(0, 10)

    return `
Generate personalized ${context.suggestionType} suggestions for a user with the following profile:

User Preferences:
- Preferred strategies: ${userProfile.preferredStrategies.join(', ')}
- Avoided strategies: ${userProfile.avoidedStrategies.join(', ')}
- Complexity preference: ${userProfile.complexityPreference}
- Favorite card types: ${userProfile.favoriteCardTypes.join(', ')}
- Competitive level: ${userProfile.competitiveLevel}
- Budget sensitivity: ${userProfile.budgetSensitivity}

Recent Feedback:
${recentFeedback.map(e => `- ${e.outcome}: ${JSON.stringify(e.context)}`).join('\n')}

Context:
${JSON.stringify(context, null, 2)}

Generate 5-8 suggestions that:
1. Align with the user's demonstrated preferences
2. Learn from their recent feedback patterns
3. Provide clear reasoning for each suggestion
4. Include confidence scores based on evidence strength

Format as JSON with suggestions array containing: content, confidence, reasoning.
    `.trim()
  }

  /**
   * Find supporting evidence for suggestions
   */
  private findSupportingEvidence(
    suggestion: any,
    learningEvents: LearningEvent[]
  ): LearningEvent[] {
    return learningEvents.filter(event => {
      // Look for events that support this type of suggestion
      if (event.eventType === 'suggestion_feedback' && event.outcome === 'accepted') {
        return this.isSimilarSuggestion(event.context, suggestion.content)
      }
      
      if (event.eventType === 'manual_change' && event.context.changeType === 'card_added') {
        return this.isSimilarSuggestion(event.context, suggestion.content)
      }

      return false
    }).slice(0, 5) // Limit evidence to most relevant events
  }

  /**
   * Calculate expiration date for suggestions
   */
  private calculateExpirationDate(suggestionType: string): Date {
    const now = new Date()
    
    switch (suggestionType) {
      case 'card_recommendation':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
      case 'strategy_adjustment':
        return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days
      case 'meta_adaptation':
        return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days
      case 'budget_optimization':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // Default 7 days
    }
  }

  /**
   * Store suggestions for feedback tracking
   */
  private async storeSuggestions(suggestions: AdaptiveSuggestion[]): Promise<void> {
    try {
      // Store in cache for quick access
      for (const suggestion of suggestions) {
        await db.aiAnalysisCache.create({
          data: {
            id: suggestion.id,
            deckId: suggestion.deckId,
            analysisVersion: 1,
            personalizedInsights: {
              suggestion: suggestion.suggestion,
              confidence: suggestion.confidence,
              personalizationScore: suggestion.personalizationScore,
              reasoning: suggestion.reasoning,
              evidence: suggestion.evidence.map(e => e.id)
            },
            confidenceScore: suggestion.confidence,
            analysisDuration: 0,
            modelVersion: 'adaptive-v1'
          }
        })
      }
    } catch (error) {
      console.error('Failed to store suggestions:', error)
      // Don't throw - this is for tracking only
    }
  }

  /**
   * Get deck relationships for cross-deck learning
   */
  private async getDeckRelationships(userId: string, deckId: string): Promise<DeckRelationship[]> {
    const userData = await db.userLearningData.findUnique({
      where: { userId }
    })

    if (!userData?.deckRelationships) {
      return []
    }

    const relationships = userData.deckRelationships as any
    return Object.values(relationships).filter((rel: any) => 
      rel.deckId1 === deckId || rel.deckId2 === deckId
    ) as DeckRelationship[]
  }

  /**
   * Update suggestion based on user feedback
   */
  async updateSuggestionFromFeedback(
    suggestionId: string,
    feedback: {
      action: 'accepted' | 'rejected' | 'modified' | 'ignored'
      reason?: string
      alternativeChosen?: string
      satisfactionRating?: number
    }
  ): Promise<void> {
    // This will be used to improve future suggestions
    await learningEventTracker.trackSuggestionFeedback({
      userId: '', // Will be filled by the calling service
      deckId: '',
      suggestionId,
      suggestionType: 'adaptive',
      action: feedback.action,
      reason: feedback.reason,
      alternativeChosen: feedback.alternativeChosen,
      satisfactionRating: feedback.satisfactionRating,
      timestamp: new Date()
    })
  }

  /**
   * Get suggestion performance metrics
   */
  async getSuggestionMetrics(userId: string): Promise<{
    totalSuggestions: number
    acceptanceRate: number
    averagePersonalizationScore: number
    topPerformingTypes: string[]
    improvementTrend: number
  }> {
    const events = await learningEventTracker.getUserLearningEvents(
      userId,
      undefined,
      ['suggestion_feedback']
    )

    const suggestionEvents = events.filter(e => e.suggestionId)
    const acceptedEvents = suggestionEvents.filter(e => 
      e.outcome === 'accepted' || e.outcome === 'modified'
    )

    const acceptanceRate = suggestionEvents.length > 0 
      ? acceptedEvents.length / suggestionEvents.length 
      : 0

    // Calculate improvement trend (last 30 days vs previous 30 days)
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const recentEvents = suggestionEvents.filter(e => 
      new Date(e.timestamp) > thirtyDaysAgo
    )
    const previousEvents = suggestionEvents.filter(e => 
      new Date(e.timestamp) > sixtyDaysAgo && new Date(e.timestamp) <= thirtyDaysAgo
    )

    const recentAcceptanceRate = recentEvents.length > 0
      ? recentEvents.filter(e => e.outcome === 'accepted' || e.outcome === 'modified').length / recentEvents.length
      : 0

    const previousAcceptanceRate = previousEvents.length > 0
      ? previousEvents.filter(e => e.outcome === 'accepted' || e.outcome === 'modified').length / previousEvents.length
      : 0

    const improvementTrend = recentAcceptanceRate - previousAcceptanceRate

    return {
      totalSuggestions: suggestionEvents.length,
      acceptanceRate,
      averagePersonalizationScore: 0.7, // Would calculate from stored suggestions
      topPerformingTypes: ['card_recommendation', 'strategy_adjustment'], // Would calculate from data
      improvementTrend
    }
  }
}

export const adaptiveSuggestionsEngine = new AdaptiveSuggestionsEngine()
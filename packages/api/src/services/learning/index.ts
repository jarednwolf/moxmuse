export { learningEventTracker, LearningEventTracker } from './learning-event-tracker'
export { preferenceInferenceEngine, PreferenceInferenceEngine } from './preference-inference'
export { adaptiveSuggestionsEngine, AdaptiveSuggestionsEngine } from './adaptive-suggestions'
export { collectiveLearningEngine, CollectiveLearningEngine } from './collective-learning'
export { strategyEvolutionDetector, StrategyEvolutionDetector } from './strategy-evolution'
export { deckRelationshipMapper, DeckRelationshipMapper } from './deck-relationship-mapping'
export { personalizedMetaAnalyzer, PersonalizedMetaAnalyzer } from './personalized-meta-analysis'
export { adaptiveComplexityEngine, AdaptiveComplexityEngine } from './adaptive-complexity'
export { personalizedBudgetingEngine, PersonalizedBudgetingEngine } from './personalized-budgeting'
export { smartNotificationEngine, SmartNotificationEngine } from './smart-notifications'

// Main learning service that orchestrates all learning components
import { learningEventTracker } from './learning-event-tracker'
import { preferenceInferenceEngine } from './preference-inference'
import { adaptiveSuggestionsEngine } from './adaptive-suggestions'
import { collectiveLearningEngine } from './collective-learning'
import { strategyEvolutionDetector } from './strategy-evolution'
import { deckRelationshipMapper } from './deck-relationship-mapping'
import { personalizedMetaAnalyzer } from './personalized-meta-analysis'
import { adaptiveComplexityEngine } from './adaptive-complexity'
import { personalizedBudgetingEngine } from './personalized-budgeting'
import { smartNotificationEngine } from './smart-notifications'

import type { 
  UserStyleProfile,
  AdaptiveSuggestion,
  CollectiveLearningInsight,
  StrategyEvolution,
  LearningEvent
} from '../../types/learning'

export class IntelligentLearningSystem {
  /**
   * Initialize learning system for a user
   */
  async initializeUserLearning(userId: string): Promise<UserStyleProfile> {
    // Create initial user profile
    const profile = await preferenceInferenceEngine.inferUserPreferences(userId)
    
    // Track initialization event
    await learningEventTracker.trackUserInteraction({
      userId,
      action: 'learning_system_initialized',
      component: 'learning_system',
      timestamp: new Date(),
      sessionId: crypto.randomUUID(),
      metadata: { profileConfidence: profile.preferenceConfidence }
    })

    return profile
  }

  /**
   * Process user interaction and update learning
   */
  async processUserInteraction(interaction: {
    userId: string
    deckId?: string
    cardId?: string
    action: string
    component: string
    context?: Record<string, any>
    sessionId: string
  }): Promise<void> {
    // Track the interaction
    await learningEventTracker.trackUserInteraction({
      ...interaction,
      timestamp: new Date(),
      metadata: interaction.context
    })

    // Update user preferences if significant interaction
    if (this.isSignificantInteraction(interaction.action)) {
      await preferenceInferenceEngine.inferUserPreferences(interaction.userId)
    }
  }

  /**
   * Generate personalized suggestions for a user
   */
  async generatePersonalizedSuggestions(
    userId: string,
    deckId: string,
    suggestionType: string,
    context: Record<string, any>
  ): Promise<AdaptiveSuggestion[]> {
    // Generate adaptive suggestions
    const suggestions = await adaptiveSuggestionsEngine.generateAdaptiveSuggestions(
      userId,
      deckId,
      { suggestionType, ...context }
    )

    // Track suggestion generation
    await learningEventTracker.trackUserInteraction({
      userId,
      deckId,
      action: 'suggestions_generated',
      component: 'adaptive_suggestions',
      timestamp: new Date(),
      sessionId: context.sessionId || crypto.randomUUID(),
      metadata: {
        suggestionType,
        suggestionCount: suggestions.length,
        averageConfidence: suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length
      }
    })

    return suggestions
  }

  /**
   * Process suggestion feedback and learn from it
   */
  async processSuggestionFeedback(feedback: {
    userId: string
    deckId: string
    suggestionId: string
    action: 'accepted' | 'rejected' | 'modified' | 'ignored'
    reason?: string
    alternativeChosen?: string
    satisfactionRating?: number
    sessionContext?: Record<string, any>
  }): Promise<void> {
    // Track suggestion feedback
    await learningEventTracker.trackSuggestionFeedback({
      ...feedback,
      suggestionType: 'adaptive',
      timestamp: new Date()
    })

    // Update adaptive suggestions based on feedback
    await adaptiveSuggestionsEngine.updateSuggestionFromFeedback(
      feedback.suggestionId,
      {
        action: feedback.action,
        reason: feedback.reason,
        alternativeChosen: feedback.alternativeChosen,
        satisfactionRating: feedback.satisfactionRating
      }
    )

    // Update user preferences
    await preferenceInferenceEngine.inferUserPreferences(feedback.userId)
  }

  /**
   * Detect and track deck evolution
   */
  async trackDeckEvolution(
    userId: string,
    deckId: string,
    currentDeckState: any,
    previousDeckState?: any
  ): Promise<StrategyEvolution[]> {
    const evolutions = await strategyEvolutionDetector.detectStrategyEvolution(
      userId,
      deckId,
      currentDeckState,
      previousDeckState
    )

    // Track evolution detection
    if (evolutions.length > 0) {
      await learningEventTracker.trackUserInteraction({
        userId,
        deckId,
        action: 'strategy_evolution_detected',
        component: 'evolution_detector',
        timestamp: new Date(),
        sessionId: crypto.randomUUID(),
        metadata: {
          evolutionCount: evolutions.length,
          evolutionTypes: evolutions.map(e => e.evolutionType),
          averageConfidence: evolutions.reduce((sum, e) => sum + e.confidence, 0) / evolutions.length
        }
      })
    }

    return evolutions
  }

  /**
   * Get collective insights applicable to a user
   */
  async getCollectiveInsights(userId: string): Promise<CollectiveLearningInsight[]> {
    // Get user profile for insight matching
    const userProfile = await preferenceInferenceEngine.inferUserPreferences(userId)
    
    // Get applicable collective insights
    const insights = await collectiveLearningEngine.getApplicableInsights(userProfile)

    // Track insight delivery
    await learningEventTracker.trackUserInteraction({
      userId,
      action: 'collective_insights_delivered',
      component: 'collective_learning',
      timestamp: new Date(),
      sessionId: crypto.randomUUID(),
      metadata: {
        insightCount: insights.length,
        insightTypes: insights.map(i => i.insightType),
        averageConfidence: insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length
      }
    })

    return insights
  }

  /**
   * Generate comprehensive learning report for a user
   */
  async generateLearningReport(userId: string): Promise<{
    userProfile: UserStyleProfile
    learningStats: any
    suggestionMetrics: any
    evolutionTrends: any
    applicableInsights: CollectiveLearningInsight[]
    recommendations: string[]
  }> {
    const [
      userProfile,
      learningStats,
      suggestionMetrics,
      evolutionTrends,
      applicableInsights
    ] = await Promise.all([
      preferenceInferenceEngine.inferUserPreferences(userId),
      learningEventTracker.getUserLearningStats(userId),
      adaptiveSuggestionsEngine.getSuggestionMetrics(userId),
      strategyEvolutionDetector.getEvolutionTrends(userId),
      this.getCollectiveInsights(userId)
    ])

    // Generate personalized recommendations
    const recommendations = this.generateLearningRecommendations(
      userProfile,
      learningStats,
      suggestionMetrics,
      evolutionTrends
    )

    return {
      userProfile,
      learningStats,
      suggestionMetrics,
      evolutionTrends,
      applicableInsights,
      recommendations
    }
  }

  /**
   * Update collective learning insights (run periodically)
   */
  async updateCollectiveLearning(): Promise<CollectiveLearningInsight[]> {
    const insights = await collectiveLearningEngine.generateCollectiveInsights()
    
    // Log collective learning update
    console.log(`Updated collective learning with ${insights.length} insights`)
    
    return insights
  }

  /**
   * Check if an interaction is significant for learning
   */
  private isSignificantInteraction(action: string): boolean {
    const significantActions = [
      'suggestion_accepted',
      'suggestion_rejected',
      'deck_strategy_changed',
      'card_added_manually',
      'card_removed_manually',
      'deck_performance_reported'
    ]
    
    return significantActions.includes(action)
  }

  /**
   * Generate learning recommendations for a user
   */
  private generateLearningRecommendations(
    profile: UserStyleProfile,
    stats: any,
    metrics: any,
    trends: any
  ): string[] {
    const recommendations: string[] = []

    // Profile confidence recommendations
    if (profile.preferenceConfidence < 0.5) {
      recommendations.push('Continue using the system to improve personalization accuracy')
    }

    // Suggestion acceptance recommendations
    if (metrics.acceptanceRate < 0.3) {
      recommendations.push('Try providing feedback on rejected suggestions to improve future recommendations')
    } else if (metrics.acceptanceRate > 0.8) {
      recommendations.push('Consider exploring more innovative suggestions to expand your deck building horizons')
    }

    // Evolution frequency recommendations
    if (trends.evolutionFrequency < 0.5) {
      recommendations.push('Consider experimenting with different strategies to discover new preferences')
    } else if (trends.evolutionFrequency > 3) {
      recommendations.push('Your decks evolve frequently - consider focusing on fewer decks for deeper optimization')
    }

    // Strategy diversity recommendations
    if (profile.preferredStrategies.length < 2) {
      recommendations.push('Try exploring different strategies to broaden your deck building skills')
    }

    // Budget optimization recommendations
    if (profile.budgetSensitivity > 0.7 && metrics.averagePersonalizationScore < 0.6) {
      recommendations.push('Focus on budget-friendly upgrades that align with your preferred strategies')
    }

    return recommendations
  }

  /**
   * Get deck relationship insights for portfolio management
   */
  async getDeckRelationshipInsights(userId: string): Promise<{
    relationships: any[]
    portfolioInsights: any
    crossDeckOptimizations: any[]
  }> {
    const [relationships, portfolioInsights, optimizations] = await Promise.all([
      deckRelationshipMapper.buildDeckRelationships(userId),
      deckRelationshipMapper.getPortfolioInsights(userId),
      deckRelationshipMapper.generateCrossDeckOptimizations(userId)
    ])

    return {
      relationships,
      portfolioInsights,
      crossDeckOptimizations: optimizations
    }
  }

  /**
   * Get personalized meta analysis for user's local environment
   */
  async getPersonalizedMetaAnalysis(userId: string): Promise<any> {
    const analysis = await personalizedMetaAnalyzer.generatePersonalizedMetaAnalysis(userId)
    
    // Track meta analysis request
    await learningEventTracker.trackUserInteraction({
      userId,
      action: 'meta_analysis_requested',
      component: 'personalized_meta',
      timestamp: new Date(),
      sessionId: crypto.randomUUID(),
      metadata: {
        confidence: analysis.confidence,
        localMetaSize: analysis.localMeta.popularDecks.length
      }
    })

    return analysis
  }

  /**
   * Get adaptive complexity assessment and suggestions
   */
  async getAdaptiveComplexityAssessment(userId: string): Promise<any> {
    const assessment = await adaptiveComplexityEngine.assessUserComplexity(userId)
    
    // Track complexity assessment
    await learningEventTracker.trackUserInteraction({
      userId,
      action: 'complexity_assessed',
      component: 'adaptive_complexity',
      timestamp: new Date(),
      sessionId: crypto.randomUUID(),
      metadata: {
        currentLevel: assessment.currentLevel,
        recommendedComplexity: assessment.recommendedComplexity,
        learningVelocity: assessment.learningVelocity
      }
    })

    return assessment
  }

  /**
   * Get personalized budget recommendations
   */
  async getPersonalizedBudget(userId: string): Promise<any> {
    const budget = await personalizedBudgetingEngine.createPersonalizedBudget(userId)
    
    // Track budget analysis request
    await learningEventTracker.trackUserInteraction({
      userId,
      action: 'budget_analysis_requested',
      component: 'personalized_budgeting',
      timestamp: new Date(),
      sessionId: crypto.randomUUID(),
      metadata: {
        totalBudget: budget.totalBudget,
        deckCount: Object.keys(budget.deckBudgets).length,
        upgradeQueueSize: budget.upgradeQueue.length
      }
    })

    return budget
  }

  /**
   * Generate and deliver smart notifications
   */
  async generateSmartNotifications(userId: string): Promise<any[]> {
    const notifications = await smartNotificationEngine.generateSmartNotifications(userId)
    
    // Track notification generation
    await learningEventTracker.trackUserInteraction({
      userId,
      action: 'notifications_generated',
      component: 'smart_notifications',
      timestamp: new Date(),
      sessionId: crypto.randomUUID(),
      metadata: {
        notificationCount: notifications.length,
        notificationTypes: notifications.map(n => n.type),
        highPriorityCount: notifications.filter(n => n.priority === 'high').length
      }
    })

    return notifications
  }

  /**
   * Get complexity-aware suggestions for a user
   */
  async getComplexityAwareSuggestions(
    userId: string,
    context: {
      suggestionType: string
      deckId?: string
      currentComplexity?: 'simple' | 'moderate' | 'complex'
    }
  ): Promise<any[]> {
    const suggestions = await adaptiveComplexityEngine.generateComplexityAwareSuggestions(
      userId,
      context
    )

    // Track complexity-aware suggestion generation
    await learningEventTracker.trackUserInteraction({
      userId,
      deckId: context.deckId,
      action: 'complexity_aware_suggestions_generated',
      component: 'adaptive_complexity',
      timestamp: new Date(),
      sessionId: crypto.randomUUID(),
      metadata: {
        suggestionType: context.suggestionType,
        targetComplexity: context.currentComplexity,
        suggestionCount: suggestions.length
      }
    })

    return suggestions
  }

  /**
   * Get deck-specific meta adaptations
   */
  async getDeckMetaAdaptations(userId: string, deckId: string): Promise<any[]> {
    const adaptations = await personalizedMetaAnalyzer.getDeckMetaAdaptations(userId, deckId)
    
    // Track meta adaptation request
    await learningEventTracker.trackUserInteraction({
      userId,
      deckId,
      action: 'meta_adaptations_requested',
      component: 'personalized_meta',
      timestamp: new Date(),
      sessionId: crypto.randomUUID(),
      metadata: {
        adaptationCount: adaptations.length,
        adaptationTypes: adaptations.map(a => a.type),
        averageImpact: adaptations.reduce((sum, a) => sum + a.impact, 0) / adaptations.length
      }
    })

    return adaptations
  }

  /**
   * Optimize budget allocation for user
   */
  async optimizeBudgetAllocation(userId: string): Promise<any> {
    const optimization = await personalizedBudgetingEngine.optimizeBudgetAllocation(userId)
    
    // Track budget optimization request
    await learningEventTracker.trackUserInteraction({
      userId,
      action: 'budget_optimization_requested',
      component: 'personalized_budgeting',
      timestamp: new Date(),
      sessionId: crypto.randomUUID(),
      metadata: {
        projectedSavings: optimization.projectedSavings,
        projectedImpact: optimization.projectedImpact,
        recommendationCount: optimization.recommendations.length
      }
    })

    return optimization
  }

  /**
   * Get learning system health metrics
   */
  async getSystemHealthMetrics(): Promise<{
    totalUsers: number
    activeUsers: number
    averageEngagement: number
    systemAccuracy: number
    insightGeneration: number
  }> {
    // This would calculate system-wide metrics
    // For now, return mock data
    return {
      totalUsers: 1000,
      activeUsers: 750,
      averageEngagement: 0.65,
      systemAccuracy: 0.78,
      insightGeneration: 0.82
    }
  }
}

export const intelligentLearningSystem = new IntelligentLearningSystem()
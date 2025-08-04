import { z } from 'zod'
import { PromptTemplate } from './prompt-registry'
import { TemplateContext } from './prompt-template-engine'

// User context types
export const UserContextSchema = z.object({
  userId: z.string(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  preferences: z.object({
    communicationStyle: z.enum(['concise', 'detailed', 'balanced']),
    explanationLevel: z.enum(['minimal', 'moderate', 'comprehensive']),
    technicalDepth: z.enum(['basic', 'intermediate', 'expert']),
    preferredFormats: z.array(z.enum(['text', 'json', 'structured', 'bullet_points'])),
    avoidedTopics: z.array(z.string()).optional(),
    favoriteStrategies: z.array(z.string()).optional(),
  }),
  history: z.object({
    totalInteractions: z.number(),
    successfulInteractions: z.number(),
    averageSatisfactionScore: z.number(),
    commonQueries: z.array(z.string()),
    recentFeedback: z.array(z.object({
      timestamp: z.date(),
      rating: z.number().min(1).max(5),
      feedback: z.string().optional(),
    })),
  }),
  learningProfile: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    learningGoals: z.array(z.string()),
    progressMetrics: z.record(z.number()),
  }).optional(),
})

export type UserContext = z.infer<typeof UserContextSchema>

// Session context types
export const SessionContextSchema = z.object({
  sessionId: z.string(),
  startTime: z.date(),
  currentTask: z.string().optional(),
  conversationHistory: z.array(z.object({
    timestamp: z.date(),
    userInput: z.string(),
    aiResponse: z.string(),
    satisfaction: z.number().min(1).max(5).optional(),
  })),
  contextualState: z.record(z.any()),
  goals: z.array(z.string()).optional(),
})

export type SessionContext = z.infer<typeof SessionContextSchema>

// Adaptation strategies
export const AdaptationStrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  triggers: z.array(z.object({
    condition: z.string(),
    threshold: z.number().optional(),
    contextPath: z.string(),
  })),
  adaptations: z.array(z.object({
    type: z.enum(['tone', 'complexity', 'format', 'examples', 'explanation']),
    modification: z.string(),
    priority: z.number(),
  })),
  effectiveness: z.number().min(0).max(1).default(0.5),
})

export type AdaptationStrategy = z.infer<typeof AdaptationStrategySchema>

/**
 * ContextAwarePrompting adapts prompts based on user history, preferences, and session context
 * Provides personalized AI interactions that improve over time
 */
export class ContextAwarePrompting {
  private userContexts: Map<string, UserContext> = new Map()
  private sessionContexts: Map<string, SessionContext> = new Map()
  private adaptationStrategies: Map<string, AdaptationStrategy> = new Map()
  private contextualPatterns: Map<string, ContextualPattern> = new Map()
  private adaptationHistory: Map<string, AdaptationHistory[]> = new Map()

  constructor() {
    this.initializeAdaptationStrategies()
    this.initializeContextualPatterns()
  }

  /**
   * Adapt a prompt template based on user and session context
   */
  adaptPrompt(
    template: PromptTemplate,
    variables: Record<string, any>,
    userId: string,
    sessionId: string
  ): AdaptedPrompt {
    console.log(`🎯 Adapting prompt ${template.id} for user ${userId}`)

    const userContext = this.getUserContext(userId)
    const sessionContext = this.getSessionContext(sessionId)

    // Analyze context for adaptation opportunities
    const adaptationNeeds = this.analyzeAdaptationNeeds(template, userContext, sessionContext)

    // Apply adaptations
    const adaptedTemplate = this.applyAdaptations(template, adaptationNeeds, userContext, sessionContext)

    // Enhance variables with contextual information
    const enhancedVariables = this.enhanceVariablesWithContext(
      variables,
      userContext,
      sessionContext,
      adaptationNeeds
    )

    // Record adaptation for learning
    this.recordAdaptation(userId, sessionId, template.id, adaptationNeeds)

    const result: AdaptedPrompt = {
      originalTemplateId: template.id,
      adaptedTemplate,
      enhancedVariables,
      adaptationsApplied: adaptationNeeds.map(need => need.strategy.name),
      contextFactors: this.getContextFactors(userContext, sessionContext),
      confidence: this.calculateAdaptationConfidence(adaptationNeeds),
    }

    console.log(`✅ Applied ${adaptationNeeds.length} adaptations:`, result.adaptationsApplied)

    return result
  }

  /**
   * Update user context based on interaction feedback
   */
  updateUserContext(
    userId: string,
    feedback: {
      satisfactionScore: number
      feedback?: string
      taskSuccess: boolean
      responseRelevance: number
    }
  ): void {
    const context = this.getUserContext(userId)

    // Update history
    context.history.totalInteractions += 1
    if (feedback.taskSuccess) {
      context.history.successfulInteractions += 1
    }

    // Update satisfaction score (running average)
    const totalScore = context.history.averageSatisfactionScore * (context.history.totalInteractions - 1)
    context.history.averageSatisfactionScore = (totalScore + feedback.satisfactionScore) / context.history.totalInteractions

    // Add recent feedback
    context.history.recentFeedback.push({
      timestamp: new Date(),
      rating: feedback.satisfactionScore,
      feedback: feedback.feedback,
    })

    // Keep only recent feedback (last 50 interactions)
    if (context.history.recentFeedback.length > 50) {
      context.history.recentFeedback = context.history.recentFeedback.slice(-50)
    }

    // Update preferences based on feedback patterns
    this.updatePreferencesFromFeedback(context, feedback)

    // Update learning profile
    this.updateLearningProfile(context, feedback)

    this.userContexts.set(userId, context)

    console.log(`📊 Updated user context for ${userId}:`, {
      totalInteractions: context.history.totalInteractions,
      successRate: context.history.successfulInteractions / context.history.totalInteractions,
      avgSatisfaction: context.history.averageSatisfactionScore,
    })
  }

  /**
   * Update session context with new interaction
   */
  updateSessionContext(
    sessionId: string,
    userInput: string,
    aiResponse: string,
    satisfaction?: number
  ): void {
    const context = this.getSessionContext(sessionId)

    context.conversationHistory.push({
      timestamp: new Date(),
      userInput,
      aiResponse,
      satisfaction,
    })

    // Update contextual state based on conversation
    this.updateContextualState(context, userInput, aiResponse)

    this.sessionContexts.set(sessionId, context)

    console.log(`💬 Updated session context for ${sessionId} (${context.conversationHistory.length} interactions)`)
  }

  /**
   * Get personalized recommendations for a user
   */
  getPersonalizedRecommendations(userId: string): PersonalizedRecommendation[] {
    const userContext = this.getUserContext(userId)
    const recommendations: PersonalizedRecommendation[] = []

    // Analyze user patterns
    const patterns = this.analyzeUserPatterns(userContext)

    // Skill level recommendations
    if (userContext.skillLevel === 'beginner' && userContext.history.totalInteractions > 20) {
      const successRate = userContext.history.successfulInteractions / userContext.history.totalInteractions
      if (successRate > 0.8) {
        recommendations.push({
          type: 'skill_progression',
          title: 'Ready for Intermediate Level',
          description: 'Your success rate suggests you might be ready for more advanced features.',
          priority: 'medium',
          actionable: true,
        })
      }
    }

    // Communication style recommendations
    if (userContext.preferences.communicationStyle === 'detailed' && 
        userContext.history.averageSatisfactionScore < 3.5) {
      recommendations.push({
        type: 'communication_style',
        title: 'Try Concise Responses',
        description: 'Your satisfaction scores suggest you might prefer more concise responses.',
        priority: 'low',
        actionable: true,
      })
    }

    // Strategy recommendations based on patterns
    if (patterns.preferredStrategies.length > 0) {
      recommendations.push({
        type: 'strategy_focus',
        title: 'Explore Related Strategies',
        description: `Based on your interest in ${patterns.preferredStrategies[0]}, you might enjoy similar strategies.`,
        priority: 'low',
        actionable: false,
      })
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * Get context-aware prompt suggestions
   */
  getContextualPromptSuggestions(
    userId: string,
    sessionId: string,
    currentTask?: string
  ): PromptSuggestion[] {
    const userContext = this.getUserContext(userId)
    const sessionContext = this.getSessionContext(sessionId)
    const suggestions: PromptSuggestion[] = []

    // Based on user history
    const commonQueries = userContext.history.commonQueries
    if (commonQueries.length > 0) {
      suggestions.push({
        text: `Similar to your previous query: "${commonQueries[0]}"`,
        confidence: 0.8,
        reasoning: 'Based on your query history',
      })
    }

    // Based on session context
    if (sessionContext.conversationHistory.length > 0) {
      const lastInteraction = sessionContext.conversationHistory[sessionContext.conversationHistory.length - 1]
      suggestions.push({
        text: `Follow up on: "${lastInteraction.userInput.substring(0, 50)}..."`,
        confidence: 0.7,
        reasoning: 'Continue current conversation',
      })
    }

    // Based on skill level
    if (userContext.skillLevel === 'beginner') {
      suggestions.push({
        text: 'Can you explain this in simple terms?',
        confidence: 0.6,
        reasoning: 'Beginner-friendly clarification',
      })
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Analyze user patterns from context
   */
  analyzeUserPatterns(userContext: UserContext): UserPatterns {
    const patterns: UserPatterns = {
      preferredStrategies: [],
      commonMistakes: [],
      learningVelocity: 0,
      engagementLevel: 0,
      satisfactionTrend: 'stable',
    }

    // Analyze favorite strategies
    if (userContext.preferences.favoriteStrategies) {
      patterns.preferredStrategies = userContext.preferences.favoriteStrategies
    }

    // Calculate learning velocity
    if (userContext.learningProfile) {
      const progressValues = Object.values(userContext.learningProfile.progressMetrics)
      patterns.learningVelocity = progressValues.length > 0 
        ? progressValues.reduce((sum, val) => sum + val, 0) / progressValues.length 
        : 0
    }

    // Calculate engagement level
    const totalInteractions = userContext.history.totalInteractions
    const recentInteractions = userContext.history.recentFeedback.length
    patterns.engagementLevel = totalInteractions > 0 ? recentInteractions / Math.min(totalInteractions, 50) : 0

    // Analyze satisfaction trend
    const recentFeedback = userContext.history.recentFeedback.slice(-10)
    if (recentFeedback.length >= 5) {
      const firstHalf = recentFeedback.slice(0, Math.floor(recentFeedback.length / 2))
      const secondHalf = recentFeedback.slice(Math.floor(recentFeedback.length / 2))
      
      const firstAvg = firstHalf.reduce((sum, f) => sum + f.rating, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((sum, f) => sum + f.rating, 0) / secondHalf.length
      
      if (secondAvg > firstAvg + 0.5) patterns.satisfactionTrend = 'improving'
      else if (secondAvg < firstAvg - 0.5) patterns.satisfactionTrend = 'declining'
    }

    return patterns
  }

  /**
   * Get or create user context
   */
  private getUserContext(userId: string): UserContext {
    if (!this.userContexts.has(userId)) {
      const defaultContext: UserContext = {
        userId,
        skillLevel: 'intermediate',
        preferences: {
          communicationStyle: 'balanced',
          explanationLevel: 'moderate',
          technicalDepth: 'intermediate',
          preferredFormats: ['text'],
        },
        history: {
          totalInteractions: 0,
          successfulInteractions: 0,
          averageSatisfactionScore: 3.5,
          commonQueries: [],
          recentFeedback: [],
        },
      }
      this.userContexts.set(userId, defaultContext)
    }
    return this.userContexts.get(userId)!
  }

  /**
   * Get or create session context
   */
  private getSessionContext(sessionId: string): SessionContext {
    if (!this.sessionContexts.has(sessionId)) {
      const defaultContext: SessionContext = {
        sessionId,
        startTime: new Date(),
        conversationHistory: [],
        contextualState: {},
      }
      this.sessionContexts.set(sessionId, defaultContext)
    }
    return this.sessionContexts.get(sessionId)!
  }

  /**
   * Analyze what adaptations are needed
   */
  private analyzeAdaptationNeeds(
    template: PromptTemplate,
    userContext: UserContext,
    sessionContext: SessionContext
  ): AdaptationNeed[] {
    const needs: AdaptationNeed[] = []

    for (const strategy of Array.from(this.adaptationStrategies.values())) {
      const shouldApply = this.shouldApplyStrategy(strategy, userContext, sessionContext, template)
      
      if (shouldApply.apply) {
        needs.push({
          strategy,
          confidence: shouldApply.confidence,
          reasoning: shouldApply.reasoning,
        })
      }
    }

    return needs.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Check if adaptation strategy should be applied
   */
  private shouldApplyStrategy(
    strategy: AdaptationStrategy,
    userContext: UserContext,
    sessionContext: SessionContext,
    template: PromptTemplate
  ): { apply: boolean; confidence: number; reasoning: string } {
    let confidence = 0
    const reasons: string[] = []

    for (const trigger of strategy.triggers) {
      const value = this.getContextValue(trigger.contextPath, userContext, sessionContext)
      
      if (this.evaluateTriggerCondition(trigger.condition, value, trigger.threshold)) {
        confidence += 0.3
        reasons.push(`${trigger.condition} met`)
      }
    }

    // Boost confidence based on strategy effectiveness
    confidence *= strategy.effectiveness

    return {
      apply: confidence > 0.5,
      confidence,
      reasoning: reasons.join(', '),
    }
  }

  /**
   * Apply adaptations to template
   */
  private applyAdaptations(
    template: PromptTemplate,
    adaptationNeeds: AdaptationNeed[],
    userContext: UserContext,
    sessionContext: SessionContext
  ): PromptTemplate {
    let adaptedTemplate = { ...template }

    for (const need of adaptationNeeds) {
      for (const adaptation of need.strategy.adaptations) {
        adaptedTemplate = this.applyAdaptation(adaptedTemplate, adaptation, userContext, sessionContext)
      }
    }

    return adaptedTemplate
  }

  /**
   * Apply a single adaptation to template
   */
  private applyAdaptation(
    template: PromptTemplate,
    adaptation: any,
    userContext: UserContext,
    sessionContext: SessionContext
  ): PromptTemplate {
    const adapted = { ...template }

    switch (adaptation.type) {
      case 'tone':
        adapted.template = this.adaptTone(adapted.template, adaptation.modification, userContext)
        break
      case 'complexity':
        adapted.template = this.adaptComplexity(adapted.template, adaptation.modification, userContext)
        break
      case 'format':
        adapted.template = this.adaptFormat(adapted.template, adaptation.modification, userContext)
        break
      case 'examples':
        adapted.template = this.addExamples(adapted.template, adaptation.modification, userContext)
        break
      case 'explanation':
        adapted.template = this.adaptExplanation(adapted.template, adaptation.modification, userContext)
        break
    }

    return adapted
  }

  /**
   * Enhance variables with contextual information
   */
  private enhanceVariablesWithContext(
    variables: Record<string, any>,
    userContext: UserContext,
    sessionContext: SessionContext,
    adaptationNeeds: AdaptationNeed[]
  ): Record<string, any> {
    const enhanced = { ...variables }

    // Add user context variables
    enhanced.userSkillLevel = userContext.skillLevel
    enhanced.userPreferences = userContext.preferences
    enhanced.userHistory = {
      totalInteractions: userContext.history.totalInteractions,
      successRate: userContext.history.successfulInteractions / Math.max(userContext.history.totalInteractions, 1),
      avgSatisfaction: userContext.history.averageSatisfactionScore,
    }

    // Add session context variables
    enhanced.sessionLength = sessionContext.conversationHistory.length
    enhanced.currentGoals = sessionContext.goals || []

    // Add adaptation context
    enhanced.adaptationsApplied = adaptationNeeds.map(need => need.strategy.name)

    return enhanced
  }

  /**
   * Get context factors that influenced adaptation
   */
  private getContextFactors(userContext: UserContext, sessionContext: SessionContext): string[] {
    const factors: string[] = []

    factors.push(`Skill level: ${userContext.skillLevel}`)
    factors.push(`Communication style: ${userContext.preferences.communicationStyle}`)
    factors.push(`Session length: ${sessionContext.conversationHistory.length} interactions`)
    
    if (userContext.history.totalInteractions > 0) {
      const successRate = userContext.history.successfulInteractions / userContext.history.totalInteractions
      factors.push(`Success rate: ${(successRate * 100).toFixed(1)}%`)
    }

    return factors
  }

  /**
   * Calculate confidence in adaptations
   */
  private calculateAdaptationConfidence(adaptationNeeds: AdaptationNeed[]): number {
    if (adaptationNeeds.length === 0) return 0.5

    const avgConfidence = adaptationNeeds.reduce((sum, need) => sum + need.confidence, 0) / adaptationNeeds.length
    return Math.min(avgConfidence, 1)
  }

  /**
   * Record adaptation for learning
   */
  private recordAdaptation(
    userId: string,
    sessionId: string,
    templateId: string,
    adaptationNeeds: AdaptationNeed[]
  ): void {
    const key = `${userId}:${templateId}`
    const existing = this.adaptationHistory.get(key) || []
    
    existing.push({
      timestamp: new Date(),
      sessionId,
      adaptations: adaptationNeeds.map(need => need.strategy.id),
      confidence: this.calculateAdaptationConfidence(adaptationNeeds),
    })

    this.adaptationHistory.set(key, existing)
  }

  /**
   * Get context value from path
   */
  private getContextValue(
    path: string,
    userContext: UserContext,
    sessionContext: SessionContext
  ): any {
    const parts = path.split('.')
    let current: any = { user: userContext, session: sessionContext }

    for (const part of parts) {
      current = current?.[part]
    }

    return current
  }

  /**
   * Evaluate trigger condition
   */
  private evaluateTriggerCondition(
    condition: string,
    value: any,
    threshold?: number
  ): boolean {
    switch (condition) {
      case 'skill_level_beginner':
        return value === 'beginner'
      case 'skill_level_advanced':
        return value === 'advanced'
      case 'low_satisfaction':
        return typeof value === 'number' && value < (threshold || 3.5)
      case 'high_interaction_count':
        return typeof value === 'number' && value > (threshold || 10)
      case 'prefers_detailed':
        return value === 'detailed'
      case 'prefers_concise':
        return value === 'concise'
      default:
        return false
    }
  }

  /**
   * Adapt tone of template
   */
  private adaptTone(template: string, modification: string, userContext: UserContext): string {
    switch (modification) {
      case 'more_friendly':
        return template.replace(/\./g, '! 😊')
      case 'more_professional':
        return template.replace(/!/g, '.')
      case 'encouraging':
        return template + '\n\nYou\'re doing great! Keep up the good work.'
      default:
        return template
    }
  }

  /**
   * Adapt complexity of template
   */
  private adaptComplexity(template: string, modification: string, userContext: UserContext): string {
    switch (modification) {
      case 'simplify':
        return template + '\n\nPlease explain in simple terms that a beginner can understand.'
      case 'add_technical_detail':
        return template + '\n\nProvide technical details and advanced insights.'
      case 'add_examples':
        return template + '\n\nInclude specific examples to illustrate your points.'
      default:
        return template
    }
  }

  /**
   * Adapt format of template
   */
  private adaptFormat(template: string, modification: string, userContext: UserContext): string {
    switch (modification) {
      case 'bullet_points':
        return template + '\n\nFormat your response as bullet points for clarity.'
      case 'structured':
        return template + '\n\nStructure your response with clear headings and sections.'
      case 'json':
        return template + '\n\nProvide your response in JSON format.'
      default:
        return template
    }
  }

  /**
   * Add examples to template
   */
  private addExamples(template: string, modification: string, userContext: UserContext): string {
    return template + '\n\nInclude relevant examples to help illustrate your recommendations.'
  }

  /**
   * Adapt explanation level
   */
  private adaptExplanation(template: string, modification: string, userContext: UserContext): string {
    switch (modification) {
      case 'more_explanation':
        return template + '\n\nProvide detailed explanations for your recommendations.'
      case 'less_explanation':
        return template + '\n\nBe concise and focus on the key points.'
      default:
        return template
    }
  }

  /**
   * Update preferences from feedback
   */
  private updatePreferencesFromFeedback(
    context: UserContext,
    feedback: { satisfactionScore: number; feedback?: string }
  ): void {
    // Simple preference learning based on satisfaction
    if (feedback.satisfactionScore >= 4) {
      // User was satisfied, reinforce current preferences
      // In a more sophisticated system, this would analyze what worked
    } else if (feedback.satisfactionScore <= 2) {
      // User was unsatisfied, consider adjusting preferences
      if (context.preferences.communicationStyle === 'detailed') {
        context.preferences.communicationStyle = 'balanced'
      } else if (context.preferences.communicationStyle === 'concise') {
        context.preferences.communicationStyle = 'balanced'
      }
    }
  }

  /**
   * Update learning profile
   */
  private updateLearningProfile(
    context: UserContext,
    feedback: { satisfactionScore: number; taskSuccess: boolean }
  ): void {
    if (!context.learningProfile) {
      context.learningProfile = {
        strengths: [],
        weaknesses: [],
        learningGoals: [],
        progressMetrics: {},
      }
    }

    // Update progress metrics
    const currentProgress = context.learningProfile.progressMetrics['overall'] || 0
    const newProgress = feedback.taskSuccess ? currentProgress + 0.1 : Math.max(0, currentProgress - 0.05)
    context.learningProfile.progressMetrics['overall'] = Math.min(1, newProgress)
  }

  /**
   * Update contextual state
   */
  private updateContextualState(
    context: SessionContext,
    userInput: string,
    aiResponse: string
  ): void {
    // Extract entities and topics from conversation
    const topics = this.extractTopics(userInput + ' ' + aiResponse)
    context.contextualState.topics = topics

    // Track conversation flow
    if (!context.contextualState.conversationFlow) {
      context.contextualState.conversationFlow = []
    }
    context.contextualState.conversationFlow.push({
      timestamp: new Date(),
      topic: topics[0] || 'general',
      userIntent: this.classifyUserIntent(userInput),
    })
  }

  /**
   * Extract topics from text (simplified)
   */
  private extractTopics(text: string): string[] {
    const keywords = [
      'commander', 'deck', 'strategy', 'cards', 'synergy', 'combo',
      'aggro', 'control', 'midrange', 'tribal', 'budget', 'competitive'
    ]

    const lowerText = text.toLowerCase()
    return keywords.filter(keyword => lowerText.includes(keyword))
  }

  /**
   * Classify user intent (simplified)
   */
  private classifyUserIntent(input: string): string {
    const lowerInput = input.toLowerCase()
    
    if (lowerInput.includes('recommend') || lowerInput.includes('suggest')) return 'recommendation'
    if (lowerInput.includes('explain') || lowerInput.includes('how')) return 'explanation'
    if (lowerInput.includes('compare') || lowerInput.includes('vs')) return 'comparison'
    if (lowerInput.includes('build') || lowerInput.includes('create')) return 'creation'
    
    return 'general'
  }

  /**
   * Initialize adaptation strategies
   */
  private initializeAdaptationStrategies(): void {
    // Beginner-friendly adaptations
    this.adaptationStrategies.set('beginner-simplification', {
      id: 'beginner-simplification',
      name: 'Beginner Simplification',
      description: 'Simplify language and add explanations for beginners',
      triggers: [
        { condition: 'skill_level_beginner', contextPath: 'user.skillLevel' },
      ],
      adaptations: [
        { type: 'complexity', modification: 'simplify', priority: 1 },
        { type: 'examples', modification: 'add_examples', priority: 2 },
        { type: 'tone', modification: 'encouraging', priority: 3 },
      ],
      effectiveness: 0.8,
    })

    // Advanced user adaptations
    this.adaptationStrategies.set('advanced-detail', {
      id: 'advanced-detail',
      name: 'Advanced Detail',
      description: 'Provide technical depth for advanced users',
      triggers: [
        { condition: 'skill_level_advanced', contextPath: 'user.skillLevel' },
      ],
      adaptations: [
        { type: 'complexity', modification: 'add_technical_detail', priority: 1 },
        { type: 'tone', modification: 'more_professional', priority: 2 },
      ],
      effectiveness: 0.7,
    })

    // Low satisfaction recovery
    this.adaptationStrategies.set('satisfaction-recovery', {
      id: 'satisfaction-recovery',
      name: 'Satisfaction Recovery',
      description: 'Adapt when user satisfaction is low',
      triggers: [
        { condition: 'low_satisfaction', threshold: 3.0, contextPath: 'user.history.averageSatisfactionScore' },
      ],
      adaptations: [
        { type: 'format', modification: 'structured', priority: 1 },
        { type: 'explanation', modification: 'more_explanation', priority: 2 },
        { type: 'tone', modification: 'more_friendly', priority: 3 },
      ],
      effectiveness: 0.6,
    })

    // Communication style adaptations
    this.adaptationStrategies.set('detailed-preference', {
      id: 'detailed-preference',
      name: 'Detailed Communication',
      description: 'Provide detailed responses for users who prefer them',
      triggers: [
        { condition: 'prefers_detailed', contextPath: 'user.preferences.communicationStyle' },
      ],
      adaptations: [
        { type: 'explanation', modification: 'more_explanation', priority: 1 },
        { type: 'examples', modification: 'add_examples', priority: 2 },
      ],
      effectiveness: 0.75,
    })

    this.adaptationStrategies.set('concise-preference', {
      id: 'concise-preference',
      name: 'Concise Communication',
      description: 'Provide concise responses for users who prefer them',
      triggers: [
        { condition: 'prefers_concise', contextPath: 'user.preferences.communicationStyle' },
      ],
      adaptations: [
        { type: 'explanation', modification: 'less_explanation', priority: 1 },
        { type: 'format', modification: 'bullet_points', priority: 2 },
      ],
      effectiveness: 0.75,
    })

    console.log('✅ Initialized adaptation strategies')
  }

  /**
   * Initialize contextual patterns
   */
  private initializeContextualPatterns(): void {
    // Patterns would be learned from user interactions
    // For now, initialize with common patterns
    
    this.contextualPatterns.set('beginner-overwhelm', {
      pattern: 'User is beginner but receiving advanced responses',
      indicators: ['skill_level_beginner', 'low_satisfaction', 'complex_responses'],
      recommendation: 'Simplify responses and add more explanations',
    })

    this.contextualPatterns.set('advanced-boredom', {
      pattern: 'Advanced user receiving basic responses',
      indicators: ['skill_level_advanced', 'declining_satisfaction', 'simple_responses'],
      recommendation: 'Increase technical depth and complexity',
    })

    console.log('✅ Initialized contextual patterns')
  }
}

// Supporting interfaces
interface AdaptedPrompt {
  originalTemplateId: string
  adaptedTemplate: PromptTemplate
  enhancedVariables: Record<string, any>
  adaptationsApplied: string[]
  contextFactors: string[]
  confidence: number
}

interface AdaptationNeed {
  strategy: AdaptationStrategy
  confidence: number
  reasoning: string
}

interface AdaptationHistory {
  timestamp: Date
  sessionId: string
  adaptations: string[]
  confidence: number
}

interface UserPatterns {
  preferredStrategies: string[]
  commonMistakes: string[]
  learningVelocity: number
  engagementLevel: number
  satisfactionTrend: 'improving' | 'stable' | 'declining'
}

interface PersonalizedRecommendation {
  type: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  actionable: boolean
}

interface PromptSuggestion {
  text: string
  confidence: number
  reasoning: string
}

interface ContextualPattern {
  pattern: string
  indicators: string[]
  recommendation: string
}

// Export singleton instance
export const contextAwarePrompting = new ContextAwarePrompting()
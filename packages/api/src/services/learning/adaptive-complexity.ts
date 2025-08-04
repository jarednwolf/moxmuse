import { prisma as db } from '@moxmuse/db'
import type { 
  AdaptiveComplexity,
  UserStyleProfile,
  LearningEvent
} from '../../types/learning'
import { learningEventTracker } from './learning-event-tracker'

export class AdaptiveComplexityEngine {
  /**
   * Assess and adapt complexity matching user skill progression
   */
  async assessUserComplexity(userId: string): Promise<AdaptiveComplexity> {
    // Get user's learning history and current profile
    const [learningEvents, currentProfile] = await Promise.all([
      learningEventTracker.getUserLearningEvents(userId),
      this.getCurrentProfile(userId)
    ])

    // Assess different skill dimensions
    const skillProgression = await this.assessSkillProgression(learningEvents)
    
    // Calculate current complexity level
    const currentLevel = this.calculateCurrentLevel(skillProgression, learningEvents)
    
    // Determine learning velocity
    const learningVelocity = this.calculateLearningVelocity(learningEvents)
    
    // Recommend appropriate complexity level
    const recommendedComplexity = this.recommendComplexityLevel(
      skillProgression,
      learningVelocity,
      currentProfile
    )

    const assessment: AdaptiveComplexity = {
      userId,
      currentLevel,
      skillProgression,
      learningVelocity,
      recommendedComplexity,
      lastAssessed: new Date()
    }

    // Store assessment for tracking progression
    await this.storeComplexityAssessment(assessment)

    return assessment
  }

  /**
   * Assess skill progression across different dimensions
   */
  private async assessSkillProgression(learningEvents: LearningEvent[]): Promise<{
    deckBuilding: number
    strategyUnderstanding: number
    metaAwareness: number
    cardEvaluation: number
  }> {
    // Analyze different types of learning events to assess skills
    const deckBuildingSkill = this.assessDeckBuildingSkill(learningEvents)
    const strategySkill = this.assessStrategyUnderstanding(learningEvents)
    const metaSkill = this.assessMetaAwareness(learningEvents)
    const cardEvalSkill = this.assessCardEvaluation(learningEvents)

    return {
      deckBuilding: deckBuildingSkill,
      strategyUnderstanding: strategySkill,
      metaAwareness: metaSkill,
      cardEvaluation: cardEvalSkill
    }
  }

  /**
   * Assess deck building skill from user interactions
   */
  private assessDeckBuildingSkill(learningEvents: LearningEvent[]): number {
    const deckBuildingEvents = learningEvents.filter(e => 
      e.eventType === 'manual_change' || 
      e.eventType === 'suggestion_feedback' ||
      e.context.deckBuilding
    )

    if (deckBuildingEvents.length < 10) {
      return 0.3 // Beginner level with insufficient data
    }

    let skillScore = 0
    let assessments = 0

    // Analyze manual deck changes for sophistication
    const manualChanges = deckBuildingEvents.filter(e => e.eventType === 'manual_change')
    if (manualChanges.length > 0) {
      const sophisticatedChanges = manualChanges.filter(e => 
        e.context.reason && 
        (e.context.reason.includes('synergy') || 
         e.context.reason.includes('meta') ||
         e.context.reason.includes('curve') ||
         e.context.reason.includes('consistency'))
      )
      
      skillScore += (sophisticatedChanges.length / manualChanges.length) * 0.4
      assessments++
    }

    // Analyze suggestion feedback patterns
    const suggestionEvents = deckBuildingEvents.filter(e => e.eventType === 'suggestion_feedback')
    if (suggestionEvents.length > 0) {
      const thoughtfulRejections = suggestionEvents.filter(e => 
        e.outcome === 'rejected' && 
        e.context.reason && 
        e.context.reason.length > 20 // Detailed reasoning
      )
      
      const modifications = suggestionEvents.filter(e => e.outcome === 'modified')
      
      // Higher skill indicated by thoughtful rejections and modifications
      const thoughtfulnessScore = (thoughtfulRejections.length + modifications.length * 1.5) / suggestionEvents.length
      skillScore += Math.min(thoughtfulnessScore, 0.4)
      assessments++
    }

    // Analyze deck diversity and experimentation
    const deckIds = new Set(deckBuildingEvents.map(e => e.deckId).filter(Boolean))
    const diversityScore = Math.min(deckIds.size / 5, 0.2) // Max 0.2 for having 5+ decks
    skillScore += diversityScore
    assessments++

    return assessments > 0 ? Math.min(skillScore / assessments, 1) : 0.3
  }

  /**
   * Assess strategy understanding from user behavior
   */
  private assessStrategyUnderstanding(learningEvents: LearningEvent[]): number {
    const strategyEvents = learningEvents.filter(e => 
      e.context.strategy || 
      e.context.winCondition || 
      e.context.gameplan ||
      e.eventType === 'strategy_evolution'
    )

    if (strategyEvents.length < 5) {
      return 0.3 // Beginner level
    }

    let skillScore = 0
    let assessments = 0

    // Analyze strategy evolution events
    const evolutionEvents = strategyEvents.filter(e => e.eventType === 'strategy_evolution')
    if (evolutionEvents.length > 0) {
      const successfulEvolutions = evolutionEvents.filter(e => 
        e.outcome === 'successful' || e.confidence > 0.7
      )
      
      skillScore += (successfulEvolutions.length / evolutionEvents.length) * 0.4
      assessments++
    }

    // Analyze strategy articulation in feedback
    const strategicFeedback = strategyEvents.filter(e => 
      e.context.reason && 
      (e.context.reason.includes('strategy') || 
       e.context.reason.includes('gameplan') ||
       e.context.reason.includes('win condition'))
    )
    
    if (strategyEvents.length > 0) {
      skillScore += (strategicFeedback.length / strategyEvents.length) * 0.3
      assessments++
    }

    // Analyze strategy diversity
    const strategies = strategyEvents
      .map(e => e.context.strategy)
      .filter(Boolean)
    const uniqueStrategies = new Set(strategies)
    const diversityScore = Math.min(uniqueStrategies.size / 4, 0.3) // Max 0.3 for 4+ strategies
    skillScore += diversityScore
    assessments++

    return assessments > 0 ? Math.min(skillScore / assessments, 1) : 0.3
  }

  /**
   * Assess meta awareness from user interactions
   */
  private assessMetaAwareness(learningEvents: LearningEvent[]): number {
    const metaEvents = learningEvents.filter(e => 
      e.context.meta || 
      e.context.tournament || 
      e.context.competitive ||
      e.context.metaAdaptation
    )

    if (metaEvents.length < 3) {
      return 0.2 // Low meta awareness
    }

    let skillScore = 0
    let assessments = 0

    // Analyze meta adaptation events
    const adaptationEvents = metaEvents.filter(e => 
      e.context.metaAdaptation || e.eventType === 'strategy_evolution'
    )
    
    if (adaptationEvents.length > 0) {
      const successfulAdaptations = adaptationEvents.filter(e => 
        e.outcome === 'successful' || e.confidence > 0.6
      )
      
      skillScore += (successfulAdaptations.length / adaptationEvents.length) * 0.5
      assessments++
    }

    // Analyze tournament/competitive awareness
    const competitiveEvents = metaEvents.filter(e => 
      e.context.tournament || e.context.competitive
    )
    
    if (learningEvents.length > 0) {
      const competitiveRatio = competitiveEvents.length / learningEvents.length
      skillScore += Math.min(competitiveRatio * 2, 0.3) // Max 0.3 for high competitive engagement
      assessments++
    }

    // Analyze meta-related reasoning in feedback
    const metaReasoningEvents = metaEvents.filter(e => 
      e.context.reason && 
      (e.context.reason.includes('meta') || 
       e.context.reason.includes('tournament') ||
       e.context.reason.includes('competitive'))
    )
    
    if (metaEvents.length > 0) {
      skillScore += (metaReasoningEvents.length / metaEvents.length) * 0.2
      assessments++
    }

    return assessments > 0 ? Math.min(skillScore / assessments, 1) : 0.2
  }

  /**
   * Assess card evaluation skill
   */
  private assessCardEvaluation(learningEvents: LearningEvent[]): number {
    const cardEvents = learningEvents.filter(e => 
      e.cardId && 
      (e.eventType === 'suggestion_feedback' || e.eventType === 'manual_change')
    )

    if (cardEvents.length < 15) {
      return 0.3 // Need more data
    }

    let skillScore = 0
    let assessments = 0

    // Analyze suggestion feedback accuracy
    const suggestionEvents = cardEvents.filter(e => e.eventType === 'suggestion_feedback')
    if (suggestionEvents.length > 0) {
      // Look for patterns in accepted vs rejected suggestions
      const acceptedSuggestions = suggestionEvents.filter(e => e.outcome === 'accepted')
      const rejectedSuggestions = suggestionEvents.filter(e => e.outcome === 'rejected')
      
      // Higher skill indicated by selective acceptance with good reasoning
      const selectivityScore = rejectedSuggestions.length / suggestionEvents.length
      const reasoningScore = rejectedSuggestions.filter(e => 
        e.context.reason && e.context.reason.length > 15
      ).length / Math.max(rejectedSuggestions.length, 1)
      
      skillScore += (selectivityScore * 0.3 + reasoningScore * 0.2)
      assessments++
    }

    // Analyze manual card choices
    const manualAdditions = cardEvents.filter(e => 
      e.eventType === 'manual_change' && e.context.changeType === 'card_added'
    )
    
    if (manualAdditions.length > 0) {
      const reasonedAdditions = manualAdditions.filter(e => 
        e.context.reason && 
        (e.context.reason.includes('synergy') || 
         e.context.reason.includes('value') ||
         e.context.reason.includes('utility'))
      )
      
      skillScore += (reasonedAdditions.length / manualAdditions.length) * 0.3
      assessments++
    }

    // Analyze card diversity and experimentation
    const uniqueCards = new Set(cardEvents.map(e => e.cardId))
    const diversityScore = Math.min(uniqueCards.size / 50, 0.2) // Max 0.2 for 50+ unique cards
    skillScore += diversityScore
    assessments++

    return assessments > 0 ? Math.min(skillScore / assessments, 1) : 0.3
  }

  /**
   * Calculate current overall complexity level
   */
  private calculateCurrentLevel(
    skillProgression: AdaptiveComplexity['skillProgression'],
    learningEvents: LearningEvent[]
  ): number {
    // Weighted average of skill dimensions
    const overallSkill = (
      skillProgression.deckBuilding * 0.3 +
      skillProgression.strategyUnderstanding * 0.25 +
      skillProgression.metaAwareness * 0.25 +
      skillProgression.cardEvaluation * 0.2
    )

    // Adjust based on experience (number of learning events)
    const experienceBonus = Math.min(learningEvents.length / 100, 0.2) // Max 0.2 bonus
    
    // Scale to 1-10 level
    const level = (overallSkill + experienceBonus) * 10
    
    return Math.max(1, Math.min(10, level))
  }

  /**
   * Calculate learning velocity
   */
  private calculateLearningVelocity(learningEvents: LearningEvent[]): number {
    if (learningEvents.length < 10) {
      return 0.5 // Default moderate velocity
    }

    // Analyze learning progression over time
    const sortedEvents = learningEvents.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    // Split into early and recent periods
    const midpoint = Math.floor(sortedEvents.length / 2)
    const earlyEvents = sortedEvents.slice(0, midpoint)
    const recentEvents = sortedEvents.slice(midpoint)

    // Calculate complexity indicators for each period
    const earlyComplexity = this.calculatePeriodComplexity(earlyEvents)
    const recentComplexity = this.calculatePeriodComplexity(recentEvents)

    // Learning velocity is the rate of complexity increase
    const complexityGrowth = recentComplexity - earlyComplexity
    const timeSpan = new Date(recentEvents[recentEvents.length - 1].timestamp).getTime() - 
                    new Date(earlyEvents[0].timestamp).getTime()
    const monthsSpan = timeSpan / (30 * 24 * 60 * 60 * 1000)

    // Normalize velocity (complexity growth per month)
    const velocity = monthsSpan > 0 ? complexityGrowth / monthsSpan : 0
    
    return Math.max(0, Math.min(2, velocity + 0.5)) // Scale 0-2, default 0.5
  }

  /**
   * Calculate complexity indicators for a period of events
   */
  private calculatePeriodComplexity(events: LearningEvent[]): number {
    if (events.length === 0) return 0

    let complexityScore = 0
    let indicators = 0

    // Sophisticated reasoning in feedback
    const reasonedEvents = events.filter(e => 
      e.context.reason && e.context.reason.length > 20
    )
    complexityScore += (reasonedEvents.length / events.length) * 0.3
    indicators++

    // Strategy-related events
    const strategyEvents = events.filter(e => 
      e.context.strategy || e.context.winCondition || e.eventType === 'strategy_evolution'
    )
    complexityScore += (strategyEvents.length / events.length) * 0.3
    indicators++

    // Meta-awareness events
    const metaEvents = events.filter(e => 
      e.context.meta || e.context.tournament || e.context.metaAdaptation
    )
    complexityScore += (metaEvents.length / events.length) * 0.2
    indicators++

    // Modification and rejection events (indicating critical thinking)
    const criticalEvents = events.filter(e => 
      e.outcome === 'modified' || 
      (e.outcome === 'rejected' && e.context.reason)
    )
    complexityScore += (criticalEvents.length / events.length) * 0.2
    indicators++

    return indicators > 0 ? complexityScore / indicators : 0
  }

  /**
   * Recommend appropriate complexity level
   */
  private recommendComplexityLevel(
    skillProgression: AdaptiveComplexity['skillProgression'],
    learningVelocity: number,
    currentProfile: UserStyleProfile | null
  ): 'simple' | 'moderate' | 'complex' {
    // Calculate overall skill level
    const overallSkill = (
      skillProgression.deckBuilding * 0.3 +
      skillProgression.strategyUnderstanding * 0.25 +
      skillProgression.metaAwareness * 0.25 +
      skillProgression.cardEvaluation * 0.2
    )

    // Consider user's current preference if available
    const currentPreference = currentProfile?.complexityPreference
    let preferenceWeight = 0

    if (currentPreference === 'simple') preferenceWeight = -0.1
    else if (currentPreference === 'complex') preferenceWeight = 0.1

    // Adjust for learning velocity
    const velocityAdjustment = (learningVelocity - 0.5) * 0.1 // -0.1 to +0.15

    const adjustedSkill = overallSkill + preferenceWeight + velocityAdjustment

    // Determine recommendation
    if (adjustedSkill < 0.4) {
      return 'simple'
    } else if (adjustedSkill < 0.7) {
      return 'moderate'
    } else {
      return 'complex'
    }
  }

  /**
   * Generate complexity-appropriate suggestions
   */
  async generateComplexityAwareSuggestions(
    userId: string,
    context: {
      suggestionType: string
      deckId?: string
      currentComplexity?: 'simple' | 'moderate' | 'complex'
    }
  ): Promise<Array<{
    suggestion: string
    complexity: 'simple' | 'moderate' | 'complex'
    reasoning: string
    learningOpportunity?: string
  }>> {
    const assessment = await this.assessUserComplexity(userId)
    const targetComplexity = context.currentComplexity || assessment.recommendedComplexity

    const suggestions: any[] = []

    // Generate suggestions appropriate for the target complexity
    switch (targetComplexity) {
      case 'simple':
        suggestions.push(...this.generateSimpleSuggestions(context, assessment))
        break
      case 'moderate':
        suggestions.push(...this.generateModerateSuggestions(context, assessment))
        break
      case 'complex':
        suggestions.push(...this.generateComplexSuggestions(context, assessment))
        break
    }

    // Add learning opportunities for skill development
    if (assessment.learningVelocity > 1.0) {
      // Fast learner - include stretch suggestions
      const stretchSuggestions = this.generateStretchSuggestions(targetComplexity, context)
      suggestions.push(...stretchSuggestions)
    }

    return suggestions
  }

  /**
   * Generate simple complexity suggestions
   */
  private generateSimpleSuggestions(context: any, assessment: AdaptiveComplexity): any[] {
    return [
      {
        suggestion: 'Focus on mana curve optimization',
        complexity: 'simple',
        reasoning: 'Mana curve is fundamental to deck consistency',
        learningOpportunity: 'Understanding mana curve helps with all future deck building'
      },
      {
        suggestion: 'Include more card draw effects',
        complexity: 'simple',
        reasoning: 'Card advantage is crucial for longer games',
        learningOpportunity: 'Learn to identify and value card advantage engines'
      },
      {
        suggestion: 'Add targeted removal spells',
        complexity: 'simple',
        reasoning: 'Removal helps deal with threats efficiently',
        learningOpportunity: 'Understanding when and what to remove is a key skill'
      }
    ]
  }

  /**
   * Generate moderate complexity suggestions
   */
  private generateModerateSuggestions(context: any, assessment: AdaptiveComplexity): any[] {
    return [
      {
        suggestion: 'Consider synergy packages for your strategy',
        complexity: 'moderate',
        reasoning: 'Synergies multiply the effectiveness of individual cards',
        learningOpportunity: 'Learn to identify and build around card synergies'
      },
      {
        suggestion: 'Optimize your interaction suite for the meta',
        complexity: 'moderate',
        reasoning: 'Meta-aware interaction improves win rates significantly',
        learningOpportunity: 'Develop meta awareness and adaptation skills'
      },
      {
        suggestion: 'Balance proactive and reactive elements',
        complexity: 'moderate',
        reasoning: 'Good decks can both execute their plan and disrupt opponents',
        learningOpportunity: 'Understanding threat assessment and resource allocation'
      }
    ]
  }

  /**
   * Generate complex suggestions
   */
  private generateComplexSuggestions(context: any, assessment: AdaptiveComplexity): any[] {
    return [
      {
        suggestion: 'Implement advanced mana base optimization with utility lands',
        complexity: 'complex',
        reasoning: 'Sophisticated mana bases provide incremental advantages',
        learningOpportunity: 'Master advanced mana base construction and land selection'
      },
      {
        suggestion: 'Build in meta-specific sideboard strategies',
        complexity: 'complex',
        reasoning: 'Adaptable strategies perform better across diverse metas',
        learningOpportunity: 'Develop advanced meta reading and adaptation skills'
      },
      {
        suggestion: 'Optimize card selection for multiple game states',
        complexity: 'complex',
        reasoning: 'Flexible cards perform well in varied situations',
        learningOpportunity: 'Learn advanced card evaluation and situational analysis'
      }
    ]
  }

  /**
   * Generate stretch suggestions for fast learners
   */
  private generateStretchSuggestions(
    currentComplexity: 'simple' | 'moderate' | 'complex',
    context: any
  ): any[] {
    const nextLevel = currentComplexity === 'simple' ? 'moderate' : 'complex'
    
    return [
      {
        suggestion: `Try a ${nextLevel} approach: Advanced synergy analysis`,
        complexity: nextLevel,
        reasoning: 'Challenge yourself with more sophisticated deck building concepts',
        learningOpportunity: `Develop ${nextLevel}-level deck building skills`
      }
    ]
  }

  /**
   * Track complexity progression over time
   */
  async trackComplexityProgression(userId: string): Promise<Array<{
    date: Date
    level: number
    skillBreakdown: AdaptiveComplexity['skillProgression']
    milestone?: string
  }>> {
    // This would track how user's complexity level changes over time
    // For now, return current assessment as single point
    const current = await this.assessUserComplexity(userId)
    
    return [
      {
        date: new Date(),
        level: current.currentLevel,
        skillBreakdown: current.skillProgression,
        milestone: this.identifyMilestone(current)
      }
    ]
  }

  /**
   * Identify learning milestones
   */
  private identifyMilestone(assessment: AdaptiveComplexity): string | undefined {
    const { skillProgression, currentLevel } = assessment

    if (currentLevel >= 8) {
      return 'Advanced deck builder'
    } else if (currentLevel >= 6) {
      return 'Competent strategist'
    } else if (currentLevel >= 4) {
      return 'Developing builder'
    } else if (currentLevel >= 2) {
      return 'Learning fundamentals'
    }

    return undefined
  }

  /**
   * Get current user profile
   */
  private async getCurrentProfile(userId: string): Promise<UserStyleProfile | null> {
    const userData = await db.userLearningData.findUnique({
      where: { userId }
    })

    return userData?.styleProfile as UserStyleProfile || null
  }

  /**
   * Store complexity assessment
   */
  private async storeComplexityAssessment(assessment: AdaptiveComplexity): Promise<void> {
    try {
      await db.userLearningData.upsert({
        where: { userId: assessment.userId },
        update: {
          crossDeckInsights: {
            adaptiveComplexity: assessment
          },
          lastUpdated: new Date()
        },
        create: {
          id: crypto.randomUUID(),
          userId: assessment.userId,
          styleProfile: {},
          deckPreferences: {},
          learningEvents: [],
          suggestionFeedback: [],
          deckRelationships: {},
          crossDeckInsights: {
            adaptiveComplexity: assessment
          },
          lastUpdated: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to store complexity assessment:', error)
    }
  }
}

export const adaptiveComplexityEngine = new AdaptiveComplexityEngine()
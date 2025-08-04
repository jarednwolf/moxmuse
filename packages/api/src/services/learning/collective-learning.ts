import { prisma as db } from '@moxmuse/db'
import type { 
  CollectiveLearningInsight,
  UserStyleProfile,
  LearningEvent,
  UserBehaviorPattern
} from '../../types/learning'
import { learningEventTracker } from './learning-event-tracker'
import { preferenceInferenceEngine } from './preference-inference'

export class CollectiveLearningEngine {
  /**
   * Generate collective insights while maintaining personalization
   */
  async generateCollectiveInsights(): Promise<CollectiveLearningInsight[]> {
    const insights: CollectiveLearningInsight[] = []

    // Analyze patterns across all users
    const [
      strategyInsights,
      cardPerformanceInsights,
      metaAdaptationInsights,
      budgetOptimizationInsights,
      synergyDiscoveryInsights
    ] = await Promise.all([
      this.analyzeStrategyPatterns(),
      this.analyzeCardPerformance(),
      this.analyzeMetaAdaptations(),
      this.analyzeBudgetOptimizations(),
      this.analyzeSynergyDiscoveries()
    ])

    insights.push(
      ...strategyInsights,
      ...cardPerformanceInsights,
      ...metaAdaptationInsights,
      ...budgetOptimizationInsights,
      ...synergyDiscoveryInsights
    )

    // Store insights for future use
    await this.storeCollectiveInsights(insights)

    return insights
  }

  /**
   * Analyze strategy patterns across users
   */
  private async analyzeStrategyPatterns(): Promise<CollectiveLearningInsight[]> {
    const insights: CollectiveLearningInsight[] = []

    try {
      // Get all users' learning data
      const allUserData = await db.userLearningData.findMany({
        select: {
          userId: true,
          styleProfile: true,
          learningEvents: true
        }
      })

      // Group users by similar profiles
      const userGroups = this.groupUsersByProfile(allUserData)

      for (const [groupType, users] of Object.entries(userGroups)) {
        if (users.length < 5) continue // Need minimum users for statistical significance

        // Analyze successful strategies within this group
        const successfulStrategies = this.analyzeGroupStrategies(users)
        
        if (successfulStrategies.length > 0) {
          insights.push({
            insightType: 'successful_strategies',
            insight: {
              groupType,
              strategies: successfulStrategies,
              userCount: users.length,
              averageSuccessRate: successfulStrategies.reduce((sum, s) => sum + s.successRate, 0) / successfulStrategies.length
            },
            confidence: Math.min(users.length / 20, 0.9),
            userCount: users.length,
            evidence: [`Analyzed ${users.length} users with similar profiles`],
            applicableUserTypes: [groupType],
            createdAt: new Date()
          })
        }

        // Analyze strategy transitions
        const transitionPatterns = this.analyzeStrategyTransitions(users)
        
        if (transitionPatterns.length > 0) {
          insights.push({
            insightType: 'strategy_transitions',
            insight: {
              groupType,
              transitions: transitionPatterns,
              userCount: users.length
            },
            confidence: Math.min(users.length / 15, 0.8),
            userCount: users.length,
            evidence: [`Found ${transitionPatterns.length} common transition patterns`],
            applicableUserTypes: [groupType],
            createdAt: new Date()
          })
        }
      }
    } catch (error) {
      console.error('Failed to analyze strategy patterns:', error)
    }

    return insights
  }

  /**
   * Analyze card performance across users
   */
  private async analyzeCardPerformance(): Promise<CollectiveLearningInsight[]> {
    const insights: CollectiveLearningInsight[] = []

    try {
      // Aggregate card performance data
      const cardPerformance = await this.aggregateCardPerformance()
      
      // Find overperforming cards
      const overperformers = Object.entries(cardPerformance)
        .filter(([, data]) => data.userCount >= 10 && data.averageRating > 4.0)
        .sort(([, a], [, b]) => b.averageRating - a.averageRating)
        .slice(0, 20)

      if (overperformers.length > 0) {
        insights.push({
          insightType: 'overperforming_cards',
          insight: {
            cards: overperformers.map(([cardId, data]) => ({
              cardId,
              averageRating: data.averageRating,
              userCount: data.userCount,
              contexts: data.contexts
            }))
          },
          confidence: 0.8,
          userCount: Math.max(...overperformers.map(([, data]) => data.userCount)),
          evidence: [`Analyzed performance across ${overperformers.length} high-performing cards`],
          applicableUserTypes: ['all'],
          createdAt: new Date()
        })
      }

      // Find underperforming cards
      const underperformers = Object.entries(cardPerformance)
        .filter(([, data]) => data.userCount >= 10 && data.averageRating < 2.5)
        .sort(([, a], [, b]) => a.averageRating - b.averageRating)
        .slice(0, 15)

      if (underperformers.length > 0) {
        insights.push({
          insightType: 'underperforming_cards',
          insight: {
            cards: underperformers.map(([cardId, data]) => ({
              cardId,
              averageRating: data.averageRating,
              userCount: data.userCount,
              commonIssues: data.commonIssues
            }))
          },
          confidence: 0.7,
          userCount: Math.max(...underperformers.map(([, data]) => data.userCount)),
          evidence: [`Identified ${underperformers.length} consistently underperforming cards`],
          applicableUserTypes: ['all'],
          createdAt: new Date()
        })
      }
    } catch (error) {
      console.error('Failed to analyze card performance:', error)
    }

    return insights
  }

  /**
   * Analyze meta adaptation patterns
   */
  private async analyzeMetaAdaptations(): Promise<CollectiveLearningInsight[]> {
    const insights: CollectiveLearningInsight[] = []

    try {
      // Get recent meta adaptation events
      const recentAdaptations = await this.getRecentMetaAdaptations()
      
      // Group adaptations by trigger
      const adaptationsByTrigger = this.groupAdaptationsByTrigger(recentAdaptations)

      for (const [trigger, adaptations] of Object.entries(adaptationsByTrigger)) {
        if (adaptations.length < 5) continue

        const successfulAdaptations = adaptations.filter(a => a.outcome === 'successful')
        const successRate = successfulAdaptations.length / adaptations.length

        if (successRate > 0.6) {
          insights.push({
            insightType: 'meta_adaptation_pattern',
            insight: {
              trigger,
              adaptations: this.summarizeAdaptations(successfulAdaptations),
              successRate,
              userCount: new Set(adaptations.map(a => a.userId)).size
            },
            confidence: Math.min(successRate, 0.9),
            userCount: new Set(adaptations.map(a => a.userId)).size,
            evidence: [`${successfulAdaptations.length} successful adaptations to ${trigger}`],
            applicableUserTypes: ['competitive', 'meta_aware'],
            createdAt: new Date()
          })
        }
      }
    } catch (error) {
      console.error('Failed to analyze meta adaptations:', error)
    }

    return insights
  }

  /**
   * Analyze budget optimization patterns
   */
  private async analyzeBudgetOptimizations(): Promise<CollectiveLearningInsight[]> {
    const insights: CollectiveLearningInsight[] = []

    try {
      // Analyze budget-conscious users' successful optimizations
      const budgetOptimizations = await this.getBudgetOptimizations()
      
      // Find common high-impact, low-cost upgrades
      const highImpactUpgrades = this.findHighImpactUpgrades(budgetOptimizations)
      
      if (highImpactUpgrades.length > 0) {
        insights.push({
          insightType: 'budget_optimization',
          insight: {
            upgrades: highImpactUpgrades,
            averageImpact: highImpactUpgrades.reduce((sum, u) => sum + u.impact, 0) / highImpactUpgrades.length,
            averageCost: highImpactUpgrades.reduce((sum, u) => sum + u.cost, 0) / highImpactUpgrades.length
          },
          confidence: 0.8,
          userCount: new Set(budgetOptimizations.map(o => o.userId)).size,
          evidence: [`Analyzed ${budgetOptimizations.length} budget optimizations`],
          applicableUserTypes: ['budget_conscious'],
          createdAt: new Date()
        })
      }

      // Find budget allocation patterns
      const allocationPatterns = this.analyzeBudgetAllocation(budgetOptimizations)
      
      if (allocationPatterns.length > 0) {
        insights.push({
          insightType: 'budget_allocation',
          insight: {
            patterns: allocationPatterns
          },
          confidence: 0.7,
          userCount: new Set(budgetOptimizations.map(o => o.userId)).size,
          evidence: [`Found ${allocationPatterns.length} effective allocation patterns`],
          applicableUserTypes: ['budget_conscious'],
          createdAt: new Date()
        })
      }
    } catch (error) {
      console.error('Failed to analyze budget optimizations:', error)
    }

    return insights
  }

  /**
   * Analyze synergy discoveries
   */
  private async analyzeSynergyDiscoveries(): Promise<CollectiveLearningInsight[]> {
    const insights: CollectiveLearningInsight[] = []

    try {
      // Find newly discovered synergies
      const synergyDiscoveries = await this.getSynergyDiscoveries()
      
      // Group by synergy type
      const synergyGroups = this.groupSynergiesByType(synergyDiscoveries)

      for (const [synergyType, synergies] of Object.entries(synergyGroups)) {
        if (synergies.length < 3) continue

        const validatedSynergies = synergies.filter(s => s.validationCount >= 3)
        
        if (validatedSynergies.length > 0) {
          insights.push({
            insightType: 'synergy_discovery',
            insight: {
              synergyType,
              synergies: validatedSynergies.map(s => ({
                cards: s.cards,
                strength: s.strength,
                contexts: s.contexts,
                discoverers: s.discoverers.length
              }))
            },
            confidence: Math.min(validatedSynergies.length / 5, 0.9),
            userCount: new Set(validatedSynergies.flatMap(s => s.discoverers)).size,
            evidence: [`${validatedSynergies.length} validated synergies of type ${synergyType}`],
            applicableUserTypes: ['innovative', 'synergy_focused'],
            createdAt: new Date()
          })
        }
      }
    } catch (error) {
      console.error('Failed to analyze synergy discoveries:', error)
    }

    return insights
  }

  /**
   * Group users by similar profiles
   */
  private groupUsersByProfile(userData: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      competitive: [],
      casual: [],
      budget_conscious: [],
      collection_dependent: [],
      innovative: [],
      traditional: []
    }

    for (const user of userData) {
      const profile = user.styleProfile as UserStyleProfile
      if (!profile) continue

      // Classify user based on profile
      if (profile.competitiveLevel > 0.7) {
        groups.competitive.push(user)
      } else if (profile.competitiveLevel < 0.3) {
        groups.casual.push(user)
      }

      if (profile.budgetSensitivity > 0.7) {
        groups.budget_conscious.push(user)
      }

      if (profile.collectionDependency > 0.7) {
        groups.collection_dependent.push(user)
      }

      if (profile.innovationTolerance > 0.7) {
        groups.innovative.push(user)
      } else if (profile.innovationTolerance < 0.3) {
        groups.traditional.push(user)
      }
    }

    return groups
  }

  /**
   * Analyze successful strategies within a user group
   */
  private analyzeGroupStrategies(users: any[]): Array<{
    strategy: string
    successRate: number
    userCount: number
    contexts: string[]
  }> {
    const strategyData: Record<string, {
      successes: number
      total: number
      users: Set<string>
      contexts: Set<string>
    }> = {}

    for (const user of users) {
      const events = user.learningEvents as LearningEvent[]
      
      for (const event of events) {
        if (event.eventType === 'deck_performance' && event.context.strategy) {
          const strategy = event.context.strategy
          
          if (!strategyData[strategy]) {
            strategyData[strategy] = {
              successes: 0,
              total: 0,
              users: new Set(),
              contexts: new Set()
            }
          }

          strategyData[strategy].total++
          strategyData[strategy].users.add(user.userId)
          
          if (event.outcome === 'win') {
            strategyData[strategy].successes++
          }

          if (event.context.context) {
            strategyData[strategy].contexts.add(event.context.context)
          }
        }
      }
    }

    return Object.entries(strategyData)
      .filter(([, data]) => data.total >= 5 && data.users.size >= 3)
      .map(([strategy, data]) => ({
        strategy,
        successRate: data.successes / data.total,
        userCount: data.users.size,
        contexts: Array.from(data.contexts)
      }))
      .filter(s => s.successRate > 0.6)
      .sort((a, b) => b.successRate - a.successRate)
  }

  /**
   * Analyze strategy transition patterns
   */
  private analyzeStrategyTransitions(users: any[]): Array<{
    from: string
    to: string
    frequency: number
    successRate: number
  }> {
    const transitions: Record<string, {
      count: number
      successes: number
    }> = {}

    for (const user of users) {
      const events = (user.learningEvents as LearningEvent[])
        .filter(e => e.eventType === 'strategy_evolution')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      for (const event of events) {
        const from = event.context.previousStrategy
        const to = event.context.newStrategy
        
        if (from && to) {
          const key = `${from}->${to}`
          
          if (!transitions[key]) {
            transitions[key] = { count: 0, successes: 0 }
          }

          transitions[key].count++
          
          if (event.outcome === 'successful') {
            transitions[key].successes++
          }
        }
      }
    }

    return Object.entries(transitions)
      .filter(([, data]) => data.count >= 3)
      .map(([transition, data]) => {
        const [from, to] = transition.split('->')
        return {
          from,
          to,
          frequency: data.count,
          successRate: data.successes / data.count
        }
      })
      .filter(t => t.successRate > 0.5)
      .sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Aggregate card performance data across users
   */
  private async aggregateCardPerformance(): Promise<Record<string, {
    averageRating: number
    userCount: number
    contexts: string[]
    commonIssues: string[]
  }>> {
    // This would aggregate data from user feedback and performance events
    // For now, return mock data structure
    return {}
  }

  /**
   * Get recent meta adaptation events
   */
  private async getRecentMetaAdaptations(): Promise<Array<{
    userId: string
    trigger: string
    adaptation: any
    outcome: string
    timestamp: Date
  }>> {
    // This would query recent meta adaptation events
    return []
  }

  /**
   * Group adaptations by trigger
   */
  private groupAdaptationsByTrigger(adaptations: any[]): Record<string, any[]> {
    return adaptations.reduce((groups, adaptation) => {
      const trigger = adaptation.trigger
      if (!groups[trigger]) {
        groups[trigger] = []
      }
      groups[trigger].push(adaptation)
      return groups
    }, {})
  }

  /**
   * Summarize successful adaptations
   */
  private summarizeAdaptations(adaptations: any[]): any[] {
    // Summarize common adaptation patterns
    return adaptations.map(a => ({
      type: a.adaptation.type,
      changes: a.adaptation.changes,
      impact: a.adaptation.impact
    }))
  }

  /**
   * Get budget optimization data
   */
  private async getBudgetOptimizations(): Promise<Array<{
    userId: string
    upgrade: any
    cost: number
    impact: number
    timestamp: Date
  }>> {
    // This would query budget optimization events
    return []
  }

  /**
   * Find high-impact, low-cost upgrades
   */
  private findHighImpactUpgrades(optimizations: any[]): Array<{
    cardId: string
    cost: number
    impact: number
    frequency: number
  }> {
    const upgradeData: Record<string, {
      totalCost: number
      totalImpact: number
      count: number
    }> = {}

    for (const opt of optimizations) {
      const cardId = opt.upgrade.cardId
      if (!upgradeData[cardId]) {
        upgradeData[cardId] = { totalCost: 0, totalImpact: 0, count: 0 }
      }

      upgradeData[cardId].totalCost += opt.cost
      upgradeData[cardId].totalImpact += opt.impact
      upgradeData[cardId].count++
    }

    return Object.entries(upgradeData)
      .filter(([, data]) => data.count >= 3)
      .map(([cardId, data]) => ({
        cardId,
        cost: data.totalCost / data.count,
        impact: data.totalImpact / data.count,
        frequency: data.count
      }))
      .filter(u => u.impact > 0.7 && u.cost < 20) // High impact, low cost
      .sort((a, b) => (b.impact / b.cost) - (a.impact / a.cost))
  }

  /**
   * Analyze budget allocation patterns
   */
  private analyzeBudgetAllocation(optimizations: any[]): Array<{
    category: string
    percentage: number
    effectiveness: number
  }> {
    // Analyze how successful users allocate their budgets
    return []
  }

  /**
   * Get synergy discovery data
   */
  private async getSynergyDiscoveries(): Promise<Array<{
    cards: string[]
    strength: number
    contexts: string[]
    discoverers: string[]
    validationCount: number
  }>> {
    // This would query synergy discovery events
    return []
  }

  /**
   * Group synergies by type
   */
  private groupSynergiesByType(synergies: any[]): Record<string, any[]> {
    return synergies.reduce((groups, synergy) => {
      const type = this.classifySynergyType(synergy)
      if (!groups[type]) {
        groups[type] = []
      }
      groups[type].push(synergy)
      return groups
    }, {})
  }

  /**
   * Classify synergy type
   */
  private classifySynergyType(synergy: any): string {
    // Classify synergy based on card types and interactions
    return 'combo' // Simplified for now
  }

  /**
   * Store collective insights
   */
  private async storeCollectiveInsights(insights: CollectiveLearningInsight[]): Promise<void> {
    try {
      // Store insights in a dedicated table or cache
      for (const insight of insights) {
        await db.$executeRaw`
          INSERT INTO collective_learning_insights (
            insight_type, insight_data, confidence, user_count, 
            evidence, applicable_user_types, created_at
          ) VALUES (
            ${insight.insightType}, ${JSON.stringify(insight.insight)}, 
            ${insight.confidence}, ${insight.userCount},
            ${JSON.stringify(insight.evidence)}, ${JSON.stringify(insight.applicableUserTypes)},
            ${insight.createdAt}
          )
          ON CONFLICT (insight_type) DO UPDATE SET
            insight_data = EXCLUDED.insight_data,
            confidence = EXCLUDED.confidence,
            user_count = EXCLUDED.user_count,
            evidence = EXCLUDED.evidence,
            created_at = EXCLUDED.created_at
        `
      }
    } catch (error) {
      console.error('Failed to store collective insights:', error)
    }
  }

  /**
   * Get applicable insights for a user
   */
  async getApplicableInsights(userProfile: UserStyleProfile): Promise<CollectiveLearningInsight[]> {
    try {
      const userType = this.classifyUserType(userProfile)
      
      const results = await db.$queryRaw<any[]>`
        SELECT * FROM collective_learning_insights
        WHERE applicable_user_types::jsonb ? ${userType}
           OR applicable_user_types::jsonb ? 'all'
        ORDER BY confidence DESC, user_count DESC
        LIMIT 10
      `

      return results.map(row => ({
        insightType: row.insight_type,
        insight: row.insight_data,
        confidence: row.confidence,
        userCount: row.user_count,
        evidence: row.evidence,
        applicableUserTypes: row.applicable_user_types,
        createdAt: row.created_at
      }))
    } catch (error) {
      console.error('Failed to get applicable insights:', error)
      return []
    }
  }

  /**
   * Classify user type for insight matching
   */
  private classifyUserType(profile: UserStyleProfile): string {
    if (profile.competitiveLevel > 0.7) return 'competitive'
    if (profile.budgetSensitivity > 0.7) return 'budget_conscious'
    if (profile.collectionDependency > 0.7) return 'collection_dependent'
    if (profile.innovationTolerance > 0.7) return 'innovative'
    if (profile.innovationTolerance < 0.3) return 'traditional'
    return 'casual'
  }
}

export const collectiveLearningEngine = new CollectiveLearningEngine()
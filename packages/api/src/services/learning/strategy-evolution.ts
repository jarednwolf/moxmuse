import { prisma as db } from '@moxmuse/db'
import type { 
  StrategyEvolution,
  LearningEvent,
  UserStyleProfile
} from '../../types/learning'
import { learningEventTracker } from './learning-event-tracker'
import { openaiService } from '../openai'

export class StrategyEvolutionDetector {
  /**
   * Detect and track strategy evolution for a user's deck
   */
  async detectStrategyEvolution(
    userId: string,
    deckId: string,
    currentDeckState: any,
    previousDeckState?: any
  ): Promise<StrategyEvolution[]> {
    const evolutions: StrategyEvolution[] = []

    // Get user's learning history
    const learningEvents = await learningEventTracker.getUserLearningEvents(userId)
    const deckEvents = learningEvents.filter(e => e.deckId === deckId)

    // Detect different types of evolution
    const [
      metaAdaptations,
      powerLevelChanges,
      budgetAdjustments,
      synergyDiscoveries,
      strategyShifts
    ] = await Promise.all([
      this.detectMetaAdaptation(deckId, currentDeckState, deckEvents),
      this.detectPowerLevelChange(deckId, currentDeckState, previousDeckState, deckEvents),
      this.detectBudgetAdjustment(deckId, currentDeckState, previousDeckState, deckEvents),
      this.detectSynergyDiscovery(deckId, currentDeckState, deckEvents),
      this.detectStrategyShift(deckId, currentDeckState, previousDeckState, deckEvents)
    ])

    evolutions.push(
      ...metaAdaptations,
      ...powerLevelChanges,
      ...budgetAdjustments,
      ...synergyDiscoveries,
      ...strategyShifts
    )

    // Track evolution events
    for (const evolution of evolutions) {
      await this.trackEvolution(userId, evolution)
    }

    return evolutions
  }

  /**
   * Detect meta adaptation changes
   */
  private async detectMetaAdaptation(
    deckId: string,
    currentState: any,
    events: LearningEvent[]
  ): Promise<StrategyEvolution[]> {
    const evolutions: StrategyEvolution[] = []

    // Look for meta-related changes in recent events
    const metaEvents = events.filter(e => 
      e.context.metaChange || e.context.metaAdaptation || e.context.tournamentResult
    ).slice(0, 10) // Recent events only

    if (metaEvents.length === 0) return evolutions

    // Analyze card changes that suggest meta adaptation
    const recentCardChanges = events.filter(e => 
      e.eventType === 'manual_change' &&
      new Date(e.timestamp) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // Last 2 weeks
    )

    // Group changes by type
    const addedCards = recentCardChanges.filter(e => e.context.changeType === 'card_added')
    const removedCards = recentCardChanges.filter(e => e.context.changeType === 'card_removed')

    if (addedCards.length > 0 || removedCards.length > 0) {
      // Use AI to analyze if changes suggest meta adaptation
      const analysisPrompt = this.buildMetaAnalysisPrompt(
        currentState,
        addedCards,
        removedCards,
        metaEvents
      )

      try {
        const analysis = await openaiService.analyzeStrategyEvolution(analysisPrompt)
        
        if (analysis.isMetaAdaptation && analysis.confidence > 0.6) {
          evolutions.push({
            userId: '', // Will be set by caller
            deckId,
            evolutionType: 'meta_adaptation',
            previousState: {
              strategy: analysis.previousStrategy,
              metaPosition: analysis.previousMetaPosition,
              keyCards: removedCards.map(e => e.cardId).filter(Boolean)
            },
            newState: {
              strategy: analysis.newStrategy,
              metaPosition: analysis.newMetaPosition,
              keyCards: addedCards.map(e => e.cardId).filter(Boolean),
              adaptations: analysis.adaptations
            },
            trigger: analysis.trigger || 'meta_shift',
            confidence: analysis.confidence,
            timestamp: new Date(),
            context: {
              metaEvents: metaEvents.length,
              cardChanges: addedCards.length + removedCards.length,
              analysisReasoning: analysis.reasoning
            }
          })
        }
      } catch (error) {
        console.error('Failed to analyze meta adaptation:', error)
      }
    }

    return evolutions
  }

  /**
   * Detect power level changes
   */
  private async detectPowerLevelChange(
    deckId: string,
    currentState: any,
    previousState: any,
    events: LearningEvent[]
  ): Promise<StrategyEvolution[]> {
    const evolutions: StrategyEvolution[] = []

    if (!previousState) return evolutions

    // Calculate power level indicators
    const currentPowerLevel = this.calculatePowerLevel(currentState)
    const previousPowerLevel = this.calculatePowerLevel(previousState)
    const powerLevelChange = currentPowerLevel - previousPowerLevel

    // Significant change threshold
    if (Math.abs(powerLevelChange) > 0.5) {
      // Look for supporting evidence in events
      const powerLevelEvents = events.filter(e => 
        e.context.powerLevel || e.context.competitiveLevel || e.context.powerLevelChange
      )

      const trigger = this.identifyPowerLevelTrigger(events, powerLevelChange)

      evolutions.push({
        userId: '', // Will be set by caller
        deckId,
        evolutionType: 'power_level_change',
        previousState: {
          powerLevel: previousPowerLevel,
          keyCards: this.extractHighPowerCards(previousState),
          strategy: previousState.strategy
        },
        newState: {
          powerLevel: currentPowerLevel,
          keyCards: this.extractHighPowerCards(currentState),
          strategy: currentState.strategy,
          direction: powerLevelChange > 0 ? 'increase' : 'decrease'
        },
        trigger,
        confidence: Math.min(Math.abs(powerLevelChange), 0.9),
        timestamp: new Date(),
        context: {
          powerLevelChange,
          supportingEvents: powerLevelEvents.length,
          trigger
        }
      })
    }

    return evolutions
  }

  /**
   * Detect budget adjustments
   */
  private async detectBudgetAdjustment(
    deckId: string,
    currentState: any,
    previousState: any,
    events: LearningEvent[]
  ): Promise<StrategyEvolution[]> {
    const evolutions: StrategyEvolution[] = []

    if (!previousState) return evolutions

    // Calculate budget changes
    const currentBudget = this.calculateDeckValue(currentState)
    const previousBudget = this.calculateDeckValue(previousState)
    const budgetChange = currentBudget - previousBudget

    // Look for budget-related events
    const budgetEvents = events.filter(e => 
      e.context.budget || e.context.price || e.context.budgetConstraint
    )

    // Significant budget change (>$50 or >20% change)
    const significantChange = Math.abs(budgetChange) > 50 || 
                             Math.abs(budgetChange / previousBudget) > 0.2

    if (significantChange && budgetEvents.length > 0) {
      const trigger = budgetChange > 0 ? 'budget_increase' : 'budget_optimization'

      evolutions.push({
        userId: '', // Will be set by caller
        deckId,
        evolutionType: 'budget_adjustment',
        previousState: {
          totalValue: previousBudget,
          expensiveCards: this.extractExpensiveCards(previousState),
          budgetStrategy: this.inferBudgetStrategy(previousState)
        },
        newState: {
          totalValue: currentBudget,
          expensiveCards: this.extractExpensiveCards(currentState),
          budgetStrategy: this.inferBudgetStrategy(currentState),
          optimization: this.analyzeBudgetOptimization(previousState, currentState)
        },
        trigger,
        confidence: Math.min(Math.abs(budgetChange) / 100, 0.9),
        timestamp: new Date(),
        context: {
          budgetChange,
          percentageChange: budgetChange / previousBudget,
          budgetEvents: budgetEvents.length
        }
      })
    }

    return evolutions
  }

  /**
   * Detect synergy discoveries
   */
  private async detectSynergyDiscovery(
    deckId: string,
    currentState: any,
    events: LearningEvent[]
  ): Promise<StrategyEvolution[]> {
    const evolutions: StrategyEvolution[] = []

    // Look for new card combinations that suggest synergy discovery
    const recentAdditions = events.filter(e => 
      e.eventType === 'manual_change' &&
      e.context.changeType === 'card_added' &&
      new Date(e.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last week
    )

    if (recentAdditions.length < 2) return evolutions

    // Group additions by time proximity (within 1 hour)
    const synergyGroups = this.groupCardsByTimeProximity(recentAdditions, 60 * 60 * 1000)

    for (const group of synergyGroups) {
      if (group.length < 2) continue

      // Analyze potential synergies
      const cards = group.map(e => e.cardId).filter(Boolean)
      const synergyAnalysis = await this.analyzePotentialSynergy(cards, currentState)

      if (synergyAnalysis.hasSynergy && synergyAnalysis.confidence > 0.7) {
        evolutions.push({
          userId: '', // Will be set by caller
          deckId,
          evolutionType: 'synergy_discovery',
          previousState: {
            synergyCount: this.countExistingSynergies(currentState) - 1,
            keyInteractions: synergyAnalysis.previousInteractions
          },
          newState: {
            synergyCount: this.countExistingSynergies(currentState),
            newSynergy: {
              cards,
              type: synergyAnalysis.synergyType,
              strength: synergyAnalysis.strength,
              description: synergyAnalysis.description
            },
            keyInteractions: synergyAnalysis.newInteractions
          },
          trigger: 'synergy_discovery',
          confidence: synergyAnalysis.confidence,
          timestamp: new Date(),
          context: {
            discoveredCards: cards,
            synergyType: synergyAnalysis.synergyType,
            additionTimespan: this.calculateTimespan(group)
          }
        })
      }
    }

    return evolutions
  }

  /**
   * Detect strategy shifts
   */
  private async detectStrategyShift(
    deckId: string,
    currentState: any,
    previousState: any,
    events: LearningEvent[]
  ): Promise<StrategyEvolution[]> {
    const evolutions: StrategyEvolution[] = []

    if (!previousState) return evolutions

    // Compare strategy indicators
    const currentStrategy = this.analyzeStrategy(currentState)
    const previousStrategy = this.analyzeStrategy(previousState)

    const strategyDifference = this.calculateStrategyDifference(
      currentStrategy,
      previousStrategy
    )

    // Significant strategy change threshold
    if (strategyDifference > 0.4) {
      // Look for strategy-related events
      const strategyEvents = events.filter(e => 
        e.context.strategy || e.context.strategyChange || e.context.winCondition
      )

      const trigger = this.identifyStrategyTrigger(events, currentStrategy, previousStrategy)

      evolutions.push({
        userId: '', // Will be set by caller
        deckId,
        evolutionType: 'strategy_shift',
        previousState: {
          primaryStrategy: previousStrategy.primary,
          secondaryStrategies: previousStrategy.secondary,
          winConditions: previousStrategy.winConditions,
          gameplan: previousStrategy.gameplan
        },
        newState: {
          primaryStrategy: currentStrategy.primary,
          secondaryStrategies: currentStrategy.secondary,
          winConditions: currentStrategy.winConditions,
          gameplan: currentStrategy.gameplan,
          transitionType: this.classifyTransition(previousStrategy, currentStrategy)
        },
        trigger,
        confidence: Math.min(strategyDifference, 0.95),
        timestamp: new Date(),
        context: {
          strategyDifference,
          supportingEvents: strategyEvents.length,
          transitionReason: trigger
        }
      })
    }

    return evolutions
  }

  /**
   * Track evolution event
   */
  private async trackEvolution(userId: string, evolution: StrategyEvolution): Promise<void> {
    evolution.userId = userId

    await learningEventTracker.trackStrategyEvolution(
      userId,
      evolution.deckId,
      evolution.evolutionType,
      {
        previousStrategy: evolution.previousState,
        newStrategy: evolution.newState,
        trigger: evolution.trigger,
        confidence: evolution.confidence,
        context: evolution.context,
        outcome: 'detected' // Will be updated based on performance
      }
    )
  }

  /**
   * Build meta analysis prompt for AI
   */
  private buildMetaAnalysisPrompt(
    currentState: any,
    addedCards: LearningEvent[],
    removedCards: LearningEvent[],
    metaEvents: LearningEvent[]
  ): string {
    return `
Analyze whether recent deck changes represent meta adaptation:

Current Deck State:
${JSON.stringify(currentState, null, 2)}

Recent Card Additions:
${addedCards.map(e => `- ${e.cardId}: ${e.context.reason || 'No reason given'}`).join('\n')}

Recent Card Removals:
${removedCards.map(e => `- ${e.cardId}: ${e.context.reason || 'No reason given'}`).join('\n')}

Meta Context:
${metaEvents.map(e => `- ${e.context.metaChange || e.context.tournamentResult}`).join('\n')}

Determine:
1. Is this meta adaptation? (boolean)
2. What was the previous strategy/meta position?
3. What is the new strategy/meta position?
4. What specific adaptations were made?
5. What triggered this adaptation?
6. Confidence level (0-1)
7. Reasoning for the analysis

Return as JSON with: isMetaAdaptation, previousStrategy, newStrategy, previousMetaPosition, newMetaPosition, adaptations, trigger, confidence, reasoning
    `.trim()
  }

  /**
   * Calculate power level of a deck
   */
  private calculatePowerLevel(deckState: any): number {
    // Simplified power level calculation
    // In reality, this would analyze card power, synergies, consistency, etc.
    
    if (!deckState?.cards) return 5 // Default mid-power

    const powerCards = deckState.cards.filter((card: any) => 
      card.powerLevel && card.powerLevel > 7
    ).length

    const totalCards = deckState.cards.length
    const powerRatio = powerCards / totalCards

    // Scale to 1-10 power level
    return Math.min(10, Math.max(1, 3 + (powerRatio * 7)))
  }

  /**
   * Extract high power cards from deck state
   */
  private extractHighPowerCards(deckState: any): string[] {
    if (!deckState?.cards) return []

    return deckState.cards
      .filter((card: any) => card.powerLevel && card.powerLevel > 7)
      .map((card: any) => card.cardId)
      .slice(0, 10) // Top 10 power cards
  }

  /**
   * Identify power level change trigger
   */
  private identifyPowerLevelTrigger(events: LearningEvent[], powerLevelChange: number): string {
    const recentEvents = events.filter(e => 
      new Date(e.timestamp) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    )

    // Look for specific triggers
    if (recentEvents.some(e => e.context.playgroup || e.context.meta)) {
      return powerLevelChange > 0 ? 'playgroup_arms_race' : 'playgroup_power_down'
    }

    if (recentEvents.some(e => e.context.budget)) {
      return powerLevelChange > 0 ? 'budget_increase' : 'budget_constraint'
    }

    if (recentEvents.some(e => e.context.tournament || e.context.competitive)) {
      return powerLevelChange > 0 ? 'competitive_optimization' : 'casual_adjustment'
    }

    return powerLevelChange > 0 ? 'power_increase' : 'power_decrease'
  }

  /**
   * Calculate deck value
   */
  private calculateDeckValue(deckState: any): number {
    if (!deckState?.cards) return 0

    return deckState.cards.reduce((total: number, card: any) => {
      return total + (card.price || 0) * (card.quantity || 1)
    }, 0)
  }

  /**
   * Extract expensive cards from deck
   */
  private extractExpensiveCards(deckState: any): Array<{ cardId: string; price: number }> {
    if (!deckState?.cards) return []

    return deckState.cards
      .filter((card: any) => card.price && card.price > 20)
      .map((card: any) => ({ cardId: card.cardId, price: card.price }))
      .sort((a: any, b: any) => b.price - a.price)
      .slice(0, 10)
  }

  /**
   * Infer budget strategy from deck composition
   */
  private inferBudgetStrategy(deckState: any): string {
    const totalValue = this.calculateDeckValue(deckState)
    const expensiveCards = this.extractExpensiveCards(deckState)

    if (totalValue < 100) return 'budget'
    if (totalValue > 500) return 'high_budget'
    if (expensiveCards.length > 5) return 'focused_expensive'
    return 'balanced'
  }

  /**
   * Analyze budget optimization between states
   */
  private analyzeBudgetOptimization(previousState: any, currentState: any): any {
    const previousValue = this.calculateDeckValue(previousState)
    const currentValue = this.calculateDeckValue(currentState)
    const valueDifference = currentValue - previousValue

    return {
      valueDifference,
      optimizationType: valueDifference > 0 ? 'upgrade' : 'budget_cut',
      efficiency: this.calculateOptimizationEfficiency(previousState, currentState)
    }
  }

  /**
   * Calculate optimization efficiency
   */
  private calculateOptimizationEfficiency(previousState: any, currentState: any): number {
    // Simplified efficiency calculation
    // Would compare power level change vs cost change
    const powerChange = this.calculatePowerLevel(currentState) - this.calculatePowerLevel(previousState)
    const costChange = this.calculateDeckValue(currentState) - this.calculateDeckValue(previousState)

    if (costChange === 0) return powerChange > 0 ? 1 : 0
    return Math.max(0, powerChange / (Math.abs(costChange) / 100))
  }

  /**
   * Group cards by time proximity
   */
  private groupCardsByTimeProximity(events: LearningEvent[], proximityMs: number): LearningEvent[][] {
    const groups: LearningEvent[][] = []
    const sortedEvents = events.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    let currentGroup: LearningEvent[] = []

    for (const event of sortedEvents) {
      if (currentGroup.length === 0) {
        currentGroup.push(event)
      } else {
        const lastEvent = currentGroup[currentGroup.length - 1]
        const timeDiff = new Date(event.timestamp).getTime() - new Date(lastEvent.timestamp).getTime()

        if (timeDiff <= proximityMs) {
          currentGroup.push(event)
        } else {
          if (currentGroup.length > 1) {
            groups.push(currentGroup)
          }
          currentGroup = [event]
        }
      }
    }

    if (currentGroup.length > 1) {
      groups.push(currentGroup)
    }

    return groups
  }

  /**
   * Analyze potential synergy between cards
   */
  private async analyzePotentialSynergy(cards: string[], deckState: any): Promise<{
    hasSynergy: boolean
    confidence: number
    synergyType: string
    strength: number
    description: string
    previousInteractions: any[]
    newInteractions: any[]
  }> {
    // Simplified synergy analysis
    // In reality, this would use AI to analyze card interactions
    
    return {
      hasSynergy: cards.length >= 2,
      confidence: 0.8,
      synergyType: 'combo',
      strength: 0.7,
      description: `Synergy between ${cards.join(' and ')}`,
      previousInteractions: [],
      newInteractions: []
    }
  }

  /**
   * Count existing synergies in deck
   */
  private countExistingSynergies(deckState: any): number {
    // Simplified synergy counting
    return deckState?.synergies?.length || 0
  }

  /**
   * Calculate timespan of a group of events
   */
  private calculateTimespan(events: LearningEvent[]): number {
    if (events.length < 2) return 0

    const timestamps = events.map(e => new Date(e.timestamp).getTime())
    return Math.max(...timestamps) - Math.min(...timestamps)
  }

  /**
   * Analyze strategy of a deck state
   */
  private analyzeStrategy(deckState: any): {
    primary: string
    secondary: string[]
    winConditions: string[]
    gameplan: string
  } {
    // Simplified strategy analysis
    return {
      primary: deckState?.strategy?.primary || 'unknown',
      secondary: deckState?.strategy?.secondary || [],
      winConditions: deckState?.strategy?.winConditions || [],
      gameplan: deckState?.strategy?.gameplan || 'unknown'
    }
  }

  /**
   * Calculate difference between strategies
   */
  private calculateStrategyDifference(current: any, previous: any): number {
    let difference = 0

    // Compare primary strategy
    if (current.primary !== previous.primary) {
      difference += 0.5
    }

    // Compare secondary strategies
    const currentSecondary = new Set(current.secondary)
    const previousSecondary = new Set(previous.secondary)
    const secondaryOverlap = new Set([...currentSecondary].filter(x => previousSecondary.has(x)))
    const secondaryDifference = 1 - (secondaryOverlap.size / Math.max(currentSecondary.size, previousSecondary.size, 1))
    difference += secondaryDifference * 0.3

    // Compare win conditions
    const currentWinCons = new Set(current.winConditions)
    const previousWinCons = new Set(previous.winConditions)
    const winConOverlap = new Set([...currentWinCons].filter(x => previousWinCons.has(x)))
    const winConDifference = 1 - (winConOverlap.size / Math.max(currentWinCons.size, previousWinCons.size, 1))
    difference += winConDifference * 0.2

    return Math.min(difference, 1)
  }

  /**
   * Identify strategy change trigger
   */
  private identifyStrategyTrigger(events: LearningEvent[], current: any, previous: any): string {
    const recentEvents = events.filter(e => 
      new Date(e.timestamp) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    )

    if (recentEvents.some(e => e.context.meta || e.context.tournament)) {
      return 'meta_shift'
    }

    if (recentEvents.some(e => e.context.performance === 'poor')) {
      return 'performance_issues'
    }

    if (recentEvents.some(e => e.context.inspiration || e.context.newIdea)) {
      return 'creative_inspiration'
    }

    if (recentEvents.some(e => e.context.budget)) {
      return 'budget_change'
    }

    return 'gradual_evolution'
  }

  /**
   * Classify strategy transition type
   */
  private classifyTransition(previous: any, current: any): string {
    if (previous.primary === current.primary) {
      return 'refinement'
    }

    const strategySimilarity = this.calculateStrategySimilarity(previous.primary, current.primary)
    
    if (strategySimilarity > 0.7) {
      return 'evolution'
    } else if (strategySimilarity > 0.3) {
      return 'pivot'
    } else {
      return 'complete_rebuild'
    }
  }

  /**
   * Calculate similarity between two strategies
   */
  private calculateStrategySimilarity(strategy1: string, strategy2: string): number {
    // Simplified similarity calculation
    // In reality, this would use semantic analysis
    
    if (strategy1 === strategy2) return 1
    
    // Basic keyword matching
    const keywords1 = strategy1.toLowerCase().split(/\s+/)
    const keywords2 = strategy2.toLowerCase().split(/\s+/)
    
    const commonKeywords = keywords1.filter(k => keywords2.includes(k))
    const totalKeywords = new Set([...keywords1, ...keywords2]).size
    
    return commonKeywords.length / totalKeywords
  }

  /**
   * Get evolution history for a deck
   */
  async getEvolutionHistory(deckId: string): Promise<StrategyEvolution[]> {
    const events = await learningEventTracker.getUserLearningEvents('', undefined, ['strategy_evolution'])
    
    return events
      .filter(e => e.deckId === deckId)
      .map(e => ({
        userId: e.context.userId || '',
        deckId,
        evolutionType: e.context.evolutionType,
        previousState: e.context.previousStrategy,
        newState: e.context.newStrategy,
        trigger: e.context.trigger,
        confidence: e.confidence || 0.5,
        timestamp: new Date(e.timestamp),
        context: e.context
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Get evolution trends for a user
   */
  async getEvolutionTrends(userId: string): Promise<{
    mostCommonTriggers: string[]
    evolutionFrequency: number
    averageConfidence: number
    evolutionTypes: Record<string, number>
  }> {
    const events = await learningEventTracker.getUserLearningEvents(userId, undefined, ['strategy_evolution'])
    
    if (events.length === 0) {
      return {
        mostCommonTriggers: [],
        evolutionFrequency: 0,
        averageConfidence: 0,
        evolutionTypes: {}
      }
    }

    const triggers = events.map(e => e.context.trigger).filter(Boolean)
    const triggerCounts = triggers.reduce((acc, trigger) => {
      acc[trigger] = (acc[trigger] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const mostCommonTriggers = Object.entries(triggerCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([trigger]) => trigger)

    const evolutionTypes = events.reduce((acc, event) => {
      const type = event.context.evolutionType
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const averageConfidence = events.reduce((sum, e) => sum + (e.confidence || 0.5), 0) / events.length

    // Calculate evolution frequency (evolutions per month)
    const oldestEvent = new Date(Math.min(...events.map(e => new Date(e.timestamp).getTime())))
    const monthsSinceFirst = (Date.now() - oldestEvent.getTime()) / (30 * 24 * 60 * 60 * 1000)
    const evolutionFrequency = events.length / Math.max(monthsSinceFirst, 1)

    return {
      mostCommonTriggers,
      evolutionFrequency,
      averageConfidence,
      evolutionTypes
    }
  }
}

export const strategyEvolutionDetector = new StrategyEvolutionDetector()
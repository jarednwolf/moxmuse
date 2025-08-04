import { prisma as db } from '@moxmuse/db'
import type { 
  DeckRelationship,
  UserStyleProfile,
  LearningEvent
} from '../../types/learning'
import { learningEventTracker } from './learning-event-tracker'
import { openaiService } from '../openai'

export class DeckRelationshipMapper {
  /**
   * Build comprehensive deck relationship mapping for portfolio insights
   */
  async buildDeckRelationships(userId: string): Promise<DeckRelationship[]> {
    // Get all user's decks
    const userDecks = await this.getUserDecks(userId)
    
    if (userDecks.length < 2) {
      return [] // Need at least 2 decks for relationships
    }

    const relationships: DeckRelationship[] = []

    // Analyze relationships between all deck pairs
    for (let i = 0; i < userDecks.length; i++) {
      for (let j = i + 1; j < userDecks.length; j++) {
        const deck1 = userDecks[i]
        const deck2 = userDecks[j]

        const relationship = await this.analyzeDeckRelationship(deck1, deck2)
        if (relationship) {
          relationships.push(relationship)
        }
      }
    }

    // Store relationships for future use
    await this.storeRelationships(userId, relationships)

    return relationships
  }

  /**
   * Analyze relationship between two decks
   */
  private async analyzeDeckRelationship(deck1: any, deck2: any): Promise<DeckRelationship | null> {
    // Calculate various relationship metrics
    const [
      strategicSimilarity,
      cardOverlap,
      powerLevelDifference,
      budgetRelationship,
      synergyCompatibility
    ] = await Promise.all([
      this.calculateStrategicSimilarity(deck1, deck2),
      this.calculateCardOverlap(deck1, deck2),
      this.calculatePowerLevelDifference(deck1, deck2),
      this.analyzeBudgetRelationship(deck1, deck2),
      this.analyzeSynergyCompatibility(deck1, deck2)
    ])

    // Determine relationship type and strength
    const relationshipType = this.determineRelationshipType({
      strategicSimilarity,
      cardOverlap,
      powerLevelDifference,
      budgetRelationship,
      synergyCompatibility
    })

    if (!relationshipType) {
      return null // No significant relationship
    }

    const strength = this.calculateRelationshipStrength({
      strategicSimilarity,
      cardOverlap,
      powerLevelDifference,
      budgetRelationship,
      synergyCompatibility
    })

    const sharedCards = this.extractSharedCards(deck1, deck2)

    return {
      deckId1: deck1.id,
      deckId2: deck2.id,
      relationshipType,
      strength,
      sharedCards,
      strategicOverlap: strategicSimilarity,
      lastAnalyzed: new Date()
    }
  }

  /**
   * Calculate strategic similarity between decks
   */
  private async calculateStrategicSimilarity(deck1: any, deck2: any): Promise<number> {
    const strategy1 = deck1.strategy || {}
    const strategy2 = deck2.strategy || {}

    let similarity = 0
    let comparisons = 0

    // Compare primary strategies
    if (strategy1.primary && strategy2.primary) {
      similarity += strategy1.primary === strategy2.primary ? 1 : 0
      comparisons++
    }

    // Compare win conditions
    if (strategy1.winConditions && strategy2.winConditions) {
      const winCons1 = new Set(strategy1.winConditions)
      const winCons2 = new Set(strategy2.winConditions)
      const overlap = new Set([...winCons1].filter(x => winCons2.has(x)))
      const winConSimilarity = overlap.size / Math.max(winCons1.size, winCons2.size, 1)
      similarity += winConSimilarity
      comparisons++
    }

    // Compare themes
    if (strategy1.themes && strategy2.themes) {
      const themes1 = new Set(strategy1.themes)
      const themes2 = new Set(strategy2.themes)
      const themeOverlap = new Set([...themes1].filter(x => themes2.has(x)))
      const themeSimilarity = themeOverlap.size / Math.max(themes1.size, themes2.size, 1)
      similarity += themeSimilarity
      comparisons++
    }

    return comparisons > 0 ? similarity / comparisons : 0
  }

  /**
   * Calculate card overlap between decks
   */
  private calculateCardOverlap(deck1: any, deck2: any): Promise<number> {
    const cards1 = new Set(deck1.cards?.map((c: any) => c.cardId) || [])
    const cards2 = new Set(deck2.cards?.map((c: any) => c.cardId) || [])
    
    const overlap = new Set([...cards1].filter(x => cards2.has(x)))
    const totalUniqueCards = new Set([...cards1, ...cards2]).size
    
    return Promise.resolve(overlap.size / totalUniqueCards)
  }

  /**
   * Calculate power level difference between decks
   */
  private calculatePowerLevelDifference(deck1: any, deck2: any): Promise<number> {
    const power1 = deck1.powerLevel || this.estimatePowerLevel(deck1)
    const power2 = deck2.powerLevel || this.estimatePowerLevel(deck2)
    
    return Promise.resolve(Math.abs(power1 - power2) / 10) // Normalize to 0-1
  }

  /**
   * Analyze budget relationship between decks
   */
  private analyzeBudgetRelationship(deck1: any, deck2: any): Promise<{
    type: 'similar' | 'upgrade_path' | 'budget_variant' | 'different'
    ratio: number
  }> {
    const value1 = this.calculateDeckValue(deck1)
    const value2 = this.calculateDeckValue(deck2)
    
    const ratio = Math.max(value1, value2) / Math.max(Math.min(value1, value2), 1)
    
    let type: 'similar' | 'upgrade_path' | 'budget_variant' | 'different'
    
    if (ratio < 1.5) {
      type = 'similar'
    } else if (ratio < 3) {
      type = value1 > value2 ? 'upgrade_path' : 'budget_variant'
    } else {
      type = 'different'
    }
    
    return Promise.resolve({ type, ratio })
  }

  /**
   * Analyze synergy compatibility between decks
   */
  private async analyzeSynergyCompatibility(deck1: any, deck2: any): Promise<number> {
    // Check if decks could share synergistic elements
    const synergies1 = deck1.synergies || []
    const synergies2 = deck2.synergies || []
    
    if (synergies1.length === 0 || synergies2.length === 0) {
      return 0
    }

    // Compare synergy types and themes
    const synergyTypes1 = new Set(synergies1.map((s: any) => s.type))
    const synergyTypes2 = new Set(synergies2.map((s: any) => s.type))
    
    const typeOverlap = new Set([...synergyTypes1].filter(x => synergyTypes2.has(x)))
    
    return typeOverlap.size / Math.max(synergyTypes1.size, synergyTypes2.size, 1)
  }

  /**
   * Determine relationship type based on metrics
   */
  private determineRelationshipType(metrics: {
    strategicSimilarity: number
    cardOverlap: number
    powerLevelDifference: number
    budgetRelationship: { type: string; ratio: number }
    synergyCompatibility: number
  }): 'similar_strategy' | 'complementary' | 'upgrade_path' | 'budget_variant' | null {
    const {
      strategicSimilarity,
      cardOverlap,
      powerLevelDifference,
      budgetRelationship,
      synergyCompatibility
    } = metrics

    // Similar strategy decks
    if (strategicSimilarity > 0.7 && cardOverlap > 0.3) {
      return 'similar_strategy'
    }

    // Upgrade path relationship
    if (budgetRelationship.type === 'upgrade_path' && strategicSimilarity > 0.5) {
      return 'upgrade_path'
    }

    // Budget variant relationship
    if (budgetRelationship.type === 'budget_variant' && strategicSimilarity > 0.5) {
      return 'budget_variant'
    }

    // Complementary decks (different strategies but compatible)
    if (strategicSimilarity < 0.3 && synergyCompatibility > 0.4 && powerLevelDifference < 0.3) {
      return 'complementary'
    }

    // No significant relationship
    if (strategicSimilarity < 0.2 && cardOverlap < 0.1 && synergyCompatibility < 0.2) {
      return null
    }

    // Default to similar strategy if there's some overlap
    if (strategicSimilarity > 0.4 || cardOverlap > 0.2) {
      return 'similar_strategy'
    }

    return null
  }

  /**
   * Calculate relationship strength
   */
  private calculateRelationshipStrength(metrics: {
    strategicSimilarity: number
    cardOverlap: number
    powerLevelDifference: number
    budgetRelationship: { type: string; ratio: number }
    synergyCompatibility: number
  }): number {
    const {
      strategicSimilarity,
      cardOverlap,
      powerLevelDifference,
      synergyCompatibility
    } = metrics

    // Weighted combination of metrics
    const strength = (
      strategicSimilarity * 0.4 +
      cardOverlap * 0.3 +
      (1 - powerLevelDifference) * 0.1 + // Closer power levels = stronger relationship
      synergyCompatibility * 0.2
    )

    return Math.max(0, Math.min(1, strength))
  }

  /**
   * Extract shared cards between decks
   */
  private extractSharedCards(deck1: any, deck2: any): string[] {
    const cards1 = new Set(deck1.cards?.map((c: any) => c.cardId) || [])
    const cards2 = new Set(deck2.cards?.map((c: any) => c.cardId) || [])
    
    return [...cards1].filter(cardId => cards2.has(cardId))
  }

  /**
   * Get portfolio insights based on deck relationships
   */
  async getPortfolioInsights(userId: string): Promise<{
    deckCount: number
    relationships: DeckRelationship[]
    strategyCoverage: string[]
    powerLevelDistribution: Record<string, number>
    budgetDistribution: Record<string, number>
    recommendations: string[]
    gaps: string[]
  }> {
    const relationships = await this.buildDeckRelationships(userId)
    const userDecks = await this.getUserDecks(userId)

    // Analyze strategy coverage
    const strategies = userDecks.map(deck => deck.strategy?.primary).filter(Boolean)
    const strategyCoverage = [...new Set(strategies)]

    // Analyze power level distribution
    const powerLevels = userDecks.map(deck => this.estimatePowerLevel(deck))
    const powerLevelDistribution = this.distributionAnalysis(powerLevels, [
      { label: 'Low (1-3)', min: 1, max: 3 },
      { label: 'Medium (4-6)', min: 4, max: 6 },
      { label: 'High (7-8)', min: 7, max: 8 },
      { label: 'cEDH (9-10)', min: 9, max: 10 }
    ])

    // Analyze budget distribution
    const budgets = userDecks.map(deck => this.calculateDeckValue(deck))
    const budgetDistribution = this.distributionAnalysis(budgets, [
      { label: 'Budget (<$100)', min: 0, max: 100 },
      { label: 'Mid ($100-300)', min: 100, max: 300 },
      { label: 'High ($300-600)', min: 300, max: 600 },
      { label: 'Premium (>$600)', min: 600, max: Infinity }
    ])

    // Generate recommendations
    const recommendations = this.generatePortfolioRecommendations(
      userDecks,
      relationships,
      strategyCoverage,
      powerLevelDistribution,
      budgetDistribution
    )

    // Identify gaps
    const gaps = this.identifyPortfolioGaps(
      strategyCoverage,
      powerLevelDistribution,
      budgetDistribution
    )

    return {
      deckCount: userDecks.length,
      relationships,
      strategyCoverage,
      powerLevelDistribution,
      budgetDistribution,
      recommendations,
      gaps
    }
  }

  /**
   * Generate cross-deck optimization suggestions
   */
  async generateCrossDeckOptimizations(userId: string): Promise<Array<{
    type: 'card_sharing' | 'strategy_synergy' | 'budget_optimization' | 'power_balancing'
    description: string
    affectedDecks: string[]
    impact: number
    effort: number
    suggestions: string[]
  }>> {
    const relationships = await this.buildDeckRelationships(userId)
    const userDecks = await this.getUserDecks(userId)
    const optimizations: any[] = []

    // Card sharing optimizations
    const cardSharingOpts = this.generateCardSharingOptimizations(relationships, userDecks)
    optimizations.push(...cardSharingOpts)

    // Strategy synergy optimizations
    const strategySynergyOpts = this.generateStrategySynergyOptimizations(relationships, userDecks)
    optimizations.push(...strategySynergyOpts)

    // Budget optimization suggestions
    const budgetOpts = this.generateBudgetOptimizations(relationships, userDecks)
    optimizations.push(...budgetOpts)

    // Power level balancing
    const powerBalancingOpts = this.generatePowerBalancingOptimizations(relationships, userDecks)
    optimizations.push(...powerBalancingOpts)

    return optimizations.sort((a, b) => (b.impact / b.effort) - (a.impact / a.effort))
  }

  /**
   * Track deck relationship changes over time
   */
  async trackRelationshipEvolution(userId: string): Promise<Array<{
    timestamp: Date
    relationshipId: string
    changeType: 'strengthened' | 'weakened' | 'type_changed' | 'new' | 'removed'
    previousValue?: any
    newValue: any
    trigger: string
  }>> {
    // This would track how relationships change as decks evolve
    // For now, return empty array as this requires historical data
    return []
  }

  // Helper methods

  private async getUserDecks(userId: string): Promise<any[]> {
    const decks = await db.enhancedDeck.findMany({
      where: { userId },
      include: {
        cards: true
      }
    })

    return decks.map(deck => ({
      id: deck.id,
      name: deck.name,
      commander: deck.commander,
      strategy: deck.strategy,
      cards: deck.cards,
      powerLevel: deck.analysis?.powerLevel,
      synergies: deck.analysis?.synergies
    }))
  }

  private estimatePowerLevel(deck: any): number {
    // Simplified power level estimation
    if (deck.powerLevel) return deck.powerLevel

    const cardCount = deck.cards?.length || 0
    const expensiveCards = deck.cards?.filter((c: any) => (c.price || 0) > 20).length || 0
    
    // Basic estimation based on expensive cards ratio
    const expensiveRatio = expensiveCards / Math.max(cardCount, 1)
    return Math.min(10, Math.max(1, 3 + (expensiveRatio * 7)))
  }

  private calculateDeckValue(deck: any): number {
    if (!deck.cards) return 0
    
    return deck.cards.reduce((total: number, card: any) => {
      return total + (card.price || 0) * (card.quantity || 1)
    }, 0)
  }

  private distributionAnalysis(values: number[], ranges: Array<{ label: string; min: number; max: number }>): Record<string, number> {
    const distribution: Record<string, number> = {}
    
    for (const range of ranges) {
      const count = values.filter(v => v >= range.min && v <= range.max).length
      distribution[range.label] = count
    }
    
    return distribution
  }

  private generatePortfolioRecommendations(
    decks: any[],
    relationships: DeckRelationship[],
    strategies: string[],
    powerLevels: Record<string, number>,
    budgets: Record<string, number>
  ): string[] {
    const recommendations: string[] = []

    // Strategy diversity recommendations
    if (strategies.length < 3 && decks.length >= 3) {
      recommendations.push('Consider building decks with different strategies to diversify your portfolio')
    }

    // Power level balance recommendations
    const powerLevelCounts = Object.values(powerLevels)
    const maxPowerLevel = Math.max(...powerLevelCounts)
    if (maxPowerLevel > decks.length * 0.7) {
      recommendations.push('Consider building decks at different power levels for varied play experiences')
    }

    // Budget optimization recommendations
    const budgetCounts = Object.values(budgets)
    const highBudgetDecks = budgets['Premium (>$600)'] || 0
    if (highBudgetDecks > decks.length * 0.5) {
      recommendations.push('Consider building some budget-friendly decks to balance your portfolio')
    }

    // Relationship-based recommendations
    const strongRelationships = relationships.filter(r => r.strength > 0.7)
    if (strongRelationships.length > decks.length * 0.3) {
      recommendations.push('Many of your decks are similar - consider exploring different archetypes')
    }

    return recommendations
  }

  private identifyPortfolioGaps(
    strategies: string[],
    powerLevels: Record<string, number>,
    budgets: Record<string, number>
  ): string[] {
    const gaps: string[] = []

    // Common strategy gaps
    const commonStrategies = ['aggro', 'control', 'combo', 'midrange', 'tribal']
    const missingStrategies = commonStrategies.filter(s => !strategies.includes(s))
    
    if (missingStrategies.length > 0) {
      gaps.push(`Missing strategy archetypes: ${missingStrategies.slice(0, 2).join(', ')}`)
    }

    // Power level gaps
    if (!powerLevels['Low (1-3)']) {
      gaps.push('No low-power casual decks for relaxed games')
    }
    if (!powerLevels['High (7-8)']) {
      gaps.push('No high-power decks for competitive casual play')
    }

    // Budget gaps
    if (!budgets['Budget (<$100)']) {
      gaps.push('No budget decks for cost-conscious play')
    }

    return gaps
  }

  private generateCardSharingOptimizations(relationships: DeckRelationship[], decks: any[]): any[] {
    const optimizations: any[] = []

    for (const rel of relationships) {
      if (rel.relationshipType === 'similar_strategy' && rel.sharedCards.length > 10) {
        const deck1 = decks.find(d => d.id === rel.deckId1)
        const deck2 = decks.find(d => d.id === rel.deckId2)
        
        if (deck1 && deck2) {
          optimizations.push({
            type: 'card_sharing',
            description: `${deck1.name} and ${deck2.name} share many cards and could benefit from coordinated optimization`,
            affectedDecks: [rel.deckId1, rel.deckId2],
            impact: 0.7,
            effort: 0.4,
            suggestions: [
              'Consider different tech choices to cover more meta angles',
              'Share expensive staples between similar decks',
              'Coordinate removal suites for different threats'
            ]
          })
        }
      }
    }

    return optimizations
  }

  private generateStrategySynergyOptimizations(relationships: DeckRelationship[], decks: any[]): any[] {
    const optimizations: any[] = []

    const complementaryRels = relationships.filter(r => r.relationshipType === 'complementary')
    
    for (const rel of complementaryRels) {
      const deck1 = decks.find(d => d.id === rel.deckId1)
      const deck2 = decks.find(d => d.id === rel.deckId2)
      
      if (deck1 && deck2) {
        optimizations.push({
          type: 'strategy_synergy',
          description: `${deck1.name} and ${deck2.name} have complementary strategies that could work well together`,
          affectedDecks: [rel.deckId1, rel.deckId2],
          impact: 0.6,
          effort: 0.3,
          suggestions: [
            'These decks cover different aspects of the meta effectively',
            'Consider playing them in rotation for varied experiences',
            'They complement each other\'s weaknesses well'
          ]
        })
      }
    }

    return optimizations
  }

  private generateBudgetOptimizations(relationships: DeckRelationship[], decks: any[]): any[] {
    const optimizations: any[] = []

    const upgradePathRels = relationships.filter(r => r.relationshipType === 'upgrade_path')
    
    for (const rel of upgradePathRels) {
      const budgetDeck = decks.find(d => d.id === rel.deckId2) // Assuming deckId2 is lower budget
      const upgradeDeck = decks.find(d => d.id === rel.deckId1)
      
      if (budgetDeck && upgradeDeck) {
        optimizations.push({
          type: 'budget_optimization',
          description: `${budgetDeck.name} could be upgraded following the pattern of ${upgradeDeck.name}`,
          affectedDecks: [rel.deckId2],
          impact: 0.8,
          effort: 0.6,
          suggestions: [
            'Identify key upgrades that provide the most impact',
            'Prioritize mana base improvements first',
            'Consider gradual upgrade path over time'
          ]
        })
      }
    }

    return optimizations
  }

  private generatePowerBalancingOptimizations(relationships: DeckRelationship[], decks: any[]): any[] {
    const optimizations: any[] = []

    // Find decks with significant power level differences
    for (const rel of relationships) {
      const deck1 = decks.find(d => d.id === rel.deckId1)
      const deck2 = decks.find(d => d.id === rel.deckId2)
      
      if (deck1 && deck2) {
        const power1 = this.estimatePowerLevel(deck1)
        const power2 = this.estimatePowerLevel(deck2)
        const powerDiff = Math.abs(power1 - power2)
        
        if (powerDiff > 2 && rel.relationshipType === 'similar_strategy') {
          const higherDeck = power1 > power2 ? deck1 : deck2
          const lowerDeck = power1 > power2 ? deck2 : deck1
          
          optimizations.push({
            type: 'power_balancing',
            description: `${higherDeck.name} and ${lowerDeck.name} have similar strategies but different power levels`,
            affectedDecks: [higherDeck.id, lowerDeck.id],
            impact: 0.5,
            effort: 0.5,
            suggestions: [
              'Consider power-down options for the higher power deck',
              'Identify upgrade opportunities for the lower power deck',
              'Create variants at different power levels'
            ]
          })
        }
      }
    }

    return optimizations
  }

  private async storeRelationships(userId: string, relationships: DeckRelationship[]): Promise<void> {
    try {
      await db.userLearningData.upsert({
        where: { userId },
        update: {
          deckRelationships: relationships.reduce((acc, rel) => {
            acc[`${rel.deckId1}-${rel.deckId2}`] = rel
            return acc
          }, {} as Record<string, DeckRelationship>),
          lastUpdated: new Date()
        },
        create: {
          id: crypto.randomUUID(),
          userId,
          styleProfile: {},
          deckPreferences: {},
          learningEvents: [],
          suggestionFeedback: [],
          deckRelationships: relationships.reduce((acc, rel) => {
            acc[`${rel.deckId1}-${rel.deckId2}`] = rel
            return acc
          }, {} as Record<string, DeckRelationship>),
          crossDeckInsights: {},
          lastUpdated: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to store deck relationships:', error)
    }
  }
}

export const deckRelationshipMapper = new DeckRelationshipMapper()
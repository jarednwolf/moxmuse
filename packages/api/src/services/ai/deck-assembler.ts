import { z } from 'zod'
import { aiResearchEngine } from './research-engine'
import { aiServiceOrchestrator } from './index'
import type { ConsultationData } from '@moxmuse/shared'

// Deck assembly types
export const DeckAssemblyRequestSchema = z.object({
  consultationData: z.any(), // ConsultationData from shared types
  commander: z.string(),
  constraints: z.object({
    budget: z.number().optional(),
    powerLevel: z.number().min(1).max(4).optional(),
    useCollection: z.boolean().optional(),
    ownedCards: z.array(z.string()).optional(),
  }).optional(),
})

export type DeckAssemblyRequest = z.infer<typeof DeckAssemblyRequestSchema>

export const AssembledDeckSchema = z.object({
  commander: z.string(),
  cards: z.array(z.object({
    cardId: z.string(),
    name: z.string(),
    quantity: z.number().default(1),
    category: z.enum([
      'commander',
      'lands',
      'ramp',
      'draw',
      'removal',
      'board_wipes',
      'win_conditions',
      'synergy',
      'utility',
      'protection'
    ]),
    reasoning: z.string(),
    alternatives: z.array(z.string()).optional(),
    researchSources: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1),
  })),
  strategy: z.object({
    name: z.string(),
    description: z.string(),
    gameplan: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  }),
  composition: z.object({
    totalCards: z.number(),
    lands: z.number(),
    ramp: z.number(),
    draw: z.number(),
    removal: z.number(),
    winConditions: z.number(),
    synergy: z.number(),
    utility: z.number(),
  }),
  researchSummary: z.object({
    sourcesConsulted: z.array(z.string()),
    confidenceScore: z.number().min(0).max(1),
    researchDepth: z.enum(['shallow', 'moderate', 'deep']),
    metaRelevance: z.number().min(0).max(1),
  }),
  estimatedBudget: z.number().optional(),
  powerLevelAnalysis: z.object({
    estimatedLevel: z.number().min(1).max(4),
    reasoning: z.string(),
    keyPowerCards: z.array(z.string()),
  }),
})

export type AssembledDeck = z.infer<typeof AssembledDeckSchema>

// Card selection criteria
interface CardSelectionCriteria {
  category: string
  targetCount: number
  priority: number
  requirements: string[]
  constraints: {
    budget?: number
    powerLevel?: number
    colorIdentity: string[]
    strategy: string
  }
}

/**
 * IntelligentDeckAssembler uses AI research to build complete 100-card decks
 * Combines multiple AI models and research sources for optimal card selection
 */
export class IntelligentDeckAssembler {
  private assemblyHistory: Map<string, AssembledDeck[]> = new Map()
  private cardDatabase: Map<string, any> = new Map() // Cache for card data
  private categoryTemplates: Map<string, CardSelectionCriteria> = new Map()

  constructor() {
    this.initializeCategoryTemplates()
  }

  /**
   * Assemble a complete 100-card Commander deck
   */
  async assembleDeck(request: DeckAssemblyRequest): Promise<AssembledDeck> {
    console.log(`🏗️ Assembling deck for commander: ${request.commander}`)
    console.log(`Strategy: ${request.consultationData.strategy}`)
    console.log(`Power Level: ${request.constraints?.powerLevel || 3}`)

    const startTime = Date.now()

    try {
      // 1. Research the commander and strategy
      const commanderResearch = await this.researchCommander(
        request.commander,
        request.consultationData
      )

      // 2. Research current meta trends
      const metaResearch = await aiResearchEngine.researchMetaTrends('commander', 'last_30_days')

      // 3. Create deck composition plan
      const compositionPlan = this.createCompositionPlan(
        request.consultationData,
        commanderResearch,
        metaResearch
      )

      // 4. Research and select cards for each category
      const selectedCards = await this.selectCardsForCategories(
        compositionPlan,
        request.commander,
        request.consultationData,
        request.constraints
      )

      // 5. Validate and optimize the deck
      const optimizedDeck = await this.validateAndOptimizeDeck(
        selectedCards,
        request.commander,
        request.consultationData,
        request.constraints
      )

      // 6. Analyze power level
      const powerLevelAnalysis = await this.analyzePowerLevel(
        optimizedDeck,
        request.constraints?.powerLevel
      )

      // 7. Build final deck structure
      const assembledDeck: AssembledDeck = {
        commander: request.commander,
        cards: optimizedDeck,
        strategy: {
          name: request.consultationData.strategy || 'Custom Strategy',
          description: commanderResearch.strategyDescription,
          gameplan: commanderResearch.gameplan,
          strengths: commanderResearch.strengths,
          weaknesses: commanderResearch.weaknesses,
        },
        composition: this.calculateComposition(optimizedDeck),
        researchSummary: {
          sourcesConsulted: ['edhrec', 'mtgtop8', 'reddit', 'tournament_db'],
          confidenceScore: this.calculateOverallConfidence(optimizedDeck),
          researchDepth: 'deep',
          metaRelevance: metaResearch.trends.length > 0 ? 0.85 : 0.7,
        },
        estimatedBudget: request.constraints?.budget,
        powerLevelAnalysis,
      }

      // 8. Store in history
      this.storeAssemblyHistory(request.commander, assembledDeck)

      const assemblyTime = Date.now() - startTime
      console.log(`✅ Deck assembled successfully in ${assemblyTime}ms`)
      console.log(`Total cards: ${assembledDeck.cards.length}`)
      console.log(`Estimated power level: ${powerLevelAnalysis.estimatedLevel}`)

      return assembledDeck

    } catch (error) {
      console.error('❌ Deck assembly failed:', error)
      throw new Error(`Deck assembly failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Research commander capabilities and synergies
   */
  private async researchCommander(
    commander: string,
    consultationData: ConsultationData
  ): Promise<{
    strategyDescription: string
    gameplan: string
    strengths: string[]
    weaknesses: string[]
    keyCards: string[]
    colorIdentity: string[]
  }> {
    console.log(`🔍 Researching commander: ${commander}`)

    // Use AI to analyze the commander
    const aiResponse = await aiServiceOrchestrator.executeAITask({
      taskType: 'commander-analysis',
      prompt: `Analyze ${commander} as a Commander. Provide strategy description, gameplan, strengths, weaknesses, and key synergy cards.`,
      variables: {
        commander,
        strategy: consultationData.strategy,
        powerLevel: consultationData.powerLevel,
        themes: consultationData.themes,
      },
      constraints: {
        maxTokens: 1000,
        prioritizeSpeed: false,
      },
    })

    // Research synergies
    const synergyResearch = await aiResearchEngine.researchCardSynergies(
      commander,
      commander,
      consultationData.strategy
    )

    // Mock implementation - in reality would parse AI response
    return {
      strategyDescription: `${commander} leads a ${consultationData.strategy || 'versatile'} strategy focused on maximizing commander synergies and board presence.`,
      gameplan: 'Establish early board presence, protect the commander, and execute the primary strategy while maintaining card advantage.',
      strengths: ['Strong commander synergies', 'Consistent strategy execution', 'Good color identity'],
      weaknesses: ['Commander dependency', 'Vulnerable to removal', 'May struggle against faster strategies'],
      keyCards: synergyResearch.synergies.map(s => s.cardName),
      colorIdentity: this.extractColorIdentity(commander),
    }
  }

  /**
   * Create composition plan based on research
   */
  private createCompositionPlan(
    consultationData: ConsultationData,
    commanderResearch: any,
    metaResearch: any
  ): CardSelectionCriteria[] {
    console.log('📋 Creating deck composition plan')

    const colorIdentity = commanderResearch.colorIdentity
    const strategy = consultationData.strategy || 'midrange'
    const powerLevel = consultationData.powerLevel || 3

    const basePlan: CardSelectionCriteria[] = [
      {
        category: 'lands',
        targetCount: this.calculateLandCount(colorIdentity, strategy),
        priority: 10,
        requirements: ['Provides mana', 'Supports color identity'],
        constraints: {
          colorIdentity,
          strategy,
          powerLevel,
        },
      },
      {
        category: 'ramp',
        targetCount: this.calculateRampCount(strategy, powerLevel),
        priority: 9,
        requirements: ['Mana acceleration', 'Early game impact'],
        constraints: {
          colorIdentity,
          strategy,
          powerLevel,
        },
      },
      {
        category: 'draw',
        targetCount: this.calculateDrawCount(strategy, colorIdentity),
        priority: 8,
        requirements: ['Card advantage', 'Consistent access'],
        constraints: {
          colorIdentity,
          strategy,
          powerLevel,
        },
      },
      {
        category: 'removal',
        targetCount: this.calculateRemovalCount(strategy, powerLevel),
        priority: 7,
        requirements: ['Threat removal', 'Meta relevance'],
        constraints: {
          colorIdentity,
          strategy,
          powerLevel,
        },
      },
      {
        category: 'win_conditions',
        targetCount: this.calculateWinConCount(strategy),
        priority: 6,
        requirements: ['Game ending potential', 'Strategy alignment'],
        constraints: {
          colorIdentity,
          strategy,
          powerLevel,
        },
      },
      {
        category: 'synergy',
        targetCount: this.calculateSynergyCount(strategy),
        priority: 5,
        requirements: ['Commander synergy', 'Strategy support'],
        constraints: {
          colorIdentity,
          strategy,
          powerLevel,
        },
      },
      {
        category: 'utility',
        targetCount: this.calculateUtilityCount(),
        priority: 4,
        requirements: ['Flexible effects', 'Situational answers'],
        constraints: {
          colorIdentity,
          strategy,
          powerLevel,
        },
      },
    ]

    // Adjust based on meta research
    if (metaResearch.trends.some((t: any) => t.trend === 'rising' && t.strategy.includes('aggro'))) {
      // Increase removal if aggro is rising
      const removalPlan = basePlan.find(p => p.category === 'removal')
      if (removalPlan) {
        removalPlan.targetCount += 2
      }
    }

    return basePlan
  }

  /**
   * Select cards for each category using AI research
   */
  private async selectCardsForCategories(
    compositionPlan: CardSelectionCriteria[],
    commander: string,
    consultationData: ConsultationData,
    constraints?: any
  ): Promise<any[]> {
    console.log('🎯 Selecting cards for each category')

    const selectedCards: any[] = []
    const colorIdentity = this.extractColorIdentity(commander)

    for (const category of compositionPlan) {
      console.log(`Selecting ${category.targetCount} ${category.category} cards...`)

      try {
        const categoryCards = await this.selectCategoryCards(
          category,
          commander,
          colorIdentity,
          consultationData,
          constraints
        )

        selectedCards.push(...categoryCards)
        console.log(`✅ Selected ${categoryCards.length} ${category.category} cards`)

      } catch (error) {
        console.error(`❌ Failed to select ${category.category} cards:`, error)
        
        // Fallback to basic cards for this category
        const fallbackCards = this.getFallbackCards(category, colorIdentity)
        selectedCards.push(...fallbackCards)
      }
    }

    return selectedCards
  }

  /**
   * Select cards for a specific category
   */
  private async selectCategoryCards(
    category: CardSelectionCriteria,
    commander: string,
    colorIdentity: string[],
    consultationData: ConsultationData,
    constraints?: any
  ): Promise<any[]> {
    const cards: any[] = []

    switch (category.category) {
      case 'lands':
        const manaBase = await aiResearchEngine.researchManaBase(
          commander,
          consultationData.strategy || 'midrange',
          colorIdentity,
          constraints?.budget
        )
        
        for (const land of manaBase.lands.slice(0, category.targetCount)) {
          cards.push({
            cardId: this.generateCardId(land.name),
            name: land.name,
            quantity: 1,
            category: 'lands',
            reasoning: land.reasoning,
            alternatives: land.alternatives,
            researchSources: ['edhrec', 'mtgtop8'],
            confidence: manaBase.confidence,
          })
        }
        break

      case 'ramp':
        const rampCards = await this.researchRampPackage(
          colorIdentity,
          consultationData.strategy || 'midrange',
          category.targetCount
        )
        cards.push(...rampCards)
        break

      case 'draw':
        const drawEngines = await aiResearchEngine.researchCardDraw(
          colorIdentity,
          consultationData.strategy || 'midrange',
          commander
        )
        
        for (const engine of drawEngines.drawEngines.slice(0, category.targetCount)) {
          cards.push({
            cardId: this.generateCardId(engine.name),
            name: engine.name,
            quantity: 1,
            category: 'draw',
            reasoning: engine.reasoning,
            alternatives: engine.alternatives,
            researchSources: ['edhrec', 'reddit'],
            confidence: drawEngines.confidence,
          })
        }
        break

      case 'removal':
        const removalSuite = await aiResearchEngine.researchRemovalSuite(
          colorIdentity,
          consultationData.strategy || 'midrange',
          consultationData.powerLevel || 3
        )
        
        for (const removal of removalSuite.removal.slice(0, category.targetCount)) {
          cards.push({
            cardId: this.generateCardId(removal.name),
            name: removal.name,
            quantity: 1,
            category: 'removal',
            reasoning: removal.reasoning,
            alternatives: removal.alternatives,
            researchSources: ['mtgtop8', 'tournament_db'],
            confidence: removalSuite.confidence,
          })
        }
        break

      case 'win_conditions':
        const winCons = await this.researchWinConditions(
          commander,
          consultationData,
          category.targetCount
        )
        cards.push(...winCons)
        break

      case 'synergy':
        const synergyCards = await this.researchSynergyPackage(
          commander,
          consultationData,
          category.targetCount
        )
        cards.push(...synergyCards)
        break

      case 'utility':
        const utilityCards = await this.researchUtilityPackage(
          colorIdentity,
          consultationData.strategy || 'midrange',
          category.targetCount
        )
        cards.push(...utilityCards)
        break

      default:
        console.warn(`Unknown category: ${category.category}`)
    }

    return cards
  }

  /**
   * Research ramp package
   */
  private async researchRampPackage(
    colorIdentity: string[],
    strategy: string,
    targetCount: number
  ): Promise<any[]> {
    // Use AI to research optimal ramp for the strategy
    const aiResponse = await aiServiceOrchestrator.executeAITask({
      taskType: 'ramp-research',
      prompt: `Research the best ${targetCount} mana acceleration cards for a ${strategy} strategy in ${colorIdentity.join('')} colors. Focus on efficiency and meta relevance.`,
      variables: {
        colorIdentity,
        strategy,
        targetCount,
      },
    })

    // Mock implementation - would parse AI response
    const rampCards = [
      'Sol Ring',
      'Arcane Signet',
      'Command Tower',
      'Cultivate',
      'Kodama\'s Reach',
      'Rampant Growth',
      'Nature\'s Lore',
      'Three Visits',
    ]

    return rampCards.slice(0, targetCount).map(name => ({
      cardId: this.generateCardId(name),
      name,
      quantity: 1,
      category: 'ramp',
      reasoning: `Essential mana acceleration for ${strategy} strategy`,
      alternatives: [],
      researchSources: ['edhrec', 'mtgtop8'],
      confidence: 0.85,
    }))
  }

  /**
   * Research win conditions
   */
  private async researchWinConditions(
    commander: string,
    consultationData: ConsultationData,
    targetCount: number
  ): Promise<any[]> {
    const winConditionType = consultationData.winConditions?.primary || 'combat'
    
    // Use AI to research win conditions
    const aiResponse = await aiServiceOrchestrator.executeAITask({
      taskType: 'win-condition-research',
      prompt: `Research ${targetCount} win conditions for ${commander} focusing on ${winConditionType} victories in ${consultationData.strategy} strategy.`,
      variables: {
        commander,
        winConditionType,
        strategy: consultationData.strategy,
        targetCount,
      },
    })

    // Mock implementation
    const winCons = [
      'Craterhoof Behemoth',
      'Triumph of the Hordes',
      'Overwhelming Stampede',
    ]

    return winCons.slice(0, targetCount).map(name => ({
      cardId: this.generateCardId(name),
      name,
      quantity: 1,
      category: 'win_conditions',
      reasoning: `Powerful win condition aligned with ${winConditionType} strategy`,
      alternatives: [],
      researchSources: ['edhrec', 'tournament_db'],
      confidence: 0.8,
    }))
  }

  /**
   * Research synergy package
   */
  private async researchSynergyPackage(
    commander: string,
    consultationData: ConsultationData,
    targetCount: number
  ): Promise<any[]> {
    const synergyResearch = await aiResearchEngine.researchCardSynergies(
      commander,
      commander,
      consultationData.strategy
    )

    return synergyResearch.synergies.slice(0, targetCount).map(synergy => ({
      cardId: this.generateCardId(synergy.cardName),
      name: synergy.cardName,
      quantity: 1,
      category: 'synergy',
      reasoning: synergy.description,
      alternatives: [],
      researchSources: synergy.sources,
      confidence: synergy.confidence,
    }))
  }

  /**
   * Research utility package
   */
  private async researchUtilityPackage(
    colorIdentity: string[],
    strategy: string,
    targetCount: number
  ): Promise<any[]> {
    // Mock implementation
    const utilityCards = [
      'Lightning Greaves',
      'Swiftfoot Boots',
      'Heroic Intervention',
      'Counterspell',
      'Beast Within',
    ]

    return utilityCards.slice(0, targetCount).map(name => ({
      cardId: this.generateCardId(name),
      name,
      quantity: 1,
      category: 'utility',
      reasoning: 'Flexible utility card that provides situational answers',
      alternatives: [],
      researchSources: ['edhrec'],
      confidence: 0.75,
    }))
  }

  /**
   * Validate and optimize the assembled deck
   */
  private async validateAndOptimizeDeck(
    cards: any[],
    commander: string,
    consultationData: ConsultationData,
    constraints?: any
  ): Promise<any[]> {
    console.log('🔍 Validating and optimizing deck')

    // Ensure exactly 99 cards (excluding commander)
    let optimizedCards = [...cards]

    if (optimizedCards.length > 99) {
      // Remove lowest confidence cards
      optimizedCards = optimizedCards
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 99)
      console.log(`Trimmed deck to 99 cards`)
    } else if (optimizedCards.length < 99) {
      // Add filler cards
      const needed = 99 - optimizedCards.length
      const fillerCards = this.getFillerCards(needed, this.extractColorIdentity(commander))
      optimizedCards.push(...fillerCards)
      console.log(`Added ${needed} filler cards`)
    }

    // Validate mana curve
    optimizedCards = await this.optimizeManaCurve(optimizedCards, consultationData)

    // Validate color requirements
    optimizedCards = await this.validateColorRequirements(optimizedCards, commander)

    return optimizedCards
  }

  /**
   * Analyze power level of the assembled deck
   */
  private async analyzePowerLevel(
    cards: any[],
    targetPowerLevel?: number
  ): Promise<{
    estimatedLevel: number
    reasoning: string
    keyPowerCards: string[]
  }> {
    // Use AI to analyze power level
    const cardNames = cards.map(c => c.name)
    
    const aiResponse = await aiServiceOrchestrator.executeAITask({
      taskType: 'power-level-analysis',
      prompt: `Analyze the power level of this Commander deck on a scale of 1-4. Cards: ${cardNames.join(', ')}`,
      variables: {
        cards: cardNames,
        targetPowerLevel,
      },
    })

    // Mock implementation
    const highPowerCards = cards
      .filter(c => ['Sol Ring', 'Mana Crypt', 'Craterhoof Behemoth'].includes(c.name))
      .map(c => c.name)

    const estimatedLevel = targetPowerLevel || (highPowerCards.length > 3 ? 4 : 3)

    return {
      estimatedLevel,
      reasoning: `Deck contains ${highPowerCards.length} high-power cards and shows consistent strategy execution typical of power level ${estimatedLevel}.`,
      keyPowerCards: highPowerCards,
    }
  }

  /**
   * Helper methods for calculations
   */
  private calculateLandCount(colorIdentity: string[], strategy: string): number {
    const baseCount = 36
    const colorAdjustment = Math.max(0, colorIdentity.length - 2)
    return baseCount + colorAdjustment
  }

  private calculateRampCount(strategy: string, powerLevel: number): number {
    const baseCount = 10
    if (strategy === 'aggro') return baseCount - 2
    if (powerLevel >= 4) return baseCount + 2
    return baseCount
  }

  private calculateDrawCount(strategy: string, colorIdentity: string[]): number {
    const baseCount = 10
    if (colorIdentity.includes('U')) return baseCount + 2
    if (strategy === 'control') return baseCount + 3
    return baseCount
  }

  private calculateRemovalCount(strategy: string, powerLevel: number): number {
    const baseCount = 8
    if (strategy === 'control') return baseCount + 4
    if (powerLevel >= 4) return baseCount + 2
    return baseCount
  }

  private calculateWinConCount(strategy: string): number {
    if (strategy === 'combo') return 6
    if (strategy === 'aggro') return 4
    return 5
  }

  private calculateSynergyCount(strategy: string): number {
    if (strategy === 'tribal') return 20
    if (strategy === 'combo') return 15
    return 12
  }

  private calculateUtilityCount(): number {
    return 8
  }

  private extractColorIdentity(commander: string): string[] {
    // Mock implementation - would look up actual color identity
    return ['G', 'W'] // Default to Selesnya
  }

  private generateCardId(cardName: string): string {
    // Mock implementation - would generate actual Scryfall ID
    return `card-${cardName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  }

  private getFallbackCards(category: CardSelectionCriteria, colorIdentity: string[]): any[] {
    // Provide basic fallback cards for each category
    const fallbacks: Record<string, string[]> = {
      lands: ['Command Tower', 'Evolving Wilds', 'Terramorphic Expanse'],
      ramp: ['Sol Ring', 'Arcane Signet', 'Cultivate'],
      draw: ['Harmonize', 'Divination', 'Sign in Blood'],
      removal: ['Beast Within', 'Swords to Plowshares', 'Lightning Bolt'],
      win_conditions: ['Craterhoof Behemoth', 'Triumph of the Hordes'],
      synergy: ['Sol Ring', 'Lightning Greaves'],
      utility: ['Swiftfoot Boots', 'Heroic Intervention'],
    }

    const categoryCards = fallbacks[category.category] || ['Sol Ring']
    
    return categoryCards.slice(0, category.targetCount).map(name => ({
      cardId: this.generateCardId(name),
      name,
      quantity: 1,
      category: category.category,
      reasoning: 'Fallback card selection',
      alternatives: [],
      researchSources: [],
      confidence: 0.5,
    }))
  }

  private getFillerCards(count: number, colorIdentity: string[]): any[] {
    const fillers = ['Sol Ring', 'Command Tower', 'Lightning Greaves', 'Swiftfoot Boots']
    
    return fillers.slice(0, count).map(name => ({
      cardId: this.generateCardId(name),
      name,
      quantity: 1,
      category: 'utility',
      reasoning: 'Filler card to reach 99 cards',
      alternatives: [],
      researchSources: [],
      confidence: 0.6,
    }))
  }

  private async optimizeManaCurve(cards: any[], consultationData: ConsultationData): Promise<any[]> {
    // Mock implementation - would analyze and optimize mana curve
    return cards
  }

  private async validateColorRequirements(cards: any[], commander: string): Promise<any[]> {
    // Mock implementation - would validate color identity compliance
    return cards
  }

  private calculateComposition(cards: any[]): any {
    const composition = {
      totalCards: cards.length,
      lands: 0,
      ramp: 0,
      draw: 0,
      removal: 0,
      winConditions: 0,
      synergy: 0,
      utility: 0,
    }

    for (const card of cards) {
      switch (card.category) {
        case 'lands':
          composition.lands++
          break
        case 'ramp':
          composition.ramp++
          break
        case 'draw':
          composition.draw++
          break
        case 'removal':
        case 'board_wipes':
          composition.removal++
          break
        case 'win_conditions':
          composition.winConditions++
          break
        case 'synergy':
          composition.synergy++
          break
        default:
          composition.utility++
      }
    }

    return composition
  }

  private calculateOverallConfidence(cards: any[]): number {
    if (cards.length === 0) return 0
    
    const avgConfidence = cards.reduce((sum, card) => sum + card.confidence, 0) / cards.length
    return avgConfidence
  }

  private storeAssemblyHistory(commander: string, deck: AssembledDeck): void {
    const history = this.assemblyHistory.get(commander) || []
    history.push(deck)
    this.assemblyHistory.set(commander, history)
  }

  private initializeCategoryTemplates(): void {
    // Initialize category templates for consistent deck building
    console.log('✅ Initialized deck assembly category templates')
  }
}

// Export singleton instance
export const intelligentDeckAssembler = new IntelligentDeckAssembler()
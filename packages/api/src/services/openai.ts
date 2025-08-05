/**
 * Legacy OpenAI Service
 * 
 * This file maintains backward compatibility while delegating to the new modular AI services.
 * All functionality has been moved to specialized services in the ./ai/ directory.
 * 
 * @deprecated Use the new modular AI services from ./ai/ instead
 */

import { openaiOrchestrator } from './ai'
import type { 
  ConsultationData, 
  GeneratedDeck, 
  GeneratedDeckCard, 
  CardSynergy, 
  StrategyAnalysis,
  ScryfallCard
} from '@moxmuse/shared'

console.log('🔧 Initializing legacy OpenAI service (delegating to new modular architecture)...')

// Legacy interface types for backward compatibility
interface CardRecommendationInput {
  prompt: string
  constraints?: {
    budget?: number
    ownedOnly?: boolean
    powerLevel?: number
    categories?: string[]
  }
  deckContext?: any
  ownedCardIds: Set<string>
}

interface CardRecommendationOutput {
  cardId: string
  reason: string
  confidence: number
}

interface DeckGenerationInput {
  consultationData: ConsultationData
  commander: string
  constraints?: {
    budget?: number
    powerLevel?: number
    useCollection?: boolean
  }
}

/**
 * Legacy OpenAI service that delegates to the new modular architecture
 * 
 * This maintains backward compatibility while using the new specialized services internally.
 * All methods now delegate to the appropriate service in the orchestrator.
 */
export const openaiService = {
  /**
   * Parse natural language vision into structured consultation data
   * @deprecated Use openaiOrchestrator.parseNaturalLanguageVision() instead
   */
  async parseNaturalLanguageVision(input: { 
    visionText: string; 
    userId: string 
  }): Promise<ConsultationData> {
    return openaiOrchestrator.parseNaturalLanguageVision(input)
  },

  /**
   * Get commander suggestions based on user preferences
   * @deprecated Use openaiOrchestrator.getCommanderSuggestions() instead
   */
  async getCommanderSuggestions(input: CardRecommendationInput): Promise<CardRecommendationOutput[]> {
    return openaiOrchestrator.getCommanderSuggestions(input)
  },

  /**
   * Get general card recommendations
   * @deprecated Use openaiOrchestrator.getCardRecommendations() instead
   */
  async getCardRecommendations(input: CardRecommendationInput): Promise<CardRecommendationOutput[]> {
    return openaiOrchestrator.getCardRecommendations(input)
  },

  /**
   * Generate a complete 99-card Commander deck
   * @deprecated Use openaiOrchestrator.generateCompleteDeck() instead
   */
  async generateCompleteDeck(input: DeckGenerationInput): Promise<GeneratedDeckCard[]> {
    return openaiOrchestrator.generateCompleteDeck(input)
  },

  /**
   * Analyze synergies between cards in a deck
   * @deprecated Use openaiOrchestrator.analyzeDeckSynergies() instead
   */
  async analyzeDeckSynergies(cards: ScryfallCard[]): Promise<CardSynergy[]> {
    return openaiOrchestrator.analyzeDeckSynergies(cards)
  },

  /**
   * Suggest comprehensive deck strategy analysis
   * @deprecated Use openaiOrchestrator.suggestDeckStrategy() instead
   */
  async suggestDeckStrategy(deck: GeneratedDeck): Promise<StrategyAnalysis> {
    return openaiOrchestrator.suggestDeckStrategy(deck)
  },

  /**
   * Suggest deck improvements
   * @deprecated Use openaiOrchestrator.suggestDeckImprovements() instead
   */
  async suggestDeckImprovements(input: {
    deck: GeneratedDeck
    focusArea?: string
    ownedCardIds: Set<string>
  }): Promise<CardRecommendationOutput[]> {
    return openaiOrchestrator.suggestDeckImprovements(input)
  },

  // Legacy helper methods that were used internally
  
  /**
   * @deprecated Internal method, use the new modular services instead
   */
  async getSimpleRecommendations(input: CardRecommendationInput): Promise<CardRecommendationOutput[]> {
    return openaiOrchestrator.getCardRecommendations(input)
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  async getFallbackRecommendations(
    prompt: string,
    constraints: any,
    ownedCardIds: Set<string>
  ): Promise<CardRecommendationOutput[]> {
    return openaiOrchestrator.getCardRecommendations({ prompt, constraints, ownedCardIds })
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  async getMockCommanders(
    prompt: string,
    constraints: any,
    ownedCardIds: Set<string>
  ): Promise<CardRecommendationOutput[]> {
    return openaiOrchestrator.getCommanderSuggestions({ prompt, constraints, ownedCardIds })
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  getMockRecommendations(
    prompt: string,
    constraints: any,
    ownedCardIds: Set<string>
  ): CardRecommendationOutput[] {
    // Return empty array for sync method, actual implementation is async in new architecture
    console.warn('getMockRecommendations is deprecated, use async getCardRecommendations instead')
    return []
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  extractSearchQuery(prompt: string): string {
    // Simple extraction logic - in production, use NLP
    const keywords = ['draw', 'ramp', 'removal', 'counterspell', 'tutor', 'board wipe']
    const found = keywords.find(k => prompt.toLowerCase().includes(k))
    return found || 'commander staples'
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  async getMockDeckGeneration(
    consultationData: ConsultationData,
    commander: string,
    constraints?: { budget?: number; powerLevel?: number; useCollection?: boolean }
  ): Promise<GeneratedDeckCard[]> {
    return openaiOrchestrator.generateCompleteDeck({ consultationData, commander, constraints })
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  getMockSynergies(cards: ScryfallCard[]): CardSynergy[] {
    // Return empty array for sync method, actual implementation is async in new architecture
    console.warn('getMockSynergies is deprecated, use async analyzeDeckSynergies instead')
    return []
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  getMockStrategyAnalysis(deck: GeneratedDeck): StrategyAnalysis {
    return {
      strategy: deck.strategy,
      winConditions: deck.winConditions,
      keyInteractions: [
        'Commander synergies with key pieces',
        'Ramp into powerful threats',
        'Card advantage engines'
      ],
      playPattern: 'Establish early ramp, deploy threats, protect key pieces, and execute win conditions',
      mulliganGuide: 'Look for 2-4 lands, ramp spell, and at least one piece of card advantage or strategy enabler'
    }
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  getMockImprovements(deck: GeneratedDeck, focusArea?: string, ownedCardIds?: Set<string>): CardRecommendationOutput[] {
    // Return empty array for sync method, actual implementation is async in new architecture
    console.warn('getMockImprovements is deprecated, use async suggestDeckImprovements instead')
    return []
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  categorizeCard(typeLine: string): string {
    if (typeLine.includes('land')) return 'land'
    if (typeLine.includes('creature')) return 'creature'
    if (typeLine.includes('instant')) return 'removal'
    if (typeLine.includes('sorcery')) {
      if (typeLine.includes('ramp') || typeLine.includes('search')) return 'ramp'
      return 'utility'
    }
    if (typeLine.includes('artifact')) {
      if (typeLine.includes('mana')) return 'ramp'
      return 'utility'
    }
    if (typeLine.includes('enchantment')) return 'utility'
    return 'utility'
  },

  // Additional legacy methods for compatibility
  
  /**
   * @deprecated Internal method, use the new modular services instead
   */
  buildDeckGenerationPrompt(
    consultationData: ConsultationData, 
    commander: string, 
    constraints?: { budget?: number; powerLevel?: number; useCollection?: boolean }
  ): string {
    return openaiOrchestrator.promptManagementService.buildDeckGenerationUserPrompt(
      consultationData, 
      commander, 
      constraints
    )
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  getDeckGenerationSystemPrompt(): string {
    return openaiOrchestrator.promptManagementService.getDeckGenerationPrompt()
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  parseDeckGenerationResponse(content: string): any {
    console.warn('parseDeckGenerationResponse is deprecated, parsing is now handled internally')
    return { cards: [], strategy: {}, winConditions: [] }
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  buildSynergyAnalysisPrompt(cardDetails: any[]): string {
    return openaiOrchestrator.promptManagementService.buildSynergyAnalysisUserPrompt(cardDetails)
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  buildStrategyAnalysisPrompt(deck: GeneratedDeck): string {
    return openaiOrchestrator.promptManagementService.buildStrategyAnalysisUserPrompt(deck)
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  buildImprovementPrompt(deck: GeneratedDeck, focusArea?: string): string {
    return openaiOrchestrator.promptManagementService.buildDeckImprovementsUserPrompt(deck, focusArea)
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  getSynergyAnalysisSystemPrompt(): string {
    return openaiOrchestrator.promptManagementService.getSynergyAnalysisPrompt()
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  getStrategyAnalysisSystemPrompt(): string {
    return openaiOrchestrator.promptManagementService.getStrategyAnalysisPrompt()
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  getImprovementSystemPrompt(): string {
    return openaiOrchestrator.promptManagementService.getDeckImprovementsPrompt()
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  parseSynergyAnalysisResponse(content: string, cards: any[]): CardSynergy[] {
    console.warn('parseSynergyAnalysisResponse is deprecated, parsing is now handled internally')
    return []
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  parseStrategyAnalysisResponse(content: string, deck: GeneratedDeck): StrategyAnalysis {
    console.warn('parseStrategyAnalysisResponse is deprecated, parsing is now handled internally')
    return this.getMockStrategyAnalysis(deck)
  },

  /**
   * @deprecated Internal method, use the new modular services instead
   */
  async parseImprovementResponse(content: string, ownedCardIds: Set<string>): Promise<CardRecommendationOutput[]> {
    console.warn('parseImprovementResponse is deprecated, parsing is now handled internally')
    return []
  }
}

// Export for backward compatibility
export default openaiService

// Also export the new modular services for those who want to use them directly
export { openaiOrchestrator } from './ai'
export type { 
  CardRecommendationInput, 
  CardRecommendationOutput, 
  DeckGenerationInput 
}

import OpenAI from 'openai'
import { DeckGenerationService } from './DeckGenerationService'
import { CardRecommendationService } from './CardRecommendationService'
import { SynergyAnalysisService } from './SynergyAnalysisService'
import { PromptManagementService } from './PromptManagementService'
import type { 
  ConsultationData, 
  GeneratedDeck, 
  GeneratedDeckCard, 
  CardSynergy, 
  StrategyAnalysis,
  ScryfallCard
} from '@moxmuse/shared'

/**
 * OpenAI Orchestrator - Central coordinator for all AI services
 * 
 * This service acts as the main entry point for AI operations,
 * delegating to specialized services while managing the OpenAI client
 * and providing consistent error handling and fallback strategies.
 */
export class OpenAIOrchestrator {
  private openaiClient: OpenAI | null = null
  private deckGenerationService: DeckGenerationService
  private cardRecommendationService: CardRecommendationService
  private synergyAnalysisService: SynergyAnalysisService
  public promptManagementService: PromptManagementService

  constructor() {
    console.log('🔧 Initializing OpenAI Orchestrator...')
    console.log('Environment check:', {
      hasApiKey: !!process.env.OPENAI_API_KEY,
      apiKeyLength: process.env.OPENAI_API_KEY?.length,
      apiKeyPreview: process.env.OPENAI_API_KEY?.substring(0, 20) + '...',
      model: process.env.OPENAI_MODEL,
      nodeEnv: process.env.NODE_ENV
    })

    // Initialize specialized services
    this.deckGenerationService = new DeckGenerationService(this)
    this.cardRecommendationService = new CardRecommendationService(this)
    this.synergyAnalysisService = new SynergyAnalysisService(this)
    this.promptManagementService = new PromptManagementService()
  }

  /**
   * Get OpenAI client instance (lazy initialization)
   */
  getOpenAIClient(): OpenAI {
    if (!this.openaiClient) {
      console.log('🔧 Creating new OpenAI client with key:', process.env.OPENAI_API_KEY?.substring(0, 20) + '...')
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })
    }
    return this.openaiClient
  }

  /**
   * Check if OpenAI API is available and properly configured
   */
  isOpenAIAvailable(): boolean {
    const apiKey = process.env.OPENAI_API_KEY
    return !!(apiKey && apiKey.startsWith('sk-'))
  }

  /**
   * Get the configured OpenAI model
   */
  getModel(): string {
    return process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }

  /**
   * Parse natural language vision into structured consultation data
   */
  async parseNaturalLanguageVision(input: { 
    visionText: string; 
    userId: string 
  }): Promise<ConsultationData> {
    const { visionText } = input
    
    console.log('🎯 Parsing natural language vision:', visionText.substring(0, 100) + '...')
    
    if (!this.isOpenAIAvailable()) {
      console.log('❌ Invalid API key, using mock vision parsing')
      return this.getMockVisionParsing(visionText)
    }

    const systemPrompt = this.promptManagementService.getVisionParsingPrompt()

    try {
      const openai = this.getOpenAIClient()
      const response = await openai.chat.completions.create({
        model: this.getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: visionText }
        ],
        temperature: 0.3,
        max_tokens: 800,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        console.log('❌ No content in OpenAI response')
        return this.getMockVisionParsing(visionText)
      }

      console.log('Vision parsing response:', content)

      try {
        const parsed = JSON.parse(content)
        
        // Convert to ConsultationData format
        const consultationData: ConsultationData = {
          buildingFullDeck: false,
          needsCommanderSuggestions: false,
          useCollection: false,
          commander: parsed.commander || undefined,
          themes: parsed.theme ? [parsed.theme] : undefined,
          budget: parsed.budget ? (typeof parsed.budget === 'string' ? 200 : parsed.budget) : undefined,
          powerLevel: parsed.powerLevel || 3,
          colorPreferences: parsed.colors ? (parsed.colors.length === 1 ? ['mono'] : ['multi']) : undefined,
          specificColors: parsed.colors,
          winConditions: parsed.winCondition ? {
            primary: parsed.winCondition as 'combat' | 'combo' | 'alternative' | 'control'
          } : undefined,
          interaction: parsed.interactionLevel ? {
            level: parsed.interactionLevel as 'low' | 'medium' | 'high',
            types: [],
            timing: 'balanced' as const
          } : undefined,
          petCards: parsed.petCards,
          avoidStrategies: parsed.avoidStrategies,
          complexityLevel: parsed.complexity === 'low' ? 'simple' : parsed.complexity === 'high' ? 'complex' : 'moderate'
        }

        console.log('🎯 Parsed consultation data:', consultationData)
        return consultationData
      } catch (parseError) {
        console.log('Failed to parse vision JSON, using fallback')
        return this.getMockVisionParsing(visionText)
      }
    } catch (error) {
      console.error('Vision parsing error:', error)
      return this.getMockVisionParsing(visionText)
    }
  }

  /**
   * Generate complete deck using specialized deck generation service
   */
  async generateCompleteDeck(input: {
    consultationData: ConsultationData
    commander: string
    constraints?: {
      budget?: number
      powerLevel?: number
      useCollection?: boolean
    }
  }): Promise<GeneratedDeckCard[]> {
    return this.deckGenerationService.generateCompleteDeck(input)
  }

  /**
   * Get commander suggestions using card recommendation service
   */
  async getCommanderSuggestions(input: {
    prompt: string
    constraints?: {
      budget?: number
      ownedOnly?: boolean
      powerLevel?: number
      categories?: string[]
    }
    ownedCardIds: Set<string>
  }) {
    return this.cardRecommendationService.getCommanderSuggestions(input)
  }

  /**
   * Get card recommendations using card recommendation service
   */
  async getCardRecommendations(input: {
    prompt: string
    constraints?: {
      budget?: number
      ownedOnly?: boolean
      powerLevel?: number
      categories?: string[]
    }
    deckContext?: any
    ownedCardIds: Set<string>
  }) {
    return this.cardRecommendationService.getCardRecommendations(input)
  }

  /**
   * Analyze deck synergies using synergy analysis service
   */
  async analyzeDeckSynergies(cards: ScryfallCard[]): Promise<CardSynergy[]> {
    return this.synergyAnalysisService.analyzeDeckSynergies(cards)
  }

  /**
   * Suggest deck strategy using synergy analysis service
   */
  async suggestDeckStrategy(deck: GeneratedDeck): Promise<StrategyAnalysis> {
    return this.synergyAnalysisService.suggestDeckStrategy(deck)
  }

  /**
   * Suggest deck improvements using card recommendation service
   */
  async suggestDeckImprovements(input: {
    deck: GeneratedDeck
    focusArea?: string
    ownedCardIds: Set<string>
  }) {
    return this.cardRecommendationService.suggestDeckImprovements(input)
  }

  /**
   * Mock vision parsing fallback
   */
  private getMockVisionParsing(visionText: string): ConsultationData {
    const text = visionText.toLowerCase()
    
    // Basic keyword detection
    let theme = 'custom'
    if (text.includes('tribal') || text.includes('vampire') || text.includes('dragon')) theme = 'tribal'
    else if (text.includes('control')) theme = 'control' 
    else if (text.includes('aggro') || text.includes('aggressive')) theme = 'aggro'
    else if (text.includes('combo')) theme = 'combo'
    else if (text.includes('ramp') || text.includes('big creatures')) theme = 'ramp'

    let budgetAmount = 200
    if (text.includes('budget') || text.includes('cheap')) budgetAmount = 100
    else if (text.includes('expensive') || text.includes('high')) budgetAmount = 500
    else if (text.match(/\$(\d+)/)) {
      budgetAmount = parseInt(text.match(/\$(\d+)/)![1])
    }

    let powerLevel = 3
    if (text.includes('casual') || text.includes('precon')) powerLevel = 2
    else if (text.includes('competitive') || text.includes('cedh')) powerLevel = 4
    else if (text.includes('high power')) powerLevel = 4

    let winCondition: 'combat' | 'combo' | 'alternative' | 'control' = 'combat'
    if (text.includes('combat') || text.includes('attack')) winCondition = 'combat'
    else if (text.includes('combo') || text.includes('infinite')) winCondition = 'combo'
    else if (text.includes('mill') || text.includes('burn')) winCondition = 'alternative'
    else if (text.includes('control')) winCondition = 'control'

    return {
      buildingFullDeck: false,
      needsCommanderSuggestions: false,
      useCollection: false,
      commander: undefined,
      themes: [theme],
      budget: budgetAmount,
      powerLevel,
      winConditions: {
        primary: winCondition
      },
      interaction: text.includes('control') ? {
        level: 'high' as const,
        types: [],
        timing: 'balanced' as const
      } : {
        level: 'medium' as const,
        types: [],
        timing: 'balanced' as const
      },
      complexityLevel: text.includes('simple') ? 'simple' : 'moderate'
    }
  }
}

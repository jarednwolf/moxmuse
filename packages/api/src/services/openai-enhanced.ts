import { openaiService } from './openai'
import { scryfallBatchService } from './scryfall-batch'
import type { 
  ConsultationData, 
  GeneratedDeckCard
} from '@moxmuse/shared'

interface ProgressUpdate {
  stage: 'initializing' | 'consulting' | 'generating' | 'looking-up' | 'validating' | 'complete' | 'error'
  percent: number
  message: string
  estimatedTimeRemaining?: number
  details?: {
    cardsProcessed?: number
    totalCards?: number
    currentBatch?: number
    totalBatches?: number
  }
}

interface DeckGenerationInput {
  consultationData: ConsultationData
  commander: string
  constraints?: {
    budget?: number
    powerLevel?: number
    useCollection?: boolean
  }
  model?: string
  onProgress?: (update: ProgressUpdate) => void
}

// Model configuration with timeouts
const MODEL_CONFIGS = {
  'gpt-4': {
    timeout: parseInt(process.env.OPENAI_DEFAULT_TIMEOUT || '120000'),
    description: 'Standard GPT-4 model',
    estimatedTime: '30-60 seconds'
  },
  'gpt-4-turbo': {
    timeout: parseInt(process.env.OPENAI_DEFAULT_TIMEOUT || '120000'),
    description: 'Faster GPT-4 variant',
    estimatedTime: '20-45 seconds'
  },
  'o1-preview': {
    timeout: parseInt(process.env.OPENAI_REASONING_TIMEOUT || '300000'),
    description: 'Advanced reasoning model',
    estimatedTime: '2-3 minutes'
  },
  'o1': {
    timeout: parseInt(process.env.OPENAI_REASONING_TIMEOUT || '300000'),
    description: 'Production reasoning model',
    estimatedTime: '3-5 minutes'
  },
  'deep-research': {
    timeout: parseInt(process.env.OPENAI_RESEARCH_TIMEOUT || '900000'),
    description: 'Deep research model (when available)',
    estimatedTime: '10-15 minutes'
  }
} as const

// Add timeout wrapper for OpenAI calls
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  })
  
  return Promise.race([promise, timeoutPromise])
}

export const enhancedOpenAIService = {
  /**
   * Generate a complete deck with optimized card lookups and timeout handling
   */
  async generateCompleteDeckOptimized(input: DeckGenerationInput): Promise<GeneratedDeckCard[]> {
    const { consultationData, commander, constraints, model, onProgress } = input
    
    // Get model configuration
    const selectedModel = model || process.env.DECK_GENERATION_MODEL || 'gpt-4'
    const config = MODEL_CONFIGS[selectedModel as keyof typeof MODEL_CONFIGS] || MODEL_CONFIGS['gpt-4']
    
    console.log(`🚀 Starting optimized deck generation with ${selectedModel}...`)
    const totalStartTime = Date.now()
    
    // Notify about expected time
    if (onProgress) {
      onProgress({
        stage: 'initializing',
        percent: 0,
        message: `Using ${config.description}. Estimated time: ${config.estimatedTime}`,
        estimatedTimeRemaining: config.timeout
      })
    }
    
    try {
      // Step 1: Generate deck list from OpenAI with model-specific timeout
      console.log(`📝 Step 1: Calling OpenAI ${selectedModel} to generate deck list...`)
      const openAIStartTime = Date.now()
      
      if (onProgress) {
        onProgress({
          stage: 'consulting',
          percent: 10,
          message: `Consulting ${selectedModel} for deck recommendations...`,
        })
      }
      
      const deckCards = await withTimeout(
        openaiService.generateCompleteDeck(input),
        config.timeout,
        `${selectedModel} deck generation timed out after ${config.timeout / 1000} seconds`
      )
      
      const openAITime = Date.now() - openAIStartTime
      console.log(`✅ OpenAI responded in ${openAITime}ms with ${deckCards.length} cards`)
      
      // If OpenAI returns mock data, we're done
      if (deckCards.length > 0 && deckCards[0].cardId) {
        return deckCards
      }
      
      // Step 2: Extract card names from the generated deck
      const cardNames = deckCards.map(card => {
        // Extract the card name from various possible fields
        if (typeof card === 'string') return card
        if ((card as any).name) return (card as any).name
        if ((card as any).cardName) return (card as any).cardName
        return ''
      }).filter(name => name && name.length > 0)
      
      console.log(`📋 Extracted ${cardNames.length} card names to lookup`)
      
      // Step 3: Batch lookup cards from Scryfall
      console.log('🔍 Step 2: Batch looking up cards from Scryfall...')
      const lookupStartTime = Date.now()
      
      if (onProgress) {
        onProgress({
          stage: 'looking-up',
          percent: 40,
          message: `Looking up ${cardNames.length} cards from Scryfall...`,
          details: {
            totalCards: cardNames.length,
            cardsProcessed: 0
          }
        })
      }
      
      const cardMap = await withTimeout(
        scryfallBatchService.batchLookupCards(cardNames, {
          batchSize: 15, // Process 15 cards at a time
          maxRetries: 1, // Only retry once to save time
          timeout: 3000  // 3 second timeout per card
        }),
        parseInt(process.env.SCRYFALL_BATCH_TIMEOUT || '120000'), // Use configurable timeout
        'Scryfall batch lookup timed out'
      )
      
      const lookupTime = Date.now() - lookupStartTime
      console.log(`✅ Scryfall lookups completed in ${lookupTime}ms. Found ${cardMap.size}/${cardNames.length} cards`)
      
      // Step 4: Convert to GeneratedDeckCard format
      const finalDeckCards: GeneratedDeckCard[] = []
      const missingCards: string[] = []
      
      for (let i = 0; i < deckCards.length; i++) {
        const originalCard = deckCards[i]
        const cardName = cardNames[i]
        const scryfallCard = cardMap.get(cardName)
        
        if (scryfallCard) {
          finalDeckCards.push({
            cardId: scryfallCard.id,
            quantity: 1,
            category: (originalCard as any).category || 'utility',
            role: (originalCard as any).role || 'support',
            reasoning: (originalCard as any).reasoning || 'Recommended for the strategy',
            alternatives: (originalCard as any).alternatives || [],
            upgradeOptions: (originalCard as any).upgradeOptions || [],
            budgetOptions: (originalCard as any).budgetOptions || []
          })
        } else {
          missingCards.push(cardName)
        }
      }
      
      console.log(`📊 Final deck has ${finalDeckCards.length} valid cards`)
      if (missingCards.length > 0) {
        console.log(`⚠️ Could not find ${missingCards.length} cards:`, missingCards.slice(0, 5))
      }
      
      // Step 5: Fill in missing cards with basic lands if needed
      const landsNeeded = 99 - finalDeckCards.length
      if (landsNeeded > 0) {
        console.log(`🏞️ Adding ${landsNeeded} basic lands to reach 99 cards`)
        
        // Basic land IDs (various printings to avoid duplicates)
        const basicLands = [
          { id: "56b21b47-c8e0-425a-9bb0-ff0b6c0c0bce", name: "Plains" },
          { id: "92daaa39-cd2f-4c03-8f41-92d99d0a3366", name: "Island" },
          { id: "0a469d76-fc13-4e57-933e-52e3f6041444", name: "Swamp" },
          { id: "132ecc65-e8e5-4a76-84ba-39d0e48ebad6", name: "Mountain" },
          { id: "32ebeece-5e81-48f1-be89-b13133bcdb0d", name: "Forest" }
        ]
        
        for (let i = 0; i < landsNeeded; i++) {
          const land = basicLands[i % basicLands.length]
          finalDeckCards.push({
            cardId: land.id,
            quantity: 1,
            category: "land",
            role: "support",
            reasoning: `Basic ${land.name} for mana base`,
            alternatives: [],
            upgradeOptions: [],
            budgetOptions: []
          })
        }
      }
      
      const totalTime = Date.now() - totalStartTime
      console.log(`✅ Deck generation completed in ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`)
      
      return finalDeckCards.slice(0, 99) // Ensure exactly 99 cards
      
    } catch (error) {
      const totalTime = Date.now() - totalStartTime
      console.error(`❌ Deck generation failed after ${totalTime}ms:`, error)
      
      // Return fallback mock deck
      console.log('🎲 Returning mock deck as fallback')
      return openaiService.getMockDeckGeneration(consultationData, commander, constraints)
    }
  },
  
  /**
   * Pre-warm caches before deck generation
   */
  async prewarmForDeckGeneration(): Promise<void> {
    try {
      await scryfallBatchService.prewarmCache()
    } catch (error) {
      console.warn('Failed to prewarm cache:', error)
    }
  }
}

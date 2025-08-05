import { scryfallService } from '../scryfall'
import type { OpenAIOrchestrator } from './OpenAIOrchestrator'
import type { GeneratedDeck } from '@moxmuse/shared'

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

/**
 * Card Recommendation Service
 * 
 * Specialized service for AI-powered card recommendations.
 * Handles commander suggestions, general card recommendations,
 * and deck improvement suggestions with intelligent fallbacks.
 */
export class CardRecommendationService {
  constructor(private orchestrator: OpenAIOrchestrator) {}

  /**
   * Get commander suggestions based on user preferences
   */
  async getCommanderSuggestions(input: CardRecommendationInput): Promise<CardRecommendationOutput[]> {
    const { prompt, constraints, ownedCardIds } = input

    console.log('🔧 Getting commander suggestions...')
    console.log('API Key exists:', this.orchestrator.isOpenAIAvailable())
    
    if (!this.orchestrator.isOpenAIAvailable()) {
      console.log('❌ Invalid API key, using mock commanders')
      return this.getMockCommanders(prompt, constraints, ownedCardIds)
    }

    const systemPrompt = this.orchestrator.promptManagementService.getCommanderSuggestionsPrompt()

    try {
      const openai = this.orchestrator.getOpenAIClient()
      const response = await openai.chat.completions.create({
        model: this.orchestrator.getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        console.log('❌ No content in OpenAI response')
        return this.getMockCommanders(prompt, constraints, ownedCardIds)
      }

      console.log('Commander suggestions response:', content.substring(0, 500) + '...')

      // Parse JSON response
      let commanders = []
      try {
        const parsed = JSON.parse(content)
        commanders = Array.isArray(parsed) ? parsed : parsed.commanders || []
      } catch (parseError: any) {
        console.log('Failed to parse JSON, extracting commander names from text')
        console.log('Raw content to parse:', content)
        
        // Try multiple patterns to extract commander names
        const lines = content.split('\n')
        const patterns = [
          /^\s*[\d\-\*]\s*\.?\s*([A-Z][^:\n,]+?)(?:\s*[-:,]\s*|$)/,  // "1. Commander Name"
          /^\s*-\s*([A-Z][^:\n,]+?)(?:\s*[-:,]\s*|$)/,              // "- Commander Name"
          /([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:\s*,\s*[A-Z][a-z]+)*)/g, // Any capitalized names
          /\*\*([^*]+)\*\*/g,  // **Commander Name**
          /"([^"]+)"/g         // "Commander Name"
        ]
        
        for (const line of lines) {
          for (const pattern of patterns) {
            const matches = line.match(pattern)
            if (matches) {
              const commanderName = matches[1]?.trim()
              if (commanderName && commanderName.length > 3 && commanderName.length < 50 && 
                  !commanderName.includes('$') && !commanderName.includes('http') &&
                  /^[A-Z]/.test(commanderName)) {
                commanders.push({
                  name: commanderName,
                  reason: "Recommended commander for your strategy",
                  price: "5.00"
                })
                console.log('Extracted commander name:', commanderName)
                break // Only take first match per line
              }
            }
          }
          
          // Stop if we have enough commanders
          if (commanders.length >= 5) break
        }
        
        // If still no commanders found, try some fallback well-known commanders
        if (commanders.length === 0) {
          console.log('No commanders extracted, using fallbacks')
          commanders = [
            { name: "Atraxa, Praetors' Voice", reason: "Versatile 4-color commander", price: "25.00" },
            { name: "Edgar Markov", reason: "Aggressive vampire tribal", price: "15.00" },
            { name: "Meren of Clan Nel Toth", reason: "Graveyard value engine", price: "8.00" },
            { name: "Kaalia of the Vast", reason: "Explosive creature cheating", price: "12.00" },
            { name: "Muldrotha, the Gravetide", reason: "Sultai permanents from graveyard", price: "6.00" }
          ]
        }
        
        console.log('Final extracted commanders:', commanders.map((c: any) => c.name))
      }

      // Look up commander cards in Scryfall
      const results: CardRecommendationOutput[] = []
      for (const commander of commanders.slice(0, 5)) {
        try {
          console.log(`Searching for commander: "${commander.name}"`)
          
          // Try multiple search strategies
          const searchQueries = [
            `"${commander.name}" is:commander`,
            `${commander.name} is:commander`,
            `"${commander.name}" type:legendary type:creature`,
            commander.name
          ]
          
          let cards: any[] = []
          for (const query of searchQueries) {
            try {
              cards = await scryfallService.search(query, { maxResults: 1 })
              if (cards.length > 0) {
                console.log(`Found commander with query: ${query}`)
                break
              }
            } catch (searchError) {
              console.log(`Search failed for query: ${query}`)
              continue
            }
          }
          
          if (cards.length > 0) {
            results.push({
              cardId: cards[0].id,
              reason: commander.reason || 'Great commander for your strategy',
              confidence: 0.9
            })
            console.log(`✅ Added commander: ${cards[0].name}`)
          } else {
            console.log(`❌ Could not find commander: ${commander.name}`)
          }
        } catch (error) {
          console.error(`Failed to find commander: ${commander.name}`, error)
        }
      }

      console.log(`🤖 Returning ${results.length} commander suggestions`)
      
      // If no results found, return mock commanders
      if (results.length === 0) {
        console.log('No commanders found, using mock commanders')
        return this.getMockCommanders(prompt, constraints, ownedCardIds)
      }

      return results
    } catch (error) {
      console.error('Commander suggestion error:', error)
      return this.getMockCommanders(prompt, constraints, ownedCardIds)
    }
  }

  /**
   * Get general card recommendations
   */
  async getCardRecommendations(input: CardRecommendationInput): Promise<CardRecommendationOutput[]> {
    const { prompt, constraints, ownedCardIds } = input

    console.log('=== OpenAI API Debug ===')
    console.log('API Key exists:', this.orchestrator.isOpenAIAvailable())
    console.log('Input prompt:', prompt)
    console.log('Input constraints:', JSON.stringify(constraints, null, 2))
    
    if (!this.orchestrator.isOpenAIAvailable()) {
      console.log('❌ Invalid or missing API key, using mock mode')
      return this.getMockRecommendations(prompt, constraints, ownedCardIds)
    }

    console.log('✅ Using real OpenAI API')
    
    try {
      const result = await this.getSimpleRecommendations(input)
      console.log('✅ OpenAI API call successful, returned', result.length, 'recommendations')
      return result
    } catch (error) {
      console.error('❌ OpenAI API call failed:', error)
      console.log('Falling back to mock recommendations')
      return this.getMockRecommendations(prompt, constraints, ownedCardIds)
    }
  }

  /**
   * Get simple card recommendations using OpenAI
   */
  private async getSimpleRecommendations(input: CardRecommendationInput): Promise<CardRecommendationOutput[]> {
    const { prompt, constraints } = input
    
    const systemPrompt = this.orchestrator.promptManagementService.getCardRecommendationsPrompt(constraints)

    try {
      console.log('Using simple recommendation approach')
      console.log('User prompt:', prompt)
      console.log('Constraints:', constraints)
      
      const openai = this.orchestrator.getOpenAIClient()
      const response = await openai.chat.completions.create({
        model: this.orchestrator.getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      })

      const content = response.choices[0]?.message?.content
      if (!content) return []

      console.log('OpenAI response content:', content)

      // Try to parse JSON, but handle cases where it's not valid JSON
      let recommendations = []
      try {
        const parsed = JSON.parse(content)
        recommendations = Array.isArray(parsed) ? parsed : parsed.recommendations || []
        console.log('Successfully parsed JSON recommendations:', recommendations.length)
      } catch (parseError: any) {
        console.log('Failed to parse JSON, trying to extract card names from text response')
        console.log('Parse error:', parseError.message)
        
        // If JSON parsing fails, try to extract card names from the text response
        const lines = content.split('\n')
        const cardNames = []
        for (const line of lines) {
          // Look for patterns like "1. Card Name" or "- Card Name"
          const match = line.match(/^\s*[\d\-\*]\s*\.?\s*([A-Z][^:]+?)(?:\s*[-:]\s*|$)/)
          if (match && match[1]) {
            const cardName = match[1].trim()
            if (cardName.length > 2 && cardName.length < 50) {
              cardNames.push({
                name: cardName,
                reason: `Recommended for your deck strategy`,
                price: "0.00"
              })
            }
          }
        }
        recommendations = cardNames.slice(0, 5)
        console.log('Extracted card names from text:', recommendations.map(r => r.name))
      }
      
      // Look up real card IDs and convert to our format
      const results: CardRecommendationOutput[] = []
      console.log('Processing recommendations:', recommendations.length)
      console.log('Raw recommendations:', JSON.stringify(recommendations, null, 2))
      
      for (const rec of recommendations.slice(0, 5)) {
        try {
          console.log(`Searching for card: "${rec.name}"`)
          // Search for the card by name
          const cards = await scryfallService.search(rec.name, { maxResults: 1 })
          console.log(`Found ${cards.length} cards for "${rec.name}"`)
          if (cards.length > 0) {
            results.push({
              cardId: cards[0].id,
              reason: rec.reason || rec.description || 'Great card for your deck',
              confidence: 0.9
            })
            console.log(`Added card: ${cards[0].name} (${cards[0].id})`)
          }
        } catch (error) {
          console.error(`Failed to find card: ${rec.name}`, error)
        }
      }
      
      console.log(`Returning ${results.length} results`)
      return results
    } catch (error) {
      console.error('Simple recommendation error:', error)
      return []
    }
  }

  /**
   * Suggest deck improvements
   */
  async suggestDeckImprovements(input: {
    deck: GeneratedDeck
    focusArea?: string
    ownedCardIds: Set<string>
  }): Promise<CardRecommendationOutput[]> {
    const { deck, focusArea, ownedCardIds } = input
    
    if (!this.orchestrator.isOpenAIAvailable()) {
      console.log('❌ Invalid API key, using mock improvements')
      return this.getMockImprovements(deck, focusArea, ownedCardIds)
    }

    try {
      const prompt = this.orchestrator.promptManagementService.buildDeckImprovementsUserPrompt(deck, focusArea)
      
      const openai = this.orchestrator.getOpenAIClient()
      const response = await openai.chat.completions.create({
        model: this.orchestrator.getModel(),
        messages: [
          { 
            role: 'system', 
            content: this.orchestrator.promptManagementService.getDeckImprovementsPrompt() 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        return this.getMockImprovements(deck, focusArea, ownedCardIds)
      }

      return this.parseImprovementResponse(content, ownedCardIds)
    } catch (error) {
      console.error('Improvement suggestions error:', error)
      return this.getMockImprovements(deck, focusArea, ownedCardIds)
    }
  }

  /**
   * Parse improvement response from OpenAI
   */
  private async parseImprovementResponse(content: string, ownedCardIds: Set<string>): Promise<CardRecommendationOutput[]> {
    try {
      const parsed = JSON.parse(content)
      const improvements = Array.isArray(parsed) ? parsed : []
      
      const results = await Promise.all(improvements.slice(0, 8).map(async (imp: any) => {
        try {
          const cards = await scryfallService.search(imp.name, { maxResults: 1 })
          if (cards.length > 0) {
            return {
              cardId: cards[0].id,
              reason: imp.reason || 'Improves deck strategy',
              confidence: 0.8
            }
          }
        } catch (error) {
          console.error(`Failed to find improvement card: ${imp.name}`)
        }
        return null
      }))
      
      return results.filter(Boolean) as CardRecommendationOutput[]
    } catch (error) {
      console.log('Failed to parse improvement response, using fallback')
      return []
    }
  }

  /**
   * Mock commander suggestions for fallback
   */
  private async getMockCommanders(
    prompt: string,
    constraints: any,
    ownedCardIds: Set<string>
  ): Promise<CardRecommendationOutput[]> {
    const promptLower = prompt.toLowerCase()
    
    // Popular commanders for different strategies
    const commanderNames = [
      {
        name: "Atraxa, Praetors' Voice",
        reason: "Versatile 4-color commander perfect for +1/+1 counters, superfriends, or infect strategies",
        confidence: 0.95
      },
      {
        name: "Edgar Markov",
        reason: "Aggressive vampire tribal commander that creates value immediately",
        confidence: 0.9
      },
      {
        name: "Meren of Clan Nel Toth",
        reason: "Powerful graveyard value engine in Golgari colors",
        confidence: 0.9
      },
      {
        name: "Kaalia of the Vast",
        reason: "Explosive Mardu commander that cheats powerful creatures into play",
        confidence: 0.85
      },
      {
        name: "Muldrotha, the Gravetide",
        reason: "Sultai value engine that plays permanents from your graveyard",
        confidence: 0.85
      }
    ]
    
    // Look up real card IDs from Scryfall
    const results: CardRecommendationOutput[] = []
    for (const commander of commanderNames.slice(0, 5)) {
      try {
        console.log(`Looking up mock commander: ${commander.name}`)
        
        // Try multiple search strategies
        const searchQueries = [
          `"${commander.name}" is:commander`,
          `${commander.name} is:commander`,
          `"${commander.name}" type:legendary type:creature`,
          commander.name
        ]
        
        let cards: any[] = []
        for (const query of searchQueries) {
          try {
            cards = await scryfallService.search(query, { maxResults: 1 })
            if (cards.length > 0) {
              console.log(`Found mock commander with query: ${query}`)
              break
            }
          } catch (searchError) {
            console.log(`Search failed for query: ${query}`)
            continue
          }
        }
        
        if (cards.length > 0) {
          results.push({
            cardId: cards[0].id,
            reason: commander.reason,
            confidence: commander.confidence
          })
          console.log(`✅ Found mock commander: ${cards[0].name} (${cards[0].id})`)
        } else {
          console.log(`❌ Could not find mock commander: ${commander.name}`)
        }
      } catch (error) {
        console.error(`Failed to find mock commander: ${commander.name}`, error)
      }
    }
    
    // If no results found, try simpler fallback commanders
    if (results.length === 0) {
      console.log('No mock commanders found via search, trying simple fallbacks')
      const fallbackCommanders = [
        { name: "Atraxa", reason: "Popular 4-color commander", confidence: 0.9 },
        { name: "Edgar Markov", reason: "Vampire tribal commander", confidence: 0.9 },
        { name: "Meren", reason: "Graveyard value commander", confidence: 0.9 },
        { name: "Kaalia", reason: "Creature cheating commander", confidence: 0.85 },
        { name: "Muldrotha", reason: "Sultai value commander", confidence: 0.85 }
      ]
      
      for (const commander of fallbackCommanders) {
        try {
          const cards = await scryfallService.search(commander.name, { maxResults: 1 })
          if (cards.length > 0) {
            results.push({
              cardId: cards[0].id,
              reason: commander.reason,
              confidence: commander.confidence
            })
            console.log(`✅ Found fallback commander: ${cards[0].name}`)
            if (results.length >= 5) break
          }
        } catch (error) {
          console.log(`Failed to find fallback commander: ${commander.name}`)
        }
      }
    }
    
    // Final fallback: get random commanders if nothing else worked
    if (results.length === 0) {
      console.log('All searches failed, getting random commanders')
      try {
        for (let i = 0; i < 5; i++) {
          const randomCommander = await scryfallService.getRandomCommander()
          if (randomCommander) {
            results.push({
              cardId: randomCommander.id,
              reason: "Random commander suggestion",
              confidence: 0.7
            })
          }
        }
      } catch (error) {
        console.error('Failed to get random commanders:', error)
      }
    }
    
    console.log(`🤖 Returning ${results.length} mock commander suggestions`)
    return results
  }

  /**
   * Mock card recommendations for fallback
   */
  private getMockRecommendations(
    prompt: string,
    constraints: any,
    ownedCardIds: Set<string>
  ): CardRecommendationOutput[] {
    // Analyze the prompt to determine what kind of cards to recommend
    const promptLower = prompt.toLowerCase()
    const bracket = constraints?.powerLevel || 3
    
    // Define mock card recommendations based on common requests and bracket
    const mockRecommendations: { [key: string]: CardRecommendationOutput[] } = {
      draw: [
        {
          cardId: "0ff81ebc-25a4-4c07-992d-d34efa9a5494", // Rhystic Study
          reason: "One of the best draw engines in Commander. Triggers whenever an opponent casts a spell unless they pay 1.",
          confidence: 0.95
        },
        {
          cardId: "09fd2d9c-1793-4beb-a3fb-7a869f660cd4", // Harmonize
          reason: "Simple and effective green card draw. Three cards for four mana is a good rate.",
          confidence: 0.9
        }
      ],
      default: [
        {
          cardId: "83f43730-1c1f-4150-8771-d901c54bedc4", // Sol Ring
          reason: "An auto-include in virtually every Commander deck. Provides explosive mana acceleration.",
          confidence: 0.98
        },
        {
          cardId: "590c53b0-1d7a-4654-b725-f9fdd4c3c255", // Command Tower
          reason: "Perfect mana fixing for any multicolor commander deck. Enters untapped and produces any color.",
          confidence: 0.93
        }
      ]
    }

    // Determine which category to use based on the prompt
    let category = 'default'
    if (promptLower.includes('draw') || promptLower.includes('card advantage')) {
      category = 'draw'
    }

    let recommendations = mockRecommendations[category] || mockRecommendations['default']

    // Apply constraints
    if (constraints?.ownedOnly) {
      recommendations = recommendations.filter(rec => ownedCardIds.has(rec.cardId))
    }

    // Return top 3-5 recommendations
    return recommendations.slice(0, Math.min(5, recommendations.length))
  }

  /**
   * Mock deck improvements for fallback
   */
  private getMockImprovements(deck: GeneratedDeck, focusArea?: string, ownedCardIds?: Set<string>): CardRecommendationOutput[] {
    const improvements = [
      {
        cardId: "83f43730-1c1f-4150-8771-d901c54bedc4", // Sol Ring
        reason: "Essential mana acceleration for any Commander deck",
        confidence: 0.95
      },
      {
        cardId: "590c53b0-1d7a-4654-b725-f9fdd4c3c255", // Command Tower
        reason: "Perfect mana fixing for multicolor decks",
        confidence: 0.9
      }
    ]

    return focusArea === 'draw' ? [
      {
        cardId: "0ff81ebc-25a4-4c07-992d-d34efa9a5494", // Rhystic Study
        reason: "Excellent card draw engine for multiplayer games",
        confidence: 0.95
      }
    ] : improvements
  }
}
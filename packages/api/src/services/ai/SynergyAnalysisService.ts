import type { OpenAIOrchestrator } from './OpenAIOrchestrator'
import type { 
  GeneratedDeck, 
  CardSynergy, 
  StrategyAnalysis,
  ScryfallCard
} from '@moxmuse/shared'

/**
 * Synergy Analysis Service
 * 
 * Specialized service for analyzing card synergies and deck strategies.
 * Handles complex analysis of card interactions, strategy evaluation,
 * and provides comprehensive deck analysis capabilities.
 */
export class SynergyAnalysisService {
  constructor(private orchestrator: OpenAIOrchestrator) {}

  /**
   * Analyze synergies between cards in a deck
   */
  async analyzeDeckSynergies(cards: ScryfallCard[]): Promise<CardSynergy[]> {
    if (!this.orchestrator.isOpenAIAvailable()) {
      console.log('❌ Invalid API key, using mock synergy analysis')
      return this.getMockSynergies(cards)
    }

    try {
      const cardList = cards.map(card => `${card.name} - ${card.type_line}`).join('\n')
      
      const systemPrompt = this.orchestrator.promptManagementService.getSynergyAnalysisPrompt()
      const userPrompt = `Analyze these cards for synergies:\n\n${cardList}`
      
      const openai = this.orchestrator.getOpenAIClient()
      const response = await openai.chat.completions.create({
        model: this.orchestrator.getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        return this.getMockSynergies(cards)
      }

      try {
        const parsed = JSON.parse(content)
        const synergies: CardSynergy[] = Array.isArray(parsed) ? parsed : []
        
        // Validate and map card names to IDs
        const validSynergies: CardSynergy[] = []
        for (const synergy of synergies) {
          const primaryCard = cards.find(c => c.name === synergy.cardId || c.id === synergy.cardId)
          if (primaryCard) {
            const relatedCards = synergy.relatedCardIds
              .map((id: string) => cards.find(c => c.name === id || c.id === id)?.id)
              .filter((id): id is string => Boolean(id))
            
            if (relatedCards.length > 0) {
              validSynergies.push({
                cardId: primaryCard.id,
                relatedCardIds: relatedCards,
                synergyType: synergy.synergyType || 'support',
                strength: Math.min(10, Math.max(1, synergy.strength || 5)),
                description: synergy.description || 'Cards work well together'
              })
            }
          }
        }
        
        return validSynergies
      } catch (parseError) {
        console.error('Failed to parse synergy analysis:', parseError)
        return this.getMockSynergies(cards)
      }
    } catch (error) {
      console.error('Synergy analysis error:', error)
      return this.getMockSynergies(cards)
    }
  }

  /**
   * Suggest comprehensive deck strategy analysis
   */
  async suggestDeckStrategy(deck: GeneratedDeck): Promise<StrategyAnalysis> {
    if (!this.orchestrator.isOpenAIAvailable()) {
      console.log('❌ Invalid API key, using mock strategy analysis')
      return this.getMockStrategyAnalysis(deck)
    }

    try {
      const userPrompt = this.orchestrator.promptManagementService.buildStrategyAnalysisUserPrompt(deck)
      
      const openai = this.orchestrator.getOpenAIClient()
      const response = await openai.chat.completions.create({
        model: this.orchestrator.getModel(),
        messages: [
          { 
            role: 'system', 
            content: this.orchestrator.promptManagementService.getStrategyAnalysisPrompt() 
          },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 2500,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        return this.getMockStrategyAnalysis(deck)
      }

      try {
        const parsed = JSON.parse(content)
        
        return {
          strategy: {
            name: parsed.strategy?.name || deck.strategy.name,
            description: parsed.strategy?.description || deck.strategy.description,
            archetype: parsed.strategy?.archetype || deck.strategy.archetype,
            themes: parsed.strategy?.themes || deck.strategy.themes,
            gameplan: parsed.strategy?.gameplan || deck.strategy.gameplan,
            strengths: parsed.strategy?.strengths || deck.strategy.strengths,
            weaknesses: parsed.strategy?.weaknesses || deck.strategy.weaknesses
          },
          winConditions: parsed.winConditions || deck.winConditions,
          keyInteractions: parsed.keyInteractions || [],
          playPattern: parsed.playPattern || 'Execute strategy and adapt to opponents',
          mulliganGuide: parsed.mulliganGuide || 'Look for ramp, card draw, and key strategy pieces',
          sideboarding: parsed.sideboarding
        }
      } catch (parseError) {
        console.error('Failed to parse strategy analysis:', parseError)
        return this.getMockStrategyAnalysis(deck)
      }
    } catch (error) {
      console.error('Strategy analysis error:', error)
      return this.getMockStrategyAnalysis(deck)
    }
  }

  /**
   * Analyze card synergies with detailed breakdown
   */
  async analyzeCardSynergies(cardDetails: any[]): Promise<CardSynergy[]> {
    if (!this.orchestrator.isOpenAIAvailable()) {
      console.log('❌ Invalid API key, using mock synergy analysis')
      return this.getMockSynergies(cardDetails.map(cd => cd.cardData).filter(Boolean))
    }

    try {
      const userPrompt = this.orchestrator.promptManagementService.buildSynergyAnalysisUserPrompt(cardDetails)
      
      const openai = this.orchestrator.getOpenAIClient()
      const response = await openai.chat.completions.create({
        model: this.orchestrator.getModel(),
        messages: [
          { 
            role: 'system', 
            content: this.orchestrator.promptManagementService.getSynergyAnalysisPrompt() 
          },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        return this.getMockSynergies(cardDetails.map(cd => cd.cardData).filter(Boolean))
      }

      return this.parseSynergyAnalysisResponse(content, cardDetails)
    } catch (error) {
      console.error('Card synergy analysis error:', error)
      return this.getMockSynergies(cardDetails.map(cd => cd.cardData).filter(Boolean))
    }
  }

  /**
   * Parse synergy analysis response from OpenAI
   */
  private parseSynergyAnalysisResponse(content: string, cards: any[]): CardSynergy[] {
    try {
      const parsed = JSON.parse(content)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.log('Failed to parse synergy analysis, using fallback')
      return this.getMockSynergies(cards.map(c => c.cardData).filter(Boolean))
    }
  }

  /**
   * Generate mock synergies for fallback scenarios
   */
  private getMockSynergies(cards: ScryfallCard[]): CardSynergy[] {
    // Return some basic synergies based on card types and common interactions
    const synergies: CardSynergy[] = []
    
    // Find some basic synergies
    const creatures = cards.filter(c => c.type_line.includes('Creature'))
    const artifacts = cards.filter(c => c.type_line.includes('Artifact'))
    const enchantments = cards.filter(c => c.type_line.includes('Enchantment'))
    
    if (creatures.length >= 2) {
      synergies.push({
        cardId: creatures[0].id,
        relatedCardIds: [creatures[1].id],
        synergyType: 'support',
        strength: 6,
        description: 'Creatures that work well together in combat'
      })
    }
    
    if (artifacts.length >= 2) {
      synergies.push({
        cardId: artifacts[0].id,
        relatedCardIds: [artifacts[1].id],
        synergyType: 'engine',
        strength: 7,
        description: 'Artifacts that create value engines'
      })
    }

    // Look for common synergy patterns
    const solRing = cards.find(c => c.name.toLowerCase().includes('sol ring'))
    const commandTower = cards.find(c => c.name.toLowerCase().includes('command tower'))
    
    if (solRing && commandTower) {
      synergies.push({
        cardId: solRing.id,
        relatedCardIds: [commandTower.id],
        synergyType: 'support',
        strength: 8,
        description: 'Essential mana base synergy for consistent early game'
      })
    }

    // Look for draw engines
    const rhysticStudy = cards.find(c => c.name.toLowerCase().includes('rhystic study'))
    const mysticRemora = cards.find(c => c.name.toLowerCase().includes('mystic remora'))
    
    if (rhysticStudy && mysticRemora) {
      synergies.push({
        cardId: rhysticStudy.id,
        relatedCardIds: [mysticRemora.id],
        synergyType: 'engine',
        strength: 9,
        description: 'Powerful card draw engines that tax opponents'
      })
    }

    // Look for protection synergies
    const lightningGreaves = cards.find(c => c.name.toLowerCase().includes('lightning greaves'))
    const swiftfootBoots = cards.find(c => c.name.toLowerCase().includes('swiftfoot boots'))
    
    if (lightningGreaves && swiftfootBoots) {
      synergies.push({
        cardId: lightningGreaves.id,
        relatedCardIds: [swiftfootBoots.id],
        synergyType: 'protection',
        strength: 7,
        description: 'Redundant protection for key creatures'
      })
    }
    
    return synergies.slice(0, 8) // Return up to 8 synergies
  }

  /**
   * Generate mock strategy analysis for fallback scenarios
   */
  private getMockStrategyAnalysis(deck: GeneratedDeck): StrategyAnalysis {
    return {
      strategy: deck.strategy,
      winConditions: deck.winConditions,
      keyInteractions: [
        'Commander synergies with key pieces',
        'Ramp into powerful threats',
        'Card advantage engines',
        'Protection for key permanents',
        'Removal for opposing threats'
      ],
      playPattern: 'Establish early ramp and card draw, deploy key threats while protecting them, and execute win conditions through combat damage or alternative strategies',
      mulliganGuide: 'Look for 2-4 lands, at least one ramp spell, and either card draw or a key strategy enabler. Avoid hands with only expensive spells or no mana development.',
      sideboarding: [
        'Add more removal against aggressive decks',
        'Include graveyard hate against recursion strategies',
        'Consider counterspells against combo decks',
        'Add artifact/enchantment removal as needed',
        'Include additional protection against control'
      ]
    }
  }

  /**
   * Analyze deck composition and balance
   */
  analyzeDeckComposition(cards: any[]): {
    landCount: number
    rampCount: number
    drawCount: number
    removalCount: number
    creatureCount: number
    averageCMC: number
    colorDistribution: Record<string, number>
    recommendations: string[]
  } {
    const composition = {
      landCount: 0,
      rampCount: 0,
      drawCount: 0,
      removalCount: 0,
      creatureCount: 0,
      averageCMC: 0,
      colorDistribution: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      recommendations: [] as string[]
    }

    let totalCMC = 0
    let nonLandCards = 0

    for (const card of cards) {
      const cardData = card.cardData || card
      if (!cardData) continue

      // Count by category
      if (card.category === 'land' || cardData.type_line?.includes('Land')) {
        composition.landCount++
      } else if (card.category === 'ramp') {
        composition.rampCount++
        nonLandCards++
      } else if (card.category === 'draw') {
        composition.drawCount++
        nonLandCards++
      } else if (card.category === 'removal') {
        composition.removalCount++
        nonLandCards++
      } else if (cardData.type_line?.includes('Creature')) {
        composition.creatureCount++
        nonLandCards++
      } else {
        nonLandCards++
      }

      // Calculate CMC
      if (cardData.cmc !== undefined && card.category !== 'land') {
        totalCMC += cardData.cmc
      }

      // Count colors
      if (cardData.color_identity) {
        for (const color of cardData.color_identity) {
          if (color in composition.colorDistribution) {
            composition.colorDistribution[color as keyof typeof composition.colorDistribution]++
          }
        }
      }
    }

    // Calculate average CMC
    composition.averageCMC = nonLandCards > 0 ? totalCMC / nonLandCards : 0

    // Generate recommendations
    if (composition.landCount < 35) {
      composition.recommendations.push(`Add ${35 - composition.landCount} more lands (currently ${composition.landCount})`)
    }
    if (composition.landCount > 40) {
      composition.recommendations.push(`Consider reducing lands by ${composition.landCount - 38} (currently ${composition.landCount})`)
    }
    if (composition.rampCount < 8) {
      composition.recommendations.push(`Add ${8 - composition.rampCount} more ramp sources (currently ${composition.rampCount})`)
    }
    if (composition.drawCount < 8) {
      composition.recommendations.push(`Add ${8 - composition.drawCount} more card draw sources (currently ${composition.drawCount})`)
    }
    if (composition.removalCount < 5) {
      composition.recommendations.push(`Add ${5 - composition.removalCount} more removal spells (currently ${composition.removalCount})`)
    }
    if (composition.averageCMC > 4) {
      composition.recommendations.push(`Consider lowering average CMC (currently ${composition.averageCMC.toFixed(2)})`)
    }
    if (composition.averageCMC < 2.5) {
      composition.recommendations.push(`Consider adding some higher impact cards (average CMC: ${composition.averageCMC.toFixed(2)})`)
    }

    return composition
  }

  /**
   * Identify potential combo pieces in the deck
   */
  identifyComboLines(cards: ScryfallCard[]): {
    combos: Array<{
      name: string
      pieces: string[]
      description: string
      difficulty: 'easy' | 'medium' | 'hard'
    }>
    enablers: string[]
    tutors: string[]
  } {
    const combos: Array<{
      name: string
      pieces: string[]
      description: string
      difficulty: 'easy' | 'medium' | 'hard'
    }> = []
    
    const enablers: string[] = []
    const tutors: string[] = []

    // Look for common combo pieces
    const cardNames = cards.map(c => c.name.toLowerCase())
    
    // Infinite mana combos
    if (cardNames.includes('basalt monolith') && cardNames.includes('rings of brighthearth')) {
      combos.push({
        name: 'Basalt Monolith + Rings of Brighthearth',
        pieces: ['Basalt Monolith', 'Rings of Brighthearth'],
        description: 'Generate infinite colorless mana',
        difficulty: 'medium'
      })
    }

    // Infinite creature combos
    if (cardNames.includes('mikaeus, the unhallowed') && cardNames.some(name => name.includes('triskelion'))) {
      combos.push({
        name: 'Mikaeus + Triskelion',
        pieces: ['Mikaeus, the Unhallowed', 'Triskelion'],
        description: 'Deal infinite damage to any target',
        difficulty: 'medium'
      })
    }

    // Look for tutors
    const tutorKeywords = ['tutor', 'search', 'demonic', 'vampiric', 'enlightened', 'mystical']
    for (const card of cards) {
      const name = card.name.toLowerCase()
      const text = card.oracle_text?.toLowerCase() || ''
      
      if (tutorKeywords.some(keyword => name.includes(keyword) || text.includes('search your library'))) {
        tutors.push(card.name)
      }
    }

    // Look for enablers (cards that help execute combos)
    const enablerKeywords = ['flash', 'haste', 'protection', 'hexproof', 'indestructible']
    for (const card of cards) {
      const text = card.oracle_text?.toLowerCase() || ''
      
      if (enablerKeywords.some(keyword => text.includes(keyword))) {
        enablers.push(card.name)
      }
    }

    return {
      combos: combos.slice(0, 5), // Limit to 5 combos
      enablers: enablers.slice(0, 8), // Limit to 8 enablers
      tutors: tutors.slice(0, 6) // Limit to 6 tutors
    }
  }
}
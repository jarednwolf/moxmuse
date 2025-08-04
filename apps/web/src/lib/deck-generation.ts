import { 
  GeneratedDeck, 
  GeneratedDeckCard, 
  ConsultationData, 
  DeckStatistics,
  ManaCurveData,
  ColorDistribution,
  TypeDistribution,
  RarityDistribution,
  CardSynergy,
  DeckStrategy,
  WinCondition,
  DeckCategory
} from '@moxmuse/shared'
import { scryfallService } from '@moxmuse/api/src/services/scryfall'

/**
 * Assembles a complete deck from AI-generated card recommendations
 */
export async function assembleDeck(
  deckCards: GeneratedDeckCard[],
  consultationData: ConsultationData,
  commander: string
): Promise<GeneratedDeck> {
  // Generate unique deck ID
  const deckId = `generated-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  
  // Create deck name based on commander and strategy
  const deckName = generateDeckName(commander, consultationData)
  
  // Create strategy object
  const strategy = createDeckStrategy(consultationData, commander)
  
  // Create win conditions
  const winConditions = createWinConditions(consultationData)
  
  // Create categories
  const categories = createDeckCategories(deckCards)
  
  // Create initial Commander deck structure (always 100 cards including commander)
  const deck: GeneratedDeck = {
    id: deckId,
    name: deckName,
    commander,
    format: 'commander', // Always Commander format
    strategy,
    winConditions,
    powerLevel: consultationData.powerLevel || 3,
    estimatedBudget: consultationData.budget || 0,
    cards: deckCards,
    categories,
    statistics: createEmptyStatistics(),
    synergies: [],
    weaknesses: [],
    generatedAt: new Date(),
    consultationData
  }
  
  return deck
}

/**
 * Enhances a deck with detailed analysis, statistics, and synergies
 */
export async function enhanceDeckWithAnalysis(deck: GeneratedDeck): Promise<GeneratedDeck> {
  try {
    // Get card details from Scryfall for all cards in the deck
    const cardIds = deck.cards.map(card => card.cardId)
    const cardDetails = await Promise.all(
      cardIds.map(async (cardId) => {
        try {
          return await scryfallService.getCard(cardId)
        } catch (error) {
          console.warn(`Failed to fetch card details for ${cardId}:`, error)
          return null
        }
      })
    )
    
    // Filter out null results
    const validCardDetails = cardDetails.filter(card => card !== null)
    
    // Calculate statistics
    const statistics = calculateDeckStatistics(deck.cards, validCardDetails)
    
    // Analyze synergies
    const synergies = analyzeDeckSynergies(deck.cards, validCardDetails, deck.strategy)
    
    // Identify weaknesses
    const weaknesses = identifyDeckWeaknesses(statistics, deck.strategy, deck.consultationData)
    
    return {
      ...deck,
      statistics,
      synergies,
      weaknesses
    }
  } catch (error) {
    console.error('Error enhancing deck with analysis:', error)
    // Return deck with basic statistics if analysis fails
    return {
      ...deck,
      statistics: createEmptyStatistics(),
      synergies: [],
      weaknesses: ['Unable to perform detailed analysis']
    }
  }
}

/**
 * Generates a deck name based on commander and strategy
 */
function generateDeckName(commander: string, consultationData: ConsultationData): string {
  const strategy = consultationData.strategy
  const themes = consultationData.themes
  
  if (themes && themes.length > 0) {
    return `${commander} - ${themes[0]}`
  }
  
  if (strategy) {
    const strategyNames = {
      aggro: 'Aggro',
      control: 'Control',
      combo: 'Combo',
      midrange: 'Midrange',
      tribal: 'Tribal',
      value: 'Value Engine',
      stax: 'Stax'
    }
    return `${commander} - ${strategyNames[strategy] || strategy}`
  }
  
  return `${commander} - Commander Deck`
}

/**
 * Creates a deck strategy object from consultation data
 */
function createDeckStrategy(consultationData: ConsultationData, commander: string): DeckStrategy {
  const strategy = consultationData.strategy || 'midrange'
  const themes = consultationData.themes || []
  
  const strategyDescriptions = {
    aggro: 'An aggressive strategy focused on dealing damage quickly and efficiently.',
    control: 'A controlling strategy that manages the game through removal and card advantage.',
    combo: 'A combo-focused strategy that seeks to win through powerful card interactions.',
    midrange: 'A balanced strategy that adapts to the game state with versatile threats.',
    tribal: 'A tribal strategy built around creature synergies and type-based effects.',
    value: 'A value-oriented strategy that generates card advantage and incremental benefits.',
    stax: 'A resource denial strategy that limits opponents while building advantage.'
  }
  
  const gameplanDescriptions = {
    aggro: 'Deploy threats early and pressure opponents before they can stabilize.',
    control: 'Control the early game, then deploy powerful late-game threats.',
    combo: 'Assemble combo pieces while protecting them from disruption.',
    midrange: 'Play efficient threats and answers while adapting to opponents.',
    tribal: 'Build a critical mass of synergistic creatures to overwhelm opponents.',
    value: 'Generate incremental advantages that compound over time.',
    stax: 'Lock down opponents\' resources while building your own advantage.'
  }
  
  return {
    name: `${commander} ${strategy.charAt(0).toUpperCase() + strategy.slice(1)}`,
    description: strategyDescriptions[strategy] || 'A focused Commander strategy.',
    archetype: strategy,
    themes,
    gameplan: gameplanDescriptions[strategy] || 'Execute the strategy effectively.',
    strengths: getStrategyStrengths(strategy, themes),
    weaknesses: getStrategyWeaknesses(strategy)
  }
}

/**
 * Creates win conditions based on consultation data
 */
function createWinConditions(consultationData: ConsultationData): WinCondition[] {
  const winConditions: WinCondition[] = []
  
  if (consultationData.winConditions) {
    const primary = consultationData.winConditions.primary
    
    const winConditionData = {
      combat: {
        description: 'Win through combat damage with efficient creatures and combat tricks.',
        keyCards: ['Combat enhancers', 'Efficient creatures', 'Protection spells'],
        probability: 0.7
      },
      combo: {
        description: 'Win through powerful card combinations and synergies.',
        keyCards: ['Combo pieces', 'Tutors', 'Protection'],
        probability: 0.6
      },
      alternative: {
        description: 'Win through alternative win conditions and unique effects.',
        keyCards: ['Alternative win cards', 'Support pieces', 'Protection'],
        probability: 0.5
      },
      control: {
        description: 'Win by controlling the game and deploying inevitable threats.',
        keyCards: ['Win conditions', 'Control pieces', 'Card advantage'],
        probability: 0.8
      }
    }
    
    const primaryData = winConditionData[primary]
    if (primaryData) {
      winConditions.push({
        type: primary,
        description: primaryData.description,
        keyCards: primaryData.keyCards,
        probability: primaryData.probability
      })
    }
  }
  
  // Add default combat win condition if none specified
  if (winConditions.length === 0) {
    winConditions.push({
      type: 'combat',
      description: 'Win through combat damage with efficient creatures.',
      keyCards: ['Creatures', 'Combat tricks', 'Protection'],
      probability: 0.7
    })
  }
  
  return winConditions
}

/**
 * Creates deck categories from card list
 */
function createDeckCategories(deckCards: GeneratedDeckCard[]): DeckCategory[] {
  const categoryMap = new Map<string, GeneratedDeckCard[]>()
  
  // Group cards by category
  deckCards.forEach(card => {
    const category = card.category
    if (!categoryMap.has(category)) {
      categoryMap.set(category, [])
    }
    categoryMap.get(category)!.push(card)
  })
  
  // Create category objects
  const categories: DeckCategory[] = []
  
  categoryMap.forEach((cards, categoryName) => {
    const description = getCategoryDescription(categoryName)
    const targetCount = getCategoryTargetCount(categoryName)
    
    categories.push({
      name: categoryName,
      description,
      targetCount,
      actualCount: cards.length,
      cards: cards.map(card => card.cardId)
    })
  })
  
  return categories
}

/**
 * Calculates comprehensive deck statistics
 */
function calculateDeckStatistics(
  deckCards: GeneratedDeckCard[],
  cardDetails: any[]
): DeckStatistics {
  const manaCurve = calculateManaCurve(cardDetails)
  const colorDistribution = calculateColorDistribution(cardDetails)
  const typeDistribution = calculateTypeDistribution(cardDetails)
  const rarityDistribution = calculateRarityDistribution(cardDetails)
  
  const totalValue = cardDetails.reduce((sum, card) => {
    const price = parseFloat(card?.prices?.usd || '0')
    return sum + price
  }, 0)
  
  const landCount = cardDetails.filter(card => 
    card?.type_line?.toLowerCase().includes('land')
  ).length
  
  const nonlandCount = cardDetails.length - landCount
  
  const averageCMC = cardDetails.reduce((sum, card) => sum + (card?.cmc || 0), 0) / cardDetails.length
  
  return {
    manaCurve,
    colorDistribution,
    typeDistribution,
    rarityDistribution,
    averageCMC: Math.round(averageCMC * 100) / 100,
    totalValue: Math.round(totalValue * 100) / 100,
    landCount,
    nonlandCount
  }
}

/**
 * Calculates mana curve distribution
 */
function calculateManaCurve(cardDetails: any[]): ManaCurveData {
  const distribution = [0, 0, 0, 0, 0, 0, 0, 0] // 0-7+ mana costs
  let totalCMC = 0
  let nonLandCards = 0
  let landCount = 0
  
  cardDetails.forEach(card => {
    if (!card) return
    
    const isLand = card.type_line?.toLowerCase().includes('land')
    if (isLand) {
      landCount++
      return
    }
    
    const cmc = card.cmc || 0
    const index = Math.min(cmc, 7)
    distribution[index]++
    totalCMC += cmc
    nonLandCards++
  })
  
  const averageCMC = nonLandCards > 0 ? totalCMC / nonLandCards : 0
  const peakCMC = distribution.indexOf(Math.max(...distribution))
  const landRatio = cardDetails.length > 0 ? landCount / cardDetails.length : 0
  
  return {
    distribution,
    peakCMC,
    averageCMC: Math.round(averageCMC * 100) / 100,
    landRatio: Math.round(landRatio * 100) / 100
  }
}

/**
 * Calculates color distribution
 */
function calculateColorDistribution(cardDetails: any[]): ColorDistribution {
  const colors = { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0, multicolor: 0 }
  const devotion: Record<string, number> = {}
  
  cardDetails.forEach(card => {
    if (!card?.color_identity) return
    
    const colorIdentity = card.color_identity
    
    if (colorIdentity.length === 0) {
      colors.colorless++
    } else if (colorIdentity.length > 1) {
      colors.multicolor++
    } else {
      const color = colorIdentity[0]
      switch (color) {
        case 'W': colors.white++; break
        case 'U': colors.blue++; break
        case 'B': colors.black++; break
        case 'R': colors.red++; break
        case 'G': colors.green++; break
      }
    }
    
    // Calculate devotion
    colorIdentity.forEach((color: string) => {
      devotion[color] = (devotion[color] || 0) + 1
    })
  })
  
  return { ...colors, devotion }
}

/**
 * Calculates type distribution
 */
function calculateTypeDistribution(cardDetails: any[]): TypeDistribution {
  const types = {
    creature: 0,
    instant: 0,
    sorcery: 0,
    artifact: 0,
    enchantment: 0,
    planeswalker: 0,
    land: 0,
    other: 0
  }
  
  cardDetails.forEach(card => {
    if (!card?.type_line) return
    
    const typeLine = card.type_line.toLowerCase()
    
    if (typeLine.includes('creature')) types.creature++
    else if (typeLine.includes('instant')) types.instant++
    else if (typeLine.includes('sorcery')) types.sorcery++
    else if (typeLine.includes('artifact')) types.artifact++
    else if (typeLine.includes('enchantment')) types.enchantment++
    else if (typeLine.includes('planeswalker')) types.planeswalker++
    else if (typeLine.includes('land')) types.land++
    else types.other++
  })
  
  return types
}

/**
 * Calculates rarity distribution
 */
function calculateRarityDistribution(cardDetails: any[]): RarityDistribution {
  const rarities = { common: 0, uncommon: 0, rare: 0, mythic: 0 }
  
  cardDetails.forEach(card => {
    if (!card?.rarity) return
    
    const rarity = card.rarity.toLowerCase()
    if (rarity in rarities) {
      rarities[rarity as keyof RarityDistribution]++
    }
  })
  
  return rarities
}

/**
 * Analyzes deck synergies
 */
function analyzeDeckSynergies(
  deckCards: GeneratedDeckCard[],
  cardDetails: any[],
  strategy: DeckStrategy
): CardSynergy[] {
  const synergies: CardSynergy[] = []
  
  // This is a simplified synergy analysis
  // In a full implementation, this would use AI or more sophisticated analysis
  
  // Group cards by category to find potential synergies
  const categoryGroups = new Map<string, GeneratedDeckCard[]>()
  deckCards.forEach(card => {
    const category = card.category
    if (!categoryGroups.has(category)) {
      categoryGroups.set(category, [])
    }
    categoryGroups.get(category)!.push(card)
  })
  
  // Create basic synergies based on categories
  categoryGroups.forEach((cards, category) => {
    if (cards.length > 1) {
      cards.forEach(card => {
        const relatedCards = cards
          .filter(c => c.cardId !== card.cardId)
          .map(c => c.cardId)
          .slice(0, 3) // Limit to 3 related cards
        
        if (relatedCards.length > 0) {
          synergies.push({
            cardId: card.cardId,
            relatedCardIds: relatedCards,
            synergyType: getSynergyType(category),
            strength: 7, // Default strength
            description: `Works well with other ${category} cards in the deck.`
          })
        }
      })
    }
  })
  
  return synergies.slice(0, 20) // Limit to top 20 synergies
}

/**
 * Identifies potential Commander deck weaknesses
 */
function identifyDeckWeaknesses(
  statistics: DeckStatistics,
  strategy: DeckStrategy,
  consultationData: ConsultationData
): string[] {
  const weaknesses: string[] = []
  
  // Commander-specific mana curve analysis
  if (statistics.averageCMC > 4.5) {
    weaknesses.push('High average mana cost may lead to slow starts in multiplayer games')
  }
  
  // Commander-specific land count (35-38 is typical)
  if (statistics.landCount < 32) {
    weaknesses.push('Low land count may cause mana issues in Commander')
  } else if (statistics.landCount > 40) {
    weaknesses.push('High land count may reduce spell density')
  }
  
  // Check color distribution for multicolor Commander decks
  const colorValues = Object.values(statistics.colorDistribution)
  const colorCount = colorValues.filter(count => typeof count === 'number' && count > 0).length
  if (colorCount > 3 && statistics.landCount < 36) {
    weaknesses.push('Multicolor Commander deck may need more lands for color fixing')
  }
  
  // Commander-specific strategy weaknesses
  if (strategy.archetype === 'aggro' && statistics.averageCMC > 3.5) {
    weaknesses.push('Aggro strategy may be too slow for multiplayer Commander games')
  }
  
  if (strategy.archetype === 'control' && statistics.typeDistribution.instant + statistics.typeDistribution.sorcery < 15) {
    weaknesses.push('Control deck may need more instant and sorcery spells for multiplayer interaction')
  }
  
  // Commander-specific deck composition checks
  if (statistics.typeDistribution.creature < 15) {
    weaknesses.push('Low creature count may make it difficult to pressure opponents')
  }
  
  // Check for sufficient ramp in Commander
  const rampCards = consultationData.strategy === 'aggro' ? 8 : 10
  if (statistics.typeDistribution.artifact + statistics.typeDistribution.sorcery < rampCards) {
    weaknesses.push('May need more mana ramp for Commander format')
  }
  
  return weaknesses
}

// Helper functions

function createEmptyStatistics(): DeckStatistics {
  return {
    manaCurve: {
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
      peakCMC: 0,
      averageCMC: 0,
      landRatio: 0
    },
    colorDistribution: {
      white: 0,
      blue: 0,
      black: 0,
      red: 0,
      green: 0,
      colorless: 0,
      multicolor: 0,
      devotion: {}
    },
    typeDistribution: {
      creature: 0,
      instant: 0,
      sorcery: 0,
      artifact: 0,
      enchantment: 0,
      planeswalker: 0,
      land: 0,
      other: 0
    },
    rarityDistribution: {
      common: 0,
      uncommon: 0,
      rare: 0,
      mythic: 0
    },
    averageCMC: 0,
    totalValue: 0,
    landCount: 0,
    nonlandCount: 0
  }
}

function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    ramp: 'Mana acceleration and fixing',
    draw: 'Card draw and card advantage',
    removal: 'Targeted removal and interaction',
    'win-con': 'Primary win conditions',
    utility: 'Utility and support cards',
    protection: 'Protection and counterspells',
    land: 'Lands and mana base',
    creature: 'Creatures and threats',
    artifact: 'Artifacts and equipment',
    enchantment: 'Enchantments and auras'
  }
  
  return descriptions[category] || 'Miscellaneous cards'
}

function getCategoryTargetCount(category: string): number {
  // Commander-specific target counts for 100-card decks
  const targets: Record<string, number> = {
    ramp: 10,        // Mana acceleration for Commander
    draw: 8,         // Card draw engines
    removal: 8,      // Targeted removal and interaction
    'win-con': 5,    // Primary win conditions
    utility: 10,     // Utility and support cards
    protection: 5,   // Protection and counterspells
    land: 36,        // Lands for Commander (35-38 typical)
    creature: 20,    // Creatures and threats
    artifact: 8,     // Artifacts and equipment
    enchantment: 6   // Enchantments and auras
  }
  
  return targets[category] || 5
}

function getStrategyStrengths(strategy: string, themes: string[]): string[] {
  const strengths: Record<string, string[]> = {
    aggro: ['Fast clock', 'Pressure opponents', 'Efficient threats'],
    control: ['Card advantage', 'Flexible answers', 'Late game power'],
    combo: ['Explosive turns', 'Consistent win conditions', 'Tutors'],
    midrange: ['Versatile', 'Good in most metas', 'Balanced approach'],
    tribal: ['Synergistic', 'Explosive potential', 'Theme coherence'],
    value: ['Card advantage', 'Incremental benefits', 'Long game'],
    stax: ['Resource denial', 'Asymmetric effects', 'Control']
  }
  
  return strengths[strategy] || ['Focused strategy']
}

function getStrategyWeaknesses(strategy: string): string[] {
  const weaknesses: Record<string, string[]> = {
    aggro: ['Vulnerable to board wipes', 'Runs out of gas', 'Weak late game'],
    control: ['Slow start', 'Vulnerable to fast aggro', 'Resource intensive'],
    combo: ['Vulnerable to disruption', 'Inconsistent', 'All-in strategy'],
    midrange: ['Jack of all trades', 'Can be outpaced', 'No clear focus'],
    tribal: ['Dependent on synergies', 'Vulnerable to hate', 'Linear'],
    value: ['Slow to close games', 'Vulnerable to fast strategies', 'Grindy'],
    stax: ['Hated by opponents', 'Complex to pilot', 'Can backfire']
  }
  
  return weaknesses[strategy] || ['Strategy-specific weaknesses']
}

function getSynergyType(category: string): 'combo' | 'support' | 'engine' | 'protection' | 'enabler' {
  const types: Record<string, 'combo' | 'support' | 'engine' | 'protection' | 'enabler'> = {
    'win-con': 'combo',
    ramp: 'enabler',
    draw: 'engine',
    removal: 'support',
    protection: 'protection',
    utility: 'support'
  }
  
  return types[category] || 'support'
}
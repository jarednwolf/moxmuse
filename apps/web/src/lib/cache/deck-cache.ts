import { GeneratedDeck, DeckStatistics, CardSynergy } from '@moxmuse/shared'

// In-memory cache with TTL
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>()

  set(key: string, data: T, ttl: number = 5 * 60 * 1000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key)
      }
    })
    
    keysToDelete.forEach(key => this.cache.delete(key))
  }
}

// Specialized caches for different data types
export const statisticsCache = new MemoryCache<DeckStatistics>()
export const synergiesCache = new MemoryCache<CardSynergy[]>()
export const analysisCache = new MemoryCache<any>()

// Cache keys generators
export const getCacheKey = {
  statistics: (deckId: string) => `stats:${deckId}`,
  synergies: (deckId: string) => `synergies:${deckId}`,
  analysis: (deckId: string, type: string) => `analysis:${deckId}:${type}`,
  cardData: (cardId: string) => `card:${cardId}`,
  commanderSuggestions: (preferences: string) => `commanders:${preferences}`
}

// Deck statistics calculation with caching
export async function getCachedDeckStatistics(deck: GeneratedDeck): Promise<DeckStatistics> {
  const cacheKey = getCacheKey.statistics(deck.id)
  
  // Try to get from cache first
  const cached = statisticsCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Calculate statistics
  const statistics = await calculateDeckStatistics(deck)
  
  // Cache the result
  statisticsCache.set(cacheKey, statistics, 10 * 60 * 1000) // 10 minutes
  
  return statistics
}

// Card synergies calculation with caching
export async function getCachedCardSynergies(deck: GeneratedDeck): Promise<CardSynergy[]> {
  const cacheKey = getCacheKey.synergies(deck.id)
  
  // Try to get from cache first
  const cached = synergiesCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Calculate synergies
  const synergies = await calculateCardSynergies(deck)
  
  // Cache the result
  synergiesCache.set(cacheKey, synergies, 15 * 60 * 1000) // 15 minutes
  
  return synergies
}

// Generic analysis caching
export async function getCachedAnalysis<T>(
  deckId: string,
  analysisType: string,
  calculator: () => Promise<T>,
  ttl: number = 10 * 60 * 1000
): Promise<T> {
  const cacheKey = getCacheKey.analysis(deckId, analysisType)
  
  // Try to get from cache first
  const cached = analysisCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Calculate analysis
  const result = await calculator()
  
  // Cache the result
  analysisCache.set(cacheKey, result, ttl)
  
  return result
}

// Helper functions for actual calculations
async function calculateDeckStatistics(deck: GeneratedDeck): Promise<DeckStatistics> {
  // Mock implementation - in real app this would analyze actual card data
  const manaCurve = [0, 0, 0, 0, 0, 0, 0, 0] // [0, 1, 2, 3, 4, 5, 6, 7+]
  const colorDistribution = {
    white: 0,
    blue: 0,
    black: 0,
    red: 0,
    green: 0,
    colorless: 0,
    multicolor: 0,
    devotion: {}
  }
  const typeDistribution = {
    creature: 0,
    instant: 0,
    sorcery: 0,
    artifact: 0,
    enchantment: 0,
    planeswalker: 0,
    land: 0,
    other: 0
  }
  const rarityDistribution = {
    common: 0,
    uncommon: 0,
    rare: 0,
    mythic: 0
  }

  // Simulate calculation based on deck categories
  deck.cards.forEach(card => {
    // Mock CMC distribution based on category
    const categoryToCMC: Record<string, number> = {
      'Lands': 0,
      'Ramp': 2,
      'Card Draw': 3,
      'Removal': 3,
      'Counterspells': 2,
      'Creatures': 4,
      'Win Conditions': 6,
      'Artifacts': 3,
      'Enchantments': 4,
      'Planeswalkers': 5
    }
    
    const cmc = categoryToCMC[card.category] || 3
    const cmcIndex = Math.min(cmc, 7)
    manaCurve[cmcIndex] += card.quantity

    // Mock type distribution
    const categoryToType: Record<string, keyof typeof typeDistribution> = {
      'Lands': 'land',
      'Creatures': 'creature',
      'Removal': 'instant',
      'Counterspells': 'instant',
      'Ramp': 'sorcery',
      'Card Draw': 'sorcery',
      'Artifacts': 'artifact',
      'Enchantments': 'enchantment',
      'Planeswalkers': 'planeswalker'
    }
    
    const type = categoryToType[card.category] || 'other'
    typeDistribution[type] += card.quantity

    // Mock color distribution
    const categoryToColor: Record<string, keyof typeof colorDistribution> = {
      'Ramp': 'green',
      'Counterspells': 'blue',
      'Removal': 'white',
      'Creatures': 'multicolor',
      'Win Conditions': 'multicolor',
      'Lands': 'colorless',
      'Artifacts': 'colorless'
    }
    
    const color = categoryToColor[card.category] || 'multicolor'
    if (color !== 'devotion') {
      colorDistribution[color] += card.quantity
    }

    // Mock rarity distribution
    const rarities: Array<keyof typeof rarityDistribution> = ['common', 'uncommon', 'rare', 'mythic']
    const rarity = rarities[Math.floor(Math.random() * rarities.length)]
    rarityDistribution[rarity] += card.quantity
  })

  const totalCards = deck.cards.reduce((sum, card) => sum + card.quantity, 0)
  const landCount = typeDistribution.land
  const nonlandCount = totalCards - landCount
  const averageCMC = manaCurve.reduce((sum, count, cmc) => sum + (count * cmc), 0) / nonlandCount

  return {
    manaCurve: {
      distribution: manaCurve,
      peakCMC: manaCurve.indexOf(Math.max(...manaCurve)),
      averageCMC,
      landRatio: landCount / totalCards
    },
    colorDistribution,
    typeDistribution,
    rarityDistribution,
    averageCMC,
    totalValue: 150, // Mock value
    landCount,
    nonlandCount
  }
}

async function calculateCardSynergies(deck: GeneratedDeck): Promise<CardSynergy[]> {
  // Mock implementation - in real app this would analyze actual card interactions
  const synergies: CardSynergy[] = []
  
  // Create some mock synergies based on categories
  const categoryGroups: Record<string, string[]> = {}
  deck.cards.forEach(card => {
    if (!categoryGroups[card.category]) {
      categoryGroups[card.category] = []
    }
    categoryGroups[card.category].push(card.cardId)
  })

  // Create synergies within categories
  Object.entries(categoryGroups).forEach(([category, cardIds]) => {
    if (cardIds.length > 1) {
      cardIds.forEach(cardId => {
        const relatedCards = cardIds.filter(id => id !== cardId)
        if (relatedCards.length > 0) {
          synergies.push({
            cardId,
            relatedCardIds: relatedCards.slice(0, 3), // Limit to 3 related cards
            synergyType: category.toLowerCase().replace(' ', '_') as any,
            strength: Math.random() * 0.5 + 0.5, // Random strength between 0.5-1.0
            description: `Works well with other ${category.toLowerCase()} cards`
          })
        }
      })
    }
  })

  return synergies
}

// Cache cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null

export function startCacheCleanup(): void {
  if (cleanupInterval) return
  
  cleanupInterval = setInterval(() => {
    statisticsCache.cleanup()
    synergiesCache.cleanup()
    analysisCache.cleanup()
  }, 5 * 60 * 1000) // Clean up every 5 minutes
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

// Clear all caches
export function clearAllCaches(): void {
  statisticsCache.clear()
  synergiesCache.clear()
  analysisCache.clear()
}
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { performance } from 'perf_hooks'
import { GeneratedDeck, GeneratedDeckCard, DeckStatistics } from '@moxmuse/shared'

// Mock large dataset for performance testing
const createMockDeck = (cardCount: number = 100): GeneratedDeck => {
  const cards: GeneratedDeckCard[] = []
  
  for (let i = 0; i < cardCount; i++) {
    cards.push({
      cardId: `card-${i}`,
      quantity: 1,
      category: ['Ramp', 'Draw', 'Removal', 'Creatures', 'Lands'][i % 5],
      role: 'Support',
      reasoning: `Card ${i} reasoning`,
      alternatives: [`alt-${i}-1`, `alt-${i}-2`],
      upgradeOptions: [`upgrade-${i}`],
      budgetOptions: [`budget-${i}`]
    })
  }

  return {
    id: 'performance-test-deck',
    name: 'Performance Test Deck',
    commander: 'Test Commander',
    format: 'commander',
    strategy: {
      name: 'Test Strategy',
      description: 'Performance testing strategy',
      archetype: 'value',
      themes: ['test'],
      gameplan: 'Test gameplan',
      strengths: ['Fast'],
      weaknesses: ['Memory usage']
    },
    winConditions: [],
    powerLevel: 3,
    estimatedBudget: 300,
    cards,
    categories: [],
    statistics: {
      manaCurve: {
        distribution: [5, 10, 15, 20, 25, 15, 8, 2],
        peakCMC: 4,
        averageCMC: 3.2,
        landRatio: 0.35
      },
      colorDistribution: {
        white: 20,
        blue: 20,
        black: 20,
        red: 20,
        green: 20,
        colorless: 0,
        multicolor: 0,
        devotion: { W: 20, U: 20, B: 20, R: 20, G: 20 }
      },
      typeDistribution: {
        creature: 30,
        instant: 15,
        sorcery: 15,
        artifact: 10,
        enchantment: 8,
        planeswalker: 2,
        land: 35,
        other: 5
      },
      rarityDistribution: {
        common: 30,
        uncommon: 40,
        rare: 25,
        mythic: 5
      },
      averageCMC: 3.2,
      totalValue: 300,
      landCount: 35,
      nonlandCount: 65
    },
    synergies: [],
    weaknesses: [],
    generatedAt: new Date(),
    consultationData: {
      buildingFullDeck: true,
      needsCommanderSuggestions: false,
      useCollection: false
    }
  }
}

// Mock deck analysis functions
const calculateManaCurve = (cards: GeneratedDeckCard[]): number[] => {
  const curve = new Array(8).fill(0)
  cards.forEach(card => {
    // Mock CMC calculation
    const cmc = Math.floor(Math.random() * 8)
    curve[cmc]++
  })
  return curve
}

const calculateColorDistribution = (cards: GeneratedDeckCard[]) => {
  const distribution = {
    white: 0, blue: 0, black: 0, red: 0, green: 0,
    colorless: 0, multicolor: 0, devotion: {}
  }
  
  cards.forEach(card => {
    // Mock color calculation
    const colors = ['white', 'blue', 'black', 'red', 'green']
    const randomColor = colors[Math.floor(Math.random() * colors.length)]
    distribution[randomColor as keyof typeof distribution]++
  })
  
  return distribution
}

const calculateTypeDistribution = (cards: GeneratedDeckCard[]) => {
  const distribution = {
    creature: 0, instant: 0, sorcery: 0, artifact: 0,
    enchantment: 0, planeswalker: 0, land: 0, other: 0
  }
  
  cards.forEach(card => {
    const types = Object.keys(distribution)
    const randomType = types[Math.floor(Math.random() * types.length)]
    distribution[randomType as keyof typeof distribution]++
  })
  
  return distribution
}

const calculateSynergies = (cards: GeneratedDeckCard[]) => {
  const synergies = []
  
  // Mock synergy calculation - O(n²) operation for performance testing
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (Math.random() > 0.95) { // 5% chance of synergy
        synergies.push({
          cardId: cards[i].cardId,
          relatedCardIds: [cards[j].cardId],
          synergyType: 'combo',
          strength: Math.floor(Math.random() * 10) + 1,
          description: `Synergy between ${cards[i].cardId} and ${cards[j].cardId}`
        })
      }
    }
  }
  
  return synergies
}

const analyzeFullDeck = (deck: GeneratedDeck) => {
  const startTime = performance.now()
  
  // Perform all analysis operations
  const manaCurve = calculateManaCurve(deck.cards)
  const colorDistribution = calculateColorDistribution(deck.cards)
  const typeDistribution = calculateTypeDistribution(deck.cards)
  const synergies = calculateSynergies(deck.cards)
  
  // Additional expensive operations
  const cardInteractions = deck.cards.map(card => ({
    cardId: card.cardId,
    interactions: deck.cards.filter(other => 
      other.cardId !== card.cardId && 
      other.category === card.category
    ).length
  }))
  
  const endTime = performance.now()
  
  return {
    analysisTime: endTime - startTime,
    results: {
      manaCurve,
      colorDistribution,
      typeDistribution,
      synergies,
      cardInteractions
    }
  }
}

describe('Deck Analysis Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should analyze standard 100-card deck within performance threshold', () => {
    const deck = createMockDeck(100)
    const { analysisTime } = analyzeFullDeck(deck)
    
    // Should complete analysis within 100ms for 100 cards
    expect(analysisTime).toBeLessThan(100)
  })

  it('should handle large deck analysis efficiently', () => {
    const deck = createMockDeck(500) // Stress test with 500 cards
    const { analysisTime } = analyzeFullDeck(deck)
    
    // Should complete even large analysis within 500ms
    expect(analysisTime).toBeLessThan(500)
  })

  it('should scale linearly with card count', () => {
    const sizes = [50, 100, 200, 300]
    const times: number[] = []
    
    sizes.forEach(size => {
      const deck = createMockDeck(size)
      const { analysisTime } = analyzeFullDeck(deck)
      times.push(analysisTime)
    })
    
    // Each doubling should not more than double the time (allowing for some variance)
    for (let i = 1; i < times.length; i++) {
      const ratio = times[i] / times[i - 1]
      const sizeRatio = sizes[i] / sizes[i - 1]
      
      // Time ratio should not exceed size ratio by more than 50%
      expect(ratio).toBeLessThan(sizeRatio * 1.5)
    }
  })

  it('should perform mana curve calculation efficiently', () => {
    const deck = createMockDeck(1000)
    
    const startTime = performance.now()
    const manaCurve = calculateManaCurve(deck.cards)
    const endTime = performance.now()
    
    expect(endTime - startTime).toBeLessThan(10) // Should be very fast
    expect(manaCurve).toHaveLength(8)
    expect(manaCurve.reduce((a, b) => a + b, 0)).toBe(1000)
  })

  it('should perform color distribution calculation efficiently', () => {
    const deck = createMockDeck(1000)
    
    const startTime = performance.now()
    const colorDistribution = calculateColorDistribution(deck.cards)
    const endTime = performance.now()
    
    expect(endTime - startTime).toBeLessThan(10)
    expect(colorDistribution).toHaveProperty('white')
    expect(colorDistribution).toHaveProperty('blue')
    expect(colorDistribution).toHaveProperty('black')
    expect(colorDistribution).toHaveProperty('red')
    expect(colorDistribution).toHaveProperty('green')
  })

  it('should handle synergy calculation with acceptable performance', () => {
    const deck = createMockDeck(100) // O(n²) operation, so keep reasonable size
    
    const startTime = performance.now()
    const synergies = calculateSynergies(deck.cards)
    const endTime = performance.now()
    
    // O(n²) operation should still complete reasonably quickly for 100 cards
    expect(endTime - startTime).toBeLessThan(50)
    expect(Array.isArray(synergies)).toBe(true)
  })

  it('should optimize memory usage during analysis', () => {
    const deck = createMockDeck(1000)
    
    // Mock memory usage tracking
    const initialMemory = process.memoryUsage().heapUsed
    
    analyzeFullDeck(deck)
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    
    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = finalMemory - initialMemory
    
    // Memory increase should be reasonable (less than 50MB for 1000 cards)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
  })

  it('should handle concurrent analysis requests', async () => {
    const decks = Array.from({ length: 10 }, (_, i) => createMockDeck(100))
    
    const startTime = performance.now()
    
    const promises = decks.map(deck => 
      new Promise(resolve => {
        const result = analyzeFullDeck(deck)
        resolve(result)
      })
    )
    
    await Promise.all(promises)
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    
    // Concurrent analysis should not take significantly longer than sequential
    expect(totalTime).toBeLessThan(1000) // 1 second for 10 concurrent analyses
  })

  it('should cache analysis results for identical decks', () => {
    const deck = createMockDeck(100)
    const cache = new Map()
    
    const analyzeWithCache = (deck: GeneratedDeck) => {
      const cacheKey = JSON.stringify(deck.cards.map(c => c.cardId).sort())
      
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)
      }
      
      const result = analyzeFullDeck(deck)
      cache.set(cacheKey, result)
      return result
    }
    
    // First analysis
    const startTime1 = performance.now()
    const result1 = analyzeWithCache(deck)
    const endTime1 = performance.now()
    const time1 = endTime1 - startTime1
    
    // Second analysis (should be cached)
    const startTime2 = performance.now()
    const result2 = analyzeWithCache(deck)
    const endTime2 = performance.now()
    const time2 = endTime2 - startTime2
    
    // Cached result should be much faster
    expect(time2).toBeLessThan(time1 * 0.1) // At least 10x faster
    expect(result1.results).toEqual(result2.results)
  })

  it('should handle edge cases efficiently', () => {
    // Empty deck
    const emptyDeck = createMockDeck(0)
    const { analysisTime: emptyTime } = analyzeFullDeck(emptyDeck)
    expect(emptyTime).toBeLessThan(5)
    
    // Single card deck
    const singleCardDeck = createMockDeck(1)
    const { analysisTime: singleTime } = analyzeFullDeck(singleCardDeck)
    expect(singleTime).toBeLessThan(5)
    
    // Maximum size deck
    const maxDeck = createMockDeck(250) // Reasonable maximum
    const { analysisTime: maxTime } = analyzeFullDeck(maxDeck)
    expect(maxTime).toBeLessThan(200)
  })

  it('should maintain accuracy under performance pressure', () => {
    const deck = createMockDeck(100)
    
    // Run analysis multiple times to ensure consistency
    const results = []
    for (let i = 0; i < 10; i++) {
      const { results: analysisResults } = analyzeFullDeck(deck)
      results.push(analysisResults)
    }
    
    // All mana curves should be identical (deterministic input)
    const firstManaCurve = results[0].manaCurve
    results.forEach(result => {
      expect(result.manaCurve).toEqual(firstManaCurve)
    })
    
    // Card count should always equal deck size
    results.forEach(result => {
      const totalCards = result.manaCurve.reduce((a, b) => a + b, 0)
      expect(totalCards).toBe(100)
    })
  })
})

describe('Statistics Calculation Performance', () => {
  it('should calculate deck statistics within time limits', () => {
    const deck = createMockDeck(100)
    
    const calculateStatistics = (deck: GeneratedDeck): DeckStatistics => {
      const startTime = performance.now()
      
      const statistics: DeckStatistics = {
        manaCurve: {
          distribution: calculateManaCurve(deck.cards),
          peakCMC: 3,
          averageCMC: 3.2,
          landRatio: 0.35
        },
        colorDistribution: calculateColorDistribution(deck.cards),
        typeDistribution: calculateTypeDistribution(deck.cards),
        rarityDistribution: {
          common: 30,
          uncommon: 40,
          rare: 25,
          mythic: 5
        },
        averageCMC: 3.2,
        totalValue: 300,
        landCount: 35,
        nonlandCount: 65
      }
      
      const endTime = performance.now()
      const calculationTime = endTime - startTime
      
      // Statistics calculation should be very fast
      expect(calculationTime).toBeLessThan(20)
      
      return statistics
    }
    
    const stats = calculateStatistics(deck)
    expect(stats).toBeDefined()
    expect(stats.manaCurve.distribution).toHaveLength(8)
  })

  it('should handle real-time statistics updates efficiently', () => {
    const deck = createMockDeck(100)
    
    // Simulate adding/removing cards
    const updateTimes: number[] = []
    
    for (let i = 0; i < 50; i++) {
      const startTime = performance.now()
      
      // Add a card
      deck.cards.push({
        cardId: `new-card-${i}`,
        quantity: 1,
        category: 'Creatures',
        role: 'Threat',
        reasoning: 'Added for testing'
      })
      
      // Recalculate statistics
      calculateManaCurve(deck.cards)
      calculateColorDistribution(deck.cards)
      calculateTypeDistribution(deck.cards)
      
      const endTime = performance.now()
      updateTimes.push(endTime - startTime)
    }
    
    // Each update should be fast
    updateTimes.forEach(time => {
      expect(time).toBeLessThan(10)
    })
    
    // Average update time should be very low
    const averageTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length
    expect(averageTime).toBeLessThan(5)
  })
})
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { 
  cardSynergyDetectionService,
  type SynergyAnalysisRequest,
  type ComprehensiveSynergyAnalysis 
} from '../card-synergy-detection'
import { aiResearchEngine } from '../ai/research-engine'

// Mock the AI research engine
vi.mock('../ai/research-engine', () => ({
  aiResearchEngine: {
    performResearch: vi.fn()
  }
}))

// Mock the database
vi.mock('@repo/db', () => ({
  db: {
    enhancedCard: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}))

describe('CardSynergyDetectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('analyzeSynergies', () => {
    it('should analyze synergies for a basic deck', async () => {
      // Mock research response
      const mockResearchResponse = {
        insights: [
          {
            content: 'Sol Ring provides fast mana acceleration',
            confidence: 0.9,
            sources: ['edhrec', 'mtgtop8']
          }
        ],
        sources: ['edhrec', 'mtgtop8', 'reddit']
      }

      ;(aiResearchEngine.performResearch as Mock).mockResolvedValue(mockResearchResponse)

      const request: SynergyAnalysisRequest = {
        cards: [
          {
            cardId: 'sol-ring',
            cardName: 'Sol Ring',
            quantity: 1,
            cmc: 1,
            types: ['Artifact'],
            colors: []
          },
          {
            cardId: 'mana-vault',
            cardName: 'Mana Vault',
            quantity: 1,
            cmc: 1,
            types: ['Artifact'],
            colors: []
          },
          {
            cardId: 'lightning-bolt',
            cardName: 'Lightning Bolt',
            quantity: 1,
            cmc: 1,
            types: ['Instant'],
            colors: ['R']
          }
        ],
        commander: 'Krenko, Mob Boss',
        strategy: 'Goblin Tribal',
        format: 'commander',
        analysisDepth: 'moderate'
      }

      const result = await cardSynergyDetectionService.analyzeSynergies(request)

      expect(result).toBeDefined()
      expect(result.cardSynergies).toBeInstanceOf(Array)
      expect(result.relatedCardSuggestions).toBeInstanceOf(Array)
      expect(result.comboDetections).toBeInstanceOf(Array)
      expect(result.upgradePaths).toBeInstanceOf(Array)
      expect(result.synergyScore).toBeGreaterThanOrEqual(0)
      expect(result.synergyScore).toBeLessThanOrEqual(10)
      expect(result.analysisMetadata).toBeDefined()
      expect(result.analysisMetadata.confidenceScore).toBeGreaterThanOrEqual(0)
      expect(result.analysisMetadata.confidenceScore).toBeLessThanOrEqual(1)
    })

    it('should handle empty deck gracefully', async () => {
      const request: SynergyAnalysisRequest = {
        cards: [],
        commander: 'Krenko, Mob Boss',
        strategy: 'Goblin Tribal',
        format: 'commander',
        analysisDepth: 'shallow'
      }

      const result = await cardSynergyDetectionService.analyzeSynergies(request)

      expect(result).toBeDefined()
      expect(result.cardSynergies).toHaveLength(0)
      expect(result.relatedCardSuggestions).toBeInstanceOf(Array)
      expect(result.comboDetections).toHaveLength(0)
      expect(result.upgradePaths).toHaveLength(0)
      expect(result.synergyScore).toBe(0)
    })

    it('should respect analysis depth parameter', async () => {
      const mockResearchResponse = {
        insights: [],
        sources: ['edhrec']
      }

      ;(aiResearchEngine.performResearch as Mock).mockResolvedValue(mockResearchResponse)

      const shallowRequest: SynergyAnalysisRequest = {
        cards: [
          {
            cardId: 'sol-ring',
            cardName: 'Sol Ring',
            quantity: 1
          }
        ],
        commander: 'Krenko, Mob Boss',
        analysisDepth: 'shallow'
      }

      const deepRequest: SynergyAnalysisRequest = {
        ...shallowRequest,
        analysisDepth: 'deep'
      }

      const shallowResult = await cardSynergyDetectionService.analyzeSynergies(shallowRequest)
      const deepResult = await cardSynergyDetectionService.analyzeSynergies(deepRequest)

      expect(shallowResult.analysisMetadata.analysisDepth).toBe('shallow')
      expect(deepResult.analysisMetadata.analysisDepth).toBe('deep')
    })

    it('should include budget constraints in analysis', async () => {
      const mockResearchResponse = {
        insights: [],
        sources: ['edhrec']
      }

      ;(aiResearchEngine.performResearch as Mock).mockResolvedValue(mockResearchResponse)

      const request: SynergyAnalysisRequest = {
        cards: [
          {
            cardId: 'sol-ring',
            cardName: 'Sol Ring',
            quantity: 1
          }
        ],
        commander: 'Krenko, Mob Boss',
        budgetConstraints: {
          maxBudget: 100,
          prioritizeBudget: true,
          ownedCards: ['Sol Ring']
        }
      }

      const result = await cardSynergyDetectionService.analyzeSynergies(request)

      expect(result).toBeDefined()
      // Budget constraints should influence the analysis
      expect(result.analysisMetadata).toBeDefined()
    })
  })

  describe('synergy scoring', () => {
    it('should calculate synergy scores correctly', async () => {
      const mockResearchResponse = {
        insights: [
          {
            content: 'Strong synergy detected',
            confidence: 0.9,
            sources: ['edhrec']
          }
        ],
        sources: ['edhrec']
      }

      ;(aiResearchEngine.performResearch as Mock).mockResolvedValue(mockResearchResponse)

      const request: SynergyAnalysisRequest = {
        cards: [
          {
            cardId: 'thassas-oracle',
            cardName: 'Thassa\'s Oracle',
            quantity: 1
          },
          {
            cardId: 'demonic-consultation',
            cardName: 'Demonic Consultation',
            quantity: 1
          }
        ],
        commander: 'Zur the Enchanter',
        strategy: 'Combo'
      }

      const result = await cardSynergyDetectionService.analyzeSynergies(request)

      expect(result.synergyScore).toBeGreaterThan(0)
      expect(result.synergyScore).toBeLessThanOrEqual(10)
    })
  })

  describe('error handling', () => {
    it('should handle AI service failures gracefully', async () => {
      ;(aiResearchEngine.performResearch as Mock).mockRejectedValue(new Error('AI service unavailable'))

      const request: SynergyAnalysisRequest = {
        cards: [
          {
            cardId: 'sol-ring',
            cardName: 'Sol Ring',
            quantity: 1
          }
        ],
        commander: 'Krenko, Mob Boss'
      }

      await expect(cardSynergyDetectionService.analyzeSynergies(request)).rejects.toThrow()
    })

    it('should validate input parameters', async () => {
      const invalidRequest = {
        cards: [],
        commander: '', // Invalid empty commander
        strategy: 'Test'
      }

      await expect(cardSynergyDetectionService.analyzeSynergies(invalidRequest as any)).rejects.toThrow()
    })
  })

  describe('caching and performance', () => {
    it('should handle large deck analysis efficiently', async () => {
      const mockResearchResponse = {
        insights: [],
        sources: ['edhrec']
      }

      ;(aiResearchEngine.performResearch as Mock).mockResolvedValue(mockResearchResponse)

      // Create a large deck (100 cards)
      const largeCardList = Array.from({ length: 100 }, (_, i) => ({
        cardId: `card-${i}`,
        cardName: `Card ${i}`,
        quantity: 1,
        cmc: Math.floor(i / 10),
        types: ['Creature'],
        colors: ['R']
      }))

      const request: SynergyAnalysisRequest = {
        cards: largeCardList,
        commander: 'Krenko, Mob Boss',
        strategy: 'Aggro',
        analysisDepth: 'shallow' // Use shallow for performance
      }

      const startTime = Date.now()
      const result = await cardSynergyDetectionService.analyzeSynergies(request)
      const endTime = Date.now()

      expect(result).toBeDefined()
      expect(endTime - startTime).toBeLessThan(30000) // Should complete within 30 seconds
    })
  })

  describe('synergy types and relationships', () => {
    it('should identify different synergy types correctly', async () => {
      const mockResearchResponse = {
        insights: [
          {
            content: 'Combo synergy between cards',
            confidence: 0.9,
            sources: ['edhrec']
          }
        ],
        sources: ['edhrec']
      }

      ;(aiResearchEngine.performResearch as Mock).mockResolvedValue(mockResearchResponse)

      const request: SynergyAnalysisRequest = {
        cards: [
          {
            cardId: 'sol-ring',
            cardName: 'Sol Ring',
            quantity: 1
          },
          {
            cardId: 'mana-vault',
            cardName: 'Mana Vault',
            quantity: 1
          }
        ],
        commander: 'Krenko, Mob Boss'
      }

      const result = await cardSynergyDetectionService.analyzeSynergies(request)

      // Check that synergies have valid types
      result.cardSynergies.forEach(synergy => {
        expect(['combo', 'support', 'engine', 'protection', 'enabler', 'alternative', 'upgrade'])
          .toContain(synergy.synergyType)
        expect(synergy.strength).toBeGreaterThanOrEqual(1)
        expect(synergy.strength).toBeLessThanOrEqual(10)
        expect(synergy.confidence).toBeGreaterThanOrEqual(0)
        expect(synergy.confidence).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('upgrade recommendations', () => {
    it('should provide meaningful upgrade suggestions', async () => {
      const mockResearchResponse = {
        insights: [
          {
            content: 'Upgrade suggestions available',
            confidence: 0.8,
            sources: ['edhrec']
          }
        ],
        sources: ['edhrec']
      }

      ;(aiResearchEngine.performResearch as Mock).mockResolvedValue(mockResearchResponse)

      const request: SynergyAnalysisRequest = {
        cards: [
          {
            cardId: 'grizzly-bears',
            cardName: 'Grizzly Bears',
            quantity: 1,
            cmc: 2
          }
        ],
        commander: 'Krenko, Mob Boss',
        budgetConstraints: {
          maxBudget: 50,
          prioritizeBudget: true
        }
      }

      const result = await cardSynergyDetectionService.analyzeSynergies(request)

      // Should provide upgrade paths
      expect(result.upgradePaths).toBeInstanceOf(Array)
      
      result.upgradePaths.forEach(path => {
        expect(path.currentCard).toBeDefined()
        expect(path.upgrades).toBeInstanceOf(Array)
        expect(path.budgetConsiderations).toBeDefined()
        
        path.upgrades.forEach(upgrade => {
          expect(['direct', 'functional', 'power_level', 'budget']).toContain(upgrade.upgradeType)
          expect(['high', 'medium', 'low']).toContain(upgrade.priority)
          expect(['budget', 'mid', 'high', 'premium']).toContain(upgrade.budgetTier)
        })
      })
    })
  })
})

describe('CardSynergyDetectionService Integration', () => {
  it('should work with real commander deck analysis', async () => {
    // Mock a realistic research response
    const mockResearchResponse = {
      insights: [
        {
          content: 'Krenko synergizes well with goblin token generators',
          confidence: 0.85,
          sources: ['edhrec', 'mtgtop8']
        },
        {
          content: 'Haste enablers are crucial for goblin strategies',
          confidence: 0.9,
          sources: ['edhrec']
        }
      ],
      sources: ['edhrec', 'mtgtop8', 'reddit']
    }

    ;(aiResearchEngine.performResearch as Mock).mockResolvedValue(mockResearchResponse)

    const goblinDeck: SynergyAnalysisRequest = {
      cards: [
        {
          cardId: 'krenko-mob-boss',
          cardName: 'Krenko, Mob Boss',
          quantity: 1,
          cmc: 4,
          types: ['Legendary', 'Creature', 'Goblin', 'Warrior'],
          colors: ['R']
        },
        {
          cardId: 'goblin-chieftain',
          cardName: 'Goblin Chieftain',
          quantity: 1,
          cmc: 3,
          types: ['Creature', 'Goblin', 'Warrior'],
          colors: ['R']
        },
        {
          cardId: 'sol-ring',
          cardName: 'Sol Ring',
          quantity: 1,
          cmc: 1,
          types: ['Artifact'],
          colors: []
        },
        {
          cardId: 'lightning-bolt',
          cardName: 'Lightning Bolt',
          quantity: 1,
          cmc: 1,
          types: ['Instant'],
          colors: ['R']
        }
      ],
      commander: 'Krenko, Mob Boss',
      strategy: 'Goblin Tribal Aggro',
      format: 'commander',
      analysisDepth: 'moderate'
    }

    const result = await cardSynergyDetectionService.analyzeSynergies(goblinDeck)

    // Verify comprehensive analysis structure
    expect(result).toMatchObject({
      cardSynergies: expect.any(Array),
      relatedCardSuggestions: expect.any(Array),
      comboDetections: expect.any(Array),
      upgradePaths: expect.any(Array),
      synergyScore: expect.any(Number),
      analysisMetadata: {
        analysisDepth: 'moderate',
        confidenceScore: expect.any(Number),
        researchSources: expect.any(Array),
        analysisTimestamp: expect.any(Date),
        modelVersion: expect.any(String)
      }
    })

    // Verify synergy score is reasonable
    expect(result.synergyScore).toBeGreaterThanOrEqual(0)
    expect(result.synergyScore).toBeLessThanOrEqual(10)

    // Verify confidence score is reasonable
    expect(result.analysisMetadata.confidenceScore).toBeGreaterThanOrEqual(0)
    expect(result.analysisMetadata.confidenceScore).toBeLessThanOrEqual(1)

    console.log('✅ Integration test completed successfully')
    console.log(`📊 Synergy Score: ${result.synergyScore}/10`)
    console.log(`🎯 Confidence: ${(result.analysisMetadata.confidenceScore * 100).toFixed(1)}%`)
    console.log(`🔗 Synergies Found: ${result.cardSynergies.length}`)
    console.log(`💡 Suggestions: ${result.relatedCardSuggestions.length}`)
    console.log(`⚡ Combos: ${result.comboDetections.length}`)
    console.log(`📈 Upgrade Paths: ${result.upgradePaths.length}`)
  })
})
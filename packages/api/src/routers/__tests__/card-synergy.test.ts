import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { createTRPCMsw } from 'msw-trpc'
import { appRouter } from '../../root'
import { cardSynergyDetectionService } from '../../services/card-synergy-detection'
import { db } from '@repo/db'

// Mock the synergy detection service
vi.mock('../../services/card-synergy-detection', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    cardSynergyDetectionService: {
      analyzeSynergies: vi.fn()
    }
  }
})

// Mock the database
vi.mock('@repo/db', () => ({
  db: {
    aIAnalysisCache: {
      create: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn()
    },
    suggestionFeedback: {
      create: vi.fn(),
      groupBy: vi.fn()
    }
  }
}))

// Mock tRPC context
const createMockContext = (userId?: string) => ({
  user: userId ? { id: userId, email: 'test@example.com' } : null,
  session: userId ? { user: { id: userId } } : null
})

describe('cardSynergyRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('analyzeSynergies', () => {
    it('should analyze synergies for authenticated user', async () => {
      const mockAnalysis = {
        cardSynergies: [
          {
            cardA: 'Sol Ring',
            cardB: 'Mana Vault',
            synergyType: 'support' as const,
            strength: 8,
            description: 'Both provide fast mana',
            explanation: 'These artifacts work together for mana acceleration',
            researchSources: ['edhrec', 'mtgtop8'],
            confidence: 0.9
          }
        ],
        relatedCardSuggestions: [
          {
            cardId: 'rhystic-study',
            cardName: 'Rhystic Study',
            relationship: 'synergy' as const,
            strength: 9,
            explanation: 'Excellent card draw engine',
            researchBacking: ['edhrec'],
            confidence: 0.85
          }
        ],
        comboDetections: [],
        upgradePaths: [],
        synergyScore: 7.5,
        analysisMetadata: {
          analysisDepth: 'moderate',
          confidenceScore: 0.8,
          researchSources: ['edhrec', 'mtgtop8'],
          analysisTimestamp: new Date(),
          modelVersion: '1.0'
        }
      }

      ;(cardSynergyDetectionService.analyzeSynergies as Mock).mockResolvedValue(mockAnalysis)
      ;(db.aIAnalysisCache.create as Mock).mockResolvedValue({ id: 'cache-1' })

      const caller = appRouter.createCaller(createMockContext('user-1'))

      const result = await caller.cardSynergy.analyzeSynergies({
        cards: [
          {
            cardId: 'sol-ring',
            cardName: 'Sol Ring',
            quantity: 1
          }
        ],
        commander: 'Krenko, Mob Boss',
        strategy: 'Goblin Tribal'
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockAnalysis)
      expect(cardSynergyDetectionService.analyzeSynergies).toHaveBeenCalledWith({
        cards: [
          {
            cardId: 'sol-ring',
            cardName: 'Sol Ring',
            quantity: 1
          }
        ],
        commander: 'Krenko, Mob Boss',
        strategy: 'Goblin Tribal',
        format: 'commander',
        analysisDepth: 'moderate',
        userId: 'user-1'
      })
    })

    it('should require authentication', async () => {
      const caller = appRouter.createCaller(createMockContext())

      await expect(caller.cardSynergy.analyzeSynergies({
        cards: [],
        commander: 'Test Commander'
      })).rejects.toThrow()
    })

    it('should handle service errors gracefully', async () => {
      ;(cardSynergyDetectionService.analyzeSynergies as Mock).mockRejectedValue(
        new Error('AI service unavailable')
      )

      const caller = appRouter.createCaller(createMockContext('user-1'))

      await expect(caller.cardSynergy.analyzeSynergies({
        cards: [],
        commander: 'Test Commander'
      })).rejects.toThrow('Synergy analysis failed: AI service unavailable')
    })
  })

  describe('getRelatedCards', () => {
    it('should get related cards without authentication', async () => {
      const mockAnalysis = {
        cardSynergies: [],
        relatedCardSuggestions: [
          {
            cardId: 'rhystic-study',
            cardName: 'Rhystic Study',
            relationship: 'synergy' as const,
            strength: 9,
            explanation: 'Excellent card draw engine',
            researchBacking: ['edhrec'],
            confidence: 0.85
          }
        ],
        comboDetections: [],
        upgradePaths: [],
        synergyScore: 5,
        analysisMetadata: {
          analysisDepth: 'shallow',
          confidenceScore: 0.8,
          researchSources: ['edhrec'],
          analysisTimestamp: new Date(),
          modelVersion: '1.0'
        }
      }

      ;(cardSynergyDetectionService.analyzeSynergies as Mock).mockResolvedValue(mockAnalysis)

      const caller = appRouter.createCaller(createMockContext())

      const result = await caller.cardSynergy.getRelatedCards({
        cardName: 'Sol Ring',
        commander: 'Krenko, Mob Boss',
        limit: 5
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockAnalysis.relatedCardSuggestions)
    })
  })

  describe('detectCombos', () => {
    it('should detect combos for authenticated user', async () => {
      const mockAnalysis = {
        cardSynergies: [],
        relatedCardSuggestions: [],
        comboDetections: [
          {
            cards: ['Thassa\'s Oracle', 'Demonic Consultation'],
            comboName: 'Thoracle Combo',
            description: 'Exile library and win with Thassa\'s Oracle',
            setupSteps: ['Cast Demonic Consultation', 'Name a card not in deck', 'Cast Thassa\'s Oracle'],
            winCondition: true,
            manaRequired: 4,
            turnsToSetup: 1,
            interruptionPoints: ['Counter Thassa\'s Oracle', 'Counter Demonic Consultation'],
            counterplay: ['Counterspells', 'Graveyard hate'],
            researchSources: ['edhrec', 'mtgtop8'],
            confidence: 0.95
          }
        ],
        upgradePaths: [],
        synergyScore: 8,
        analysisMetadata: {
          analysisDepth: 'deep',
          confidenceScore: 0.9,
          researchSources: ['edhrec', 'mtgtop8'],
          analysisTimestamp: new Date(),
          modelVersion: '1.0'
        }
      }

      ;(cardSynergyDetectionService.analyzeSynergies as Mock).mockResolvedValue(mockAnalysis)

      const caller = appRouter.createCaller(createMockContext('user-1'))

      const result = await caller.cardSynergy.detectCombos({
        cards: [
          { cardId: 'thassas-oracle', cardName: 'Thassa\'s Oracle', quantity: 1 },
          { cardId: 'demonic-consultation', cardName: 'Demonic Consultation', quantity: 1 }
        ],
        commander: 'Zur the Enchanter',
        strategy: 'Combo'
      })

      expect(result.success).toBe(true)
      expect(result.data.combos).toEqual(mockAnalysis.comboDetections)
      expect(result.data.synergyScore).toBe(8)
      expect(result.data.confidence).toBe(0.9)
    })
  })

  describe('getUpgradeRecommendations', () => {
    it('should get upgrade recommendations for authenticated user', async () => {
      const mockAnalysis = {
        cardSynergies: [],
        relatedCardSuggestions: [
          {
            cardId: 'mana-crypt',
            cardName: 'Mana Crypt',
            relationship: 'upgrade' as const,
            strength: 9,
            explanation: 'Faster mana acceleration',
            researchBacking: ['edhrec'],
            confidence: 0.9
          }
        ],
        comboDetections: [],
        upgradePaths: [
          {
            currentCard: 'Sol Ring',
            upgrades: [
              {
                cardId: 'mana-crypt',
                cardName: 'Mana Crypt',
                upgradeType: 'power_level' as const,
                improvementAreas: ['mana acceleration'],
                priceIncrease: 150,
                reasoning: 'Provides faster mana with no mana cost',
                priority: 'high' as const,
                budgetTier: 'premium' as const,
                researchBacking: ['edhrec']
              }
            ],
            budgetConsiderations: {
              totalUpgradeCost: 150,
              budgetAlternatives: [],
              costEffectiveUpgrades: []
            }
          }
        ],
        synergyScore: 6,
        analysisMetadata: {
          analysisDepth: 'moderate',
          confidenceScore: 0.8,
          researchSources: ['edhrec'],
          analysisTimestamp: new Date(),
          modelVersion: '1.0'
        }
      }

      ;(cardSynergyDetectionService.analyzeSynergies as Mock).mockResolvedValue(mockAnalysis)

      const caller = appRouter.createCaller(createMockContext('user-1'))

      const result = await caller.cardSynergy.getUpgradeRecommendations({
        cards: [
          { cardId: 'sol-ring', cardName: 'Sol Ring', quantity: 1 }
        ],
        commander: 'Krenko, Mob Boss',
        budgetConstraints: {
          maxBudget: 200,
          prioritizeBudget: false
        }
      })

      expect(result.success).toBe(true)
      expect(result.data.upgradePaths).toEqual(mockAnalysis.upgradePaths)
      expect(result.data.relatedCards).toEqual(mockAnalysis.relatedCardSuggestions)
    })
  })

  describe('getSynergyStrength', () => {
    it('should get synergy strength between two cards', async () => {
      const mockAnalysis = {
        cardSynergies: [
          {
            cardA: 'Sol Ring',
            cardB: 'Mana Vault',
            synergyType: 'support' as const,
            strength: 8,
            description: 'Both provide fast mana',
            explanation: 'These artifacts work together for mana acceleration',
            researchSources: ['edhrec'],
            confidence: 0.9
          }
        ],
        relatedCardSuggestions: [],
        comboDetections: [],
        upgradePaths: [],
        synergyScore: 8,
        analysisMetadata: {
          analysisDepth: 'shallow',
          confidenceScore: 0.9,
          researchSources: ['edhrec'],
          analysisTimestamp: new Date(),
          modelVersion: '1.0'
        }
      }

      ;(cardSynergyDetectionService.analyzeSynergies as Mock).mockResolvedValue(mockAnalysis)

      const caller = appRouter.createCaller(createMockContext())

      const result = await caller.cardSynergy.getSynergyStrength({
        cardA: 'Sol Ring',
        cardB: 'Mana Vault',
        commander: 'Krenko, Mob Boss'
      })

      expect(result.success).toBe(true)
      expect(result.data.hasSynergy).toBe(true)
      expect(result.data.strength).toBe(8)
      expect(result.data.synergy).toEqual(mockAnalysis.cardSynergies[0])
    })

    it('should handle no synergy found', async () => {
      const mockAnalysis = {
        cardSynergies: [],
        relatedCardSuggestions: [],
        comboDetections: [],
        upgradePaths: [],
        synergyScore: 0,
        analysisMetadata: {
          analysisDepth: 'shallow',
          confidenceScore: 0.5,
          researchSources: ['edhrec'],
          analysisTimestamp: new Date(),
          modelVersion: '1.0'
        }
      }

      ;(cardSynergyDetectionService.analyzeSynergies as Mock).mockResolvedValue(mockAnalysis)

      const caller = appRouter.createCaller(createMockContext())

      const result = await caller.cardSynergy.getSynergyStrength({
        cardA: 'Lightning Bolt',
        cardB: 'Counterspell'
      })

      expect(result.success).toBe(true)
      expect(result.data.hasSynergy).toBe(false)
      expect(result.data.strength).toBe(0)
      expect(result.data.synergy).toBe(null)
      expect(result.data.explanation).toBe('No significant synergy detected')
    })
  })

  describe('provideFeedback', () => {
    it('should record feedback for authenticated user', async () => {
      ;(db.suggestionFeedback.create as Mock).mockResolvedValue({ id: 'feedback-1' })

      const caller = appRouter.createCaller(createMockContext('user-1'))

      const result = await caller.cardSynergy.provideFeedback({
        suggestionId: 'suggestion-1',
        deckId: 'deck-1',
        feedback: 'accepted',
        reason: 'Great suggestion',
        satisfactionRating: 5
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Feedback recorded successfully')
      expect(db.suggestionFeedback.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          suggestionId: 'suggestion-1',
          deckId: 'deck-1',
          feedback: 'accepted',
          reason: 'Great suggestion',
          alternativeChosen: undefined,
          satisfactionRating: 5,
          context: undefined
        }
      })
    })
  })

  describe('getCachedAnalysis', () => {
    it('should retrieve cached analysis for authenticated user', async () => {
      const mockCachedAnalysis = {
        id: 'cache-1',
        deckId: 'deck-1',
        analysisVersion: 1,
        synergyAnalysis: { cardSynergies: [] },
        confidenceScore: 0.8,
        createdAt: new Date(),
        modelVersion: '1.0'
      }

      ;(db.aIAnalysisCache.findFirst as Mock).mockResolvedValue(mockCachedAnalysis)

      const caller = appRouter.createCaller(createMockContext('user-1'))

      const result = await caller.cardSynergy.getCachedAnalysis({
        deckId: 'deck-1'
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        synergyAnalysis: mockCachedAnalysis.synergyAnalysis,
        confidenceScore: mockCachedAnalysis.confidenceScore,
        analysisVersion: mockCachedAnalysis.analysisVersion,
        createdAt: mockCachedAnalysis.createdAt,
        modelVersion: mockCachedAnalysis.modelVersion
      })
    })

    it('should handle no cached analysis found', async () => {
      ;(db.aIAnalysisCache.findFirst as Mock).mockResolvedValue(null)

      const caller = appRouter.createCaller(createMockContext('user-1'))

      const result = await caller.cardSynergy.getCachedAnalysis({
        deckId: 'deck-1'
      })

      expect(result.success).toBe(false)
      expect(result.data).toBe(null)
      expect(result.message).toBe('No cached analysis found')
    })
  })

  describe('getSynergyStats', () => {
    it('should get synergy statistics for authenticated user', async () => {
      const mockFeedbackStats = [
        { feedback: 'accepted', _count: { feedback: 10 } },
        { feedback: 'rejected', _count: { feedback: 3 } },
        { feedback: 'modified', _count: { feedback: 2 } }
      ]

      ;(db.suggestionFeedback.groupBy as Mock).mockResolvedValue(mockFeedbackStats)
      ;(db.aIAnalysisCache.count as Mock).mockResolvedValue(5)

      const caller = appRouter.createCaller(createMockContext('user-1'))

      const result = await caller.cardSynergy.getSynergyStats()

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        feedbackSummary: {
          accepted: 10,
          rejected: 3,
          modified: 2
        },
        recentAnalyses: 5,
        totalFeedback: 15,
        acceptanceRate: (10 / 15) * 100
      })
    })
  })
})

describe('cardSynergyRouter Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle database errors gracefully', async () => {
    ;(cardSynergyDetectionService.analyzeSynergies as Mock).mockResolvedValue({
      cardSynergies: [],
      relatedCardSuggestions: [],
      comboDetections: [],
      upgradePaths: [],
      synergyScore: 0,
      analysisMetadata: {
        analysisDepth: 'moderate',
        confidenceScore: 0.5,
        researchSources: [],
        analysisTimestamp: new Date(),
        modelVersion: '1.0'
      }
    })

    ;(db.aIAnalysisCache.create as Mock).mockRejectedValue(new Error('Database error'))

    const caller = appRouter.createCaller(createMockContext('user-1'))

    // Should still succeed even if caching fails
    const result = await caller.cardSynergy.analyzeSynergies({
      cards: [],
      commander: 'Test Commander'
    })

    expect(result.success).toBe(true)
  })

  it('should validate input parameters', async () => {
    const caller = appRouter.createCaller(createMockContext('user-1'))

    // Test invalid commander (empty string) - should be caught by Zod validation
    await expect(caller.cardSynergy.analyzeSynergies({
      cards: [],
      commander: '' // This should fail Zod validation
    } as any)).rejects.toThrow()

    // Test invalid card data - should be caught by Zod validation
    await expect(caller.cardSynergy.analyzeSynergies({
      cards: [{ cardId: '', cardName: '', quantity: -1 }], // Invalid quantity
      commander: 'Test Commander'
    } as any)).rejects.toThrow()
  })
})

console.log('🔗 Card Synergy Router tests initialized')
console.log('Test coverage:')
console.log('  ✅ analyzeSynergies endpoint')
console.log('  ✅ getRelatedCards endpoint')
console.log('  ✅ detectCombos endpoint')
console.log('  ✅ getUpgradeRecommendations endpoint')
console.log('  ✅ getSynergyStrength endpoint')
console.log('  ✅ provideFeedback endpoint')
console.log('  ✅ getCachedAnalysis endpoint')
console.log('  ✅ getSynergyStats endpoint')
console.log('  ✅ Authentication requirements')
console.log('  ✅ Error handling')
console.log('  ✅ Input validation')
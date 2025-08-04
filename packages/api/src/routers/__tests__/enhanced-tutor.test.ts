import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enhancedTutorRouter } from '../enhanced-tutor'
import { createTRPCMsw } from 'msw-trpc'
import { appRouter } from '../../root'

// Mock the services
vi.mock('../services/ai', () => ({
  aiServiceOrchestrator: {
    generateCompleteDeck: vi.fn(),
    getDeckGenerationProgress: vi.fn(),
    getSystemPerformance: vi.fn(),
  },
  deckAnalysisEngine: {
    analyzeWithStreaming: vi.fn(),
  },
  aiUserStyleProfiler: {
    getUserProfile: vi.fn(),
  },
  researchBackedPersonalization: {
    generatePersonalizedSuggestions: vi.fn(),
  },
  intelligentLearningService: {
    generateInsights: vi.fn(),
  },
}))

vi.mock('../services/learning', () => ({
  learningEventTracker: {
    trackUserInteraction: vi.fn(),
    trackSuggestionFeedback: vi.fn(),
    getUserLearningStats: vi.fn(),
  },
  adaptiveSuggestionsEngine: {
    generateAdaptiveSuggestions: vi.fn(),
  },
  preferenceInferenceEngine: {
    inferUserPreferences: vi.fn(),
  },
  collectiveLearningEngine: {
    generateCollectiveInsights: vi.fn(),
  },
  strategyEvolutionDetector: {
    detectStrategyEvolution: vi.fn(),
  },
  intelligentLearningSystem: vi.fn(),
}))

vi.mock('../services/deck-maintenance', () => ({
  SetMonitorService: vi.fn(),
  ProactiveSuggestionsService: vi.fn(),
  MultiDeckOptimizerService: vi.fn().mockImplementation(() => ({
    optimizeUserDecks: vi.fn(),
  })),
  AutomaticAnalysisService: vi.fn(),
  MaintenanceSchedulerService: vi.fn(),
}))

vi.mock('../services/market-analysis', () => ({
  MarketAnalysisService: vi.fn().mockImplementation(() => ({
    analyzeDeckMarket: vi.fn(),
  })),
}))

vi.mock('../services/price-tracking', () => ({
  PriceTrackingService: vi.fn().mockImplementation(() => ({
    getCardPrices: vi.fn(),
  })),
}))

vi.mock('../services/meta-analysis', () => ({
  metaAnalysisService: {
    analyzeMetaPosition: vi.fn(),
  },
}))

vi.mock('../services/collection-proxy', () => ({
  CollectionProxyService: vi.fn().mockImplementation(() => ({
    fetchCollection: vi.fn(),
  })),
}))

describe('Enhanced Tutor Router', () => {
  const mockContext = {
    session: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
      },
    },
    prisma: {
      enhancedDeck: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      enhancedDeckCard: {
        create: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
      suggestionFeedback: {
        create: vi.fn(),
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateCompleteDeck', () => {
    it('should validate input schema', () => {
      const input = {
        sessionId: 'test-session',
        consultationData: {
          buildingFullDeck: true,
          strategy: 'aggro' as const,
          budget: 100,
          powerLevel: 3,
        },
        commander: 'Alesha, Who Smiles at Death',
      }

      // Test that the input schema accepts valid input
      expect(() => {
        enhancedTutorRouter._def.procedures.generateCompleteDeck._def.inputs[0].parse(input)
      }).not.toThrow()
    })

    it('should reject invalid input', () => {
      const invalidInput = {
        sessionId: '', // Empty string should fail
        consultationData: {
          buildingFullDeck: true,
          strategy: 'invalid-strategy', // Invalid strategy
        },
        commander: 'Alesha, Who Smiles at Death',
      }

      expect(() => {
        enhancedTutorRouter._def.procedures.generateCompleteDeck._def.inputs[0].parse(invalidInput)
      }).toThrow()
    })
  })

  describe('getPersonalizedSuggestions', () => {
    it('should validate input schema', () => {
      const input = {
        deckId: 'test-deck-id',
        suggestionTypes: ['cards', 'strategy'] as const,
        maxSuggestions: 5,
        includeResearch: true,
      }

      expect(() => {
        enhancedTutorRouter._def.procedures.getPersonalizedSuggestions._def.inputs[0].parse(input)
      }).not.toThrow()
    })

    it('should use default values for optional fields', () => {
      const input = {}
      const parsed = enhancedTutorRouter._def.procedures.getPersonalizedSuggestions._def.inputs[0].parse(input)
      
      expect(parsed.maxSuggestions).toBe(10)
      expect(parsed.includeResearch).toBe(true)
    })
  })

  describe('submitSuggestionFeedback', () => {
    it('should validate feedback input', () => {
      const input = {
        suggestionId: 'test-suggestion-id',
        feedback: 'accepted' as const,
        satisfactionRating: 5,
      }

      expect(() => {
        enhancedTutorRouter._def.procedures.submitSuggestionFeedback._def.inputs[0].parse(input)
      }).not.toThrow()
    })

    it('should reject invalid feedback values', () => {
      const invalidInput = {
        suggestionId: 'test-suggestion-id',
        feedback: 'invalid-feedback',
      }

      expect(() => {
        enhancedTutorRouter._def.procedures.submitSuggestionFeedback._def.inputs[0].parse(invalidInput)
      }).toThrow()
    })
  })

  describe('optimizeAllDecks', () => {
    it('should validate optimization input', () => {
      const input = {
        optimizationGoals: ['budget', 'power'] as const,
        constraints: {
          totalBudget: 500,
          maintainStrategies: true,
          allowMajorChanges: false,
        },
      }

      expect(() => {
        enhancedTutorRouter._def.procedures.optimizeAllDecks._def.inputs[0].parse(input)
      }).not.toThrow()
    })
  })

  describe('getMarketIntelligence', () => {
    it('should validate market intelligence input', () => {
      const input = {
        cardIds: ['card-1', 'card-2'],
        analysisTypes: ['prices', 'trends'] as const,
        timeframe: '30d' as const,
        includeForecasts: true,
      }

      expect(() => {
        enhancedTutorRouter._def.procedures.getMarketIntelligence._def.inputs[0].parse(input)
      }).not.toThrow()
    })

    it('should use default timeframe', () => {
      const input = {
        cardIds: ['card-1'],
      }
      const parsed = enhancedTutorRouter._def.procedures.getMarketIntelligence._def.inputs[0].parse(input)
      
      expect(parsed.timeframe).toBe('30d')
      expect(parsed.includeForecasts).toBe(true)
    })
  })
})

describe('Enhanced Tutor Router Integration', () => {
  it('should export all required procedures', () => {
    const procedures = Object.keys(enhancedTutorRouter._def.procedures)
    
    expect(procedures).toContain('generateCompleteDeck')
    expect(procedures).toContain('analyzeDecksRealTime')
    expect(procedures).toContain('getPersonalizedSuggestions')
    expect(procedures).toContain('submitSuggestionFeedback')
    expect(procedures).toContain('optimizeAllDecks')
    expect(procedures).toContain('getMarketIntelligence')
    expect(procedures).toContain('getDeckGenerationProgress')
    expect(procedures).toContain('getUserLearningInsights')
    expect(procedures).toContain('getSystemPerformance')
  })

  it('should have correct procedure types', () => {
    const router = enhancedTutorRouter._def.procedures
    
    // Mutations
    expect(router.generateCompleteDeck._def._config.mutation).toBe(true)
    expect(router.submitSuggestionFeedback._def._config.mutation).toBe(true)
    expect(router.optimizeAllDecks._def._config.mutation).toBe(true)
    
    // Queries
    expect(router.getPersonalizedSuggestions._def._config.query).toBe(true)
    expect(router.getMarketIntelligence._def._config.query).toBe(true)
    expect(router.getDeckGenerationProgress._def._config.query).toBe(true)
    expect(router.getUserLearningInsights._def._config.query).toBe(true)
    expect(router.getSystemPerformance._def._config.query).toBe(true)
    
    // Subscriptions
    expect(router.analyzeDecksRealTime._def._config.subscription).toBe(true)
  })
})
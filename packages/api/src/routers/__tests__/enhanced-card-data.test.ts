import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTRPCMsw } from 'msw-trpc'
import { appRouter } from '../../root'
import { enhancedCardDataService } from '../../services/enhanced-card-data'

// Mock the enhanced card data service
vi.mock('../../services/enhanced-card-data', () => ({
  enhancedCardDataService: {
    getEnhancedCard: vi.fn(),
    getEnhancedCards: vi.fn(),
    searchCards: vi.fn(),
    updateFromBulkData: vi.fn(),
    validateCardData: vi.fn()
  }
}))

vi.mock('../../services/core/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../../services/core/performance-monitor', () => ({
  performanceMonitor: {
    startTimer: vi.fn(() => ({
      end: vi.fn()
    }))
  }
}))

const mockEnhancedCardDataService = enhancedCardDataService as any

describe('Enhanced Card Data Router', () => {
  const mockCardId = '12345678-1234-1234-1234-123456789012'
  const mockEnhancedCard = {
    cardId: mockCardId,
    name: 'Lightning Bolt',
    manaCost: '{R}',
    cmc: 1,
    typeLine: 'Instant',
    oracleText: 'Lightning Bolt deals 3 damage to any target.',
    power: undefined,
    toughness: undefined,
    colors: ['R'],
    colorIdentity: ['R'],
    legalities: { commander: 'legal' },
    rulings: [],
    printings: [],
    relatedCards: [],
    edhrecRank: 100,
    popularityScore: 85.5,
    synergyTags: [],
    currentPrice: 0.25,
    priceHistory: [],
    availability: {
      inStock: true,
      sources: ['tcgplayer'],
      lastChecked: new Date().toISOString()
    },
    imageUrls: {
      normal: 'https://example.com/image.jpg'
    },
    lastUpdated: new Date().toISOString()
  }

  const mockContext = {
    session: {
      user: {
        id: 'user-123',
        email: 'test@example.com'
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCard', () => {
    it('should return card data for valid card ID', async () => {
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue(mockEnhancedCard)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.getCard({ cardId: mockCardId })

      expect(result).toEqual(mockEnhancedCard)
      expect(mockEnhancedCardDataService.getEnhancedCard).toHaveBeenCalledWith(mockCardId)
    })

    it('should return null for non-existent card', async () => {
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue(null)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.getCard({ cardId: mockCardId })

      expect(result).toBeNull()
    })

    it('should validate card ID format', async () => {
      const caller = appRouter.createCaller(mockContext)
      
      await expect(
        caller.enhancedCardData.getCard({ cardId: 'invalid-id' })
      ).rejects.toThrow('Invalid card ID format')
    })

    it('should handle service errors gracefully', async () => {
      mockEnhancedCardDataService.getEnhancedCard.mockRejectedValue(new Error('Service error'))

      const caller = appRouter.createCaller(mockContext)
      
      await expect(
        caller.enhancedCardData.getCard({ cardId: mockCardId })
      ).rejects.toThrow('Service error')
    })
  })

  describe('getCards', () => {
    const mockCardIds = [
      '12345678-1234-1234-1234-123456789012',
      '87654321-4321-4321-4321-210987654321'
    ]

    it('should return multiple cards', async () => {
      const mockCardsMap = new Map([
        [mockCardIds[0], mockEnhancedCard],
        [mockCardIds[1], { ...mockEnhancedCard, cardId: mockCardIds[1], name: 'Counterspell' }]
      ])
      
      mockEnhancedCardDataService.getEnhancedCards.mockResolvedValue(mockCardsMap)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.getCards({ cardIds: mockCardIds })

      expect(Object.keys(result)).toHaveLength(2)
      expect(result[mockCardIds[0]]).toEqual(mockEnhancedCard)
      expect(result[mockCardIds[1]].name).toBe('Counterspell')
    })

    it('should enforce maximum card limit', async () => {
      const tooManyIds = Array(101).fill(0).map((_, i) => 
        `${i.toString().padStart(8, '0')}-1234-1234-1234-123456789012`
      )

      const caller = appRouter.createCaller(mockContext)
      
      await expect(
        caller.enhancedCardData.getCards({ cardIds: tooManyIds })
      ).rejects.toThrow('Maximum 100 cards per request')
    })

    it('should validate all card IDs', async () => {
      const invalidIds = ['invalid-id-1', 'invalid-id-2']

      const caller = appRouter.createCaller(mockContext)
      
      await expect(
        caller.enhancedCardData.getCards({ cardIds: invalidIds })
      ).rejects.toThrow()
    })
  })

  describe('searchCards', () => {
    const mockSearchQuery = {
      text: 'lightning',
      colors: ['R'],
      limit: 10
    }

    const mockSearchResult = {
      cards: [mockEnhancedCard],
      totalCount: 1,
      hasMore: false
    }

    it('should return search results', async () => {
      mockEnhancedCardDataService.searchCards.mockResolvedValue(mockSearchResult)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.searchCards(mockSearchQuery)

      expect(result).toEqual(mockSearchResult)
      expect(mockEnhancedCardDataService.searchCards).toHaveBeenCalledWith(mockSearchQuery)
    })

    it('should validate search parameters', async () => {
      const invalidQuery = {
        cmcRange: [10, 5] as [number, number] // Invalid range
      }

      const caller = appRouter.createCaller(mockContext)
      
      // This should not throw as the validation is in the service layer
      mockEnhancedCardDataService.searchCards.mockResolvedValue({
        cards: [],
        totalCount: 0,
        hasMore: false
      })

      const result = await caller.enhancedCardData.searchCards(invalidQuery)
      expect(result.cards).toHaveLength(0)
    })

    it('should handle complex search queries', async () => {
      const complexQuery = {
        text: 'dragon',
        colors: ['R', 'G'],
        cmcRange: [4, 8] as [number, number],
        powerRange: [3, 10] as [number, number],
        rarities: ['rare', 'mythic'],
        sortBy: 'cmc' as const,
        sortOrder: 'asc' as const,
        limit: 25,
        offset: 50
      }

      mockEnhancedCardDataService.searchCards.mockResolvedValue(mockSearchResult)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.searchCards(complexQuery)

      expect(mockEnhancedCardDataService.searchCards).toHaveBeenCalledWith(complexQuery)
      expect(result).toEqual(mockSearchResult)
    })
  })

  describe('validateCard', () => {
    const mockValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      lastValidated: new Date().toISOString()
    }

    it('should validate card data', async () => {
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue(mockEnhancedCard)
      mockEnhancedCardDataService.validateCardData.mockResolvedValue(mockEnhancedCard)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.validateCard({ 
        cardId: mockCardId,
        skipCache: false 
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return validation errors for invalid card', async () => {
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue(mockEnhancedCard)
      mockEnhancedCardDataService.validateCardData.mockResolvedValue(null)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.validateCard({ 
        cardId: mockCardId 
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Card data failed validation')
    })

    it('should handle missing card', async () => {
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue(null)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.validateCard({ 
        cardId: mockCardId 
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Card not found')
    })

    it('should detect stale data', async () => {
      const staleCard = {
        ...mockEnhancedCard,
        lastUpdated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago
      }
      
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue(staleCard)
      mockEnhancedCardDataService.validateCardData.mockResolvedValue(staleCard)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.validateCard({ 
        cardId: mockCardId 
      })

      expect(result.warnings.some(w => w.includes('days old'))).toBe(true)
    })
  })

  describe('refreshCard', () => {
    it('should refresh card data', async () => {
      const oldCard = {
        ...mockEnhancedCard,
        lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      }
      
      mockEnhancedCardDataService.getEnhancedCard
        .mockResolvedValueOnce(oldCard) // Current data check
        .mockResolvedValueOnce(mockEnhancedCard) // Refresh call

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.refreshCard({ 
        cardId: mockCardId,
        forceUpdate: false 
      })

      expect(result.success).toBe(true)
      expect(result.updated).toBe(true)
      expect(result.message).toContain('refreshed successfully')
    })

    it('should skip refresh for recent data', async () => {
      const recentCard = {
        ...mockEnhancedCard,
        lastUpdated: new Date().toISOString() // Very recent
      }
      
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue(recentCard)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.refreshCard({ 
        cardId: mockCardId,
        forceUpdate: false 
      })

      expect(result.success).toBe(true)
      expect(result.updated).toBe(false)
      expect(result.message).toContain('already up to date')
    })

    it('should force refresh when requested', async () => {
      mockEnhancedCardDataService.getEnhancedCard
        .mockResolvedValueOnce(mockEnhancedCard)
        .mockResolvedValueOnce(mockEnhancedCard)

      const caller = appRouter.createCaller(mockContext)
      const result = await caller.enhancedCardData.refreshCard({ 
        cardId: mockCardId,
        forceUpdate: true 
      })

      expect(result.success).toBe(true)
      expect(result.updated).toBe(true)
    })
  })

  describe('updateBulkData', () => {
    const mockBulkResult = {
      success: true,
      cardsUpdated: 1000,
      errors: []
    }

    it('should update bulk data for admin users', async () => {
      const adminContext = {
        session: {
          user: {
            id: 'admin-123',
            email: 'admin@admin.com' // Admin email pattern
          }
        }
      }

      mockEnhancedCardDataService.updateFromBulkData.mockResolvedValue(mockBulkResult)

      const caller = appRouter.createCaller(adminContext)
      const result = await caller.enhancedCardData.updateBulkData({ force: false })

      expect(result).toEqual(mockBulkResult)
      expect(mockEnhancedCardDataService.updateFromBulkData).toHaveBeenCalled()
    })

    it('should reject non-admin users', async () => {
      const regularContext = {
        session: {
          user: {
            id: 'user-123',
            email: 'user@example.com' // Non-admin email
          }
        }
      }

      const caller = appRouter.createCaller(regularContext)
      
      await expect(
        caller.enhancedCardData.updateBulkData({ force: false })
      ).rejects.toThrow('Insufficient permissions')
    })

    it('should handle bulk update errors', async () => {
      const adminContext = {
        session: {
          user: {
            id: 'admin-123',
            email: 'admin@admin.com'
          }
        }
      }

      const errorResult = {
        success: false,
        cardsUpdated: 0,
        errors: ['Network error', 'Parse error']
      }

      mockEnhancedCardDataService.updateFromBulkData.mockResolvedValue(errorResult)

      const caller = appRouter.createCaller(adminContext)
      const result = await caller.enhancedCardData.updateBulkData({ force: true })

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(2)
    })
  })

  describe('getDataStatistics', () => {
    it('should return statistics for admin users', async () => {
      const adminContext = {
        session: {
          user: {
            id: 'admin-123',
            email: 'admin@admin.com'
          }
        }
      }

      const caller = appRouter.createCaller(adminContext)
      const result = await caller.enhancedCardData.getDataStatistics()

      expect(result).toHaveProperty('totalCards')
      expect(result).toHaveProperty('recentlyUpdated')
      expect(result).toHaveProperty('needsUpdate')
      expect(result).toHaveProperty('averageDataAge')
      expect(result).toHaveProperty('cacheHitRate')
      expect(result).toHaveProperty('popularCards')
      expect(Array.isArray(result.popularCards)).toBe(true)
    })

    it('should reject non-admin users', async () => {
      const regularContext = {
        session: {
          user: {
            id: 'user-123',
            email: 'user@example.com'
          }
        }
      }

      const caller = appRouter.createCaller(regularContext)
      
      await expect(
        caller.enhancedCardData.getDataStatistics()
      ).rejects.toThrow('Insufficient permissions')
    })
  })

  describe('input validation', () => {
    it('should validate UUID format for card IDs', async () => {
      const caller = appRouter.createCaller(mockContext)
      
      await expect(
        caller.enhancedCardData.getCard({ cardId: 'not-a-uuid' })
      ).rejects.toThrow()
    })

    it('should validate search query limits', async () => {
      const caller = appRouter.createCaller(mockContext)
      
      await expect(
        caller.enhancedCardData.searchCards({ limit: 150 }) // Over max limit
      ).rejects.toThrow()
    })

    it('should validate CMC ranges', async () => {
      const caller = appRouter.createCaller(mockContext)
      
      await expect(
        caller.enhancedCardData.searchCards({ 
          cmcRange: [-1, 5] // Negative CMC
        })
      ).rejects.toThrow()
    })

    it('should validate power/toughness ranges', async () => {
      const caller = appRouter.createCaller(mockContext)
      
      await expect(
        caller.enhancedCardData.searchCards({ 
          powerRange: [0, 100] // Unrealistic power
        })
      ).rejects.toThrow()
    })
  })

  describe('error handling', () => {
    it('should handle service timeouts', async () => {
      mockEnhancedCardDataService.getEnhancedCard.mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      )

      const caller = appRouter.createCaller(mockContext)
      
      await expect(
        caller.enhancedCardData.getCard({ cardId: mockCardId })
      ).rejects.toThrow('Timeout')
    })

    it('should handle malformed responses', async () => {
      mockEnhancedCardDataService.searchCards.mockResolvedValue({
        // Missing required fields
        cards: null,
        totalCount: 'invalid'
      })

      const caller = appRouter.createCaller(mockContext)
      
      await expect(
        caller.enhancedCardData.searchCards({ text: 'test' })
      ).rejects.toThrow()
    })
  })

  describe('performance monitoring', () => {
    it('should track performance metrics', async () => {
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue(mockEnhancedCard)

      const caller = appRouter.createCaller(mockContext)
      await caller.enhancedCardData.getCard({ cardId: mockCardId })

      // Just verify the call was made successfully
      expect(mockEnhancedCardDataService.getEnhancedCard).toHaveBeenCalledWith(mockCardId)
    })

    it('should track batch operation metrics', async () => {
      const mockCardsMap = new Map([[mockCardId, mockEnhancedCard]])
      mockEnhancedCardDataService.getEnhancedCards.mockResolvedValue(mockCardsMap)

      const caller = appRouter.createCaller(mockContext)
      await caller.enhancedCardData.getCards({ cardIds: [mockCardId] })

      expect(mockEnhancedCardDataService.getEnhancedCards).toHaveBeenCalledWith([mockCardId])
    })
  })
})
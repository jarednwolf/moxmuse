import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { appRouter } from '../../root'
import { cardSearchService } from '../../services/card-search'
import { db } from '@moxmuse/db'

// Mock dependencies
vi.mock('../../services/card-search')
vi.mock('@moxmuse/db')

const mockCardSearchService = vi.mocked(cardSearchService)
const mockDb = vi.mocked(db)

describe('cardSearchRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('searchCards', () => {
    it('should search cards successfully', async () => {
      const mockResults = {
        cards: [
          {
            id: 'card-1',
            name: 'Lightning Bolt',
            manaCost: '{R}',
            cmc: 1,
            typeLine: 'Instant',
            oracleText: 'Lightning Bolt deals 3 damage to any target.',
            colors: ['R'],
            colorIdentity: ['R'],
            legalities: { commander: 'legal' },
            rulings: [],
            printings: [],
            relatedCards: [],
            edhrecRank: 100,
            popularityScore: 95.5,
            synergyTags: ['burn'],
            currentPrice: 5.0,
            priceHistory: [],
            availability: {
              inStock: true,
              lowStock: false,
              sources: ['scryfall'],
              lastChecked: '2024-01-01T00:00:00Z'
            },
            lastUpdated: '2024-01-01T00:00:00Z',
            imageUrls: { normal: 'https://example.com/image.jpg' }
          }
        ],
        totalCount: 1,
        hasMore: false,
        searchTime: 150,
        suggestions: ['Try filtering by color']
      }

      mockCardSearchService.searchCards.mockResolvedValue(mockResults)

      const caller = appRouter.createCaller({
        session: null,
        db: mockDb
      })

      const result = await caller.cardSearch.searchCards({
        query: { text: 'Lightning Bolt' }
      })

      expect(result).toEqual(mockResults)
      expect(mockCardSearchService.searchCards).toHaveBeenCalledWith(
        { text: 'Lightning Bolt' },
        undefined,
        true
      )
    })

    it('should pass user ID when authenticated', async () => {
      const mockResults = {
        cards: [],
        totalCount: 0,
        hasMore: false,
        searchTime: 50
      }

      mockCardSearchService.searchCards.mockResolvedValue(mockResults)

      const caller = appRouter.createCaller({
        session: {
          user: { id: 'user-1', email: 'test@example.com' },
          expires: '2024-12-31'
        },
        db: mockDb
      })

      await caller.cardSearch.searchCards({
        query: { text: 'Lightning' }
      })

      expect(mockCardSearchService.searchCards).toHaveBeenCalledWith(
        { text: 'Lightning' },
        'user-1',
        true
      )
    })
  })

  describe('getSearchSuggestions', () => {
    it('should return search suggestions', async () => {
      const mockSuggestions = [
        {
          type: 'card' as const,
          value: 'Lightning Bolt',
          display: 'Lightning Bolt',
          description: 'Instant',
          popularity: 100
        }
      ]

      mockCardSearchService.getSearchSuggestions.mockResolvedValue(mockSuggestions)

      const caller = appRouter.createCaller({
        session: null,
        db: mockDb
      })

      const result = await caller.cardSearch.getSearchSuggestions({
        query: 'Lightning',
        limit: 5
      })

      expect(result).toEqual(mockSuggestions)
      expect(mockCardSearchService.getSearchSuggestions).toHaveBeenCalledWith(
        'Lightning',
        5,
        undefined
      )
    })

    it('should filter suggestions by type', async () => {
      const mockSuggestions = [
        {
          type: 'keyword' as const,
          value: 'Flying',
          display: 'Flying',
          description: 'Cards with Flying',
          popularity: 50
        }
      ]

      mockCardSearchService.getSearchSuggestions.mockResolvedValue(mockSuggestions)

      const caller = appRouter.createCaller({
        session: null,
        db: mockDb
      })

      await caller.cardSearch.getSearchSuggestions({
        query: 'fly',
        types: ['keyword']
      })

      expect(mockCardSearchService.getSearchSuggestions).toHaveBeenCalledWith(
        'fly',
        10,
        ['keyword']
      )
    })
  })

  describe('saveSearch', () => {
    it('should save search when authenticated', async () => {
      const mockSavedSearch = {
        id: 'search-1',
        userId: 'user-1',
        name: 'My Search',
        description: 'Test search',
        query: { text: 'Lightning' },
        isPublic: false,
        tags: ['burn'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        useCount: 0
      }

      mockCardSearchService.saveSearch.mockResolvedValue(mockSavedSearch)

      const caller = appRouter.createCaller({
        session: {
          user: { id: 'user-1', email: 'test@example.com' },
          expires: '2024-12-31'
        },
        db: mockDb
      })

      const result = await caller.cardSearch.saveSearch({
        name: 'My Search',
        description: 'Test search',
        query: { text: 'Lightning' },
        tags: ['burn']
      })

      expect(result).toEqual(mockSavedSearch)
      expect(mockCardSearchService.saveSearch).toHaveBeenCalledWith(
        'user-1',
        'My Search',
        'Test search',
        { text: 'Lightning' },
        false,
        ['burn']
      )
    })

    it('should require authentication', async () => {
      const caller = appRouter.createCaller({
        session: null,
        db: mockDb
      })

      await expect(
        caller.cardSearch.saveSearch({
          name: 'My Search',
          query: { text: 'Lightning' }
        })
      ).rejects.toThrow()
    })
  })

  describe('getSavedSearches', () => {
    it('should return user saved searches', async () => {
      const mockSavedSearches = [
        {
          id: 'search-1',
          userId: 'user-1',
          name: 'My Search',
          description: 'Test search',
          query: { text: 'Lightning' },
          isPublic: false,
          tags: ['burn'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          useCount: 0
        }
      ]

      mockCardSearchService.getSavedSearches.mockResolvedValue(mockSavedSearches)

      const caller = appRouter.createCaller({
        session: {
          user: { id: 'user-1', email: 'test@example.com' },
          expires: '2024-12-31'
        },
        db: mockDb
      })

      const result = await caller.cardSearch.getSavedSearches()

      expect(result).toEqual(mockSavedSearches)
      expect(mockCardSearchService.getSavedSearches).toHaveBeenCalledWith('user-1')
    })
  })

  describe('recordCardClick', () => {
    it('should record card click for analytics', async () => {
      mockDb.cardClick.create.mockResolvedValue({} as any)

      const caller = appRouter.createCaller({
        session: {
          user: { id: 'user-1', email: 'test@example.com' },
          expires: '2024-12-31'
        },
        db: mockDb
      })

      const result = await caller.cardSearch.recordCardClick({
        cardId: 'card-1',
        query: '{"text":"Lightning"}',
        position: 0
      })

      expect(result).toEqual({ success: true })
      expect(mockDb.cardClick.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          cardId: 'card-1',
          query: '{"text":"Lightning"}',
          position: 0,
          timestamp: expect.any(Date)
        }
      })
    })
  })

  describe('getPopularSearches', () => {
    it('should return popular public searches', async () => {
      const mockPopularSearches = [
        {
          id: 'search-1',
          name: 'Popular Search',
          description: 'A popular search',
          query: '{"text":"Lightning"}',
          tags: ['popular'],
          useCount: 100,
          createdAt: new Date()
        }
      ]

      mockDb.savedSearch.findMany.mockResolvedValue(mockPopularSearches)

      const caller = appRouter.createCaller({
        session: null,
        db: mockDb
      })

      const result = await caller.cardSearch.getPopularSearches({ limit: 5 })

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'search-1',
        name: 'Popular Search',
        query: { text: 'Lightning' }
      })

      expect(mockDb.savedSearch.findMany).toHaveBeenCalledWith({
        where: { isPublic: true },
        orderBy: { useCount: 'desc' },
        take: 5,
        select: expect.any(Object)
      })
    })
  })
})
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CardSearchService } from '../card-search'
import { scryfallService } from '../scryfall'
import { redisCache } from '../redis'
import { db } from '@moxmuse/db'

// Mock dependencies
vi.mock('../scryfall')
vi.mock('../redis')
vi.mock('@moxmuse/db', () => ({
  db: {
    enhancedCard: {
      findUnique: vi.fn()
    },
    searchHistory: {
      create: vi.fn(),
      findMany: vi.fn()
    },
    searchAnalytics: {
      create: vi.fn()
    },
    savedSearch: {
      create: vi.fn(),
      findMany: vi.fn()
    },
    cardClick: {
      create: vi.fn()
    }
  }
}))

const mockScryfallService = vi.mocked(scryfallService)
const mockRedisCache = vi.mocked(redisCache)
const mockDb = vi.mocked(db)

describe('CardSearchService', () => {
  let cardSearchService: CardSearchService

  beforeEach(() => {
    cardSearchService = new CardSearchService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('searchCards', () => {
    const mockScryfallCards = [
      {
        id: 'card-1',
        name: 'Lightning Bolt',
        mana_cost: '{R}',
        cmc: 1,
        type_line: 'Instant',
        oracle_text: 'Lightning Bolt deals 3 damage to any target.',
        colors: ['R'],
        color_identity: ['R'],
        keywords: [],
        set: 'lea',
        set_name: 'Limited Edition Alpha',
        collector_number: '161',
        rarity: 'common',
        prices: { usd: '5.00', usd_foil: null, eur: null, tix: null },
        legalities: { commander: 'legal', standard: 'not_legal' },
        image_uris: { normal: 'https://example.com/image.jpg' }
      }
    ]

    const mockEnhancedCard = {
      id: 'enhanced-1',
      scryfallId: 'card-1',
      name: 'Lightning Bolt',
      edhrecRank: 100,
      popularityScore: 95.5,
      synergyTags: ['burn', 'removal'],
      priceHistory: [],
      rulings: [],
      relatedCards: []
    }

    beforeEach(() => {
      mockRedisCache.get.mockResolvedValue(null)
      mockRedisCache.set.mockResolvedValue(undefined)
      mockScryfallService.search.mockResolvedValue(mockScryfallCards)
      mockDb.enhancedCard.findUnique.mockResolvedValue(mockEnhancedCard)
      mockDb.searchHistory.create.mockResolvedValue({} as any)
      mockDb.searchAnalytics.create.mockResolvedValue({} as any)
    })

    it('should search cards with basic text query', async () => {
      const query = { text: 'Lightning Bolt' }
      const userId = 'user-1'

      const result = await cardSearchService.searchCards(query, userId)

      expect(result).toMatchObject({
        cards: expect.arrayContaining([
          expect.objectContaining({
            id: 'card-1',
            name: 'Lightning Bolt',
            cmc: 1
          })
        ]),
        totalCount: 1,
        hasMore: false,
        searchTime: expect.any(Number)
      })

      expect(mockScryfallService.search).toHaveBeenCalledWith(
        'Lightning Bolt',
        { maxResults: 100 }
      )
    })

    it('should build complex Scryfall query with multiple filters', async () => {
      const query = {
        text: 'Lightning',
        colors: ['R'],
        cmcRange: [1, 3] as [number, number],
        rarities: ['common', 'uncommon'] as const,
        typeText: 'Instant'
      }

      await cardSearchService.searchCards(query)

      expect(mockScryfallService.search).toHaveBeenCalledWith(
        'Lightning c:R cmc>=1 cmc<=3 type:"Instant" (r:common OR r:uncommon)',
        { maxResults: 100 }
      )
    })

    it('should apply relevance ranking', async () => {
      const mockCards = [
        { ...mockScryfallCards[0], name: 'Lightning Strike', id: 'card-2' },
        { ...mockScryfallCards[0], name: 'Lightning Bolt', id: 'card-1' }
      ]
      
      mockScryfallService.search.mockResolvedValue(mockCards)
      mockDb.enhancedCard.findUnique.mockResolvedValue(null)

      const query = { text: 'Lightning Bolt' }
      const result = await cardSearchService.searchCards(query)

      // Lightning Bolt should rank higher due to exact name match
      expect(result.cards[0].name).toBe('Lightning Bolt')
    })

    it('should use cached results when available', async () => {
      const cachedResult = {
        cards: [],
        totalCount: 0,
        hasMore: false,
        searchTime: 50
      }
      
      mockRedisCache.get.mockResolvedValue(cachedResult)

      const query = { text: 'Lightning Bolt' }
      const result = await cardSearchService.searchCards(query)

      expect(result).toEqual(cachedResult)
      expect(mockScryfallService.search).not.toHaveBeenCalled()
    })

    it('should record search analytics and history', async () => {
      const query = { text: 'Lightning Bolt' }
      const userId = 'user-1'

      await cardSearchService.searchCards(query, userId)

      expect(mockDb.searchAnalytics.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          query: JSON.stringify(query),
          userId,
          resultCount: 1,
          searchTime: expect.any(Number)
        })
      })

      expect(mockDb.searchHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          query: JSON.stringify(query),
          resultCount: 1
        })
      })
    })

    it('should handle pagination correctly', async () => {
      const query = {
        text: 'Lightning',
        limit: 10,
        offset: 20
      }

      await cardSearchService.searchCards(query)

      expect(mockScryfallService.search).toHaveBeenCalledWith(
        'Lightning',
        { maxResults: 10 }
      )
    })

    it('should apply sorting', async () => {
      const mockCards = [
        { ...mockScryfallCards[0], name: 'Zebra', cmc: 3 },
        { ...mockScryfallCards[0], name: 'Alpha', cmc: 1 }
      ]
      
      mockScryfallService.search.mockResolvedValue(mockCards)
      mockDb.enhancedCard.findUnique.mockResolvedValue(null)

      const query = {
        text: 'test',
        sortBy: 'name' as const,
        sortOrder: 'asc' as const
      }

      const result = await cardSearchService.searchCards(query)

      expect(result.cards[0].name).toBe('Alpha')
      expect(result.cards[1].name).toBe('Zebra')
    })
  })

  describe('getSearchSuggestions', () => {
    beforeEach(() => {
      mockRedisCache.get.mockResolvedValue(null)
      mockRedisCache.set.mockResolvedValue(undefined)
    })

    it('should return card name suggestions', async () => {
      const mockCards = [
        {
          ...mockScryfallCards[0],
          name: 'Lightning Bolt',
          edhrec_rank: 100
        }
      ]
      
      mockScryfallService.search.mockResolvedValue(mockCards)

      const suggestions = await cardSearchService.getSearchSuggestions('Lightning', 5, ['card'])

      expect(suggestions).toEqual([
        expect.objectContaining({
          type: 'card',
          value: 'Lightning Bolt',
          display: 'Lightning Bolt',
          description: 'Instant'
        })
      ])
    })

    it('should return keyword suggestions', async () => {
      const suggestions = await cardSearchService.getSearchSuggestions('fly', 5, ['keyword'])

      expect(suggestions).toEqual([
        expect.objectContaining({
          type: 'keyword',
          value: 'Flying',
          display: 'Flying',
          description: 'Cards with Flying'
        })
      ])
    })

    it('should limit suggestions to specified limit', async () => {
      const suggestions = await cardSearchService.getSearchSuggestions('a', 3)

      expect(suggestions.length).toBeLessThanOrEqual(3)
    })

    it('should use cached suggestions when available', async () => {
      const cachedSuggestions = [
        {
          type: 'card' as const,
          value: 'Lightning Bolt',
          display: 'Lightning Bolt',
          description: 'Instant'
        }
      ]
      
      mockRedisCache.get.mockResolvedValue(cachedSuggestions)

      const suggestions = await cardSearchService.getSearchSuggestions('Lightning')

      expect(suggestions).toEqual(cachedSuggestions)
      expect(mockScryfallService.search).not.toHaveBeenCalled()
    })
  })

  describe('saveSearch', () => {
    it('should save a search with all parameters', async () => {
      const mockSavedSearch = {
        id: 'search-1',
        userId: 'user-1',
        name: 'My Search',
        description: 'Test search',
        query: '{"text":"Lightning"}',
        isPublic: false,
        tags: ['burn'],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsed: null,
        useCount: 0
      }

      mockDb.savedSearch.create.mockResolvedValue(mockSavedSearch)

      const result = await cardSearchService.saveSearch(
        'user-1',
        'My Search',
        'Test search',
        { text: 'Lightning' },
        false,
        ['burn']
      )

      expect(result).toMatchObject({
        id: 'search-1',
        name: 'My Search',
        description: 'Test search',
        query: { text: 'Lightning' },
        tags: ['burn']
      })

      expect(mockDb.savedSearch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'My Search',
          description: 'Test search',
          query: '{"text":"Lightning"}',
          isPublic: false,
          tags: ['burn']
        })
      })
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
          query: '{"text":"Lightning"}',
          isPublic: false,
          tags: ['burn'],
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsed: null,
          useCount: 0
        }
      ]

      mockDb.savedSearch.findMany.mockResolvedValue(mockSavedSearches)

      const result = await cardSearchService.getSavedSearches('user-1')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'search-1',
        name: 'My Search',
        query: { text: 'Lightning' }
      })

      expect(mockDb.savedSearch.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' }
      })
    })
  })

  describe('getSearchHistory', () => {
    it('should return user search history', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          userId: 'user-1',
          query: '{"text":"Lightning"}',
          resultCount: 5,
          timestamp: new Date()
        }
      ]

      mockDb.searchHistory.findMany.mockResolvedValue(mockHistory)

      const result = await cardSearchService.getSearchHistory('user-1', 10)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'history-1',
        query: { text: 'Lightning' },
        resultCount: 5
      })

      expect(mockDb.searchHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { timestamp: 'desc' },
        take: 10
      })
    })
  })
})
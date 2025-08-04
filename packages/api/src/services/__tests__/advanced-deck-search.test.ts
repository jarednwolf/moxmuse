import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@moxmuse/db'
import { AdvancedDeckSearchService } from '../advanced-deck-search'
import { DeckSearchQuery } from '@moxmuse/shared/deck-search-types'

// Mock Prisma client for testing
const mockPrisma = {
  deck: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn()
  },
  savedDeckSearch: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  deckSearchHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn()
  },
  $queryRaw: vi.fn()
} as unknown as PrismaClient

describe('AdvancedDeckSearchService', () => {
  let searchService: AdvancedDeckSearchService

  beforeEach(() => {
    searchService = new AdvancedDeckSearchService(mockPrisma)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('searchDecks', () => {
    it('should search decks with basic text query', async () => {
      const mockDecks = [
        {
          id: '1',
          name: 'Test Deck',
          description: 'A test deck',
          commander: 'Test Commander',
          format: 'commander',
          tags: ['test'],
          powerLevel: 7,
          budget: 100,
          isPublic: true,
          userId: 'user1',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { name: 'Test User', image: null },
          folderItems: [],
          cards: [],
          _count: { cards: 100 }
        }
      ]

      mockPrisma.deck.findMany.mockResolvedValue(mockDecks)
      mockPrisma.deck.count.mockResolvedValue(1)
      mockPrisma.deck.groupBy.mockResolvedValue([
        { format: 'commander', _count: 1 }
      ])
      mockPrisma.deck.aggregate.mockResolvedValue({
        _min: { powerLevel: 1, budget: 0 },
        _max: { powerLevel: 10, budget: 1000 }
      })
      mockPrisma.$queryRaw.mockResolvedValue([
        { tag: 'test', count: BigInt(1) }
      ])

      const query: DeckSearchQuery = {
        text: 'test',
        limit: 20,
        offset: 0
      }

      const result = await searchService.searchDecks(query, 'user1')

      expect(result.decks).toHaveLength(1)
      expect(result.totalCount).toBe(1)
      expect(result.decks[0].name).toBe('Test Deck')
      expect(mockPrisma.deck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { name: { contains: 'test', mode: 'insensitive' } },
                  { description: { contains: 'test', mode: 'insensitive' } },
                  { commander: { contains: 'test', mode: 'insensitive' } },
                  { tags: { hasSome: ['test'] } }
                ])
              })
            ])
          })
        })
      )
    })

    it('should filter by format', async () => {
      mockPrisma.deck.findMany.mockResolvedValue([])
      mockPrisma.deck.count.mockResolvedValue(0)
      mockPrisma.deck.groupBy.mockResolvedValue([])
      mockPrisma.deck.aggregate.mockResolvedValue({
        _min: { powerLevel: null, budget: null },
        _max: { powerLevel: null, budget: null }
      })
      mockPrisma.$queryRaw.mockResolvedValue([])

      const query: DeckSearchQuery = {
        formats: ['commander', 'legacy']
      }

      await searchService.searchDecks(query, 'user1')

      expect(mockPrisma.deck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { format: { in: ['commander', 'legacy'] } }
            ])
          })
        })
      )
    })

    it('should filter by power level range', async () => {
      mockPrisma.deck.findMany.mockResolvedValue([])
      mockPrisma.deck.count.mockResolvedValue(0)
      mockPrisma.deck.groupBy.mockResolvedValue([])
      mockPrisma.deck.aggregate.mockResolvedValue({
        _min: { powerLevel: null, budget: null },
        _max: { powerLevel: null, budget: null }
      })
      mockPrisma.$queryRaw.mockResolvedValue([])

      const query: DeckSearchQuery = {
        powerLevelRange: [6, 8]
      }

      await searchService.searchDecks(query, 'user1')

      expect(mockPrisma.deck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                powerLevel: {
                  gte: 6,
                  lte: 8
                }
              }
            ])
          })
        })
      )
    })

    it('should filter by budget range', async () => {
      mockPrisma.deck.findMany.mockResolvedValue([])
      mockPrisma.deck.count.mockResolvedValue(0)
      mockPrisma.deck.groupBy.mockResolvedValue([])
      mockPrisma.deck.aggregate.mockResolvedValue({
        _min: { powerLevel: null, budget: null },
        _max: { powerLevel: null, budget: null }
      })
      mockPrisma.$queryRaw.mockResolvedValue([])

      const query: DeckSearchQuery = {
        budgetRange: [50, 200]
      }

      await searchService.searchDecks(query, 'user1')

      expect(mockPrisma.deck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                budget: {
                  gte: 50,
                  lte: 200
                }
              }
            ])
          })
        })
      )
    })

    it('should sort results correctly', async () => {
      mockPrisma.deck.findMany.mockResolvedValue([])
      mockPrisma.deck.count.mockResolvedValue(0)
      mockPrisma.deck.groupBy.mockResolvedValue([])
      mockPrisma.deck.aggregate.mockResolvedValue({
        _min: { powerLevel: null, budget: null },
        _max: { powerLevel: null, budget: null }
      })
      mockPrisma.$queryRaw.mockResolvedValue([])

      const query: DeckSearchQuery = {
        sortBy: 'name',
        sortOrder: 'asc'
      }

      await searchService.searchDecks(query, 'user1')

      expect(mockPrisma.deck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' }
        })
      )
    })

    it('should handle pagination', async () => {
      mockPrisma.deck.findMany.mockResolvedValue([])
      mockPrisma.deck.count.mockResolvedValue(0)
      mockPrisma.deck.groupBy.mockResolvedValue([])
      mockPrisma.deck.aggregate.mockResolvedValue({
        _min: { powerLevel: null, budget: null },
        _max: { powerLevel: null, budget: null }
      })
      mockPrisma.$queryRaw.mockResolvedValue([])

      const query: DeckSearchQuery = {
        limit: 10,
        offset: 20
      }

      await searchService.searchDecks(query, 'user1')

      expect(mockPrisma.deck.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20
        })
      )
    })
  })

  describe('getAutocompleteSuggestions', () => {
    it('should return deck name suggestions', async () => {
      const mockDecks = [
        { name: 'Test Deck', commander: 'Test Commander' },
        { name: 'Another Test', commander: null }
      ]

      mockPrisma.deck.findMany
        .mockResolvedValueOnce(mockDecks) // First call for deck names
        .mockResolvedValueOnce([{ tags: [] }]) // Second call for tags
      
      mockPrisma.savedDeckSearch.findMany.mockResolvedValue([])

      const result = await searchService.getAutocompleteSuggestions('test', 'user1')

      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'deck',
            value: 'Test Deck',
            label: 'Test Deck'
          }),
          expect.objectContaining({
            type: 'commander',
            value: 'Test Commander',
            label: 'Test Commander'
          })
        ])
      )
    })

    it('should return tag suggestions', async () => {
      const mockDecks = [
        { tags: ['test-tag', 'another-tag'] }
      ]

      mockPrisma.deck.findMany
        .mockResolvedValueOnce([]) // First call for deck names
        .mockResolvedValueOnce(mockDecks) // Second call for tags
      
      mockPrisma.savedDeckSearch.findMany.mockResolvedValue([])

      const result = await searchService.getAutocompleteSuggestions('test', 'user1')

      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'tag',
            value: 'test-tag',
            label: '#test-tag'
          })
        ])
      )
    })
  })

  describe('saveSearch', () => {
    it('should save a search query', async () => {
      const mockSavedSearch = {
        id: 'search1',
        userId: 'user1',
        name: 'My Search',
        query: { text: 'test' },
        isPublic: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockPrisma.savedDeckSearch.create.mockResolvedValue(mockSavedSearch)

      const query: DeckSearchQuery = { text: 'test' }
      const result = await searchService.saveSearch('user1', 'My Search', query, false)

      expect(result.name).toBe('My Search')
      expect(result.query).toEqual({ text: 'test' })
      expect(mockPrisma.savedDeckSearch.create).toHaveBeenCalledWith({
        data: {
          userId: 'user1',
          name: 'My Search',
          query: { text: 'test' },
          isPublic: false
        }
      })
    })
  })

  describe('getSavedSearches', () => {
    it('should return saved searches for user', async () => {
      const mockSearches = [
        {
          id: 'search1',
          userId: 'user1',
          name: 'My Search',
          query: { text: 'test' },
          isPublic: false,
          usageCount: 5,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockPrisma.savedDeckSearch.findMany.mockResolvedValue(mockSearches)

      const result = await searchService.getSavedSearches('user1')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('My Search')
      expect(mockPrisma.savedDeckSearch.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { userId: 'user1' },
            { isPublic: true }
          ]
        },
        orderBy: [
          { usageCount: 'desc' },
          { updatedAt: 'desc' }
        ]
      })
    })
  })
})
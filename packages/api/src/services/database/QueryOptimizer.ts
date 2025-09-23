import { PrismaClient } from '@moxmuse/db'
import { cacheService, CacheKeys } from '../cache/CacheService'

/**
 * Query optimization service with caching and performance monitoring
 */
export class QueryOptimizer {
  private prisma: PrismaClient
  private queryStats = new Map<string, { count: number; totalTime: number; avgTime: number }>()

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.setupQueryLogging()
  }

  /**
   * Optimized card search with full-text search and caching
   */
  async searchCards(params: {
    query?: string
    colors?: string[]
    colorIdentity?: string[]
    types?: string[]
    cmc?: { min?: number; max?: number }
    formats?: string[]
    limit?: number
    offset?: number
  }) {
    const cacheKey = CacheKeys.CARD_SEARCH(JSON.stringify(params))
    
    // Try cache first
    const cached = await cacheService.get(cacheKey)
    if (cached) {
      return cached
    }

    const startTime = Date.now()

    // Build optimized query
    const where: any = {}

    // Full-text search on name and oracle text
    if (params.query) {
      where.OR = [
        {
          name: {
            contains: params.query,
            mode: 'insensitive',
          },
        },
        {
          oracleText: {
            contains: params.query,
            mode: 'insensitive',
          },
        },
      ]
    }

    // Color filtering (uses GIN index)
    if (params.colors?.length) {
      where.colors = {
        hasEvery: params.colors,
      }
    }

    // Color identity filtering (uses GIN index)
    if (params.colorIdentity?.length) {
      where.colorIdentity = {
        hasEvery: params.colorIdentity,
      }
    }

    // Type filtering
    if (params.types?.length) {
      where.typeLine = {
        contains: params.types.join(' '),
        mode: 'insensitive',
      }
    }

    // CMC range filtering (uses B-tree index)
    if (params.cmc) {
      where.cmc = {}
      if (params.cmc.min !== undefined) {
        where.cmc.gte = params.cmc.min
      }
      if (params.cmc.max !== undefined) {
        where.cmc.lte = params.cmc.max
      }
    }

    // Format legality filtering
    if (params.formats?.length) {
      where.AND = params.formats.map(format => ({
        legalities: {
          path: [format],
          equals: 'legal',
        },
      }))
    }

    const result = await this.prisma.card.findMany({
      where,
      select: {
        id: true,
        name: true,
        manaCost: true,
        cmc: true,
        typeLine: true,
        oracleText: true,
        colors: true,
        colorIdentity: true,
        imageUris: true,
        prices: true,
        legalities: true,
      },
      orderBy: [
        { name: 'asc' },
      ],
      take: params.limit || 50,
      skip: params.offset || 0,
    })

    const queryTime = Date.now() - startTime
    this.recordQueryStats('searchCards', queryTime)

    // Cache results for 30 minutes
    await cacheService.set(cacheKey, result, { redisTtl: 1800 })

    return result
  }

  /**
   * Optimized deck retrieval with related data
   */
  async getDeckWithCards(deckId: string) {
    const cacheKey = CacheKeys.DECK_ANALYSIS(deckId)
    
    const cached = await cacheService.get(cacheKey)
    if (cached) {
      return cached
    }

    const startTime = Date.now()

    const deck = await this.prisma.generatedDeck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          include: {
            card: {
              select: {
                id: true,
                name: true,
                manaCost: true,
                cmc: true,
                typeLine: true,
                oracleText: true,
                colors: true,
                colorIdentity: true,
                imageUris: true,
                prices: true,
              },
            },
          },
          orderBy: [
            { category: 'asc' },
            { card: { cmc: 'asc' } },
            { card: { name: 'asc' } },
          ],
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const queryTime = Date.now() - startTime
    this.recordQueryStats('getDeckWithCards', queryTime)

    // Cache for 2 hours
    await cacheService.set(cacheKey, deck, { redisTtl: 7200 })

    return deck
  }

  /**
   * Optimized user deck listing with pagination
   */
  async getUserDecks(userId: string, params: {
    limit?: number
    offset?: number
    format?: string
    sortBy?: 'createdAt' | 'updatedAt' | 'name'
    sortOrder?: 'asc' | 'desc'
  } = {}) {
    const cacheKey = `user:decks:${userId}:${JSON.stringify(params)}`
    
    const cached = await cacheService.get(cacheKey)
    if (cached) {
      return cached
    }

    const startTime = Date.now()

    const where: any = { userId }
    if (params.format) {
      where.format = params.format
    }

    const orderBy: any = {}
    orderBy[params.sortBy || 'createdAt'] = params.sortOrder || 'desc'

    const [decks, total] = await Promise.all([
      this.prisma.generatedDeck.findMany({
        where,
        select: {
          id: true,
          name: true,
          commander: true,
          format: true,
          strategy: true,
          powerLevel: true,
          estimatedBudget: true,
          qualityScore: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              cards: true,
            },
          },
        },
        orderBy,
        take: params.limit || 20,
        skip: params.offset || 0,
      }),
      this.prisma.generatedDeck.count({ where }),
    ])

    const result = { decks, total }
    const queryTime = Date.now() - startTime
    this.recordQueryStats('getUserDecks', queryTime)

    // Cache for 10 minutes
    await cacheService.set(cacheKey, result, { redisTtl: 600 })

    return result
  }

  /**
   * Optimized card legality check with caching
   */
  async getCardLegality(cardId: string, format: string) {
    const cacheKey = CacheKeys.FORMAT_LEGALITY(cardId, format)
    
    const cached = await cacheService.get(cacheKey)
    if (cached !== null) {
      return cached
    }

    const startTime = Date.now()

    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: {
        legalities: true,
      },
    })

    const isLegal = card?.legalities?.[format as keyof typeof card.legalities] === 'legal'
    
    const queryTime = Date.now() - startTime
    this.recordQueryStats('getCardLegality', queryTime)

    // Cache for 24 hours (legality doesn't change often)
    await cacheService.set(cacheKey, isLegal, { redisTtl: 86400 })

    return isLegal
  }

  /**
   * Batch card retrieval with optimized query
   */
  async getCardsBatch(cardIds: string[]) {
    const cacheKey = `cards:batch:${cardIds.sort().join(',')}`
    
    const cached = await cacheService.get(cacheKey)
    if (cached) {
      return cached
    }

    const startTime = Date.now()

    // Use IN query which is optimized with primary key index
    const cards = await this.prisma.card.findMany({
      where: {
        id: {
          in: cardIds,
        },
      },
      select: {
        id: true,
        name: true,
        manaCost: true,
        cmc: true,
        typeLine: true,
        oracleText: true,
        colors: true,
        colorIdentity: true,
        imageUris: true,
        prices: true,
        legalities: true,
      },
    })

    const queryTime = Date.now() - startTime
    this.recordQueryStats('getCardsBatch', queryTime)

    // Cache for 1 hour
    await cacheService.set(cacheKey, cards, { redisTtl: 3600 })

    return cards
  }

  /**
   * Optimized commander suggestions based on colors and strategy
   */
  async getCommanderSuggestions(params: {
    colors?: string[]
    strategy?: string
    powerLevel?: number
    limit?: number
  }) {
    const cacheKey = `commanders:${JSON.stringify(params)}`
    
    const cached = await cacheService.get(cacheKey)
    if (cached) {
      return cached
    }

    const startTime = Date.now()

    const where: any = {
      typeLine: {
        contains: 'Legendary Creature',
        mode: 'insensitive',
      },
    }

    // Color identity filtering
    if (params.colors?.length) {
      where.colorIdentity = {
        hasEvery: params.colors,
        hasOnly: params.colors, // Exact color identity match
      }
    }

    const commanders = await this.prisma.card.findMany({
      where,
      select: {
        id: true,
        name: true,
        manaCost: true,
        cmc: true,
        typeLine: true,
        oracleText: true,
        colors: true,
        colorIdentity: true,
        imageUris: true,
        prices: true,
      },
      orderBy: [
        { name: 'asc' },
      ],
      take: params.limit || 20,
    })

    const queryTime = Date.now() - startTime
    this.recordQueryStats('getCommanderSuggestions', queryTime)

    // Cache for 4 hours
    await cacheService.set(cacheKey, commanders, { redisTtl: 14400 })

    return commanders
  }

  /**
   * Get query performance statistics
   */
  getQueryStats() {
    const stats = Array.from(this.queryStats.entries()).map(([query, data]) => ({
      query,
      ...data,
    }))

    return stats.sort((a, b) => b.avgTime - a.avgTime)
  }

  /**
   * Clear query statistics
   */
  clearQueryStats() {
    this.queryStats.clear()
  }

  private recordQueryStats(queryName: string, executionTime: number) {
    const existing = this.queryStats.get(queryName) || { count: 0, totalTime: 0, avgTime: 0 }
    
    existing.count++
    existing.totalTime += executionTime
    existing.avgTime = existing.totalTime / existing.count

    this.queryStats.set(queryName, existing)

    // Log slow queries
    if (executionTime > 1000) {
      console.warn(`Slow query detected: ${queryName} took ${executionTime}ms`)
    }
  }

  private setupQueryLogging() {
    // Add Prisma middleware for query logging
    this.prisma.$use(async (params, next) => {
      const before = Date.now()
      const result = await next(params)
      const after = Date.now()

      const queryTime = after - before
      const queryName = `${params.model}.${params.action}`
      
      this.recordQueryStats(queryName, queryTime)

      return result
    })
  }
}

// Export singleton instance
export const queryOptimizer = new QueryOptimizer(new PrismaClient())
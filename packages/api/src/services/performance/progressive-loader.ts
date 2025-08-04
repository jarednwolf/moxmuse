import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { redisCache } from '../redis'

interface ProgressiveLoadOptions {
  pageSize: number
  sortBy?: 'name' | 'cmc' | 'type' | 'category' | 'price'
  sortOrder?: 'asc' | 'desc'
  filters?: {
    category?: string
    cmcRange?: [number, number]
    colors?: string[]
    types?: string[]
    priceRange?: [number, number]
  }
  includeCardData?: boolean
  includePricing?: boolean
  includeAnalysis?: boolean
}

interface ProgressiveLoadResult<T> {
  items: T[]
  totalCount: number
  hasMore: boolean
  nextCursor?: string
  loadTime: number
  cacheHit: boolean
}

interface DeckCardSummary {
  cardId: string
  name: string
  quantity: number
  category: string
  cmc?: number
  colors?: string[]
  type?: string
  imageUrl?: string
  price?: number
}

interface CollectionSummary {
  cardId: string
  name: string
  quantity: number
  condition: string
  foil: boolean
  set: string
  imageUrl?: string
  price?: number
}

export class ProgressiveLoaderService {
  private readonly DEFAULT_PAGE_SIZE = 50
  private readonly MAX_PAGE_SIZE = 200
  private readonly CACHE_TTL = 60 * 5 // 5 minutes

  constructor(private prisma: PrismaClient) {}

  /**
   * Load deck cards progressively with virtualization support
   */
  async loadDeckCards(
    deckId: string,
    cursor?: string,
    options: ProgressiveLoadOptions = { pageSize: this.DEFAULT_PAGE_SIZE }
  ): Promise<ProgressiveLoadResult<DeckCardSummary>> {
    const startTime = Date.now()
    const pageSize = Math.min(options.pageSize, this.MAX_PAGE_SIZE)
    
    try {
      // Check cache first
      const cacheKey = `deck:cards:${deckId}:${cursor || 'start'}:${JSON.stringify(options)}`
      const cached = await redisCache.get<ProgressiveLoadResult<DeckCardSummary>>(cacheKey)
      
      if (cached) {
        return {
          ...cached,
          loadTime: Date.now() - startTime,
          cacheHit: true
        }
      }

      // Build query conditions
      const whereConditions: any = { deckId }
      
      if (options.filters) {
        if (options.filters.category) {
          whereConditions.category = options.filters.category
        }
        
        if (options.filters.cmcRange) {
          whereConditions.card = {
            cmc: {
              gte: options.filters.cmcRange[0],
              lte: options.filters.cmcRange[1]
            }
          }
        }
        
        if (options.filters.colors && options.filters.colors.length > 0) {
          whereConditions.card = {
            ...whereConditions.card,
            color_identity: {
              hasSome: options.filters.colors
            }
          }
        }
        
        if (options.filters.types && options.filters.types.length > 0) {
          whereConditions.card = {
            ...whereConditions.card,
            type_line: {
              contains: options.filters.types[0], // Simplified - would need more complex logic for multiple types
              mode: 'insensitive'
            }
          }
        }
      }

      // Handle cursor-based pagination
      const cursorCondition = cursor ? { id: { gt: cursor } } : {}

      // Get total count for pagination info
      const totalCount = await this.prisma.deckCard.count({
        where: whereConditions
      })

      // Build order by clause
      const orderBy = this.buildOrderByClause(options.sortBy, options.sortOrder)

      // Fetch cards with related data
      const deckCards = await this.prisma.deckCard.findMany({
        where: {
          ...whereConditions,
          ...cursorCondition
        },
        include: {
          card: options.includeCardData ? {
            select: {
              id: true,
              name: true,
              cmc: true,
              type_line: true,
              color_identity: true,
              image_uris: true,
              prices: options.includePricing
            }
          } : false
        },
        orderBy,
        take: pageSize + 1 // Take one extra to determine if there are more
      })

      // Process results
      const hasMore = deckCards.length > pageSize
      const items = deckCards.slice(0, pageSize)
      const nextCursor = hasMore ? items[items.length - 1].id : undefined

      // Transform to summary format
      const cardSummaries: DeckCardSummary[] = await Promise.all(
        items.map(async (deckCard) => {
          const summary: DeckCardSummary = {
            cardId: deckCard.cardId,
            name: deckCard.card?.name || 'Unknown Card',
            quantity: deckCard.quantity,
            category: deckCard.category || 'Other'
          }

          if (options.includeCardData && deckCard.card) {
            summary.cmc = deckCard.card.cmc
            summary.colors = deckCard.card.color_identity
            summary.type = deckCard.card.type_line
            summary.imageUrl = deckCard.card.image_uris?.small
          }

          if (options.includePricing && deckCard.card?.prices) {
            summary.price = parseFloat(deckCard.card.prices.usd || '0')
          }

          return summary
        })
      )

      const result: ProgressiveLoadResult<DeckCardSummary> = {
        items: cardSummaries,
        totalCount,
        hasMore,
        nextCursor,
        loadTime: Date.now() - startTime,
        cacheHit: false
      }

      // Cache the result
      await redisCache.set(cacheKey, result, this.CACHE_TTL)

      return result
    } catch (error) {
      console.error(`Error loading deck cards for ${deckId}:`, error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load deck cards'
      })
    }
  }

  /**
   * Load collection cards progressively
   */
  async loadCollectionCards(
    userId: string,
    cursor?: string,
    options: ProgressiveLoadOptions = { pageSize: this.DEFAULT_PAGE_SIZE }
  ): Promise<ProgressiveLoadResult<CollectionSummary>> {
    const startTime = Date.now()
    const pageSize = Math.min(options.pageSize, this.MAX_PAGE_SIZE)
    
    try {
      // Check cache first
      const cacheKey = `collection:cards:${userId}:${cursor || 'start'}:${JSON.stringify(options)}`
      const cached = await redisCache.get<ProgressiveLoadResult<CollectionSummary>>(cacheKey)
      
      if (cached) {
        return {
          ...cached,
          loadTime: Date.now() - startTime,
          cacheHit: true
        }
      }

      // Build query conditions
      const whereConditions: any = { userId }
      
      if (options.filters) {
        if (options.filters.cmcRange) {
          whereConditions.card = {
            cmc: {
              gte: options.filters.cmcRange[0],
              lte: options.filters.cmcRange[1]
            }
          }
        }
        
        if (options.filters.colors && options.filters.colors.length > 0) {
          whereConditions.card = {
            ...whereConditions.card,
            color_identity: {
              hasSome: options.filters.colors
            }
          }
        }
        
        if (options.filters.priceRange) {
          // This would need to be implemented based on your collection schema
          // For now, we'll skip price filtering on collections
        }
      }

      // Handle cursor-based pagination
      const cursorCondition = cursor ? { id: { gt: cursor } } : {}

      // Get total count
      const totalCount = await this.prisma.collectionCard.count({
        where: whereConditions
      })

      // Build order by clause
      const orderBy = this.buildCollectionOrderByClause(options.sortBy, options.sortOrder)

      // Fetch collection cards
      const collectionCards = await this.prisma.collectionCard.findMany({
        where: {
          ...whereConditions,
          ...cursorCondition
        },
        include: {
          card: options.includeCardData ? {
            select: {
              id: true,
              name: true,
              cmc: true,
              type_line: true,
              color_identity: true,
              image_uris: true,
              prices: options.includePricing,
              set: true
            }
          } : false
        },
        orderBy,
        take: pageSize + 1
      })

      // Process results
      const hasMore = collectionCards.length > pageSize
      const items = collectionCards.slice(0, pageSize)
      const nextCursor = hasMore ? items[items.length - 1].id : undefined

      // Transform to summary format
      const collectionSummaries: CollectionSummary[] = items.map((collectionCard) => {
        const summary: CollectionSummary = {
          cardId: collectionCard.cardId,
          name: collectionCard.card?.name || 'Unknown Card',
          quantity: collectionCard.quantity,
          condition: collectionCard.condition || 'NM',
          foil: collectionCard.foil || false,
          set: collectionCard.card?.set || 'unknown'
        }

        if (options.includeCardData && collectionCard.card) {
          summary.imageUrl = collectionCard.card.image_uris?.small
        }

        if (options.includePricing && collectionCard.card?.prices) {
          summary.price = parseFloat(collectionCard.card.prices.usd || '0')
        }

        return summary
      })

      const result: ProgressiveLoadResult<CollectionSummary> = {
        items: collectionSummaries,
        totalCount,
        hasMore,
        nextCursor,
        loadTime: Date.now() - startTime,
        cacheHit: false
      }

      // Cache the result
      await redisCache.set(cacheKey, result, this.CACHE_TTL)

      return result
    } catch (error) {
      console.error(`Error loading collection cards for ${userId}:`, error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load collection cards'
      })
    }
  }

  /**
   * Preload next batch of items for smooth scrolling
   */
  async preloadNextBatch(
    type: 'deck' | 'collection',
    id: string,
    currentCursor: string,
    options: ProgressiveLoadOptions
  ): Promise<void> {
    try {
      // Load next batch in background and cache it
      if (type === 'deck') {
        await this.loadDeckCards(id, currentCursor, options)
      } else {
        await this.loadCollectionCards(id, currentCursor, options)
      }
    } catch (error) {
      // Preloading failures should not affect the main flow
      console.warn(`Failed to preload next batch for ${type} ${id}:`, error)
    }
  }

  /**
   * Get loading statistics for performance monitoring
   */
  async getLoadingStats(
    type: 'deck' | 'collection',
    id: string,
    timeframe: 'hour' | 'day' | 'week' = 'hour'
  ): Promise<{
    totalRequests: number
    averageLoadTime: number
    cacheHitRate: number
    errorRate: number
  }> {
    try {
      // This would be implemented with proper metrics collection
      // For now, return mock data
      return {
        totalRequests: 100,
        averageLoadTime: 150, // ms
        cacheHitRate: 0.75,
        errorRate: 0.02
      }
    } catch (error) {
      console.error('Error getting loading stats:', error)
      return {
        totalRequests: 0,
        averageLoadTime: 0,
        cacheHitRate: 0,
        errorRate: 1
      }
    }
  }

  /**
   * Invalidate cache for specific deck or collection
   */
  async invalidateCache(type: 'deck' | 'collection', id: string): Promise<void> {
    try {
      const pattern = `${type}:cards:${id}:*`
      await redisCache.deletePattern(pattern)
    } catch (error) {
      console.error(`Error invalidating cache for ${type} ${id}:`, error)
    }
  }

  /**
   * Batch load multiple items efficiently
   */
  async batchLoad<T>(
    loadFunction: (id: string) => Promise<T>,
    ids: string[],
    concurrency: number = 5
  ): Promise<Map<string, T | Error>> {
    const results = new Map<string, T | Error>()
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < ids.length; i += concurrency) {
      const batch = ids.slice(i, i + concurrency)
      
      const batchPromises = batch.map(async (id) => {
        try {
          const result = await loadFunction(id)
          return { id, result, error: null }
        } catch (error) {
          return { id, result: null, error: error as Error }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      
      for (const { id, result, error } of batchResults) {
        if (error) {
          results.set(id, error)
        } else if (result) {
          results.set(id, result)
        }
      }
    }
    
    return results
  }

  /**
   * Helper methods
   */
  private buildOrderByClause(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'asc'
  ): any {
    switch (sortBy) {
      case 'name':
        return { card: { name: sortOrder } }
      case 'cmc':
        return { card: { cmc: sortOrder } }
      case 'type':
        return { card: { type_line: sortOrder } }
      case 'category':
        return { category: sortOrder }
      case 'price':
        return { card: { prices: { usd: sortOrder } } }
      default:
        return { card: { name: 'asc' } }
    }
  }

  private buildCollectionOrderByClause(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'asc'
  ): any {
    switch (sortBy) {
      case 'name':
        return { card: { name: sortOrder } }
      case 'cmc':
        return { card: { cmc: sortOrder } }
      case 'type':
        return { card: { type_line: sortOrder } }
      case 'price':
        return { card: { prices: { usd: sortOrder } } }
      default:
        return { card: { name: 'asc' } }
    }
  }

  /**
   * Optimize query performance with database hints
   */
  private async optimizeQuery(query: any): Promise<any> {
    // Add database-specific optimizations
    // This would depend on your specific database setup
    return query
  }

  /**
   * Monitor and log performance metrics
   */
  private async logPerformanceMetrics(
    operation: string,
    duration: number,
    itemCount: number,
    cacheHit: boolean
  ): Promise<void> {
    try {
      // This would integrate with your monitoring system
      console.log(`Performance: ${operation} took ${duration}ms for ${itemCount} items (cache: ${cacheHit ? 'hit' : 'miss'})`)
      
      // Store metrics for analysis
      await redisCache.set(
        `metrics:${operation}:${Date.now()}`,
        { duration, itemCount, cacheHit },
        60 * 60 // 1 hour TTL
      )
    } catch (error) {
      // Don't let metrics logging affect the main operation
      console.warn('Failed to log performance metrics:', error)
    }
  }
}
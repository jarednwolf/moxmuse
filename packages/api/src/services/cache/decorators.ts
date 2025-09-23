import { cacheService, CacheKeys } from './CacheService'
import { z } from 'zod'

/**
 * Cache decorator for methods
 */
export function Cached(options: {
  keyGenerator: (...args: any[]) => string
  ttl?: number
  schema?: z.ZodSchema
  tags?: string[]
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cacheKey = options.keyGenerator(...args)
      
      // Try to get from cache first
      const cached = await cacheService.get(cacheKey, options.schema)
      if (cached !== null) {
        return cached
      }

      // Execute original method
      const result = await method.apply(this, args)
      
      // Cache the result
      await cacheService.set(cacheKey, result, {
        redisTtl: options.ttl,
        tags: options.tags,
      })

      return result
    }

    return descriptor
  }
}

/**
 * Cache invalidation decorator
 */
export function InvalidateCache(options: {
  patterns?: string[]
  tags?: string[]
  keys?: ((...args: any[]) => string)[]
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args)

      // Invalidate by patterns
      if (options.patterns) {
        await Promise.all(
          options.patterns.map(pattern => cacheService.deletePattern(pattern))
        )
      }

      // Invalidate by tags
      if (options.tags) {
        cacheService.deleteByTags(options.tags)
      }

      // Invalidate specific keys
      if (options.keys) {
        await Promise.all(
          options.keys.map(keyGen => cacheService.delete(keyGen(...args)))
        )
      }

      return result
    }

    return descriptor
  }
}

/**
 * Utility functions for common caching patterns
 */
export class CacheUtils {
  /**
   * Cache with automatic key generation for card data
   */
  static async cacheCardData<T>(
    cardId: string,
    fetcher: () => Promise<T>,
    ttl = 3600 // 1 hour
  ): Promise<T> {
    const key = CacheKeys.CARD_DATA(cardId)
    
    const cached = await cacheService.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const data = await fetcher()
    await cacheService.set(key, data, { redisTtl: ttl, tags: ['cards'] })
    
    return data
  }

  /**
   * Cache search results with query-based keys
   */
  static async cacheSearchResults<T>(
    query: string,
    fetcher: () => Promise<T>,
    ttl = 1800 // 30 minutes
  ): Promise<T> {
    const key = CacheKeys.CARD_SEARCH(query)
    
    const cached = await cacheService.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const results = await fetcher()
    await cacheService.set(key, results, { redisTtl: ttl, tags: ['search'] })
    
    return results
  }

  /**
   * Cache deck analysis with deck-based keys
   */
  static async cacheDeckAnalysis<T>(
    deckId: string,
    fetcher: () => Promise<T>,
    ttl = 7200 // 2 hours
  ): Promise<T> {
    const key = CacheKeys.DECK_ANALYSIS(deckId)
    
    const cached = await cacheService.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const analysis = await fetcher()
    await cacheService.set(key, analysis, { redisTtl: ttl, tags: ['decks', 'analysis'] })
    
    return analysis
  }

  /**
   * Cache user session data
   */
  static async cacheSession<T>(
    sessionId: string,
    data: T,
    ttl = 1800 // 30 minutes
  ): Promise<void> {
    const key = CacheKeys.CONSULTATION_SESSION(sessionId)
    await cacheService.set(key, data, { 
      redisTtl: ttl, 
      memoryTtl: 5 * 60 * 1000, // 5 minutes in memory
      tags: ['sessions'] 
    })
  }

  /**
   * Get cached session data
   */
  static async getSession<T>(sessionId: string): Promise<T | null> {
    const key = CacheKeys.CONSULTATION_SESSION(sessionId)
    return cacheService.get<T>(key)
  }

  /**
   * Invalidate all card-related caches
   */
  static async invalidateCardCaches(): Promise<void> {
    await Promise.all([
      cacheService.deletePattern('card:*'),
      cacheService.deletePattern('search:*'),
      cacheService.deletePattern('legality:*'),
      cacheService.deletePattern('price:*'),
    ])
    
    cacheService.deleteByTags(['cards', 'search'])
  }

  /**
   * Invalidate deck-related caches
   */
  static async invalidateDeckCaches(deckId?: string): Promise<void> {
    if (deckId) {
      await cacheService.delete(CacheKeys.DECK_ANALYSIS(deckId))
    } else {
      await cacheService.deletePattern('deck:*')
      cacheService.deleteByTags(['decks', 'analysis'])
    }
  }

  /**
   * Warm up frequently accessed data
   */
  static async warmUpCache(): Promise<void> {
    // This would be called on application startup
    // to pre-populate cache with frequently accessed data
    console.log('Cache warm-up initiated')
    
    // Example: Pre-load popular commanders, format data, etc.
    // Implementation would depend on specific data patterns
  }
}

/**
 * Cache middleware for tRPC procedures
 */
export function createCacheMiddleware<T>(options: {
  keyGenerator: (input: T) => string
  ttl?: number
  schema?: z.ZodSchema
}) {
  return async (opts: { input: T; next: () => Promise<any> }) => {
    const cacheKey = options.keyGenerator(opts.input)
    
    // Try cache first
    const cached = await cacheService.get(cacheKey, options.schema)
    if (cached !== null) {
      return cached
    }

    // Execute procedure
    const result = await opts.next()
    
    // Cache result
    await cacheService.set(cacheKey, result, { redisTtl: options.ttl })
    
    return result
  }
}
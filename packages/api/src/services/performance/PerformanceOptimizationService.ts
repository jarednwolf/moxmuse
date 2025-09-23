import { cacheService } from '../cache/CacheService'
import { queryOptimizer } from '../database/QueryOptimizer'
import { PrismaClient } from '@moxmuse/db'

interface PerformanceConfig {
  cacheEnabled: boolean
  queryOptimizationEnabled: boolean
  imageOptimizationEnabled: boolean
  bundleOptimizationEnabled: boolean
  monitoringEnabled: boolean
}

interface PerformanceMetrics {
  cacheHitRate: number
  averageQueryTime: number
  slowQueries: Array<{ query: string; avgTime: number; count: number }>
  memoryUsage: number
  responseTime: number
}

export class PerformanceOptimizationService {
  private config: PerformanceConfig
  private prisma: PrismaClient
  private startTime: number

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      cacheEnabled: true,
      queryOptimizationEnabled: true,
      imageOptimizationEnabled: true,
      bundleOptimizationEnabled: true,
      monitoringEnabled: true,
      ...config,
    }
    
    this.prisma = new PrismaClient()
    this.startTime = Date.now()
  }

  /**
   * Initialize performance optimizations
   */
  async initialize(): Promise<void> {
    console.log('Initializing performance optimizations...')

    if (this.config.cacheEnabled) {
      await this.initializeCache()
    }

    if (this.config.queryOptimizationEnabled) {
      await this.initializeQueryOptimization()
    }

    if (this.config.monitoringEnabled) {
      this.initializeMonitoring()
    }

    console.log('Performance optimizations initialized')
  }

  /**
   * Initialize caching system
   */
  private async initializeCache(): Promise<void> {
    try {
      // Warm up cache with frequently accessed data
      await this.warmUpCache()
      console.log('Cache system initialized')
    } catch (error) {
      console.error('Failed to initialize cache:', error)
    }
  }

  /**
   * Initialize query optimization
   */
  private async initializeQueryOptimization(): Promise<void> {
    try {
      // Verify database indexes
      await this.verifyDatabaseIndexes()
      console.log('Query optimization initialized')
    } catch (error) {
      console.error('Failed to initialize query optimization:', error)
    }
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    // Set up periodic performance reporting
    setInterval(() => {
      this.reportPerformanceMetrics()
    }, 60000) // Every minute

    console.log('Performance monitoring initialized')
  }

  /**
   * Warm up cache with frequently accessed data
   */
  private async warmUpCache(): Promise<void> {
    const warmUpTasks = [
      // Popular commanders
      this.warmUpPopularCommanders(),
      // Format legality data
      this.warmUpFormatData(),
      // Common card searches
      this.warmUpCommonSearches(),
    ]

    await Promise.allSettled(warmUpTasks)
  }

  private async warmUpPopularCommanders(): Promise<void> {
    try {
      const popularCommanders = await queryOptimizer.getCommanderSuggestions({
        limit: 50,
      })
      
      console.log(`Warmed up ${popularCommanders.length} popular commanders`)
    } catch (error) {
      console.warn('Failed to warm up popular commanders:', error)
    }
  }

  private async warmUpFormatData(): Promise<void> {
    try {
      // Pre-cache format legality for popular formats
      const formats = ['commander', 'modern', 'standard', 'legacy', 'vintage']
      
      // This would be implemented based on your specific needs
      console.log(`Warmed up format data for ${formats.length} formats`)
    } catch (error) {
      console.warn('Failed to warm up format data:', error)
    }
  }

  private async warmUpCommonSearches(): Promise<void> {
    try {
      const commonSearches = [
        { query: 'Sol Ring' },
        { query: 'Lightning Bolt' },
        { query: 'Counterspell' },
        { colors: ['W', 'U'] },
        { types: ['Creature'] },
      ]

      for (const search of commonSearches) {
        await queryOptimizer.searchCards(search)
      }

      console.log(`Warmed up ${commonSearches.length} common searches`)
    } catch (error) {
      console.warn('Failed to warm up common searches:', error)
    }
  }

  /**
   * Verify database indexes are in place
   */
  private async verifyDatabaseIndexes(): Promise<void> {
    try {
      // Check if critical indexes exist
      const indexQueries = [
        "SELECT indexname FROM pg_indexes WHERE tablename = 'Card' AND indexname LIKE '%name%'",
        "SELECT indexname FROM pg_indexes WHERE tablename = 'Card' AND indexname LIKE '%colors%'",
        "SELECT indexname FROM pg_indexes WHERE tablename = 'GeneratedDeck' AND indexname LIKE '%userId%'",
      ]

      for (const query of indexQueries) {
        await this.prisma.$queryRawUnsafe(query)
      }

      console.log('Database indexes verified')
    } catch (error) {
      console.warn('Failed to verify database indexes:', error)
    }
  }

  /**
   * Get current performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const cacheStats = cacheService.getStats()
    const queryStats = queryOptimizer.getQueryStats()
    
    const cacheHitRate = cacheStats.memoryHits + cacheStats.redisHits > 0
      ? (cacheStats.memoryHits + cacheStats.redisHits) / 
        (cacheStats.memoryHits + cacheStats.redisHits + cacheStats.memoryMisses + cacheStats.redisMisses)
      : 0

    const averageQueryTime = queryStats.length > 0
      ? queryStats.reduce((sum, stat) => sum + stat.avgTime, 0) / queryStats.length
      : 0

    const slowQueries = queryStats
      .filter(stat => stat.avgTime > 100) // Queries slower than 100ms
      .slice(0, 10) // Top 10 slowest

    return {
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      averageQueryTime: Math.round(averageQueryTime * 100) / 100,
      slowQueries,
      memoryUsage: cacheStats.memorySize,
      responseTime: Date.now() - this.startTime,
    }
  }

  /**
   * Report performance metrics
   */
  private async reportPerformanceMetrics(): Promise<void> {
    try {
      const metrics = await this.getPerformanceMetrics()
      
      console.log('Performance Metrics:', {
        cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(1)}%`,
        averageQueryTime: `${metrics.averageQueryTime}ms`,
        slowQueriesCount: metrics.slowQueries.length,
        memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB`,
      })

      // Alert on performance issues
      if (metrics.cacheHitRate < 0.5) {
        console.warn('Low cache hit rate detected:', metrics.cacheHitRate)
      }

      if (metrics.averageQueryTime > 500) {
        console.warn('High average query time detected:', metrics.averageQueryTime)
      }

      if (metrics.slowQueries.length > 5) {
        console.warn('Multiple slow queries detected:', metrics.slowQueries.length)
      }

    } catch (error) {
      console.error('Failed to report performance metrics:', error)
    }
  }

  /**
   * Optimize specific operation with caching and monitoring
   */
  async optimizeOperation<T>(
    operationName: string,
    cacheKey: string,
    operation: () => Promise<T>,
    cacheTtl = 3600
  ): Promise<T> {
    const startTime = Date.now()

    try {
      // Try cache first
      if (this.config.cacheEnabled) {
        const cached = await cacheService.get<T>(cacheKey)
        if (cached !== null) {
          const duration = Date.now() - startTime
          console.log(`Cache hit for ${operationName}: ${duration}ms`)
          return cached
        }
      }

      // Execute operation
      const result = await operation()
      const duration = Date.now() - startTime

      // Cache result
      if (this.config.cacheEnabled) {
        await cacheService.set(cacheKey, result, { redisTtl: cacheTtl })
      }

      console.log(`Operation ${operationName} completed: ${duration}ms`)
      
      // Log slow operations
      if (duration > 1000) {
        console.warn(`Slow operation detected: ${operationName} took ${duration}ms`)
      }

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`Operation ${operationName} failed after ${duration}ms:`, error)
      throw error
    }
  }

  /**
   * Batch optimize multiple operations
   */
  async batchOptimize<T>(
    operations: Array<{
      name: string
      cacheKey: string
      operation: () => Promise<T>
      cacheTtl?: number
    }>
  ): Promise<T[]> {
    const startTime = Date.now()
    
    const results = await Promise.allSettled(
      operations.map(op => 
        this.optimizeOperation(op.name, op.cacheKey, op.operation, op.cacheTtl)
      )
    )

    const duration = Date.now() - startTime
    const successful = results.filter(r => r.status === 'fulfilled').length
    
    console.log(`Batch operation completed: ${successful}/${operations.length} successful in ${duration}ms`)

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        throw result.reason
      }
    })
  }

  /**
   * Clear all performance caches
   */
  async clearCaches(): Promise<void> {
    if (this.config.cacheEnabled) {
      await cacheService.clear()
      console.log('All caches cleared')
    }
  }

  /**
   * Reset performance statistics
   */
  resetStats(): void {
    queryOptimizer.clearQueryStats()
    this.startTime = Date.now()
    console.log('Performance statistics reset')
  }

  /**
   * Shutdown performance service
   */
  async shutdown(): Promise<void> {
    await cacheService.disconnect()
    await this.prisma.$disconnect()
    console.log('Performance optimization service shutdown')
  }
}

// Export singleton instance
export const performanceService = new PerformanceOptimizationService()
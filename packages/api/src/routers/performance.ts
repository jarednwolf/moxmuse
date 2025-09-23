import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'
import { performanceService } from '../services/performance/PerformanceOptimizationService'
import { cacheService } from '../services/cache/CacheService'
import { queryOptimizer } from '../services/database/QueryOptimizer'

export const performanceRouter = createTRPCRouter({
  /**
   * Get current performance metrics
   */
  getMetrics: publicProcedure.query(async () => {
    return await performanceService.getPerformanceMetrics()
  }),

  /**
   * Get cache statistics
   */
  getCacheStats: publicProcedure.query(async () => {
    return cacheService.getStats()
  }),

  /**
   * Get query performance statistics
   */
  getQueryStats: publicProcedure.query(async () => {
    return queryOptimizer.getQueryStats()
  }),

  /**
   * Clear specific cache by pattern
   */
  clearCache: publicProcedure
    .input(z.object({
      pattern: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.pattern) {
        const deletedCount = await cacheService.deletePattern(input.pattern)
        return { success: true, deletedCount }
      }
      
      if (input.tags) {
        const deletedCount = cacheService.deleteByTags(input.tags)
        return { success: true, deletedCount }
      }

      await cacheService.clear()
      return { success: true, message: 'All caches cleared' }
    }),

  /**
   * Warm up cache with common data
   */
  warmUpCache: publicProcedure.mutation(async () => {
    await performanceService.initialize()
    return { success: true, message: 'Cache warmed up successfully' }
  }),

  /**
   * Reset performance statistics
   */
  resetStats: publicProcedure.mutation(async () => {
    performanceService.resetStats()
    return { success: true, message: 'Performance statistics reset' }
  }),

  /**
   * Test cache performance
   */
  testCachePerformance: publicProcedure
    .input(z.object({
      iterations: z.number().min(1).max(1000).default(100),
      dataSize: z.number().min(1).max(10000).default(1000),
    }))
    .mutation(async ({ input }) => {
      const testData = Array.from({ length: input.dataSize }, (_, i) => ({
        id: i,
        name: `Test Item ${i}`,
        data: `Test data for item ${i}`.repeat(10),
      }))

      const results = {
        memoryCache: { totalTime: 0, avgTime: 0 },
        redisCache: { totalTime: 0, avgTime: 0 },
        noCache: { totalTime: 0, avgTime: 0 },
      }

      // Test memory cache performance
      const memoryStart = Date.now()
      for (let i = 0; i < input.iterations; i++) {
        const key = `test:memory:${i}`
        await cacheService.set(key, testData, { memoryTtl: 60000, redisTtl: 0 })
        await cacheService.get(key)
      }
      results.memoryCache.totalTime = Date.now() - memoryStart
      results.memoryCache.avgTime = results.memoryCache.totalTime / input.iterations

      // Test Redis cache performance
      const redisStart = Date.now()
      for (let i = 0; i < input.iterations; i++) {
        const key = `test:redis:${i}`
        await cacheService.set(key, testData, { memoryTtl: 0, redisTtl: 60 })
        await cacheService.get(key)
      }
      results.redisCache.totalTime = Date.now() - redisStart
      results.redisCache.avgTime = results.redisCache.totalTime / input.iterations

      // Test no cache (direct operation)
      const noCacheStart = Date.now()
      for (let i = 0; i < input.iterations; i++) {
        // Simulate data processing
        JSON.parse(JSON.stringify(testData))
      }
      results.noCache.totalTime = Date.now() - noCacheStart
      results.noCache.avgTime = results.noCache.totalTime / input.iterations

      // Clean up test data
      await cacheService.deletePattern('test:*')

      return {
        success: true,
        results,
        summary: {
          memoryCacheSpeedup: results.noCache.avgTime / results.memoryCache.avgTime,
          redisCacheSpeedup: results.noCache.avgTime / results.redisCache.avgTime,
          memoryVsRedis: results.redisCache.avgTime / results.memoryCache.avgTime,
        },
      }
    }),

  /**
   * Test query optimization performance
   */
  testQueryPerformance: publicProcedure
    .input(z.object({
      testType: z.enum(['card_search', 'deck_retrieval', 'batch_cards']),
      iterations: z.number().min(1).max(100).default(10),
    }))
    .mutation(async ({ input }) => {
      const results: Array<{ iteration: number; duration: number }> = []

      for (let i = 0; i < input.iterations; i++) {
        const start = Date.now()

        try {
          switch (input.testType) {
            case 'card_search':
              await queryOptimizer.searchCards({
                query: 'Lightning',
                limit: 50,
              })
              break

            case 'deck_retrieval':
              // This would need a valid deck ID in a real test
              // await queryOptimizer.getDeckWithCards('test-deck-id')
              break

            case 'batch_cards':
              await queryOptimizer.getCardsBatch([
                'test-card-1',
                'test-card-2',
                'test-card-3',
              ])
              break
          }

          const duration = Date.now() - start
          results.push({ iteration: i + 1, duration })
        } catch (error) {
          console.warn(`Test iteration ${i + 1} failed:`, error)
        }
      }

      const totalTime = results.reduce((sum, r) => sum + r.duration, 0)
      const avgTime = totalTime / results.length
      const minTime = Math.min(...results.map(r => r.duration))
      const maxTime = Math.max(...results.map(r => r.duration))

      return {
        success: true,
        testType: input.testType,
        iterations: input.iterations,
        results,
        summary: {
          totalTime,
          avgTime,
          minTime,
          maxTime,
          successRate: (results.length / input.iterations) * 100,
        },
      }
    }),

  /**
   * Get system resource usage
   */
  getResourceUsage: publicProcedure.query(async () => {
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    return {
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
    }
  }),
})
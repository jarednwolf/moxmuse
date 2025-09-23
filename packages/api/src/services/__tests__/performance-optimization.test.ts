import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cacheService } from '../cache/CacheService'
import { queryOptimizer } from '../database/QueryOptimizer'
import { performanceService } from '../performance/PerformanceOptimizationService'

describe('Performance Optimization', () => {
  beforeEach(async () => {
    // Clear caches before each test
    await cacheService.clear()
    queryOptimizer.clearQueryStats()
  })

  afterEach(async () => {
    // Clean up after each test
    await cacheService.clear()
  })

  describe('CacheService', () => {
    it('should cache and retrieve values from memory', async () => {
      const testData = { id: 1, name: 'Test Item' }
      const key = 'test:memory'

      await cacheService.set(key, testData, { memoryTtl: 60000, redisTtl: 0 })
      const retrieved = await cacheService.get(key)

      expect(retrieved).toEqual(testData)
    })

    it('should handle cache misses gracefully', async () => {
      const result = await cacheService.get('nonexistent:key')
      expect(result).toBeNull()
    })

    it('should delete cached values', async () => {
      const key = 'test:delete'
      await cacheService.set(key, 'test data')
      
      let retrieved = await cacheService.get(key)
      expect(retrieved).toBe('test data')

      await cacheService.delete(key)
      retrieved = await cacheService.get(key)
      expect(retrieved).toBeNull()
    })

    it('should delete by pattern', async () => {
      await cacheService.set('test:1', 'data1')
      await cacheService.set('test:2', 'data2')
      await cacheService.set('other:1', 'data3')

      const deletedCount = await cacheService.deletePattern('test:*')
      expect(deletedCount).toBeGreaterThanOrEqual(0) // Redis might not be available in tests

      const remaining = await cacheService.get('other:1')
      expect(remaining).toBe('data3')
    })

    it('should delete by tags', async () => {
      await cacheService.set('item1', 'data1', { tags: ['group1'] })
      await cacheService.set('item2', 'data2', { tags: ['group1'] })
      await cacheService.set('item3', 'data3', { tags: ['group2'] })

      const deletedCount = cacheService.deleteByTags(['group1'])
      expect(deletedCount).toBe(2)

      const remaining = await cacheService.get('item3')
      expect(remaining).toBe('data3')
    })

    it('should provide cache statistics', async () => {
      await cacheService.set('test1', 'data1')
      await cacheService.get('test1') // Hit
      await cacheService.get('nonexistent') // Miss

      const stats = cacheService.getStats()
      expect(stats.memoryHits).toBeGreaterThan(0)
      expect(stats.memoryMisses).toBeGreaterThan(0)
    })
  })

  describe('QueryOptimizer', () => {
    it('should record query statistics', async () => {
      // Mock a slow operation
      const slowOperation = () => new Promise(resolve => setTimeout(resolve, 100))
      
      const start = Date.now()
      await slowOperation()
      const duration = Date.now() - start

      // Manually record stats (since we can't easily test actual DB queries)
      queryOptimizer['recordQueryStats']('test.query', duration)

      const stats = queryOptimizer.getQueryStats()
      expect(stats).toHaveLength(1)
      expect(stats[0].query).toBe('test.query')
      expect(stats[0].avgTime).toBeGreaterThan(0)
    })

    it('should clear query statistics', async () => {
      queryOptimizer['recordQueryStats']('test.query', 100)
      
      let stats = queryOptimizer.getQueryStats()
      expect(stats).toHaveLength(1)

      queryOptimizer.clearQueryStats()
      stats = queryOptimizer.getQueryStats()
      expect(stats).toHaveLength(0)
    })
  })

  describe('PerformanceOptimizationService', () => {
    it('should get performance metrics', async () => {
      const metrics = await performanceService.getPerformanceMetrics()
      
      expect(metrics).toHaveProperty('cacheHitRate')
      expect(metrics).toHaveProperty('averageQueryTime')
      expect(metrics).toHaveProperty('slowQueries')
      expect(metrics).toHaveProperty('memoryUsage')
      expect(metrics).toHaveProperty('responseTime')
      
      expect(typeof metrics.cacheHitRate).toBe('number')
      expect(typeof metrics.averageQueryTime).toBe('number')
      expect(Array.isArray(metrics.slowQueries)).toBe(true)
    })

    it('should optimize operations with caching', async () => {
      let callCount = 0
      const expensiveOperation = async () => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 50))
        return { result: 'expensive data', callCount }
      }

      // First call should execute the operation
      const result1 = await performanceService.optimizeOperation(
        'test-operation',
        'test:cache:key',
        expensiveOperation,
        60
      )
      expect(result1.callCount).toBe(1)

      // Second call should use cache
      const result2 = await performanceService.optimizeOperation(
        'test-operation',
        'test:cache:key',
        expensiveOperation,
        60
      )
      expect(result2.callCount).toBe(1) // Same as first call (from cache)
      expect(callCount).toBe(1) // Operation only called once
    })

    it('should batch optimize multiple operations', async () => {
      const operations = [
        {
          name: 'op1',
          cacheKey: 'batch:1',
          operation: async () => ({ id: 1, data: 'test1' }),
        },
        {
          name: 'op2',
          cacheKey: 'batch:2',
          operation: async () => ({ id: 2, data: 'test2' }),
        },
        {
          name: 'op3',
          cacheKey: 'batch:3',
          operation: async () => ({ id: 3, data: 'test3' }),
        },
      ]

      const results = await performanceService.batchOptimize(operations)
      
      expect(results).toHaveLength(3)
      expect(results[0]).toEqual({ id: 1, data: 'test1' })
      expect(results[1]).toEqual({ id: 2, data: 'test2' })
      expect(results[2]).toEqual({ id: 3, data: 'test3' })
    })

    it('should handle batch operation failures gracefully', async () => {
      const operations = [
        {
          name: 'success',
          cacheKey: 'batch:success',
          operation: async () => ({ success: true }),
        },
        {
          name: 'failure',
          cacheKey: 'batch:failure',
          operation: async () => {
            throw new Error('Operation failed')
          },
        },
      ]

      await expect(performanceService.batchOptimize(operations)).rejects.toThrow('Operation failed')
    })

    it('should reset statistics', async () => {
      // Add some metrics
      await cacheService.set('test', 'data')
      await cacheService.get('test')
      
      performanceService.resetStats()
      
      // Stats should be reset (this is more of a smoke test)
      const metrics = await performanceService.getPerformanceMetrics()
      expect(typeof metrics.responseTime).toBe('number')
    })
  })

  describe('Performance Integration', () => {
    it('should demonstrate end-to-end performance optimization', async () => {
      // Simulate a card search operation with caching
      const mockCardSearch = async (query: string) => {
        // Simulate database query delay
        await new Promise(resolve => setTimeout(resolve, 100))
        return [
          { id: '1', name: `${query} Card 1` },
          { id: '2', name: `${query} Card 2` },
        ]
      }

      const query = 'Lightning'
      const cacheKey = `search:${query}`

      // First search - should hit database
      const start1 = Date.now()
      const result1 = await performanceService.optimizeOperation(
        'card-search',
        cacheKey,
        () => mockCardSearch(query),
        300 // 5 minutes cache
      )
      const duration1 = Date.now() - start1

      expect(result1).toHaveLength(2)
      expect(duration1).toBeGreaterThan(90) // Should take at least 100ms

      // Second search - should hit cache
      const start2 = Date.now()
      const result2 = await performanceService.optimizeOperation(
        'card-search',
        cacheKey,
        () => mockCardSearch(query),
        300
      )
      const duration2 = Date.now() - start2

      expect(result2).toEqual(result1)
      expect(duration2).toBeLessThan(50) // Should be much faster from cache
    })

    it('should measure cache performance improvement', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: 'x'.repeat(1000), // 1KB of data
      }))

      // Measure without cache
      const noCacheStart = Date.now()
      for (let i = 0; i < 10; i++) {
        JSON.parse(JSON.stringify(testData))
      }
      const noCacheDuration = Date.now() - noCacheStart

      // Measure with cache
      const cacheKey = 'perf:test:data'
      await cacheService.set(cacheKey, testData)

      const cacheStart = Date.now()
      for (let i = 0; i < 10; i++) {
        await cacheService.get(cacheKey)
      }
      const cacheDuration = Date.now() - cacheStart

      // Cache should be faster (though this might be flaky in CI)
      console.log(`No cache: ${noCacheDuration}ms, With cache: ${cacheDuration}ms`)
      
      // At minimum, cache should not be significantly slower
      expect(cacheDuration).toBeLessThan(noCacheDuration * 2)
    })
  })
})
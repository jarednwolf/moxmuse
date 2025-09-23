import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ReliableAIService } from '../ai/ReliableAIService'
import { CacheService } from '../cache/CacheService'
import { PerformanceOptimizationService } from '../performance/PerformanceOptimizationService'
import { prisma as db } from '@moxmuse/db'

describe.skip('Performance and Load Tests (skipped in unit CI)', () => {
  let aiService: ReliableAIService
  let cacheService: CacheService
  let performanceService: PerformanceOptimizationService
  
  beforeAll(async () => {
    aiService = new ReliableAIService()
    cacheService = new CacheService()
    performanceService = new PerformanceOptimizationService()
    await db.$connect()
  })
  
  afterAll(async () => {
    await db.$disconnect()
  })
  
  beforeEach(async () => {
    // Clear test data
    await db.generatedDeck.deleteMany({
      where: { sessionId: { startsWith: 'perf-test-' } }
    })
  })
  
  describe('Concurrent Deck Generation Load Tests', () => {
    it('should handle 10 concurrent deck generations within acceptable time', async () => {
      const concurrentRequests = 10
      const maxAcceptableTime = 300000 // 5 minutes
      
      const requests = Array.from({ length: concurrentRequests }, (_, i) => ({
        sessionId: `perf-test-concurrent-${i}`,
        consultationData: {
          buildingFullDeck: true,
          needsCommanderSuggestions: false,
          commander: 'Atraxa, Praetors\' Voice',
          strategy: 'counters',
          budget: 500,
          powerLevel: 3
        },
        constraints: {
          timeoutMs: 180000,
          maxRetries: 2
        }
      }))
      
      const startTime = Date.now()
      
      const results = await Promise.allSettled(
        requests.map(request => aiService.generateDeck(request))
      )
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // Analyze results
      const successful = results.filter(result => result.status === 'fulfilled')
      const failed = results.filter(result => result.status === 'rejected')
      
      const successRate = successful.length / concurrentRequests
      
      // Assertions
      expect(totalTime).toBeLessThan(maxAcceptableTime)
      expect(successRate).toBeGreaterThan(0.8) // At least 80% success rate
      
      // Verify successful generations
      successful.forEach((result) => {
        if (result.status === 'fulfilled') {
          expect(result.value.cards).toHaveLength(100)
          expect(result.value.qualityMetrics.overallScore).toBeGreaterThan(0.6)
        }
      })
      
      console.log(`Concurrent Load Test Results:`)
      console.log(`- Total time: ${totalTime}ms`)
      console.log(`- Success rate: ${(successRate * 100).toFixed(1)}%`)
      console.log(`- Successful: ${successful.length}/${concurrentRequests}`)
      console.log(`- Failed: ${failed.length}/${concurrentRequests}`)
    }, 400000) // 6.5 minute timeout for the test itself
    
    it('should maintain performance under sustained load', async () => {
      const batchSize = 5
      const numberOfBatches = 4
      const batchResults: number[] = []
      
      for (let batch = 0; batch < numberOfBatches; batch++) {
        const requests = Array.from({ length: batchSize }, (_, i) => ({
          sessionId: `perf-test-sustained-${batch}-${i}`,
          consultationData: {
            buildingFullDeck: true,
            needsCommanderSuggestions: false,
            commander: 'Meren of Clan Nel Toth',
            strategy: 'graveyard',
            budget: 400,
            powerLevel: 3
          },
          constraints: {
            timeoutMs: 120000,
            maxRetries: 2
          }
        }))
        
        const batchStartTime = Date.now()
        
        const results = await Promise.allSettled(
          requests.map(request => aiService.generateDeck(request))
        )
        
        const batchEndTime = Date.now()
        const batchTime = batchEndTime - batchStartTime
        batchResults.push(batchTime)
        
        const successfulInBatch = results.filter(r => r.status === 'fulfilled').length
        expect(successfulInBatch).toBeGreaterThan(batchSize * 0.8) // 80% success rate per batch
        
        // Small delay between batches to simulate realistic usage
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
      
      // Analyze performance degradation
      const avgTime = batchResults.reduce((a, b) => a + b, 0) / batchResults.length
      const maxDeviation = Math.max(...batchResults.map(time => Math.abs(time - avgTime)))
      
      // Performance shouldn't degrade more than 30% from average
      expect(maxDeviation / avgTime).toBeLessThan(0.3)
      
      console.log(`Sustained Load Test Results:`)
      console.log(`- Batch times: ${batchResults.map(t => `${(t/1000).toFixed(1)}s`).join(', ')}`)
      console.log(`- Average batch time: ${(avgTime/1000).toFixed(1)}s`)
      console.log(`- Max deviation: ${((maxDeviation/avgTime)*100).toFixed(1)}%`)
    }, 600000) // 10 minute timeout
  })
  
  describe('Cache Performance Tests', () => {
    it('should demonstrate significant performance improvement with caching', async () => {
      const testKey = 'perf-test-cache-key'
      const testData = {
        complexCalculation: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: Math.random() * 1000,
          computed: Math.sqrt(i) * Math.PI
        }))
      }
      
      // Test without cache (cold)
      const coldStartTime = Date.now()
      await simulateExpensiveOperation(testData)
      const coldEndTime = Date.now()
      const coldTime = coldEndTime - coldStartTime
      
      // Store in cache
      await cacheService.set(testKey, testData, 3600)
      
      // Test with cache (warm)
      const warmStartTime = Date.now()
      const cachedData = await cacheService.get(testKey)
      const warmEndTime = Date.now()
      const warmTime = warmEndTime - warmStartTime
      
      // Verify data integrity
      expect(cachedData).toEqual(testData)
      
      // Cache should be significantly faster (at least 10x)
      expect(warmTime * 10).toBeLessThan(coldTime)
      
      console.log(`Cache Performance Test:`)
      console.log(`- Cold time: ${coldTime}ms`)
      console.log(`- Warm time: ${warmTime}ms`)
      console.log(`- Improvement: ${(coldTime / warmTime).toFixed(1)}x faster`)
    })
    
    it('should handle cache invalidation under load', async () => {
      const numberOfKeys = 100
      const operationsPerKey = 10
      
      // Generate test data
      const testOperations = []
      for (let i = 0; i < numberOfKeys; i++) {
        for (let j = 0; j < operationsPerKey; j++) {
          testOperations.push({
            key: `perf-test-invalidation-${i}`,
            value: { iteration: j, data: `test-data-${i}-${j}` },
            ttl: 60
          })
        }
      }
      
      const startTime = Date.now()
      
      // Execute all operations concurrently
      await Promise.all(
        testOperations.map(async (op) => {
          await cacheService.set(op.key, op.value, op.ttl)
          const retrieved = await cacheService.get(op.key)
          expect(retrieved).toBeDefined()
        })
      )
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(30000) // 30 seconds
      
      // Verify final state
      for (let i = 0; i < numberOfKeys; i++) {
        const finalValue = await cacheService.get(`perf-test-invalidation-${i}`)
        expect(finalValue).toBeDefined()
        expect(finalValue.iteration).toBe(operationsPerKey - 1) // Last iteration
      }
      
      console.log(`Cache Invalidation Test: ${totalTime}ms for ${testOperations.length} operations`)
    })
  })
  
  describe('Database Performance Tests', () => {
    it('should handle large deck queries efficiently', async () => {
      // Create test decks
      const numberOfDecks = 50
      const testDecks = Array.from({ length: numberOfDecks }, (_, i) => ({
        id: `perf-test-deck-${i}`,
        userId: `perf-test-user-${i % 10}`, // 10 different users
        sessionId: `perf-test-session-${i}`,
        name: `Performance Test Deck ${i}`,
        commander: 'Atraxa, Praetors\' Voice',
        format: 'commander',
        strategy: JSON.stringify({ type: 'counters', themes: ['proliferate'] }),
        winConditions: JSON.stringify(['planeswalker ultimate', 'combat damage']),
        powerLevel: 3,
        estimatedBudget: 500 + (i * 10),
        qualityScore: 0.8 + (Math.random() * 0.2),
        manaCurveScore: 0.75 + (Math.random() * 0.25),
        synergyScore: 0.7 + (Math.random() * 0.3),
        budgetCompliance: 0.95 + (Math.random() * 0.05),
        generationTime: 60000 + (Math.random() * 30000),
        aiModelUsed: 'gpt-4',
        retryCount: Math.floor(Math.random() * 3)
      }))
      
      // Insert test data
      await db.generatedDeck.createMany({
        data: testDecks
      })
      
      // Test various query patterns
      const queryTests = [
        {
          name: 'Find by user',
          query: () => db.generatedDeck.findMany({
            where: { userId: 'perf-test-user-0' }
          })
        },
        {
          name: 'Find by commander',
          query: () => db.generatedDeck.findMany({
            where: { commander: 'Atraxa, Praetors\' Voice' }
          })
        },
        {
          name: 'Find by budget range',
          query: () => db.generatedDeck.findMany({
            where: {
              estimatedBudget: {
                gte: 500,
                lte: 600
              }
            }
          })
        },
        {
          name: 'Find by quality score',
          query: () => db.generatedDeck.findMany({
            where: {
              qualityScore: {
                gte: 0.8
              }
            },
            orderBy: {
              qualityScore: 'desc'
            },
            take: 10
          })
        },
        {
          name: 'Complex aggregation',
          query: () => db.generatedDeck.aggregate({
            _avg: {
              qualityScore: true,
              estimatedBudget: true,
              generationTime: true
            },
            _count: {
              id: true
            },
            where: {
              powerLevel: 3
            }
          })
        }
      ]
      
      for (const test of queryTests) {
        const startTime = Date.now()
        const result = await test.query()
        const endTime = Date.now()
        const queryTime = endTime - startTime
        
        // Each query should complete within 1 second
        expect(queryTime).toBeLessThan(1000)
        expect(result).toBeDefined()
        
        console.log(`${test.name}: ${queryTime}ms`)
      }
    })
    
    it('should handle concurrent database operations', async () => {
      const concurrentOperations = 20
      const operationsPerType = 5
      
      const operations = []
      
      // Create operations
      for (let i = 0; i < concurrentOperations; i++) {
        operations.push({
          type: 'create',
          data: {
            id: `perf-test-concurrent-${i}`,
            userId: `perf-test-user-${i}`,
            sessionId: `perf-test-session-${i}`,
            name: `Concurrent Test Deck ${i}`,
            commander: 'Test Commander',
            format: 'commander',
            strategy: JSON.stringify({ type: 'test' }),
            winConditions: JSON.stringify(['test']),
            powerLevel: 3,
            estimatedBudget: 400,
            qualityScore: 0.8,
            manaCurveScore: 0.75,
            synergyScore: 0.7,
            budgetCompliance: 0.95,
            generationTime: 60000,
            aiModelUsed: 'gpt-4',
            retryCount: 0
          }
        })
      }
      
      // Add read operations
      for (let i = 0; i < operationsPerType; i++) {
        operations.push({
          type: 'read',
          id: `perf-test-concurrent-${i}`
        })
      }
      
      // Add update operations
      for (let i = 0; i < operationsPerType; i++) {
        operations.push({
          type: 'update',
          id: `perf-test-concurrent-${i}`,
          data: { qualityScore: 0.9 }
        })
      }
      
      const startTime = Date.now()
      
      const results = await Promise.allSettled(
        operations.map(async (op) => {
          switch (op.type) {
            case 'create':
              return db.generatedDeck.create({ data: op.data })
            case 'read':
              return db.generatedDeck.findUnique({ where: { id: op.id } })
            case 'update':
              return db.generatedDeck.update({
                where: { id: op.id },
                data: op.data
              })
            default:
              throw new Error(`Unknown operation type: ${op.type}`)
          }
        })
      )
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      const successful = results.filter(r => r.status === 'fulfilled').length
      const successRate = successful / operations.length
      
      // Should complete within reasonable time and have high success rate
      expect(totalTime).toBeLessThan(10000) // 10 seconds
      expect(successRate).toBeGreaterThan(0.95) // 95% success rate
      
      console.log(`Concurrent DB Operations: ${totalTime}ms, ${(successRate * 100).toFixed(1)}% success`)
    })
  })
  
  describe('Memory and Resource Usage Tests', () => {
    it('should not have memory leaks during repeated operations', async () => {
      const iterations = 20
      const memorySnapshots: number[] = []
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const initialMemory = process.memoryUsage().heapUsed
      memorySnapshots.push(initialMemory)
      
      for (let i = 0; i < iterations; i++) {
        // Perform memory-intensive operations
        const request = {
          sessionId: `perf-test-memory-${i}`,
          consultationData: {
            buildingFullDeck: true,
            needsCommanderSuggestions: false,
            commander: 'Atraxa, Praetors\' Voice',
            strategy: 'counters',
            budget: 500,
            powerLevel: 3
          },
          constraints: {
            timeoutMs: 60000,
            maxRetries: 1
          }
        }
        
        try {
          const deck = await aiService.generateDeck(request)
          expect(deck.cards).toHaveLength(100)
          
          // Simulate processing the deck
          await performanceService.analyzeDeckPerformance(deck)
          
          // Force garbage collection if available
          if (global.gc && i % 5 === 0) {
            global.gc()
          }
          
          const currentMemory = process.memoryUsage().heapUsed
          memorySnapshots.push(currentMemory)
          
        } catch (error) {
          // Continue even if some operations fail
          console.warn(`Memory test iteration ${i} failed:`, error)
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      const memoryIncreasePercentage = (memoryIncrease / initialMemory) * 100
      
      // Memory increase should be reasonable (less than 100% increase)
      expect(memoryIncreasePercentage).toBeLessThan(100)
      
      console.log(`Memory Usage Test:`)
      console.log(`- Initial: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`)
      console.log(`- Final: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`)
      console.log(`- Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercentage.toFixed(1)}%)`)
    }, 300000) // 5 minute timeout
  })
  
  describe('API Response Time Tests', () => {
    it('should meet response time SLAs for different operations', async () => {
      const slaTests = [
        {
          name: 'Health Check',
          operation: async () => {
            // Simulate health check
            return { status: 'healthy', timestamp: new Date() }
          },
          maxTime: 100 // 100ms
        },
        {
          name: 'Card Search',
          operation: async () => {
            // Simulate card search
            return await db.card.findMany({
              where: {
                name: {
                  contains: 'Lightning'
                }
              },
              take: 20
            })
          },
          maxTime: 500 // 500ms
        },
        {
          name: 'Deck Retrieval',
          operation: async () => {
            // Create a test deck first
            const deck = await db.generatedDeck.create({
              data: {
                id: 'perf-test-retrieval',
                userId: 'perf-test-user',
                sessionId: 'perf-test-session',
                name: 'Test Deck',
                commander: 'Test Commander',
                format: 'commander',
                strategy: JSON.stringify({ type: 'test' }),
                winConditions: JSON.stringify(['test']),
                powerLevel: 3,
                estimatedBudget: 400,
                qualityScore: 0.8,
                manaCurveScore: 0.75,
                synergyScore: 0.7,
                budgetCompliance: 0.95,
                generationTime: 60000,
                aiModelUsed: 'gpt-4',
                retryCount: 0
              }
            })
            
            return await db.generatedDeck.findUnique({
              where: { id: deck.id }
            })
          },
          maxTime: 200 // 200ms
        }
      ]
      
      for (const test of slaTests) {
        const startTime = Date.now()
        const result = await test.operation()
        const endTime = Date.now()
        const responseTime = endTime - startTime
        
        expect(result).toBeDefined()
        expect(responseTime).toBeLessThan(test.maxTime)
        
        console.log(`${test.name} SLA: ${responseTime}ms (max: ${test.maxTime}ms)`)
      }
    })
  })
})

// Helper function to simulate expensive operations
async function simulateExpensiveOperation(data: any): Promise<void> {
  // Simulate CPU-intensive work
  let result = 0
  for (let i = 0; i < 100000; i++) {
    result += Math.sqrt(i) * Math.PI
  }
  
  // Simulate async work
  await new Promise(resolve => setTimeout(resolve, 50))
  
  // Simulate data processing
  JSON.stringify(data)
  JSON.parse(JSON.stringify(data))
}
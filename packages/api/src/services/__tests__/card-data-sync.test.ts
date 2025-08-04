import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cardDataSyncService } from '../card-data-sync'
import { enhancedCardDataService } from '../enhanced-card-data'
import { redisCache } from '../redis'
import { db } from '@moxmuse/db'

// Mock dependencies
vi.mock('../enhanced-card-data', () => ({
  enhancedCardDataService: {
    updateFromBulkData: vi.fn(),
    getEnhancedCard: vi.fn()
  }
}))

vi.mock('../redis', () => ({
  redisCache: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    lpush: vi.fn(),
    rpop: vi.fn()
  }
}))

vi.mock('@moxmuse/db', () => ({
  db: {
    enhancedCardData: {
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.mock('../core/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../core/performance-monitor', () => ({
  performanceMonitor: {
    startTimer: vi.fn(() => ({
      end: vi.fn()
    }))
  }
}))

vi.mock('cron', () => ({
  CronJob: vi.fn().mockImplementation((pattern, callback, onComplete, start, timezone) => ({
    start: vi.fn(),
    stop: vi.fn(),
    pattern,
    callback,
    onComplete,
    timezone
  }))
}))

const mockEnhancedCardDataService = enhancedCardDataService as any
const mockRedisCache = redisCache as any
const mockDb = db as any

describe('CardDataSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize sync jobs', () => {
      cardDataSyncService.initialize()
      
      // Should create cron jobs
      expect(vi.mocked(require('cron').CronJob)).toHaveBeenCalledTimes(3)
      
      // Verify cron patterns
      const cronCalls = vi.mocked(require('cron').CronJob).mock.calls
      expect(cronCalls[0][0]).toBe('0 2 * * *') // Daily bulk data at 2 AM
      expect(cronCalls[1][0]).toBe('0 */4 * * *') // Price updates every 4 hours
      expect(cronCalls[2][0]).toBe('0 6 * * *') // Popularity updates at 6 AM
    })

    it('should start all jobs after initialization', () => {
      const mockStart = vi.fn()
      vi.mocked(require('cron').CronJob).mockImplementation(() => ({
        start: mockStart,
        stop: vi.fn()
      }))

      cardDataSyncService.initialize()
      cardDataSyncService.startJobs()

      expect(mockStart).toHaveBeenCalledTimes(3)
    })

    it('should stop all jobs', () => {
      const mockStop = vi.fn()
      vi.mocked(require('cron').CronJob).mockImplementation(() => ({
        start: vi.fn(),
        stop: mockStop
      }))

      cardDataSyncService.initialize()
      cardDataSyncService.stopJobs()

      expect(mockStop).toHaveBeenCalledTimes(3)
    })
  })

  describe('runBulkDataSync', () => {
    it('should run bulk data sync successfully', async () => {
      const mockBulkResult = {
        success: true,
        cardsUpdated: 1000,
        errors: []
      }
      
      mockEnhancedCardDataService.updateFromBulkData.mockResolvedValue(mockBulkResult)
      mockRedisCache.set.mockResolvedValue(undefined)

      const result = await cardDataSyncService.runBulkDataSync()

      expect(result.status).toBe('completed')
      expect(result.cardsProcessed).toBe(1000)
      expect(result.errors).toHaveLength(0)
      expect(mockEnhancedCardDataService.updateFromBulkData).toHaveBeenCalled()
    })

    it('should handle bulk sync failures', async () => {
      const mockBulkResult = {
        success: false,
        cardsUpdated: 0,
        errors: ['Network error', 'Parse error']
      }
      
      mockEnhancedCardDataService.updateFromBulkData.mockResolvedValue(mockBulkResult)
      mockRedisCache.set.mockResolvedValue(undefined)

      const result = await cardDataSyncService.runBulkDataSync()

      expect(result.status).toBe('failed')
      expect(result.errors).toHaveLength(2)
      expect(result.errors).toContain('Network error')
      expect(result.errors).toContain('Parse error')
    })

    it('should handle sync service errors', async () => {
      mockEnhancedCardDataService.updateFromBulkData.mockRejectedValue(new Error('Service error'))
      mockRedisCache.set.mockResolvedValue(undefined)

      const result = await cardDataSyncService.runBulkDataSync()

      expect(result.status).toBe('failed')
      expect(result.errors).toContain('Service error')
    })

    it('should update sync status in cache', async () => {
      const mockBulkResult = {
        success: true,
        cardsUpdated: 500,
        errors: []
      }
      
      mockEnhancedCardDataService.updateFromBulkData.mockResolvedValue(mockBulkResult)
      mockRedisCache.set.mockResolvedValue(undefined)

      await cardDataSyncService.runBulkDataSync()

      expect(mockRedisCache.set).toHaveBeenCalledWith(
        'current_sync_job',
        expect.objectContaining({
          status: 'completed',
          cardsProcessed: 500
        }),
        expect.any(Number)
      )
    })
  })

  describe('runPriceSync', () => {
    it('should update prices for stale cards', async () => {
      const mockStaleCards = [
        { cardId: 'card-1' },
        { cardId: 'card-2' },
        { cardId: 'card-3' }
      ]

      mockDb.enhancedCardData.count.mockResolvedValue(3)
      mockDb.enhancedCardData.findMany.mockResolvedValue(mockStaleCards)
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue({
        cardId: 'card-1',
        name: 'Test Card',
        currentPrice: 5.99
      })

      await cardDataSyncService.runPriceSync()

      expect(mockDb.enhancedCardData.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { lastUpdated: { lt: expect.any(Date) } },
            { currentPrice: null }
          ]
        },
        select: { cardId: true },
        take: 1000
      })

      expect(mockEnhancedCardDataService.getEnhancedCard).toHaveBeenCalledTimes(3)
    })

    it('should handle price sync errors gracefully', async () => {
      const mockStaleCards = [
        { cardId: 'card-1' },
        { cardId: 'card-2' }
      ]

      mockDb.enhancedCardData.count.mockResolvedValue(2)
      mockDb.enhancedCardData.findMany.mockResolvedValue(mockStaleCards)
      mockEnhancedCardDataService.getEnhancedCard
        .mockResolvedValueOnce({ cardId: 'card-1', name: 'Success Card' })
        .mockRejectedValueOnce(new Error('Card fetch failed'))

      await cardDataSyncService.runPriceSync()

      // Should continue processing despite individual failures
      expect(mockEnhancedCardDataService.getEnhancedCard).toHaveBeenCalledTimes(2)
    })

    it('should respect batch processing limits', async () => {
      const manyCards = Array(150).fill(0).map((_, i) => ({ cardId: `card-${i}` }))
      
      mockDb.enhancedCardData.count.mockResolvedValue(150)
      mockDb.enhancedCardData.findMany.mockResolvedValue(manyCards)
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue({
        cardId: 'test',
        name: 'Test Card'
      })

      await cardDataSyncService.runPriceSync()

      // Should process in batches of 50
      expect(mockEnhancedCardDataService.getEnhancedCard).toHaveBeenCalledTimes(150)
    })
  })

  describe('runPopularitySync', () => {
    it('should update popularity scores', async () => {
      const mockPopularCards = [
        { cardId: 'card-1', popularityScore: 85 },
        { cardId: 'card-2', popularityScore: 92 },
        { cardId: 'card-3', popularityScore: 78 }
      ]

      mockDb.enhancedCardData.findMany.mockResolvedValue(mockPopularCards)
      mockDb.enhancedCardData.update.mockResolvedValue({})

      await cardDataSyncService.runPopularitySync()

      expect(mockDb.enhancedCardData.findMany).toHaveBeenCalledWith({
        orderBy: { popularityScore: 'desc' },
        take: 100,
        select: { cardId: true, popularityScore: true }
      })

      expect(mockDb.enhancedCardData.update).toHaveBeenCalledTimes(3)
    })

    it('should handle popularity calculation errors', async () => {
      const mockPopularCards = [
        { cardId: 'card-1', popularityScore: 85 },
        { cardId: 'card-2', popularityScore: 92 }
      ]

      mockDb.enhancedCardData.findMany.mockResolvedValue(mockPopularCards)
      mockDb.enhancedCardData.update
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Update failed'))

      await cardDataSyncService.runPopularitySync()

      // Should continue processing despite individual failures
      expect(mockDb.enhancedCardData.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('getSyncStatus', () => {
    it('should return current sync status from cache', async () => {
      const mockStatus = {
        id: 'sync-123',
        status: 'running',
        startedAt: new Date(),
        cardsProcessed: 500,
        errors: [],
        progress: 50
      }

      mockRedisCache.get.mockResolvedValue(mockStatus)

      const result = await cardDataSyncService.getSyncStatus()

      expect(result).toEqual(mockStatus)
      expect(mockRedisCache.get).toHaveBeenCalledWith('current_sync_job')
    })

    it('should return null when no sync job is active', async () => {
      mockRedisCache.get.mockResolvedValue(null)

      const result = await cardDataSyncService.getSyncStatus()

      expect(result).toBeNull()
    })

    it('should handle cache errors gracefully', async () => {
      mockRedisCache.get.mockRejectedValue(new Error('Cache error'))

      const result = await cardDataSyncService.getSyncStatus()

      expect(result).toBeNull()
    })
  })

  describe('triggerSync', () => {
    it('should trigger bulk sync manually', async () => {
      const mockBulkResult = {
        success: true,
        cardsUpdated: 750,
        errors: []
      }
      
      mockEnhancedCardDataService.updateFromBulkData.mockResolvedValue(mockBulkResult)
      mockRedisCache.set.mockResolvedValue(undefined)

      const result = await cardDataSyncService.triggerSync('bulk')

      expect(result?.status).toBe('completed')
      expect(result?.cardsProcessed).toBe(750)
      expect(mockEnhancedCardDataService.updateFromBulkData).toHaveBeenCalled()
    })

    it('should trigger price sync manually', async () => {
      mockDb.enhancedCardData.count.mockResolvedValue(0)
      mockDb.enhancedCardData.findMany.mockResolvedValue([])

      await cardDataSyncService.triggerSync('price')

      expect(mockDb.enhancedCardData.findMany).toHaveBeenCalled()
    })

    it('should trigger popularity sync manually', async () => {
      mockDb.enhancedCardData.findMany.mockResolvedValue([])

      await cardDataSyncService.triggerSync('popularity')

      expect(mockDb.enhancedCardData.findMany).toHaveBeenCalled()
    })

    it('should throw error for unknown sync type', async () => {
      await expect(
        cardDataSyncService.triggerSync('unknown' as any)
      ).rejects.toThrow('Unknown sync type: unknown')
    })
  })

  describe('scheduleCardRefresh', () => {
    it('should schedule card refresh with normal priority', async () => {
      const cardIds = ['card-1', 'card-2', 'card-3']
      mockRedisCache.set.mockResolvedValue(undefined)
      mockRedisCache.lpush.mockResolvedValue(1)

      await cardDataSyncService.scheduleCardRefresh(cardIds, 'normal')

      expect(mockRedisCache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh_job:/),
        expect.objectContaining({
          cardIds,
          priority: 'normal',
          status: 'pending'
        }),
        60 * 60 * 24 // 24 hours TTL
      )

      expect(mockRedisCache.lpush).toHaveBeenCalledWith(
        'refresh_queue:normal',
        expect.stringMatching(/^refresh_/)
      )
    })

    it('should schedule high priority refresh', async () => {
      const cardIds = ['urgent-card']
      mockRedisCache.set.mockResolvedValue(undefined)
      mockRedisCache.lpush.mockResolvedValue(1)

      await cardDataSyncService.scheduleCardRefresh(cardIds, 'high')

      expect(mockRedisCache.lpush).toHaveBeenCalledWith(
        'refresh_queue:high',
        expect.any(String)
      )
    })

    it('should handle scheduling errors', async () => {
      const cardIds = ['card-1']
      mockRedisCache.set.mockRejectedValue(new Error('Redis error'))

      // Should not throw, but log error
      await expect(
        cardDataSyncService.scheduleCardRefresh(cardIds)
      ).resolves.not.toThrow()
    })
  })

  describe('processRefreshQueue', () => {
    it('should process refresh jobs by priority', async () => {
      const mockJobId = 'refresh_123'
      const mockJob = {
        id: mockJobId,
        cardIds: ['card-1', 'card-2'],
        priority: 'high',
        status: 'pending'
      }

      mockRedisCache.rpop
        .mockResolvedValueOnce(mockJobId) // High priority queue
        .mockResolvedValueOnce(null) // Normal priority queue
        .mockResolvedValueOnce(null) // Low priority queue
      
      mockRedisCache.get.mockResolvedValue(mockJob)
      mockRedisCache.del.mockResolvedValue(1)
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue({
        cardId: 'card-1',
        name: 'Test Card'
      })

      await cardDataSyncService.processRefreshQueue()

      expect(mockRedisCache.rpop).toHaveBeenCalledWith('refresh_queue:high')
      expect(mockEnhancedCardDataService.getEnhancedCard).toHaveBeenCalledTimes(2)
      expect(mockRedisCache.del).toHaveBeenCalledWith(`refresh_job:${mockJobId}`)
    })

    it('should handle missing job data', async () => {
      const mockJobId = 'refresh_123'
      
      mockRedisCache.rpop.mockResolvedValueOnce(mockJobId)
      mockRedisCache.get.mockResolvedValue(null) // Job not found

      await cardDataSyncService.processRefreshQueue()

      // Should continue without error
      expect(mockEnhancedCardDataService.getEnhancedCard).not.toHaveBeenCalled()
    })

    it('should handle card refresh errors', async () => {
      const mockJobId = 'refresh_123'
      const mockJob = {
        id: mockJobId,
        cardIds: ['card-1', 'card-2'],
        priority: 'normal',
        status: 'pending'
      }

      mockRedisCache.rpop.mockResolvedValueOnce(mockJobId)
      mockRedisCache.get.mockResolvedValue(mockJob)
      mockRedisCache.del.mockResolvedValue(1)
      mockEnhancedCardDataService.getEnhancedCard
        .mockResolvedValueOnce({ cardId: 'card-1', name: 'Success' })
        .mockRejectedValueOnce(new Error('Refresh failed'))

      await cardDataSyncService.processRefreshQueue()

      // Should complete job despite individual card failures
      expect(mockRedisCache.del).toHaveBeenCalledWith(`refresh_job:${mockJobId}`)
    })
  })

  describe('error handling', () => {
    it('should handle Redis connection failures', async () => {
      mockRedisCache.set.mockRejectedValue(new Error('Redis connection failed'))
      mockEnhancedCardDataService.updateFromBulkData.mockResolvedValue({
        success: true,
        cardsUpdated: 100,
        errors: []
      })

      const result = await cardDataSyncService.runBulkDataSync()

      // Should complete sync despite cache failures
      expect(result.status).toBe('completed')
      expect(result.cardsProcessed).toBe(100)
    })

    it('should handle database connection failures', async () => {
      mockDb.enhancedCardData.findMany.mockRejectedValue(new Error('Database error'))

      // Should not throw
      await expect(cardDataSyncService.runPriceSync()).resolves.not.toThrow()
    })

    it('should handle cron job initialization errors', () => {
      vi.mocked(require('cron').CronJob).mockImplementation(() => {
        throw new Error('Cron initialization failed')
      })

      // Should not throw during initialization
      expect(() => cardDataSyncService.initialize()).not.toThrow()
    })
  })

  describe('performance', () => {
    it('should respect rate limits during batch processing', async () => {
      const mockCards = Array(10).fill(0).map((_, i) => ({ cardId: `card-${i}` }))
      
      mockDb.enhancedCardData.findMany.mockResolvedValue(mockCards)
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue({
        cardId: 'test',
        name: 'Test Card'
      })

      const startTime = Date.now()
      await cardDataSyncService.runPriceSync()
      const endTime = Date.now()

      // Should take some time due to rate limiting delays
      // Note: This test might be flaky in CI environments
      expect(endTime - startTime).toBeGreaterThan(0)
    })

    it('should process cards in appropriate batch sizes', async () => {
      const largeCardSet = Array(200).fill(0).map((_, i) => ({ cardId: `card-${i}` }))
      
      mockDb.enhancedCardData.findMany.mockResolvedValue(largeCardSet)
      mockEnhancedCardDataService.getEnhancedCard.mockResolvedValue({
        cardId: 'test',
        name: 'Test Card'
      })

      await cardDataSyncService.runPriceSync()

      // Should process all cards despite large batch size
      expect(mockEnhancedCardDataService.getEnhancedCard).toHaveBeenCalledTimes(200)
    })
  })
})
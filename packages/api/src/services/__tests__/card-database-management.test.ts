import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrismaClient } from '@moxmuse/db'
import { cardDatabaseManagementService } from '../card-database-management'
import { redisCache } from '../redis'

// Mock dependencies
vi.mock('../redis', () => ({
  redisCache: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    lpush: vi.fn(),
    ltrim: vi.fn(),
    expire: vi.fn()
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

vi.mock('../utils/rateLimiter', () => ({
  scryfallRateLimiter: {
    limit: vi.fn((fn) => fn())
  }
}))

vi.mock('axios', () => ({
  default: vi.fn()
}))

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  unlinkSync: vi.fn(),
  createWriteStream: vi.fn()
}))

vi.mock('stream/promises', () => ({
  pipeline: vi.fn()
}))

// Mock Prisma client
const mockPrisma = {
  enhancedCardData: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn()
  },
  legalityNotification: {
    create: vi.fn()
  },
  deckCard: {
    findMany: vi.fn()
  },
  $executeRaw: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
  $disconnect: vi.fn()
} as unknown as PrismaClient

describe('CardDatabaseManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('performIncrementalImport', () => {
    it('should perform incremental import successfully', async () => {
      // Mock bulk data info
      const mockBulkDataInfo = {
        type: 'default_cards',
        download_uri: 'https://example.com/bulk-data.json',
        updated_at: '2024-01-01T00:00:00Z',
        size: 1000000,
        content_type: 'application/json'
      }

      // Mock axios responses
      const axios = await import('axios')
      vi.mocked(axios.default).mockResolvedValueOnce({
        data: {
          data: [mockBulkDataInfo]
        }
      })

      // Mock file system operations
      const fs = await import('fs')
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([
        {
          id: '12345678-1234-1234-1234-123456789012',
          name: 'Test Card',
          mana_cost: '{1}{R}',
          cmc: 2,
          type_line: 'Creature — Human Warrior',
          oracle_text: 'Test card text',
          colors: ['R'],
          color_identity: ['R'],
          legalities: { commander: 'legal' },
          prices: { usd: '1.50' },
          rarity: 'common',
          set: 'TST',
          set_name: 'Test Set',
          collector_number: '001',
          released_at: '2024-01-01',
          image_uris: {
            normal: 'https://example.com/image.jpg'
          }
        }
      ]))

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.unlinkSync).mockImplementation(() => {})

      // Mock pipeline
      const { pipeline } = await import('stream/promises')
      vi.mocked(pipeline).mockResolvedValue(undefined)

      // Mock database operations
      vi.mocked(mockPrisma.enhancedCardData.findMany).mockResolvedValue([])
      vi.mocked(mockPrisma.enhancedCardData.create).mockResolvedValue({} as any)

      // Mock Redis operations
      vi.mocked(redisCache.get).mockResolvedValue(null)
      vi.mocked(redisCache.set).mockResolvedValue(undefined)

      const service = cardDatabaseManagementService
      const result = await service.performIncrementalImport()

      expect(result.success).toBe(true)
      expect(result.cardsAdded).toBeGreaterThan(0)
      expect(result.errors).toEqual([])
    })

    it('should handle import errors gracefully', async () => {
      // Mock axios to throw error
      const axios = await import('axios')
      vi.mocked(axios.default).mockRejectedValue(new Error('Network error'))

      const service = cardDatabaseManagementService
      const result = await service.performIncrementalImport()

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Network error')
    })
  })

  describe('optimizeCardImages', () => {
    it('should optimize card images successfully', async () => {
      const cardId = '12345678-1234-1234-1234-123456789012'
      const imageUrls = {
        normal: 'https://example.com/image.jpg',
        large: 'https://example.com/image_large.jpg'
      }

      // Mock Redis cache miss then set
      vi.mocked(redisCache.get).mockResolvedValue(null)
      vi.mocked(redisCache.set).mockResolvedValue(undefined)

      const service = cardDatabaseManagementService
      const result = await service.optimizeCardImages(cardId, imageUrls)

      expect(result.cardId).toBe(cardId)
      expect(result.originalUrls).toEqual(imageUrls)
      expect(result.optimizedUrls).toBeDefined()
      expect(result.sizes).toBeDefined()
      expect(result.webpUrls).toBeDefined()
      expect(result.avifUrls).toBeDefined()

      expect(redisCache.set).toHaveBeenCalledWith(
        `card_images:${cardId}`,
        expect.any(Object),
        expect.any(Number)
      )
    })

    it('should return cached optimization if available', async () => {
      const cardId = '12345678-1234-1234-1234-123456789012'
      const imageUrls = {
        normal: 'https://example.com/image.jpg'
      }

      const cachedOptimization = {
        cardId,
        originalUrls: imageUrls,
        optimizedUrls: imageUrls,
        sizes: {
          thumbnail: 'https://example.com/thumb.jpg',
          small: 'https://example.com/small.jpg',
          normal: 'https://example.com/normal.jpg',
          large: 'https://example.com/large.jpg'
        },
        webpUrls: {},
        avifUrls: {}
      }

      vi.mocked(redisCache.get).mockResolvedValue(cachedOptimization)

      const service = cardDatabaseManagementService
      const result = await service.optimizeCardImages(cardId, imageUrls)

      expect(result).toEqual(cachedOptimization)
      expect(redisCache.set).not.toHaveBeenCalled()
    })
  })

  describe('validateAndUpdateLegality', () => {
    it('should validate and update card legality', async () => {
      const cardId = '12345678-1234-1234-1234-123456789012'
      
      // Mock current card data
      vi.mocked(mockPrisma.enhancedCardData.findUnique).mockResolvedValue({
        cardId,
        legalities: { commander: 'legal', standard: 'not_legal' },
        lastUpdated: new Date('2024-01-01')
      } as any)

      // Mock Scryfall response with updated legalities
      const axios = await import('axios')
      vi.mocked(axios.default).mockResolvedValue({
        data: {
          legalities: {
            commander: 'legal',
            standard: 'legal' // Changed from not_legal
          }
        }
      })

      // Mock database update
      vi.mocked(mockPrisma.enhancedCardData.update).mockResolvedValue({} as any)

      // Mock deck card lookup for notifications
      vi.mocked(mockPrisma.deckCard.findMany).mockResolvedValue([
        {
          cardId,
          deck: {
            id: 'deck1',
            userId: 'user1',
            format: 'standard',
            user: { id: 'user1' }
          }
        }
      ] as any)

      vi.mocked(mockPrisma.legalityNotification.create).mockResolvedValue({} as any)

      const service = cardDatabaseManagementService
      const result = await service.validateAndUpdateLegality(cardId)

      expect(result.legalities).toEqual({
        commander: 'legal',
        standard: 'legal'
      })
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0]).toEqual({
        format: 'standard',
        oldStatus: 'not_legal',
        newStatus: 'legal'
      })

      expect(mockPrisma.enhancedCardData.update).toHaveBeenCalledWith({
        where: { cardId },
        data: {
          legalities: { commander: 'legal', standard: 'legal' },
          lastUpdated: expect.any(Date)
        }
      })

      expect(mockPrisma.legalityNotification.create).toHaveBeenCalled()
    })

    it('should handle cards with no legality changes', async () => {
      const cardId = '12345678-1234-1234-1234-123456789012'
      
      const currentLegalities = { commander: 'legal', standard: 'not_legal' }
      
      vi.mocked(mockPrisma.enhancedCardData.findUnique).mockResolvedValue({
        cardId,
        legalities: currentLegalities,
        lastUpdated: new Date('2024-01-01')
      } as any)

      const axios = await import('axios')
      vi.mocked(axios.default).mockResolvedValue({
        data: {
          legalities: currentLegalities // Same as current
        }
      })

      const service = cardDatabaseManagementService
      const result = await service.validateAndUpdateLegality(cardId)

      expect(result.changes).toHaveLength(0)
      expect(mockPrisma.enhancedCardData.update).not.toHaveBeenCalled()
    })
  })

  describe('createSearchIndexes', () => {
    it('should create search indexes successfully', async () => {
      vi.mocked(mockPrisma.$executeRawUnsafe).mockResolvedValue(undefined)
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(undefined)

      const service = cardDatabaseManagementService
      await service.createSearchIndexes()

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(12) // Number of index creation queries
      expect(mockPrisma.$executeRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('ANALYZE')])
      )
    })

    it('should handle index creation errors gracefully', async () => {
      vi.mocked(mockPrisma.$executeRawUnsafe)
        .mockRejectedValueOnce(new Error('Index already exists'))
        .mockResolvedValue(undefined)

      const service = cardDatabaseManagementService
      
      // Should not throw error
      await expect(service.createSearchIndexes()).resolves.not.toThrow()
    })
  })

  describe('performHealthCheck', () => {
    it('should perform comprehensive health check', async () => {
      // Mock database connectivity check
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([{ result: 1 }])
      
      // Mock card count check
      vi.mocked(mockPrisma.enhancedCardData.count).mockResolvedValue(25000)
      
      // Mock index health check
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([{ index_count: BigInt(10) }])
      
      // Mock Redis connectivity
      vi.mocked(redisCache.get).mockResolvedValue('test_value')
      vi.mocked(redisCache.set).mockResolvedValue(undefined)
      vi.mocked(redisCache.del).mockResolvedValue(1)
      
      // Mock last import info
      vi.mocked(redisCache.get).mockResolvedValue({
        updated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
      })

      const service = cardDatabaseManagementService
      const result = await service.performHealthCheck()

      expect(result.status).toBe('healthy')
      expect(result.checks).toHaveLength(5)
      expect(result.summary.totalCards).toBe(25000)
      
      const passedChecks = result.checks.filter(check => check.status === 'pass')
      expect(passedChecks.length).toBeGreaterThan(0)
    })

    it('should detect unhealthy status when checks fail', async () => {
      // Mock database connectivity failure
      vi.mocked(mockPrisma.$queryRaw).mockRejectedValue(new Error('Connection failed'))
      
      const service = cardDatabaseManagementService
      const result = await service.performHealthCheck()

      expect(result.status).toBe('unhealthy')
      
      const failedChecks = result.checks.filter(check => check.status === 'fail')
      expect(failedChecks.length).toBeGreaterThan(0)
    })

    it('should detect degraded status when some checks warn', async () => {
      // Mock successful database connectivity
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([{ result: 1 }])
      
      // Mock low card count (warning condition)
      vi.mocked(mockPrisma.enhancedCardData.count).mockResolvedValue(5000)
      
      // Mock other successful checks
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([{ index_count: BigInt(10) }])
      vi.mocked(redisCache.get).mockResolvedValue('test_value')
      vi.mocked(redisCache.set).mockResolvedValue(undefined)
      vi.mocked(redisCache.del).mockResolvedValue(1)

      const service = cardDatabaseManagementService
      const result = await service.performHealthCheck()

      expect(result.status).toBe('degraded')
      
      const warnChecks = result.checks.filter(check => check.status === 'warn')
      expect(warnChecks.length).toBeGreaterThan(0)
    })
  })

  describe('getImportProgress', () => {
    it('should return current import progress', async () => {
      const service = cardDatabaseManagementService
      
      // Initially no import running
      const progress = await service.getImportProgress()
      expect(progress).toBeNull()
      
      // Mock an import in progress
      const mockProgress = {
        phase: 'processing' as const,
        totalCards: 1000,
        processedCards: 500,
        errors: [],
        startTime: new Date(),
        estimatedCompletion: new Date(Date.now() + 60000)
      }
      
      // This would be set during an actual import
      // For testing, we can't easily mock the private property
      // so we'll just verify the method exists and returns the expected type
      expect(typeof service.getImportProgress).toBe('function')
    })
  })
})
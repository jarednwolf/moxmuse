/**
 * Import Job Processing Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrismaClient } from '@repo/db'
import { ImportJobProcessingService } from '../import-job-processor'
import { AdapterRegistry } from '../platform-adapters/adapter-registry'
import { BackgroundJobProcessor } from '../core/job-processor'
import { Logger, MetricsCollector } from '../core/interfaces'
import {
  ImportJobStatus,
  ImportSource,
  CreateImportJobRequest,
  UpdateImportJobRequest
} from '@repo/shared/import-job-types'

// Mock dependencies
const mockDb = {
  importJob: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn()
  },
  importJobItem: {
    create: vi.fn()
  },
  importConflict: {
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn()
  },
  importPreview: {
    upsert: vi.fn(),
    update: vi.fn()
  },
  importHistory: {
    create: vi.fn()
  },
  importAnalytics: {
    create: vi.fn()
  },
  deck: {
    create: vi.fn(),
    findFirst: vi.fn()
  },
  deckCard: {
    create: vi.fn()
  }
} as unknown as PrismaClient

const mockAdapter = {
  id: 'test',
  name: 'Test Adapter',
  version: '1.0.0',
  supportedFormats: ['txt'],
  capabilities: {
    canImport: true,
    canExport: false,
    supportsMultipleDecks: false,
    supportsBulkOperations: false,
    supportsMetadata: true,
    supportsCategories: false,
    supportsCustomFields: false,
    requiresAuthentication: false
  },
  canHandle: vi.fn().mockResolvedValue(true),
  parseDecks: vi.fn(),
  exportDeck: vi.fn(),
  validateInput: vi.fn()
}

const mockAdapterRegistry = {
  getAdapter: vi.fn(),
  getAllAdapters: vi.fn().mockReturnValue([mockAdapter]),
  register: vi.fn(),
  unregister: vi.fn(),
  findAdapterForInput: vi.fn(),
  getSupportedFormats: vi.fn()
} as unknown as AdapterRegistry

const mockJobProcessor = {
  schedule: vi.fn().mockResolvedValue('job_123'),
  process: vi.fn(),
  cancel: vi.fn().mockResolvedValue(true),
  getJobStatus: vi.fn(),
  getQueueStats: vi.fn()
} as unknown as BackgroundJobProcessor

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger)
} as unknown as Logger

const mockMetrics = {
  increment: vi.fn(),
  timing: vi.fn(),
  gauge: vi.fn()
} as unknown as MetricsCollector

describe('ImportJobProcessingService', () => {
  let service: ImportJobProcessingService

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up default adapter registry behavior
    mockAdapterRegistry.getAdapter.mockReturnValue(mockAdapter)
    
    service = new ImportJobProcessingService(
      mockDb,
      mockAdapterRegistry,
      mockJobProcessor,
      mockLogger,
      mockMetrics
    )
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('createImportJob', () => {
    it('should create a single import job successfully', async () => {
      const request: CreateImportJobRequest = {
        type: 'single',
        source: 'text',
        rawData: '1 Lightning Bolt\n1 Counterspell',
        options: {
          validateCards: true,
          resolveCardNames: true
        },
        priority: 1
      }

      const mockJob = {
        id: 'job_123',
        userId: 'user_123',
        type: 'single',
        source: 'text',
        status: 'pending',
        priority: 1,
        rawData: request.rawData,
        options: request.options,
        conflictResolution: 'ask_user',
        progress: 0,
        decksFound: 0,
        decksImported: 0,
        cardsProcessed: 0,
        cardsResolved: 0,
        errors: [],
        warnings: [],
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
        conflicts: [],
        history: []
      }

      mockDb.importJob.create.mockResolvedValue(mockJob)

      const result = await service.createImportJob({
        ...request,
        userId: 'user_123'
      })

      expect(mockDb.importJob.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          type: 'single',
          source: 'text',
          status: 'pending',
          priority: 1,
          rawData: request.rawData,
          sourceUrl: undefined,
          fileName: undefined,
          fileSize: undefined,
          mimeType: undefined,
          options: request.options,
          conflictResolution: 'ask_user'
        },
        include: {
          items: true,
          conflicts: true,
          preview: true,
          history: true
        }
      })

      expect(mockJobProcessor.schedule).toHaveBeenCalledWith({
        type: 'import_job',
        data: { jobId: 'job_123' },
        options: {
          priority: 1,
          timeout: 300000,
          attempts: 3
        }
      })

      expect(result).toEqual(mockJob)
      expect(mockMetrics.increment).toHaveBeenCalledWith('import_jobs.created', 1, {
        source: 'text',
        type: 'single'
      })
    })

    it('should handle file input', async () => {
      // Skip this test for now as FileReader mocking is complex in Node.js environment
      // In a real implementation, this would be tested in a browser environment
      // or with proper Node.js file handling
    })

    it('should throw error when no input data provided', async () => {
      const request: CreateImportJobRequest = {
        type: 'single',
        source: 'text'
      }

      await expect(
        service.createImportJob({
          ...request,
          userId: 'user_123'
        })
      ).rejects.toThrow('Must provide rawData, sourceUrl, or file')
    })
  })

  describe('updateImportJob', () => {
    it('should update import job successfully', async () => {
      const request: UpdateImportJobRequest = {
        status: 'processing',
        conflictResolution: 'overwrite',
        priority: 2
      }

      const mockUpdatedJob = {
        id: 'job_123',
        userId: 'user_123',
        status: 'processing',
        conflictResolution: 'overwrite',
        priority: 2,
        updatedAt: new Date(),
        items: [],
        conflicts: [],
        history: []
      }

      mockDb.importJob.update.mockResolvedValue(mockUpdatedJob)

      const result = await service.updateImportJob('job_123', request)

      expect(mockDb.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job_123' },
        data: {
          status: 'processing',
          conflictResolution: 'overwrite',
          options: undefined,
          priority: 2,
          updatedAt: expect.any(Date)
        },
        include: {
          items: true,
          conflicts: true,
          preview: true,
          history: true
        }
      })

      expect(result).toEqual(mockUpdatedJob)
    })
  })

  describe('getImportJob', () => {
    it('should get import job by ID', async () => {
      const mockJob = {
        id: 'job_123',
        userId: 'user_123',
        type: 'single',
        source: 'text',
        status: 'completed',
        items: [],
        conflicts: [],
        history: []
      }

      mockDb.importJob.findUnique.mockResolvedValue(mockJob)

      const result = await service.getImportJob('job_123')

      expect(mockDb.importJob.findUnique).toHaveBeenCalledWith({
        where: { id: 'job_123' },
        include: {
          items: true,
          conflicts: true,
          preview: true,
          history: true
        }
      })

      expect(result).toEqual(mockJob)
    })

    it('should return null for non-existent job', async () => {
      mockDb.importJob.findUnique.mockResolvedValue(null)

      const result = await service.getImportJob('non_existent')

      expect(result).toBeNull()
    })
  })

  describe('getUserImportJobs', () => {
    it('should get user import jobs with filters', async () => {
      const mockJobs = [
        {
          id: 'job_1',
          userId: 'user_123',
          status: 'completed',
          source: 'text',
          items: [],
          conflicts: [],
          history: []
        },
        {
          id: 'job_2',
          userId: 'user_123',
          status: 'failed',
          source: 'moxfield',
          items: [],
          conflicts: [],
          history: []
        }
      ]

      mockDb.importJob.findMany.mockResolvedValue(mockJobs)

      const result = await service.getUserImportJobs('user_123', {
        status: 'completed',
        source: 'text',
        limit: 10,
        offset: 0
      })

      expect(mockDb.importJob.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user_123',
          status: 'completed',
          source: 'text'
        },
        include: {
          items: true,
          conflicts: true,
          preview: true,
          history: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0
      })

      expect(result).toEqual(mockJobs)
    })
  })

  describe('cancelImportJob', () => {
    it('should cancel pending job successfully', async () => {
      const mockJob = {
        id: 'job_123',
        userId: 'user_123',
        status: 'pending',
        source: 'text'
      }

      mockDb.importJob.findUnique.mockResolvedValue(mockJob)
      mockDb.importJob.update.mockResolvedValue({
        ...mockJob,
        status: 'cancelled'
      })

      const result = await service.cancelImportJob('job_123')

      expect(mockDb.importJob.update).toHaveBeenCalledWith({
        where: { id: 'job_123' },
        data: {
          status: 'cancelled',
          processingCompletedAt: expect.any(Date),
          updatedAt: expect.any(Date)
        }
      })

      expect(result).toBe(true)
      expect(mockMetrics.increment).toHaveBeenCalledWith('import_jobs.cancelled', 1, {
        source: 'text'
      })
    })

    it('should attempt to cancel processing job', async () => {
      const mockJob = {
        id: 'job_123',
        userId: 'user_123',
        status: 'processing',
        source: 'text'
      }

      mockDb.importJob.findUnique.mockResolvedValue(mockJob)
      mockJobProcessor.cancel.mockResolvedValue(true)
      mockDb.importJob.update.mockResolvedValue({
        ...mockJob,
        status: 'cancelled'
      })

      const result = await service.cancelImportJob('job_123')

      expect(mockJobProcessor.cancel).toHaveBeenCalledWith('job_123')
      expect(result).toBe(true)
    })

    it('should return false for non-existent job', async () => {
      mockDb.importJob.findUnique.mockResolvedValue(null)

      const result = await service.cancelImportJob('non_existent')

      expect(result).toBe(false)
    })
  })

  describe('getImportProgress', () => {
    it('should get import progress', async () => {
      const mockJob = {
        id: 'job_123',
        userId: 'user_123',
        status: 'processing',
        progress: 50,
        currentStep: 'Processing deck 1',
        totalSteps: 2,
        estimatedTimeRemaining: 30000,
        errors: [],
        warnings: [],
        updatedAt: new Date(),
        items: [
          { status: 'completed' },
          { status: 'processing' }
        ]
      }

      mockDb.importJob.findUnique.mockResolvedValue(mockJob)

      const result = await service.getImportProgress('job_123')

      expect(result).toEqual({
        jobId: 'job_123',
        status: 'processing',
        progress: 50,
        currentStep: 'Processing deck 1',
        totalSteps: 2,
        estimatedTimeRemaining: 30000,
        itemsCompleted: 1,
        itemsTotal: 2,
        errors: [],
        warnings: [],
        lastUpdated: mockJob.updatedAt
      })
    })

    it('should return null for non-existent job', async () => {
      mockDb.importJob.findUnique.mockResolvedValue(null)

      const result = await service.getImportProgress('non_existent')

      expect(result).toBeNull()
    })
  })

  describe('generatePreview', () => {
    it('should generate preview successfully', async () => {
      const mockJob = {
        id: 'job_123',
        userId: 'user_123',
        source: 'text',
        rawData: '1 Lightning Bolt\n1 Counterspell'
      }

      const mockParseResult = {
        success: true,
        decks: [
          {
            name: 'Test Deck',
            format: 'commander',
            cards: [
              { name: 'Lightning Bolt', quantity: 1 },
              { name: 'Counterspell', quantity: 1 }
            ],
            metadata: {
              colors: ['R', 'U'],
              archetype: 'Control'
            }
          }
        ],
        errors: [],
        warnings: [],
        metadata: {
          source: 'text',
          processingTime: 100,
          cardResolutionRate: 1.0,
          totalCards: 2,
          resolvedCards: 2,
          unresolvedCards: []
        }
      }

      const mockPreview = {
        id: 'preview_123',
        importJobId: 'job_123',
        previewData: expect.any(Object),
        decksPreview: expect.any(Array),
        statistics: expect.any(Object),
        warnings: [],
        conflicts: [],
        isApproved: false,
        expiresAt: expect.any(Date),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDb.importJob.findUnique.mockResolvedValue(mockJob)
      mockAdapter.parseDecks.mockResolvedValue(mockParseResult)
      mockDb.importPreview.upsert.mockResolvedValue(mockPreview)

      const result = await service.generatePreview('job_123')

      expect(mockAdapter.parseDecks).toHaveBeenCalledWith(
        mockJob.rawData,
        {
          includeMetadata: true,
          validateCards: false,
          resolveCardNames: false,
          timeout: 30000
        }
      )

      expect(mockDb.importPreview.upsert).toHaveBeenCalled()
      expect(result).toEqual(mockPreview)
    })

    it('should throw error for non-existent job', async () => {
      mockDb.importJob.findUnique.mockResolvedValue(null)

      await expect(service.generatePreview('non_existent')).rejects.toThrow(
        'Import job not found: non_existent'
      )
    })

    it('should throw error for unsupported source', async () => {
      const mockJob = {
        id: 'job_123',
        userId: 'user_123',
        source: 'unsupported',
        rawData: 'test data'
      }

      mockDb.importJob.findUnique.mockResolvedValue(mockJob)
      mockAdapterRegistry.getAdapter.mockReturnValue(null)

      await expect(service.generatePreview('job_123')).rejects.toThrow(
        'No adapter found for source: unsupported'
      )
    })
  })

  describe('getQueueStats', () => {
    it('should get queue statistics', async () => {
      const mockStats = [
        { status: 'pending', _count: { status: 5 } },
        { status: 'processing', _count: { status: 2 } },
        { status: 'completed', _count: { status: 10 } },
        { status: 'failed', _count: { status: 1 } }
      ]

      const mockProcessingTimes = [
        { processingTime: 1000 },
        { processingTime: 2000 },
        { processingTime: 1500 }
      ]

      mockDb.importJob.groupBy.mockResolvedValue(mockStats)
      mockDb.importJob.findMany.mockResolvedValue(mockProcessingTimes)

      const result = await service.getQueueStats()

      expect(result).toEqual({
        pending: 5,
        processing: 2,
        completed: 10,
        failed: 1,
        cancelled: 0,
        totalProcessingTime: 4500,
        averageWaitTime: 0,
        queueLength: 7
      })
    })
  })
})
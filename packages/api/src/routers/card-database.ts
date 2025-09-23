import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'
import { cardDatabaseManagementService } from '../services/card-database-management'
import { enhancedCardSearchService } from '../services/enhanced-card-search'
import { syncJobSchedulerService } from '../services/sync-job-scheduler'
import { logger } from '../services/core/logging'

// Input schemas
const SearchQuerySchema = z.object({
  text: z.string().optional(),
  name: z.string().optional(),
  oracleText: z.string().optional(),
  typeText: z.string().optional(),
  cmcRange: z.tuple([z.number(), z.number()]).optional(),
  powerRange: z.tuple([z.number(), z.number()]).optional(),
  toughnessRange: z.tuple([z.number(), z.number()]).optional(),
  priceRange: z.tuple([z.number(), z.number()]).optional(),
  colors: z.array(z.string()).optional(),
  colorIdentity: z.array(z.string()).optional(),
  rarities: z.array(z.string()).optional(),
  sets: z.array(z.string()).optional(),
  formats: z.array(z.string()).optional(),
  synergyTags: z.array(z.string()).optional(),
  isLegal: z.record(z.boolean()).optional(),
  hasKeywords: z.array(z.string()).optional(),
  producesColors: z.array(z.string()).optional(),
  minPopularity: z.number().optional(),
  maxPopularity: z.number().optional(),
  edhrecRankRange: z.tuple([z.number(), z.number()]).optional(),
  exactMatch: z.boolean().default(false),
  fuzzySearch: z.boolean().default(true),
  includeReprints: z.boolean().default(false),
  sortBy: z.enum([
    'name', 'cmc', 'power', 'toughness', 'price', 'popularity', 
    'edhrecRank', 'releaseDate', 'relevance'
  ]).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().min(1).max(500).default(50),
  offset: z.number().min(0).default(0)
})

const SimilarCardsOptionsSchema = z.object({
  similarity: z.enum(['mechanical', 'thematic', 'statistical', 'all']).default('all'),
  limit: z.number().min(1).max(50).default(20),
  excludeReprints: z.boolean().default(true)
})

const SemanticSearchOptionsSchema = z.object({
  colors: z.array(z.string()).optional(),
  format: z.string().optional(),
  powerLevel: z.number().min(1).max(10).optional(),
  limit: z.number().min(1).max(100).default(20)
})

export const cardDatabaseRouter = createTRPCRouter({
  /**
   * Advanced card search with full-text search and faceting
   */
  search: publicProcedure
    .input(SearchQuerySchema)
    .query(async ({ input, ctx }) => {
      try {
        const userId = ctx.session?.user?.id
        
        const searchQuery = {
          ...input,
          userId,
          sessionId: ctx.session?.sessionToken
        }

        const results = await enhancedCardSearchService.searchCards(searchQuery)
        
        return {
          success: true,
          data: results
        }
      } catch (error) {
        logger.error('Card search failed', { input, error })
        throw new Error('Failed to search cards')
      }
    }),

  /**
   * Get search suggestions for autocomplete
   */
  searchSuggestions: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(20).default(10),
      context: z.object({
        recentSearches: z.array(z.string()).optional(),
        currentDeck: z.array(z.string()).optional()
      }).optional()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const userId = ctx.session?.user?.id
        
        const context = {
          ...input.context,
          userId
        }

        const suggestions = await enhancedCardSearchService.getSearchSuggestions(
          input.query,
          context,
          input.limit
        )
        
        return {
          success: true,
          data: suggestions
        }
      } catch (error) {
        logger.error('Search suggestions failed', { input, error })
        return {
          success: false,
          data: [],
          error: 'Failed to get search suggestions'
        }
      }
    }),

  /**
   * Semantic search using concepts and themes
   */
  semanticSearch: publicProcedure
    .input(z.object({
      concept: z.string().min(1),
      options: SemanticSearchOptionsSchema.optional()
    }))
    .query(async ({ input }) => {
      try {
        const results = await enhancedCardSearchService.semanticSearch(
          input.concept,
          input.options || {}
        )
        
        return {
          success: true,
          data: results
        }
      } catch (error) {
        logger.error('Semantic search failed', { input, error })
        throw new Error('Failed to perform semantic search')
      }
    }),

  /**
   * Find similar cards based on characteristics
   */
  findSimilar: publicProcedure
    .input(z.object({
      cardId: z.string().uuid(),
      options: SimilarCardsOptionsSchema.optional()
    }))
    .query(async ({ input }) => {
      try {
        const results = await enhancedCardSearchService.findSimilarCards(
          input.cardId,
          input.options || {}
        )
        
        return {
          success: true,
          data: results
        }
      } catch (error) {
        logger.error('Similar cards search failed', { input, error })
        throw new Error('Failed to find similar cards')
      }
    }),

  /**
   * Get card database health status
   */
  healthCheck: publicProcedure
    .query(async () => {
      try {
        const health = await cardDatabaseManagementService.performHealthCheck()
        
        return {
          success: true,
          data: health
        }
      } catch (error) {
        logger.error('Health check failed', { error })
        return {
          success: false,
          data: {
            status: 'unhealthy' as const,
            checks: [],
            summary: {
              totalCards: 0,
              lastImport: null,
              indexHealth: 'fail',
              cacheHealth: 'fail'
            }
          },
          error: 'Health check failed'
        }
      }
    }),

  /**
   * Get import progress status
   */
  importProgress: publicProcedure
    .query(async () => {
      try {
        const progress = await cardDatabaseManagementService.getImportProgress()
        
        return {
          success: true,
          data: progress
        }
      } catch (error) {
        logger.error('Failed to get import progress', { error })
        return {
          success: false,
          data: null,
          error: 'Failed to get import progress'
        }
      }
    }),

  /**
   * Validate and update card legality
   */
  validateLegality: protectedProcedure
    .input(z.object({
      cardId: z.string().uuid()
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await cardDatabaseManagementService.validateAndUpdateLegality(
          input.cardId
        )
        
        return {
          success: true,
          data: result
        }
      } catch (error) {
        logger.error('Legality validation failed', { input, error })
        throw new Error('Failed to validate card legality')
      }
    }),

  /**
   * Optimize card images
   */
  optimizeImages: protectedProcedure
    .input(z.object({
      cardId: z.string().uuid(),
      imageUrls: z.record(z.string())
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await cardDatabaseManagementService.optimizeCardImages(
          input.cardId,
          input.imageUrls
        )
        
        return {
          success: true,
          data: result
        }
      } catch (error) {
        logger.error('Image optimization failed', { input, error })
        throw new Error('Failed to optimize card images')
      }
    }),

  // Sync job management endpoints
  sync: createTRPCRouter({
    /**
     * Get status of all sync jobs
     */
    getJobStatuses: protectedProcedure
      .query(async () => {
        try {
          const statuses = await syncJobSchedulerService.getJobStatuses()
          
          return {
            success: true,
            data: statuses
          }
        } catch (error) {
          logger.error('Failed to get job statuses', { error })
          throw new Error('Failed to get sync job statuses')
        }
      }),

    /**
     * Get detailed status of a specific job
     */
    getJobStatus: protectedProcedure
      .input(z.object({
        jobName: z.string()
      }))
      .query(async ({ input }) => {
        try {
          const status = await syncJobSchedulerService.getJobStatus(input.jobName)
          
          return {
            success: true,
            data: status
          }
        } catch (error) {
          logger.error('Failed to get job status', { input, error })
          throw new Error('Failed to get sync job status')
        }
      }),

    /**
     * Manually trigger a sync job
     */
    triggerJob: protectedProcedure
      .input(z.object({
        jobName: z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await syncJobSchedulerService.triggerJob(input.jobName)
          
          return {
            success: result.success,
            data: result,
            message: result.message
          }
        } catch (error) {
          logger.error('Failed to trigger job', { input, error })
          throw new Error('Failed to trigger sync job')
        }
      }),

    /**
     * Enable or disable a sync job
     */
    toggleJob: protectedProcedure
      .input(z.object({
        jobName: z.string(),
        enabled: z.boolean()
      }))
      .mutation(async ({ input }) => {
        try {
          await syncJobSchedulerService.toggleJob(input.jobName, input.enabled)
          
          return {
            success: true,
            message: `Job ${input.enabled ? 'enabled' : 'disabled'} successfully`
          }
        } catch (error) {
          logger.error('Failed to toggle job', { input, error })
          throw new Error('Failed to toggle sync job')
        }
      }),

    /**
     * Update job schedule
     */
    updateSchedule: protectedProcedure
      .input(z.object({
        jobName: z.string(),
        schedule: z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          await syncJobSchedulerService.updateJobSchedule(
            input.jobName, 
            input.schedule
          )
          
          return {
            success: true,
            message: 'Job schedule updated successfully'
          }
        } catch (error) {
          logger.error('Failed to update job schedule', { input, error })
          throw new Error('Failed to update job schedule')
        }
      }),

    /**
     * Get job execution history
     */
    getJobHistory: protectedProcedure
      .input(z.object({
        jobName: z.string(),
        limit: z.number().min(1).max(100).default(50)
      }))
      .query(async ({ input }) => {
        try {
          const history = await syncJobSchedulerService.getJobHistory(
            input.jobName,
            input.limit
          )
          
          return {
            success: true,
            data: history
          }
        } catch (error) {
          logger.error('Failed to get job history', { input, error })
          throw new Error('Failed to get job execution history')
        }
      }),

    /**
     * Clear job execution history
     */
    clearJobHistory: protectedProcedure
      .input(z.object({
        jobName: z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          await syncJobSchedulerService.clearJobHistory(input.jobName)
          
          return {
            success: true,
            message: 'Job history cleared successfully'
          }
        } catch (error) {
          logger.error('Failed to clear job history', { input, error })
          throw new Error('Failed to clear job history')
        }
      })
  }),

  // Database management endpoints
  management: createTRPCRouter({
    /**
     * Perform incremental bulk import
     */
    performImport: protectedProcedure
      .mutation(async () => {
        try {
          const result = await cardDatabaseManagementService.performIncrementalImport()
          
          return {
            success: result.success,
            data: result,
            message: `Import completed: ${result.cardsAdded} added, ${result.cardsUpdated} updated`
          }
        } catch (error) {
          logger.error('Bulk import failed', { error })
          throw new Error('Failed to perform bulk import')
        }
      }),

    /**
     * Create search indexes
     */
    createIndexes: protectedProcedure
      .mutation(async () => {
        try {
          await cardDatabaseManagementService.createSearchIndexes()
          
          return {
            success: true,
            message: 'Search indexes created successfully'
          }
        } catch (error) {
          logger.error('Index creation failed', { error })
          throw new Error('Failed to create search indexes')
        }
      }),

    /**
     * Setup automated sync jobs
     */
    setupSyncJobs: protectedProcedure
      .mutation(async () => {
        try {
          await cardDatabaseManagementService.setupAutomatedSyncJobs()
          
          return {
            success: true,
            message: 'Automated sync jobs setup successfully'
          }
        } catch (error) {
          logger.error('Sync jobs setup failed', { error })
          throw new Error('Failed to setup automated sync jobs')
        }
      })
  })
})
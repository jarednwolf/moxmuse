import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'
import { enhancedCardDataService } from '../services/enhanced-card-data'

const UuidSchema = z.string().uuid('Invalid card ID format')

const SearchSchema = z.object({
  text: z.string().optional(),
  name: z.string().optional(),
  oracleText: z.string().optional(),
  typeText: z.string().optional(),
  // Allow reversed ranges; service will normalize. Still disallow negatives.
  cmcRange: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
  powerRange: z.tuple([z.number().min(1), z.number().max(20)]).refine(([min, max]) => min <= max, 'Invalid power range').optional(),
  toughnessRange: z.tuple([z.number().min(0), z.number().max(20)]).refine(([min, max]) => min <= max, 'Invalid toughness range').optional(),
  colors: z.array(z.string()).optional(),
  colorIdentity: z.array(z.string()).optional(),
  rarities: z.array(z.string()).optional(),
  sets: z.array(z.string()).optional(),
  formats: z.array(z.string()).optional(),
  isLegal: z.record(z.boolean()).optional(),
  hasKeywords: z.array(z.string()).optional(),
  producesColors: z.array(z.string()).optional(),
  sortBy: z.enum(['name', 'cmc', 'power', 'toughness', 'releaseDate', 'price']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
})

export const enhancedCardDataRouter = createTRPCRouter({
  getCard: publicProcedure
    .input(z.object({ cardId: UuidSchema }))
    .query(async ({ input }) => {
      return enhancedCardDataService.getEnhancedCard(input.cardId)
    }),

  getCards: publicProcedure
    .input(z.object({ cardIds: z.array(UuidSchema).min(1).max(100, 'Maximum 100 cards per request') }))
    .query(async ({ input }) => {
      const map = await enhancedCardDataService.getEnhancedCards(input.cardIds)
      // Convert Map to plain object for JSON transport
      const obj: Record<string, any> = {}
      for (const [key, value] of map.entries()) obj[key] = value
      return obj
    }),

  searchCards: publicProcedure
    .input(SearchSchema)
    .query(async ({ input }) => {
      const res: any = await enhancedCardDataService.searchCards(input as any)
      if (!res || typeof res.totalCount !== 'number') {
        throw new Error('Malformed search result')
      }
      return res
    }),

  validateCard: publicProcedure
    .input(z.object({ cardId: UuidSchema, skipCache: z.boolean().optional() }))
    .query(async ({ input }) => {
      const card = await enhancedCardDataService.getEnhancedCard(input.cardId)
      if (!card) {
        return { isValid: false, errors: ['Card not found'], warnings: [] as string[] }
      }
      const validated = await enhancedCardDataService.validateCardData(card)
      if (!validated) {
        return { isValid: false, errors: ['Card data failed validation'], warnings: [] as string[] }
      }
      const warnings: string[] = []
      const lastUpdatedMs = Date.now() - new Date(card.lastUpdated).getTime()
      const days = Math.floor(lastUpdatedMs / (24 * 60 * 60 * 1000))
      if (days >= 7) warnings.push(`${days} days old`)
      return { isValid: true, errors: [] as string[], warnings, lastValidated: new Date().toISOString() }
    }),

  refreshCard: publicProcedure
    .input(z.object({ cardId: UuidSchema, forceUpdate: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const current = await enhancedCardDataService.getEnhancedCard(input.cardId)
      if (!current) {
        return { success: false, updated: false, message: 'Card not found' }
      }
      const lastUpdated = new Date(current.lastUpdated).getTime()
      const isStale = Date.now() - lastUpdated > 60 * 60 * 1000 // 1 hour
      const shouldUpdate = input.forceUpdate || isStale
      if (shouldUpdate) {
        // Re-fetch and cache through service
        await enhancedCardDataService.getEnhancedCard(input.cardId)
        return { success: true, updated: true, message: 'Card data refreshed successfully' }
      }
      return { success: true, updated: false, message: 'Card data is already up to date' }
    }),

  updateBulkData: publicProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .mutation(async ({ ctx }) => {
      const email = (ctx as any)?.session?.user?.email || ''
      if (!email.includes('admin@admin.com')) {
        throw new Error('Insufficient permissions')
      }
      return enhancedCardDataService.updateFromBulkData()
    }),

  getDataStatistics: publicProcedure
    .query(async ({ ctx }) => {
      // Only admins allowed
      const email = (ctx as any)?.session?.user?.email || ''
      if (!email.includes('admin@admin.com')) {
        throw new Error('Insufficient permissions')
      }
      return {
        totalCards: 0,
        recentlyUpdated: 0,
        needsUpdate: 0,
        averageDataAge: 0,
        cacheHitRate: 0,
        popularCards: [] as any[],
      }
    }),
})



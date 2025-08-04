import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { scryfallService } from '../services/scryfall'
import { CollectionProxyService } from '../services/collection-proxy'
import { MoxfieldService } from '../services/moxfield'
import { redisCache } from '../services/redis'
import { CardLookupService } from '../services/card-lookup'

export const collectionRouter = createTRPCRouter({
  // Get user's collection
  get: protectedProcedure.query(async ({ ctx }) => {
    console.log('collection.get - User ID:', ctx.session.user.id)
    
    const proxyService = new CollectionProxyService(ctx.prisma)
    const collection = await proxyService.fetchCollection(ctx.session.user.id)
    
    console.log('collection.get - Fetched cards:', collection.cards.length)
    console.log('collection.get - Sample cards:', collection.cards.slice(0, 3))
    
    // Get unique card IDs and fetch Scryfall data
    const uniqueCardIds = Array.from(new Set(collection.cards.map(c => c.cardId)))
    const scryfallCards = await scryfallService.getCards(uniqueCardIds)
    
    // Create a map for quick lookup
    const cardDataMap = new Map<string, any>()
    scryfallCards.forEach((card, index) => {
      if (card) {
        cardDataMap.set(uniqueCardIds[index], card)
      }
    })
    
    console.log('collection.get - Fetched Scryfall data for', cardDataMap.size, 'unique cards')
    
    // Enrich collection cards with Scryfall data
    const enrichedCards = collection.cards.map(item => ({
      cardId: item.cardId,
      quantity: item.quantity,
      foilQuantity: item.foilQuantity || 0,
      condition: item.condition || 'NM',
      language: item.language || 'en',
      card: cardDataMap.get(item.cardId) || null
    }))
    
    console.log('collection.get - Returning enriched cards:', enrichedCards.length)
    console.log('collection.get - Sample enriched:', enrichedCards.slice(0, 3).map(c => ({ 
      cardId: c.cardId, 
      name: c.card?.name,
      hasData: !!c.card
    })))
    
    return enrichedCards
  }),

  // Get card details for multiple cards
  getCardDetails: publicProcedure
    .input(z.object({
      cardIds: z.array(z.string()),
    }))
    .query(async ({ input }) => {
      const { cardIds } = input
      
      if (cardIds.length === 0) return []
      
      // Use optimized batch fetching
      const cardDetails = await scryfallService.getCards(cardIds)
      
      // Filter out null results
      return cardDetails.filter(Boolean)
    }),

  // Check ownership status for cards
  checkOwnership: protectedProcedure
    .input(z.object({
      cardIds: z.array(z.string()),
    }))
    .query(async ({ ctx, input }) => {
      const proxyService = new CollectionProxyService(ctx.prisma)
      const ownership = await proxyService.checkOwnership(ctx.session.user.id, input.cardIds)
      
      return Object.fromEntries(ownership)
    }),

  // Add a collection source (Moxfield public, Archidekt, etc)
  addSource: protectedProcedure
    .input(z.object({
      type: z.enum(['moxfield', 'archidekt']),
      username: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const proxyService = new CollectionProxyService(ctx.prisma)
      
      // Debug logging
      console.log('AddSource - Session user:', ctx.session.user)
      console.log('AddSource - User ID:', ctx.session.user.id)
      
      // Ensure we have a valid user ID
      if (!ctx.session.user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID not found in session'
        })
      }
      
      try {
        await proxyService.addCollectionSource(
          ctx.session.user.id,
          input.type,
          input.username
        )
        
        return {
          success: true,
          message: `Successfully connected to ${input.type} account: ${input.username}`
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to connect to ${input.type}`
        })
      }
    }),

  // Import collection from CSV/text
  importCSV: protectedProcedure
    .input(z.object({
      csvData: z.array(z.object({
        cardId: z.string().optional(),
        name: z.string(),
        quantity: z.number().min(1),
        foilQuantity: z.number().min(0).optional(),
        condition: z.enum(['NM', 'LP', 'MP', 'HP', 'DMG']).optional(),
        language: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const proxyService = new CollectionProxyService(ctx.prisma)
      
      // Map names to Scryfall IDs if needed
      const cardsWithIds = []
      for (const card of input.csvData) {
        let cardId = card.cardId
        let setCode: string | undefined
        let collectorNumber: string | undefined
        
        if (!cardId && card.name) {
          // Parse Moxfield format: "Card Name (SET) CollectorNumber"
          let searchName = card.name
          const moxfieldMatch = card.name.match(/^(.+?)\s*\(([A-Z0-9]+)\)\s*([\w-]+)$/)
          if (moxfieldMatch) {
            searchName = moxfieldMatch[1].trim()
            setCode = moxfieldMatch[2]
            collectorNumber = moxfieldMatch[3]
            console.log(`Parsed Moxfield format: "${card.name}" -> name: "${searchName}", set: "${setCode}", number: "${collectorNumber}"`)
          }
          
          // Use the new lookup service
          const lookupResult = await CardLookupService.lookupByName(searchName, setCode, collectorNumber)
          
          if (lookupResult) {
            cardId = lookupResult.scryfallId
            console.log(`Found card: ${searchName} -> ${cardId}`)
          } else {
            console.log(`Card not found: ${searchName}`)
            continue // Skip cards we can't identify
          }
        }
        
        if (cardId) {
          cardsWithIds.push({
            cardId,
            quantity: card.quantity,
            foilQuantity: card.foilQuantity || 0,
            condition: card.condition || 'NM',
            language: card.language || 'en',
          })
        }
      }
      
      // Import the collection
      await proxyService.importCollection(ctx.session.user.id, cardsWithIds)
      
      return {
        imported: cardsWithIds.length,
        skipped: input.csvData.length - cardsWithIds.length,
        message: `Imported ${cardsWithIds.length} cards successfully`
      }
    }),

  // Get collection stats
  stats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const proxyService = new CollectionProxyService(ctx.prisma)
      const collection = await proxyService.fetchCollection(ctx.session.user.id)
      
      // Calculate stats
      const totalCards = collection.cards.reduce((sum, card) => 
        sum + card.quantity + card.foilQuantity, 0
      )
      
      const uniqueCards = collection.cards.length
      
      // Get card details for color distribution
      const cardIds = collection.cards.map(c => c.cardId)
      const cardDetails = await scryfallService.getCards(cardIds)
      
      // Calculate color distribution
      const colorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
      
      cardDetails.forEach((card, index) => {
        if (!card) return
        
        const quantity = collection.cards[index]!.quantity + collection.cards[index]!.foilQuantity
        
        if (!card.colors || card.colors.length === 0) {
          colorCounts.C += quantity
        } else {
          card.colors.forEach(color => {
            if (color in colorCounts) {
              colorCounts[color as keyof typeof colorCounts] += quantity
            }
          })
        }
      })
      
      return {
        totalCards,
        uniqueCards,
        totalValue: collection.totalValue || 0,
        colorDistribution: colorCounts,
        lastUpdated: collection.lastUpdated
      }
    } catch (error) {
      // Return default stats if collection fetch fails
      return {
        totalCards: 0,
        uniqueCards: 0,
        totalValue: 0,
        colorDistribution: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        lastUpdated: null
      }
    }
  }),

  // Get connected collection sources
  getSources: protectedProcedure.query(async ({ ctx }) => {
    console.log('getSources - User ID:', ctx.session.user.id)
    
    const sources = await (ctx.prisma as any).collectionSource.findMany({
      where: { 
        userId: ctx.session.user.id,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    })
    
    console.log('getSources - Found sources:', sources.length)
    console.log('getSources - Sources:', JSON.stringify(sources, null, 2))
    
    return {
      sources: sources.map((source: any) => ({
        id: source.id,
        type: source.type as 'manual' | 'moxfield' | 'archidekt',
        name: source.name,
        connected: true,
        username: source.username,
        lastSynced: source.lastSynced
      }))
    }
  }),

  // Remove a collection source
  removeSource: protectedProcedure
    .input(z.object({
      type: z.enum(['manual', 'moxfield', 'archidekt']),
      username: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Remove the source from the database
      const result = await (ctx.prisma as any).collectionSource.updateMany({
        where: {
          userId: ctx.session.user.id,
          type: input.type,
          ...(input.username ? { username: input.username } : {})
        },
        data: {
          isActive: false
        }
      })
      
      if (input.type === 'manual') {
        // Also clear local collection data for manual sources
        await ctx.prisma.collectionCard.deleteMany({
          where: { userId: ctx.session.user.id }
        })
      }
      
      return {
        success: true,
        message: `${input.type} source removed successfully`
      }
    }),

  // List Moxfield user decks
  listMoxfieldDecks: protectedProcedure
    .input(z.object({
      username: z.string().min(1)
    }))
    .query(async ({ input }) => {
      try {
        const username = MoxfieldService.extractUsername(input.username)
        const decks = await MoxfieldService.listUserDecks(username)
        
        return {
          username,
          decks: decks.map(deck => ({
            id: deck.publicId,
            name: deck.name,
            format: deck.format,
            updatedAt: deck.updatedAt,
            mainboardCount: deck.mainboardCount || 0,
            sideboardCount: deck.sideboardCount || 0
          }))
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch Moxfield decks'
        })
      }
    }),

  // Import multiple Moxfield decks
  importMoxfieldDecks: protectedProcedure
    .input(z.object({
      deckIds: z.array(z.string()).min(1).max(10) // Limit to 10 decks at once
    }))
    .mutation(async ({ ctx, input }) => {
      const proxyService = new CollectionProxyService(ctx.prisma)
      const results = []
      
      for (const deckId of input.deckIds) {
        try {
          // Add each deck as a separate source
          await proxyService.addCollectionSource(
            ctx.session.user.id,
            'moxfield',
            deckId
          )
          
          results.push({
            deckId,
            success: true,
            message: 'Deck imported successfully'
          })
        } catch (error) {
          console.error(`Failed to import deck ${deckId}:`, error)
          results.push({
            deckId,
            success: false,
            message: error instanceof Error ? error.message : 'Failed to import deck'
          })
        }
      }
      
      return {
        results,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      }
    }),

  // Debug endpoint to check collection sources and cached data
  debug: protectedProcedure.query(async ({ ctx }) => {
    const sources = await (ctx.prisma as any).collectionSource.findMany({
      where: { userId: ctx.session.user.id }
    })
    
    const proxyService = new CollectionProxyService(ctx.prisma)
    const cacheStatus = []
    
    for (const source of sources) {
      const cached = await redisCache.get<any>(`collection:${source.id}`)
      const backup = await redisCache.get<any>(`collection:backup:${source.id}`)
      
      cacheStatus.push({
        source: {
          id: source.id,
          type: source.type,
          username: source.username,
          isActive: source.isActive,
          lastSynced: source.lastSynced,
          metadata: source.metadata
        },
        hasCachedData: !!cached,
        hasBackupData: !!backup,
        cachedCardCount: cached?.cards?.length || 0,
        backupCardCount: backup?.cards?.length || 0
      })
    }
    
    return {
      userId: ctx.session.user.id,
      sourcesCount: sources.length,
      sources: cacheStatus
    }
  }),

  // Debug endpoint to check cache
  debugCache: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session?.user?.id
      
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Must be logged in to debug cache'
        })
      }
      
      // Get all collection sources
      const sources = await ctx.prisma.collectionSource.findMany({
        where: { userId }
      })
      
      // Check cache for each source
      const cacheStatus = []
      for (const source of sources) {
        const cached = await redisCache.get(`collection:${source.id}`)
        const backupCached = await redisCache.get(`collection:backup:${source.id}`)
        cacheStatus.push({
          sourceId: source.id,
          type: source.type,
          username: source.username,
          hasPrimaryCache: !!cached,
          hasBackupCache: !!backupCached,
          primaryCacheSample: cached ? (cached as any).cards?.slice(0, 2) : null,
          backupCacheSample: backupCached ? (backupCached as any).cards?.slice(0, 2) : null
        })
      }
      
      return cacheStatus
    }),
    
  // Clear cache endpoint
  clearCache: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.session?.user?.id
      
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Must be logged in to clear cache'
        })
      }
      
      // Get all collection sources
      const sources = await ctx.prisma.collectionSource.findMany({
        where: { userId }
      })
      
      // Clear cache for each source
      for (const source of sources) {
        await redisCache.del(`collection:${source.id}`)
        await redisCache.del(`collection:backup:${source.id}`)
      }
      
      // Also clear the main collection cache
      await redisCache.del(`collection:${userId}`)
      
      return { success: true, cleared: sources.length }
    })
})

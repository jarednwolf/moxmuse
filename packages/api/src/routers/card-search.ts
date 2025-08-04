import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'
import { cardSearchService } from '../services/card-search'
import { prisma } from '@moxmuse/db'
import {
  CardSearchQuerySchema,
  SearchCardsInputSchema,
  SaveSearchInputSchema,
  GetSearchSuggestionsInputSchema
} from '@moxmuse/shared'

export const cardSearchRouter = createTRPCRouter({
  /**
   * Search cards with advanced filtering and ranking
   */
  searchCards: publicProcedure
    .input(SearchCardsInputSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id
      
      return await cardSearchService.searchCards(
        input.query,
        userId,
        true // includeAnalytics
      )
    }),

  /**
   * Get search suggestions for autocomplete
   */
  getSearchSuggestions: publicProcedure
    .input(GetSearchSuggestionsInputSchema)
    .query(async ({ input }) => {
      return await cardSearchService.getSearchSuggestions(
        input.query,
        input.limit || 10,
        input.types
      )
    }),

  /**
   * Save a search query for later use
   */
  saveSearch: protectedProcedure
    .input(SaveSearchInputSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id
      
      return await cardSearchService.saveSearch(
        userId,
        input.name,
        input.description,
        input.query,
        input.isPublic || false,
        input.tags
      )
    }),

  /**
   * Get user's saved searches
   */
  getSavedSearches: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id
      return await cardSearchService.getSavedSearches(userId)
    }),

  /**
   * Delete a saved search
   */
  deleteSavedSearch: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id
      
      // Verify ownership
      const savedSearch = await cardSearchService.getSavedSearches(userId)
      const search = savedSearch.find(s => s.id === input.id)
      
      if (!search) {
        throw new Error('Saved search not found')
      }

      // Delete from database
      await prisma.savedSearch.delete({
        where: { id: input.id }
      })

      return { success: true }
    }),

  /**
   * Update a saved search
   */
  updateSavedSearch: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      query: CardSearchQuerySchema.optional(),
      isPublic: z.boolean().optional(),
      tags: z.array(z.string()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id
      
      // Verify ownership
      const savedSearch = await cardSearchService.getSavedSearches(userId)
      const search = savedSearch.find(s => s.id === input.id)
      
      if (!search) {
        throw new Error('Saved search not found')
      }

      // Update in database
      const updated = await prisma.savedSearch.update({
        where: { id: input.id },
        data: {
          name: input.name || search.name,
          description: input.description !== undefined ? input.description : search.description,
          query: input.query ? JSON.stringify(input.query) : JSON.stringify(search.query),
          isPublic: input.isPublic !== undefined ? input.isPublic : search.isPublic,
          tags: input.tags || search.tags,
          updatedAt: new Date()
        }
      })

      return {
        id: updated.id,
        userId: updated.userId,
        name: updated.name,
        description: updated.description || undefined,
        query: JSON.parse(updated.query),
        isPublic: updated.isPublic,
        tags: updated.tags,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        lastUsed: updated.lastUsed?.toISOString(),
        useCount: updated.useCount
      }
    }),

  /**
   * Use a saved search (increment use count and update last used)
   */
  useSavedSearch: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id
      
      // Verify ownership
      const savedSearch = await cardSearchService.getSavedSearches(userId)
      const search = savedSearch.find(s => s.id === input.id)
      
      if (!search) {
        throw new Error('Saved search not found')
      }

      // Update usage stats
      await prisma.savedSearch.update({
        where: { id: input.id },
        data: {
          useCount: { increment: 1 },
          lastUsed: new Date()
        }
      })

      return search.query
    }),

  /**
   * Get user's search history
   */
  getSearchHistory: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id
      return await cardSearchService.getSearchHistory(userId, input.limit || 50)
    }),

  /**
   * Clear user's search history
   */
  clearSearchHistory: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id
      
      await prisma.searchHistory.deleteMany({
        where: { userId }
      })

      return { success: true }
    }),

  /**
   * Get popular searches (public endpoint)
   */
  getPopularSearches: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input }) => {
      // Get most popular saved searches that are public
      const popularSearches = await prisma.savedSearch.findMany({
        where: { isPublic: true },
        orderBy: { useCount: 'desc' },
        take: input.limit || 10,
        select: {
          id: true,
          name: true,
          description: true,
          query: true,
          tags: true,
          useCount: true,
          createdAt: true
        }
      })

      return popularSearches.map(search => ({
        id: search.id,
        name: search.name,
        description: search.description || undefined,
        query: JSON.parse(search.query),
        tags: search.tags,
        useCount: search.useCount,
        createdAt: search.createdAt.toISOString()
      }))
    }),

  /**
   * Get search analytics (admin only)
   */
  getSearchAnalytics: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().optional()
    }))
    .query(async ({ input, ctx }) => {
      // TODO: Add admin check
      const userId = ctx.session.user.id
      
      const whereClause: any = { userId }
      
      if (input.startDate) {
        whereClause.timestamp = { gte: new Date(input.startDate) }
      }
      
      if (input.endDate) {
        whereClause.timestamp = {
          ...whereClause.timestamp,
          lte: new Date(input.endDate)
        }
      }

      const analytics = await prisma.searchAnalytics.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: input.limit || 100
      })

      return analytics.map(entry => ({
        query: entry.query,
        resultCount: entry.resultCount,
        clickThroughRate: entry.clickThroughRate,
        averagePosition: entry.averagePosition,
        searchTime: entry.searchTime,
        timestamp: entry.timestamp.toISOString()
      }))
    }),

  /**
   * Record card click for analytics
   */
  recordCardClick: protectedProcedure
    .input(z.object({
      cardId: z.string(),
      query: z.string(),
      position: z.number()
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id
      
      // Record the click for analytics
      await prisma.cardClick.create({
        data: {
          userId,
          cardId: input.cardId,
          query: input.query,
          position: input.position,
          timestamp: new Date()
        }
      })

      return { success: true }
    })
})

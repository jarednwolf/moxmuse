import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'

export const deckRouter = createTRPCRouter({
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id
      
      return await ctx.prisma.deck.findMany({
        where: { userId },
        include: {
          _count: {
            select: { cards: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })
    }),

  getById: publicProcedure
    .input(z.object({
      deckId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input.deckId },
        include: {
          cards: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      })

      if (!deck) {
        throw new Error('Deck not found')
      }

      // Check if user can view this deck
      const isOwner = ctx.session?.user?.id === deck.userId
      if (!deck.isPublic && !isOwner) {
        throw new Error('Deck is private')
      }

      return deck
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      format: z.enum(['commander']).default('commander'),
      commander: z.string().optional(),
      description: z.string().optional(),
      isPublic: z.boolean().default(false),
      powerLevel: z.number().min(1).max(10).optional(),
      budget: z.number().optional(),
      tags: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      return await ctx.prisma.deck.create({
        data: {
          ...input,
          userId,
        },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      isPublic: z.boolean().optional(),
      powerLevel: z.number().min(1).max(10).optional(),
      budget: z.number().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { deckId, ...updateData } = input

      return await ctx.prisma.deck.update({
        where: {
          id: deckId,
          userId, // Ensure user owns the deck
        },
        data: updateData,
      })
    }),

  delete: protectedProcedure
    .input(z.object({
      deckId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      return await ctx.prisma.deck.delete({
        where: {
          id: input.deckId,
          userId, // Ensure user owns the deck
        },
      })
    }),

  addCard: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      cardId: z.string(),
      quantity: z.number().min(1).default(1),
      category: z.string().optional(),
      boardState: z.enum(['mainboard', 'sideboard', 'maybeboard']).default('mainboard'),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      // Verify deck ownership
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input.deckId, userId },
      })

      if (!deck) {
        throw new Error('Deck not found')
      }

      return await ctx.prisma.deckCard.upsert({
        where: {
          deckId_cardId_boardState: {
            deckId: input.deckId,
            cardId: input.cardId,
            boardState: input.boardState,
          },
        },
        update: {
          quantity: { increment: input.quantity },
          category: input.category,
        },
        create: {
          deckId: input.deckId,
          cardId: input.cardId,
          quantity: input.quantity,
          category: input.category,
          boardState: input.boardState,
        },
      })
    }),

  removeCard: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      cardId: z.string(),
      boardState: z.enum(['mainboard', 'sideboard', 'maybeboard']).default('mainboard'),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      // Verify deck ownership
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input.deckId, userId },
      })

      if (!deck) {
        throw new Error('Deck not found')
      }

      return await ctx.prisma.deckCard.delete({
        where: {
          deckId_cardId_boardState: {
            deckId: input.deckId,
            cardId: input.cardId,
            boardState: input.boardState,
          },
        },
      })
    }),
}) 
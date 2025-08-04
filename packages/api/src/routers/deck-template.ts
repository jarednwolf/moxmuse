import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { deckTemplateService } from '../services/deck-template'

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  format: z.string().default('commander'),
  archetype: z.string().min(1).max(50),
  isPublic: z.boolean().default(false),
  powerLevel: z.number().min(1).max(10).optional(),
  estimatedBudget: z.number().min(0).optional(),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.object({
    name: z.string(),
    description: z.string(),
    targetCount: z.number(),
    minCount: z.number(),
    maxCount: z.number(),
    priority: z.number()
  })),
  coreCards: z.array(z.object({
    cardId: z.string(),
    category: z.string(),
    isCore: z.boolean(),
    alternatives: z.array(z.string()),
    reasoning: z.string()
  })),
  flexSlots: z.array(z.object({
    category: z.string(),
    count: z.number(),
    criteria: z.string(),
    suggestions: z.array(z.string())
  }))
})

const instantiateTemplateSchema = z.object({
  templateId: z.string(),
  deckName: z.string().min(1).max(100),
  customizations: z.object({
    powerLevel: z.number().min(1).max(10).optional(),
    budget: z.number().min(0).optional(),
    excludedCards: z.array(z.string()).default([]),
    preferredCards: z.array(z.string()).default([]),
    categoryAdjustments: z.record(z.number()).default({})
  }).default({})
})

const getTemplatesSchema = z.object({
  format: z.string().optional(),
  archetype: z.string().optional(),
  isPublic: z.boolean().optional(),
  powerLevel: z.tuple([z.number(), z.number()]).optional(),
  budget: z.tuple([z.number(), z.number()]).optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['newest', 'popular', 'rating']).default('newest'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
})

const getRecommendationsSchema = z.object({
  format: z.string().optional(),
  archetype: z.string().optional(),
  powerLevel: z.number().min(1).max(10).optional(),
  budget: z.number().min(0).optional(),
  playstyle: z.array(z.string()).optional()
})

export const deckTemplateRouter = createTRPCRouter({
  // Create template from existing deck
  createFromDeck: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      templateData: createTemplateSchema
    }))
    .mutation(async ({ ctx, input }) => {
      return deckTemplateService.createTemplateFromDeck(
        ctx.session.user.id,
        input.deckId,
        input.templateData
      )
    }),

  // Create template from scratch
  create: protectedProcedure
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      return deckTemplateService.createTemplate(ctx.session.user.id, input)
    }),

  // Instantiate template into new deck
  instantiate: protectedProcedure
    .input(instantiateTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      return deckTemplateService.instantiateTemplate(ctx.session.user.id, input)
    }),

  // Get templates with filtering
  getTemplates: protectedProcedure
    .input(getTemplatesSchema)
    .query(async ({ ctx, input }) => {
      return deckTemplateService.getTemplates(ctx.session.user.id, input)
    }),

  // Get template by ID
  getTemplate: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      return deckTemplateService.getTemplate(ctx.session.user.id, input.templateId)
    }),

  // Update template
  updateTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      updates: createTemplateSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      return deckTemplateService.updateTemplate(
        ctx.session.user.id,
        input.templateId,
        input.updates
      )
    }),

  // Delete template
  deleteTemplate: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return deckTemplateService.deleteTemplate(ctx.session.user.id, input.templateId)
    }),

  // Get AI-powered recommendations
  getRecommendations: protectedProcedure
    .input(getRecommendationsSchema)
    .query(async ({ ctx, input }) => {
      return deckTemplateService.getTemplateRecommendations(ctx.session.user.id, input)
    }),

  // Rate template
  rateTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      rating: z.number().min(1).max(5),
      review: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return deckTemplateService.rateTemplate(
        ctx.session.user.id,
        input.templateId,
        input.rating,
        input.review
      )
    }),

  // Get user's templates
  getMyTemplates: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      return deckTemplateService.getTemplates(ctx.session.user.id, {
        isPublic: false,
        ...input
      })
    }),

  // Get public templates (marketplace)
  getMarketplace: protectedProcedure
    .input(getTemplatesSchema)
    .query(async ({ ctx, input }) => {
      return deckTemplateService.getTemplates(ctx.session.user.id, {
        ...input,
        isPublic: true
      })
    }),

  // Get template usage statistics
  getTemplateStats: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      // This would be implemented to return usage statistics
      // For now, return basic info
      const template = await deckTemplateService.getTemplate(
        ctx.session.user.id,
        input.templateId
      )
      
      return {
        usageCount: template.usageCount,
        // TODO: Add more statistics like ratings, recent usage, etc.
      }
    })
})
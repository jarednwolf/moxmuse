import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { integrationService } from '../services/integration/IntegrationService'
import { exportService } from '../services/integration/ExportService'
import { shareableLinksService } from '../services/integration/ShareableLinksService'
import { collectionImportService } from '../services/integration/CollectionImportService'
import { apiAuthenticationService } from '../services/integration/APIAuthenticationService'
import { webhookService } from '../services/integration/WebhookService'
import { prisma } from '@moxmuse/db'

// Input schemas
const ExportDeckSchema = z.object({
  deckId: z.string(),
  format: z.enum(['moxfield', 'archidekt', 'text', 'json']),
  includeMetadata: z.boolean().default(true),
  includePrices: z.boolean().default(false),
  includeAnalysis: z.boolean().default(false),
})

const CreateShareableLinkSchema = z.object({
  deckId: z.string(),
  includeAnalysis: z.boolean().default(true),
  includeStrategy: z.boolean().default(true),
  includeMetadata: z.boolean().default(false),
  allowComments: z.boolean().default(false),
  allowForks: z.boolean().default(true),
  expiresAt: z.date().optional(),
  password: z.string().optional(),
  customSlug: z.string().optional(),
})

const ImportCollectionSchema = z.object({
  platform: z.enum(['moxfield', 'archidekt', 'edhrec', 'tappedout', 'csv']),
  url: z.string().url().optional(),
  data: z.string().optional(),
  includeBasicLands: z.boolean().default(false),
  mergeWithExisting: z.boolean().default(false),
  validateCards: z.boolean().default(true),
  importPrices: z.boolean().default(false),
})

const CreateAPIKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1),
  rateLimit: z.number().min(1).max(10000).default(1000),
  expiresAt: z.date().optional(),
})

const CreateWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().optional(),
})

export const integrationRouter = router({
  // Export endpoints
  exportDeck: protectedProcedure
    .input(ExportDeckSchema)
    .mutation(async ({ ctx, input }) => {
      // Get deck and verify ownership
      const deck = await prisma.generatedDeck.findFirst({
        where: {
          id: input.deckId,
          userId: ctx.user.id,
        },
        include: {
          cards: true,
        },
      })

      if (!deck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deck not found or access denied',
        })
      }

      return await integrationService.exportDeckWithNotification(
        deck as any,
        input,
        ctx.user.id
      )
    }),

  getSupportedExportFormats: publicProcedure
    .query(() => {
      return exportService.getSupportedFormats()
    }),

  // Sharing endpoints
  createShareableLink: protectedProcedure
    .input(CreateShareableLinkSchema)
    .mutation(async ({ ctx, input }) => {
      return await integrationService.createShareableLinkWithNotification(
        input.deckId,
        ctx.user.id,
        input
      )
    }),

  getSharedDeck: publicProcedure
    .input(z.object({
      slug: z.string(),
      password: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return await shareableLinksService.getShareableDeck(
        input.slug,
        input.password
      )
    }),

  getUserShareableLinks: protectedProcedure
    .query(async ({ ctx }) => {
      return await shareableLinksService.getUserShareableLinks(ctx.user.id)
    }),

  updateShareableLink: protectedProcedure
    .input(z.object({
      linkId: z.string(),
      updates: CreateShareableLinkSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await shareableLinksService.updateShareableLink(
        input.linkId,
        ctx.user.id,
        input.updates
      )
    }),

  deleteShareableLink: protectedProcedure
    .input(z.object({ linkId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await shareableLinksService.deleteShareableLink(input.linkId, ctx.user.id)
    }),

  forkSharedDeck: protectedProcedure
    .input(z.object({
      slug: z.string(),
      newDeckName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await shareableLinksService.forkSharedDeck(
        input.slug,
        ctx.user.id,
        input.newDeckName
      )
    }),

  // Import endpoints
  importCollection: protectedProcedure
    .input(ImportCollectionSchema)
    .mutation(async ({ ctx, input }) => {
      return await integrationService.importCollectionWithNotification(
        ctx.user.id,
        input
      )
    }),

  getSupportedImportPlatforms: publicProcedure
    .query(() => {
      return collectionImportService.getSupportedPlatforms()
    }),

  getCSVTemplate: publicProcedure
    .query(() => {
      return collectionImportService.getCSVTemplate()
    }),

  // API Authentication endpoints
  createAPIKey: protectedProcedure
    .input(CreateAPIKeySchema)
    .mutation(async ({ ctx, input }) => {
      return await apiAuthenticationService.createAPIKey(ctx.user.id, input)
    }),

  getUserAPIKeys: protectedProcedure
    .query(async ({ ctx }) => {
      return await apiAuthenticationService.getUserAPIKeys(ctx.user.id)
    }),

  revokeAPIKey: protectedProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await apiAuthenticationService.revokeAPIKey(input.keyId, ctx.user.id)
    }),

  getAvailablePermissions: publicProcedure
    .query(() => {
      return apiAuthenticationService.getAvailablePermissions()
    }),

  // OAuth endpoints
  createOAuthApp: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      redirectUris: z.array(z.string().url()).min(1),
      scopes: z.array(z.string()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return await apiAuthenticationService.createOAuthApp(ctx.user.id, input)
    }),

  getUserOAuthApps: protectedProcedure
    .query(async ({ ctx }) => {
      return await apiAuthenticationService.getUserOAuthApps(ctx.user.id)
    }),

  getAvailableScopes: publicProcedure
    .query(() => {
      return apiAuthenticationService.getAvailableScopes()
    }),

  // Webhook endpoints
  createWebhook: protectedProcedure
    .input(CreateWebhookSchema)
    .mutation(async ({ ctx, input }) => {
      return await webhookService.createWebhook(ctx.user.id, input)
    }),

  getUserWebhooks: protectedProcedure
    .query(async ({ ctx }) => {
      return await webhookService.getUserWebhooks(ctx.user.id)
    }),

  updateWebhook: protectedProcedure
    .input(z.object({
      webhookId: z.string(),
      updates: CreateWebhookSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await webhookService.updateWebhook(
        input.webhookId,
        ctx.user.id,
        input.updates
      )
    }),

  deleteWebhook: protectedProcedure
    .input(z.object({ webhookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await webhookService.deleteWebhook(input.webhookId, ctx.user.id)
    }),

  testWebhook: protectedProcedure
    .input(z.object({ webhookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await webhookService.testWebhook(input.webhookId, ctx.user.id)
    }),

  getWebhookDeliveries: protectedProcedure
    .input(z.object({
      webhookId: z.string(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      return await webhookService.getWebhookDeliveries(
        input.webhookId,
        ctx.user.id,
        input.limit
      )
    }),

  retryWebhookDelivery: protectedProcedure
    .input(z.object({ deliveryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await webhookService.retryWebhookDelivery(input.deliveryId, ctx.user.id)
    }),

  getAvailableWebhookEvents: publicProcedure
    .query(() => {
      return webhookService.getAvailableEvents()
    }),

  // Integration status and analytics
  getIntegrationStatus: protectedProcedure
    .query(async ({ ctx }) => {
      return await integrationService.getIntegrationStatus(ctx.user.id)
    }),

  getIntegrationAnalytics: protectedProcedure
    .input(z.object({
      period: z.enum(['day', 'week', 'month']).default('week'),
    }))
    .query(async ({ ctx, input }) => {
      return await integrationService.getIntegrationAnalytics(
        ctx.user.id,
        input.period
      )
    }),

  validateIntegrationConfig: protectedProcedure
    .query(async ({ ctx }) => {
      return await integrationService.validateIntegrationConfig(ctx.user.id)
    }),

  cleanupExpiredResources: protectedProcedure
    .mutation(async ({ ctx }) => {
      return await integrationService.cleanupExpiredResources(ctx.user.id)
    }),

  getIntegrationHealth: publicProcedure
    .query(async () => {
      return await integrationService.getIntegrationHealth()
    }),
})
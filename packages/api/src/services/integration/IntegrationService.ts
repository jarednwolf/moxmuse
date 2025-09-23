import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { exportService } from './ExportService'
import { shareableLinksService } from './ShareableLinksService'
import { collectionImportService } from './CollectionImportService'
import { apiAuthenticationService } from './APIAuthenticationService'
import { webhookService } from './WebhookService'
import type { GeneratedDeck } from '@moxmuse/shared'

// Integration status schema
const IntegrationStatusSchema = z.object({
  exports: z.object({
    available: z.boolean(),
    formats: z.array(z.string()),
    lastExport: z.date().optional(),
  }),
  sharing: z.object({
    available: z.boolean(),
    activeLinks: z.number(),
    totalViews: z.number(),
  }),
  imports: z.object({
    available: z.boolean(),
    platforms: z.array(z.string()),
    lastImport: z.date().optional(),
  }),
  api: z.object({
    available: z.boolean(),
    activeKeys: z.number(),
    oauthApps: z.number(),
  }),
  webhooks: z.object({
    available: z.boolean(),
    activeWebhooks: z.number(),
    totalDeliveries: z.number(),
  }),
})

type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>

// Integration analytics schema
const IntegrationAnalyticsSchema = z.object({
  period: z.enum(['day', 'week', 'month']),
  exports: z.object({
    total: z.number(),
    byFormat: z.record(z.number()),
    successful: z.number(),
    failed: z.number(),
  }),
  shares: z.object({
    created: z.number(),
    views: z.number(),
    forks: z.number(),
  }),
  imports: z.object({
    total: z.number(),
    byPlatform: z.record(z.number()),
    successful: z.number(),
    failed: z.number(),
  }),
  api: z.object({
    requests: z.number(),
    errors: z.number(),
    rateLimited: z.number(),
  }),
  webhooks: z.object({
    triggered: z.number(),
    delivered: z.number(),
    failed: z.number(),
  }),
})

type IntegrationAnalytics = z.infer<typeof IntegrationAnalyticsSchema>

export class IntegrationService {
  /**
   * Get integration status for a user
   */
  async getIntegrationStatus(userId: string): Promise<IntegrationStatus> {
    try {
      // Get export status
      const exportFormats = exportService.getSupportedFormats()
      
      // Get sharing status
      const shareableLinks = await shareableLinksService.getUserShareableLinks(userId)
      const totalViews = shareableLinks.reduce((sum, link) => sum + link.viewCount, 0)
      
      // Get import status
      const importPlatforms = collectionImportService.getSupportedPlatforms()
      
      // Get API status
      const apiKeys = await apiAuthenticationService.getUserAPIKeys(userId)
      const oauthApps = await apiAuthenticationService.getUserOAuthApps(userId)
      
      // Get webhook status
      const webhooks = await webhookService.getUserWebhooks(userId)
      
      return {
        exports: {
          available: true,
          formats: exportFormats,
        },
        sharing: {
          available: true,
          activeLinks: shareableLinks.length,
          totalViews,
        },
        imports: {
          available: true,
          platforms: importPlatforms,
        },
        api: {
          available: true,
          activeKeys: apiKeys.filter(key => key.isActive).length,
          oauthApps: oauthApps.filter(app => app.isActive).length,
        },
        webhooks: {
          available: true,
          activeWebhooks: webhooks.filter(webhook => webhook.isActive).length,
          totalDeliveries: 0, // Would need to aggregate from database
        },
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get integration status',
        cause: error,
      })
    }
  }

  /**
   * Export deck with automatic webhook notification
   */
  async exportDeckWithNotification(
    deck: GeneratedDeck,
    exportOptions: any,
    userId: string
  ) {
    try {
      // Perform export
      const exportResult = await exportService.exportDeck(deck, exportOptions)
      
      // Trigger webhook
      await webhookService.triggerWebhook('export.completed', userId, {
        deckId: deck.id,
        format: exportOptions.format,
        filename: exportResult.filename,
        success: true,
      })
      
      return exportResult
    } catch (error) {
      // Trigger failure webhook
      await webhookService.triggerWebhook('export.completed', userId, {
        deckId: deck.id,
        format: exportOptions.format,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      
      throw error
    }
  }

  /**
   * Import collection with automatic webhook notification
   */
  async importCollectionWithNotification(
    userId: string,
    importOptions: any
  ) {
    try {
      // Perform import
      const importResult = await collectionImportService.importCollection(userId, importOptions)
      
      // Trigger webhook
      await webhookService.triggerWebhook('import.completed', userId, {
        platform: importOptions.platform,
        importedCount: importResult.importedCount,
        errorCount: importResult.errorCount,
        success: importResult.success,
      })
      
      return importResult
    } catch (error) {
      // Trigger failure webhook
      await webhookService.triggerWebhook('import.completed', userId, {
        platform: importOptions.platform,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      
      throw error
    }
  }

  /**
   * Create shareable link with automatic webhook notification
   */
  async createShareableLinkWithNotification(
    deckId: string,
    userId: string,
    shareOptions: any
  ) {
    try {
      const shareableLink = await shareableLinksService.createShareableLink(
        deckId,
        userId,
        shareOptions
      )
      
      // Trigger webhook
      await webhookService.triggerWebhook('deck.updated', userId, {
        deckId,
        action: 'shared',
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/shared/${shareableLink.slug}`,
      })
      
      return shareableLink
    } catch (error) {
      throw error
    }
  }

  /**
   * Get integration analytics
   */
  async getIntegrationAnalytics(
    userId: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<IntegrationAnalytics> {
    try {
      const now = new Date()
      let startDate: Date
      
      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
      }

      // This would typically query analytics tables
      // For now, returning mock data structure
      return {
        period,
        exports: {
          total: 0,
          byFormat: {},
          successful: 0,
          failed: 0,
        },
        shares: {
          created: 0,
          views: 0,
          forks: 0,
        },
        imports: {
          total: 0,
          byPlatform: {},
          successful: 0,
          failed: 0,
        },
        api: {
          requests: 0,
          errors: 0,
          rateLimited: 0,
        },
        webhooks: {
          triggered: 0,
          delivered: 0,
          failed: 0,
        },
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get integration analytics',
        cause: error,
      })
    }
  }

  /**
   * Validate integration configuration
   */
  async validateIntegrationConfig(userId: string): Promise<{
    valid: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // Check API keys
      const apiKeys = await apiAuthenticationService.getUserAPIKeys(userId)
      const expiredKeys = apiKeys.filter(key => 
        key.expiresAt && key.expiresAt < new Date()
      )
      
      if (expiredKeys.length > 0) {
        issues.push(`${expiredKeys.length} API key(s) have expired`)
      }

      // Check webhooks
      const webhooks = await webhookService.getUserWebhooks(userId)
      const inactiveWebhooks = webhooks.filter(webhook => !webhook.isActive)
      
      if (inactiveWebhooks.length > 0) {
        issues.push(`${inactiveWebhooks.length} webhook(s) are inactive`)
      }

      // Check shareable links
      const shareableLinks = await shareableLinksService.getUserShareableLinks(userId)
      const expiredLinks = shareableLinks.filter(link =>
        link.expiresAt && link.expiresAt < new Date()
      )
      
      if (expiredLinks.length > 0) {
        issues.push(`${expiredLinks.length} shareable link(s) have expired`)
      }

      // Recommendations
      if (apiKeys.length === 0) {
        recommendations.push('Consider creating API keys for programmatic access')
      }
      
      if (webhooks.length === 0) {
        recommendations.push('Set up webhooks for real-time notifications')
      }
      
      if (shareableLinks.length === 0) {
        recommendations.push('Create shareable links to showcase your decks')
      }

      return {
        valid: issues.length === 0,
        issues,
        recommendations,
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to validate integration configuration',
        cause: error,
      })
    }
  }

  /**
   * Cleanup expired resources
   */
  async cleanupExpiredResources(userId: string): Promise<{
    cleaned: number
    details: Record<string, number>
  }> {
    let totalCleaned = 0
    const details: Record<string, number> = {}

    try {
      // Clean up expired shareable links
      const expiredLinks = await shareableLinksService.getUserShareableLinks(userId)
      const expiredLinkIds = expiredLinks
        .filter(link => link.expiresAt && link.expiresAt < new Date())
        .map(link => link.id)
      
      for (const linkId of expiredLinkIds) {
        await shareableLinksService.deleteShareableLink(linkId, userId)
      }
      
      details.expiredLinks = expiredLinkIds.length
      totalCleaned += expiredLinkIds.length

      // Clean up expired API keys
      const apiKeys = await apiAuthenticationService.getUserAPIKeys(userId)
      const expiredKeyIds = apiKeys
        .filter(key => key.expiresAt && key.expiresAt < new Date())
        .map(key => key.id)
      
      for (const keyId of expiredKeyIds) {
        await apiAuthenticationService.revokeAPIKey(keyId, userId)
      }
      
      details.expiredApiKeys = expiredKeyIds.length
      totalCleaned += expiredKeyIds.length

      return {
        cleaned: totalCleaned,
        details,
      }
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to cleanup expired resources',
        cause: error,
      })
    }
  }

  /**
   * Get integration health status
   */
  async getIntegrationHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    services: Record<string, {
      status: 'up' | 'down' | 'degraded'
      responseTime?: number
      lastCheck: Date
    }>
  }> {
    const services: Record<string, any> = {}
    let healthyCount = 0
    const totalServices = 5

    // Check export service
    try {
      const start = Date.now()
      exportService.getSupportedFormats()
      services.export = {
        status: 'up',
        responseTime: Date.now() - start,
        lastCheck: new Date(),
      }
      healthyCount++
    } catch (error) {
      services.export = {
        status: 'down',
        lastCheck: new Date(),
      }
    }

    // Check other services similarly...
    services.sharing = { status: 'up', lastCheck: new Date() }
    services.import = { status: 'up', lastCheck: new Date() }
    services.api = { status: 'up', lastCheck: new Date() }
    services.webhooks = { status: 'up', lastCheck: new Date() }
    healthyCount += 4 // Assuming others are healthy for now

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (healthyCount === totalServices) {
      overallStatus = 'healthy'
    } else if (healthyCount >= totalServices * 0.7) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'unhealthy'
    }

    return {
      status: overallStatus,
      services,
    }
  }
}

export const integrationService = new IntegrationService()
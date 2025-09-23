import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { nanoid } from 'nanoid'
import { createHmac } from 'crypto'
import { prisma } from '@moxmuse/db'

// Webhook schemas
const WebhookEventSchema = z.enum([
  'deck.created',
  'deck.updated',
  'deck.deleted',
  'collection.updated',
  'user.created',
  'user.updated',
  'generation.completed',
  'generation.failed',
  'export.completed',
  'import.completed',
])

type WebhookEvent = z.infer<typeof WebhookEventSchema>

const WebhookSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  url: z.string().url(),
  events: z.array(WebhookEventSchema),
  secret: z.string(),
  isActive: z.boolean(),
  retryCount: z.number(),
  lastTriggeredAt: z.date().optional(),
  lastSuccessAt: z.date().optional(),
  lastFailureAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

type Webhook = z.infer<typeof WebhookSchema>

const CreateWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(WebhookEventSchema).min(1),
  secret: z.string().optional(),
})

type CreateWebhookRequest = z.infer<typeof CreateWebhookSchema>

const WebhookDeliverySchema = z.object({
  id: z.string(),
  webhookId: z.string(),
  event: WebhookEventSchema,
  payload: z.record(z.any()),
  status: z.enum(['pending', 'delivered', 'failed', 'retrying']),
  attempts: z.number(),
  lastAttemptAt: z.date().optional(),
  responseStatus: z.number().optional(),
  responseBody: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>

// Webhook payload interfaces
interface BaseWebhookPayload {
  event: WebhookEvent
  timestamp: string
  userId: string
  data: Record<string, any>
}

interface DeckWebhookPayload extends BaseWebhookPayload {
  event: 'deck.created' | 'deck.updated' | 'deck.deleted'
  data: {
    deckId: string
    name: string
    commander?: string
    format: string
    cardCount: number
    estimatedBudget?: number
    powerLevel?: number
  }
}

interface GenerationWebhookPayload extends BaseWebhookPayload {
  event: 'generation.completed' | 'generation.failed'
  data: {
    sessionId: string
    deckId?: string
    generationTime?: number
    errorMessage?: string
    qualityScore?: number
  }
}

export class WebhookService {
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAYS = [1000, 5000, 15000] // 1s, 5s, 15s

  /**
   * Create a new webhook
   */
  async createWebhook(
    userId: string,
    request: CreateWebhookRequest
  ): Promise<Webhook> {
    try {
      const validatedRequest = CreateWebhookSchema.parse(request)
      
      // Generate secret if not provided
      const secret = validatedRequest.secret || this.generateWebhookSecret()
      
      const webhook = await prisma.webhook.create({
        data: {
          id: nanoid(),
          userId,
          name: validatedRequest.name,
          url: validatedRequest.url,
          events: validatedRequest.events,
          secret,
          isActive: true,
          retryCount: 0,
        },
      })

      return WebhookSchema.parse(webhook)
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create webhook',
        cause: error,
      })
    }
  }

  /**
   * Trigger webhook for an event
   */
  async triggerWebhook(
    event: WebhookEvent,
    userId: string,
    payload: Record<string, any>
  ): Promise<void> {
    try {
      // Find all active webhooks for this user and event
      const webhooks = await prisma.webhook.findMany({
        where: {
          userId,
          isActive: true,
          events: {
            has: event,
          },
        },
      })

      // Create webhook deliveries for each webhook
      const deliveryPromises = webhooks.map(webhook =>
        this.createWebhookDelivery(webhook, event, payload)
      )

      await Promise.all(deliveryPromises)
    } catch (error) {
      console.error('Failed to trigger webhooks:', error)
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Create and queue webhook delivery
   */
  private async createWebhookDelivery(
    webhook: any,
    event: WebhookEvent,
    data: Record<string, any>
  ): Promise<WebhookDelivery> {
    const payload: BaseWebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      userId: webhook.userId,
      data,
    }

    const delivery = await prisma.webhookDelivery.create({
      data: {
        id: nanoid(),
        webhookId: webhook.id,
        event,
        payload,
        status: 'pending',
        attempts: 0,
      },
    })

    // Queue for immediate delivery
    setImmediate(() => this.deliverWebhook(delivery.id))

    return WebhookDeliverySchema.parse(delivery)
  }

  /**
   * Deliver webhook to endpoint
   */
  async deliverWebhook(deliveryId: string): Promise<void> {
    try {
      const delivery = await prisma.webhookDelivery.findUnique({
        where: { id: deliveryId },
        include: { webhook: true },
      })

      if (!delivery || !delivery.webhook) {
        return
      }

      if (delivery.status === 'delivered' || delivery.attempts >= this.MAX_RETRIES) {
        return
      }

      // Update delivery status
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'retrying',
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      })

      try {
        // Generate signature
        const signature = this.generateSignature(
          JSON.stringify(delivery.payload),
          delivery.webhook.secret
        )

        // Send webhook
        const response = await fetch(delivery.webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'MoxMuse-Webhooks/1.0',
            'X-MoxMuse-Event': delivery.event,
            'X-MoxMuse-Signature': signature,
            'X-MoxMuse-Delivery': delivery.id,
          },
          body: JSON.stringify(delivery.payload),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        })

        const responseBody = await response.text()

        if (response.ok) {
          // Success
          await prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
              status: 'delivered',
              responseStatus: response.status,
              responseBody: responseBody.substring(0, 1000), // Limit response body size
              updatedAt: new Date(),
            },
          })

          await prisma.webhook.update({
            where: { id: delivery.webhook.id },
            data: {
              lastTriggeredAt: new Date(),
              lastSuccessAt: new Date(),
            },
          })
        } else {
          throw new Error(`HTTP ${response.status}: ${responseBody}`)
        }
      } catch (error) {
        // Delivery failed
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: delivery.attempts >= this.MAX_RETRIES ? 'failed' : 'pending',
            errorMessage: errorMessage.substring(0, 500),
            updatedAt: new Date(),
          },
        })

        await prisma.webhook.update({
          where: { id: delivery.webhook.id },
          data: {
            lastTriggeredAt: new Date(),
            lastFailureAt: new Date(),
          },
        })

        // Schedule retry if not exceeded max attempts
        if (delivery.attempts < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAYS[delivery.attempts - 1] || 15000
          setTimeout(() => this.deliverWebhook(deliveryId), delay)
        }
      }
    } catch (error) {
      console.error('Failed to deliver webhook:', error)
    }
  }

  /**
   * Get webhook deliveries for a webhook
   */
  async getWebhookDeliveries(
    webhookId: string,
    userId: string,
    limit = 50
  ): Promise<WebhookDelivery[]> {
    try {
      // Verify webhook ownership
      const webhook = await prisma.webhook.findFirst({
        where: {
          id: webhookId,
          userId,
        },
      })

      if (!webhook) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook not found or access denied',
        })
      }

      const deliveries = await prisma.webhookDelivery.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return deliveries.map(delivery => WebhookDeliverySchema.parse(delivery))
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get webhook deliveries',
        cause: error,
      })
    }
  }

  /**
   * Retry failed webhook delivery
   */
  async retryWebhookDelivery(
    deliveryId: string,
    userId: string
  ): Promise<void> {
    try {
      const delivery = await prisma.webhookDelivery.findFirst({
        where: {
          id: deliveryId,
          webhook: { userId },
        },
        include: { webhook: true },
      })

      if (!delivery) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook delivery not found or access denied',
        })
      }

      if (delivery.status === 'delivered') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot retry successful delivery',
        })
      }

      // Reset delivery for retry
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'pending',
          attempts: 0,
          errorMessage: null,
          updatedAt: new Date(),
        },
      })

      // Queue for delivery
      setImmediate(() => this.deliverWebhook(deliveryId))
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retry webhook delivery',
        cause: error,
      })
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: string,
    userId: string,
    updates: Partial<CreateWebhookRequest>
  ): Promise<Webhook> {
    try {
      const webhook = await prisma.webhook.findFirst({
        where: {
          id: webhookId,
          userId,
        },
      })

      if (!webhook) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook not found or access denied',
        })
      }

      const updatedWebhook = await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      })

      return WebhookSchema.parse(updatedWebhook)
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update webhook',
        cause: error,
      })
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string, userId: string): Promise<void> {
    try {
      const result = await prisma.webhook.deleteMany({
        where: {
          id: webhookId,
          userId,
        },
      })

      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook not found or access denied',
        })
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete webhook',
        cause: error,
      })
    }
  }

  /**
   * Get user's webhooks
   */
  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })

      return webhooks.map(webhook => WebhookSchema.parse(webhook))
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get webhooks',
        cause: error,
      })
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(webhookId: string, userId: string): Promise<{
    success: boolean
    responseStatus?: number
    responseTime: number
    errorMessage?: string
  }> {
    try {
      const webhook = await prisma.webhook.findFirst({
        where: {
          id: webhookId,
          userId,
        },
      })

      if (!webhook) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Webhook not found or access denied',
        })
      }

      const testPayload: BaseWebhookPayload = {
        event: 'deck.created',
        timestamp: new Date().toISOString(),
        userId,
        data: {
          test: true,
          message: 'This is a test webhook delivery',
        },
      }

      const signature = this.generateSignature(
        JSON.stringify(testPayload),
        webhook.secret
      )

      const startTime = Date.now()
      
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'MoxMuse-Webhooks/1.0',
            'X-MoxMuse-Event': 'deck.created',
            'X-MoxMuse-Signature': signature,
            'X-MoxMuse-Test': 'true',
          },
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout(10000),
        })

        const responseTime = Date.now() - startTime

        return {
          success: response.ok,
          responseStatus: response.status,
          responseTime,
          errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
        }
      } catch (error) {
        const responseTime = Date.now() - startTime
        
        return {
          success: false,
          responseTime,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to test webhook',
        cause: error,
      })
    }
  }

  /**
   * Generate webhook signature for verification
   */
  private generateSignature(payload: string, secret: string): string {
    return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret)
    return signature === expectedSignature
  }

  /**
   * Generate webhook secret
   */
  private generateWebhookSecret(): string {
    return require('crypto').randomBytes(32).toString('hex')
  }

  /**
   * Get available webhook events
   */
  getAvailableEvents(): WebhookEvent[] {
    return [
      'deck.created',
      'deck.updated',
      'deck.deleted',
      'collection.updated',
      'user.created',
      'user.updated',
      'generation.completed',
      'generation.failed',
      'export.completed',
      'import.completed',
    ]
  }

  /**
   * Process pending webhook deliveries (for background job)
   */
  async processPendingDeliveries(): Promise<void> {
    try {
      const pendingDeliveries = await prisma.webhookDelivery.findMany({
        where: {
          status: 'pending',
          attempts: { lt: this.MAX_RETRIES },
        },
        take: 100, // Process in batches
        orderBy: { createdAt: 'asc' },
      })

      const deliveryPromises = pendingDeliveries.map(delivery =>
        this.deliverWebhook(delivery.id)
      )

      await Promise.allSettled(deliveryPromises)
    } catch (error) {
      console.error('Failed to process pending webhook deliveries:', error)
    }
  }
}

export const webhookService = new WebhookService()
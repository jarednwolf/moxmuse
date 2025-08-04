import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { redisCache } from '../redis'
import { ProactiveSuggestionsService } from './proactive-suggestions'
import { MultiDeckOptimizerService } from './multi-deck-optimizer'

interface AnalysisTrigger {
  id: string
  deckId: string
  userId: string
  triggerType: 'card_added' | 'card_removed' | 'quantity_changed' | 'meta_shift' | 'price_change' | 'scheduled'
  triggerData: Record<string, any>
  priority: 'immediate' | 'high' | 'medium' | 'low'
  scheduledFor?: Date
  createdAt: Date
  processedAt?: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

interface AnalysisResult {
  triggerId: string
  deckId: string
  analysisType: string[]
  results: {
    suggestions?: any[]
    portfolioUpdate?: any
    metaAnalysis?: any
    priceAlerts?: any[]
  }
  processingTime: number
  success: boolean
  error?: string
  timestamp: Date
}

interface DeckChangeEvent {
  deckId: string
  userId: string
  changeType: 'card_added' | 'card_removed' | 'card_modified' | 'deck_created' | 'deck_deleted'
  cardId?: string
  cardName?: string
  oldQuantity?: number
  newQuantity?: number
  metadata?: Record<string, any>
  timestamp: Date
}

interface AnalysisConfiguration {
  userId: string
  enableAutoAnalysis: boolean
  analysisFrequency: 'immediate' | 'batched' | 'scheduled'
  triggerThresholds: {
    minCardValueForAnalysis: number
    minChangePercentageForAnalysis: number
    maxAnalysisPerDay: number
  }
  enabledAnalysisTypes: {
    suggestions: boolean
    portfolioOptimization: boolean
    metaAnalysis: boolean
    priceTracking: boolean
  }
  notificationPreferences: {
    immediateAlerts: boolean
    dailySummary: boolean
    weeklyReport: boolean
  }
}

export class AutomaticAnalysisService {
  private readonly BATCH_SIZE = 10
  private readonly MAX_RETRIES = 3
  private readonly ANALYSIS_TIMEOUT = 30000 // 30 seconds
  
  constructor(
    private prisma: PrismaClient,
    private suggestionsService: ProactiveSuggestionsService,
    private optimizerService: MultiDeckOptimizerService
  ) {}

  /**
   * Trigger analysis when deck changes occur
   */
  async triggerDeckChangeAnalysis(event: DeckChangeEvent): Promise<void> {
    try {
      // Get user's analysis configuration
      const config = await this.getAnalysisConfiguration(event.userId)
      if (!config.enableAutoAnalysis) return

      // Determine if this change warrants analysis
      const shouldAnalyze = await this.shouldTriggerAnalysis(event, config)
      if (!shouldAnalyze) return

      // Create analysis trigger
      const trigger = await this.createAnalysisTrigger({
        deckId: event.deckId,
        userId: event.userId,
        triggerType: event.changeType,
        triggerData: {
          cardId: event.cardId,
          cardName: event.cardName,
          oldQuantity: event.oldQuantity,
          newQuantity: event.newQuantity,
          metadata: event.metadata
        },
        priority: this.calculatePriority(event, config),
        scheduledFor: config.analysisFrequency === 'immediate' ? new Date() : this.calculateScheduledTime(config)
      })

      // Process immediately if configured for immediate analysis
      if (config.analysisFrequency === 'immediate' && trigger.priority === 'immediate') {
        await this.processAnalysisTrigger(trigger.id)
      }
    } catch (error) {
      console.error('Error triggering deck change analysis:', error)
    }
  }

  /**
   * Process pending analysis triggers
   */
  async processPendingAnalyses(): Promise<void> {
    try {
      // Get pending triggers ordered by priority and scheduled time
      const pendingTriggers = await this.prisma.analysisTrigger.findMany({
        where: {
          status: 'pending',
          scheduledFor: {
            lte: new Date()
          }
        },
        orderBy: [
          { priority: 'asc' }, // immediate = 0, high = 1, etc.
          { scheduledFor: 'asc' }
        ],
        take: this.BATCH_SIZE
      })

      // Process triggers in parallel (with concurrency limit)
      const processingPromises = pendingTriggers.map(trigger => 
        this.processAnalysisTrigger(trigger.id)
      )

      await Promise.allSettled(processingPromises)
    } catch (error) {
      console.error('Error processing pending analyses:', error)
    }
  }

  /**
   * Process a specific analysis trigger
   */
  async processAnalysisTrigger(triggerId: string): Promise<AnalysisResult> {
    const startTime = Date.now()
    
    try {
      // Get trigger details
      const trigger = await this.prisma.analysisTrigger.findUnique({
        where: { id: triggerId }
      })

      if (!trigger) {
        throw new Error(`Analysis trigger ${triggerId} not found`)
      }

      // Mark as processing
      await this.prisma.analysisTrigger.update({
        where: { id: triggerId },
        data: { 
          status: 'processing',
          processedAt: new Date()
        }
      })

      // Get analysis configuration
      const config = await this.getAnalysisConfiguration(trigger.userId)
      
      // Perform analyses based on configuration
      const results: AnalysisResult['results'] = {}
      const analysisTypes: string[] = []

      // Generate suggestions if enabled
      if (config.enabledAnalysisTypes.suggestions) {
        try {
          const suggestions = await this.suggestionsService.generateProactiveSuggestions(
            trigger.deckId,
            trigger.userId
          )
          results.suggestions = suggestions
          analysisTypes.push('suggestions')
        } catch (error) {
          console.error('Error generating suggestions:', error)
        }
      }

      // Update portfolio optimization if enabled
      if (config.enabledAnalysisTypes.portfolioOptimization) {
        try {
          const portfolioUpdate = await this.optimizerService.optimizeUserDecks(trigger.userId)
          results.portfolioUpdate = portfolioUpdate
          analysisTypes.push('portfolio_optimization')
        } catch (error) {
          console.error('Error updating portfolio:', error)
        }
      }

      // Create analysis result
      const analysisResult: AnalysisResult = {
        triggerId,
        deckId: trigger.deckId,
        analysisType: analysisTypes,
        results,
        processingTime: Date.now() - startTime,
        success: true,
        timestamp: new Date()
      }

      // Mark trigger as completed
      await this.prisma.analysisTrigger.update({
        where: { id: triggerId },
        data: { status: 'completed' }
      })

      // Store analysis result
      await this.storeAnalysisResult(analysisResult)

      // Send notifications if configured
      await this.sendAnalysisNotifications(trigger, analysisResult, config)

      return analysisResult
    } catch (error) {
      const analysisResult: AnalysisResult = {
        triggerId,
        deckId: '',
        analysisType: [],
        results: {},
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }

      // Mark trigger as failed
      await this.prisma.analysisTrigger.update({
        where: { id: triggerId },
        data: { status: 'failed' }
      }).catch(() => {}) // Ignore errors when updating failed status

      console.error(`Error processing analysis trigger ${triggerId}:`, error)
      return analysisResult
    }
  }

  /**
   * Schedule periodic analysis for all users
   */
  async schedulePeriodicAnalysis(): Promise<void> {
    try {
      // Get all users with auto-analysis enabled
      const users = await this.prisma.user.findMany({
        where: {
          analysisConfiguration: {
            path: ['enableAutoAnalysis'],
            equals: true
          }
        },
        select: { id: true }
      })

      for (const user of users) {
        // Get user's decks
        const decks = await this.prisma.deck.findMany({
          where: { userId: user.id },
          select: { id: true }
        })

        // Create scheduled analysis triggers for each deck
        for (const deck of decks) {
          await this.createAnalysisTrigger({
            deckId: deck.id,
            userId: user.id,
            triggerType: 'scheduled',
            triggerData: { reason: 'periodic_analysis' },
            priority: 'low',
            scheduledFor: this.calculateNextScheduledAnalysis(user.id)
          })
        }
      }
    } catch (error) {
      console.error('Error scheduling periodic analysis:', error)
    }
  }

  /**
   * Helper methods
   */
  private async getAnalysisConfiguration(userId: string): Promise<AnalysisConfiguration> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { analysisConfiguration: true }
      })

      // Return default configuration if none exists
      const defaultConfig: AnalysisConfiguration = {
        userId,
        enableAutoAnalysis: true,
        analysisFrequency: 'batched',
        triggerThresholds: {
          minCardValueForAnalysis: 5,
          minChangePercentageForAnalysis: 0.1,
          maxAnalysisPerDay: 10
        },
        enabledAnalysisTypes: {
          suggestions: true,
          portfolioOptimization: true,
          metaAnalysis: true,
          priceTracking: true
        },
        notificationPreferences: {
          immediateAlerts: false,
          dailySummary: true,
          weeklyReport: true
        }
      }

      if (!user?.analysisConfiguration) {
        return defaultConfig
      }

      // Merge with user configuration
      return {
        ...defaultConfig,
        ...user.analysisConfiguration as Partial<AnalysisConfiguration>
      }
    } catch (error) {
      console.error('Error getting analysis configuration:', error)
      // Return default configuration on error
      return {
        userId,
        enableAutoAnalysis: true,
        analysisFrequency: 'batched',
        triggerThresholds: {
          minCardValueForAnalysis: 5,
          minChangePercentageForAnalysis: 0.1,
          maxAnalysisPerDay: 10
        },
        enabledAnalysisTypes: {
          suggestions: true,
          portfolioOptimization: true,
          metaAnalysis: true,
          priceTracking: true
        },
        notificationPreferences: {
          immediateAlerts: false,
          dailySummary: true,
          weeklyReport: true
        }
      }
    }
  }

  private async shouldTriggerAnalysis(
    event: DeckChangeEvent,
    config: AnalysisConfiguration
  ): Promise<boolean> {
    // Check daily analysis limit
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayAnalysisCount = await this.prisma.analysisTrigger.count({
      where: {
        userId: event.userId,
        createdAt: {
          gte: today
        }
      }
    })

    if (todayAnalysisCount >= config.triggerThresholds.maxAnalysisPerDay) {
      return false
    }

    // Check if change is significant enough
    if (event.cardId) {
      // Get card value to determine if analysis is warranted
      const cardValue = await this.getCardValue(event.cardId)
      if (cardValue < config.triggerThresholds.minCardValueForAnalysis) {
        return false
      }

      // Check quantity change percentage
      if (event.oldQuantity && event.newQuantity) {
        const changePercentage = Math.abs(event.newQuantity - event.oldQuantity) / event.oldQuantity
        if (changePercentage < config.triggerThresholds.minChangePercentageForAnalysis) {
          return false
        }
      }
    }

    return true
  }

  private calculatePriority(
    event: DeckChangeEvent,
    config: AnalysisConfiguration
  ): AnalysisTrigger['priority'] {
    // Immediate priority for high-value changes
    if (event.cardId) {
      const cardValue = this.getCardValue(event.cardId)
      if (cardValue > 100) return 'immediate'
      if (cardValue > 50) return 'high'
    }

    // High priority for deck creation/deletion
    if (event.changeType === 'deck_created' || event.changeType === 'deck_deleted') {
      return 'high'
    }

    return 'medium'
  }

  private calculateScheduledTime(config: AnalysisConfiguration): Date {
    const now = new Date()
    
    switch (config.analysisFrequency) {
      case 'immediate':
        return now
      case 'batched':
        // Schedule for next hour
        const nextHour = new Date(now)
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
        return nextHour
      case 'scheduled':
        // Schedule for next day at 9 AM
        const nextDay = new Date(now)
        nextDay.setDate(nextDay.getDate() + 1)
        nextDay.setHours(9, 0, 0, 0)
        return nextDay
      default:
        return now
    }
  }

  private calculateNextScheduledAnalysis(userId: string): Date {
    // Schedule for next week
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    nextWeek.setHours(9, 0, 0, 0) // 9 AM
    return nextWeek
  }

  private async createAnalysisTrigger(
    data: Omit<AnalysisTrigger, 'id' | 'createdAt' | 'status'>
  ): Promise<AnalysisTrigger> {
    const trigger = await this.prisma.analysisTrigger.create({
      data: {
        ...data,
        status: 'pending',
        createdAt: new Date()
      }
    })

    return {
      id: trigger.id,
      deckId: trigger.deckId,
      userId: trigger.userId,
      triggerType: trigger.triggerType as AnalysisTrigger['triggerType'],
      triggerData: trigger.triggerData as Record<string, any>,
      priority: trigger.priority as AnalysisTrigger['priority'],
      scheduledFor: trigger.scheduledFor,
      createdAt: trigger.createdAt,
      processedAt: trigger.processedAt,
      status: trigger.status as AnalysisTrigger['status']
    }
  }

  private async storeAnalysisResult(result: AnalysisResult): Promise<void> {
    try {
      await this.prisma.analysisResult.create({
        data: {
          triggerId: result.triggerId,
          deckId: result.deckId,
          analysisType: result.analysisType,
          results: result.results,
          processingTime: result.processingTime,
          success: result.success,
          error: result.error,
          timestamp: result.timestamp
        }
      })
    } catch (error) {
      console.error('Error storing analysis result:', error)
    }
  }

  private async sendAnalysisNotifications(
    trigger: any,
    result: AnalysisResult,
    config: AnalysisConfiguration
  ): Promise<void> {
    try {
      // Send immediate alerts if configured and high priority
      if (config.notificationPreferences.immediateAlerts && trigger.priority === 'immediate') {
        await this.sendImmediateAlert(trigger, result)
      }

      // Queue for daily summary if configured
      if (config.notificationPreferences.dailySummary) {
        await this.queueForDailySummary(trigger, result)
      }
    } catch (error) {
      console.error('Error sending analysis notifications:', error)
    }
  }

  private async sendImmediateAlert(trigger: any, result: AnalysisResult): Promise<void> {
    // Implementation would send push notification or email
    console.log(`Immediate alert for user ${trigger.userId}: Analysis completed for deck ${trigger.deckId}`)
  }

  private async queueForDailySummary(trigger: any, result: AnalysisResult): Promise<void> {
    // Implementation would queue notification for daily summary
    console.log(`Queued for daily summary: Analysis for deck ${trigger.deckId}`)
  }

  private async getCardValue(cardId: string): Promise<number> {
    try {
      // This would integrate with price service
      // For now, return a default value
      return 10
    } catch (error) {
      return 0
    }
  }

  /**
   * Public methods for managing analysis configuration
   */
  async updateAnalysisConfiguration(
    userId: string,
    config: Partial<AnalysisConfiguration>
  ): Promise<AnalysisConfiguration> {
    try {
      const currentConfig = await this.getAnalysisConfiguration(userId)
      const updatedConfig = { ...currentConfig, ...config }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          analysisConfiguration: updatedConfig
        }
      })

      return updatedConfig
    } catch (error) {
      console.error('Error updating analysis configuration:', error)
      throw error
    }
  }

  async getAnalysisHistory(
    userId: string,
    deckId?: string,
    limit: number = 50
  ): Promise<AnalysisResult[]> {
    try {
      const results = await this.prisma.analysisResult.findMany({
        where: {
          ...(deckId && { deckId }),
          trigger: {
            userId
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: limit,
        include: {
          trigger: true
        }
      })

      return results.map(r => ({
        triggerId: r.triggerId,
        deckId: r.deckId,
        analysisType: r.analysisType as string[],
        results: r.results as AnalysisResult['results'],
        processingTime: r.processingTime,
        success: r.success,
        error: r.error,
        timestamp: r.timestamp
      }))
    } catch (error) {
      console.error('Error getting analysis history:', error)
      return []
    }
  }

  /**
   * Cleanup old analysis data
   */
  async cleanupOldAnalyses(olderThanDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

      // Delete old completed triggers
      await this.prisma.analysisTrigger.deleteMany({
        where: {
          status: 'completed',
          createdAt: {
            lt: cutoffDate
          }
        }
      })

      // Delete old analysis results
      await this.prisma.analysisResult.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      })

      console.log(`Cleaned up analysis data older than ${olderThanDays} days`)
    } catch (error) {
      console.error('Error cleaning up old analyses:', error)
    }
  }
}
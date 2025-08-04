import { prisma as db } from '@moxmuse/db'
import type { 
  SmartNotification,
  UserStyleProfile,
  LearningEvent,
  PersonalizedBudget
} from '../../types/learning'
import { learningEventTracker } from './learning-event-tracker'
import { personalizedBudgetingEngine } from './personalized-budgeting'
import { personalizedMetaAnalyzer } from './personalized-meta-analysis'

export class SmartNotificationEngine {
  /**
   * Generate smart notifications for relevant updates
   */
  async generateSmartNotifications(userId: string): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = []

    // Get user context
    const [userProfile, recentEvents, userDecks] = await Promise.all([
      this.getUserProfile(userId),
      learningEventTracker.getUserLearningEvents(userId, {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        end: new Date()
      }),
      this.getUserDecks(userId)
    ])

    // Generate different types of notifications
    const [
      metaNotifications,
      budgetNotifications,
      learningNotifications,
      performanceNotifications,
      collectionNotifications
    ] = await Promise.all([
      this.generateMetaNotifications(userId, userProfile, userDecks),
      this.generateBudgetNotifications(userId, userProfile),
      this.generateLearningNotifications(userId, userProfile, recentEvents),
      this.generatePerformanceNotifications(userId, recentEvents),
      this.generateCollectionNotifications(userId, userProfile)
    ])

    notifications.push(
      ...metaNotifications,
      ...budgetNotifications,
      ...learningNotifications,
      ...performanceNotifications,
      ...collectionNotifications
    )

    // Filter and prioritize notifications
    const filteredNotifications = await this.filterAndPrioritizeNotifications(
      notifications,
      userProfile,
      recentEvents
    )

    // Store notifications for delivery
    await this.storeNotifications(filteredNotifications)

    return filteredNotifications
  }

  /**
   * Generate meta-related notifications
   */
  private async generateMetaNotifications(
    userId: string,
    userProfile: UserStyleProfile,
    userDecks: any[]
  ): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = []

    try {
      // Get personalized meta analysis
      const metaAnalysis = await personalizedMetaAnalyzer.generatePersonalizedMetaAnalysis(userId)

      // Notify about rising threats in local meta
      const risingThreats = Object.entries(metaAnalysis.localMeta.trends)
        .filter(([, trend]) => trend === 'rising')
        .map(([deck]) => deck)

      if (risingThreats.length > 0) {
        notifications.push({
          id: crypto.randomUUID(),
          userId,
          type: 'meta_shift',
          title: 'Meta Shift Detected',
          message: `${risingThreats[0]} is becoming more popular in your local meta. Consider adapting your decks.`,
          data: {
            risingThreats,
            affectedDecks: userDecks.map(d => d.id),
            adaptationSuggestions: metaAnalysis.personalPerformance.adaptationSuggestions
          },
          priority: 'medium',
          channels: ['in_app', 'email'],
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          createdAt: new Date()
        })
      }

      // Notify about poor matchups that are becoming more common
      const worstMatchups = metaAnalysis.personalPerformance.worstMatchups
      const popularWorstMatchups = worstMatchups.filter(matchup => 
        metaAnalysis.localMeta.popularDecks.includes(matchup)
      )

      if (popularWorstMatchups.length > 0) {
        notifications.push({
          id: crypto.randomUUID(),
          userId,
          type: 'matchup_warning',
          title: 'Challenging Matchup Alert',
          message: `${popularWorstMatchups[0]} is popular in your meta and you have a poor win rate against it.`,
          data: {
            badMatchups: popularWorstMatchups,
            winRates: metaAnalysis.localMeta.winRates,
            suggestions: metaAnalysis.personalPerformance.adaptationSuggestions
          },
          priority: 'high',
          channels: ['in_app'],
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          createdAt: new Date()
        })
      }

      // Notify about favorable meta conditions
      const bestMatchups = metaAnalysis.personalPerformance.bestMatchups
      const popularBestMatchups = bestMatchups.filter(matchup => 
        metaAnalysis.localMeta.popularDecks.includes(matchup)
      )

      if (popularBestMatchups.length > 0) {
        notifications.push({
          id: crypto.randomUUID(),
          userId,
          type: 'favorable_meta',
          title: 'Favorable Meta Conditions',
          message: `The current meta favors your strategies. Consider playing decks that perform well against ${popularBestMatchups[0]}.`,
          data: {
            favorableMatchups: popularBestMatchups,
            recommendedDecks: userDecks.filter(d => 
              d.strategy && bestMatchups.includes(d.strategy)
            ).map(d => d.id)
          },
          priority: 'low',
          channels: ['in_app'],
          expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
          createdAt: new Date()
        })
      }
    } catch (error) {
      console.error('Failed to generate meta notifications:', error)
    }

    return notifications
  }

  /**
   * Generate budget-related notifications
   */
  private async generateBudgetNotifications(
    userId: string,
    userProfile: UserStyleProfile
  ): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = []

    try {
      // Get personalized budget
      const budget = await personalizedBudgetingEngine.createPersonalizedBudget(userId)

      // Notify about high-priority upgrades within budget
      const affordableUpgrades = budget.upgradeQueue.filter(upgrade => 
        upgrade.expectedImpact > 0.7 && upgrade.priority > 0.8
      ).slice(0, 3)

      if (affordableUpgrades.length > 0) {
        notifications.push({
          id: crypto.randomUUID(),
          userId,
          type: 'upgrade_opportunity',
          title: 'High-Impact Upgrades Available',
          message: `${affordableUpgrades.length} high-impact upgrades are within your budget and could significantly improve your decks.`,
          data: {
            upgrades: affordableUpgrades,
            totalImpact: affordableUpgrades.reduce((sum, u) => sum + u.expectedImpact, 0),
            budgetUtilization: affordableUpgrades.length / budget.upgradeQueue.length
          },
          priority: 'medium',
          channels: ['in_app', 'email'],
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          createdAt: new Date()
        })
      }

      // Notify about budget reallocation opportunities
      const optimization = await personalizedBudgetingEngine.optimizeBudgetAllocation(userId)
      
      if (optimization.projectedSavings > 25) {
        notifications.push({
          id: crypto.randomUUID(),
          userId,
          type: 'budget_optimization',
          title: 'Budget Optimization Opportunity',
          message: `You could save $${Math.round(optimization.projectedSavings)} by optimizing your budget allocation.`,
          data: {
            savings: optimization.projectedSavings,
            impact: optimization.projectedImpact,
            recommendations: optimization.recommendations.slice(0, 3)
          },
          priority: 'low',
          channels: ['in_app'],
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          createdAt: new Date()
        })
      }

      // Notify about price drops on wishlist items (if we had wishlist data)
      // This would integrate with price tracking service
      
    } catch (error) {
      console.error('Failed to generate budget notifications:', error)
    }

    return notifications
  }

  /**
   * Generate learning-related notifications
   */
  private async generateLearningNotifications(
    userId: string,
    userProfile: UserStyleProfile,
    recentEvents: LearningEvent[]
  ): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = []

    // Notify about learning milestones
    const totalEvents = await learningEventTracker.getUserLearningStats(userId)
    
    if (this.isLearningMilestone(totalEvents.totalEvents)) {
      notifications.push({
        id: crypto.randomUUID(),
        userId,
        type: 'learning_milestone',
        title: 'Learning Milestone Reached!',
        message: `You've completed ${totalEvents.totalEvents} learning interactions. Your deck building skills are improving!`,
        data: {
          totalEvents: totalEvents.totalEvents,
          acceptanceRate: totalEvents.suggestionAcceptanceRate,
          milestone: this.getMilestoneDescription(totalEvents.totalEvents)
        },
        priority: 'low',
        channels: ['in_app'],
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        createdAt: new Date()
      })
    }

    // Notify about suggestion acceptance rate improvements
    if (totalEvents.suggestionAcceptanceRate > 0.8 && userProfile.preferenceConfidence > 0.7) {
      notifications.push({
        id: crypto.randomUUID(),
        userId,
        type: 'personalization_success',
        title: 'Personalization Working Well',
        message: `You're accepting ${Math.round(totalEvents.suggestionAcceptanceRate * 100)}% of suggestions. The system is learning your preferences!`,
        data: {
          acceptanceRate: totalEvents.suggestionAcceptanceRate,
          confidence: userProfile.preferenceConfidence,
          suggestion: 'Consider exploring more innovative suggestions to expand your horizons'
        },
        priority: 'low',
        channels: ['in_app'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date()
      })
    }

    // Notify about low engagement
    if (recentEvents.length < 3 && totalEvents.totalEvents > 20) {
      notifications.push({
        id: crypto.randomUUID(),
        userId,
        type: 'engagement_reminder',
        title: 'Your Decks Miss You',
        message: 'You haven\'t been active lately. Check out new suggestions and meta updates for your decks!',
        data: {
          lastActivity: recentEvents.length > 0 ? recentEvents[0].timestamp : null,
          suggestions: ['Check for new card suggestions', 'Review meta changes', 'Optimize your budget allocation']
        },
        priority: 'low',
        channels: ['email'],
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date()
      })
    }

    return notifications
  }

  /**
   * Generate performance-related notifications
   */
  private async generatePerformanceNotifications(
    userId: string,
    recentEvents: LearningEvent[]
  ): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = []

    // Analyze recent performance events
    const performanceEvents = recentEvents.filter(e => e.eventType === 'deck_performance')
    
    if (performanceEvents.length >= 5) {
      const winRate = performanceEvents.filter(e => e.outcome === 'win').length / performanceEvents.length
      
      // Notify about winning streaks
      if (winRate > 0.8) {
        notifications.push({
          id: crypto.randomUUID(),
          userId,
          type: 'performance_success',
          title: 'Great Performance!',
          message: `You're on fire! ${Math.round(winRate * 100)}% win rate in recent games.`,
          data: {
            winRate,
            gamesPlayed: performanceEvents.length,
            suggestion: 'Consider documenting what\'s working well for future reference'
          },
          priority: 'low',
          channels: ['in_app'],
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
          createdAt: new Date()
        })
      }
      
      // Notify about losing streaks
      else if (winRate < 0.3) {
        notifications.push({
          id: crypto.randomUUID(),
          userId,
          type: 'performance_concern',
          title: 'Tough Games Lately',
          message: `Recent performance has been challenging. Consider reviewing your deck strategies or meta adaptations.`,
          data: {
            winRate,
            gamesPlayed: performanceEvents.length,
            suggestions: [
              'Review recent meta changes',
              'Consider deck optimizations',
              'Analyze matchup patterns'
            ]
          },
          priority: 'medium',
          channels: ['in_app'],
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          createdAt: new Date()
        })
      }
    }

    return notifications
  }

  /**
   * Generate collection-related notifications
   */
  private async generateCollectionNotifications(
    userId: string,
    userProfile: UserStyleProfile
  ): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = []

    // This would integrate with collection sync services
    // For now, generate placeholder notifications

    if (userProfile.collectionDependency > 0.7) {
      notifications.push({
        id: crypto.randomUUID(),
        userId,
        type: 'collection_sync',
        title: 'Collection Sync Reminder',
        message: 'Sync your collection to get better personalized suggestions based on cards you own.',
        data: {
          lastSync: null, // Would be actual last sync date
          benefits: [
            'More accurate budget calculations',
            'Prioritized suggestions for owned cards',
            'Better upgrade recommendations'
          ]
        },
        priority: 'low',
        channels: ['in_app'],
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        createdAt: new Date()
      })
    }

    return notifications
  }

  /**
   * Filter and prioritize notifications
   */
  private async filterAndPrioritizeNotifications(
    notifications: SmartNotification[],
    userProfile: UserStyleProfile,
    recentEvents: LearningEvent[]
  ): Promise<SmartNotification[]> {
    // Remove duplicate notification types
    const seenTypes = new Set<string>()
    const uniqueNotifications = notifications.filter(notification => {
      if (seenTypes.has(notification.type)) {
        return false
      }
      seenTypes.add(notification.type)
      return true
    })

    // Filter based on user preferences and recent activity
    const filteredNotifications = uniqueNotifications.filter(notification => {
      // Don't send too many notifications to inactive users
      if (recentEvents.length < 2 && notification.priority === 'low') {
        return false
      }

      // Respect user's competitive level for meta notifications
      if (notification.type.includes('meta') && userProfile.competitiveLevel < 0.3) {
        return false
      }

      // Respect budget sensitivity for budget notifications
      if (notification.type.includes('budget') && userProfile.budgetSensitivity < 0.3) {
        return false
      }

      return true
    })

    // Sort by priority and limit total notifications
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    
    return filteredNotifications
      .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
      .slice(0, 5) // Limit to 5 notifications max
  }

  /**
   * Store notifications for delivery
   */
  private async storeNotifications(notifications: SmartNotification[]): Promise<void> {
    try {
      for (const notification of notifications) {
        await db.$executeRaw`
          INSERT INTO smart_notifications (
            id, user_id, type, title, message, data, priority, 
            channels, scheduled_for, expires_at, created_at
          ) VALUES (
            ${notification.id}, ${notification.userId}, ${notification.type},
            ${notification.title}, ${notification.message}, ${JSON.stringify(notification.data)},
            ${notification.priority}, ${JSON.stringify(notification.channels)},
            ${notification.scheduledFor || new Date()}, ${notification.expiresAt},
            ${notification.createdAt}
          )
          ON CONFLICT (id) DO NOTHING
        `
      }
    } catch (error) {
      console.error('Failed to store notifications:', error)
    }
  }

  /**
   * Get pending notifications for a user
   */
  async getPendingNotifications(userId: string): Promise<SmartNotification[]> {
    try {
      const results = await db.$queryRaw<any[]>`
        SELECT * FROM smart_notifications
        WHERE user_id = ${userId}
          AND (scheduled_for IS NULL OR scheduled_for <= NOW())
          AND (expires_at IS NULL OR expires_at > NOW())
          AND delivered_at IS NULL
        ORDER BY priority DESC, created_at DESC
        LIMIT 10
      `

      return results.map(row => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        title: row.title,
        message: row.message,
        data: row.data,
        priority: row.priority,
        channels: row.channels,
        scheduledFor: row.scheduled_for,
        expiresAt: row.expires_at,
        createdAt: row.created_at
      }))
    } catch (error) {
      console.error('Failed to get pending notifications:', error)
      return []
    }
  }

  /**
   * Mark notification as delivered
   */
  async markNotificationDelivered(notificationId: string, channel: string): Promise<void> {
    try {
      await db.$executeRaw`
        UPDATE smart_notifications
        SET delivered_at = NOW(),
            delivered_channel = ${channel}
        WHERE id = ${notificationId}
      `
    } catch (error) {
      console.error('Failed to mark notification as delivered:', error)
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await db.$executeRaw`
        UPDATE smart_notifications
        SET read_at = NOW()
        WHERE id = ${notificationId}
      `
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string): Promise<{
    enabledChannels: ('in_app' | 'email' | 'push')[]
    enabledTypes: string[]
    frequency: 'immediate' | 'daily' | 'weekly'
  }> {
    // This would get user's notification preferences from database
    // For now, return defaults
    return {
      enabledChannels: ['in_app', 'email'],
      enabledTypes: ['meta_shift', 'upgrade_opportunity', 'performance_concern'],
      frequency: 'immediate'
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: {
      enabledChannels?: ('in_app' | 'email' | 'push')[]
      enabledTypes?: string[]
      frequency?: 'immediate' | 'daily' | 'weekly'
    }
  ): Promise<void> {
    try {
      await db.$executeRaw`
        INSERT INTO user_notification_preferences (
          user_id, enabled_channels, enabled_types, frequency, updated_at
        ) VALUES (
          ${userId}, ${JSON.stringify(preferences.enabledChannels)},
          ${JSON.stringify(preferences.enabledTypes)}, ${preferences.frequency},
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          enabled_channels = EXCLUDED.enabled_channels,
          enabled_types = EXCLUDED.enabled_types,
          frequency = EXCLUDED.frequency,
          updated_at = EXCLUDED.updated_at
      `
    } catch (error) {
      console.error('Failed to update notification preferences:', error)
    }
  }

  // Helper methods

  private isLearningMilestone(totalEvents: number): boolean {
    const milestones = [10, 25, 50, 100, 250, 500]
    return milestones.includes(totalEvents)
  }

  private getMilestoneDescription(totalEvents: number): string {
    if (totalEvents >= 500) return 'Master Deck Builder'
    if (totalEvents >= 250) return 'Expert Strategist'
    if (totalEvents >= 100) return 'Advanced Builder'
    if (totalEvents >= 50) return 'Competent Player'
    if (totalEvents >= 25) return 'Developing Builder'
    if (totalEvents >= 10) return 'Learning the Basics'
    return 'Getting Started'
  }

  private async getUserProfile(userId: string): Promise<UserStyleProfile> {
    const userData = await db.userLearningData.findUnique({
      where: { userId }
    })

    return userData?.styleProfile as UserStyleProfile || {
      userId,
      preferredStrategies: [],
      avoidedStrategies: [],
      complexityPreference: 'moderate',
      innovationTolerance: 0.5,
      favoriteCardTypes: [],
      preferredManaCosts: [],
      competitiveLevel: 0.5,
      budgetSensitivity: 0.5,
      collectionDependency: 0.5,
      suggestionAcceptanceRate: 0.5,
      preferenceConfidence: 0.3,
      lastUpdated: new Date()
    }
  }

  private async getUserDecks(userId: string): Promise<any[]> {
    const decks = await db.enhancedDeck.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        strategy: true
      }
    })

    return decks
  }
}

export const smartNotificationEngine = new SmartNotificationEngine()
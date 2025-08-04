/**
 * User Satisfaction Tracking Service
 * 
 * Tracks user feedback, satisfaction ratings, and NPS scores
 * to measure and improve user experience.
 */

import { logger } from '../core/logging'
import { performanceMonitor } from '../core/performance-monitor'
import { prisma } from '@moxmuse/db'

interface SatisfactionFeedback {
  id: string
  timestamp: Date
  userId: string
  deckId: string
  rating: number // 1-5
  feedback?: string
  aspects?: {
    cardChoices?: number // 1-5
    explanations?: number // 1-5
    synergyMapping?: number // 1-5
    budgetOptimization?: number // 1-5
  }
}

interface SatisfactionStats {
  averageRating: number
  totalFeedback: number
  ratingDistribution: Record<number, number>
  aspectAverages: {
    cardChoices: number
    explanations: number
    synergyMapping: number
    budgetOptimization: number
  }
  nps: number // Net Promoter Score
  satisfactionRate: number // % of ratings >= 4
  commonThemes: {
    theme: string
    count: number
    sentiment: 'positive' | 'negative' | 'neutral'
  }[]
}

interface SatisfactionTrend {
  date: string
  averageRating: number
  feedbackCount: number
  nps: number
}

interface UserInsight {
  type: 'improvement' | 'strength' | 'opportunity'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  affectedAspect?: string
  userCount: number
}

export class UserSatisfactionTracker {
  private feedbackRecords: SatisfactionFeedback[] = []
  private logger = logger.child({ service: 'UserSatisfactionTracker' })

  async recordFeedback(feedback: Omit<SatisfactionFeedback, 'id'>): Promise<void> {
    const record: SatisfactionFeedback = {
      id: this.generateId(),
      ...feedback
    }

    this.feedbackRecords.push(record)

    // Keep only recent feedback to prevent memory issues
    if (this.feedbackRecords.length > 10000) {
      this.feedbackRecords = this.feedbackRecords.slice(-10000)
    }

    // Log feedback
    this.logger.info('User satisfaction feedback recorded', {
      userId: feedback.userId,
      deckId: feedback.deckId,
      rating: feedback.rating,
      hasTextFeedback: !!feedback.feedback,
      aspects: feedback.aspects
    })

    // Record metrics
    performanceMonitor.recordMetric({
      operation: 'user.satisfaction',
      duration: 0,
      success: true,
      metadata: {
        rating: feedback.rating.toString(),
        userId: feedback.userId,
        deckId: feedback.deckId
      },
      timestamp: feedback.timestamp
    })

    // Alert on low ratings
    if (feedback.rating <= 2) {
      this.logger.warn('Low satisfaction rating received', {
        userId: feedback.userId,
        deckId: feedback.deckId,
        rating: feedback.rating,
        feedback: feedback.feedback
      })
    }
  }

  async getSatisfactionStats(timeRange?: { start: Date; end: Date }): Promise<SatisfactionStats> {
    const records = timeRange ? this.filterByTimeRange(timeRange) : this.feedbackRecords

    if (records.length === 0) {
      return this.getEmptyStats()
    }

    const stats: SatisfactionStats = {
      averageRating: 0,
      totalFeedback: records.length,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      aspectAverages: {
        cardChoices: 0,
        explanations: 0,
        synergyMapping: 0,
        budgetOptimization: 0
      },
      nps: 0,
      satisfactionRate: 0,
      commonThemes: []
    }

    let totalRating = 0
    let promoters = 0
    let detractors = 0
    let satisfiedCount = 0

    const aspectCounts = {
      cardChoices: 0,
      explanations: 0,
      synergyMapping: 0,
      budgetOptimization: 0
    }

    const aspectTotals = {
      cardChoices: 0,
      explanations: 0,
      synergyMapping: 0,
      budgetOptimization: 0
    }

    for (const record of records) {
      totalRating += record.rating
      stats.ratingDistribution[record.rating]++

      // NPS calculation (5 = promoter, 1-3 = detractor)
      if (record.rating === 5) {
        promoters++
      } else if (record.rating <= 3) {
        detractors++
      }

      // Satisfaction rate
      if (record.rating >= 4) {
        satisfiedCount++
      }

      // Aspect ratings
      if (record.aspects) {
        for (const [aspect, rating] of Object.entries(record.aspects)) {
          if (rating !== undefined) {
            aspectCounts[aspect as keyof typeof aspectCounts]++
            aspectTotals[aspect as keyof typeof aspectTotals] += rating
          }
        }
      }
    }

    // Calculate averages
    stats.averageRating = totalRating / records.length
    stats.nps = ((promoters - detractors) / records.length) * 100
    stats.satisfactionRate = (satisfiedCount / records.length) * 100

    // Calculate aspect averages
    for (const aspect of Object.keys(aspectCounts) as (keyof typeof aspectCounts)[]) {
      if (aspectCounts[aspect] > 0) {
        stats.aspectAverages[aspect] = aspectTotals[aspect] / aspectCounts[aspect]
      }
    }

    // Extract common themes from feedback text
    stats.commonThemes = this.extractThemes(records)

    return stats
  }

  async getSatisfactionTrends(timeRange?: { start: Date; end: Date }): Promise<SatisfactionTrend[]> {
    const range = timeRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date()
    }

    const records = this.filterByTimeRange(range)
    const trendMap = new Map<string, {
      ratings: number[]
      feedbackCount: number
    }>()

    for (const record of records) {
      const dateKey = record.timestamp.toISOString().split('T')[0]
      
      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, {
          ratings: [],
          feedbackCount: 0
        })
      }

      const trend = trendMap.get(dateKey)!
      trend.ratings.push(record.rating)
      trend.feedbackCount++
    }

    const trends: SatisfactionTrend[] = []

    // Convert Map entries to array for compatibility
    const entries = Array.from(trendMap.entries())
    
    for (const [date, data] of entries) {
      const averageRating = data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length
      const promoters = data.ratings.filter(r => r === 5).length
      const detractors = data.ratings.filter(r => r <= 3).length
      const nps = ((promoters - detractors) / data.ratings.length) * 100

      trends.push({
        date,
        averageRating,
        feedbackCount: data.feedbackCount,
        nps
      })
    }

    return trends.sort((a, b) => a.date.localeCompare(b.date))
  }

  async getInsights(): Promise<UserInsight[]> {
    const insights: UserInsight[] = []
    const recentStats = await this.getSatisfactionStats({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      end: new Date()
    })

    // Low satisfaction insight
    if (recentStats.averageRating < 3.5) {
      insights.push({
        type: 'improvement',
        title: 'Low Overall Satisfaction',
        description: `Average rating is ${recentStats.averageRating.toFixed(1)}/5. Users may be experiencing issues with deck quality.`,
        impact: 'high',
        userCount: recentStats.totalFeedback
      })
    }

    // Aspect-specific insights
    for (const [aspect, average] of Object.entries(recentStats.aspectAverages)) {
      if (average > 0 && average < 3) {
        insights.push({
          type: 'improvement',
          title: `${this.formatAspectName(aspect)} Needs Improvement`,
          description: `Users rated ${this.formatAspectName(aspect)} at ${average.toFixed(1)}/5 on average.`,
          impact: average < 2.5 ? 'high' : 'medium',
          affectedAspect: aspect,
          userCount: recentStats.totalFeedback
        })
      } else if (average >= 4.5) {
        insights.push({
          type: 'strength',
          title: `${this.formatAspectName(aspect)} Performing Well`,
          description: `Users love the ${this.formatAspectName(aspect)} feature with ${average.toFixed(1)}/5 rating.`,
          impact: 'medium',
          affectedAspect: aspect,
          userCount: recentStats.totalFeedback
        })
      }
    }

    // NPS insights
    if (recentStats.nps < 0) {
      insights.push({
        type: 'improvement',
        title: 'Negative Net Promoter Score',
        description: `NPS is ${recentStats.nps.toFixed(0)}. More users are detractors than promoters.`,
        impact: 'high',
        userCount: recentStats.totalFeedback
      })
    } else if (recentStats.nps > 50) {
      insights.push({
        type: 'strength',
        title: 'Excellent Net Promoter Score',
        description: `NPS is ${recentStats.nps.toFixed(0)}. Users are highly likely to recommend the service.`,
        impact: 'high',
        userCount: recentStats.totalFeedback
      })
    }

    // Theme-based insights
    for (const theme of recentStats.commonThemes) {
      if (theme.sentiment === 'negative' && theme.count >= 5) {
        insights.push({
          type: 'improvement',
          title: `Common Issue: ${theme.theme}`,
          description: `${theme.count} users mentioned issues related to ${theme.theme}.`,
          impact: theme.count >= 10 ? 'high' : 'medium',
          userCount: theme.count
        })
      } else if (theme.sentiment === 'positive' && theme.count >= 10) {
        insights.push({
          type: 'strength',
          title: `Users Love: ${theme.theme}`,
          description: `${theme.count} users praised ${theme.theme}.`,
          impact: 'medium',
          userCount: theme.count
        })
      }
    }

    return insights.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 }
      return impactOrder[a.impact] - impactOrder[b.impact]
    })
  }

  private filterByTimeRange(timeRange: { start: Date; end: Date }): SatisfactionFeedback[] {
    return this.feedbackRecords.filter(
      record => record.timestamp >= timeRange.start && record.timestamp <= timeRange.end
    )
  }

  private extractThemes(records: SatisfactionFeedback[]): SatisfactionStats['commonThemes'] {
    const themeMap = new Map<string, { count: number; sentiment: 'positive' | 'negative' | 'neutral' }>()
    
    // Simple keyword-based theme extraction
    const positiveKeywords = ['great', 'excellent', 'love', 'amazing', 'perfect', 'helpful', 'accurate']
    const negativeKeywords = ['bad', 'poor', 'wrong', 'incorrect', 'slow', 'confusing', 'expensive']
    
    const themes = {
      'card recommendations': ['card', 'recommendation', 'suggestion', 'choice'],
      'explanations': ['explanation', 'explain', 'understand', 'clear'],
      'budget': ['budget', 'price', 'cost', 'expensive', 'cheap'],
      'synergy': ['synergy', 'combo', 'interaction', 'work together'],
      'performance': ['slow', 'fast', 'speed', 'performance', 'loading']
    }

    for (const record of records) {
      if (!record.feedback) continue

      const lowerFeedback = record.feedback.toLowerCase()
      
      for (const [theme, keywords] of Object.entries(themes)) {
        if (keywords.some(keyword => lowerFeedback.includes(keyword))) {
          if (!themeMap.has(theme)) {
            themeMap.set(theme, { count: 0, sentiment: 'neutral' })
          }
          
          const themeData = themeMap.get(theme)!
          themeData.count++
          
          // Determine sentiment
          const hasPositive = positiveKeywords.some(keyword => lowerFeedback.includes(keyword))
          const hasNegative = negativeKeywords.some(keyword => lowerFeedback.includes(keyword))
          
          if (hasPositive && !hasNegative) {
            themeData.sentiment = 'positive'
          } else if (hasNegative && !hasPositive) {
            themeData.sentiment = 'negative'
          }
        }
      }
    }

    return Array.from(themeMap.entries())
      .map(([theme, data]) => ({
        theme,
        count: data.count,
        sentiment: data.sentiment
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  private formatAspectName(aspect: string): string {
    const formatted: Record<string, string> = {
      cardChoices: 'Card Choices',
      explanations: 'Explanations',
      synergyMapping: 'Synergy Mapping',
      budgetOptimization: 'Budget Optimization'
    }
    return formatted[aspect] || aspect
  }

  private getEmptyStats(): SatisfactionStats {
    return {
      averageRating: 0,
      totalFeedback: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      aspectAverages: {
        cardChoices: 0,
        explanations: 0,
        synergyMapping: 0,
        budgetOptimization: 0
      },
      nps: 0,
      satisfactionRate: 0,
      commonThemes: []
    }
  }

  private generateId(): string {
    return `satisfaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const userSatisfactionTracker = new UserSatisfactionTracker()

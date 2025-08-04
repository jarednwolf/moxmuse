/**
 * AI Usage Monitoring Service
 * 
 * Tracks AI API usage, costs, and performance metrics
 * for cost optimization and usage analysis.
 */

import { logger } from '../core/logging'
import { performanceMonitor } from '../core/performance-monitor'
import { prisma } from '@moxmuse/db'

interface AIUsageRecord {
  id: string
  timestamp: Date
  userId?: string
  model: string
  taskType: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  duration: number
  success: boolean
  error?: string
}

interface AIUsageStats {
  totalTokens: number
  totalCost: number
  requestCount: number
  averageTokensPerRequest: number
  averageCostPerRequest: number
  averageDuration: number
  successRate: number
  byModel: Record<string, {
    requests: number
    tokens: number
    cost: number
  }>
  byTaskType: Record<string, {
    requests: number
    tokens: number
    cost: number
  }>
}

interface CostAnalysis {
  totalCost: number
  costByModel: Record<string, number>
  costByTaskType: Record<string, number>
  costByUser: Record<string, number>
  projectedMonthlyCost: number
  costTrend: number // percentage change
}

interface UsageTrend {
  date: string
  requests: number
  tokens: number
  cost: number
}

interface AIUsageFilter {
  model?: string
  taskType?: string
  userId?: string
  timeRange?: {
    start: Date
    end: Date
  }
}

// Model pricing (per 1k tokens)
const MODEL_PRICING = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 }
}

export class AIUsageMonitor {
  private usageRecords: AIUsageRecord[] = []
  private logger = logger.child({ service: 'AIUsageMonitor' })

  async recordUsage(record: Omit<AIUsageRecord, 'id'>): Promise<void> {
    const fullRecord: AIUsageRecord = {
      id: this.generateId(),
      ...record
    }

    this.usageRecords.push(fullRecord)

    // Keep only recent records to prevent memory issues
    if (this.usageRecords.length > 10000) {
      this.usageRecords = this.usageRecords.slice(-10000)
    }

    // Log high-cost requests
    if (record.cost > 1) {
      this.logger.warn('High-cost AI request', {
        model: record.model,
        taskType: record.taskType,
        cost: record.cost,
        tokens: record.totalTokens
      })
    }

    // Record metrics
    performanceMonitor.recordMetric({
      operation: `ai.${record.taskType}`,
      duration: record.duration,
      success: record.success,
      error: record.error,
      metadata: {
        model: record.model,
        tokens: record.totalTokens.toString(),
        cost: record.cost.toString()
      },
      timestamp: record.timestamp
    })
  }

  async getUsageStats(filter: AIUsageFilter = {}): Promise<AIUsageStats> {
    const records = this.filterRecords(filter)

    if (records.length === 0) {
      return this.getEmptyStats()
    }

    const stats: AIUsageStats = {
      totalTokens: 0,
      totalCost: 0,
      requestCount: records.length,
      averageTokensPerRequest: 0,
      averageCostPerRequest: 0,
      averageDuration: 0,
      successRate: 0,
      byModel: {},
      byTaskType: {}
    }

    let successCount = 0
    let totalDuration = 0

    for (const record of records) {
      stats.totalTokens += record.totalTokens
      stats.totalCost += record.cost
      totalDuration += record.duration

      if (record.success) {
        successCount++
      }

      // Group by model
      if (!stats.byModel[record.model]) {
        stats.byModel[record.model] = { requests: 0, tokens: 0, cost: 0 }
      }
      stats.byModel[record.model].requests++
      stats.byModel[record.model].tokens += record.totalTokens
      stats.byModel[record.model].cost += record.cost

      // Group by task type
      if (!stats.byTaskType[record.taskType]) {
        stats.byTaskType[record.taskType] = { requests: 0, tokens: 0, cost: 0 }
      }
      stats.byTaskType[record.taskType].requests++
      stats.byTaskType[record.taskType].tokens += record.totalTokens
      stats.byTaskType[record.taskType].cost += record.cost
    }

    stats.averageTokensPerRequest = stats.totalTokens / stats.requestCount
    stats.averageCostPerRequest = stats.totalCost / stats.requestCount
    stats.averageDuration = totalDuration / stats.requestCount
    stats.successRate = successCount / stats.requestCount

    return stats
  }

  async getCostAnalysis(timeRange?: { start: Date; end: Date }): Promise<CostAnalysis> {
    const now = new Date()
    const range = timeRange || {
      start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: now
    }

    const records = this.filterRecords({ timeRange: range })
    
    const analysis: CostAnalysis = {
      totalCost: 0,
      costByModel: {},
      costByTaskType: {},
      costByUser: {},
      projectedMonthlyCost: 0,
      costTrend: 0
    }

    for (const record of records) {
      analysis.totalCost += record.cost

      // By model
      if (!analysis.costByModel[record.model]) {
        analysis.costByModel[record.model] = 0
      }
      analysis.costByModel[record.model] += record.cost

      // By task type
      if (!analysis.costByTaskType[record.taskType]) {
        analysis.costByTaskType[record.taskType] = 0
      }
      analysis.costByTaskType[record.taskType] += record.cost

      // By user
      if (record.userId) {
        if (!analysis.costByUser[record.userId]) {
          analysis.costByUser[record.userId] = 0
        }
        analysis.costByUser[record.userId] += record.cost
      }
    }

    // Calculate projected monthly cost
    const daysInRange = (range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000)
    analysis.projectedMonthlyCost = (analysis.totalCost / daysInRange) * 30

    // Calculate cost trend (compare last 15 days to previous 15 days)
    const midPoint = new Date(range.start.getTime() + (range.end.getTime() - range.start.getTime()) / 2)
    const firstHalf = records.filter(r => r.timestamp < midPoint)
    const secondHalf = records.filter(r => r.timestamp >= midPoint)
    
    const firstHalfCost = firstHalf.reduce((sum, r) => sum + r.cost, 0)
    const secondHalfCost = secondHalf.reduce((sum, r) => sum + r.cost, 0)
    
    if (firstHalfCost > 0) {
      analysis.costTrend = ((secondHalfCost - firstHalfCost) / firstHalfCost) * 100
    }

    return analysis
  }

  async getUsageTrends(timeRange?: { start: Date; end: Date }): Promise<UsageTrend[]> {
    const now = new Date()
    const range = timeRange || {
      start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: now
    }

    const records = this.filterRecords({ timeRange: range })
    const trendMap = new Map<string, UsageTrend>()

    for (const record of records) {
      const dateKey = record.timestamp.toISOString().split('T')[0]
      
      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, {
          date: dateKey,
          requests: 0,
          tokens: 0,
          cost: 0
        })
      }

      const trend = trendMap.get(dateKey)!
      trend.requests++
      trend.tokens += record.totalTokens
      trend.cost += record.cost
    }

    return Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || { input: 0.01, output: 0.01 }
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1000
  }

  private filterRecords(filter: AIUsageFilter): AIUsageRecord[] {
    return this.usageRecords.filter(record => {
      if (filter.model && record.model !== filter.model) return false
      if (filter.taskType && record.taskType !== filter.taskType) return false
      if (filter.userId && record.userId !== filter.userId) return false
      if (filter.timeRange) {
        if (record.timestamp < filter.timeRange.start) return false
        if (record.timestamp > filter.timeRange.end) return false
      }
      return true
    })
  }

  private getEmptyStats(): AIUsageStats {
    return {
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0,
      averageTokensPerRequest: 0,
      averageCostPerRequest: 0,
      averageDuration: 0,
      successRate: 0,
      byModel: {},
      byTaskType: {}
    }
  }

  private generateId(): string {
    return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const aiUsageMonitor = new AIUsageMonitor()

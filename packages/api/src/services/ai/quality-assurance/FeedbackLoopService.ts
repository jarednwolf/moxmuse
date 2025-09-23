import { z } from 'zod'
import { GeneratedDeck, ConsultationData } from '@moxmuse/shared'
import { aiQualityAssuranceService, FeedbackData } from './AIQualityAssuranceService'
import { aiServiceOrchestrator } from '../index'

// Feedback Loop Types
export const ImprovementMetricSchema = z.object({
  metricName: z.string(),
  currentValue: z.number(),
  targetValue: z.number(),
  trend: z.enum(['improving', 'declining', 'stable']),
  changeRate: z.number(),
  lastUpdated: z.date(),
  dataPoints: z.array(z.object({
    timestamp: z.date(),
    value: z.number(),
  })),
})

export type ImprovementMetric = z.infer<typeof ImprovementMetricSchema>

export const LearningInsightSchema = z.object({
  id: z.string(),
  category: z.enum([
    'deck_quality',
    'synergy_accuracy',
    'budget_compliance',
    'power_level_estimation',
    'user_satisfaction',
    'generation_speed',
    'consistency'
  ]),
  insight: z.string(),
  confidence: z.number().min(0).max(1),
  impact: z.enum(['low', 'medium', 'high']),
  actionable: z.boolean(),
  recommendedActions: z.array(z.string()),
  supportingData: z.array(z.object({
    source: z.string(),
    dataPoint: z.string(),
    value: z.number(),
  })),
  discoveredAt: z.date(),
  implementationStatus: z.enum(['pending', 'in_progress', 'completed', 'rejected']),
})

export type LearningInsight = z.infer<typeof LearningInsightSchema>

export const ModelPerformanceSchema = z.object({
  modelVersion: z.string(),
  evaluationPeriod: z.object({
    start: z.date(),
    end: z.date(),
  }),
  metrics: z.object({
    averageQualityScore: z.number(),
    userSatisfactionScore: z.number(),
    generationSuccessRate: z.number(),
    averageGenerationTime: z.number(),
    budgetAccuracy: z.number(),
    powerLevelAccuracy: z.number(),
    synergyAccuracy: z.number(),
  }),
  improvements: z.array(z.string()),
  regressions: z.array(z.string()),
  recommendations: z.array(z.string()),
})

export type ModelPerformance = z.infer<typeof ModelPerformanceSchema>

export const FeedbackAnalysisSchema = z.object({
  totalFeedbackCount: z.number(),
  averageRating: z.number(),
  ratingDistribution: z.record(z.number()),
  categoryBreakdown: z.object({
    deckQuality: z.number(),
    synergyAccuracy: z.number(),
    budgetCompliance: z.number(),
    powerLevelMatch: z.number(),
    playability: z.number(),
  }),
  commonIssues: z.array(z.object({
    issue: z.string(),
    frequency: z.number(),
    severity: z.enum(['low', 'medium', 'high']),
    suggestedFix: z.string(),
  })),
  positivePatterns: z.array(z.object({
    pattern: z.string(),
    frequency: z.number(),
    reinforcement: z.string(),
  })),
  trendAnalysis: z.object({
    overallTrend: z.enum(['improving', 'declining', 'stable']),
    periodComparison: z.object({
      current: z.number(),
      previous: z.number(),
      change: z.number(),
    }),
  }),
})

export type FeedbackAnalysis = z.infer<typeof FeedbackAnalysisSchema>

/**
 * Feedback Loop Service for Continuous AI Improvement
 * Processes user feedback and implements continuous learning mechanisms
 */
export class FeedbackLoopService {
  private feedbackDatabase: Map<string, FeedbackData[]> = new Map()
  private improvementMetrics: Map<string, ImprovementMetric> = new Map()
  private learningInsights: Map<string, LearningInsight> = new Map()
  private modelPerformanceHistory: ModelPerformance[] = []
  private feedbackProcessingQueue: FeedbackData[] = []
  private learningSchedule: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    console.log('🔄 Initializing Feedback Loop Service')
    this.initializeMetrics()
    this.startFeedbackProcessing()
    this.scheduleLearningCycles()
  }

  /**
   * Process new user feedback
   */
  async processFeedback(feedback: FeedbackData): Promise<void> {
    console.log(`📝 Processing feedback for deck: ${feedback.deckId}`)

    try {
      // Store feedback
      this.storeFeedback(feedback)

      // Add to processing queue
      this.feedbackProcessingQueue.push(feedback)

      // Update metrics immediately for critical feedback
      if (feedback.rating <= 2) {
        await this.processUrgentFeedback(feedback)
      }

      // Trigger quality assurance processing
      await aiQualityAssuranceService.processFeedback(feedback)

      console.log('✅ Feedback processed successfully')

    } catch (error) {
      console.error('❌ Feedback processing failed:', error)
      throw error
    }
  }

  /**
   * Analyze feedback patterns and generate insights
   */
  async analyzeFeedbackPatterns(): Promise<FeedbackAnalysis> {
    console.log('📊 Analyzing feedback patterns')

    const allFeedback = Array.from(this.feedbackDatabase.values()).flat()
    
    if (allFeedback.length === 0) {
      return this.getEmptyFeedbackAnalysis()
    }

    // Calculate basic statistics
    const totalFeedbackCount = allFeedback.length
    const averageRating = allFeedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedbackCount
    
    // Rating distribution
    const ratingDistribution: Record<number, number> = {}
    for (let i = 1; i <= 5; i++) {
      ratingDistribution[i] = allFeedback.filter(f => f.rating === i).length
    }

    // Category breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(allFeedback)

    // Identify common issues
    const commonIssues = await this.identifyCommonIssues(allFeedback)

    // Identify positive patterns
    const positivePatterns = await this.identifyPositivePatterns(allFeedback)

    // Trend analysis
    const trendAnalysis = this.analyzeTrends(allFeedback)

    const analysis: FeedbackAnalysis = {
      totalFeedbackCount,
      averageRating,
      ratingDistribution,
      categoryBreakdown,
      commonIssues,
      positivePatterns,
      trendAnalysis,
    }

    console.log(`📊 Feedback analysis completed: ${totalFeedbackCount} feedback entries, avg rating: ${averageRating.toFixed(2)}`)
    return analysis
  }

  /**
   * Generate learning insights from feedback data
   */
  async generateLearningInsights(): Promise<LearningInsight[]> {
    console.log('🧠 Generating learning insights')

    const insights: LearningInsight[] = []
    const feedbackAnalysis = await this.analyzeFeedbackPatterns()

    // Insight 1: Overall quality trends
    if (feedbackAnalysis.trendAnalysis.overallTrend === 'declining') {
      insights.push({
        id: `insight_${Date.now()}_quality_decline`,
        category: 'deck_quality',
        insight: 'Overall deck quality ratings are declining, indicating potential issues with generation algorithms',
        confidence: 0.8,
        impact: 'high',
        actionable: true,
        recommendedActions: [
          'Review recent changes to generation algorithms',
          'Analyze specific quality issues mentioned in feedback',
          'Implement additional quality validation steps'
        ],
        supportingData: [
          {
            source: 'user_feedback',
            dataPoint: 'average_rating_change',
            value: feedbackAnalysis.trendAnalysis.periodComparison.change,
          }
        ],
        discoveredAt: new Date(),
        implementationStatus: 'pending',
      })
    }

    // Insight 2: Budget compliance issues
    if (feedbackAnalysis.categoryBreakdown.budgetCompliance < 3.5) {
      insights.push({
        id: `insight_${Date.now()}_budget_issues`,
        category: 'budget_compliance',
        insight: 'Budget compliance ratings are consistently low, suggesting price data or budget calculation issues',
        confidence: 0.9,
        impact: 'high',
        actionable: true,
        recommendedActions: [
          'Update card price data sources',
          'Review budget calculation algorithms',
          'Implement better budget optimization'
        ],
        supportingData: [
          {
            source: 'user_feedback',
            dataPoint: 'budget_compliance_rating',
            value: feedbackAnalysis.categoryBreakdown.budgetCompliance,
          }
        ],
        discoveredAt: new Date(),
        implementationStatus: 'pending',
      })
    }

    // Insight 3: Synergy accuracy
    if (feedbackAnalysis.categoryBreakdown.synergyAccuracy < 3.5) {
      insights.push({
        id: `insight_${Date.now()}_synergy_issues`,
        category: 'synergy_accuracy',
        insight: 'Synergy detection and card interaction analysis needs improvement',
        confidence: 0.85,
        impact: 'medium',
        actionable: true,
        recommendedActions: [
          'Enhance synergy detection algorithms',
          'Expand card interaction database',
          'Implement better context-aware card selection'
        ],
        supportingData: [
          {
            source: 'user_feedback',
            dataPoint: 'synergy_accuracy_rating',
            value: feedbackAnalysis.categoryBreakdown.synergyAccuracy,
          }
        ],
        discoveredAt: new Date(),
        implementationStatus: 'pending',
      })
    }

    // Store insights
    insights.forEach(insight => {
      this.learningInsights.set(insight.id, insight)
    })

    console.log(`🧠 Generated ${insights.length} learning insights`)
    return insights
  }

  /**
   * Implement improvements based on insights
   */
  async implementImprovements(insightIds: string[]): Promise<void> {
    console.log(`🔧 Implementing improvements for ${insightIds.length} insights`)

    for (const insightId of insightIds) {
      const insight = this.learningInsights.get(insightId)
      if (!insight) {
        console.warn(`Insight not found: ${insightId}`)
        continue
      }

      try {
        // Mark as in progress
        insight.implementationStatus = 'in_progress'
        this.learningInsights.set(insightId, insight)

        // Implement based on category
        await this.implementCategoryImprovement(insight)

        // Mark as completed
        insight.implementationStatus = 'completed'
        this.learningInsights.set(insightId, insight)

        console.log(`✅ Implemented improvement for insight: ${insight.category}`)

      } catch (error) {
        console.error(`❌ Failed to implement improvement for ${insightId}:`, error)
        insight.implementationStatus = 'rejected'
        this.learningInsights.set(insightId, insight)
      }
    }
  }

  /**
   * Evaluate model performance over time
   */
  async evaluateModelPerformance(
    modelVersion: string,
    startDate: Date,
    endDate: Date
  ): Promise<ModelPerformance> {
    console.log(`📈 Evaluating model performance for version ${modelVersion}`)

    // Get feedback data for the period
    const periodFeedback = this.getFeedbackForPeriod(startDate, endDate)
    
    // Calculate performance metrics
    const metrics = this.calculatePerformanceMetrics(periodFeedback)
    
    // Compare with previous period
    const previousPeriod = this.getPreviousPeriodMetrics(startDate, endDate)
    const improvements = this.identifyImprovements(metrics, previousPeriod)
    const regressions = this.identifyRegressions(metrics, previousPeriod)
    
    // Generate recommendations
    const recommendations = await this.generatePerformanceRecommendations(metrics, improvements, regressions)

    const performance: ModelPerformance = {
      modelVersion,
      evaluationPeriod: { start: startDate, end: endDate },
      metrics,
      improvements,
      regressions,
      recommendations,
    }

    // Store performance history
    this.modelPerformanceHistory.push(performance)

    console.log(`📈 Model performance evaluation completed`)
    return performance
  }

  /**
   * Get improvement metrics
   */
  getImprovementMetrics(): Map<string, ImprovementMetric> {
    return new Map(this.improvementMetrics)
  }

  /**
   * Update improvement metric
   */
  updateImprovementMetric(metricName: string, value: number): void {
    const metric = this.improvementMetrics.get(metricName)
    if (!metric) {
      console.warn(`Metric not found: ${metricName}`)
      return
    }

    // Add data point
    metric.dataPoints.push({
      timestamp: new Date(),
      value,
    })

    // Keep only last 100 data points
    if (metric.dataPoints.length > 100) {
      metric.dataPoints.shift()
    }

    // Update current value and trend
    const previousValue = metric.currentValue
    metric.currentValue = value
    metric.lastUpdated = new Date()

    // Calculate trend
    if (metric.dataPoints.length >= 2) {
      const recentPoints = metric.dataPoints.slice(-10) // Last 10 points
      const trend = this.calculateTrend(recentPoints)
      metric.trend = trend
      metric.changeRate = (value - previousValue) / previousValue
    }

    this.improvementMetrics.set(metricName, metric)
  }

  // Private helper methods

  private storeFeedback(feedback: FeedbackData): void {
    const deckFeedback = this.feedbackDatabase.get(feedback.deckId) || []
    deckFeedback.push(feedback)
    this.feedbackDatabase.set(feedback.deckId, deckFeedback)
  }

  private async processUrgentFeedback(feedback: FeedbackData): Promise<void> {
    console.log(`🚨 Processing urgent feedback (rating: ${feedback.rating})`)

    // Immediately update metrics for low ratings
    this.updateImprovementMetric('user_satisfaction', feedback.rating)
    this.updateImprovementMetric('deck_quality', feedback.categories.deckQuality)

    // Generate immediate insight for critical issues
    if (feedback.rating === 1) {
      const insight: LearningInsight = {
        id: `urgent_${Date.now()}_${feedback.deckId}`,
        category: 'user_satisfaction',
        insight: `Critical user satisfaction issue detected: ${feedback.feedback || 'No details provided'}`,
        confidence: 1.0,
        impact: 'high',
        actionable: true,
        recommendedActions: [
          'Investigate specific deck generation issues',
          'Review user consultation data for patterns',
          'Implement immediate quality checks'
        ],
        supportingData: [
          {
            source: 'user_feedback',
            dataPoint: 'critical_rating',
            value: feedback.rating,
          }
        ],
        discoveredAt: new Date(),
        implementationStatus: 'pending',
      }

      this.learningInsights.set(insight.id, insight)
    }
  }

  private calculateCategoryBreakdown(feedback: FeedbackData[]): any {
    const totals = feedback.reduce((acc, f) => ({
      deckQuality: acc.deckQuality + f.categories.deckQuality,
      synergyAccuracy: acc.synergyAccuracy + f.categories.synergyAccuracy,
      budgetCompliance: acc.budgetCompliance + f.categories.budgetCompliance,
      powerLevelMatch: acc.powerLevelMatch + f.categories.powerLevelMatch,
      playability: acc.playability + f.categories.playability,
    }), {
      deckQuality: 0,
      synergyAccuracy: 0,
      budgetCompliance: 0,
      powerLevelMatch: 0,
      playability: 0,
    })

    const count = feedback.length
    return {
      deckQuality: totals.deckQuality / count,
      synergyAccuracy: totals.synergyAccuracy / count,
      budgetCompliance: totals.budgetCompliance / count,
      powerLevelMatch: totals.powerLevelMatch / count,
      playability: totals.playability / count,
    }
  }

  private async identifyCommonIssues(feedback: FeedbackData[]): Promise<any[]> {
    const issues: Map<string, { count: number; severity: string }> = new Map()

    // Analyze feedback text for common issues
    for (const f of feedback) {
      if (f.feedback) {
        const detectedIssues = await this.extractIssuesFromText(f.feedback)
        for (const issue of detectedIssues) {
          const existing = issues.get(issue.issue) || { count: 0, severity: 'low' }
          existing.count++
          if (f.rating <= 2) existing.severity = 'high'
          else if (f.rating <= 3) existing.severity = 'medium'
          issues.set(issue.issue, existing)
        }
      }

      // Check category ratings for issues
      if (f.categories.budgetCompliance <= 2) {
        const existing = issues.get('budget_compliance') || { count: 0, severity: 'low' }
        existing.count++
        existing.severity = 'high'
        issues.set('budget_compliance', existing)
      }

      if (f.categories.synergyAccuracy <= 2) {
        const existing = issues.get('synergy_accuracy') || { count: 0, severity: 'low' }
        existing.count++
        existing.severity = 'medium'
        issues.set('synergy_accuracy', existing)
      }
    }

    // Convert to array and sort by frequency
    return Array.from(issues.entries())
      .map(([issue, data]) => ({
        issue,
        frequency: data.count,
        severity: data.severity as 'low' | 'medium' | 'high',
        suggestedFix: this.getSuggestedFix(issue),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10) // Top 10 issues
  }

  private async identifyPositivePatterns(feedback: FeedbackData[]): Promise<any[]> {
    const patterns: Map<string, number> = new Map()

    const positiveFeedback = feedback.filter(f => f.rating >= 4)

    for (const f of positiveFeedback) {
      if (f.feedback) {
        const detectedPatterns = await this.extractPatternsFromText(f.feedback)
        for (const pattern of detectedPatterns) {
          const count = patterns.get(pattern) || 0
          patterns.set(pattern, count + 1)
        }
      }

      // Check high category ratings
      if (f.categories.deckQuality >= 4) {
        const count = patterns.get('high_deck_quality') || 0
        patterns.set('high_deck_quality', count + 1)
      }

      if (f.categories.synergyAccuracy >= 4) {
        const count = patterns.get('good_synergy_detection') || 0
        patterns.set('good_synergy_detection', count + 1)
      }
    }

    return Array.from(patterns.entries())
      .map(([pattern, frequency]) => ({
        pattern,
        frequency,
        reinforcement: this.getReinforcementStrategy(pattern),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5) // Top 5 patterns
  }

  private analyzeTrends(feedback: FeedbackData[]): any {
    if (feedback.length < 10) {
      return {
        overallTrend: 'stable' as const,
        periodComparison: { current: 0, previous: 0, change: 0 },
      }
    }

    // Sort by timestamp
    const sortedFeedback = feedback.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    
    // Split into two periods
    const midpoint = Math.floor(sortedFeedback.length / 2)
    const previousPeriod = sortedFeedback.slice(0, midpoint)
    const currentPeriod = sortedFeedback.slice(midpoint)

    const previousAvg = previousPeriod.reduce((sum, f) => sum + f.rating, 0) / previousPeriod.length
    const currentAvg = currentPeriod.reduce((sum, f) => sum + f.rating, 0) / currentPeriod.length
    const change = currentAvg - previousAvg

    let overallTrend: 'improving' | 'declining' | 'stable'
    if (Math.abs(change) < 0.1) overallTrend = 'stable'
    else if (change > 0) overallTrend = 'improving'
    else overallTrend = 'declining'

    return {
      overallTrend,
      periodComparison: {
        current: currentAvg,
        previous: previousAvg,
        change,
      },
    }
  }

  private async extractIssuesFromText(text: string): Promise<Array<{ issue: string }>> {
    // Mock issue extraction - would use NLP
    const commonIssues = [
      'budget_too_high',
      'poor_synergy',
      'weak_mana_base',
      'inconsistent_strategy',
      'power_level_mismatch'
    ]

    const detectedIssues: Array<{ issue: string }> = []
    
    for (const issue of commonIssues) {
      if (text.toLowerCase().includes(issue.replace('_', ' '))) {
        detectedIssues.push({ issue })
      }
    }

    return detectedIssues
  }

  private async extractPatternsFromText(text: string): Promise<string[]> {
    // Mock pattern extraction - would use NLP
    const positivePatterns = [
      'great_synergy',
      'perfect_budget',
      'excellent_strategy',
      'fun_to_play',
      'well_balanced'
    ]

    const detectedPatterns: string[] = []
    
    for (const pattern of positivePatterns) {
      if (text.toLowerCase().includes(pattern.replace('_', ' '))) {
        detectedPatterns.push(pattern)
      }
    }

    return detectedPatterns
  }

  private getSuggestedFix(issue: string): string {
    const fixes: Record<string, string> = {
      'budget_compliance': 'Improve price data accuracy and budget calculation algorithms',
      'synergy_accuracy': 'Enhance card interaction database and synergy detection',
      'budget_too_high': 'Implement better budget optimization and alternative card suggestions',
      'poor_synergy': 'Improve card selection algorithms to prioritize synergistic cards',
      'weak_mana_base': 'Enhance mana base generation with better land selection',
      'inconsistent_strategy': 'Improve strategy coherence validation',
      'power_level_mismatch': 'Refine power level assessment algorithms',
    }

    return fixes[issue] || 'Investigate and address this issue'
  }

  private getReinforcementStrategy(pattern: string): string {
    const strategies: Record<string, string> = {
      'high_deck_quality': 'Continue prioritizing quality validation and card selection',
      'good_synergy_detection': 'Maintain and expand synergy detection algorithms',
      'great_synergy': 'Reinforce synergy-focused card selection',
      'perfect_budget': 'Continue accurate budget tracking and optimization',
      'excellent_strategy': 'Maintain strategy coherence validation',
      'fun_to_play': 'Continue balancing competitive viability with fun factor',
      'well_balanced': 'Maintain balanced approach to deck construction',
    }

    return strategies[pattern] || 'Continue this positive approach'
  }

  private async implementCategoryImprovement(insight: LearningInsight): Promise<void> {
    console.log(`🔧 Implementing improvement for category: ${insight.category}`)

    switch (insight.category) {
      case 'budget_compliance':
        await this.improveBudgetCompliance()
        break
      case 'synergy_accuracy':
        await this.improveSynergyAccuracy()
        break
      case 'deck_quality':
        await this.improveDeckQuality()
        break
      case 'power_level_estimation':
        await this.improvePowerLevelEstimation()
        break
      default:
        console.log(`No specific implementation for category: ${insight.category}`)
    }
  }

  private async improveBudgetCompliance(): Promise<void> {
    // Mock implementation - would update actual algorithms
    console.log('💰 Implementing budget compliance improvements')
    // Update price data sources, improve calculation accuracy, etc.
  }

  private async improveSynergyAccuracy(): Promise<void> {
    // Mock implementation - would update synergy detection
    console.log('🔗 Implementing synergy accuracy improvements')
    // Enhance card interaction database, improve detection algorithms, etc.
  }

  private async improveDeckQuality(): Promise<void> {
    // Mock implementation - would update quality validation
    console.log('⭐ Implementing deck quality improvements')
    // Add more validation steps, improve card selection, etc.
  }

  private async improvePowerLevelEstimation(): Promise<void> {
    // Mock implementation - would update power level algorithms
    console.log('⚡ Implementing power level estimation improvements')
    // Refine power level factors, improve assessment accuracy, etc.
  }

  private getFeedbackForPeriod(startDate: Date, endDate: Date): FeedbackData[] {
    const allFeedback = Array.from(this.feedbackDatabase.values()).flat()
    return allFeedback.filter(f => 
      f.timestamp >= startDate && f.timestamp <= endDate
    )
  }

  private calculatePerformanceMetrics(feedback: FeedbackData[]): any {
    if (feedback.length === 0) {
      return {
        averageQualityScore: 0,
        userSatisfactionScore: 0,
        generationSuccessRate: 0,
        averageGenerationTime: 0,
        budgetAccuracy: 0,
        powerLevelAccuracy: 0,
        synergyAccuracy: 0,
      }
    }

    const categoryBreakdown = this.calculateCategoryBreakdown(feedback)
    
    return {
      averageQualityScore: categoryBreakdown.deckQuality,
      userSatisfactionScore: feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length,
      generationSuccessRate: 0.95, // Mock - would calculate from actual data
      averageGenerationTime: 45000, // Mock - 45 seconds
      budgetAccuracy: categoryBreakdown.budgetCompliance,
      powerLevelAccuracy: categoryBreakdown.powerLevelMatch,
      synergyAccuracy: categoryBreakdown.synergyAccuracy,
    }
  }

  private getPreviousPeriodMetrics(startDate: Date, endDate: Date): any {
    // Mock previous period metrics - would calculate from historical data
    return {
      averageQualityScore: 3.2,
      userSatisfactionScore: 3.5,
      generationSuccessRate: 0.92,
      averageGenerationTime: 50000,
      budgetAccuracy: 3.0,
      powerLevelAccuracy: 3.1,
      synergyAccuracy: 3.3,
    }
  }

  private identifyImprovements(current: any, previous: any): string[] {
    const improvements: string[] = []

    if (current.averageQualityScore > previous.averageQualityScore) {
      improvements.push('Deck quality scores improved')
    }
    if (current.userSatisfactionScore > previous.userSatisfactionScore) {
      improvements.push('User satisfaction increased')
    }
    if (current.generationSuccessRate > previous.generationSuccessRate) {
      improvements.push('Generation success rate improved')
    }
    if (current.averageGenerationTime < previous.averageGenerationTime) {
      improvements.push('Generation speed improved')
    }

    return improvements
  }

  private identifyRegressions(current: any, previous: any): string[] {
    const regressions: string[] = []

    if (current.averageQualityScore < previous.averageQualityScore) {
      regressions.push('Deck quality scores declined')
    }
    if (current.userSatisfactionScore < previous.userSatisfactionScore) {
      regressions.push('User satisfaction decreased')
    }
    if (current.generationSuccessRate < previous.generationSuccessRate) {
      regressions.push('Generation success rate declined')
    }
    if (current.averageGenerationTime > previous.averageGenerationTime) {
      regressions.push('Generation speed decreased')
    }

    return regressions
  }

  private async generatePerformanceRecommendations(
    metrics: any,
    improvements: string[],
    regressions: string[]
  ): Promise<string[]> {
    const recommendations: string[] = []

    if (regressions.length > improvements.length) {
      recommendations.push('Focus on addressing performance regressions')
    }

    if (metrics.userSatisfactionScore < 3.5) {
      recommendations.push('Prioritize user satisfaction improvements')
    }

    if (metrics.budgetAccuracy < 3.0) {
      recommendations.push('Improve budget compliance accuracy')
    }

    if (metrics.synergyAccuracy < 3.0) {
      recommendations.push('Enhance synergy detection capabilities')
    }

    return recommendations
  }

  private calculateTrend(dataPoints: Array<{ timestamp: Date; value: number }>): 'improving' | 'declining' | 'stable' {
    if (dataPoints.length < 2) return 'stable'

    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2))
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2))

    const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length

    const change = secondAvg - firstAvg
    const threshold = 0.05 // 5% change threshold

    if (Math.abs(change) < threshold) return 'stable'
    return change > 0 ? 'improving' : 'declining'
  }

  private getEmptyFeedbackAnalysis(): FeedbackAnalysis {
    return {
      totalFeedbackCount: 0,
      averageRating: 0,
      ratingDistribution: {},
      categoryBreakdown: {
        deckQuality: 0,
        synergyAccuracy: 0,
        budgetCompliance: 0,
        powerLevelMatch: 0,
        playability: 0,
      },
      commonIssues: [],
      positivePatterns: [],
      trendAnalysis: {
        overallTrend: 'stable',
        periodComparison: { current: 0, previous: 0, change: 0 },
      },
    }
  }

  private initializeMetrics(): void {
    const metrics = [
      'user_satisfaction',
      'deck_quality',
      'synergy_accuracy',
      'budget_compliance',
      'power_level_accuracy',
      'generation_speed',
      'success_rate'
    ]

    for (const metricName of metrics) {
      this.improvementMetrics.set(metricName, {
        metricName,
        currentValue: 3.0, // Default starting value
        targetValue: 4.0, // Target improvement
        trend: 'stable',
        changeRate: 0,
        lastUpdated: new Date(),
        dataPoints: [],
      })
    }

    console.log('✅ Initialized improvement metrics')
  }

  private startFeedbackProcessing(): void {
    // Process feedback queue every 5 minutes
    setInterval(async () => {
      if (this.feedbackProcessingQueue.length > 0) {
        console.log(`🔄 Processing ${this.feedbackProcessingQueue.length} queued feedback entries`)
        
        const batch = this.feedbackProcessingQueue.splice(0, 10) // Process 10 at a time
        
        for (const feedback of batch) {
          try {
            await this.processBatchFeedback(feedback)
          } catch (error) {
            console.error('Failed to process batch feedback:', error)
          }
        }
      }
    }, 5 * 60 * 1000) // 5 minutes

    console.log('✅ Started feedback processing')
  }

  private scheduleLearningCycles(): void {
    // Generate insights daily
    const insightGeneration = setInterval(async () => {
      try {
        console.log('🧠 Running daily insight generation')
        await this.generateLearningInsights()
      } catch (error) {
        console.error('Daily insight generation failed:', error)
      }
    }, 24 * 60 * 60 * 1000) // 24 hours

    // Evaluate performance weekly
    const performanceEvaluation = setInterval(async () => {
      try {
        console.log('📈 Running weekly performance evaluation')
        const endDate = new Date()
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
        await this.evaluateModelPerformance('current', startDate, endDate)
      } catch (error) {
        console.error('Weekly performance evaluation failed:', error)
      }
    }, 7 * 24 * 60 * 60 * 1000) // 7 days

    this.learningSchedule.set('insights', insightGeneration)
    this.learningSchedule.set('performance', performanceEvaluation)

    console.log('✅ Scheduled learning cycles')
  }

  private async processBatchFeedback(feedback: FeedbackData): Promise<void> {
    // Update relevant metrics
    this.updateImprovementMetric('user_satisfaction', feedback.rating)
    this.updateImprovementMetric('deck_quality', feedback.categories.deckQuality)
    this.updateImprovementMetric('synergy_accuracy', feedback.categories.synergyAccuracy)
    this.updateImprovementMetric('budget_compliance', feedback.categories.budgetCompliance)
    this.updateImprovementMetric('power_level_accuracy', feedback.categories.powerLevelMatch)
  }

  /**
   * Get learning insights
   */
  getLearningInsights(): LearningInsight[] {
    return Array.from(this.learningInsights.values())
  }

  /**
   * Get model performance history
   */
  getModelPerformanceHistory(): ModelPerformance[] {
    return [...this.modelPerformanceHistory]
  }

  /**
   * Clear feedback data (for testing)
   */
  clearFeedbackData(): void {
    this.feedbackDatabase.clear()
    this.feedbackProcessingQueue.length = 0
    console.log('🗑️ Feedback data cleared')
  }
}

// Export singleton instance
export const feedbackLoopService = new FeedbackLoopService()
import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'
import { 
  aiQualityAssuranceService,
  automatedTestingService,
  budgetComplianceService,
  powerLevelAssessmentService,
  feedbackLoopService,
  QualityMetricsSchema,
  FeedbackDataSchema,
  BudgetAdjustmentRequestSchema,
  PowerLevelAssessmentSchema
} from '../services/ai/quality-assurance'
import { GeneratedDeckSchema, ConsultationDataSchema } from '@moxmuse/shared'

export const aiQualityAssuranceRouter = createTRPCRouter({
  // Quality Assessment Endpoints
  assessDeckQuality: publicProcedure
    .input(z.object({
      deck: GeneratedDeckSchema,
      consultationData: ConsultationDataSchema,
    }))
    .output(QualityMetricsSchema)
    .mutation(async ({ input }) => {
      return await aiQualityAssuranceService.assessDeckQuality(
        input.deck,
        input.consultationData
      )
    }),

  runQualityTests: publicProcedure
    .input(z.object({
      deck: GeneratedDeckSchema,
    }))
    .output(z.array(z.object({
      testName: z.string(),
      passed: z.boolean(),
      score: z.number(),
      details: z.string(),
      metrics: z.record(z.number()),
      timestamp: z.date(),
    })))
    .mutation(async ({ input }) => {
      return await aiQualityAssuranceService.runQualityTests(input.deck)
    }),

  processFeedback: publicProcedure
    .input(FeedbackDataSchema)
    .mutation(async ({ input }) => {
      await aiQualityAssuranceService.processFeedback(input)
      return { success: true }
    }),

  generateImprovementRecommendations: publicProcedure
    .input(z.object({
      deckId: z.string(),
    }))
    .output(z.array(z.object({
      type: z.string(),
      priority: z.string(),
      description: z.string(),
      actions: z.array(z.string()),
    })))
    .query(async ({ input }) => {
      return await aiQualityAssuranceService.generateImprovementRecommendations(input.deckId)
    }),

  // Automated Testing Endpoints
  executeTestSuite: publicProcedure
    .input(z.object({
      suiteId: z.string(),
    }))
    .output(z.object({
      suiteId: z.string(),
      suiteName: z.string(),
      executionId: z.string(),
      startTime: z.date(),
      endTime: z.date(),
      duration: z.number(),
      totalTests: z.number(),
      passedTests: z.number(),
      failedTests: z.number(),
      skippedTests: z.number(),
      passRate: z.number(),
      overallScore: z.number(),
      results: z.array(z.object({
        testId: z.string(),
        testName: z.string(),
        status: z.enum(['passed', 'failed', 'skipped', 'error']),
        score: z.number(),
        duration: z.number(),
        details: z.string(),
        metrics: z.record(z.number()),
        errors: z.array(z.string()),
        warnings: z.array(z.string()),
        timestamp: z.date(),
        retryCount: z.number(),
      })),
      summary: z.object({
        qualityMetrics: z.record(z.number()),
        performanceMetrics: z.record(z.number()),
        regressions: z.array(z.string()),
        improvements: z.array(z.string()),
      }),
    }))
    .mutation(async ({ input }) => {
      return await automatedTestingService.executeTestSuite(input.suiteId)
    }),

  getTestSuite: publicProcedure
    .input(z.object({
      suiteId: z.string(),
    }))
    .output(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      tests: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(['unit', 'integration', 'performance', 'quality']),
        enabled: z.boolean(),
        timeout: z.number(),
        retries: z.number(),
        parameters: z.record(z.any()),
      })),
      schedule: z.object({
        enabled: z.boolean(),
        frequency: z.enum(['hourly', 'daily', 'weekly']),
        time: z.string().optional(),
      }),
      thresholds: z.object({
        minPassRate: z.number(),
        maxFailureRate: z.number(),
        qualityThreshold: z.number(),
      }),
    }).nullable())
    .query(async ({ input }) => {
      return automatedTestingService.getTestSuite(input.suiteId) || null
    }),

  getTestHistory: publicProcedure
    .input(z.object({
      suiteId: z.string(),
      limit: z.number().optional(),
    }))
    .output(z.array(z.object({
      suiteId: z.string(),
      suiteName: z.string(),
      executionId: z.string(),
      startTime: z.date(),
      endTime: z.date(),
      duration: z.number(),
      totalTests: z.number(),
      passedTests: z.number(),
      failedTests: z.number(),
      skippedTests: z.number(),
      passRate: z.number(),
      overallScore: z.number(),
    })))
    .query(async ({ input }) => {
      const history = automatedTestingService.getTestHistory(input.suiteId, input.limit)
      return history.map(result => ({
        suiteId: result.suiteId,
        suiteName: result.suiteName,
        executionId: result.executionId,
        startTime: result.startTime,
        endTime: result.endTime,
        duration: result.duration,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
        skippedTests: result.skippedTests,
        passRate: result.passRate,
        overallScore: result.overallScore,
      }))
    }),

  // Budget Compliance Endpoints
  analyzeBudgetCompliance: publicProcedure
    .input(z.object({
      deck: GeneratedDeckSchema,
      targetBudget: z.number(),
    }))
    .output(z.object({
      targetBudget: z.number(),
      actualBudget: z.number(),
      variance: z.number(),
      compliancePercentage: z.number(),
      budgetDistribution: z.record(z.number()),
      expensiveCards: z.array(z.object({
        cardId: z.string(),
        name: z.string(),
        price: z.number(),
        category: z.string(),
        percentageOfBudget: z.number(),
      })),
      budgetAlternatives: z.array(z.object({
        originalCard: z.string(),
        alternativeCard: z.string(),
        priceDifference: z.number(),
        functionalSimilarity: z.number(),
        reasoning: z.string(),
      })),
      optimizationSuggestions: z.array(z.object({
        type: z.enum(['downgrade', 'upgrade', 'redistribute', 'substitute']),
        description: z.string(),
        estimatedSavings: z.number(),
        impactOnPower: z.number(),
        priority: z.enum(['low', 'medium', 'high']),
      })),
    }))
    .mutation(async ({ input }) => {
      return await budgetComplianceService.analyzeBudgetCompliance(
        input.deck,
        input.targetBudget
      )
    }),

  adjustDeckToBudget: publicProcedure
    .input(BudgetAdjustmentRequestSchema)
    .output(z.object({
      originalBudget: z.number(),
      adjustedBudget: z.number(),
      budgetReduction: z.number(),
      powerLevelChange: z.number(),
      adjustedCards: z.array(z.object({
        action: z.enum(['replace', 'remove', 'downgrade']),
        originalCard: z.string(),
        newCard: z.string().optional(),
        priceDifference: z.number(),
        reasoning: z.string(),
      })),
      qualityImpact: z.object({
        synergyChange: z.number(),
        consistencyChange: z.number(),
        overallQualityChange: z.number(),
      }),
      success: z.boolean(),
      warnings: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      return await budgetComplianceService.adjustDeckToBudget(input)
    }),

  verifyBudgetCompliance: publicProcedure
    .input(z.object({
      deck: GeneratedDeckSchema,
      consultationData: ConsultationDataSchema,
    }))
    .output(z.object({
      isCompliant: z.boolean(),
      analysis: z.any(), // BudgetAnalysis schema
      recommendations: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      return await budgetComplianceService.verifyBudgetCompliance(
        input.deck,
        input.consultationData
      )
    }),

  // Power Level Assessment Endpoints
  assessPowerLevel: publicProcedure
    .input(z.object({
      deck: GeneratedDeckSchema,
      consultationData: ConsultationDataSchema,
    }))
    .output(PowerLevelAssessmentSchema)
    .mutation(async ({ input }) => {
      return await powerLevelAssessmentService.assessPowerLevel(
        input.deck,
        input.consultationData
      )
    }),

  validatePowerLevel: publicProcedure
    .input(z.object({
      assessment: PowerLevelAssessmentSchema,
      targetPowerLevel: z.number(),
    }))
    .output(z.object({
      isAccurate: z.boolean(),
      deviation: z.number(),
      acceptableRange: z.object({
        min: z.number(),
        max: z.number(),
      }),
      validationTests: z.array(z.object({
        testName: z.string(),
        passed: z.boolean(),
        score: z.number(),
        details: z.string(),
      })),
      adjustmentNeeded: z.boolean(),
      adjustmentSuggestions: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      return await powerLevelAssessmentService.validatePowerLevel(
        input.assessment,
        input.targetPowerLevel
      )
    }),

  getAssessmentHistory: publicProcedure
    .input(z.object({
      deckId: z.string(),
    }))
    .output(z.array(PowerLevelAssessmentSchema))
    .query(async ({ input }) => {
      return powerLevelAssessmentService.getAssessmentHistory(input.deckId)
    }),

  getCardPowerRating: publicProcedure
    .input(z.object({
      cardId: z.string(),
    }))
    .output(z.object({
      cardId: z.string(),
      powerRating: z.number(),
    }))
    .query(async ({ input }) => {
      const rating = powerLevelAssessmentService.getCardPowerRating(input.cardId)
      return {
        cardId: input.cardId,
        powerRating: rating,
      }
    }),

  // Feedback Loop Endpoints
  analyzeFeedbackPatterns: publicProcedure
    .output(z.object({
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
    }))
    .query(async () => {
      return await feedbackLoopService.analyzeFeedbackPatterns()
    }),

  generateLearningInsights: publicProcedure
    .output(z.array(z.object({
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
      confidence: z.number(),
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
    })))
    .mutation(async () => {
      return await feedbackLoopService.generateLearningInsights()
    }),

  implementImprovements: publicProcedure
    .input(z.object({
      insightIds: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      await feedbackLoopService.implementImprovements(input.insightIds)
      return { success: true }
    }),

  evaluateModelPerformance: publicProcedure
    .input(z.object({
      modelVersion: z.string(),
      startDate: z.date(),
      endDate: z.date(),
    }))
    .output(z.object({
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
    }))
    .mutation(async ({ input }) => {
      return await feedbackLoopService.evaluateModelPerformance(
        input.modelVersion,
        input.startDate,
        input.endDate
      )
    }),

  getImprovementMetrics: publicProcedure
    .output(z.array(z.object({
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
    })))
    .query(async () => {
      const metrics = feedbackLoopService.getImprovementMetrics()
      return Array.from(metrics.values())
    }),

  getLearningInsights: publicProcedure
    .output(z.array(z.object({
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
      confidence: z.number(),
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
    })))
    .query(async () => {
      return feedbackLoopService.getLearningInsights()
    }),

  getModelPerformanceHistory: publicProcedure
    .output(z.array(z.object({
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
    })))
    .query(async () => {
      return feedbackLoopService.getModelPerformanceHistory()
    }),

  // Utility Endpoints
  getQualityAssuranceStatus: publicProcedure
    .output(z.object({
      systemStatus: z.enum(['healthy', 'degraded', 'unhealthy']),
      lastQualityCheck: z.date(),
      activeTests: z.number(),
      pendingFeedback: z.number(),
      improvementMetrics: z.object({
        overallTrend: z.enum(['improving', 'declining', 'stable']),
        averageQualityScore: z.number(),
        userSatisfactionScore: z.number(),
      }),
      recommendations: z.array(z.string()),
    }))
    .query(async () => {
      // Mock implementation - would gather real system status
      const metrics = feedbackLoopService.getImprovementMetrics()
      const qualityMetric = metrics.get('deck_quality')
      const satisfactionMetric = metrics.get('user_satisfaction')

      return {
        systemStatus: 'healthy' as const,
        lastQualityCheck: new Date(),
        activeTests: 7,
        pendingFeedback: 0,
        improvementMetrics: {
          overallTrend: qualityMetric?.trend || 'stable',
          averageQualityScore: qualityMetric?.currentValue || 3.0,
          userSatisfactionScore: satisfactionMetric?.currentValue || 3.5,
        },
        recommendations: [
          'Continue monitoring quality metrics',
          'Process user feedback regularly',
          'Run automated tests daily',
        ],
      }
    }),
})
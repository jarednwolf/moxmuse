import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  aiQualityAssuranceService,
  automatedTestingService,
  budgetComplianceService,
  powerLevelAssessmentService,
  feedbackLoopService
} from '../index'
import { GeneratedDeck, ConsultationData } from '@moxmuse/shared'

// Mock external dependencies
vi.mock('../../index', () => ({
  aiServiceOrchestrator: {
    executeAITask: vi.fn().mockResolvedValue({
      result: 'Mock AI response',
      confidence: 0.8,
    }),
  },
}))

vi.mock('../../deck-validator', () => ({
  aiValidationEngine: {
    validateDeck: vi.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      confidence: 0.9,
      metaViability: {
        score: 7.5,
        reasoning: 'Good meta positioning',
        threats: [],
        advantages: [],
      },
    }),
  },
}))

describe('AI Quality Assurance Integration Tests', () => {
  let mockDeck: GeneratedDeck
  let mockConsultation: ConsultationData

  beforeEach(() => {
    mockDeck = {
      id: 'integration-test-deck',
      name: 'Integration Test Deck',
      commander: 'Atraxa, Praetors\' Voice',
      format: 'commander',
      strategy: {
        name: 'Value Engine',
        description: 'Generate card advantage and control the board',
        archetype: 'value',
        themes: ['counters', 'proliferate'],
        gameplan: 'Build incremental advantage',
        strengths: ['Card advantage', 'Versatility'],
        weaknesses: ['Slow start'],
      },
      winConditions: [
        {
          type: 'combat',
          description: 'Beat down with large creatures',
          keyCards: ['Atraxa, Praetors\' Voice'],
          probability: 0.6,
        },
        {
          type: 'alternative',
          description: 'Planeswalker ultimates',
          keyCards: ['Jace, the Mind Sculptor'],
          probability: 0.4,
        },
      ],
      powerLevel: 3,
      estimatedBudget: 500,
      cards: [
        // Lands (36)
        ...Array.from({ length: 36 }, (_, i) => ({
          cardId: `land-${i}`,
          quantity: 1,
          category: 'lands',
          role: 'mana production',
          reasoning: 'Provides mana for spells',
        })),
        // Ramp (10)
        ...Array.from({ length: 10 }, (_, i) => ({
          cardId: `ramp-${i}`,
          quantity: 1,
          category: 'ramp',
          role: 'mana acceleration',
          reasoning: 'Accelerates mana development',
        })),
        // Draw (12)
        ...Array.from({ length: 12 }, (_, i) => ({
          cardId: `draw-${i}`,
          quantity: 1,
          category: 'draw',
          role: 'card advantage',
          reasoning: 'Provides card advantage',
        })),
        // Removal (10)
        ...Array.from({ length: 10 }, (_, i) => ({
          cardId: `removal-${i}`,
          quantity: 1,
          category: 'removal',
          role: 'interaction',
          reasoning: 'Removes threats',
        })),
        // Win conditions (6)
        ...Array.from({ length: 6 }, (_, i) => ({
          cardId: `wincon-${i}`,
          quantity: 1,
          category: 'win_conditions',
          role: 'finisher',
          reasoning: 'Closes out games',
        })),
        // Synergy (26)
        ...Array.from({ length: 26 }, (_, i) => ({
          cardId: `synergy-${i}`,
          quantity: 1,
          category: 'synergy',
          role: 'engine piece',
          reasoning: 'Supports strategy',
        })),
      ],
      categories: [],
      statistics: {
        manaCurve: {
          distribution: [2, 8, 15, 20, 18, 12, 8, 5],
          peakCMC: 4,
          averageCMC: 3.4,
          landRatio: 0.36,
        },
        colorDistribution: {
          white: 0.25,
          blue: 0.25,
          black: 0.25,
          red: 0,
          green: 0.25,
          colorless: 0,
          multicolor: 0,
          devotion: { W: 25, U: 25, B: 25, G: 25 },
        },
        typeDistribution: {
          creature: 25,
          instant: 15,
          sorcery: 12,
          artifact: 8,
          enchantment: 4,
          planeswalker: 0,
          land: 36,
          other: 0,
        },
        rarityDistribution: {
          common: 30,
          uncommon: 40,
          rare: 25,
          mythic: 5,
        },
        averageCMC: 3.4,
        totalValue: 500,
        landCount: 36,
        nonlandCount: 64,
      },
      synergies: [
        {
          cardId: 'atraxa-praetors-voice',
          relatedCardIds: ['doubling-season', 'deepglow-skate'],
          synergyType: 'engine',
          strength: 9,
          description: 'Proliferate synergies with counter manipulation',
        },
      ],
      weaknesses: ['Vulnerable to board wipes', 'Slow early game'],
      generatedAt: new Date(),
      consultationData: {
        buildingFullDeck: true,
        needsCommanderSuggestions: false,
        commander: 'Atraxa, Praetors\' Voice',
        strategy: 'value',
        budget: 500,
        powerLevel: 3,
        useCollection: false,
        themes: ['counters', 'proliferate'],
        winConditions: {
          primary: 'combat',
          secondary: ['alternative'],
        },
      },
    }

    mockConsultation = {
      buildingFullDeck: true,
      needsCommanderSuggestions: false,
      commander: 'Atraxa, Praetors\' Voice',
      strategy: 'value',
      budget: 500,
      powerLevel: 3,
      useCollection: false,
      themes: ['counters', 'proliferate'],
      winConditions: {
        primary: 'combat',
        secondary: ['alternative'],
      },
    }
  })

  describe('End-to-End Quality Assessment Workflow', () => {
    it('should complete full quality assessment workflow', async () => {
      // Step 1: Assess overall deck quality
      const qualityMetrics = await aiQualityAssuranceService.assessDeckQuality(
        mockDeck,
        mockConsultation
      )

      expect(qualityMetrics).toBeDefined()
      expect(qualityMetrics.overallScore).toBeGreaterThan(0.5) // Should be decent quality
      expect(qualityMetrics.cardRatios).toBeDefined()
      expect(qualityMetrics.budgetAnalysis).toBeDefined()
      expect(qualityMetrics.powerLevelAnalysis).toBeDefined()

      // Step 2: Run automated quality tests
      const testResults = await aiQualityAssuranceService.runQualityTests(mockDeck)

      expect(testResults.length).toBeGreaterThan(0)
      const passedTests = testResults.filter(t => t.passed).length
      expect(passedTests).toBeGreaterThan(testResults.length * 0.7) // At least 70% should pass

      // Step 3: Analyze budget compliance
      const budgetAnalysis = await budgetComplianceService.analyzeBudgetCompliance(
        mockDeck,
        500
      )

      expect(budgetAnalysis.targetBudget).toBe(500)
      expect(budgetAnalysis.actualBudget).toBeGreaterThan(0)
      expect(budgetAnalysis.compliancePercentage).toBeGreaterThanOrEqual(0)

      // Step 4: Assess power level
      const powerLevelAssessment = await powerLevelAssessmentService.assessPowerLevel(
        mockDeck,
        mockConsultation
      )

      expect(powerLevelAssessment.estimatedPowerLevel).toBeGreaterThan(1)
      expect(powerLevelAssessment.estimatedPowerLevel).toBeLessThan(4)
      expect(powerLevelAssessment.confidence).toBeGreaterThan(0.5)

      // Step 5: Validate power level accuracy
      const powerLevelValidation = await powerLevelAssessmentService.validatePowerLevel(
        powerLevelAssessment,
        3
      )

      expect(powerLevelValidation.deviation).toBeLessThan(1) // Should be reasonably close
      expect(powerLevelValidation.acceptableRange.min).toBeLessThanOrEqual(3)
      expect(powerLevelValidation.acceptableRange.max).toBeGreaterThanOrEqual(3)

      console.log('✅ End-to-end quality assessment workflow completed successfully')
    })

    it('should handle budget adjustment workflow', async () => {
      // Create an over-budget deck
      const overBudgetDeck = {
        ...mockDeck,
        estimatedBudget: 800, // Over the target budget
      }

      // Step 1: Analyze budget compliance
      const budgetAnalysis = await budgetComplianceService.analyzeBudgetCompliance(
        overBudgetDeck,
        500
      )

      expect(budgetAnalysis.variance).toBeGreaterThan(0.1) // Should be over budget

      // Step 2: Adjust deck to budget
      const adjustmentResult = await budgetComplianceService.adjustDeckToBudget({
        deck: overBudgetDeck,
        targetBudget: 500,
        adjustmentStrategy: 'balanced',
        allowPowerLevelChange: true,
        maxPowerLevelReduction: 0.5,
      })

      expect(adjustmentResult.originalBudget).toBeGreaterThan(500)
      expect(adjustmentResult.adjustedBudget).toBeLessThanOrEqual(525) // Within 5% tolerance
      expect(adjustmentResult.success).toBe(true)
      expect(adjustmentResult.adjustedCards.length).toBeGreaterThan(0)

      console.log('✅ Budget adjustment workflow completed successfully')
    })

    it('should process feedback and generate insights', async () => {
      // Step 1: Process user feedback
      const feedback = {
        deckId: mockDeck.id,
        userId: 'test-user-1',
        rating: 4,
        feedback: 'Great deck, but could use more interaction',
        categories: {
          deckQuality: 4,
          synergyAccuracy: 4,
          budgetCompliance: 5,
          powerLevelMatch: 3,
          playability: 4,
        },
        improvements: ['Add more removal spells'],
        wouldRecommend: true,
        timestamp: new Date(),
      }

      await feedbackLoopService.processFeedback(feedback)

      // Step 2: Add more feedback for pattern analysis
      const feedback2 = {
        deckId: 'another-deck',
        userId: 'test-user-2',
        rating: 2,
        feedback: 'Deck was too expensive for the budget',
        categories: {
          deckQuality: 3,
          synergyAccuracy: 3,
          budgetCompliance: 1,
          powerLevelMatch: 3,
          playability: 2,
        },
        improvements: ['Better budget compliance'],
        wouldRecommend: false,
        timestamp: new Date(),
      }

      await feedbackLoopService.processFeedback(feedback2)

      // Step 3: Analyze feedback patterns
      const feedbackAnalysis = await feedbackLoopService.analyzeFeedbackPatterns()

      expect(feedbackAnalysis.totalFeedbackCount).toBe(2)
      expect(feedbackAnalysis.averageRating).toBe(3) // (4 + 2) / 2
      expect(feedbackAnalysis.categoryBreakdown).toBeDefined()

      // Step 4: Generate learning insights
      const insights = await feedbackLoopService.generateLearningInsights()

      expect(Array.isArray(insights)).toBe(true)
      // Should have insights about budget compliance issues
      const budgetInsights = insights.filter(i => i.category === 'budget_compliance')
      expect(budgetInsights.length).toBeGreaterThan(0)

      console.log('✅ Feedback processing and insight generation completed successfully')
    })

    it('should run comprehensive automated test suite', async () => {
      const testSuiteResult = await automatedTestingService.executeTestSuite('quality_assurance')

      expect(testSuiteResult.suiteId).toBe('quality_assurance')
      expect(testSuiteResult.totalTests).toBeGreaterThan(5)
      expect(testSuiteResult.passRate).toBeGreaterThan(0.6) // At least 60% pass rate
      expect(testSuiteResult.overallScore).toBeGreaterThan(0.5)

      // Check that different test types were executed
      const unitTests = testSuiteResult.results.filter(r => r.testId.includes('validation') || r.testId.includes('analysis'))
      const integrationTests = testSuiteResult.results.filter(r => r.testId.includes('generation') || r.testId.includes('pipeline'))
      const performanceTests = testSuiteResult.results.filter(r => r.testId.includes('speed') || r.testId.includes('concurrent'))
      const qualityTests = testSuiteResult.results.filter(r => r.testId.includes('accuracy') || r.testId.includes('coherence'))

      expect(unitTests.length).toBeGreaterThan(0)
      expect(integrationTests.length).toBeGreaterThan(0)
      expect(performanceTests.length).toBeGreaterThan(0)
      expect(qualityTests.length).toBeGreaterThan(0)

      console.log('✅ Comprehensive automated test suite completed successfully')
    })
  })

  describe('Quality Assurance System Integration', () => {
    it('should integrate all services for comprehensive quality validation', async () => {
      // This test demonstrates how all services work together
      
      // 1. Initial quality assessment
      const initialQuality = await aiQualityAssuranceService.assessDeckQuality(
        mockDeck,
        mockConsultation
      )

      // 2. If budget is an issue, adjust it
      if (initialQuality.budgetComplianceScore < 0.8) {
        const budgetAdjustment = await budgetComplianceService.adjustDeckToBudget({
          deck: mockDeck,
          targetBudget: mockConsultation.budget || 500,
          adjustmentStrategy: 'balanced',
          allowPowerLevelChange: true,
        })

        expect(budgetAdjustment.success).toBe(true)
      }

      // 3. Validate power level
      const powerAssessment = await powerLevelAssessmentService.assessPowerLevel(
        mockDeck,
        mockConsultation
      )

      const powerValidation = await powerLevelAssessmentService.validatePowerLevel(
        powerAssessment,
        mockConsultation.powerLevel || 3
      )

      // 4. Run automated tests to verify quality
      const automatedTests = await automatedTestingService.executeTestSuite('quality_assurance')

      // 5. Generate improvement recommendations
      const improvements = await aiQualityAssuranceService.generateImprovementRecommendations(
        mockDeck.id
      )

      // Verify the integrated workflow
      expect(initialQuality.overallScore).toBeGreaterThan(0)
      expect(powerAssessment.estimatedPowerLevel).toBeGreaterThan(0)
      expect(automatedTests.passRate).toBeGreaterThan(0.5)
      expect(Array.isArray(improvements)).toBe(true)

      console.log('✅ Integrated quality assurance system validation completed')
    })

    it('should handle continuous improvement cycle', async () => {
      // Simulate a continuous improvement cycle
      
      // 1. Process multiple feedback entries
      const feedbackEntries = [
        {
          deckId: 'deck-1',
          userId: 'user-1',
          rating: 5,
          categories: {
            deckQuality: 5,
            synergyAccuracy: 5,
            budgetCompliance: 4,
            powerLevelMatch: 5,
            playability: 5,
          },
          wouldRecommend: true,
          timestamp: new Date(),
        },
        {
          deckId: 'deck-2',
          userId: 'user-2',
          rating: 3,
          categories: {
            deckQuality: 3,
            synergyAccuracy: 2,
            budgetCompliance: 4,
            powerLevelMatch: 3,
            playability: 3,
          },
          wouldRecommend: true,
          timestamp: new Date(),
        },
        {
          deckId: 'deck-3',
          userId: 'user-3',
          rating: 2,
          categories: {
            deckQuality: 2,
            synergyAccuracy: 2,
            budgetCompliance: 3,
            powerLevelMatch: 2,
            playability: 2,
          },
          wouldRecommend: false,
          timestamp: new Date(),
        },
      ]

      for (const feedback of feedbackEntries) {
        await feedbackLoopService.processFeedback(feedback)
      }

      // 2. Analyze patterns and generate insights
      const patterns = await feedbackLoopService.analyzeFeedbackPatterns()
      const insights = await feedbackLoopService.generateLearningInsights()

      expect(patterns.totalFeedbackCount).toBe(3)
      expect(insights.length).toBeGreaterThan(0)

      // 3. Evaluate model performance
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      
      const performance = await feedbackLoopService.evaluateModelPerformance(
        'test-model-v1',
        startDate,
        endDate
      )

      expect(performance.modelVersion).toBe('test-model-v1')
      expect(performance.metrics).toBeDefined()

      // 4. Implement improvements based on insights
      const actionableInsights = insights.filter(i => i.actionable)
      if (actionableInsights.length > 0) {
        const insightIds = actionableInsights.map(i => i.id)
        await feedbackLoopService.implementImprovements(insightIds)
      }

      console.log('✅ Continuous improvement cycle completed successfully')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid deck data gracefully', async () => {
      const invalidDeck = {
        ...mockDeck,
        cards: [], // Empty cards array
        commander: '', // Empty commander
      }

      // Should not throw, but should identify issues
      const qualityMetrics = await aiQualityAssuranceService.assessDeckQuality(
        invalidDeck,
        mockConsultation
      )

      expect(qualityMetrics.issues.length).toBeGreaterThan(0)
      expect(qualityMetrics.overallScore).toBeLessThan(0.5) // Should be low quality
    })

    it('should handle missing consultation data', async () => {
      const minimalConsultation = {
        buildingFullDeck: true,
        needsCommanderSuggestions: false,
      }

      // Should work with minimal consultation data
      const qualityMetrics = await aiQualityAssuranceService.assessDeckQuality(
        mockDeck,
        minimalConsultation
      )

      expect(qualityMetrics).toBeDefined()
      expect(qualityMetrics.overallScore).toBeGreaterThan(0)
    })

    it('should handle extreme budget scenarios', async () => {
      // Test with very low budget
      const lowBudgetAnalysis = await budgetComplianceService.analyzeBudgetCompliance(
        mockDeck,
        50 // Very low budget
      )

      expect(lowBudgetAnalysis.variance).toBeGreaterThan(1) // Way over budget
      expect(lowBudgetAnalysis.optimizationSuggestions.length).toBeGreaterThan(0)

      // Test with very high budget
      const highBudgetAnalysis = await budgetComplianceService.analyzeBudgetCompliance(
        mockDeck,
        5000 // Very high budget
      )

      expect(highBudgetAnalysis.variance).toBeLessThan(0) // Under budget
    })

    it('should handle power level edge cases', async () => {
      // Test with extreme power level targets
      const lowPowerConsultation = { ...mockConsultation, powerLevel: 1 }
      const highPowerConsultation = { ...mockConsultation, powerLevel: 4 }

      const lowPowerAssessment = await powerLevelAssessmentService.assessPowerLevel(
        mockDeck,
        lowPowerConsultation
      )

      const highPowerAssessment = await powerLevelAssessmentService.assessPowerLevel(
        mockDeck,
        highPowerConsultation
      )

      expect(lowPowerAssessment.estimatedPowerLevel).toBeGreaterThan(0)
      expect(highPowerAssessment.estimatedPowerLevel).toBeLessThanOrEqual(4)

      // Both should have recommendations for adjustment
      expect(lowPowerAssessment.recommendations.length).toBeGreaterThan(0)
      expect(highPowerAssessment.recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent quality assessments', async () => {
      const assessmentPromises = Array.from({ length: 5 }, (_, i) => {
        const testDeck = {
          ...mockDeck,
          id: `concurrent-test-deck-${i}`,
          name: `Concurrent Test Deck ${i}`,
        }
        return aiQualityAssuranceService.assessDeckQuality(testDeck, mockConsultation)
      })

      const results = await Promise.all(assessmentPromises)

      expect(results.length).toBe(5)
      results.forEach(result => {
        expect(result.overallScore).toBeGreaterThan(0)
        expect(result.overallScore).toBeLessThanOrEqual(1)
      })

      console.log('✅ Concurrent quality assessments completed successfully')
    })

    it('should maintain performance with large feedback datasets', async () => {
      // Generate a large number of feedback entries
      const feedbackPromises = Array.from({ length: 50 }, (_, i) => {
        const feedback = {
          deckId: `performance-test-deck-${i % 10}`, // 10 different decks
          userId: `performance-test-user-${i}`,
          rating: Math.floor(Math.random() * 5) + 1,
          categories: {
            deckQuality: Math.floor(Math.random() * 5) + 1,
            synergyAccuracy: Math.floor(Math.random() * 5) + 1,
            budgetCompliance: Math.floor(Math.random() * 5) + 1,
            powerLevelMatch: Math.floor(Math.random() * 5) + 1,
            playability: Math.floor(Math.random() * 5) + 1,
          },
          wouldRecommend: Math.random() > 0.5,
          timestamp: new Date(),
        }
        return feedbackLoopService.processFeedback(feedback)
      })

      await Promise.all(feedbackPromises)

      // Analyze patterns with large dataset
      const startTime = Date.now()
      const patterns = await feedbackLoopService.analyzeFeedbackPatterns()
      const analysisTime = Date.now() - startTime

      expect(patterns.totalFeedbackCount).toBe(50)
      expect(analysisTime).toBeLessThan(5000) // Should complete within 5 seconds

      console.log(`✅ Large dataset analysis completed in ${analysisTime}ms`)
    })
  })
})
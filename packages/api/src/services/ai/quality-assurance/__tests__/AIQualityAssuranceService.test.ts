import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AIQualityAssuranceService } from '../AIQualityAssuranceService'
import { GeneratedDeck, ConsultationData } from '@moxmuse/shared'

// Mock dependencies
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

describe('AIQualityAssuranceService', () => {
  let service: AIQualityAssuranceService
  let mockDeck: GeneratedDeck
  let mockConsultation: ConsultationData

  beforeEach(() => {
    service = new AIQualityAssuranceService()
    
    mockDeck = {
      id: 'test-deck-1',
      name: 'Test Deck',
      commander: 'Test Commander',
      format: 'commander',
      strategy: {
        name: 'Test Strategy',
        description: 'Test strategy description',
        archetype: 'midrange',
        themes: ['test'],
        gameplan: 'Test gameplan',
        strengths: ['test strength'],
        weaknesses: ['test weakness'],
      },
      winConditions: [{
        type: 'combat',
        description: 'Test win condition',
        keyCards: ['test card'],
        probability: 0.7,
      }],
      powerLevel: 3,
      estimatedBudget: 200,
      cards: Array.from({ length: 100 }, (_, i) => ({
        cardId: `test-card-${i}`,
        quantity: 1,
        category: i < 36 ? 'lands' : i < 46 ? 'ramp' : 'synergy',
        role: 'test role',
        reasoning: 'test reasoning',
      })),
      categories: [],
      statistics: {
        manaCurve: {
          distribution: [5, 10, 15, 20, 15, 10, 5, 5],
          peakCMC: 3,
          averageCMC: 3.2,
          landRatio: 0.36,
        },
        colorDistribution: {
          white: 0.2,
          blue: 0.2,
          black: 0.2,
          red: 0.2,
          green: 0.2,
          colorless: 0,
          multicolor: 0,
          devotion: {},
        },
        typeDistribution: {
          creature: 30,
          instant: 10,
          sorcery: 10,
          artifact: 8,
          enchantment: 6,
          planeswalker: 0,
          land: 36,
          other: 0,
        },
        rarityDistribution: {
          common: 40,
          uncommon: 35,
          rare: 20,
          mythic: 5,
        },
        averageCMC: 3.2,
        totalValue: 200,
        landCount: 36,
        nonlandCount: 64,
      },
      synergies: [],
      weaknesses: [],
      generatedAt: new Date(),
      consultationData: {
        buildingFullDeck: true,
        needsCommanderSuggestions: false,
        commander: 'Test Commander',
        strategy: 'midrange',
        budget: 200,
        powerLevel: 3,
        useCollection: false,
      },
    }

    mockConsultation = {
      buildingFullDeck: true,
      needsCommanderSuggestions: false,
      commander: 'Test Commander',
      strategy: 'midrange',
      budget: 200,
      powerLevel: 3,
      useCollection: false,
    }
  })

  describe('assessDeckQuality', () => {
    it('should assess deck quality successfully', async () => {
      const result = await service.assessDeckQuality(mockDeck, mockConsultation)

      expect(result).toBeDefined()
      expect(result.overallScore).toBeGreaterThan(0)
      expect(result.overallScore).toBeLessThanOrEqual(1)
      expect(result.deckValidationScore).toBeGreaterThan(0)
      expect(result.cardRatios).toBeDefined()
      expect(result.budgetAnalysis).toBeDefined()
      expect(result.powerLevelAnalysis).toBeDefined()
      expect(Array.isArray(result.issues)).toBe(true)
      expect(Array.isArray(result.improvements)).toBe(true)
    })

    it('should handle deck with incorrect size', async () => {
      const invalidDeck = {
        ...mockDeck,
        cards: mockDeck.cards.slice(0, 90), // Only 90 cards
      }

      const result = await service.assessDeckQuality(invalidDeck, mockConsultation)

      expect(result.issues.some(issue => issue.category === 'validation')).toBe(true)
      expect(result.overallScore).toBeLessThan(0.8) // Should be penalized
    })

    it('should analyze card ratios correctly', async () => {
      const result = await service.assessDeckQuality(mockDeck, mockConsultation)

      expect(result.cardRatios.lands).toBeDefined()
      expect(result.cardRatios.lands.actual).toBe(36)
      expect(result.cardRatios.ramp).toBeDefined()
      expect(result.cardRatios.ramp.actual).toBe(10)
    })

    it('should validate budget compliance', async () => {
      const result = await service.assessDeckQuality(mockDeck, mockConsultation)

      expect(result.budgetAnalysis).toBeDefined()
      expect(result.budgetAnalysis.targetBudget).toBe(200)
      expect(result.budgetAnalysis.actualBudget).toBeGreaterThan(0)
      expect(result.budgetAnalysis.compliancePercentage).toBeGreaterThanOrEqual(0)
      expect(result.budgetAnalysis.compliancePercentage).toBeLessThanOrEqual(1)
    })

    it('should assess power level accuracy', async () => {
      const result = await service.assessDeckQuality(mockDeck, mockConsultation)

      expect(result.powerLevelAnalysis).toBeDefined()
      expect(result.powerLevelAnalysis.targetPowerLevel).toBe(3)
      expect(result.powerLevelAnalysis.estimatedPowerLevel).toBeGreaterThan(0)
      expect(result.powerLevelAnalysis.confidence).toBeGreaterThan(0)
      expect(Array.isArray(result.powerLevelAnalysis.factors)).toBe(true)
    })

    it('should generate improvement suggestions', async () => {
      const result = await service.assessDeckQuality(mockDeck, mockConsultation)

      expect(Array.isArray(result.improvements)).toBe(true)
      result.improvements.forEach(improvement => {
        expect(improvement.type).toBeDefined()
        expect(improvement.description).toBeDefined()
        expect(improvement.priority).toMatch(/^(low|medium|high)$/)
        expect(improvement.estimatedImpact).toBeGreaterThanOrEqual(0)
        expect(improvement.estimatedImpact).toBeLessThanOrEqual(1)
      })
    })

    it('should handle errors gracefully', async () => {
      const invalidDeck = null as any

      await expect(service.assessDeckQuality(invalidDeck, mockConsultation))
        .rejects.toThrow('Quality assessment failed')
    })
  })

  describe('runQualityTests', () => {
    it('should run all quality tests', async () => {
      const results = await service.runQualityTests(mockDeck)

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)

      results.forEach(result => {
        expect(result.testName).toBeDefined()
        expect(typeof result.passed).toBe('boolean')
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(1)
        expect(result.details).toBeDefined()
        expect(result.timestamp).toBeInstanceOf(Date)
      })
    })

    it('should test deck size validation', async () => {
      const results = await service.runQualityTests(mockDeck)
      const deckSizeTest = results.find(r => r.testName === 'Deck Size Validation')

      expect(deckSizeTest).toBeDefined()
      expect(deckSizeTest!.passed).toBe(true)
      expect(deckSizeTest!.score).toBe(1.0)
    })

    it('should test mana curve analysis', async () => {
      const results = await service.runQualityTests(mockDeck)
      const manaCurveTest = results.find(r => r.testName === 'Mana Curve Analysis')

      expect(manaCurveTest).toBeDefined()
      expect(manaCurveTest!.passed).toBe(true)
      expect(manaCurveTest!.score).toBeGreaterThan(0)
    })

    it('should test win condition adequacy', async () => {
      const results = await service.runQualityTests(mockDeck)
      const winConditionTest = results.find(r => r.testName === 'Win Condition Adequacy')

      expect(winConditionTest).toBeDefined()
      expect(typeof winConditionTest!.passed).toBe('boolean')
    })
  })

  describe('processFeedback', () => {
    it('should process user feedback', async () => {
      const feedback = {
        deckId: 'test-deck-1',
        userId: 'test-user',
        rating: 4,
        feedback: 'Great deck!',
        categories: {
          deckQuality: 4,
          synergyAccuracy: 4,
          budgetCompliance: 4,
          powerLevelMatch: 4,
          playability: 4,
        },
        improvements: ['More interaction'],
        wouldRecommend: true,
        timestamp: new Date(),
      }

      await expect(service.processFeedback(feedback)).resolves.not.toThrow()
    })

    it('should handle negative feedback', async () => {
      const feedback = {
        deckId: 'test-deck-1',
        userId: 'test-user',
        rating: 2,
        feedback: 'Deck was too expensive',
        categories: {
          deckQuality: 2,
          synergyAccuracy: 3,
          budgetCompliance: 1,
          powerLevelMatch: 3,
          playability: 2,
        },
        improvements: ['Better budget compliance'],
        wouldRecommend: false,
        timestamp: new Date(),
      }

      await expect(service.processFeedback(feedback)).resolves.not.toThrow()
    })
  })

  describe('generateImprovementRecommendations', () => {
    it('should generate recommendations based on feedback', async () => {
      // First add some feedback
      const feedback = {
        deckId: 'test-deck-1',
        userId: 'test-user',
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
      }

      await service.processFeedback(feedback)

      const recommendations = await service.generateImprovementRecommendations('test-deck-1')

      expect(Array.isArray(recommendations)).toBe(true)
      // Should have recommendations due to low synergy accuracy
      expect(recommendations.length).toBeGreaterThan(0)
    })

    it('should return empty array for deck with no feedback', async () => {
      const recommendations = await service.generateImprovementRecommendations('nonexistent-deck')

      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations.length).toBe(0)
    })
  })

  describe('Quality Metrics Validation', () => {
    it('should calculate overall score correctly', async () => {
      const result = await service.assessDeckQuality(mockDeck, mockConsultation)

      // Overall score should be weighted average of component scores
      expect(result.overallScore).toBeGreaterThan(0)
      expect(result.overallScore).toBeLessThanOrEqual(1)
      
      // Should be influenced by all component scores
      const componentScores = [
        result.deckValidationScore,
        result.cardRatioScore,
        result.synergyScore,
        result.budgetComplianceScore,
        result.powerLevelAccuracyScore,
      ]
      
      const avgComponentScore = componentScores.reduce((sum, score) => sum + score, 0) / componentScores.length
      
      // Overall score should be reasonably close to average (within weighted range)
      expect(Math.abs(result.overallScore - avgComponentScore)).toBeLessThan(0.3)
    })

    it('should identify critical issues', async () => {
      const invalidDeck = {
        ...mockDeck,
        cards: mockDeck.cards.slice(0, 80), // Invalid deck size
        estimatedBudget: 1000, // Way over budget
      }

      const overBudgetConsultation = {
        ...mockConsultation,
        budget: 100, // Much lower budget
      }

      const result = await service.assessDeckQuality(invalidDeck, overBudgetConsultation)

      const criticalIssues = result.issues.filter(issue => issue.type === 'critical')
      expect(criticalIssues.length).toBeGreaterThan(0)
      
      const majorIssues = result.issues.filter(issue => issue.type === 'major')
      expect(majorIssues.length).toBeGreaterThan(0)
    })

    it('should provide actionable improvements', async () => {
      const result = await service.assessDeckQuality(mockDeck, mockConsultation)

      result.improvements.forEach(improvement => {
        expect(improvement.type).toMatch(/^(card_swap|ratio_adjustment|budget_optimization|synergy_enhancement)$/)
        expect(improvement.description).toBeDefined()
        expect(improvement.priority).toMatch(/^(low|medium|high)$/)
        expect(typeof improvement.estimatedImpact).toBe('number')
        expect(improvement.estimatedImpact).toBeGreaterThanOrEqual(0)
        expect(improvement.estimatedImpact).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle deck with no commander', async () => {
      const deckWithoutCommander = {
        ...mockDeck,
        commander: '',
      }

      const result = await service.assessDeckQuality(deckWithoutCommander, mockConsultation)
      
      expect(result).toBeDefined()
      expect(result.issues.some(issue => issue.category === 'validation')).toBe(true)
    })

    it('should handle consultation without budget', async () => {
      const consultationWithoutBudget = {
        ...mockConsultation,
        budget: undefined,
      }

      const result = await service.assessDeckQuality(mockDeck, consultationWithoutBudget)
      
      expect(result).toBeDefined()
      expect(result.budgetAnalysis).toBeDefined()
    })

    it('should handle deck with extreme mana curve', async () => {
      const extremeDeck = {
        ...mockDeck,
        statistics: {
          ...mockDeck.statistics,
          averageCMC: 8.0, // Very high average CMC
        },
      }

      const result = await service.assessDeckQuality(extremeDeck, mockConsultation)
      
      expect(result).toBeDefined()
      expect(result.issues.some(issue => issue.category === 'ratios')).toBe(true)
    })
  })
})
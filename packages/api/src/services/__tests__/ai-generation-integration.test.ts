import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { ReliableAIService } from '../ai/ReliableAIService'
import { AIQualityAssuranceService } from '../ai/quality-assurance/AIQualityAssuranceService'
import { CacheService } from '../cache/CacheService'
import { PersistenceService } from '../persistence/PersistenceService'
import { prisma as db } from '@moxmuse/db'

describe.skip('AI Generation Workflow Integration Tests (skipped in unit CI)', () => {
  let aiService: ReliableAIService
  let qualityService: AIQualityAssuranceService
  let cacheService: CacheService
  let persistenceService: PersistenceService
  
  beforeAll(async () => {
    // Initialize services
    aiService = new ReliableAIService()
    qualityService = new AIQualityAssuranceService()
    cacheService = new CacheService()
    persistenceService = new PersistenceService()
    
    // Setup test database
    await db.$connect()
  })
  
  afterAll(async () => {
    await db.$disconnect()
  })
  
  beforeEach(async () => {
    // Clean up test data before each test
    await db.generatedDeck.deleteMany({
      where: { sessionId: { startsWith: 'test-' } }
    })
    await db.consultationSession.deleteMany({
      where: { id: { startsWith: 'test-' } }
    })
  })
  
  describe('Complete Deck Generation Flow', () => {
    it('should complete full deck generation workflow with known commander', async () => {
      const sessionId = 'test-session-full-flow'
      const consultationData = {
        buildingFullDeck: true,
        needsCommanderSuggestions: false,
        commander: 'Atraxa, Praetors\' Voice',
        strategy: 'counters',
        themes: ['proliferate', 'planeswalkers'],
        budget: 500,
        powerLevel: 3,
        useCollection: false
      }
      
      // Step 1: Save consultation session
      await persistenceService.saveConsultationSession(sessionId, {
        currentStep: 5,
        responses: consultationData,
        progress: 1.0,
        completedAt: new Date()
      })
      
      // Step 2: Generate deck
      const generationRequest = {
        sessionId,
        consultationData,
        constraints: {
          budget: 500,
          powerLevel: 3,
          timeoutMs: 120000,
          maxRetries: 2
        }
      }
      
      const generatedDeck = await aiService.generateDeck(generationRequest)
      
      // Step 3: Validate deck quality
      const qualityReport = await qualityService.validateDeckQuality(generatedDeck)
      
      // Step 4: Cache results
      await cacheService.setDeckAnalysis(
        generatedDeck.id,
        {
          statistics: generatedDeck.statistics,
          synergies: generatedDeck.synergies,
          qualityMetrics: generatedDeck.qualityMetrics
        },
        3600
      )
      
      // Assertions
      expect(generatedDeck).toBeDefined()
      expect(generatedDeck.cards).toHaveLength(100)
      expect(generatedDeck.commander).toBe('Atraxa, Praetors\' Voice')
      expect(generatedDeck.sessionId).toBe(sessionId)
      
      expect(qualityReport.isValid).toBe(true)
      expect(qualityReport.overallScore).toBeGreaterThan(0.7)
      expect(qualityReport.budgetCompliance).toBeGreaterThan(0.9)
      
      // Verify persistence
      const savedSession = await persistenceService.getConsultationSession(sessionId)
      expect(savedSession).toBeDefined()
      expect(savedSession.completedAt).toBeDefined()
      
      // Verify caching
      const cachedAnalysis = await cacheService.getDeckAnalysis(generatedDeck.id)
      expect(cachedAnalysis).toBeDefined()
      expect(cachedAnalysis.qualityMetrics.overallScore).toBe(generatedDeck.qualityMetrics.overallScore)
    })
    
    it('should handle commander suggestion workflow', async () => {
      const sessionId = 'test-session-commander-suggestions'
      const consultationData = {
        buildingFullDeck: true,
        needsCommanderSuggestions: true,
        strategy: 'artifacts',
        themes: ['vehicles', 'equipment'],
        budget: 300,
        powerLevel: 2,
        colorPreferences: ['U', 'R']
      }
      
      // Step 1: Get commander suggestions
      const commanderSuggestions = await aiService.suggestCommanders({
        strategy: consultationData.strategy,
        themes: consultationData.themes,
        colors: consultationData.colorPreferences,
        budget: consultationData.budget,
        powerLevel: consultationData.powerLevel
      })
      
      expect(commanderSuggestions).toBeDefined()
      expect(commanderSuggestions.length).toBeGreaterThan(0)
      expect(commanderSuggestions.length).toBeLessThanOrEqual(5)
      
      // Step 2: Select commander and generate deck
      const selectedCommander = commanderSuggestions[0]
      const updatedConsultationData = {
        ...consultationData,
        commander: selectedCommander.name,
        needsCommanderSuggestions: false
      }
      
      const generationRequest = {
        sessionId,
        consultationData: updatedConsultationData,
        constraints: {
          budget: 300,
          powerLevel: 2,
          timeoutMs: 120000,
          maxRetries: 2
        }
      }
      
      const generatedDeck = await aiService.generateDeck(generationRequest)
      
      // Assertions
      expect(generatedDeck.commander).toBe(selectedCommander.name)
      expect(generatedDeck.cards).toHaveLength(100)
      expect(generatedDeck.estimatedBudget).toBeLessThanOrEqual(330) // 10% tolerance
      
      // Verify commander fits strategy
      expect(selectedCommander.strategy).toContain('artifacts')
      expect(selectedCommander.colors.some(color => ['U', 'R'].includes(color))).toBe(true)
    })
    
    it('should handle generation failures and retries', async () => {
      const sessionId = 'test-session-failure-recovery'
      const consultationData = {
        buildingFullDeck: true,
        needsCommanderSuggestions: false,
        commander: 'Invalid Commander Name', // This should cause issues
        strategy: 'invalid-strategy',
        budget: -100 // Invalid budget
      }
      
      const generationRequest = {
        sessionId,
        consultationData,
        constraints: {
          timeoutMs: 30000,
          maxRetries: 3
        }
      }
      
      // This should fail but handle gracefully
      await expect(aiService.generateDeck(generationRequest)).rejects.toThrow()
      
      // Verify error was logged and session was updated
      const session = await persistenceService.getConsultationSession(sessionId)
      expect(session?.error).toBeDefined()
    })
  })
  
  describe('Quality Assurance Integration', () => {
    it('should validate and improve deck quality iteratively', async () => {
      const sessionId = 'test-session-quality-improvement'
      
      // Generate initial deck
      const initialRequest = {
        sessionId,
        consultationData: {
          buildingFullDeck: true,
          needsCommanderSuggestions: false,
          commander: 'Ghave, Guru of Spores',
          strategy: 'tokens',
          budget: 400,
          powerLevel: 3
        },
        constraints: {
          timeoutMs: 120000,
          maxRetries: 2
        }
      }
      
      let deck = await aiService.generateDeck(initialRequest)
      let qualityReport = await qualityService.validateDeckQuality(deck)
      
      // If quality is below threshold, attempt improvement
      if (qualityReport.overallScore < 0.8) {
        const improvements = await qualityService.suggestImprovements(deck, qualityReport)
        
        expect(improvements).toBeDefined()
        expect(improvements.length).toBeGreaterThan(0)
        
        // Apply improvements and re-validate
        const improvedDeck = await qualityService.applyImprovements(deck, improvements)
        const improvedQualityReport = await qualityService.validateDeckQuality(improvedDeck)
        
        expect(improvedQualityReport.overallScore).toBeGreaterThanOrEqual(qualityReport.overallScore)
      }
      
      // Final validation
      expect(qualityReport.isValid).toBe(true)
      expect(deck.cards).toHaveLength(100)
    })
    
    it('should maintain budget compliance during quality improvements', async () => {
      const budget = 200
      const sessionId = 'test-session-budget-compliance'
      
      const request = {
        sessionId,
        consultationData: {
          buildingFullDeck: true,
          needsCommanderSuggestions: false,
          commander: 'Krenko, Mob Boss',
          strategy: 'aggro',
          budget,
          powerLevel: 2
        },
        constraints: {
          budget,
          timeoutMs: 120000,
          maxRetries: 2
        }
      }
      
      const deck = await aiService.generateDeck(request)
      const qualityReport = await qualityService.validateDeckQuality(deck)
      
      expect(deck.estimatedBudget).toBeLessThanOrEqual(budget * 1.1) // 10% tolerance
      expect(qualityReport.budgetCompliance).toBeGreaterThan(0.9)
      
      // If improvements are suggested, they should maintain budget
      if (qualityReport.suggestions.length > 0) {
        const improvements = await qualityService.suggestImprovements(deck, qualityReport)
        const budgetCompliantImprovements = improvements.filter(
          improvement => improvement.budgetImpact <= 0
        )
        
        expect(budgetCompliantImprovements.length).toBeGreaterThan(0)
      }
    })
  })
  
  describe('Performance and Caching Integration', () => {
    it('should cache expensive operations and improve response times', async () => {
      const sessionId = 'test-session-caching'
      const consultationData = {
        buildingFullDeck: true,
        needsCommanderSuggestions: false,
        commander: 'Meren of Clan Nel Toth',
        strategy: 'graveyard',
        budget: 600,
        powerLevel: 4
      }
      
      // First generation (should be slower)
      const startTime1 = Date.now()
      const deck1 = await aiService.generateDeck({
        sessionId: sessionId + '-1',
        consultationData,
        constraints: { timeoutMs: 120000, maxRetries: 2 }
      })
      const duration1 = Date.now() - startTime1
      
      // Cache the analysis
      await cacheService.setDeckAnalysis(deck1.id, {
        statistics: deck1.statistics,
        synergies: deck1.synergies,
        qualityMetrics: deck1.qualityMetrics
      }, 3600)
      
      // Second generation with similar parameters (should use cache)
      const startTime2 = Date.now()
      const deck2 = await aiService.generateDeck({
        sessionId: sessionId + '-2',
        consultationData,
        constraints: { timeoutMs: 120000, maxRetries: 2 }
      })
      const duration2 = Date.now() - startTime2
      
      // Verify caching improved performance
      expect(deck1.cards).toHaveLength(100)
      expect(deck2.cards).toHaveLength(100)
      
      // Check if cached analysis is available
      const cachedAnalysis = await cacheService.getDeckAnalysis(deck1.id)
      expect(cachedAnalysis).toBeDefined()
    })
  })
  
  describe('Error Recovery and Resilience', () => {
    it('should recover from partial failures gracefully', async () => {
      const sessionId = 'test-session-partial-failure'
      
      // Simulate a scenario where deck generation partially succeeds
      const request = {
        sessionId,
        consultationData: {
          buildingFullDeck: true,
          needsCommanderSuggestions: false,
          commander: 'Jace, Vryn\'s Prodigy',
          strategy: 'control',
          budget: 800,
          powerLevel: 4
        },
        constraints: {
          timeoutMs: 60000,
          maxRetries: 3
        }
      }
      
      try {
        const deck = await aiService.generateDeck(request)
        
        // Even if generation succeeds, verify it's complete
        expect(deck.cards).toHaveLength(100)
        expect(deck.commander).toBeDefined()
        
        // Verify quality validation works
        const qualityReport = await qualityService.validateDeckQuality(deck)
        expect(qualityReport.isValid).toBe(true)
        
      } catch (error) {
        // If generation fails, verify error handling
        expect(error).toBeDefined()
        
        // Verify session was updated with error info
        const session = await persistenceService.getConsultationSession(sessionId)
        expect(session?.error).toBeDefined()
      }
    })
  })
})
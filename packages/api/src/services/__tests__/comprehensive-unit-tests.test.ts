import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ReliableAIService } from '../ai/ReliableAIService'
import { CacheService } from '../cache/CacheService'
import { PerformanceOptimizationService } from '../performance/PerformanceOptimizationService'
import { AIQualityAssuranceService } from '../ai/quality-assurance/AIQualityAssuranceService'
import { SecurityService } from '../security/SecurityService'
import { APIKeyManager, RateLimiter, defaultSecurityConfig, sanitizeInput } from '../../utils/security'
import { PersistenceService } from '../persistence/PersistenceService'

describe('Critical Business Logic Unit Tests', () => {
  describe('ReliableAIService', () => {
    let aiService: ReliableAIService
    
    beforeEach(() => {
      aiService = new ReliableAIService()
    })
    
    afterEach(() => {
      vi.clearAllMocks()
    })
    
    it('should generate valid deck with proper structure', async () => {
      const mockRequest = {
        sessionId: 'test-session-123',
        consultationData: {
          buildingFullDeck: true,
          needsCommanderSuggestions: false,
          commander: 'Atraxa, Praetors\' Voice',
          strategy: 'counters',
          budget: 500,
          powerLevel: 3
        },
        constraints: {
          timeoutMs: 60000,
          maxRetries: 2
        }
      }
      
      const result = await aiService.generateDeck(mockRequest)
      
      expect(result).toBeDefined()
      expect(result.cards).toHaveLength(100)
      expect(result.commander).toBe('Atraxa, Praetors\' Voice')
      expect(result.estimatedBudget).toBeLessThanOrEqual(550) // 10% tolerance
      expect(result.qualityMetrics.overallScore).toBeGreaterThan(0.6)
    })
    
    it('should handle timeout gracefully', async () => {
      const mockRequest = {
        sessionId: 'test-timeout',
        consultationData: {
          buildingFullDeck: true,
          needsCommanderSuggestions: false,
          commander: 'Test Commander'
        },
        constraints: {
          timeoutMs: 100, // Very short timeout
          maxRetries: 1
        }
      }
      
      await expect(aiService.generateDeck(mockRequest)).rejects.toThrow('timeout')
    })
    
    it('should retry on failure with exponential backoff', async () => {
      const mockRequest = {
        sessionId: 'test-retry',
        consultationData: {
          buildingFullDeck: true,
          needsCommanderSuggestions: false,
          commander: 'Test Commander'
        },
        constraints: {
          maxRetries: 3
        }
      }
      
      // Mock first two calls to fail, third to succeed
      let callCount = 0
      vi.spyOn(aiService as any, 'performGeneration').mockImplementation(() => {
        callCount++
        if (callCount <= 2) {
          throw new Error('Temporary failure')
        }
        return Promise.resolve({
          id: 'test-deck',
          cards: new Array(100).fill(null).map((_, i) => ({ id: `card-${i}`, name: `Card ${i}` })),
          commander: 'Test Commander',
          qualityMetrics: { overallScore: 0.8 }
        })
      })
      
      const result = await aiService.generateDeck(mockRequest)
      expect(result).toBeDefined()
      expect(callCount).toBe(3)
    })
  })
  
  describe('CacheService', () => {
    let cacheService: CacheService
    
    beforeEach(() => {
      cacheService = new CacheService()
    })
    
    it('should store and retrieve cached values', async () => {
      const key = 'test-key'
      const value = { data: 'test-data', timestamp: Date.now() }
      
      await cacheService.set(key, value, 3600)
      const retrieved = await cacheService.get(key)
      
      expect(retrieved).toEqual(value)
    })
    
    it('should handle cache misses gracefully', async () => {
      const result = await cacheService.get('non-existent-key')
      expect(result).toBeNull()
    })
    
    it('should respect TTL expiration', async () => {
      const key = 'expiring-key'
      const value = { data: 'expires-soon' }
      
      await cacheService.set(key, value, 1) // 1 second TTL
      
      // Should be available immediately
      let retrieved = await cacheService.get(key)
      expect(retrieved).toEqual(value)
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      retrieved = await cacheService.get(key)
      expect(retrieved).toBeNull()
    })
  })
  
  describe('AIQualityAssuranceService', () => {
    let qualityService: AIQualityAssuranceService
    
    beforeEach(() => {
      qualityService = new AIQualityAssuranceService()
    })
    
    it('should validate deck structure correctly', async () => {
      const validDeck = {
        id: 'test-deck',
        cards: new Array(100).fill(null).map((_, i) => ({
          id: `card-${i}`,
          name: `Card ${i}`,
          cmc: Math.floor(Math.random() * 8),
          types: ['Creature'],
          colors: ['W']
        })),
        commander: 'Test Commander',
        format: 'commander'
      }
      
      const validation = await qualityService.validateDeckStructure(validDeck)
      
      expect(validation.isValid).toBe(true)
      expect(validation.cardCount).toBe(100)
      expect(validation.issues).toHaveLength(0)
    })
    
    it('should detect invalid deck structures', async () => {
      const invalidDeck = {
        id: 'invalid-deck',
        cards: new Array(99).fill(null).map((_, i) => ({ // Only 99 cards
          id: `card-${i}`,
          name: `Card ${i}`
        })),
        commander: 'Test Commander',
        format: 'commander'
      }
      
      const validation = await qualityService.validateDeckStructure(invalidDeck)
      
      expect(validation.isValid).toBe(false)
      expect(validation.cardCount).toBe(99)
      expect(validation.issues.length).toBeGreaterThan(0)
      expect(validation.issues.some(issue => issue.type === 'INVALID_CARD_COUNT')).toBe(true)
    })
    
    it('should calculate mana curve scores accurately', async () => {
      const deck = {
        cards: [
          // Good mana curve distribution
          ...new Array(10).fill(null).map((_, i) => ({ cmc: 1 })),
          ...new Array(15).fill(null).map((_, i) => ({ cmc: 2 })),
          ...new Array(20).fill(null).map((_, i) => ({ cmc: 3 })),
          ...new Array(15).fill(null).map((_, i) => ({ cmc: 4 })),
          ...new Array(10).fill(null).map((_, i) => ({ cmc: 5 })),
          ...new Array(5).fill(null).map((_, i) => ({ cmc: 6 }))
        ]
      }
      
      const score = await qualityService.calculateManaCurveScore(deck)
      expect(score).toBeGreaterThan(0.7) // Good curve should score well
    })
  })
  
  describe('Security', () => {
    let securityService: SecurityService
    
    beforeEach(() => {
      securityService = new SecurityService()
    })

    it('should validate API keys correctly (via APIKeyManager)', async () => {
      const manager = APIKeyManager.getInstance()
      const validKey = 'sk-1234567890abcdef1234567890abcdef'
      const invalidKey = 'invalid-key'

      expect(manager.validateKeyFormat('openai', validKey)).toBe(true)
      expect(manager.validateKeyFormat('openai', invalidKey)).toBe(false)
    })

    it('should enforce rate limits (via RateLimiter)', async () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 2 })
      const key = 'user:test-user-123:general'

      // Within limit
      for (let i = 0; i < 2; i++) {
        const res = await limiter.checkLimit(key)
        expect(res.allowed).toBe(true)
      }

      const blocked = await limiter.checkLimit(key)
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
    })

    it('should sanitize user input (via sanitizeInput)', () => {
      const maliciousInput = '<script>alert("xss")</script>Test Name'
      const sanitized = sanitizeInput.text(maliciousInput)
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('Test Name')
    })
  })
  
  describe('PersistenceService', () => {
    let persistenceService: PersistenceService
    
    beforeEach(() => {
      persistenceService = new PersistenceService()
    })
    
    it('should auto-save deck changes', async () => {
      const deckId = 'test-deck-123'
      const changes = {
        cards: [{ id: 'new-card', name: 'New Card' }],
        lastModified: new Date()
      }
      
      const result = await persistenceService.autoSaveDeck(deckId, changes)
      
      expect(result.success).toBe(true)
      expect(result.savedAt).toBeDefined()
    })
    
    it('should handle save conflicts', async () => {
      const deckId = 'conflict-deck'
      const userChanges = { cards: [{ id: 'user-card' }] }
      const serverChanges = { cards: [{ id: 'server-card' }] }
      
      // Simulate concurrent modifications
      await persistenceService.autoSaveDeck(deckId, serverChanges)
      const result = await persistenceService.autoSaveDeck(deckId, userChanges)
      
      expect(result.conflict).toBe(true)
      expect(result.conflictResolution).toBeDefined()
    })
    
    it('should persist consultation sessions', async () => {
      const sessionId = 'test-session-456'
      const sessionData = {
        currentStep: 3,
        responses: { commander: 'Atraxa', strategy: 'counters' },
        progress: 0.6
      }
      
      await persistenceService.saveConsultationSession(sessionId, sessionData)
      const retrieved = await persistenceService.getConsultationSession(sessionId)
      
      expect(retrieved).toEqual(sessionData)
    })
  })
})
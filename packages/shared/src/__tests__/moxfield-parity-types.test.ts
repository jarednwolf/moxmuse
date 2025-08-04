// Comprehensive test for Moxfield Parity types and validation schemas
import { describe, it, expect } from 'vitest'
import {
  // Types
  DeckFolder,
  DeckTemplate,
  EnhancedCardData,
  ImportJob,
  ExportJob,
  DeckAnalytics,
  PublicDeck,
  UserProfile,
  TrendingData,
  
  // Validation Schemas
  ValidationSchemas,
  validateUUID,
  validateColorIdentity,
  validateManaCost,
  validateDeckSize
} from '../index'

describe('Moxfield Parity Types', () => {
  describe('Type Definitions', () => {
    it('should have all required deck organization types', () => {
      const deckFolder: DeckFolder = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Folder',
        color: '#6366f1',
        children: [],
        deckIds: [],
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      expect(deckFolder.id).toBeDefined()
      expect(deckFolder.name).toBe('Test Folder')
    })

    it('should have all required card database types', () => {
      const cardData: EnhancedCardData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        cardId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Lightning Bolt',
        cmc: 1,
        typeLine: 'Instant',
        colors: ['R'],
        colorIdentity: ['R'],
        legalities: { commander: 'legal' },
        rulings: [],
        printings: [],
        relatedCards: [],
        popularityScore: 85.5,
        synergyTags: ['burn', 'removal'],
        priceHistory: [],
        availability: {
          inStock: true,
          sources: ['tcgplayer'],
          lowestPrice: 0.25,
          averagePrice: 0.35
        },
        lastUpdated: new Date(),
        imageUrls: {}
      }
      
      expect(cardData.name).toBe('Lightning Bolt')
      expect(cardData.colors).toContain('R')
    })

    it('should have all required social types', () => {
      const publicDeck: PublicDeck = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        deckId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Deck',
        commander: 'Atraxa, Praetors\' Voice',
        format: 'commander',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        authorName: 'TestUser',
        cardCount: 100,
        tags: ['competitive', 'combo'],
        views: 150,
        likes: 25,
        comments: 5,
        copies: 10,
        rating: 4.5,
        isActive: true,
        publishedAt: new Date(),
        lastUpdated: new Date()
      }
      
      expect(publicDeck.name).toBe('Test Deck')
      expect(publicDeck.cardCount).toBe(100)
    })
  })

  describe('Validation Schemas', () => {
    it('should validate deck folder data correctly', () => {
      const validFolder = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Folder',
        color: '#6366f1',
        children: [],
        deckIds: [],
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const result = ValidationSchemas.DeckFolder.safeParse(validFolder)
      expect(result.success).toBe(true)
    })

    it('should reject invalid deck folder data', () => {
      const invalidFolder = {
        id: 'invalid-uuid',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        name: '', // Empty name should fail
        color: 'invalid-color', // Invalid color format
        children: [],
        deckIds: [],
        sortOrder: -1, // Negative sort order should fail
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const result = ValidationSchemas.DeckFolder.safeParse(invalidFolder)
      expect(result.success).toBe(false)
    })

    it('should validate enhanced card data correctly', () => {
      const validCard = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        cardId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Lightning Bolt',
        cmc: 1,
        typeLine: 'Instant',
        colors: ['R'],
        colorIdentity: ['R'],
        legalities: { commander: 'legal' },
        rulings: [],
        printings: [],
        relatedCards: [],
        popularityScore: 85.5,
        synergyTags: ['burn'],
        priceHistory: [],
        availability: {
          inStock: true,
          sources: ['tcgplayer']
        },
        lastUpdated: new Date(),
        imageUrls: {}
      }
      
      const result = ValidationSchemas.EnhancedCardData.safeParse(validCard)
      expect(result.success).toBe(true)
    })

    it('should validate public deck data correctly', () => {
      const validDeck = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        deckId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Deck',
        commander: 'Atraxa, Praetors\' Voice',
        format: 'commander',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        authorName: 'TestUser',
        cardCount: 100,
        tags: ['competitive'],
        views: 150,
        likes: 25,
        comments: 5,
        copies: 10,
        rating: 4.5,
        isActive: true,
        publishedAt: new Date(),
        lastUpdated: new Date()
      }
      
      const result = ValidationSchemas.PublicDeck.safeParse(validDeck)
      expect(result.success).toBe(true)
    })
  })

  describe('Utility Functions', () => {
    it('should validate UUIDs correctly', () => {
      expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
      expect(validateUUID('invalid-uuid')).toBe(false)
      expect(validateUUID('')).toBe(false)
    })

    it('should validate color identity correctly', () => {
      expect(validateColorIdentity(['W', 'U', 'B'])).toBe(true)
      expect(validateColorIdentity(['R', 'G'])).toBe(true)
      expect(validateColorIdentity([])).toBe(true)
      expect(validateColorIdentity(['X', 'Y'])).toBe(false)
      expect(validateColorIdentity(['W', 'Invalid'])).toBe(false)
    })

    it('should validate mana costs correctly', () => {
      expect(validateManaCost('{1}{R}')).toBe(true)
      expect(validateManaCost('{2}{W}{U}')).toBe(true)
      expect(validateManaCost('{X}{B}{B}')).toBe(true)
      expect(validateManaCost('')).toBe(true) // Empty is valid
      expect(validateManaCost('invalid')).toBe(false)
      expect(validateManaCost('1R')).toBe(false) // Missing braces
    })

    it('should validate deck sizes correctly', () => {
      expect(validateDeckSize('commander', 100)).toBe(true)
      expect(validateDeckSize('commander', 99)).toBe(false)
      expect(validateDeckSize('commander', 101)).toBe(false)
      expect(validateDeckSize('legacy', 60)).toBe(true)
      expect(validateDeckSize('legacy', 75)).toBe(true)
      expect(validateDeckSize('legacy', 59)).toBe(false)
      expect(validateDeckSize('invalid-format', 60)).toBe(false)
    })
  })

  describe('Complex Type Relationships', () => {
    it('should handle nested folder structures', () => {
      const parentFolder: DeckFolder = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Parent Folder',
        color: '#6366f1',
        children: [{
          id: '123e4567-e89b-12d3-a456-426614174002',
          userId: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Child Folder',
          color: '#ef4444',
          parentId: '123e4567-e89b-12d3-a456-426614174000',
          children: [],
          deckIds: [],
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        deckIds: [],
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      expect(parentFolder.children).toHaveLength(1)
      expect(parentFolder.children[0].parentId).toBe(parentFolder.id)
    })

    it('should handle import job with errors and warnings', () => {
      const importJob: ImportJob = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        source: 'moxfield',
        status: 'completed',
        decksFound: 5,
        decksImported: 4,
        errors: [{
          type: 'card_not_found',
          message: 'Card not found in database',
          context: { cardName: 'Unknown Card' }
        }],
        warnings: [{
          type: 'card_substitution',
          message: 'Card substituted with similar card',
          context: { originalCard: 'Card A', substitutedCard: 'Card B' }
        }],
        createdAt: new Date(),
        processingTime: 5000
      }
      
      expect(importJob.errors).toHaveLength(1)
      expect(importJob.warnings).toHaveLength(1)
      expect(importJob.decksImported).toBeLessThan(importJob.decksFound)
    })
  })

  describe('Performance and Caching Types', () => {
    it('should handle performance metrics correctly', () => {
      const metric = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'deck-analysis',
        duration: 1500,
        success: true,
        metadata: { complexity: 'high' },
        timestamp: new Date()
      }
      
      const result = ValidationSchemas.PerformanceMetric.safeParse(metric)
      expect(result.success).toBe(true)
    })

    it('should handle cache entries correctly', () => {
      const cacheEntry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        key: 'deck-stats-12345',
        value: { averageCMC: 3.2, totalCards: 100 },
        tags: ['deck', 'statistics'],
        hitCount: 15,
        lastAccessed: new Date(),
        createdAt: new Date()
      }
      
      const result = ValidationSchemas.CacheEntry.safeParse(cacheEntry)
      expect(result.success).toBe(true)
    })
  })
})
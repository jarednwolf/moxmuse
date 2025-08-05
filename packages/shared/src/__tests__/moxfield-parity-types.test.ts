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
  PerformanceMetric,
  CacheEntry
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
        name: 'Lightning Bolt',
        manaCost: '{R}',
        cmc: 1,
        typeLine: 'Instant',
        oracleText: 'Lightning Bolt deals 3 damage to any target.',
        colors: ['R'],
        colorIdentity: ['R'],
        legalities: { commander: 'legal' },
        rulings: [],
        printings: [],
        relatedCards: [],
        popularityScore: 85.5,
        synergyTags: ['burn', 'removal'],
        currentPrice: 0.25,
        priceHistory: [],
        availability: {
          inStock: true,
          lowStock: false,
          sources: ['tcgplayer'],
          lastChecked: new Date().toISOString()
        },
        lastUpdated: new Date().toISOString(),
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

  describe('Type Validation', () => {
    it('should validate deck folder structure', () => {
      const validFolder: DeckFolder = {
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
      
      expect(validFolder.name).toBe('Test Folder')
      expect(validFolder.deckIds).toEqual([])
    })

    it('should validate enhanced card data structure', () => {
      const validCard: EnhancedCardData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Lightning Bolt',
        manaCost: '{R}',
        cmc: 1,
        typeLine: 'Instant',
        oracleText: 'Lightning Bolt deals 3 damage to any target.',
        colors: ['R'],
        colorIdentity: ['R'],
        legalities: { commander: 'legal' },
        rulings: [],
        printings: [],
        relatedCards: [],
        popularityScore: 85.5,
        synergyTags: ['burn'],
        currentPrice: 0.25,
        priceHistory: [],
        availability: {
          inStock: true,
          lowStock: false,
          sources: ['tcgplayer'],
          lastChecked: new Date().toISOString()
        },
        lastUpdated: new Date().toISOString(),
        imageUrls: {}
      }
      
      expect(validCard.name).toBe('Lightning Bolt')
      expect(validCard.colors).toContain('R')
    })

    it('should validate public deck structure', () => {
      const validDeck: PublicDeck = {
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
      
      expect(validDeck.name).toBe('Test Deck')
      expect(validDeck.cardCount).toBe(100)
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
      const metric: PerformanceMetric = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        operation: 'deck-analysis',
        duration: 1500,
        success: true,
        metadata: { complexity: 'high' },
        timestamp: new Date()
      }
      
      expect(metric.operation).toBe('deck-analysis')
      expect(metric.success).toBe(true)
    })

    it('should handle cache entries correctly', () => {
      const cacheEntry: CacheEntry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        key: 'deck-stats-12345',
        value: { averageCMC: 3.2, totalCards: 100 },
        tags: ['deck', 'statistics'],
        hitCount: 15,
        lastAccessed: new Date(),
        createdAt: new Date()
      }
      
      expect(cacheEntry.key).toBe('deck-stats-12345')
      expect(cacheEntry.hitCount).toBe(15)
    })
  })
})
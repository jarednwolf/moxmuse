// Integration test for Prisma schema with Moxfield Parity features
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Schema Integration Tests', () => {
  beforeAll(async () => {
    // Ensure we have a clean test environment
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Deck Organization Tables', () => {
    it('should create and query deck folders', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-folder@example.com',
          name: 'Test User'
        }
      })

      const folder = await prisma.deckFolder.create({
        data: {
          userId: testUser.id,
          name: 'Test Folder',
          color: '#6366f1',
          sortOrder: 0
        }
      })

      expect(folder.name).toBe('Test Folder')
      expect(folder.userId).toBe(testUser.id)

      // Cleanup
      await prisma.deckFolder.delete({ where: { id: folder.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    })

    it('should create and query deck templates', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-template@example.com',
          name: 'Test User'
        }
      })

      const template = await prisma.deckTemplate.create({
        data: {
          userId: testUser.id,
          name: 'Aggro Template',
          description: 'Fast aggressive deck',
          format: 'commander',
          archetype: 'aggro',
          isPublic: false,
          tags: ['fast', 'competitive'],
          usageCount: 0
        }
      })

      expect(template.name).toBe('Aggro Template')
      expect(template.archetype).toBe('aggro')
      expect(template.tags).toEqual(['fast', 'competitive'])

      // Cleanup
      await prisma.deckTemplate.delete({ where: { id: template.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    })
  })

  describe('Enhanced Card Database Tables', () => {
    it('should create and query enhanced card data', async () => {
      const cardData = await prisma.enhancedCardData.create({
        data: {
          cardId: '123e4567-e89b-12d3-a456-426614174999',
          name: 'Lightning Bolt',
          cmc: 1,
          typeLine: 'Instant',
          colors: ['R'],
          colorIdentity: ['R'],
          popularityScore: 85.5,
          synergyTags: ['burn', 'removal']
        }
      })

      expect(cardData.name).toBe('Lightning Bolt')
      expect(cardData.colors).toEqual(['R'])
      expect(Number(cardData.popularityScore)).toBe(85.5)

      // Cleanup
      await prisma.enhancedCardData.delete({ where: { id: cardData.id } })
    })

    it('should create and query saved card searches', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-search@example.com',
          name: 'Test User'
        }
      })

      const savedSearch = await prisma.savedCardSearch.create({
        data: {
          userId: testUser.id,
          name: 'Red Instants',
          query: {
            colors: ['R'],
            typeText: 'Instant'
          },
          isPublic: false,
          usageCount: 0
        }
      })

      expect(savedSearch.name).toBe('Red Instants')
      expect(savedSearch.query).toEqual({
        colors: ['R'],
        typeText: 'Instant'
      })

      // Cleanup
      await prisma.savedCardSearch.delete({ where: { id: savedSearch.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    })
  })

  describe('Import/Export Tables', () => {
    it('should create and query import jobs', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-import@example.com',
          name: 'Test User'
        }
      })

      const importJob = await prisma.importJob.create({
        data: {
          userId: testUser.id,
          source: 'moxfield',
          status: 'pending',
          decksFound: 0,
          decksImported: 0,
          errors: [],
          warnings: []
        }
      })

      expect(importJob.source).toBe('moxfield')
      expect(importJob.status).toBe('pending')

      // Cleanup
      await prisma.importJob.delete({ where: { id: importJob.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    })

    it('should create and query export jobs', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-export@example.com',
          name: 'Test User'
        }
      })

      const exportJob = await prisma.exportJob.create({
        data: {
          userId: testUser.id,
          deckIds: ['deck1', 'deck2'],
          format: {
            id: 'moxfield',
            name: 'Moxfield Format',
            description: 'Export to Moxfield',
            fileExtension: 'txt',
            mimeType: 'text/plain',
            supportsMultipleDecks: true,
            customizable: false
          },
          options: {
            includeCommander: true,
            includeSideboard: false,
            includeTokens: false,
            includeBasicLands: true,
            groupByCategory: true,
            includeQuantities: true,
            includePrices: false,
            customFields: []
          },
          status: 'pending'
        }
      })

      expect(exportJob.deckIds).toEqual(['deck1', 'deck2'])
      expect(exportJob.status).toBe('pending')

      // Cleanup
      await prisma.exportJob.delete({ where: { id: exportJob.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    })
  })

  describe('Analytics Tables', () => {
    it('should create and query deck analytics', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-analytics@example.com',
          name: 'Test User'
        }
      })

      const testDeck = await prisma.deck.create({
        data: {
          userId: testUser.id,
          name: 'Test Deck',
          format: 'commander'
        }
      })

      const analytics = await prisma.deckAnalytics.create({
        data: {
          deckId: testDeck.id,
          manaAnalysis: {
            colorRequirements: { W: 5, U: 8 },
            manaEfficiency: 0.85
          },
          consistencyMetrics: {
            keepableHands: 0.78,
            mulliganRate: 0.22
          },
          metaAnalysis: {
            archetype: 'Control',
            winRate: 0.62
          },
          performanceData: {
            gamesPlayed: 50,
            winRate: 0.62
          },
          optimizationSuggestions: [],
          analysisVersion: '1.0'
        }
      })

      expect(analytics.deckId).toBe(testDeck.id)
      expect(analytics.analysisVersion).toBe('1.0')

      // Cleanup
      await prisma.deckAnalytics.delete({ where: { id: analytics.id } })
      await prisma.deck.delete({ where: { id: testDeck.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    })

    it('should create and query goldfish simulations', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-simulation-unique@example.com',
          name: 'Test User'
        }
      })

      const testDeck = await prisma.deck.create({
        data: {
          userId: testUser.id,
          name: 'Test Deck',
          format: 'commander'
        }
      })

      const simulation = await prisma.goldfishSimulation.create({
        data: {
          deckId: testDeck.id,
          userId: testUser.id,
          simulationRuns: 1000,
          keepableHands: 0.78,
          mulliganRate: 0.22,
          gameplayConsistency: 0.82,
          openingHandStats: {
            averageCMC: 3.2,
            keepablePercentage: 0.78
          },
          earlyGameStats: {
            averageTurnToFirstSpell: 2.1,
            averageTurnToCommander: 4.2
          },
          averageTurnToPlay: {
            commander: 4.2
          },
          simulationParameters: {
            iterations: 1000,
            mulliganStrategy: 'balanced'
          }
        }
      })

      expect(simulation.simulationRuns).toBe(1000)
      expect(Number(simulation.keepableHands)).toBe(0.78)

      // Cleanup
      await prisma.goldfishSimulation.delete({ where: { id: simulation.id } })
      await prisma.deck.delete({ where: { id: testDeck.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    })
  })

  describe('Social Tables', () => {
    it('should create and query public decks', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-public@example.com',
          name: 'Test User'
        }
      })

      const testDeck = await prisma.deck.create({
        data: {
          userId: testUser.id,
          name: 'Public Test Deck',
          format: 'commander',
          isPublic: true
        }
      })

      const publicDeck = await prisma.publicDeck.create({
        data: {
          deckId: testDeck.id,
          userId: testUser.id,
          name: 'Public Test Deck',
          commander: 'Atraxa, Praetors\' Voice',
          format: 'commander',
          cardCount: 100,
          tags: ['competitive'],
          views: 0,
          likes: 0,
          comments: 0,
          copies: 0,
          rating: 0
        }
      })

      expect(publicDeck.name).toBe('Public Test Deck')
      expect(publicDeck.commander).toBe('Atraxa, Praetors\' Voice')

      // Cleanup
      await prisma.publicDeck.delete({ where: { id: publicDeck.id } })
      await prisma.deck.delete({ where: { id: testDeck.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    })

    it('should create and query user profiles', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-profile@example.com',
          name: 'Test User'
        }
      })

      const profile = await prisma.userProfile.create({
        data: {
          userId: testUser.id,
          username: 'testuser123',
          displayName: 'Test User',
          totalDecks: 0,
          publicDecks: 0,
          totalLikes: 0,
          totalViews: 0,
          favoriteFormats: ['commander'],
          favoriteArchetypes: ['control'],
          brewingStyle: ['competitive'],
          followers: 0,
          following: 0,
          achievements: [],
          isPublic: true
        }
      })

      expect(profile.username).toBe('testuser123')
      expect(profile.favoriteFormats).toEqual(['commander'])

      // Cleanup
      await prisma.userProfile.delete({ where: { id: profile.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    })
  })

  describe('Performance Tables', () => {
    it('should create and query performance metrics', async () => {
      const metric = await prisma.performanceMetric.create({
        data: {
          operation: 'deck-analysis',
          duration: 1500,
          success: true,
          metadata: {
            complexity: 'high'
          }
        }
      })

      expect(metric.operation).toBe('deck-analysis')
      expect(metric.duration).toBe(1500)
      expect(metric.success).toBe(true)

      // Cleanup
      await prisma.performanceMetric.delete({ where: { id: metric.id } })
    })

    it('should create and query cache entries', async () => {
      const cacheEntry = await prisma.cacheEntry.create({
        data: {
          key: 'test-cache-key',
          value: {
            data: 'test data',
            timestamp: new Date().toISOString()
          },
          tags: ['test', 'cache'],
          hitCount: 0
        }
      })

      expect(cacheEntry.key).toBe('test-cache-key')
      expect(cacheEntry.tags).toEqual(['test', 'cache'])

      // Cleanup
      await prisma.cacheEntry.delete({ where: { id: cacheEntry.id } })
    })

    it('should create and query background jobs', async () => {
      const job = await prisma.backgroundJob.create({
        data: {
          type: 'deck-analysis',
          status: 'pending',
          priority: 5,
          data: {
            deckId: 'test-deck-id',
            analysisType: 'full'
          },
          attempts: 0,
          maxAttempts: 3
        }
      })

      expect(job.type).toBe('deck-analysis')
      expect(job.status).toBe('pending')
      expect(job.priority).toBe(5)

      // Cleanup
      await prisma.backgroundJob.delete({ where: { id: job.id } })
    })
  })

  describe('Relationships and Constraints', () => {
    it('should enforce foreign key relationships', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-fk@example.com',
          name: 'Test User'
        }
      })

      // Create folder
      const folder = await prisma.deckFolder.create({
        data: {
          userId: testUser.id,
          name: 'Test Folder',
          color: '#6366f1',
          sortOrder: 0
        }
      })

      // Create deck
      const deck = await prisma.deck.create({
        data: {
          userId: testUser.id,
          name: 'Test Deck',
          format: 'commander'
        }
      })

      // Create folder item linking deck to folder
      const folderItem = await prisma.deckFolderItem.create({
        data: {
          folderId: folder.id,
          deckId: deck.id,
          sortOrder: 0
        }
      })

      expect(folderItem.folderId).toBe(folder.id)
      expect(folderItem.deckId).toBe(deck.id)

      // Cleanup
      await prisma.deckFolderItem.delete({ where: { id: folderItem.id } })
      await prisma.deck.delete({ where: { id: deck.id } })
      await prisma.deckFolder.delete({ where: { id: folder.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    })

    it('should enforce unique constraints', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-unique@example.com',
          name: 'Test User'
        }
      })

      // Create first profile
      const profile1 = await prisma.userProfile.create({
        data: {
          userId: testUser.id,
          username: 'uniqueuser',
          displayName: 'Unique User',
          totalDecks: 0,
          publicDecks: 0,
          totalLikes: 0,
          totalViews: 0,
          favoriteFormats: [],
          favoriteArchetypes: [],
          brewingStyle: [],
          followers: 0,
          following: 0,
          achievements: [],
          isPublic: true
        }
      })

      // Try to create second profile with same username - should fail
      await expect(
        prisma.userProfile.create({
          data: {
            userId: testUser.id,
            username: 'uniqueuser', // Same username
            displayName: 'Another User',
            totalDecks: 0,
            publicDecks: 0,
            totalLikes: 0,
            totalViews: 0,
            favoriteFormats: [],
            favoriteArchetypes: [],
            brewingStyle: [],
            followers: 0,
            following: 0,
            achievements: [],
            isPublic: true
          }
        })
      ).rejects.toThrow()

      // Cleanup
      await prisma.userProfile.delete({ where: { id: profile1.id } })
      await prisma.user.delete({ where: { id: testUser.id } })
    })
  })
})
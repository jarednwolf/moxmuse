import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Prisma before importing the service
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    deckTemplate: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    deck: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    deckTemplateVersion: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    templateRating: {
      upsert: vi.fn()
    }
  }))
}))

// Import after mocking
import { deckTemplateService } from '../deck-template'

// Mock dependencies
vi.mock('../core/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../core/performance-monitor', () => ({
  performanceMonitor: {
    track: vi.fn((name, fn) => fn())
  }
}))

vi.mock('../core/intelligent-cache', () => ({
  intelligentCache: {
    getOrSet: vi.fn((key, fn) => fn()),
    invalidateByTags: vi.fn()
  }
}))

describe('DeckTemplateService', () => {
  const userId = 'test-user-id'
  const templateId = 'test-template-id'
  const deckId = 'test-deck-id'

  // Get the mocked prisma instance
  const mockPrisma = new (vi.mocked(require('@prisma/client').PrismaClient))()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createTemplate', () => {
    it('should create a new template successfully', async () => {
      const templateData = {
        name: 'Test Template',
        description: 'A test template',
        format: 'commander',
        archetype: 'Control',
        isPublic: false,
        powerLevel: 7,
        estimatedBudget: 200,
        tags: ['control', 'blue'],
        categories: [{
          name: 'Ramp',
          description: 'Ramp cards',
          targetCount: 10,
          minCount: 8,
          maxCount: 12,
          priority: 8
        }],
        coreCards: [{
          cardId: 'card-1',
          category: 'Ramp',
          isCore: true,
          alternatives: [],
          reasoning: 'Essential ramp'
        }],
        flexSlots: [{
          category: 'Removal',
          count: 5,
          criteria: 'Flexible removal',
          suggestions: ['card-2', 'card-3']
        }]
      }

      const mockTemplate = {
        id: templateId,
        userId,
        ...templateData,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockPrisma.deckTemplate.create.mockResolvedValue(mockTemplate)
      mockPrisma.deckTemplateVersion.create.mockResolvedValue({})

      const result = await deckTemplateService.createTemplate(userId, templateData)

      expect(mockPrisma.deckTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          name: templateData.name,
          description: templateData.description,
          format: templateData.format,
          archetype: templateData.archetype,
          isPublic: templateData.isPublic,
          powerLevel: templateData.powerLevel,
          estimatedBudget: templateData.estimatedBudget,
          tags: templateData.tags,
          categories: templateData.categories,
          coreCards: templateData.coreCards,
          flexSlots: templateData.flexSlots,
          usageCount: 0
        })
      })

      expect(mockPrisma.deckTemplateVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateId: mockTemplate.id,
          version: '1.0.0',
          changes: 'Initial template creation'
        })
      })

      expect(result).toEqual(expect.objectContaining({
        id: templateId,
        name: templateData.name,
        description: templateData.description
      }))
    })

    it('should validate input data', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
        description: 'Test',
        format: 'commander',
        archetype: 'Control',
        categories: [],
        coreCards: [],
        flexSlots: []
      }

      await expect(
        deckTemplateService.createTemplate(userId, invalidData as any)
      ).rejects.toThrow()
    })
  })

  describe('createTemplateFromDeck', () => {
    it('should create template from existing deck', async () => {
      const sourceDeck = {
        id: deckId,
        userId,
        name: 'Source Deck',
        format: 'commander',
        cards: [
          { cardId: 'card-1', quantity: 1, category: 'Commander' },
          { cardId: 'card-2', quantity: 1, category: 'Ramp' },
          { cardId: 'card-3', quantity: 1, category: 'Removal' }
        ]
      }

      const templateData = {
        name: 'Template from Deck',
        description: 'Generated from deck',
        format: 'commander',
        archetype: 'Control',
        isPublic: false,
        categories: [],
        coreCards: [],
        flexSlots: []
      }

      mockPrisma.deck.findFirst.mockResolvedValue(sourceDeck)
      mockPrisma.deckTemplate.create.mockResolvedValue({
        id: templateId,
        userId,
        ...templateData,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      mockPrisma.deckTemplateVersion.create.mockResolvedValue({})

      const result = await deckTemplateService.createTemplateFromDeck(
        userId,
        deckId,
        templateData
      )

      expect(mockPrisma.deck.findFirst).toHaveBeenCalledWith({
        where: { id: deckId, userId },
        include: { cards: true }
      })

      expect(result).toEqual(expect.objectContaining({
        name: templateData.name
      }))
    })

    it('should throw error if source deck not found', async () => {
      mockPrisma.deck.findFirst.mockResolvedValue(null)

      await expect(
        deckTemplateService.createTemplateFromDeck(userId, deckId, {} as any)
      ).rejects.toThrow(TRPCError)
    })
  })

  describe('instantiateTemplate', () => {
    it('should create deck from template', async () => {
      const template = {
        id: templateId,
        userId,
        name: 'Test Template',
        format: 'commander',
        archetype: 'Control',
        powerLevel: 7,
        estimatedBudget: 200,
        tags: ['control'],
        coreCards: [
          { cardId: 'card-1', category: 'Commander', isCore: true }
        ],
        flexSlots: [
          { category: 'Ramp', count: 2, suggestions: ['card-2', 'card-3'] }
        ]
      }

      const instantiateData = {
        templateId,
        deckName: 'New Deck',
        customizations: {
          powerLevel: 8,
          budget: 300,
          excludedCards: [],
          preferredCards: [],
          categoryAdjustments: {}
        }
      }

      const createdDeck = {
        id: 'new-deck-id',
        name: 'New Deck',
        cards: []
      }

      mockPrisma.deckTemplate.findFirst.mockResolvedValue(template)
      mockPrisma.deck.create.mockResolvedValue(createdDeck)
      mockPrisma.deckTemplate.update.mockResolvedValue({})

      const result = await deckTemplateService.instantiateTemplate(userId, instantiateData)

      expect(mockPrisma.deckTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          id: templateId,
          OR: [
            { userId },
            { isPublic: true }
          ]
        }
      })

      expect(mockPrisma.deck.create).toHaveBeenCalled()
      expect(mockPrisma.deckTemplate.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } }
      })

      expect(result).toEqual({
        deckId: createdDeck.id,
        deck: createdDeck
      })
    })

    it('should throw error if template not found', async () => {
      mockPrisma.deckTemplate.findFirst.mockResolvedValue(null)

      await expect(
        deckTemplateService.instantiateTemplate(userId, {
          templateId,
          deckName: 'Test',
          customizations: {}
        })
      ).rejects.toThrow(TRPCError)
    })
  })

  describe('getTemplates', () => {
    it('should return templates with filtering', async () => {
      const templates = [
        {
          id: 'template-1',
          name: 'Template 1',
          format: 'commander',
          archetype: 'Aggro',
          isPublic: true,
          usageCount: 5
        },
        {
          id: 'template-2',
          name: 'Template 2',
          format: 'commander',
          archetype: 'Control',
          isPublic: false,
          usageCount: 2
        }
      ]

      mockPrisma.deckTemplate.findMany.mockResolvedValue(templates)
      mockPrisma.deckTemplate.count.mockResolvedValue(2)

      const result = await deckTemplateService.getTemplates(userId, {
        format: 'commander',
        limit: 10,
        offset: 0
      })

      expect(result).toEqual({
        templates: expect.arrayContaining([
          expect.objectContaining({ name: 'Template 1' }),
          expect.objectContaining({ name: 'Template 2' })
        ]),
        totalCount: 2
      })
    })
  })

  describe('getTemplate', () => {
    it('should return single template', async () => {
      const template = {
        id: templateId,
        name: 'Test Template',
        userId,
        isPublic: false
      }

      mockPrisma.deckTemplate.findFirst.mockResolvedValue(template)

      const result = await deckTemplateService.getTemplate(userId, templateId)

      expect(mockPrisma.deckTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          id: templateId,
          OR: [
            { userId },
            { isPublic: true }
          ]
        }
      })

      expect(result).toEqual(expect.objectContaining({
        id: templateId,
        name: 'Test Template'
      }))
    })

    it('should throw error if template not found', async () => {
      mockPrisma.deckTemplate.findFirst.mockResolvedValue(null)

      await expect(
        deckTemplateService.getTemplate(userId, templateId)
      ).rejects.toThrow(TRPCError)
    })
  })

  describe('updateTemplate', () => {
    it('should update template successfully', async () => {
      const existingTemplate = {
        id: templateId,
        userId,
        name: 'Old Name',
        categories: [],
        coreCards: [],
        flexSlots: []
      }

      const updates = {
        name: 'New Name',
        description: 'Updated description'
      }

      mockPrisma.deckTemplate.findFirst.mockResolvedValue(existingTemplate)
      mockPrisma.deckTemplate.update.mockResolvedValue({
        ...existingTemplate,
        ...updates
      })

      const result = await deckTemplateService.updateTemplate(userId, templateId, updates)

      expect(mockPrisma.deckTemplate.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: updates
      })

      expect(result).toEqual(expect.objectContaining({
        name: 'New Name'
      }))
    })

    it('should throw error if template not owned by user', async () => {
      mockPrisma.deckTemplate.findFirst.mockResolvedValue(null)

      await expect(
        deckTemplateService.updateTemplate(userId, templateId, { name: 'New Name' })
      ).rejects.toThrow(TRPCError)
    })
  })

  describe('deleteTemplate', () => {
    it('should delete template successfully', async () => {
      const template = {
        id: templateId,
        userId
      }

      mockPrisma.deckTemplate.findFirst.mockResolvedValue(template)
      mockPrisma.deckTemplate.delete.mockResolvedValue({})

      await deckTemplateService.deleteTemplate(userId, templateId)

      expect(mockPrisma.deckTemplate.delete).toHaveBeenCalledWith({
        where: { id: templateId }
      })
    })

    it('should throw error if template not found', async () => {
      mockPrisma.deckTemplate.findFirst.mockResolvedValue(null)

      await expect(
        deckTemplateService.deleteTemplate(userId, templateId)
      ).rejects.toThrow(TRPCError)
    })
  })

  describe('rateTemplate', () => {
    it('should rate template successfully', async () => {
      const template = {
        id: templateId,
        isPublic: true
      }

      mockPrisma.deckTemplate.findFirst.mockResolvedValue(template)
      mockPrisma.templateRating.upsert.mockResolvedValue({})

      await deckTemplateService.rateTemplate(userId, templateId, 5, 'Great template!')

      expect(mockPrisma.templateRating.upsert).toHaveBeenCalledWith({
        where: {
          userId_templateId: {
            userId,
            templateId
          }
        },
        update: {
          rating: 5,
          review: 'Great template!',
          updatedAt: expect.any(Date)
        },
        create: {
          userId,
          templateId,
          rating: 5,
          review: 'Great template!'
        }
      })
    })

    it('should validate rating range', async () => {
      await expect(
        deckTemplateService.rateTemplate(userId, templateId, 6)
      ).rejects.toThrow(TRPCError)

      await expect(
        deckTemplateService.rateTemplate(userId, templateId, 0)
      ).rejects.toThrow(TRPCError)
    })
  })

  describe('getTemplateRecommendations', () => {
    it('should return AI-powered recommendations', async () => {
      const userDecks = []
      const templates = [
        {
          id: 'template-1',
          name: 'Recommended Template',
          format: 'commander',
          archetype: 'Control',
          powerLevel: 7,
          estimatedBudget: 200,
          usageCount: 10,
          isPublic: true
        }
      ]

      mockPrisma.deck.findMany.mockResolvedValue(userDecks)
      mockPrisma.deckTemplate.findMany.mockResolvedValue(templates)

      const result = await deckTemplateService.getTemplateRecommendations(userId, {
        format: 'commander',
        archetype: 'Control',
        powerLevel: 7,
        budget: 250
      })

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            template: expect.objectContaining({
              name: 'Recommended Template'
            }),
            score: expect.any(Number),
            reasoning: expect.any(String)
          })
        ])
      )
    })
  })
})
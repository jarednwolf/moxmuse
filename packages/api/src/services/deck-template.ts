import { prisma } from '@moxmuse/db'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { logger } from './core/logging'
import { performanceMonitor } from './core/performance-monitor'
import { intelligentCache } from './core/intelligent-cache'

// Define types locally until they are added to shared
interface TemplateCategory {
  name: string
  description: string
  targetCount: number
  minCount: number
  maxCount: number
  priority: number
}

interface TemplateCard {
  cardId: string
  category: string
  isCore: boolean
  alternatives: string[]
  reasoning: string
}

interface FlexSlot {
  category: string
  count: number
  criteria: string
  suggestions: string[]
}

interface DeckTemplate {
  id: string
  userId: string
  name: string
  description: string
  format: string
  archetype: string
  isPublic: boolean
  categories: TemplateCategory[]
  coreCards: TemplateCard[]
  flexSlots: FlexSlot[]
  powerLevel?: number
  estimatedBudget?: number
  tags: string[]
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

interface DeckTemplateVersion {
  id: string
  templateId: string
  version: string
  changes: string
  categories: any
  coreCards: any
  flexSlots: any
  createdAt: Date
}

interface TemplateRating {
  userId: string
  templateId: string
  rating: number
  review?: string
  createdAt: Date
  updatedAt: Date
}

interface TemplateRecommendation {
  template: DeckTemplate
  score: number
  reasoning: string
}

// Using the shared prisma instance from @moxmuse/db

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  format: z.string().default('commander'),
  archetype: z.string().min(1).max(50),
  isPublic: z.boolean().default(false),
  powerLevel: z.number().min(1).max(10).optional(),
  estimatedBudget: z.number().min(0).optional(),
  tags: z.array(z.string()).default([]),
  categories: z.array(z.object({
    name: z.string(),
    description: z.string(),
    targetCount: z.number(),
    minCount: z.number(),
    maxCount: z.number(),
    priority: z.number()
  })),
  coreCards: z.array(z.object({
    cardId: z.string(),
    category: z.string(),
    isCore: z.boolean(),
    alternatives: z.array(z.string()),
    reasoning: z.string()
  })),
  flexSlots: z.array(z.object({
    category: z.string(),
    count: z.number(),
    criteria: z.string(),
    suggestions: z.array(z.string())
  }))
})

const instantiateTemplateSchema = z.object({
  templateId: z.string(),
  deckName: z.string().min(1).max(100),
  customizations: z.object({
    powerLevel: z.number().min(1).max(10).optional(),
    budget: z.number().min(0).optional(),
    excludedCards: z.array(z.string()).default([]),
    preferredCards: z.array(z.string()).default([]),
    categoryAdjustments: z.record(z.number()).default({})
  }).default({})
})

export class DeckTemplateService {
  /**
   * Create a template from an existing deck
   */
  async createTemplateFromDeck(
    userId: string,
    deckId: string,
    templateData: z.infer<typeof createTemplateSchema>
  ): Promise<DeckTemplate> {
    return performanceMonitor.trackOperation('createTemplateFromDeck', async () => {
      try {
        // Validate input
        const validatedData = createTemplateSchema.parse(templateData)
        
        // Get the source deck
        const sourceDeck = await prisma.deck.findFirst({
          where: { id: deckId, userId },
          include: { cards: true }
        })
        
        if (!sourceDeck) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Source deck not found'
          })
        }

        // Analyze deck structure to create template
        const analyzedStructure = await this.analyzeDeckStructure(sourceDeck)
        
        // Create template with analyzed structure
        const template = await prisma.deckTemplate.create({
          data: {
            userId,
            name: validatedData.name,
            description: validatedData.description,
            format: validatedData.format,
            archetype: validatedData.archetype,
            isPublic: validatedData.isPublic,
            powerLevel: validatedData.powerLevel,
            estimatedBudget: validatedData.estimatedBudget,
            tags: validatedData.tags,
            categories: validatedData.categories,
            coreCards: validatedData.coreCards,
            flexSlots: validatedData.flexSlots,
            usageCount: 0
          }
        })

        // Create initial version
        await this.createTemplateVersion(template.id, {
          version: '1.0.0',
          changes: 'Initial template creation',
          categories: validatedData.categories,
          coreCards: validatedData.coreCards,
          flexSlots: validatedData.flexSlots
        })

        logger.info('Template created from deck', { 
          templateId: template.id, 
          deckId, 
          userId 
        })

        // Clear related caches
        await intelligentCache.invalidateTag('templates');
        await intelligentCache.invalidateTag(`user:${userId}`)

        return this.formatTemplate(template)
      } catch (error) {
        logger.error('Failed to create template from deck', error as Error, { deckId, userId })
        throw error
      }
    })
  }

  /**
   * Create a template from scratch
   */
  async createTemplate(
    userId: string,
    templateData: z.infer<typeof createTemplateSchema>
  ): Promise<DeckTemplate> {
    return performanceMonitor.trackOperation('createTemplate', async () => {
      try {
        const validatedData = createTemplateSchema.parse(templateData)
        
        const template = await prisma.deckTemplate.create({
          data: {
            userId,
            name: validatedData.name,
            description: validatedData.description,
            format: validatedData.format,
            archetype: validatedData.archetype,
            isPublic: validatedData.isPublic,
            powerLevel: validatedData.powerLevel,
            estimatedBudget: validatedData.estimatedBudget,
            tags: validatedData.tags,
            categories: validatedData.categories,
            coreCards: validatedData.coreCards,
            flexSlots: validatedData.flexSlots,
            usageCount: 0
          }
        })

        // Create initial version
        await this.createTemplateVersion(template.id, {
          version: '1.0.0',
          changes: 'Initial template creation',
          categories: validatedData.categories,
          coreCards: validatedData.coreCards,
          flexSlots: validatedData.flexSlots
        })

        logger.info('Template created', { templateId: template.id, userId })
        
        await intelligentCache.invalidateTag('templates');
        await intelligentCache.invalidateTag(`user:${userId}`)

        return this.formatTemplate(template)
      } catch (error) {
        logger.error('Failed to create template', error as Error, { userId })
        throw error
      }
    })
  }

  /**
   * Instantiate a template into a new deck
   */
  async instantiateTemplate(
    userId: string,
    data: z.infer<typeof instantiateTemplateSchema>
  ): Promise<{ deckId: string; deck: any }> {
    return performanceMonitor.trackOperation('instantiateTemplate', async () => {
      try {
        const validatedData = instantiateTemplateSchema.parse(data)
        
        // Get template
        const template = await prisma.deckTemplate.findFirst({
          where: {
            id: validatedData.templateId,
            OR: [
              { userId },
              { isPublic: true }
            ]
          }
        })

        if (!template) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Template not found or access denied'
          })
        }

        // Generate deck from template
        const generatedDeck = await this.generateDeckFromTemplate(
          template,
          validatedData.customizations
        )

        // Create the deck
        const deck = await prisma.deck.create({
          data: {
            userId,
            name: validatedData.deckName,
            format: template.format,
            commander: generatedDeck.commander,
            description: `Generated from template: ${template.name}`,
            powerLevel: validatedData.customizations.powerLevel || template.powerLevel,
            budget: validatedData.customizations.budget || template.estimatedBudget,
            tags: template.tags,
            cards: {
              create: generatedDeck.cards.map(card => ({
                cardId: card.cardId,
                quantity: card.quantity,
                category: card.category,
                isCommander: card.isCommander || false
              }))
            }
          },
          include: { cards: true }
        })

        // Increment template usage count
        await prisma.deckTemplate.update({
          where: { id: template.id },
          data: { usageCount: { increment: 1 } }
        })

        logger.info('Template instantiated', { 
          templateId: template.id, 
          deckId: deck.id, 
          userId 
        })

        await intelligentCache.invalidateTag(`template:${template.id}`)

        return { deckId: deck.id, deck }
      } catch (error) {
        logger.error('Failed to instantiate template', error as Error, { userId })
        throw error
      }
    })
  }

  /**
   * Get templates with filtering and pagination
   */
  async getTemplates(
    userId: string,
    filters: {
      format?: string
      archetype?: string
      isPublic?: boolean
      powerLevel?: [number, number]
      budget?: [number, number]
      tags?: string[]
      search?: string
      sortBy?: 'newest' | 'popular' | 'rating'
      limit?: number
      offset?: number
    } = {}
  ): Promise<{ templates: DeckTemplate[]; totalCount: number }> {
    return performanceMonitor.trackOperation('getTemplates', async () => {
      const cacheKey = `templates:${JSON.stringify({ userId, ...filters })}`
      
      const cached = await intelligentCache.get(cacheKey);
      if (cached) return cached as { templates: DeckTemplate[]; totalCount: number };
      
      const result: { templates: DeckTemplate[]; totalCount: number } = await (async () => {
          const where: any = {
            OR: [
              { userId },
              { isPublic: true }
            ]
          }

          if (filters.format) where.format = filters.format
          if (filters.archetype) where.archetype = filters.archetype
          if (filters.isPublic !== undefined) where.isPublic = filters.isPublic
          if (filters.powerLevel) {
            where.powerLevel = {
              gte: filters.powerLevel[0],
              lte: filters.powerLevel[1]
            }
          }
          if (filters.budget) {
            where.estimatedBudget = {
              gte: filters.budget[0],
              lte: filters.budget[1]
            }
          }
          if (filters.tags?.length) {
            where.tags = { hasSome: filters.tags }
          }
          if (filters.search) {
            where.OR = [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
              { archetype: { contains: filters.search, mode: 'insensitive' } }
            ]
          }

          const orderBy: any = {}
          switch (filters.sortBy) {
            case 'popular':
              orderBy.usageCount = 'desc'
              break
            case 'rating':
              // TODO: Add rating field when implemented
              orderBy.createdAt = 'desc'
              break
            default:
              orderBy.createdAt = 'desc'
          }

          const [templates, totalCount] = await Promise.all([
            prisma.deckTemplate.findMany({
              where,
              orderBy,
              take: filters.limit || 20,
              skip: filters.offset || 0
            }),
            prisma.deckTemplate.count({ where })
          ])

          return {
            templates: templates.map(this.formatTemplate),
            totalCount
          }
        })();
      
      await intelligentCache.set(cacheKey, result, { ttl: 300 });
      return result
    })
  }

  /**
   * Get template by ID
   */
  async getTemplate(userId: string, templateId: string): Promise<DeckTemplate> {
    return performanceMonitor.trackOperation('getTemplate', async () => {
      const cacheKey = `template:${templateId}:${userId}`
      
      const cached = await intelligentCache.get(cacheKey);
      if (cached) return cached as DeckTemplate;
      
      const result: DeckTemplate = await (async () => {
          const template = await prisma.deckTemplate.findFirst({
            where: {
              id: templateId,
              OR: [
                { userId },
                { isPublic: true }
              ]
            }
          })

          if (!template) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Template not found or access denied'
            })
          }

          return this.formatTemplate(template)
        })();
      
      await intelligentCache.set(cacheKey, result, { ttl: 600 });
      return result
    })
  }

  /**
   * Update template
   */
  async updateTemplate(
    userId: string,
    templateId: string,
    updates: Partial<z.infer<typeof createTemplateSchema>>
  ): Promise<DeckTemplate> {
    return performanceMonitor.trackOperation('updateTemplate', async () => {
      try {
        // Check ownership
        const existingTemplate = await prisma.deckTemplate.findFirst({
          where: { id: templateId, userId }
        })

        if (!existingTemplate) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Template not found or access denied'
          })
        }

        // Update template
        const template = await prisma.deckTemplate.update({
          where: { id: templateId },
          data: updates
        })

        // Create new version if structure changed
        if (updates.categories || updates.coreCards || updates.flexSlots) {
          const currentVersion = await this.getLatestTemplateVersion(templateId)
          const newVersion = this.incrementVersion(currentVersion?.version || '1.0.0')
          
          await this.createTemplateVersion(templateId, {
            version: newVersion,
            changes: 'Template updated',
            categories: updates.categories || existingTemplate.categories,
            coreCards: updates.coreCards || existingTemplate.coreCards,
            flexSlots: updates.flexSlots || existingTemplate.flexSlots
          })
        }

        logger.info('Template updated', { templateId, userId })
        
        await intelligentCache.invalidateTag(`template:${templateId}`);
        await intelligentCache.invalidateTag('templates');
        await intelligentCache.invalidateTag(`user:${userId}`)

        return this.formatTemplate(template)
      } catch (error) {
        logger.error('Failed to update template', error as Error, { templateId, userId })
        throw error
      }
    })
  }

  /**
   * Delete template
   */
  async deleteTemplate(userId: string, templateId: string): Promise<void> {
    return performanceMonitor.trackOperation('deleteTemplate', async () => {
      try {
        const template = await prisma.deckTemplate.findFirst({
          where: { id: templateId, userId }
        })

        if (!template) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Template not found or access denied'
          })
        }

        await prisma.deckTemplate.delete({
          where: { id: templateId }
        })

        logger.info('Template deleted', { templateId, userId })
        
        await intelligentCache.invalidateTag(`template:${templateId}`);
        await intelligentCache.invalidateTag('templates');
        await intelligentCache.invalidateTag(`user:${userId}`)
      } catch (error) {
        logger.error('Failed to delete template', error as Error, { templateId, userId })
        throw error
      }
    })
  }

  /**
   * Get AI-powered template recommendations
   */
  async getTemplateRecommendations(
    userId: string,
    preferences: {
      format?: string
      archetype?: string
      powerLevel?: number
      budget?: number
      playstyle?: string[]
    }
  ): Promise<TemplateRecommendation[]> {
    return performanceMonitor.trackOperation('getTemplateRecommendations', async () => {
      const cacheKey = `template-recommendations:${userId}:${JSON.stringify(preferences)}`
      
      const cached = await intelligentCache.get(cacheKey);
      if (cached) return cached as TemplateRecommendation[];
      
      const result: TemplateRecommendation[] = await (async () => {
          // Get user's deck history for personalization
          const userDecks = await prisma.deck.findMany({
            where: { userId },
            include: { cards: true },
            take: 10,
            orderBy: { updatedAt: 'desc' }
          })

          // Get popular templates matching preferences
          const where: any = { isPublic: true }
          if (preferences.format) where.format = preferences.format
          if (preferences.archetype) where.archetype = preferences.archetype
          if (preferences.powerLevel) {
            where.powerLevel = {
              gte: Math.max(1, preferences.powerLevel - 1),
              lte: Math.min(10, preferences.powerLevel + 1)
            }
          }
          if (preferences.budget) {
            where.estimatedBudget = {
              lte: preferences.budget * 1.2 // Allow 20% over budget
            }
          }

          const templates = await prisma.deckTemplate.findMany({
            where,
            orderBy: { usageCount: 'desc' },
            take: 20
          })

          // Score templates based on user preferences and history
          const recommendations = templates.map(template => {
            const score = this.calculateTemplateRecommendationScore(
              template,
              userDecks,
              preferences
            )

            return {
              template: this.formatTemplate(template),
              score,
              reasoning: this.generateRecommendationReasoning(template, preferences)
            }
          })

          // Sort by score and return top recommendations
          return recommendations
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
        })();
      
      await intelligentCache.set(cacheKey, result, { ttl: 1800 });
      return result
    })
  }

  /**
   * Rate a template
   */
  async rateTemplate(
    userId: string,
    templateId: string,
    rating: number,
    review?: string
  ): Promise<void> {
    return performanceMonitor.trackOperation('rateTemplate', async () => {
      try {
        if (rating < 1 || rating > 5) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Rating must be between 1 and 5'
          })
        }

        // Check if template exists and is accessible
        const template = await prisma.deckTemplate.findFirst({
          where: {
            id: templateId,
            OR: [
              { userId },
              { isPublic: true }
            ]
          }
        })

        if (!template) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Template not found or access denied'
          })
        }

        // Upsert rating
        await prisma.templateRating.upsert({
          where: {
            userId_templateId: {
              userId,
              templateId
            }
          },
          update: {
            rating,
            review,
            updatedAt: new Date()
          },
          create: {
            userId,
            templateId,
            rating,
            review
          }
        })

        logger.info('Template rated', { templateId, userId, rating })
        
        await intelligentCache.invalidateTag(`template:${templateId}`)
      } catch (error) {
        logger.error('Failed to rate template', error as Error, { templateId, userId })
        throw error
      }
    })
  }

  // Private helper methods

  private async analyzeDeckStructure(deck: any): Promise<{
    categories: TemplateCategory[]
    coreCards: TemplateCard[]
    flexSlots: FlexSlot[]
  }> {
    // Analyze deck cards to determine structure
    const cardsByCategory = new Map<string, any[]>()
    
    for (const card of deck.cards) {
      const category = card.category || 'Other'
      if (!cardsByCategory.has(category)) {
        cardsByCategory.set(category, [])
      }
      cardsByCategory.get(category)!.push(card)
    }

    const categories: TemplateCategory[] = []
    const coreCards: TemplateCard[] = []
    const flexSlots: FlexSlot[] = []

    for (const [categoryName, cards] of Array.from(cardsByCategory)) {
      // Create category
      categories.push({
        name: categoryName,
        description: `${categoryName} cards for the deck`,
        targetCount: cards.length,
        minCount: Math.max(1, Math.floor(cards.length * 0.8)),
        maxCount: Math.ceil(cards.length * 1.2),
        priority: this.getCategoryPriority(categoryName)
      })

      // Determine core vs flex cards
      for (const card of cards) {
        const isCore = this.isCardCore(card, categoryName)
        
        if (isCore) {
          coreCards.push({
            cardId: card.cardId,
            category: categoryName,
            isCore: true,
            alternatives: [], // TODO: Generate alternatives
            reasoning: `Essential ${categoryName} card`
          })
        }
      }

      // Create flex slots for non-core cards
      const flexCount = cards.length - coreCards.filter(c => c.category === categoryName).length
      if (flexCount > 0) {
        flexSlots.push({
          category: categoryName,
          count: flexCount,
          criteria: `Additional ${categoryName} cards`,
          suggestions: cards
            .filter(card => !coreCards.some(c => c.cardId === card.cardId))
            .map(card => card.cardId)
        })
      }
    }

    return { categories, coreCards, flexSlots }
  }

  private async generateDeckFromTemplate(
    template: any,
    customizations: any
  ): Promise<{ commander: string; cards: any[] }> {
    const cards: any[] = []
    let commander = ''

    // Add core cards
    for (const coreCard of template.coreCards) {
      if (customizations.excludedCards?.includes(coreCard.cardId)) {
        continue
      }

      cards.push({
        cardId: coreCard.cardId,
        quantity: 1,
        category: coreCard.category,
        isCommander: coreCard.category === 'Commander'
      })

      if (coreCard.category === 'Commander') {
        commander = coreCard.cardId
      }
    }

    // Fill flex slots
    for (const flexSlot of template.flexSlots) {
      const adjustedCount = customizations.categoryAdjustments?.[flexSlot.category] || flexSlot.count
      const availableCards = flexSlot.suggestions.filter(
        (cardId: string) => !customizations.excludedCards?.includes(cardId)
      )

      // Prioritize preferred cards
      const preferredCards = availableCards.filter(
        (cardId: string) => customizations.preferredCards?.includes(cardId)
      )

      const selectedCards = [
        ...preferredCards.slice(0, adjustedCount),
        ...availableCards
          .filter((cardId: string) => !preferredCards.includes(cardId))
          .slice(0, Math.max(0, adjustedCount - preferredCards.length))
      ]

      for (const cardId of selectedCards) {
        cards.push({
          cardId,
          quantity: 1,
          category: flexSlot.category
        })
      }
    }

    return { commander, cards }
  }

  private async createTemplateVersion(
    templateId: string,
    versionData: {
      version: string
      changes: string
      categories: any
      coreCards: any
      flexSlots: any
    }
  ): Promise<void> {
    await prisma.deckTemplateVersion.create({
      data: {
        templateId,
        version: versionData.version,
        changes: versionData.changes,
        categories: versionData.categories,
        coreCards: versionData.coreCards,
        flexSlots: versionData.flexSlots
      }
    })
  }

  private async getLatestTemplateVersion(templateId: string): Promise<any> {
    return prisma.deckTemplateVersion.findFirst({
      where: { templateId },
      orderBy: { createdAt: 'desc' }
    })
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.')
    const patch = parseInt(parts[2] || '0') + 1
    return `${parts[0]}.${parts[1]}.${patch}`
  }

  private calculateTemplateRecommendationScore(
    template: any,
    userDecks: any[],
    preferences: any
  ): number {
    let score = 0

    // Base popularity score
    score += Math.min(template.usageCount * 0.1, 10)

    // Format match
    if (preferences.format && template.format === preferences.format) {
      score += 20
    }

    // Archetype match
    if (preferences.archetype && template.archetype === preferences.archetype) {
      score += 15
    }

    // Power level match
    if (preferences.powerLevel && template.powerLevel) {
      const diff = Math.abs(template.powerLevel - preferences.powerLevel)
      score += Math.max(0, 10 - diff * 2)
    }

    // Budget match
    if (preferences.budget && template.estimatedBudget) {
      if (template.estimatedBudget <= preferences.budget) {
        score += 10
      } else {
        const overBudget = (template.estimatedBudget - preferences.budget) / preferences.budget
        score -= overBudget * 20
      }
    }

    // User deck similarity
    const similarityScore = this.calculateDeckSimilarity(template, userDecks)
    score += similarityScore * 5

    return Math.max(0, score)
  }

  private calculateDeckSimilarity(template: any, userDecks: any[]): number {
    if (!userDecks.length) return 0

    let maxSimilarity = 0
    for (const deck of userDecks) {
      const similarity = this.calculateTemplateDeckSimilarity(template, deck)
      maxSimilarity = Math.max(maxSimilarity, similarity)
    }

    return maxSimilarity
  }

  private calculateTemplateDeckSimilarity(template: any, deck: any): number {
    // Simple similarity based on archetype and format
    let similarity = 0

    if (template.format === deck.format) similarity += 0.3
    if (template.archetype === deck.archetype) similarity += 0.4

    // TODO: Add more sophisticated similarity calculation based on cards

    return similarity
  }

  private generateRecommendationReasoning(template: any, preferences: any): string {
    const reasons: string[] = []

    if (preferences.format && template.format === preferences.format) {
      reasons.push(`Matches your preferred ${template.format} format`)
    }

    if (preferences.archetype && template.archetype === preferences.archetype) {
      reasons.push(`Perfect for ${template.archetype} strategy`)
    }

    if (template.usageCount > 10) {
      reasons.push(`Popular template used by ${template.usageCount} players`)
    }

    if (preferences.budget && template.estimatedBudget && template.estimatedBudget <= preferences.budget) {
      reasons.push(`Fits within your $${preferences.budget} budget`)
    }

    return reasons.join('. ') || 'Recommended based on your preferences'
  }

  private getCategoryPriority(categoryName: string): number {
    const priorities: Record<string, number> = {
      'Commander': 10,
      'Win Conditions': 9,
      'Ramp': 8,
      'Card Draw': 8,
      'Removal': 7,
      'Lands': 6,
      'Creatures': 5,
      'Artifacts': 4,
      'Enchantments': 4,
      'Instants': 3,
      'Sorceries': 3,
      'Other': 1
    }

    return priorities[categoryName] || 2
  }

  private isCardCore(card: any, category: string): boolean {
    // Simple heuristic - in a real implementation, this would use AI/ML
    if (category === 'Commander') return true
    if (category === 'Win Conditions') return true
    if (category === 'Ramp' && card.quantity >= 1) return true
    
    return false
  }

  private formatTemplate(template: any): DeckTemplate {
    return {
      id: template.id,
      userId: template.userId,
      name: template.name,
      description: template.description,
      format: template.format,
      archetype: template.archetype,
      isPublic: template.isPublic,
      categories: template.categories,
      coreCards: template.coreCards,
      flexSlots: template.flexSlots,
      powerLevel: template.powerLevel,
      estimatedBudget: template.estimatedBudget,
      tags: template.tags,
      usageCount: template.usageCount,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }
  }
}

export const deckTemplateService = new DeckTemplateService()

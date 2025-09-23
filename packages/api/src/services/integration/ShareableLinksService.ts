import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { nanoid } from 'nanoid'
// Local minimal deck shape for shareable links
import { prisma } from '@moxmuse/db'

// Shareable link schemas
const ShareOptionsSchema = z.object({
  includeAnalysis: z.boolean().default(true),
  includeStrategy: z.boolean().default(true),
  includeMetadata: z.boolean().default(false),
  allowComments: z.boolean().default(false),
  allowForks: z.boolean().default(true),
  expiresAt: z.date().optional(),
  password: z.string().optional(),
  customSlug: z.string().optional(),
})

type ShareOptions = z.infer<typeof ShareOptionsSchema>

const ShareableLinkSchema = z.object({
  id: z.string(),
  slug: z.string(),
  deckId: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  isPublic: z.boolean(),
  allowComments: z.boolean(),
  allowForks: z.boolean(),
  viewCount: z.number(),
  password: z.string().optional(),
  expiresAt: z.date().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

type ShareableLink = z.infer<typeof ShareableLinkSchema>

interface ShareableDeckData {
  link: ShareableLink
  deck: any
  embedMetadata: EmbedMetadata
}

interface EmbedMetadata {
  title: string
  description: string
  image?: string
  url: string
  type: 'deck'
  siteName: string
  author?: string
  cardCount: number
  commander?: string
  colors?: string[]
  estimatedBudget?: number
  powerLevel?: number
}

export class ShareableLinksService {
  /**
   * Create a shareable link for a deck
   */
  async createShareableLink(
    deckId: string,
    userId: string,
    options: ShareOptions
  ): Promise<ShareableLink> {
    try {
      const validatedOptions = ShareOptionsSchema.parse(options)
      
      // Verify deck exists and user has access
      const deck = await prisma.generatedDeck.findFirst({
        where: {
          id: deckId,
          userId: userId,
        },
      })

      if (!deck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deck not found or access denied',
        })
      }

      // Generate unique slug
      const slug = validatedOptions.customSlug || this.generateSlug(deck.name)
      await this.ensureUniqueSlug(slug)

      // Create shareable link
      const shareableLink = await prisma.shareableLink.create({
        data: {
          id: nanoid(),
          slug,
          deckId,
          userId,
          title: deck.name,
          description: this.generateShareDescription(deck),
          isPublic: true,
          allowComments: validatedOptions.allowComments,
          allowForks: validatedOptions.allowForks,
          viewCount: 0,
          password: validatedOptions.password,
          expiresAt: validatedOptions.expiresAt,
          metadata: this.generateShareMetadata(deck, validatedOptions),
        },
      })

      return ShareableLinkSchema.parse(shareableLink)
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create shareable link',
        cause: error,
      })
    }
  }

  /**
   * Get shareable deck data by slug
   */
  async getShareableDeck(
    slug: string,
    password?: string
  ): Promise<ShareableDeckData> {
    try {
      const shareableLink = await prisma.shareableLink.findUnique({
        where: { slug },
        include: {
          deck: {
            include: {
              cards: {
                include: {
                  card: true,
                },
              },
            },
          },
        },
      })

      if (!shareableLink) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shareable link not found',
        })
      }

      // Check if link has expired
      if (shareableLink.expiresAt && shareableLink.expiresAt < new Date()) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shareable link has expired',
        })
      }

      // Check password if required
      if (shareableLink.password && shareableLink.password !== password) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Password required to access this deck',
        })
      }

      // Increment view count
      await prisma.shareableLink.update({
        where: { id: shareableLink.id },
        data: { viewCount: { increment: 1 } },
      })

      // Generate embed metadata
      const embedMetadata = this.generateEmbedMetadata(shareableLink, shareableLink.deck)

      return {
        link: ShareableLinkSchema.parse(shareableLink),
        deck: shareableLink.deck,
        embedMetadata,
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve shareable deck',
        cause: error,
      })
    }
  }

  /**
   * Update shareable link settings
   */
  async updateShareableLink(
    linkId: string,
    userId: string,
    updates: Partial<ShareOptions>
  ): Promise<ShareableLink> {
    try {
      const existingLink = await prisma.shareableLink.findFirst({
        where: {
          id: linkId,
          userId: userId,
        },
      })

      if (!existingLink) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shareable link not found or access denied',
        })
      }

      const updatedLink = await prisma.shareableLink.update({
        where: { id: linkId },
        data: {
          allowComments: updates.allowComments,
          allowForks: updates.allowForks,
          password: updates.password,
          expiresAt: updates.expiresAt,
          updatedAt: new Date(),
        },
      })

      return ShareableLinkSchema.parse(updatedLink)
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update shareable link',
        cause: error,
      })
    }
  }

  /**
   * Delete shareable link
   */
  async deleteShareableLink(linkId: string, userId: string): Promise<void> {
    try {
      const result = await prisma.shareableLink.deleteMany({
        where: {
          id: linkId,
          userId: userId,
        },
      })

      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shareable link not found or access denied',
        })
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete shareable link',
        cause: error,
      })
    }
  }

  /**
   * Get user's shareable links
   */
  async getUserShareableLinks(userId: string): Promise<ShareableLink[]> {
    try {
      const links = await prisma.shareableLink.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })

      return links.map(link => ShareableLinkSchema.parse(link))
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve shareable links',
        cause: error,
      })
    }
  }

  /**
   * Fork a shared deck
   */
  async forkSharedDeck(
    slug: string,
    userId: string,
    newDeckName?: string
  ): Promise<any> {
    try {
      const shareableData = await this.getShareableDeck(slug)
      
      if (!shareableData.link.allowForks) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Forking is not allowed for this deck',
        })
      }

      // Create a copy of the deck for the new user
      const forkedDeck = await prisma.generatedDeck.create({
        data: {
          id: nanoid(),
          userId,
          sessionId: nanoid(),
          name: newDeckName || `${shareableData.deck.name} (Fork)`,
          commander: shareableData.deck.commander,
          format: shareableData.deck.format,
          strategy: shareableData.deck.strategy,
          winConditions: shareableData.deck.winConditions,
          powerLevel: shareableData.deck.powerLevel,
          estimatedBudget: shareableData.deck.estimatedBudget,
          consultationData: shareableData.deck.consultationData,
          status: 'generated',
          cards: {
            create: shareableData.deck.cards.map((card: any) => ({
              id: nanoid(),
              cardId: card.cardId,
              quantity: card.quantity,
              category: card.category,
              role: card.role,
              reasoning: card.reasoning,
              alternatives: card.alternatives ?? [],
              upgradeOptions: card.upgradeOptions ?? [],
              budgetOptions: card.budgetOptions ?? [],
            })),
          },
        },
        include: {
          cards: true,
        },
      })

      return forkedDeck
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fork shared deck',
        cause: error,
      })
    }
  }

  /**
   * Generate a URL-friendly slug from deck name
   */
  private generateSlug(deckName: string): string {
    const baseSlug = deckName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    
    // Add random suffix to ensure uniqueness
    return `${baseSlug}-${nanoid(8)}`
  }

  /**
   * Ensure slug is unique
   */
  private async ensureUniqueSlug(slug: string): Promise<void> {
    const existing = await prisma.shareableLink.findUnique({
      where: { slug },
    })

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Slug already exists, please choose a different one',
      })
    }
  }

  /**
   * Generate share description
   */
  private generateShareDescription(deck: any): string {
    let description = `A ${deck.format} deck`
    
    if (deck.commander) {
      description += ` led by ${deck.commander}`
    }
    
    if (deck.strategy?.name) {
      description += ` focusing on ${deck.strategy.name.toLowerCase()}`
    }
    
    description += `. Generated by MoxMuse AI Deck Building Tutor.`
    
    return description
  }

  /**
   * Generate share metadata
   */
  private generateShareMetadata(deck: any, options: ShareOptions): Record<string, any> {
    const metadata: Record<string, any> = {
      shareOptions: options,
      originalDeckId: deck.id,
      sharedAt: new Date().toISOString(),
    }

    if (options.includeAnalysis && deck.qualityMetrics) {
      metadata.qualityScore = deck.qualityMetrics.overallScore
      metadata.synergyScore = deck.qualityMetrics.synergyScore
    }

    if (options.includeStrategy && deck.strategy) {
      metadata.strategy = deck.strategy
      metadata.winConditions = deck.winConditions
    }

    if (options.includeMetadata) {
      metadata.powerLevel = deck.powerLevel
      metadata.estimatedBudget = deck.estimatedBudget
      metadata.cardCount = deck.cards?.length || 0
      metadata.generationTime = deck.generationTime
    }

    return metadata
  }

  /**
   * Generate embed metadata for social sharing
   */
  private generateEmbedMetadata(link: any, deck: any): EmbedMetadata {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moxmuse.com'
    
    return {
      title: `${deck.name} - MoxMuse Deck`,
      description: link.description || this.generateShareDescription(deck),
      url: `${baseUrl}/shared/${link.slug}`,
      type: 'deck',
      siteName: 'MoxMuse',
      author: deck.user?.name,
      cardCount: deck.cards?.length || 0,
      commander: deck.commander,
      colors: deck.colorIdentity,
      estimatedBudget: deck.estimatedBudget,
      powerLevel: deck.powerLevel,
    }
  }

  /**
   * Generate Open Graph meta tags for a shared deck
   */
  generateOpenGraphTags(embedMetadata: EmbedMetadata): Record<string, string> {
    return {
      'og:title': embedMetadata.title,
      'og:description': embedMetadata.description,
      'og:url': embedMetadata.url,
      'og:type': 'article',
      'og:site_name': embedMetadata.siteName,
      'og:image': embedMetadata.image || `${process.env.NEXT_PUBLIC_APP_URL}/images/deck-preview.png`,
      'twitter:card': 'summary_large_image',
      'twitter:title': embedMetadata.title,
      'twitter:description': embedMetadata.description,
      'twitter:image': embedMetadata.image || `${process.env.NEXT_PUBLIC_APP_URL}/images/deck-preview.png`,
    }
  }
}

export const shareableLinksService = new ShareableLinksService()
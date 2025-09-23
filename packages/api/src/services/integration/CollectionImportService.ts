import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { nanoid } from 'nanoid'
import { prisma } from '@moxmuse/db'
import type { GeneratedDeckCard as Card } from '@moxmuse/shared'

// Import platform schemas
const ImportPlatformSchema = z.enum(['moxfield', 'archidekt', 'edhrec', 'tappedout', 'csv'])
type ImportPlatform = z.infer<typeof ImportPlatformSchema>

const ImportOptionsSchema = z.object({
  platform: ImportPlatformSchema,
  url: z.string().url().optional(),
  data: z.string().optional(),
  file: z.any().optional(),
  includeBasicLands: z.boolean().default(false),
  mergeWithExisting: z.boolean().default(false),
  validateCards: z.boolean().default(true),
  importPrices: z.boolean().default(false),
})

type ImportOptions = z.infer<typeof ImportOptionsSchema>

const ImportResultSchema = z.object({
  success: z.boolean(),
  importedCount: z.number(),
  skippedCount: z.number(),
  errorCount: z.number(),
  totalProcessed: z.number(),
  collectionId: z.string(),
  errors: z.array(z.object({
    cardName: z.string(),
    error: z.string(),
    line: z.number().optional(),
  })),
  warnings: z.array(z.object({
    cardName: z.string(),
    warning: z.string(),
    line: z.number().optional(),
  })),
  summary: z.object({
    newCards: z.number(),
    updatedCards: z.number(),
    duplicates: z.number(),
    invalidCards: z.number(),
  }),
})

type ImportResult = z.infer<typeof ImportResultSchema>

interface CollectionCard {
  cardId: string
  name: string
  quantity: number
  condition?: string
  foil?: boolean
  language?: string
  set?: string
  collectorNumber?: string
  price?: number
  acquiredDate?: Date
  notes?: string
}

interface MoxfieldCollection {
  cards: Record<string, {
    quantity: number
    card: {
      name: string
      set: string
      cn: string
      foil: boolean
    }
  }>
}

interface ArchidektCollection {
  cards: Array<{
    card: {
      name: string
      edition: string
    }
    quantity: number
    modifier?: string
  }>
}

export class CollectionImportService {
  /**
   * Import collection from external platform
   */
  async importCollection(
    userId: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    try {
      const validatedOptions = ImportOptionsSchema.parse(options)
      
      let collectionData: CollectionCard[]
      
      switch (validatedOptions.platform) {
        case 'moxfield':
          collectionData = await this.importFromMoxfield(validatedOptions)
          break
        case 'archidekt':
          collectionData = await this.importFromArchidekt(validatedOptions)
          break
        case 'edhrec':
          collectionData = await this.importFromEDHREC(validatedOptions)
          break
        case 'tappedout':
          collectionData = await this.importFromTappedOut(validatedOptions)
          break
        case 'csv':
          collectionData = await this.importFromCSV(validatedOptions)
          break
        default:
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Unsupported import platform: ${validatedOptions.platform}`,
          })
      }

      // Process and validate the imported data
      const result = await this.processImportedData(
        userId,
        collectionData,
        validatedOptions
      )

      return result
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to import collection',
        cause: error,
      })
    }
  }

  /**
   * Import from Moxfield
   */
  private async importFromMoxfield(options: ImportOptions): Promise<CollectionCard[]> {
    let data: string
    
    if (options.url) {
      // Extract collection ID from URL and fetch via API
      const collectionId = this.extractMoxfieldCollectionId(options.url)
      data = await this.fetchMoxfieldCollection(collectionId)
    } else if (options.data) {
      data = options.data
    } else {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Either URL or data must be provided for Moxfield import',
      })
    }

    const moxfieldData: MoxfieldCollection = JSON.parse(data)
    const collectionCards: CollectionCard[] = []

    for (const [cardId, cardData] of Object.entries(moxfieldData.cards)) {
      collectionCards.push({
        cardId: cardId,
        name: cardData.card.name,
        quantity: cardData.quantity,
        set: cardData.card.set,
        collectorNumber: cardData.card.cn,
        foil: cardData.card.foil,
      })
    }

    return collectionCards
  }

  /**
   * Import from Archidekt
   */
  private async importFromArchidekt(options: ImportOptions): Promise<CollectionCard[]> {
    let data: string
    
    if (options.url) {
      const deckId = this.extractArchidektDeckId(options.url)
      data = await this.fetchArchidektDeck(deckId)
    } else if (options.data) {
      data = options.data
    } else {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Either URL or data must be provided for Archidekt import',
      })
    }

    const archidektData: ArchidektCollection = JSON.parse(data)
    const collectionCards: CollectionCard[] = []

    for (const cardData of archidektData.cards) {
      collectionCards.push({
        cardId: nanoid(), // Generate temporary ID
        name: cardData.card.name,
        quantity: cardData.quantity,
        set: cardData.card.edition,
        foil: cardData.modifier === 'foil',
      })
    }

    return collectionCards
  }

  /**
   * Import from EDHREC
   */
  private async importFromEDHREC(options: ImportOptions): Promise<CollectionCard[]> {
    // EDHREC doesn't have a direct collection API, so we parse deck lists
    if (!options.url) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'URL is required for EDHREC import',
      })
    }

    const deckData = await this.fetchEDHRECDeck(options.url)
    return this.parseTextDeckList(deckData)
  }

  /**
   * Import from TappedOut
   */
  private async importFromTappedOut(options: ImportOptions): Promise<CollectionCard[]> {
    if (!options.url) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'URL is required for TappedOut import',
      })
    }

    const deckData = await this.fetchTappedOutDeck(options.url)
    return this.parseTextDeckList(deckData)
  }

  /**
   * Import from CSV
   */
  private async importFromCSV(options: ImportOptions): Promise<CollectionCard[]> {
    if (!options.data) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'CSV data is required for CSV import',
      })
    }

    return this.parseCSVData(options.data)
  }

  /**
   * Process imported data and save to database
   */
  private async processImportedData(
    userId: string,
    collectionData: CollectionCard[],
    options: ImportOptions
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      totalProcessed: collectionData.length,
      collectionId: nanoid(),
      errors: [],
      warnings: [],
      summary: {
        newCards: 0,
        updatedCards: 0,
        duplicates: 0,
        invalidCards: 0,
      },
    }

    // Get or create user collection
    let collection = await prisma.userCollection.findFirst({
      where: { userId },
    })

    if (!collection) {
      collection = await prisma.userCollection.create({
        data: {
          id: result.collectionId,
          userId,
          name: 'My Collection',
          description: `Imported from ${options.platform}`,
        },
      })
    } else {
      result.collectionId = collection.id
    }

    // Process each card
    for (let i = 0; i < collectionData.length; i++) {
      const cardData = collectionData[i]
      
      try {
        // Validate and find card in database
        const card = await this.findCardByName(cardData.name, cardData.set)
        
        if (!card) {
          if (options.validateCards) {
            result.errors.push({
              cardName: cardData.name,
              error: 'Card not found in database',
              line: i + 1,
            })
            result.errorCount++
            result.summary.invalidCards++
            continue
          } else {
            result.warnings.push({
              cardName: cardData.name,
              warning: 'Card not found in database, skipping validation',
              line: i + 1,
            })
          }
        }

        // Check if card already exists in collection
        const existingCard = await prisma.collectionCard.findFirst({
          where: {
            collectionId: collection.id,
            cardId: card?.id || cardData.cardId,
          },
        })

        if (existingCard) {
          if (options.mergeWithExisting) {
            // Update quantity
            await prisma.collectionCard.update({
              where: { id: existingCard.id },
              data: {
                quantity: existingCard.quantity + cardData.quantity,
                updatedAt: new Date(),
              },
            })
            result.summary.updatedCards++
          } else {
            result.summary.duplicates++
            result.skippedCount++
            continue
          }
        } else {
          // Add new card to collection
          await prisma.collectionCard.create({
            data: {
              id: nanoid(),
              collectionId: collection.id,
              cardId: card?.id || cardData.cardId,
              name: cardData.name,
              quantity: cardData.quantity,
              condition: cardData.condition || 'near_mint',
              foil: cardData.foil || false,
              language: cardData.language || 'en',
              set: cardData.set,
              collectorNumber: cardData.collectorNumber,
              price: cardData.price,
              acquiredDate: cardData.acquiredDate || new Date(),
              notes: cardData.notes,
            },
          })
          result.summary.newCards++
        }

        result.importedCount++
      } catch (error) {
        result.errors.push({
          cardName: cardData.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          line: i + 1,
        })
        result.errorCount++
      }
    }

    // Update collection metadata
    await prisma.userCollection.update({
      where: { id: collection.id },
      data: {
        cardCount: await prisma.collectionCard.count({
          where: { collectionId: collection.id },
        }),
        lastImportAt: new Date(),
        updatedAt: new Date(),
      },
    })

    result.success = result.errorCount < result.totalProcessed / 2 // Success if less than 50% errors

    return result
  }

  /**
   * Find card by name and optionally set
   */
  private async findCardByName(name: string, set?: string): Promise<Card | null> {
    const whereClause: any = {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    }

    if (set) {
      whereClause.set = {
        equals: set,
        mode: 'insensitive',
      }
    }

    return await prisma.card.findFirst({
      where: whereClause,
    })
  }

  /**
   * Parse text-based deck list
   */
  private parseTextDeckList(deckText: string): CollectionCard[] {
    const lines = deckText.split('\n')
    const cards: CollectionCard[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (!line || line.startsWith('//') || line.startsWith('#')) {
        continue // Skip empty lines and comments
      }

      // Parse format: "4 Lightning Bolt" or "1x Lightning Bolt"
      const match = line.match(/^(\d+)x?\s+(.+)$/i)
      
      if (match) {
        const quantity = parseInt(match[1])
        const cardName = match[2].trim()
        
        cards.push({
          cardId: nanoid(),
          name: cardName,
          quantity,
        })
      }
    }

    return cards
  }

  /**
   * Parse CSV data
   */
  private parseCSVData(csvData: string): CollectionCard[] {
    const lines = csvData.split('\n')
    const cards: CollectionCard[] = []
    
    if (lines.length < 2) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'CSV must have at least a header row and one data row',
      })
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    
    // Find required columns
    const nameIndex = headers.findIndex(h => h.includes('name') || h.includes('card'))
    const quantityIndex = headers.findIndex(h => h.includes('quantity') || h.includes('count'))
    
    if (nameIndex === -1) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'CSV must have a name/card column',
      })
    }

    // Optional columns
    const setIndex = headers.findIndex(h => h.includes('set') || h.includes('edition'))
    const foilIndex = headers.findIndex(h => h.includes('foil'))
    const conditionIndex = headers.findIndex(h => h.includes('condition'))
    const priceIndex = headers.findIndex(h => h.includes('price'))

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      
      if (values.length < headers.length) {
        continue // Skip incomplete rows
      }

      const cardName = values[nameIndex]
      const quantity = quantityIndex !== -1 ? parseInt(values[quantityIndex]) || 1 : 1
      
      if (!cardName) {
        continue
      }

      cards.push({
        cardId: nanoid(),
        name: cardName,
        quantity,
        set: setIndex !== -1 ? values[setIndex] : undefined,
        foil: foilIndex !== -1 ? values[foilIndex].toLowerCase() === 'true' : false,
        condition: conditionIndex !== -1 ? values[conditionIndex] : undefined,
        price: priceIndex !== -1 ? parseFloat(values[priceIndex]) || undefined : undefined,
      })
    }

    return cards
  }

  /**
   * Extract Moxfield collection ID from URL
   */
  private extractMoxfieldCollectionId(url: string): string {
    const match = url.match(/moxfield\.com\/collections\/([^\/\?]+)/i)
    if (!match) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid Moxfield collection URL',
      })
    }
    return match[1]
  }

  /**
   * Extract Archidekt deck ID from URL
   */
  private extractArchidektDeckId(url: string): string {
    const match = url.match(/archidekt\.com\/decks\/(\d+)/i)
    if (!match) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid Archidekt deck URL',
      })
    }
    return match[1]
  }

  /**
   * Fetch Moxfield collection data
   */
  private async fetchMoxfieldCollection(collectionId: string): Promise<string> {
    try {
      const response = await fetch(`https://api.moxfield.com/v2/collections/${collectionId}`)
      
      if (!response.ok) {
        throw new Error(`Moxfield API error: ${response.status}`)
      }
      
      return await response.text()
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch Moxfield collection',
        cause: error,
      })
    }
  }

  /**
   * Fetch Archidekt deck data
   */
  private async fetchArchidektDeck(deckId: string): Promise<string> {
    try {
      const response = await fetch(`https://archidekt.com/api/decks/${deckId}/`)
      
      if (!response.ok) {
        throw new Error(`Archidekt API error: ${response.status}`)
      }
      
      return await response.text()
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch Archidekt deck',
        cause: error,
      })
    }
  }

  /**
   * Fetch EDHREC deck data
   */
  private async fetchEDHRECDeck(url: string): Promise<string> {
    try {
      // EDHREC doesn't have a public API, so we'd need to scrape
      // For now, throw an error suggesting manual export
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'EDHREC import requires manual deck list export. Please copy the deck list and use text import.',
      })
    } catch (error) {
      throw error
    }
  }

  /**
   * Fetch TappedOut deck data
   */
  private async fetchTappedOutDeck(url: string): Promise<string> {
    try {
      // TappedOut has limited API access, suggest manual export
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'TappedOut import requires manual deck list export. Please copy the deck list and use text import.',
      })
    } catch (error) {
      throw error
    }
  }

  /**
   * Get supported import platforms
   */
  getSupportedPlatforms(): ImportPlatform[] {
    return ['moxfield', 'archidekt', 'edhrec', 'tappedout', 'csv']
  }

  /**
   * Validate import options
   */
  validateImportOptions(options: unknown): ImportOptions {
    return ImportOptionsSchema.parse(options)
  }

  /**
   * Get import template for CSV
   */
  getCSVTemplate(): string {
    return 'Name,Quantity,Set,Foil,Condition,Price,Notes\n' +
           'Lightning Bolt,4,M11,false,near_mint,0.50,Great card\n' +
           'Sol Ring,1,C21,true,mint,2.00,Foil version'
  }
}

export const collectionImportService = new CollectionImportService()
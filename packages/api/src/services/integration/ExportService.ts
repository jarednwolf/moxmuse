import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import type { GeneratedDeck } from '@moxmuse/shared'
import type { ExportOptions } from '@moxmuse/shared/src/export-format-types'

// Export format schemas
const ExportFormatSchema = z.enum(['moxfield', 'archidekt', 'text', 'json'])
type ExportFormat = z.infer<typeof ExportFormatSchema>

const ExportOptionsSchema = z.object({
  format: ExportFormatSchema,
  includeMetadata: z.boolean().default(true),
  includePrices: z.boolean().default(false),
  includeAnalysis: z.boolean().default(false),
  customFields: z.record(z.string()).optional(),
})

type ExportOptions = z.infer<typeof ExportOptionsSchema>

interface ExportResult {
  format: ExportFormat
  data: string
  filename: string
  mimeType: string
  metadata?: Record<string, any>
}

interface MoxfieldExport {
  name: string
  description: string
  format: string
  visibility: string
  mainboard: Record<string, { quantity: number; card: MoxfieldCard }>
  commanders: Record<string, { quantity: number; card: MoxfieldCard }>
  sideboard?: Record<string, { quantity: number; card: MoxfieldCard }>
}

interface MoxfieldCard {
  name: string
  set: string
  cn: string
  foil: boolean
  etched: boolean
}

interface ArchidektExport {
  name: string
  description: string
  format: number // Format ID in Archidekt
  cards: ArchidektCard[]
  categories: ArchidektCategory[]
}

interface ArchidektCard {
  card: {
    name: string
    edition: string
  }
  quantity: number
  categories: string[]
  modifier?: string
}

interface ArchidektCategory {
  name: string
  includedInDeck: boolean
  includedInPrice: boolean
  isPremier: boolean
}

export class ExportService {
  /**
   * Export a deck to the specified format
   */
  async exportDeck(
    deck: GeneratedDeck,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const validatedOptions = ExportOptionsSchema.parse(options)
      
      switch (validatedOptions.format) {
        case 'moxfield':
          return await this.exportToMoxfield(deck, validatedOptions)
        case 'archidekt':
          return await this.exportToArchidekt(deck, validatedOptions)
        case 'text':
          return await this.exportToText(deck, validatedOptions)
        case 'json':
          return await this.exportToJson(deck, validatedOptions)
        default:
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Unsupported export format: ${validatedOptions.format}`,
          })
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to export deck',
        cause: error,
      })
    }
  }

  /**
   * Export deck to Moxfield format
   */
  private async exportToMoxfield(
    deck: GeneratedDeck,
    options: ExportOptions
  ): Promise<ExportResult> {
    const moxfieldData: MoxfieldExport = {
      name: deck.name,
      description: this.generateDeckDescription(deck, options),
      format: 'commander',
      visibility: 'public',
      mainboard: {},
      commanders: {},
    }

    // Add commander
    if (deck.commander) {
      const commanderCard = deck.cards.find(c => c.name === deck.commander)
      if (commanderCard) {
        moxfieldData.commanders[commanderCard.id] = {
          quantity: 1,
          card: this.convertToMoxfieldCard(commanderCard),
        }
      }
    }

    // Add mainboard cards (excluding commander)
    deck.cards
      .filter(card => card.name !== deck.commander)
      .forEach(card => {
        moxfieldData.mainboard[card.id] = {
          quantity: card.quantity || 1,
          card: this.convertToMoxfieldCard(card),
        }
      })

    const exportData = JSON.stringify(moxfieldData, null, 2)
    
    return {
      format: 'moxfield',
      data: exportData,
      filename: `${this.sanitizeFilename(deck.name)}_moxfield.json`,
      mimeType: 'application/json',
      metadata: options.includeMetadata ? this.extractMetadata(deck) : undefined,
    }
  }

  /**
   * Export deck to Archidekt format
   */
  private async exportToArchidekt(
    deck: GeneratedDeck,
    options: ExportOptions
  ): Promise<ExportResult> {
    const categories: ArchidektCategory[] = [
      { name: 'Commander', includedInDeck: true, includedInPrice: true, isPremier: true },
      { name: 'Creatures', includedInDeck: true, includedInPrice: true, isPremier: false },
      { name: 'Instants', includedInDeck: true, includedInPrice: true, isPremier: false },
      { name: 'Sorceries', includedInDeck: true, includedInPrice: true, isPremier: false },
      { name: 'Artifacts', includedInDeck: true, includedInPrice: true, isPremier: false },
      { name: 'Enchantments', includedInDeck: true, includedInPrice: true, isPremier: false },
      { name: 'Planeswalkers', includedInDeck: true, includedInPrice: true, isPremier: false },
      { name: 'Lands', includedInDeck: true, includedInPrice: true, isPremier: false },
    ]

    const archidektData: ArchidektExport = {
      name: deck.name,
      description: this.generateDeckDescription(deck, options),
      format: 6, // Commander format ID in Archidekt
      cards: deck.cards.map(card => this.convertToArchidektCard(card, deck.commander)),
      categories,
    }

    const exportData = JSON.stringify(archidektData, null, 2)
    
    return {
      format: 'archidekt',
      data: exportData,
      filename: `${this.sanitizeFilename(deck.name)}_archidekt.json`,
      mimeType: 'application/json',
      metadata: options.includeMetadata ? this.extractMetadata(deck) : undefined,
    }
  }

  /**
   * Export deck to plain text format
   */
  private async exportToText(
    deck: GeneratedDeck,
    options: ExportOptions
  ): Promise<ExportResult> {
    let textData = `${deck.name}\n`
    textData += `${'='.repeat(deck.name.length)}\n\n`

    if (options.includeMetadata) {
      textData += `Format: ${deck.format}\n`
      textData += `Strategy: ${deck.strategy?.name || 'Unknown'}\n`
      if (deck.estimatedBudget) {
        textData += `Estimated Budget: $${deck.estimatedBudget.toFixed(2)}\n`
      }
      if (deck.powerLevel) {
        textData += `Power Level: ${deck.powerLevel}/10\n`
      }
      textData += '\n'
    }

    // Commander section
    if (deck.commander) {
      textData += 'Commander:\n'
      textData += `1 ${deck.commander}\n\n`
    }

    // Group cards by type
    const cardsByType = this.groupCardsByType(deck.cards.filter(c => c.name !== deck.commander))
    
    for (const [type, cards] of Object.entries(cardsByType)) {
      if (cards.length > 0) {
        textData += `${type} (${cards.length}):\n`
        cards.forEach(card => {
          const quantity = card.quantity || 1
          textData += `${quantity} ${card.name}\n`
        })
        textData += '\n'
      }
    }

    if (options.includeAnalysis && deck.statistics) {
      textData += 'Deck Analysis:\n'
      textData += `Average CMC: ${deck.statistics.averageCmc?.toFixed(2) || 'N/A'}\n`
      textData += `Total Cards: ${deck.cards.length}\n`
      
      if (deck.statistics.colorDistribution) {
        textData += '\nColor Distribution:\n'
        Object.entries(deck.statistics.colorDistribution).forEach(([color, count]) => {
          textData += `${color}: ${count}\n`
        })
      }
      textData += '\n'
    }

    textData += `Generated by MoxMuse AI Deck Building Tutor\n`
    textData += `${new Date().toISOString()}\n`

    return {
      format: 'text',
      data: textData,
      filename: `${this.sanitizeFilename(deck.name)}.txt`,
      mimeType: 'text/plain',
      metadata: options.includeMetadata ? this.extractMetadata(deck) : undefined,
    }
  }

  /**
   * Export deck to JSON format
   */
  private async exportToJson(
    deck: GeneratedDeck,
    options: ExportOptions
  ): Promise<ExportResult> {
    const jsonData = {
      ...deck,
      exportedAt: new Date().toISOString(),
      exportOptions: options,
      metadata: options.includeMetadata ? this.extractMetadata(deck) : undefined,
    }

    const exportData = JSON.stringify(jsonData, null, 2)
    
    return {
      format: 'json',
      data: exportData,
      filename: `${this.sanitizeFilename(deck.name)}.json`,
      mimeType: 'application/json',
      metadata: options.includeMetadata ? this.extractMetadata(deck) : undefined,
    }
  }

  /**
   * Convert deck card to Moxfield format
   */
  private convertToMoxfieldCard(card: DeckCard): MoxfieldCard {
    return {
      name: card.name,
      set: card.set || 'unknown',
      cn: card.collectorNumber || '1',
      foil: false,
      etched: false,
    }
  }

  /**
   * Convert deck card to Archidekt format
   */
  private convertToArchidektCard(card: DeckCard, commander?: string): ArchidektCard {
    const categories = []
    
    if (card.name === commander) {
      categories.push('Commander')
    } else if (card.typeLine?.includes('Creature')) {
      categories.push('Creatures')
    } else if (card.typeLine?.includes('Instant')) {
      categories.push('Instants')
    } else if (card.typeLine?.includes('Sorcery')) {
      categories.push('Sorceries')
    } else if (card.typeLine?.includes('Artifact')) {
      categories.push('Artifacts')
    } else if (card.typeLine?.includes('Enchantment')) {
      categories.push('Enchantments')
    } else if (card.typeLine?.includes('Planeswalker')) {
      categories.push('Planeswalkers')
    } else if (card.typeLine?.includes('Land')) {
      categories.push('Lands')
    }

    return {
      card: {
        name: card.name,
        edition: card.set || 'unknown',
      },
      quantity: card.quantity || 1,
      categories,
    }
  }

  /**
   * Group cards by type for text export
   */
  private groupCardsByType(cards: DeckCard[]): Record<string, DeckCard[]> {
    const groups: Record<string, DeckCard[]> = {
      'Creatures': [],
      'Instants': [],
      'Sorceries': [],
      'Artifacts': [],
      'Enchantments': [],
      'Planeswalkers': [],
      'Lands': [],
      'Other': [],
    }

    cards.forEach(card => {
      const typeLine = card.typeLine || ''
      
      if (typeLine.includes('Creature')) {
        groups['Creatures'].push(card)
      } else if (typeLine.includes('Instant')) {
        groups['Instants'].push(card)
      } else if (typeLine.includes('Sorcery')) {
        groups['Sorceries'].push(card)
      } else if (typeLine.includes('Artifact')) {
        groups['Artifacts'].push(card)
      } else if (typeLine.includes('Enchantment')) {
        groups['Enchantments'].push(card)
      } else if (typeLine.includes('Planeswalker')) {
        groups['Planeswalkers'].push(card)
      } else if (typeLine.includes('Land')) {
        groups['Lands'].push(card)
      } else {
        groups['Other'].push(card)
      }
    })

    return groups
  }

  /**
   * Generate deck description for export
   */
  private generateDeckDescription(deck: GeneratedDeck, options: ExportOptions): string {
    let description = `Generated by MoxMuse AI Deck Building Tutor\n\n`
    
    if (deck.strategy?.description) {
      description += `Strategy: ${deck.strategy.description}\n\n`
    }

    if (deck.winConditions && deck.winConditions.length > 0) {
      description += `Win Conditions:\n`
      deck.winConditions.forEach(condition => {
        description += `- ${condition.name}: ${condition.description}\n`
      })
      description += '\n'
    }

    if (options.includeAnalysis && deck.qualityMetrics) {
      description += `Quality Score: ${(deck.qualityMetrics.overallScore * 100).toFixed(1)}%\n`
      description += `Synergy Score: ${(deck.qualityMetrics.synergyScore * 100).toFixed(1)}%\n`
    }

    description += `\nExported on ${new Date().toLocaleDateString()}`
    
    return description
  }

  /**
   * Extract metadata from deck
   */
  private extractMetadata(deck: GeneratedDeck): Record<string, any> {
    return {
      deckId: deck.id,
      userId: deck.userId,
      sessionId: deck.sessionId,
      format: deck.format,
      commander: deck.commander,
      strategy: deck.strategy?.name,
      powerLevel: deck.powerLevel,
      estimatedBudget: deck.estimatedBudget,
      cardCount: deck.cards.length,
      generatedAt: deck.createdAt,
      exportedAt: new Date().toISOString(),
    }
  }

  /**
   * Sanitize filename for safe file system usage
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase()
  }

  /**
   * Get supported export formats
   */
  getSupportedFormats(): ExportFormat[] {
    return ['moxfield', 'archidekt', 'text', 'json']
  }

  /**
   * Validate export options
   */
  validateExportOptions(options: unknown): ExportOptions {
    return ExportOptionsSchema.parse(options)
  }
}

export const exportService = new ExportService()
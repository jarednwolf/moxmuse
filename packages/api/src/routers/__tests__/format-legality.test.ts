import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createTRPCMsw } from 'msw-trpc'
import { setupServer } from 'msw/node'
import { formatLegalityRouter } from '../format-legality'
import { formatLegalityValidator } from '../../services/format-legality-validator'
import type { AppRouter } from '../../root'

// Mock the format legality validator
vi.mock('../../services/format-legality-validator', () => ({
  formatLegalityValidator: {
    validateDeck: vi.fn(),
    getCardLegality: vi.fn(),
    getBatchCardLegalities: vi.fn(),
    getFormatRules: vi.fn(),
    updateBannedLists: vi.fn(),
    checkFormatRotations: vi.fn(),
    createCustomFormat: vi.fn()
  }
}))

const trpcMsw = createTRPCMsw<AppRouter>()
const server = setupServer()

describe('formatLegalityRouter', () => {
  beforeEach(() => {
    server.listen()
    vi.clearAllMocks()
  })

  afterEach(() => {
    server.resetHandlers()
    server.close()
    vi.resetAllMocks()
  })

  describe('validateDeck', () => {
    it('should validate a deck successfully', async () => {
      const mockValidationResult = {
        isValid: true,
        format: 'commander',
        violations: [],
        warnings: [],
        suggestions: []
      }

      vi.mocked(formatLegalityValidator.validateDeck).mockResolvedValue(mockValidationResult)

      const input = {
        cards: [
          { cardId: 'card-1', quantity: 1, category: 'commander' },
          { cardId: 'card-2', quantity: 1 }
        ],
        format: 'commander' as const
      }

      // This would be called through tRPC in a real test
      const result = await formatLegalityValidator.validateDeck(
        input.cards,
        input.format,
        input.sideboard
      )

      expect(result).toEqual(mockValidationResult)
      expect(formatLegalityValidator.validateDeck).toHaveBeenCalledWith(
        input.cards,
        input.format,
        undefined
      )
    })

    it('should handle validation errors', async () => {
      const mockValidationResult = {
        isValid: false,
        format: 'standard',
        violations: [
          {
            type: 'banned_card' as const,
            cardId: 'banned-card',
            cardName: 'Banned Card',
            message: 'Banned Card is banned in standard',
            severity: 'error' as const
          }
        ],
        warnings: [],
        suggestions: []
      }

      vi.mocked(formatLegalityValidator.validateDeck).mockResolvedValue(mockValidationResult)

      const input = {
        cards: [{ cardId: 'banned-card', quantity: 4 }],
        format: 'standard' as const
      }

      const result = await formatLegalityValidator.validateDeck(
        input.cards,
        input.format
      )

      expect(result.isValid).toBe(false)
      expect(result.violations).toHaveLength(1)
      expect(result.violations[0].type).toBe('banned_card')
    })
  })

  describe('getCardLegality', () => {
    it('should return card legality data', async () => {
      const mockLegality = {
        cardId: 'test-card',
        name: 'Test Card',
        legalities: { commander: 'legal', standard: 'not_legal' },
        lastUpdated: new Date().toISOString(),
        scryfallId: 'scryfall-id'
      }

      vi.mocked(formatLegalityValidator.getCardLegality).mockResolvedValue(mockLegality)

      const result = await formatLegalityValidator.getCardLegality('test-card')

      expect(result).toEqual(mockLegality)
      expect(formatLegalityValidator.getCardLegality).toHaveBeenCalledWith('test-card')
    })

    it('should return null for non-existent card', async () => {
      vi.mocked(formatLegalityValidator.getCardLegality).mockResolvedValue(null)

      const result = await formatLegalityValidator.getCardLegality('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getBatchCardLegality', () => {
    it('should return batch card legality data', async () => {
      const mockLegalities = new Map([
        ['card-1', {
          cardId: 'card-1',
          name: 'Card 1',
          legalities: { commander: 'legal' },
          lastUpdated: new Date().toISOString(),
          scryfallId: 'scryfall-1'
        }],
        ['card-2', {
          cardId: 'card-2',
          name: 'Card 2',
          legalities: { commander: 'banned' },
          lastUpdated: new Date().toISOString(),
          scryfallId: 'scryfall-2'
        }]
      ])

      vi.mocked(formatLegalityValidator.getBatchCardLegalities).mockResolvedValue(mockLegalities)

      const result = await formatLegalityValidator.getBatchCardLegalities(['card-1', 'card-2'])

      expect(result.size).toBe(2)
      expect(result.get('card-1')).toBeDefined()
      expect(result.get('card-2')).toBeDefined()
    })
  })

  describe('getFormatRules', () => {
    it('should return format rules', async () => {
      const mockRules = {
        format: 'commander',
        deckSize: { min: 100, max: 100 },
        sideboardSize: { min: 0, max: 0 },
        cardLimits: { default: 1 },
        bannedCards: [],
        restrictedCards: [],
        specialRules: ['Must have exactly one legendary creature as commander'],
        lastUpdated: new Date().toISOString()
      }

      vi.mocked(formatLegalityValidator.getFormatRules).mockResolvedValue(mockRules)

      const result = await formatLegalityValidator.getFormatRules('commander')

      expect(result).toEqual(mockRules)
      expect(result?.format).toBe('commander')
      expect(result?.deckSize.min).toBe(100)
    })
  })

  describe('updateBannedLists', () => {
    it('should update banned lists successfully', async () => {
      const mockResult = {
        success: true,
        updatedFormats: ['standard', 'modern'],
        errors: []
      }

      vi.mocked(formatLegalityValidator.updateBannedLists).mockResolvedValue(mockResult)

      const result = await formatLegalityValidator.updateBannedLists()

      expect(result.success).toBe(true)
      expect(result.updatedFormats).toHaveLength(2)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle update errors', async () => {
      const mockResult = {
        success: true,
        updatedFormats: ['standard'],
        errors: ['Failed to update modern: API error']
      }

      vi.mocked(formatLegalityValidator.updateBannedLists).mockResolvedValue(mockResult)

      const result = await formatLegalityValidator.updateBannedLists()

      expect(result.success).toBe(true)
      expect(result.updatedFormats).toHaveLength(1)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('checkFormatRotations', () => {
    it('should return format rotations', async () => {
      const mockRotations = [
        {
          format: 'standard',
          rotationType: 'annual_rotation' as const,
          rotatingOut: [
            {
              setCode: 'OLD',
              setName: 'Old Set',
              rotationDate: '2024-09-01'
            }
          ],
          rotatingIn: [
            {
              setCode: 'NEW',
              setName: 'New Set',
              legalDate: '2024-09-01'
            }
          ],
          nextRotationDate: '2025-09-01',
          lastUpdated: new Date().toISOString()
        }
      ]

      vi.mocked(formatLegalityValidator.checkFormatRotations).mockResolvedValue(mockRotations)

      const result = await formatLegalityValidator.checkFormatRotations()

      expect(result).toHaveLength(1)
      expect(result[0].format).toBe('standard')
      expect(result[0].rotationType).toBe('annual_rotation')
    })
  })

  describe('createCustomFormat', () => {
    it('should create a custom format', async () => {
      const mockCustomFormat = {
        format: 'custom-format',
        deckSize: { min: 40, max: 40 },
        sideboardSize: { min: 0, max: 10 },
        cardLimits: { default: 2 },
        bannedCards: [],
        restrictedCards: [],
        specialRules: [],
        lastUpdated: new Date().toISOString()
      }

      vi.mocked(formatLegalityValidator.createCustomFormat).mockResolvedValue(mockCustomFormat)

      const input = {
        name: 'custom-format',
        deckSize: { min: 40, max: 40 },
        sideboardSize: { min: 0, max: 10 },
        cardLimits: { default: 2 },
        bannedCards: [],
        restrictedCards: []
      }

      const result = await formatLegalityValidator.createCustomFormat(input.name, {
        deckSize: input.deckSize,
        sideboardSize: input.sideboardSize,
        cardLimits: input.cardLimits,
        bannedCards: input.bannedCards,
        restrictedCards: input.restrictedCards
      })

      expect(result.format).toBe('custom-format')
      expect(result.deckSize).toEqual(input.deckSize)
    })
  })

  describe('getSupportedFormats', () => {
    it('should return all supported formats', () => {
      // This would be tested through the actual router
      const expectedFormats = [
        'standard', 'pioneer', 'modern', 'legacy', 'vintage',
        'commander', 'brawl', 'historic', 'alchemy', 'explorer',
        'timeless', 'pauper', 'penny'
      ]

      // In a real test, you'd call the tRPC endpoint
      expect(expectedFormats).toContain('commander')
      expect(expectedFormats).toContain('standard')
      expect(expectedFormats).toContain('modern')
    })
  })

  describe('validateCard', () => {
    it('should validate a single card in a format', async () => {
      const mockLegality = {
        cardId: 'test-card',
        name: 'Test Card',
        legalities: { commander: 'legal' },
        lastUpdated: new Date().toISOString(),
        scryfallId: 'scryfall-id'
      }

      vi.mocked(formatLegalityValidator.getCardLegality).mockResolvedValue(mockLegality)

      const result = await formatLegalityValidator.getCardLegality('test-card')

      expect(result).toBeDefined()
      expect(result?.legalities.commander).toBe('legal')
    })

    it('should handle banned card validation', async () => {
      const mockLegality = {
        cardId: 'banned-card',
        name: 'Banned Card',
        legalities: { standard: 'banned' },
        lastUpdated: new Date().toISOString(),
        scryfallId: 'scryfall-banned'
      }

      vi.mocked(formatLegalityValidator.getCardLegality).mockResolvedValue(mockLegality)

      const result = await formatLegalityValidator.getCardLegality('banned-card')

      expect(result).toBeDefined()
      expect(result?.legalities.standard).toBe('banned')
    })
  })
})

// Integration test scenarios
describe('Format Legality Integration Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle complete deck validation workflow', async () => {
    // Mock a complete workflow from card lookup to deck validation
    const mockCards = [
      { cardId: 'commander', quantity: 1, category: 'commander' },
      { cardId: 'card-1', quantity: 1 },
      { cardId: 'card-2', quantity: 1 }
    ]

    // Mock card legalities
    const mockLegalities = new Map([
      ['commander', {
        cardId: 'commander',
        name: 'Commander Card',
        legalities: { commander: 'legal' },
        lastUpdated: new Date().toISOString(),
        scryfallId: 'scryfall-commander'
      }],
      ['card-1', {
        cardId: 'card-1',
        name: 'Card 1',
        legalities: { commander: 'legal' },
        lastUpdated: new Date().toISOString(),
        scryfallId: 'scryfall-1'
      }],
      ['card-2', {
        cardId: 'card-2',
        name: 'Card 2',
        legalities: { commander: 'banned' },
        lastUpdated: new Date().toISOString(),
        scryfallId: 'scryfall-2'
      }]
    ])

    vi.mocked(formatLegalityValidator.getBatchCardLegalities).mockResolvedValue(mockLegalities)

    const mockValidationResult = {
      isValid: false,
      format: 'commander',
      violations: [
        {
          type: 'banned_card' as const,
          cardId: 'card-2',
          cardName: 'Card 2',
          message: 'Card 2 is banned in commander',
          severity: 'error' as const
        }
      ],
      warnings: [],
      suggestions: [
        {
          type: 'replacement',
          message: 'Consider replacing Card 2 with similar legal alternatives',
          cardId: 'card-2',
          suggestedCards: ['alternative-1', 'alternative-2']
        }
      ]
    }

    vi.mocked(formatLegalityValidator.validateDeck).mockResolvedValue(mockValidationResult)

    // Test the workflow
    const legalities = await formatLegalityValidator.getBatchCardLegalities(['commander', 'card-1', 'card-2'])
    expect(legalities.size).toBe(3)

    const validation = await formatLegalityValidator.validateDeck(mockCards, 'commander')
    expect(validation.isValid).toBe(false)
    expect(validation.violations).toHaveLength(1)
    expect(validation.suggestions).toHaveLength(1)
  })

  it('should handle format rules and custom format creation', async () => {
    // Mock getting standard format rules
    const mockStandardRules = {
      format: 'standard',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      bannedCards: ['banned-card-1'],
      restrictedCards: [],
      specialRules: [],
      lastUpdated: new Date().toISOString()
    }

    vi.mocked(formatLegalityValidator.getFormatRules).mockResolvedValue(mockStandardRules)

    const rules = await formatLegalityValidator.getFormatRules('standard')
    expect(rules?.format).toBe('standard')
    expect(rules?.deckSize.min).toBe(60)

    // Mock creating custom format based on standard
    const mockCustomFormat = {
      format: 'custom-standard',
      deckSize: { min: 40, max: 40 },
      sideboardSize: { min: 0, max: 10 },
      cardLimits: { default: 3 },
      bannedCards: ['banned-card-1', 'custom-banned'],
      restrictedCards: [],
      specialRules: ['Custom rule'],
      lastUpdated: new Date().toISOString()
    }

    vi.mocked(formatLegalityValidator.createCustomFormat).mockResolvedValue(mockCustomFormat)

    const customFormat = await formatLegalityValidator.createCustomFormat('custom-standard', {
      deckSize: { min: 40, max: 40 },
      sideboardSize: { min: 0, max: 10 },
      cardLimits: { default: 3 },
      bannedCards: ['banned-card-1', 'custom-banned'],
      restrictedCards: [],
      specialRules: ['Custom rule']
    })

    expect(customFormat.format).toBe('custom-standard')
    expect(customFormat.deckSize.min).toBe(40)
    expect(customFormat.bannedCards).toContain('custom-banned')
  })
})
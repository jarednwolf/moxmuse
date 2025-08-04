import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { formatLegalityValidator, FormatLegalityValidator } from '../format-legality-validator'
import { redisCache } from '../redis'
import { scryfallRateLimiter } from '../../utils/rateLimiter'
import axios from 'axios'

// Mock dependencies
vi.mock('../redis', () => ({
  redisCache: {
    get: vi.fn(),
    set: vi.fn()
  }
}))

vi.mock('../../utils/rateLimiter', () => ({
  scryfallRateLimiter: {
    limit: vi.fn()
  }
}))

vi.mock('axios')
const mockedAxios = vi.mocked(axios)

vi.mock('../core/performance-monitor', () => ({
  performanceMonitor: {
    startTimer: vi.fn(() => ({
      end: vi.fn()
    }))
  }
}))

vi.mock('../core/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@moxmuse/db', () => ({
  db: {
    enhancedCardData: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn()
    }
  }
}))

describe('FormatLegalityValidator', () => {
  let validator: FormatLegalityValidator

  beforeEach(() => {
    validator = FormatLegalityValidator.getInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getCardLegality', () => {
    it('should return cached card legality data', async () => {
      const mockLegality = {
        cardId: 'test-card-id',
        name: 'Test Card',
        legalities: { commander: 'legal', standard: 'not_legal' },
        lastUpdated: new Date().toISOString(),
        scryfallId: 'scryfall-id'
      }

      vi.mocked(redisCache.get).mockResolvedValue(mockLegality)

      const result = await validator.getCardLegality('test-card-id')

      expect(result).toEqual(mockLegality)
      expect(redisCache.get).toHaveBeenCalledWith('card_legality:test-card-id')
    })

    it('should fetch from Scryfall when not cached', async () => {
      const mockScryfallResponse = {
        data: {
          id: 'scryfall-id',
          name: 'Test Card',
          legalities: { commander: 'legal', standard: 'not_legal' }
        }
      }

      vi.mocked(redisCache.get).mockResolvedValue(null)
      vi.mocked(scryfallRateLimiter.limit).mockResolvedValue(mockScryfallResponse)

      const result = await validator.getCardLegality('test-card-id')

      expect(result).toMatchObject({
        cardId: 'test-card-id',
        name: 'Test Card',
        legalities: { commander: 'legal', standard: 'not_legal' },
        scryfallId: 'scryfall-id'
      })
      expect(redisCache.set).toHaveBeenCalled()
    })

    it('should return null for invalid card ID', async () => {
      const result = await validator.getCardLegality('invalid-id')
      expect(result).toBeNull()
    })
  })

  describe('validateDeck', () => {
    it('should validate a legal Commander deck', async () => {
      const mockCards = [
        { cardId: 'commander-id', quantity: 1, category: 'commander' },
        { cardId: 'card-1', quantity: 1 },
        { cardId: 'card-2', quantity: 1 }
      ]

      // Mock 100 cards total for Commander
      const fullDeck = [
        ...mockCards,
        ...Array.from({ length: 97 }, (_, i) => ({
          cardId: `card-${i + 3}`,
          quantity: 1
        }))
      ]

      // Mock card legality responses
      vi.mocked(redisCache.get).mockImplementation((key: string) => {
        if (key.startsWith('card_legality:')) {
          return Promise.resolve({
            cardId: key.split(':')[1],
            name: `Card ${key.split(':')[1]}`,
            legalities: { commander: 'legal' },
            lastUpdated: new Date().toISOString(),
            scryfallId: `scryfall-${key.split(':')[1]}`
          })
        }
        return Promise.resolve(null)
      })

      const result = await validator.validateDeck(fullDeck, 'commander')

      expect(result.isValid).toBe(true)
      expect(result.format).toBe('commander')
      expect(result.violations).toHaveLength(0)
    })

    it('should detect banned cards', async () => {
      // Create a deck with 60 cards (minimum for standard) including the banned card
      const mockCards = [
        { cardId: 'banned-card', quantity: 1 },
        ...Array.from({ length: 59 }, (_, i) => ({
          cardId: `legal-card-${i}`,
          quantity: 1
        }))
      ]

      vi.mocked(redisCache.get).mockImplementation((key: string) => {
        if (key.startsWith('card_legality:banned-card')) {
          return Promise.resolve({
            cardId: 'banned-card',
            name: 'Banned Card',
            legalities: { standard: 'banned' },
            lastUpdated: new Date().toISOString(),
            scryfallId: 'scryfall-banned'
          })
        } else if (key.startsWith('card_legality:legal-card')) {
          return Promise.resolve({
            cardId: key.split(':')[1],
            name: `Legal Card ${key.split(':')[1]}`,
            legalities: { standard: 'legal' },
            lastUpdated: new Date().toISOString(),
            scryfallId: `scryfall-${key.split(':')[1]}`
          })
        }
        return Promise.resolve(null)
      })

      const result = await validator.validateDeck(mockCards, 'standard')

      expect(result.isValid).toBe(false)
      expect(result.violations.some(v => v.type === 'banned_card')).toBe(true)
      const bannedViolation = result.violations.find(v => v.type === 'banned_card')
      expect(bannedViolation?.cardName).toBe('Banned Card')
    })

    it('should detect deck size violations', async () => {
      const mockCards = [
        { cardId: 'card-1', quantity: 1 }
      ] // Only 1 card, should be invalid for most formats

      vi.mocked(redisCache.get).mockImplementation((key: string) => {
        if (key.startsWith('card_legality:')) {
          return Promise.resolve({
            cardId: key.split(':')[1],
            name: `Card ${key.split(':')[1]}`,
            legalities: { standard: 'legal' },
            lastUpdated: new Date().toISOString(),
            scryfallId: `scryfall-${key.split(':')[1]}`
          })
        }
        return Promise.resolve(null)
      })

      const result = await validator.validateDeck(mockCards, 'standard')

      expect(result.isValid).toBe(false)
      expect(result.violations.some(v => v.type === 'deck_size')).toBe(true)
    })

    it('should detect restricted card violations', async () => {
      const mockCards = [
        { cardId: 'restricted-card', quantity: 4 } // Too many copies of restricted card
      ]

      vi.mocked(redisCache.get).mockImplementation((key: string) => {
        if (key.startsWith('card_legality:restricted-card')) {
          return Promise.resolve({
            cardId: 'restricted-card',
            name: 'Restricted Card',
            legalities: { vintage: 'restricted' },
            lastUpdated: new Date().toISOString(),
            scryfallId: 'scryfall-restricted'
          })
        }
        return Promise.resolve(null)
      })

      const result = await validator.validateDeck(mockCards, 'vintage')

      expect(result.isValid).toBe(false)
      expect(result.violations.some(v => v.type === 'restricted_card')).toBe(true)
    })
  })

  describe('getBatchCardLegalities', () => {
    it('should fetch multiple card legalities efficiently', async () => {
      const cardIds = ['card-1', 'card-2', 'card-3']
      
      vi.mocked(redisCache.get).mockImplementation((key: string) => {
        const cardId = key.split(':')[1]
        return Promise.resolve({
          cardId,
          name: `Card ${cardId}`,
          legalities: { commander: 'legal' },
          lastUpdated: new Date().toISOString(),
          scryfallId: `scryfall-${cardId}`
        })
      })

      const result = await validator.getBatchCardLegalities(cardIds)

      expect(result.size).toBe(3)
      expect(result.get('card-1')).toBeDefined()
      expect(result.get('card-2')).toBeDefined()
      expect(result.get('card-3')).toBeDefined()
    })
  })

  describe('getFormatRules', () => {
    it('should return Commander format rules', async () => {
      const rules = await validator.getFormatRules('commander')

      expect(rules).toBeDefined()
      expect(rules?.format).toBe('commander')
      expect(rules?.deckSize.min).toBe(100)
      expect(rules?.deckSize.max).toBe(100)
      expect(rules?.cardLimits.default).toBe(1)
    })

    it('should return Standard format rules', async () => {
      const rules = await validator.getFormatRules('standard')

      expect(rules).toBeDefined()
      expect(rules?.format).toBe('standard')
      expect(rules?.deckSize.min).toBe(60)
      expect(rules?.deckSize.max).toBe(60)
      expect(rules?.cardLimits.default).toBe(4)
    })
  })

  describe('createCustomFormat', () => {
    it('should create a custom format with validation rules', async () => {
      const customRules = {
        deckSize: { min: 40, max: 40 },
        sideboardSize: { min: 0, max: 10 },
        cardLimits: { default: 2 },
        bannedCards: ['banned-card-1'],
        restrictedCards: ['restricted-card-1'],
        specialRules: ['Custom rule 1']
      }

      const result = await validator.createCustomFormat('test-format', customRules)

      expect(result.format).toBe('test-format')
      expect(result.deckSize).toEqual(customRules.deckSize)
      expect(result.cardLimits).toEqual(customRules.cardLimits)
      expect(result.bannedCards).toEqual(customRules.bannedCards)
    })
  })

  describe('updateBannedLists', () => {
    it('should update banned lists for all formats', async () => {
      const result = await validator.updateBannedLists()

      expect(result.success).toBe(true)
      expect(Array.isArray(result.updatedFormats)).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
    })
  })

  describe('checkFormatRotations', () => {
    it('should check for format rotations', async () => {
      const rotations = await validator.checkFormatRotations()

      expect(Array.isArray(rotations)).toBe(true)
    })
  })
})

// Integration tests
describe('FormatLegalityValidator Integration', () => {
  it('should validate a complete Commander deck workflow', async () => {
    const validator = FormatLegalityValidator.getInstance()

    // Mock a complete Commander deck
    const commanderDeck = [
      { cardId: 'commander', quantity: 1, category: 'commander' },
      ...Array.from({ length: 99 }, (_, i) => ({
        cardId: `card-${i + 1}`,
        quantity: 1
      }))
    ]

    // Mock all cards as legal
    vi.mocked(redisCache.get).mockImplementation((key: string) => {
      if (key.startsWith('card_legality:')) {
        const cardId = key.split(':')[1]
        return Promise.resolve({
          cardId,
          name: `Card ${cardId}`,
          legalities: { commander: 'legal' },
          lastUpdated: new Date().toISOString(),
          scryfallId: `scryfall-${cardId}`
        })
      }
      return Promise.resolve(null)
    })

    const result = await validator.validateDeck(commanderDeck, 'commander')

    expect(result.isValid).toBe(true)
    expect(result.format).toBe('commander')
    expect(result.violations.filter(v => v.severity === 'error')).toHaveLength(0)
  })

  it('should handle mixed legality scenarios', async () => {
    const validator = FormatLegalityValidator.getInstance()

    const mixedDeck = [
      { cardId: 'legal-card', quantity: 4 },
      { cardId: 'banned-card', quantity: 1 },
      { cardId: 'restricted-card', quantity: 2 }
    ]

    vi.mocked(redisCache.get).mockImplementation((key: string) => {
      const cardId = key.split(':')[1]
      let legalities = {}
      
      if (cardId === 'legal-card') {
        legalities = { standard: 'legal' }
      } else if (cardId === 'banned-card') {
        legalities = { standard: 'banned' }
      } else if (cardId === 'restricted-card') {
        legalities = { standard: 'restricted' }
      }

      return Promise.resolve({
        cardId,
        name: `Card ${cardId}`,
        legalities,
        lastUpdated: new Date().toISOString(),
        scryfallId: `scryfall-${cardId}`
      })
    })

    const result = await validator.validateDeck(mixedDeck, 'standard')

    expect(result.isValid).toBe(false)
    expect(result.violations.some(v => v.type === 'banned_card')).toBe(true)
    expect(result.violations.some(v => v.type === 'restricted_card')).toBe(true)
  })
})
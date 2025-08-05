import { z } from 'zod'

// Supported formats
export const SUPPORTED_FORMATS = [
  'standard',
  'pioneer',
  'modern',
  'legacy',
  'vintage',
  'commander',
  'brawl',
  'historic',
  'alchemy',
  'explorer',
  'timeless',
  'pauper',
  'penny'
] as const

export type SupportedFormat = typeof SUPPORTED_FORMATS[number]

// Legality status types
export type LegalityStatus = 'legal' | 'not_legal' | 'banned' | 'restricted'

// Format legality data schema
export const FormatLegalitySchema = z.object({
  format: z.enum(SUPPORTED_FORMATS),
  status: z.enum(['legal', 'not_legal', 'banned', 'restricted']),
  lastUpdated: z.string(),
  source: z.string().default('scryfall')
})

export type FormatLegality = z.infer<typeof FormatLegalitySchema>

// Card legality data schema
export const CardLegalityDataSchema = z.object({
  cardId: z.string(),
  name: z.string(),
  legalities: z.record(z.string(), z.enum(['legal', 'not_legal', 'banned', 'restricted'])),
  lastUpdated: z.string(),
  scryfallId: z.string()
})

export type CardLegalityData = z.infer<typeof CardLegalityDataSchema>

// Deck validation violation schema
export const DeckViolationSchema = z.object({
  type: z.enum(['banned_card', 'restricted_card', 'illegal_card', 'deck_size', 'sideboard_size', 'card_limit']),
  cardId: z.string().optional(),
  cardName: z.string().optional(),
  message: z.string(),
  severity: z.enum(['error', 'warning', 'info'])
})

export type DeckViolation = z.infer<typeof DeckViolationSchema>

// Deck validation warning schema
export const DeckWarningSchema = z.object({
  type: z.string(),
  message: z.string(),
  cardId: z.string().optional()
})

export type DeckWarning = z.infer<typeof DeckWarningSchema>

// Deck validation suggestion schema
export const DeckSuggestionSchema = z.object({
  type: z.string(),
  message: z.string(),
  cardId: z.string().optional(),
  suggestedCards: z.array(z.string()).optional()
})

export type DeckSuggestion = z.infer<typeof DeckSuggestionSchema>

// Deck validation result schema
export const DeckValidationResultSchema = z.object({
  isValid: z.boolean(),
  format: z.string(),
  violations: z.array(DeckViolationSchema),
  warnings: z.array(DeckWarningSchema),
  suggestions: z.array(DeckSuggestionSchema)
})

export type DeckValidationResult = z.infer<typeof DeckValidationResultSchema>

// Format rules schema
export const FormatRulesSchema = z.object({
  format: z.string(),
  deckSize: z.object({
    min: z.number(),
    max: z.number()
  }),
  sideboardSize: z.object({
    min: z.number(),
    max: z.number()
  }),
  cardLimits: z.object({
    default: z.number(),
    exceptions: z.record(z.string(), z.number()).optional()
  }),
  bannedCards: z.array(z.string()),
  restrictedCards: z.array(z.string()),
  specialRules: z.array(z.string()).optional(),
  lastUpdated: z.string()
})

export type FormatRules = z.infer<typeof FormatRulesSchema>

// Banned list update schema
export const BannedListUpdateSchema = z.object({
  format: z.string(),
  updateType: z.enum(['banned', 'unbanned', 'restricted', 'unrestricted']),
  cards: z.array(z.object({
    cardId: z.string(),
    cardName: z.string(),
    reason: z.string().optional()
  })),
  effectiveDate: z.string(),
  announcementDate: z.string(),
  source: z.string()
})

export type BannedListUpdate = z.infer<typeof BannedListUpdateSchema>

// Format rotation data schema
export const FormatRotationSchema = z.object({
  format: z.string(),
  rotationType: z.enum(['set_rotation', 'annual_rotation', 'manual_update']),
  rotatingOut: z.array(z.object({
    setCode: z.string(),
    setName: z.string(),
    rotationDate: z.string()
  })),
  rotatingIn: z.array(z.object({
    setCode: z.string(),
    setName: z.string(),
    legalDate: z.string()
  })),
  nextRotationDate: z.string().optional(),
  lastUpdated: z.string()
})

export type FormatRotation = z.infer<typeof FormatRotationSchema>

// Custom format schema
export const CustomFormatSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  rules: FormatRulesSchema.omit({ format: true, lastUpdated: true }),
  isPublic: z.boolean(),
  usageCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type CustomFormat = z.infer<typeof CustomFormatSchema>

// Legality notification schema
export const LegalityNotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(['banned_card', 'unbanned_card', 'restricted_card', 'format_rotation', 'rules_update']),
  format: z.string(),
  cardId: z.string().optional(),
  cardName: z.string().optional(),
  message: z.string(),
  isRead: z.boolean(),
  createdAt: z.string()
})

export type LegalityNotification = z.infer<typeof LegalityNotificationSchema>

// Input schemas for API endpoints
export const ValidateDeckInputSchema = z.object({
  cards: z.array(z.object({
    cardId: z.string(),
    quantity: z.number().min(1),
    category: z.string().optional()
  })),
  format: z.enum(SUPPORTED_FORMATS),
  sideboard: z.array(z.object({
    cardId: z.string(),
    quantity: z.number().min(1)
  })).optional()
})

export type ValidateDeckInput = z.infer<typeof ValidateDeckInputSchema>

export const GetCardLegalityInputSchema = z.object({
  cardId: z.string(),
  formats: z.array(z.enum(SUPPORTED_FORMATS)).optional()
})

export type GetCardLegalityInput = z.infer<typeof GetCardLegalityInputSchema>

export const GetBatchCardLegalityInputSchema = z.object({
  cardIds: z.array(z.string()),
  formats: z.array(z.enum(SUPPORTED_FORMATS)).optional()
})

export type GetBatchCardLegalityInput = z.infer<typeof GetBatchCardLegalityInputSchema>

export const CreateCustomFormatInputSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  deckSize: z.object({
    min: z.number().min(1),
    max: z.number().min(1)
  }),
  sideboardSize: z.object({
    min: z.number().min(0),
    max: z.number().min(0)
  }),
  cardLimits: z.object({
    default: z.number().min(1),
    exceptions: z.record(z.string(), z.number()).optional()
  }),
  bannedCards: z.array(z.string()),
  restrictedCards: z.array(z.string()),
  specialRules: z.array(z.string()).optional(),
  isPublic: z.boolean().optional()
})

export type CreateCustomFormatInput = z.infer<typeof CreateCustomFormatInputSchema>

// Format information for UI
export interface FormatInfo {
  id: SupportedFormat
  name: string
  description: string
  deckSize: { min: number; max: number }
  sideboardSize: { min: number; max: number }
  cardLimits: { default: number; exceptions?: Record<string, number> }
  hasRotation: boolean
  isEternal: boolean
  category: 'standard' | 'eternal' | 'limited' | 'casual' | 'digital'
}

// Format categories for organization
export const FORMAT_CATEGORIES = {
  standard: ['standard', 'pioneer', 'explorer'],
  eternal: ['modern', 'legacy', 'vintage'],
  casual: ['commander', 'brawl', 'pauper', 'penny'],
  digital: ['historic', 'alchemy', 'timeless']
} as const

// Validation error types
export const VALIDATION_ERROR_TYPES = {
  BANNED_CARD: 'banned_card',
  RESTRICTED_CARD: 'restricted_card',
  ILLEGAL_CARD: 'illegal_card',
  DECK_SIZE: 'deck_size',
  SIDEBOARD_SIZE: 'sideboard_size',
  CARD_LIMIT: 'card_limit',
  COMMANDER_INVALID: 'commander_invalid',
  COLOR_IDENTITY: 'color_identity'
} as const

// Notification types
export const NOTIFICATION_TYPES = {
  BANNED_CARD: 'banned_card',
  UNBANNED_CARD: 'unbanned_card',
  RESTRICTED_CARD: 'restricted_card',
  FORMAT_ROTATION: 'format_rotation',
  RULES_UPDATE: 'rules_update'
} as const

// Format-specific constants
export const COMMANDER_DECK_SIZE = 100
export const STANDARD_DECK_SIZE = 60
export const STANDARD_SIDEBOARD_SIZE = 15
export const COMMANDER_CARD_LIMIT = 1
export const STANDARD_CARD_LIMIT = 4

// Helper functions
export function getFormatInfo(format: SupportedFormat): FormatInfo {
  const formatInfoMap: Record<SupportedFormat, FormatInfo> = {
    standard: {
      id: 'standard',
      name: 'Standard',
      description: 'The most recent sets, rotating annually',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      hasRotation: true,
      isEternal: false,
      category: 'standard'
    },
    pioneer: {
      id: 'pioneer',
      name: 'Pioneer',
      description: 'Cards from Return to Ravnica forward',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      hasRotation: false,
      isEternal: false,
      category: 'standard'
    },
    modern: {
      id: 'modern',
      name: 'Modern',
      description: 'Cards from 8th Edition and Mirrodin forward',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      hasRotation: false,
      isEternal: true,
      category: 'eternal'
    },
    legacy: {
      id: 'legacy',
      name: 'Legacy',
      description: 'All cards except those on the banned list',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      hasRotation: false,
      isEternal: true,
      category: 'eternal'
    },
    vintage: {
      id: 'vintage',
      name: 'Vintage',
      description: 'All cards with restricted list',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      hasRotation: false,
      isEternal: true,
      category: 'eternal'
    },
    commander: {
      id: 'commander',
      name: 'Commander',
      description: '100-card singleton format with legendary commander',
      deckSize: { min: 100, max: 100 },
      sideboardSize: { min: 0, max: 0 },
      cardLimits: { default: 1, exceptions: { 'basic_lands': 999 } },
      hasRotation: false,
      isEternal: true,
      category: 'casual'
    },
    brawl: {
      id: 'brawl',
      name: 'Brawl',
      description: '60-card singleton format with legendary commander',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 0 },
      cardLimits: { default: 1, exceptions: { 'basic_lands': 999 } },
      hasRotation: true,
      isEternal: false,
      category: 'casual'
    },
    historic: {
      id: 'historic',
      name: 'Historic',
      description: 'Arena-specific format with curated card pool',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      hasRotation: false,
      isEternal: false,
      category: 'digital' as const
    },
    alchemy: {
      id: 'alchemy',
      name: 'Alchemy',
      description: 'Arena format with digital-only cards',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      hasRotation: true,
      isEternal: false,
      category: 'digital' as const
    },
    explorer: {
      id: 'explorer',
      name: 'Explorer',
      description: 'Arena format mirroring Pioneer',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      hasRotation: false,
      isEternal: false,
      category: 'standard'
    },
    timeless: {
      id: 'timeless',
      name: 'Timeless',
      description: 'Arena eternal format',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      hasRotation: false,
      isEternal: true,
      category: 'digital' as const
    },
    pauper: {
      id: 'pauper',
      name: 'Pauper',
      description: 'Commons-only format',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      hasRotation: false,
      isEternal: true,
      category: 'casual'
    },
    penny: {
      id: 'penny',
      name: 'Penny Dreadful',
      description: 'Budget format with price restrictions',
      deckSize: { min: 60, max: 60 },
      sideboardSize: { min: 0, max: 15 },
      cardLimits: { default: 4 },
      hasRotation: true,
      isEternal: false,
      category: 'casual'
    }
  }

  return formatInfoMap[format]
}

export function isFormatEternal(format: SupportedFormat): boolean {
  return getFormatInfo(format).isEternal
}

export function hasFormatRotation(format: SupportedFormat): boolean {
  return getFormatInfo(format).hasRotation
}

export function getFormatsByCategory(category: keyof typeof FORMAT_CATEGORIES): SupportedFormat[] {
  return [...FORMAT_CATEGORIES[category]] as SupportedFormat[]
}
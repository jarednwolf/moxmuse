import { z } from 'zod'

// Card-related types
export const CardConditionSchema = z.enum(['NM', 'LP', 'MP', 'HP', 'DMG'])
export type CardCondition = z.infer<typeof CardConditionSchema>

// AI Deck Building Tutor is Commander-focused
export const FormatSchema = z.enum(['commander'])
export type Format = z.infer<typeof FormatSchema>

export const BoardStateSchema = z.enum(['mainboard', 'sideboard', 'maybeboard'])
export type BoardState = z.infer<typeof BoardStateSchema>

// Scryfall card data (simplified)
export interface ScryfallCard {
  id: string
  name: string
  mana_cost: string
  cmc: number
  type_line: string
  oracle_text: string
  colors: string[]
  color_identity: string[]
  keywords: string[]
  set: string
  set_name: string
  collector_number: string
  rarity: string
  prices: {
    usd: string | null
    usd_foil: string | null
    eur: string | null
    tix: string | null
  }
  legalities: {
    commander: string
    standard: string
    modern: string
    legacy: string
    vintage: string
    pauper: string
  }
  image_uris?: {
    normal: string
    large: string
    png: string
    art_crop: string
    border_crop: string
  }
}

// Recommendation types
export interface CardRecommendation {
  cardId: string
  card?: ScryfallCard
  reason: string
  confidence: number
  owned: boolean
  affiliateUrl?: string
}

export const RecommendCardInputSchema = z.object({
  deckId: z.string().optional(),
  sessionId: z.string(),
  prompt: z.string(),
  constraints: z.object({
    budget: z.number().optional(),
    ownedOnly: z.boolean().optional(),
    powerLevel: z.number().min(1).max(10).optional(),
    categories: z.array(z.string()).optional(),
  }).optional(),
})

export type RecommendCardInput = z.infer<typeof RecommendCardInputSchema>

// Sync job types
export const SyncProviderSchema = z.enum(['moxfield', 'archidekt', 'csv'])
export type SyncProvider = z.infer<typeof SyncProviderSchema>

export const SyncStatusSchema = z.enum(['pending', 'running', 'completed', 'failed'])
export type SyncStatus = z.infer<typeof SyncStatusSchema>

// Affiliate partners
export const AffiliatePartnerSchema = z.enum(['tcgplayer', 'cardkingdom', 'channelfireball'])
export type AffiliatePartner = z.infer<typeof AffiliatePartnerSchema>

// AI Deck Building Tutor Types

// Consultation Data for Deck Building Wizard
export const ConsultationDataSchema = z.object({
  // Entry point selection
  buildingFullDeck: z.boolean().default(false),
  needsCommanderSuggestions: z.boolean().default(false),
  
  // Commander information
  commander: z.string().optional(),
  commanderColors: z.array(z.string()).optional(),
  
  // Strategy preferences
  strategy: z.enum(['aggro', 'control', 'combo', 'midrange', 'tribal', 'value', 'stax']).optional(),
  themes: z.array(z.string()).optional(),
  customTheme: z.string().optional(),
  
  // Constraints
  budget: z.number().optional(),
  powerLevel: z.number().min(1).max(4).optional(), // 1-4 bracket system
  useCollection: z.boolean().default(false),
  
  // Color preferences
  colorPreferences: z.array(z.string()).optional(),
  specificColors: z.array(z.string()).optional(),
  
  // Win conditions
  winConditions: z.object({
    primary: z.enum(['combat', 'combo', 'alternative', 'control']),
    secondary: z.array(z.string()).optional(),
    combatStyle: z.enum(['aggro', 'voltron', 'tokens', 'big-creatures']).optional(),
    comboType: z.enum(['infinite', 'synergy', 'engine']).optional(),
  }).optional(),
  
  // Interaction preferences
  interaction: z.object({
    level: z.enum(['low', 'medium', 'high']),
    types: z.array(z.string()),
    timing: z.enum(['proactive', 'reactive', 'balanced']),
  }).optional(),
  
  // Social dynamics
  politics: z.object({
    style: z.enum(['diplomatic', 'aggressive', 'hidden', 'chaotic']),
    threatLevel: z.enum(['low-profile', 'moderate', 'high-threat']),
  }).optional(),
  
  // Restrictions and preferences
  avoidStrategies: z.array(z.string()).optional(),
  avoidCards: z.array(z.string()).optional(),
  petCards: z.array(z.string()).optional(),
  complexityLevel: z.enum(['simple', 'moderate', 'complex']).optional(),
  
  // Mana base preferences
  manaStrategy: z.object({
    fetchlands: z.boolean(),
    utilityLands: z.boolean(),
    tapLandRatio: z.enum(['low', 'medium', 'high']),
    budget: z.number(),
  }).optional(),
})

export type ConsultationData = z.infer<typeof ConsultationDataSchema>

// Deck Statistics Types
export const ManaCurveDataSchema = z.object({
  distribution: z.array(z.number()).length(8), // [0, 1, 2, 3, 4, 5, 6, 7+]
  peakCMC: z.number(),
  averageCMC: z.number(),
  landRatio: z.number(),
})

export type ManaCurveData = z.infer<typeof ManaCurveDataSchema>

export const ColorDistributionSchema = z.object({
  white: z.number(),
  blue: z.number(),
  black: z.number(),
  red: z.number(),
  green: z.number(),
  colorless: z.number(),
  multicolor: z.number(),
  devotion: z.record(z.string(), z.number()),
})

export type ColorDistribution = z.infer<typeof ColorDistributionSchema>

export const TypeDistributionSchema = z.object({
  creature: z.number(),
  instant: z.number(),
  sorcery: z.number(),
  artifact: z.number(),
  enchantment: z.number(),
  planeswalker: z.number(),
  land: z.number(),
  other: z.number(),
})

export type TypeDistribution = z.infer<typeof TypeDistributionSchema>

export const RarityDistributionSchema = z.object({
  common: z.number(),
  uncommon: z.number(),
  rare: z.number(),
  mythic: z.number(),
})

export type RarityDistribution = z.infer<typeof RarityDistributionSchema>

export const DeckStatisticsSchema = z.object({
  manaCurve: ManaCurveDataSchema,
  colorDistribution: ColorDistributionSchema,
  typeDistribution: TypeDistributionSchema,
  rarityDistribution: RarityDistributionSchema,
  averageCMC: z.number(),
  totalValue: z.number(),
  landCount: z.number(),
  nonlandCount: z.number(),
})

export type DeckStatistics = z.infer<typeof DeckStatisticsSchema>

// Card Synergy and Strategy Analysis Types
export const CardSynergySchema = z.object({
  cardId: z.string(),
  relatedCardIds: z.array(z.string()),
  synergyType: z.enum(['combo', 'support', 'engine', 'protection', 'enabler']),
  strength: z.number().min(1).max(10),
  description: z.string(),
})

export type CardSynergy = z.infer<typeof CardSynergySchema>

export const WinConditionSchema = z.object({
  type: z.enum(['combat', 'combo', 'alternative', 'control']),
  description: z.string(),
  keyCards: z.array(z.string()),
  probability: z.number().min(0).max(1),
})

export type WinCondition = z.infer<typeof WinConditionSchema>

export const DeckStrategySchema = z.object({
  name: z.string(),
  description: z.string(),
  archetype: z.enum(['aggro', 'control', 'combo', 'midrange', 'tribal', 'value', 'stax']),
  themes: z.array(z.string()),
  gameplan: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
})

export type DeckStrategy = z.infer<typeof DeckStrategySchema>

export const StrategyAnalysisSchema = z.object({
  strategy: DeckStrategySchema,
  winConditions: z.array(WinConditionSchema),
  keyInteractions: z.array(z.string()),
  playPattern: z.string(),
  mulliganGuide: z.string(),
  sideboarding: z.array(z.string()).optional(),
})

export type StrategyAnalysis = z.infer<typeof StrategyAnalysisSchema>

// Generated Deck Types
export const DeckCategorySchema = z.object({
  name: z.string(),
  description: z.string(),
  targetCount: z.number(),
  actualCount: z.number(),
  cards: z.array(z.string()),
})

export type DeckCategory = z.infer<typeof DeckCategorySchema>

export const GeneratedDeckCardSchema = z.object({
  cardId: z.string(),
  quantity: z.number().default(1),
  category: z.string(),
  role: z.string(),
  reasoning: z.string(),
  alternatives: z.array(z.string()).optional(),
  upgradeOptions: z.array(z.string()).optional(),
  budgetOptions: z.array(z.string()).optional(),
})

export type GeneratedDeckCard = z.infer<typeof GeneratedDeckCardSchema>

export const GeneratedDeckSchema = z.object({
  id: z.string(),
  name: z.string(),
  commander: z.string(),
  format: z.enum(['commander']).default('commander'),
  
  // Strategy context
  strategy: DeckStrategySchema,
  winConditions: z.array(WinConditionSchema),
  powerLevel: z.number().min(1).max(4),
  estimatedBudget: z.number(),
  
  // Card composition
  cards: z.array(GeneratedDeckCardSchema),
  categories: z.array(DeckCategorySchema),
  
  // Analysis
  statistics: DeckStatisticsSchema,
  synergies: z.array(CardSynergySchema),
  weaknesses: z.array(z.string()),
  
  // Metadata
  generatedAt: z.date(),
  consultationData: ConsultationDataSchema,
})

export type GeneratedDeck = z.infer<typeof GeneratedDeckSchema>

// Input schemas for API endpoints
export const GenerateFullDeckInputSchema = z.object({
  sessionId: z.string(),
  consultationData: ConsultationDataSchema,
  commander: z.string(),
  constraints: z.object({
    budget: z.number().optional(),
    powerLevel: z.number().min(1).max(4).optional(),
    useCollection: z.boolean().optional(),
  }).optional(),
})

export type GenerateFullDeckInput = z.infer<typeof GenerateFullDeckInputSchema>

export const AnalyzeDeckInputSchema = z.object({
  deckId: z.string(),
})

export type AnalyzeDeckInput = z.infer<typeof AnalyzeDeckInputSchema>

export const SuggestDeckImprovementsInputSchema = z.object({
  deckId: z.string(),
  focusArea: z.enum(['mana-curve', 'removal', 'draw', 'ramp', 'win-cons']).optional(),
})

export type SuggestDeckImprovementsInput = z.infer<typeof SuggestDeckImprovementsInputSchema>

export const ExportDeckInputSchema = z.object({
  deckId: z.string(),
  format: z.enum(['text', 'json', 'moxfield', 'archidekt', 'print']),
})

export type ExportDeckInput = z.infer<typeof ExportDeckInputSchema>

// Bulk Operations Types
export const BulkOperationTypeSchema = z.enum([
  'import',
  'export', 
  'delete',
  'move',
  'clone',
  'tag',
  'analyze',
  'optimize',
  'share',
  'privacy'
])

export type BulkOperationType = z.infer<typeof BulkOperationTypeSchema>

export const BulkOperationStatusSchema = z.enum([
  'pending',
  'processing', 
  'completed',
  'failed',
  'cancelled'
])

export type BulkOperationStatus = z.infer<typeof BulkOperationStatusSchema>

export const BulkOperationSchema = z.object({
  id: z.string().optional(),
  type: BulkOperationTypeSchema,
  deckIds: z.array(z.string()),
  parameters: z.record(z.any()),
  userId: z.string().optional(),
  status: BulkOperationStatusSchema.optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
})

export type BulkOperation = z.infer<typeof BulkOperationSchema>

export const BulkOperationResultSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  processedCount: z.number(),
  errorCount: z.number(),
  skippedCount: z.number().optional(),
  totalCount: z.number(),
  errors: z.array(z.object({
    deckId: z.string(),
    error: z.string(),
    code: z.string().optional(),
    canRetry: z.boolean().optional()
  })),
  warnings: z.array(z.object({
    deckId: z.string(),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high'])
  })).optional(),
  results: z.record(z.any()),
  progressPercentage: z.number().optional(),
  estimatedTimeRemaining: z.number().optional(),
  canUndo: z.boolean().optional(),
  undoData: z.record(z.any()).optional()
})

export type BulkOperationResult = z.infer<typeof BulkOperationResultSchema>

// Commander Selection Types
export const CommanderRecommendationSchema = z.object({
  type: z.literal('commander'),
  cardId: z.string(),
  name: z.string(),
  typeLine: z.string(),
  setName: z.string(),
  oracleText: z.string(),
  imageUrl: z.string().optional(),
  price: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  owned: z.boolean(),
  colorIdentity: z.array(z.string()),
})

export type CommanderRecommendation = z.infer<typeof CommanderRecommendationSchema>

export const CommanderSelectionInputSchema = z.object({
  sessionId: z.string(),
  consultationData: ConsultationDataSchema,
  excludeCommanders: z.array(z.string()).optional(),
})

export type CommanderSelectionInput = z.infer<typeof CommanderSelectionInputSchema>

// Card Search Schemas
export const CardSearchQuerySchema = z.object({
  // Text search
  text: z.string().optional(),
  name: z.string().optional(),
  oracleText: z.string().optional(),
  typeText: z.string().optional(),
  
  // Numeric ranges
  cmcRange: z.tuple([z.number(), z.number()]).optional(),
  powerRange: z.tuple([z.number(), z.number()]).optional(),
  toughnessRange: z.tuple([z.number(), z.number()]).optional(),
  
  // Color filters
  colors: z.array(z.string()).optional(),
  colorIdentity: z.array(z.string()).optional(),
  
  // Other filters
  rarities: z.array(z.string()).optional(),
  sets: z.array(z.string()).optional(),
  isLegal: z.record(z.boolean()).optional(),
  hasKeywords: z.array(z.string()).optional(),
  producesColors: z.array(z.string()).optional(),
  
  // Additional filters from original schema
  types: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  set: z.string().optional(),
  rarity: z.array(z.string()).optional(),
  artist: z.string().optional(),
  format: z.string().optional(),
  legal: z.boolean().optional(),
  
  // CMC single value (for backward compatibility)
  cmc: z.number().optional(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  
  // Sorting and pagination
  sortBy: z.enum(['name', 'cmc', 'power', 'toughness', 'price', 'releaseDate']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  orderBy: z.string().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
})

export type CardSearchQuery = z.infer<typeof CardSearchQuerySchema>

export const SearchCardsInputSchema = z.object({
  query: CardSearchQuerySchema,
  limit: z.number().optional(),
  offset: z.number().optional(),
})

export type SearchCardsInput = z.infer<typeof SearchCardsInputSchema>

export const SaveSearchInputSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  query: CardSearchQuerySchema,
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
})

export type SaveSearchInput = z.infer<typeof SaveSearchInputSchema>

export const GetSearchSuggestionsInputSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
  types: z.array(z.string()).optional(),
})

export type GetSearchSuggestionsInput = z.infer<typeof GetSearchSuggestionsInputSchema>
// Card Search Types
export interface EnhancedCardData {
  id: string
  name: string
  manaCost: string
  cmc: number
  typeLine: string
  oracleText: string
  power?: string
  toughness?: string
  colors: string[]
  colorIdentity: string[]
  legalities: Record<string, string>
  rulings: Array<{
    date: string
    text: string
  }>
  printings: Array<{
    set: string
    setName: string
    rarity: string
    collectorNumber: string
  }>
  relatedCards: string[]
  edhrecRank?: number
  popularityScore: number
  synergyTags: string[]
  currentPrice: number
  priceHistory: Array<{
    date: string
    price: number
  }>
  availability: {
    inStock: boolean
    lowStock: boolean
    sources: string[]
    lastChecked: string
  }
  lastUpdated: string
  imageUrls: Record<string, string>
  relevanceScore?: number
}

export interface SearchResults {
  cards: EnhancedCardData[]
  totalCount: number
  hasMore: boolean
  searchTime: number
  suggestions: string[]
}

export interface SearchHistoryEntry {
  id: string
  userId: string
  query: CardSearchQuery
  timestamp: string
  resultCount: number
}

export interface SavedSearch {
  id: string
  userId: string
  name: string
  description?: string
  query: CardSearchQuery
  isPublic: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
  lastUsed?: string
  useCount: number
}

export interface SearchSuggestion {
  type: 'card' | 'keyword' | 'set' | 'type' | 'ability'
  value: string
  display: string
  description: string
  popularity?: number
}

export interface SearchAnalytics {
  query: CardSearchQuery
  resultCount: number
  searchTime: number
  userId: string
  timestamp: Date
  clickThroughRate: number
  averagePosition: number
}

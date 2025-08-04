import { z } from 'zod'

// Card Search Query Types
export const CardSearchQuerySchema = z.object({
  text: z.string().optional(),
  name: z.string().optional(),
  oracleText: z.string().optional(),
  typeText: z.string().optional(),
  
  // Numeric ranges
  cmcRange: z.tuple([z.number(), z.number()]).optional(),
  powerRange: z.tuple([z.number(), z.number()]).optional(),
  toughnessRange: z.tuple([z.number(), z.number()]).optional(),
  
  // Categorical filters
  colors: z.array(z.string()).optional(),
  colorIdentity: z.array(z.string()).optional(),
  rarities: z.array(z.enum(['common', 'uncommon', 'rare', 'mythic'])).optional(),
  sets: z.array(z.string()).optional(),
  formats: z.array(z.string()).optional(),
  
  // Advanced criteria
  isLegal: z.record(z.string(), z.boolean()).optional(),
  hasKeywords: z.array(z.string()).optional(),
  producesColors: z.array(z.string()).optional(),
  
  // Sorting and pagination
  sortBy: z.enum(['name', 'cmc', 'power', 'toughness', 'releaseDate', 'price', 'relevance']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
})

export type CardSearchQuery = z.infer<typeof CardSearchQuerySchema>

// Enhanced Card Data Types
export const CardRulingSchema = z.object({
  date: z.string(),
  text: z.string(),
  source: z.string(),
})

export type CardRuling = z.infer<typeof CardRulingSchema>

export const CardPrintingSchema = z.object({
  id: z.string(),
  setCode: z.string(),
  setName: z.string(),
  collectorNumber: z.string(),
  rarity: z.string(),
  imageUrls: z.record(z.string(), z.string()),
  prices: z.record(z.string(), z.string().nullable()),
})

export type CardPrinting = z.infer<typeof CardPrintingSchema>

export const RelatedCardSchema = z.object({
  cardId: z.string(),
  relationship: z.enum(['synergy', 'alternative', 'upgrade', 'combo']),
  strength: z.number().min(0).max(10),
  explanation: z.string(),
})

export type RelatedCard = z.infer<typeof RelatedCardSchema>

export const PricePointSchema = z.object({
  date: z.string(),
  price: z.number(),
  source: z.string(),
})

export type PricePoint = z.infer<typeof PricePointSchema>

export const CardAvailabilitySchema = z.object({
  inStock: z.boolean(),
  lowStock: z.boolean(),
  sources: z.array(z.string()),
  lastChecked: z.string(),
})

export type CardAvailability = z.infer<typeof CardAvailabilitySchema>

export const EnhancedCardDataSchema = z.object({
  // Core Scryfall data
  id: z.string(),
  name: z.string(),
  manaCost: z.string(),
  cmc: z.number(),
  typeLine: z.string(),
  oracleText: z.string(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  colors: z.array(z.string()),
  colorIdentity: z.array(z.string()),
  
  // Enhanced metadata
  legalities: z.record(z.string(), z.string()),
  rulings: z.array(CardRulingSchema),
  printings: z.array(CardPrintingSchema),
  relatedCards: z.array(RelatedCardSchema),
  
  // Community data
  edhrecRank: z.number().optional(),
  popularityScore: z.number(),
  synergyTags: z.array(z.string()),
  
  // Market data
  currentPrice: z.number(),
  priceHistory: z.array(PricePointSchema),
  availability: CardAvailabilitySchema,
  
  // Platform integration
  lastUpdated: z.string(),
  imageUrls: z.record(z.string(), z.string()),
})

export type EnhancedCardData = z.infer<typeof EnhancedCardDataSchema>

// Search Results Types
export const SearchResultsSchema = z.object({
  cards: z.array(EnhancedCardDataSchema),
  totalCount: z.number(),
  hasMore: z.boolean(),
  searchTime: z.number(),
  suggestions: z.array(z.string()).optional(),
})

export type SearchResults = z.infer<typeof SearchResultsSchema>

// Search History Types
export const SearchHistoryEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  query: CardSearchQuerySchema,
  timestamp: z.string(),
  resultCount: z.number(),
})

export type SearchHistoryEntry = z.infer<typeof SearchHistoryEntrySchema>

// Saved Search Types
export const SavedSearchSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  query: CardSearchQuerySchema,
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastUsed: z.string().optional(),
  useCount: z.number().default(0),
})

export type SavedSearch = z.infer<typeof SavedSearchSchema>

// Search Suggestions Types
export const SearchSuggestionSchema = z.object({
  type: z.enum(['card', 'keyword', 'set', 'type', 'ability']),
  value: z.string(),
  display: z.string(),
  description: z.string().optional(),
  popularity: z.number().optional(),
})

export type SearchSuggestion = z.infer<typeof SearchSuggestionSchema>

// Search Analytics Types
export const SearchAnalyticsSchema = z.object({
  query: z.string(),
  resultCount: z.number(),
  clickThroughRate: z.number(),
  averagePosition: z.number(),
  searchTime: z.number(),
  timestamp: z.string(),
  userId: z.string().optional(),
})

export type SearchAnalytics = z.infer<typeof SearchAnalyticsSchema>

// Input Schemas for API endpoints
export const SearchCardsInputSchema = z.object({
  query: CardSearchQuerySchema,
  includeRelated: z.boolean().optional(),
  includePricing: z.boolean().optional(),
  includeRulings: z.boolean().optional(),
})

export type SearchCardsInput = z.infer<typeof SearchCardsInputSchema>

export const SaveSearchInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  query: CardSearchQuerySchema,
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
})

export type SaveSearchInput = z.infer<typeof SaveSearchInputSchema>

export const GetSearchSuggestionsInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(20).optional(),
  types: z.array(z.enum(['card', 'keyword', 'set', 'type', 'ability'])).optional(),
})

export type GetSearchSuggestionsInput = z.infer<typeof GetSearchSuggestionsInputSchema>
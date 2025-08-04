// Moxfield Parity + AI Enhancement Validation Schemas
// This file contains Zod validation schemas for all data structures

import { z } from 'zod'

// =====================================================
// DECK ORGANIZATION VALIDATION SCHEMAS
// =====================================================

export const TemplateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  targetCount: z.number().int().min(0).max(100),
  minCount: z.number().int().min(0).max(100),
  maxCount: z.number().int().min(0).max(100),
  priority: z.number().int().min(0).max(10)
})

export const TemplateCardSchema = z.object({
  cardId: z.string().uuid(),
  category: z.string().min(1).max(50),
  isCore: z.boolean(),
  alternatives: z.array(z.string().uuid()),
  reasoning: z.string().max(1000)
})

export const FlexSlotSchema = z.object({
  category: z.string().min(1).max(50),
  count: z.number().int().min(1).max(20),
  criteria: z.string().max(500),
  suggestions: z.array(z.string().uuid())
})

export const DeckFolderSchema: z.ZodType<any> = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  parentId: z.string().uuid().optional(),
  children: z.array(z.lazy(() => DeckFolderSchema)),
  deckIds: z.array(z.string().uuid()),
  sortOrder: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const DeckTemplateSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  format: z.enum(['commander', 'legacy', 'vintage', 'modern', 'standard', 'pioneer']),
  archetype: z.string().min(1).max(50),
  isPublic: z.boolean(),
  categories: z.array(TemplateCategorySchema),
  coreCards: z.array(TemplateCardSchema),
  flexSlots: z.array(FlexSlotSchema),
  powerLevel: z.number().int().min(1).max(10).optional(),
  estimatedBudget: z.number().min(0).max(100000).optional(),
  tags: z.array(z.string().max(50)),
  usageCount: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const DeckFolderItemSchema = z.object({
  id: z.string().uuid(),
  folderId: z.string().uuid(),
  deckId: z.string().uuid(),
  sortOrder: z.number().int().min(0),
  createdAt: z.date()
})

// =====================================================
// ENHANCED CARD DATABASE VALIDATION SCHEMAS
// =====================================================


export const SavedCardSearchSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  query: z.any(), // Reference to external CardSearchQuerySchema
  isPublic: z.boolean(),
  usageCount: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date()
})

// =====================================================
// IMPORT/EXPORT VALIDATION SCHEMAS
// =====================================================

export const ImportErrorSchema = z.object({
  type: z.enum(['card_not_found', 'invalid_format', 'duplicate_deck', 'permission_denied']),
  message: z.string().max(500),
  context: z.record(z.string(), z.any()).optional()
})

export const ImportWarningSchema = z.object({
  type: z.enum(['card_substitution', 'missing_metadata', 'format_assumption']),
  message: z.string().max(500),
  context: z.record(z.string(), z.any()).optional()
})

export const ImportJobSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  source: z.enum(['moxfield', 'archidekt', 'tappedout', 'edhrec', 'mtggoldfish', 'csv', 'text']),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  rawData: z.string().max(1000000).optional(),
  sourceUrl: z.string().url().optional(),
  fileName: z.string().max(255).optional(),
  decksFound: z.number().int().min(0),
  decksImported: z.number().int().min(0),
  errors: z.array(ImportErrorSchema),
  warnings: z.array(ImportWarningSchema),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.date(),
  completedAt: z.date().optional(),
  processingTime: z.number().int().min(0).optional()
})

export const ExportFormatSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  fileExtension: z.string().max(10),
  mimeType: z.string().max(100),
  supportsMultipleDecks: z.boolean(),
  customizable: z.boolean(),
  template: z.string().optional()
})

export const ExportOptionsSchema = z.object({
  includeCommander: z.boolean(),
  includeSideboard: z.boolean(),
  includeTokens: z.boolean(),
  includeBasicLands: z.boolean(),
  groupByCategory: z.boolean(),
  includeQuantities: z.boolean(),
  includePrices: z.boolean(),
  customFields: z.array(z.string().max(50))
})

export const ExportJobSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  deckIds: z.array(z.string().uuid()),
  format: ExportFormatSchema,
  options: ExportOptionsSchema,
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  downloadUrl: z.string().url().optional(),
  fileSize: z.number().int().min(0).optional(),
  expiresAt: z.date().optional(),
  createdAt: z.date(),
  completedAt: z.date().optional()
})

export const PlatformAdapterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.enum(['import', 'export', 'both']),
  isActive: z.boolean(),
  configuration: z.record(z.string(), z.any()),
  supportedFormats: z.array(z.string().max(20)),
  lastUpdated: z.date()
})

// =====================================================
// ANALYTICS VALIDATION SCHEMAS
// =====================================================

export const PipAnalysisSchema = z.object({
  totalPips: z.record(z.string(), z.number().int().min(0)),
  pipsByTurn: z.record(z.string(), z.record(z.string(), z.number().int().min(0))),
  criticalTurns: z.array(z.number().int().min(1).max(20)),
  bottlenecks: z.array(z.string().max(50))
})

export const FixingRecommendationSchema = z.object({
  type: z.enum(['land', 'artifact', 'creature']),
  cardSuggestions: z.array(z.string().uuid()),
  reasoning: z.string().max(500),
  priority: z.number().int().min(1).max(10)
})

export const ManaAnalysisSchema = z.object({
  colorRequirements: z.record(z.string(), z.number().int().min(0)),
  pipAnalysis: PipAnalysisSchema,
  fixingRecommendations: z.array(FixingRecommendationSchema),
  manaEfficiency: z.number().min(0).max(1),
  colorConsistency: z.record(z.string(), z.number().min(0).max(1))
})

export const OpeningHandStatsSchema = z.object({
  averageCMC: z.number().min(0).max(20),
  landCount: z.record(z.string(), z.number().int().min(0)),
  keepablePercentage: z.number().min(0).max(1),
  reasonsToMulligan: z.record(z.string(), z.number().int().min(0))
})

export const EarlyGameStatsSchema = z.object({
  averageTurnToFirstSpell: z.number().min(1).max(20),
  averageTurnToCommander: z.number().min(1).max(20),
  earlyGameThreats: z.number().int().min(0),
  earlyGameAnswers: z.number().int().min(0)
})

export const ConsistencyMetricsSchema = z.object({
  keepableHands: z.number().min(0).max(1),
  averageTurnToPlay: z.record(z.string(), z.number().min(1).max(20)),
  mulliganRate: z.number().min(0).max(1),
  gameplayConsistency: z.number().min(0).max(1),
  simulationRuns: z.number().int().min(1),
  openingHandStats: OpeningHandStatsSchema,
  earlyGameStats: EarlyGameStatsSchema
})

export const MetaMatchupSchema = z.object({
  archetype: z.string().min(1).max(100),
  winRate: z.number().min(0).max(1),
  gameCount: z.number().int().min(0),
  keyCards: z.array(z.string().uuid()),
  strategy: z.string().max(500)
})

export const MetaPositioningSchema = z.object({
  tier: z.number().int().min(1).max(5),
  competitiveViability: z.number().min(0).max(1),
  metaShare: z.number().min(0).max(1),
  trendDirection: z.enum(['up', 'stable', 'down'])
})

export const MetaAnalysisSchema = z.object({
  archetype: z.string().min(1).max(100),
  metaShare: z.number().min(0).max(1),
  winRate: z.number().min(0).max(1),
  popularityTrend: z.enum(['rising', 'stable', 'declining']),
  matchups: z.array(MetaMatchupSchema),
  positioning: MetaPositioningSchema,
  adaptationSuggestions: z.array(z.string().max(500))
})

export const MatchupStatsSchema = z.object({
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  draws: z.number().int().min(0),
  winRate: z.number().min(0).max(1),
  averageGameLength: z.number().min(0)
})

export const PerformanceTrendSchema = z.object({
  date: z.date(),
  winRate: z.number().min(0).max(1),
  gamesPlayed: z.number().int().min(0),
  averageGameLength: z.number().min(0)
})

export const PerformanceDataSchema = z.object({
  gamesPlayed: z.number().int().min(0),
  winRate: z.number().min(0).max(1),
  averageGameLength: z.number().min(0),
  matchupData: z.record(z.string(), MatchupStatsSchema),
  performanceTrends: z.array(PerformanceTrendSchema),
  keyMetrics: z.record(z.string(), z.number())
})

export const OptimizationSuggestionSchema = z.object({
  type: z.enum(['add', 'remove', 'replace']),
  cardId: z.string().uuid().optional(),
  replacementId: z.string().uuid().optional(),
  category: z.string().min(1).max(50),
  reasoning: z.string().max(1000),
  impact: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1)
})

export const DeckAnalyticsSchema = z.object({
  id: z.string().uuid(),
  deckId: z.string().uuid(),
  manaAnalysis: ManaAnalysisSchema,
  consistencyMetrics: ConsistencyMetricsSchema,
  metaAnalysis: MetaAnalysisSchema,
  performanceData: PerformanceDataSchema,
  optimizationSuggestions: z.array(OptimizationSuggestionSchema),
  analysisVersion: z.string().min(1).max(20),
  lastAnalyzed: z.date()
})

export const SimulationParametersSchema = z.object({
  iterations: z.number().int().min(100).max(10000),
  mulliganStrategy: z.enum(['aggressive', 'conservative', 'balanced']),
  playPattern: z.enum(['curve', 'combo', 'control']),
  opponentPressure: z.enum(['low', 'medium', 'high'])
})

export const GoldfishSimulationSchema = z.object({
  id: z.string().uuid(),
  deckId: z.string().uuid(),
  userId: z.string().uuid(),
  simulationRuns: z.number().int().min(1),
  openingHandStats: OpeningHandStatsSchema,
  earlyGameStats: EarlyGameStatsSchema,
  keepableHands: z.number().min(0).max(1),
  averageTurnToPlay: z.record(z.string(), z.number().min(1).max(20)),
  mulliganRate: z.number().min(0).max(1),
  gameplayConsistency: z.number().min(0).max(1),
  simulationParameters: SimulationParametersSchema,
  createdAt: z.date()
})

export const GameResultSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  deckId: z.string().uuid(),
  opponent: z.string().max(100).optional(),
  opponentDeck: z.string().max(100).optional(),
  result: z.enum(['win', 'loss', 'draw']),
  gameLength: z.number().int().min(1).max(600).optional(), // minutes
  format: z.string().min(1).max(50),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  playedAt: z.date()
})

// =====================================================
// SOCIAL AND COMMUNITY VALIDATION SCHEMAS
// =====================================================

export const PublicDeckSchema = z.object({
  id: z.string().uuid(),
  deckId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  commander: z.string().min(1).max(200),
  format: z.string().min(1).max(50),
  userId: z.string().uuid(),
  authorName: z.string().min(1).max(100),
  authorAvatar: z.string().url().optional(),
  cardCount: z.number().int().min(1).max(500),
  estimatedBudget: z.number().min(0).max(100000).optional(),
  powerLevel: z.number().int().min(1).max(10).optional(),
  archetype: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)),
  views: z.number().int().min(0),
  likes: z.number().int().min(0),
  comments: z.number().int().min(0),
  copies: z.number().int().min(0),
  rating: z.number().min(0).max(5),
  isActive: z.boolean(),
  publishedAt: z.date(),
  lastUpdated: z.date()
})

export const DeckCommentSchema: z.ZodType<any> = z.object({
  id: z.string().uuid(),
  publicDeckId: z.string().uuid(),
  userId: z.string().uuid(),
  userName: z.string().min(1).max(100),
  userAvatar: z.string().url().optional(),
  content: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(),
  replies: z.array(z.lazy(() => DeckCommentSchema)),
  likes: z.number().int().min(0),
  isEdited: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const AchievementSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  icon: z.string().max(50),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']),
  unlockedAt: z.date()
})

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(100),
  avatar: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  totalDecks: z.number().int().min(0),
  publicDecks: z.number().int().min(0),
  totalLikes: z.number().int().min(0),
  totalViews: z.number().int().min(0),
  favoriteFormats: z.array(z.string().max(50)),
  favoriteArchetypes: z.array(z.string().max(100)),
  brewingStyle: z.array(z.string().max(50)),
  followers: z.number().int().min(0),
  following: z.number().int().min(0),
  achievements: z.array(AchievementSchema),
  isPublic: z.boolean(),
  createdAt: z.date(),
  lastActive: z.date()
})

export const UserFollowSchema = z.object({
  id: z.string().uuid(),
  followerId: z.string().uuid(),
  followingId: z.string().uuid(),
  createdAt: z.date()
})

export const DeckLikeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  publicDeckId: z.string().uuid(),
  createdAt: z.date()
})

export const CommentLikeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  commentId: z.string().uuid(),
  createdAt: z.date()
})

export const TrendingDeckSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  commander: z.string().min(1).max(200),
  archetype: z.string().max(100),
  score: z.number().min(0),
  trend: z.enum(['up', 'stable', 'down'])
})

export const TrendingCardSchema = z.object({
  cardId: z.string().uuid(),
  name: z.string().min(1).max(200),
  score: z.number().min(0),
  trend: z.enum(['up', 'stable', 'down']),
  playRate: z.number().min(0).max(1),
  winRate: z.number().min(0).max(1)
})

export const TrendingArchetypeSchema = z.object({
  name: z.string().min(1).max(100),
  score: z.number().min(0),
  trend: z.enum(['up', 'stable', 'down']),
  metaShare: z.number().min(0).max(1),
  winRate: z.number().min(0).max(1)
})

export const TrendingCommanderSchema = z.object({
  cardId: z.string().uuid(),
  name: z.string().min(1).max(200),
  score: z.number().min(0),
  trend: z.enum(['up', 'stable', 'down']),
  deckCount: z.number().int().min(0),
  winRate: z.number().min(0).max(1)
})

export const TrendingDataSchema = z.object({
  decks: z.array(TrendingDeckSchema),
  cards: z.array(TrendingCardSchema),
  archetypes: z.array(TrendingArchetypeSchema),
  commanders: z.array(TrendingCommanderSchema),
  timeframe: z.enum(['day', 'week', 'month']),
  lastUpdated: z.date()
})

// =====================================================
// PERFORMANCE AND SYSTEM VALIDATION SCHEMAS
// =====================================================

export const PerformanceMetricSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  operation: z.string().min(1).max(100),
  duration: z.number().int().min(0),
  success: z.boolean(),
  errorMessage: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  timestamp: z.date()
})

export const CacheEntrySchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1).max(255),
  value: z.any(),
  tags: z.array(z.string().max(50)),
  expiresAt: z.date().optional(),
  hitCount: z.number().int().min(0),
  lastAccessed: z.date(),
  createdAt: z.date()
})

export const BackgroundJobSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1).max(100),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  priority: z.number().int().min(0).max(10),
  data: z.record(z.string(), z.any()),
  result: z.record(z.string(), z.any()).optional(),
  error: z.string().max(2000).optional(),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1).max(10),
  scheduledFor: z.date().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  createdAt: z.date()
})

export const SystemHealthSchema = z.object({
  id: z.string().uuid(),
  component: z.string().min(1).max(100),
  status: z.enum(['healthy', 'warning', 'critical']),
  metrics: z.record(z.string(), z.any()),
  message: z.string().max(1000).optional(),
  timestamp: z.date()
})

// =====================================================
// BULK OPERATIONS VALIDATION SCHEMAS
// =====================================================

export const BulkOperationSchema = z.object({
  type: z.enum(['export', 'delete', 'move', 'clone', 'tag']),
  deckIds: z.array(z.string().uuid()).min(1).max(100),
  parameters: z.record(z.string(), z.any())
})

export const BulkOperationErrorSchema = z.object({
  deckId: z.string().uuid(),
  error: z.string().max(500),
  context: z.record(z.string(), z.any()).optional()
})


// =====================================================
// SHARING AND COLLABORATION VALIDATION SCHEMAS
// =====================================================

export const SharingSettingsSchema = z.object({
  isPublic: z.boolean(),
  allowComments: z.boolean(),
  allowCopying: z.boolean(),
  showPrices: z.boolean(),
  description: z.string().max(2000),
  tags: z.array(z.string().max(50))
})

export const CollaborationPermissionsSchema = z.object({
  canEdit: z.boolean(),
  canComment: z.boolean(),
  canShare: z.boolean(),
  canDelete: z.boolean()
})

export const CollaborationInviteSchema = z.object({
  id: z.string().uuid(),
  deckId: z.string().uuid(),
  inviterId: z.string().uuid(),
  inviteeId: z.string().uuid(),
  permissions: CollaborationPermissionsSchema,
  status: z.enum(['pending', 'accepted', 'declined', 'expired']),
  createdAt: z.date(),
  expiresAt: z.date()
})

// =====================================================
// COMMUNITY FILTERS AND SEARCH VALIDATION SCHEMAS
// =====================================================

export const CommunityFiltersSchema = z.object({
  format: z.array(z.string().max(50)).optional(),
  archetype: z.array(z.string().max(100)).optional(),
  powerLevel: z.tuple([z.number().int().min(1).max(10), z.number().int().min(1).max(10)]).optional(),
  budget: z.tuple([z.number().min(0), z.number().max(100000)]).optional(),
  colors: z.array(z.enum(['W', 'U', 'B', 'R', 'G'])).optional(),
  tags: z.array(z.string().max(50)).optional(),
  sortBy: z.enum(['newest', 'popular', 'rating', 'views']).optional(),
  timeframe: z.enum(['day', 'week', 'month', 'all']).optional()
})

export const DeckSearchResultSchema = z.object({
  decks: z.array(PublicDeckSchema),
  totalCount: z.number().int().min(0),
  hasMore: z.boolean(),
  filters: CommunityFiltersSchema
})

// =====================================================
// MOBILE OPTIMIZATION VALIDATION SCHEMAS
// =====================================================

export const MobileLayoutPreferencesSchema = z.object({
  cardListView: z.enum(['compact', 'detailed', 'grid']),
  statisticsLayout: z.enum(['tabs', 'accordion', 'scroll']),
  touchSensitivity: z.enum(['low', 'medium', 'high']),
  gestureEnabled: z.boolean()
})

export const TouchSettingsSchema = z.object({
  swipeToDelete: z.boolean(),
  longPressActions: z.boolean(),
  doubleTapZoom: z.boolean(),
  pinchToZoom: z.boolean()
})

// =====================================================
// API RESPONSE VALIDATION SCHEMAS
// =====================================================

export const ValidationErrorSchema = z.object({
  field: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  code: z.string().min(1).max(50)
})

export const APIErrorSchema = z.object({
  message: z.string().min(1).max(1000),
  code: z.string().min(1).max(50),
  details: z.record(z.string(), z.any()).optional()
})

export const APIResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: APIErrorSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional()
})

// =====================================================
// UTILITY VALIDATION FUNCTIONS
// =====================================================

export const validateUUID = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

export const validateColorIdentity = (colors: string[]): boolean => {
  const validColors = ['W', 'U', 'B', 'R', 'G']
  return colors.every(color => validColors.includes(color))
}

export const validateManaCost = (manaCost: string): boolean => {
  const manaCostRegex = /^(\{[WUBRGXYZC0-9]+\})*$/
  return manaCostRegex.test(manaCost)
}

export const validateDeckSize = (format: string, cardCount: number): boolean => {
  const formatRules: Record<string, { min: number; max: number }> = {
    commander: { min: 100, max: 100 },
    legacy: { min: 60, max: Infinity },
    vintage: { min: 60, max: Infinity },
    modern: { min: 60, max: Infinity },
    standard: { min: 60, max: Infinity },
    pioneer: { min: 60, max: Infinity }
  }
  
  const rules = formatRules[format]
  if (!rules) return false
  
  return cardCount >= rules.min && cardCount <= rules.max
}

// Export all schemas for easy importing
export const ValidationSchemas = {
  // Deck Organization
  DeckFolder: DeckFolderSchema,
  DeckTemplate: DeckTemplateSchema,
  DeckFolderItem: DeckFolderItemSchema,
  TemplateCategory: TemplateCategorySchema,
  TemplateCard: TemplateCardSchema,
  FlexSlot: FlexSlotSchema,
  
  // Card Database
  SavedCardSearch: SavedCardSearchSchema,
  
  // Import/Export
  ImportJob: ImportJobSchema,
  ExportJob: ExportJobSchema,
  PlatformAdapter: PlatformAdapterSchema,
  ExportFormat: ExportFormatSchema,
  ExportOptions: ExportOptionsSchema,
  ImportError: ImportErrorSchema,
  ImportWarning: ImportWarningSchema,
  
  // Analytics
  DeckAnalytics: DeckAnalyticsSchema,
  ManaAnalysis: ManaAnalysisSchema,
  ConsistencyMetrics: ConsistencyMetricsSchema,
  MetaAnalysis: MetaAnalysisSchema,
  PerformanceData: PerformanceDataSchema,
  OptimizationSuggestion: OptimizationSuggestionSchema,
  GoldfishSimulation: GoldfishSimulationSchema,
  GameResult: GameResultSchema,
  
  // Social
  PublicDeck: PublicDeckSchema,
  DeckComment: DeckCommentSchema,
  UserProfile: UserProfileSchema,
  UserFollow: UserFollowSchema,
  DeckLike: DeckLikeSchema,
  CommentLike: CommentLikeSchema,
  TrendingData: TrendingDataSchema,
  Achievement: AchievementSchema,
  
  // Performance
  PerformanceMetric: PerformanceMetricSchema,
  CacheEntry: CacheEntrySchema,
  BackgroundJob: BackgroundJobSchema,
  SystemHealth: SystemHealthSchema,
  
  // Operations
  BulkOperation: BulkOperationSchema,
  SharingSettings: SharingSettingsSchema,
  CollaborationInvite: CollaborationInviteSchema,
  CommunityFilters: CommunityFiltersSchema,
  DeckSearchResult: DeckSearchResultSchema,
  
  // Mobile
  MobileLayoutPreferences: MobileLayoutPreferencesSchema,
  TouchSettings: TouchSettingsSchema,
  
  // API
  ValidationError: ValidationErrorSchema,
  APIError: APIErrorSchema,
  APIResponse: APIResponseSchema
}

// Moxfield Parity + AI Enhancement Types
// This file contains all TypeScript interfaces for the comprehensive deck building platform

// =====================================================
// DECK ORGANIZATION SYSTEM TYPES
// =====================================================

export interface DeckFolder {
  id: string
  userId: string
  name: string
  description?: string
  color: string
  parentId?: string
  children: DeckFolder[]
  deckIds: string[]
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface DeckTemplate {
  id: string
  userId: string
  name: string
  description: string
  format: string
  archetype: string
  isPublic: boolean
  
  // Template structure
  categories: TemplateCategory[]
  coreCards: TemplateCard[]
  flexSlots: FlexSlot[]
  
  // Metadata
  powerLevel?: number
  estimatedBudget?: number
  tags: string[]
  usageCount: number
  
  createdAt: Date
  updatedAt: Date
}

export interface TemplateCategory {
  name: string
  description: string
  targetCount: number
  minCount: number
  maxCount: number
  priority: number
}

export interface TemplateCard {
  cardId: string
  category: string
  isCore: boolean
  alternatives: string[]
  reasoning: string
}

export interface FlexSlot {
  category: string
  count: number
  criteria: string
  suggestions: string[]
}

export interface DeckTemplateVersion {
  id: string
  templateId: string
  version: string
  changes: string
  categories: TemplateCategory[]
  coreCards: TemplateCard[]
  flexSlots: FlexSlot[]
  createdAt: Date
}

export interface TemplateRating {
  id: string
  userId: string
  templateId: string
  rating: number
  review?: string
  createdAt: Date
  updatedAt: Date
}

export interface TemplateRecommendation {
  template: DeckTemplate
  score: number
  reasoning: string
}

export interface DeckFolderItem {
  id: string
  folderId: string
  deckId: string
  sortOrder: number
  createdAt: Date
}

// =====================================================
// ENHANCED CARD DATABASE TYPES
// =====================================================

export interface CardSearchQuery {
  text?: string
  name?: string
  oracleText?: string
  typeText?: string
  
  // Numeric ranges
  cmcRange?: [number, number]
  powerRange?: [number, number]
  toughnessRange?: [number, number]
  
  // Categorical filters
  colors?: string[]
  colorIdentity?: string[]
  rarities?: string[]
  sets?: string[]
  formats?: string[]
  
  // Advanced criteria
  isLegal?: Record<string, boolean>
  hasKeywords?: string[]
  producesColors?: string[]
  
  // Sorting and pagination
  sortBy?: 'name' | 'cmc' | 'power' | 'toughness' | 'releaseDate' | 'price'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface EnhancedCardData {
  // Core Scryfall data
  id: string
  cardId: string
  name: string
  manaCost?: string
  cmc: number
  typeLine: string
  oracleText?: string
  power?: string
  toughness?: string
  colors: string[]
  colorIdentity: string[]
  
  // Enhanced metadata
  legalities: Record<string, string>
  rulings: CardRuling[]
  printings: CardPrinting[]
  relatedCards: RelatedCard[]
  
  // Community data
  edhrecRank?: number
  popularityScore: number
  synergyTags: string[]
  
  // Market data
  currentPrice?: number
  priceHistory: PricePoint[]
  availability: CardAvailability
  
  // Platform integration
  lastUpdated: Date
  imageUrls: Record<string, string>
}

export interface CardRuling {
  date: string
  text: string
  source: string
}

export interface CardPrinting {
  setCode: string
  setName: string
  collectorNumber: string
  rarity: string
  imageUrl?: string
}

export interface RelatedCard {
  cardId: string
  relationship: 'synergy' | 'alternative' | 'upgrade' | 'combo'
  strength: number
  explanation: string
}

export interface PricePoint {
  date: Date
  price: number
  source: string
  condition: string
  foil: boolean
}

export interface CardAvailability {
  inStock: boolean
  sources: string[]
  lowestPrice?: number
  averagePrice?: number
}

export interface SavedCardSearch {
  id: string
  userId: string
  name: string
  query: CardSearchQuery
  isPublic: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

// =====================================================
// UNIVERSAL IMPORT/EXPORT TYPES
// =====================================================

export interface ImportJob {
  id: string
  userId: string
  source: 'moxfield' | 'archidekt' | 'tappedout' | 'edhrec' | 'mtggoldfish' | 'csv' | 'text'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  
  // Input data
  rawData?: string
  sourceUrl?: string
  fileName?: string
  
  // Processing results
  decksFound: number
  decksImported: number
  errors: ImportError[]
  warnings: ImportWarning[]
  metadata?: Record<string, any>
  
  // Metadata
  createdAt: Date
  completedAt?: Date
  processingTime?: number
}

export interface ImportError {
  type: 'card_not_found' | 'invalid_format' | 'duplicate_deck' | 'permission_denied'
  message: string
  context?: Record<string, any>
}

export interface ImportWarning {
  type: 'card_substitution' | 'missing_metadata' | 'format_assumption'
  message: string
  context?: Record<string, any>
}

export interface ExportFormat {
  id: string
  name: string
  description: string
  fileExtension: string
  mimeType: string
  supportsMultipleDecks: boolean
  customizable: boolean
  template?: string
}

export interface ExportJob {
  id: string
  userId: string
  deckIds: string[]
  format: ExportFormat
  options: ExportOptions
  status: 'pending' | 'processing' | 'completed' | 'failed'
  
  // Results
  downloadUrl?: string
  fileSize?: number
  expiresAt?: Date
  
  createdAt: Date
  completedAt?: Date
}

export interface ExportOptions {
  includeCommander: boolean
  includeSideboard: boolean
  includeTokens: boolean
  includeBasicLands: boolean
  groupByCategory: boolean
  includeQuantities: boolean
  includePrices: boolean
  customFields: string[]
}

export interface PlatformAdapter {
  id: string
  name: string
  type: 'import' | 'export' | 'both'
  isActive: boolean
  configuration: Record<string, any>
  supportedFormats: string[]
  lastUpdated: Date
}

// =====================================================
// ADVANCED ANALYTICS TYPES
// =====================================================

export interface DeckAnalytics {
  id: string
  deckId: string
  
  // Analysis components
  manaAnalysis: ManaAnalysis
  consistencyMetrics: ConsistencyMetrics
  metaAnalysis: MetaAnalysis
  performanceData: PerformanceData
  optimizationSuggestions: OptimizationSuggestion[]
  
  analysisVersion: string
  lastAnalyzed: Date
}

export interface ManaAnalysis {
  colorRequirements: Record<string, number>
  pipAnalysis: PipAnalysis
  fixingRecommendations: FixingRecommendation[]
  manaEfficiency: number
  colorConsistency: Record<string, number>
}

export interface PipAnalysis {
  totalPips: Record<string, number>
  pipsByTurn: Record<number, Record<string, number>>
  criticalTurns: number[]
  bottlenecks: string[]
}

export interface FixingRecommendation {
  type: 'land' | 'artifact' | 'creature'
  cardSuggestions: string[]
  reasoning: string
  priority: number
}

export interface ConsistencyMetrics {
  keepableHands: number
  averageTurnToPlay: Record<string, number>
  mulliganRate: number
  gameplayConsistency: number
  
  // Simulation results
  simulationRuns: number
  openingHandStats: OpeningHandStats
  earlyGameStats: EarlyGameStats
}

export interface OpeningHandStats {
  averageCMC: number
  landCount: Record<number, number>
  keepablePercentage: number
  reasonsToMulligan: Record<string, number>
}

export interface EarlyGameStats {
  averageTurnToFirstSpell: number
  averageTurnToCommander: number
  earlyGameThreats: number
  earlyGameAnswers: number
}

export interface MetaAnalysis {
  archetype: string
  metaShare: number
  winRate: number
  popularityTrend: 'rising' | 'stable' | 'declining'
  
  matchups: MetaMatchup[]
  positioning: MetaPositioning
  adaptationSuggestions: string[]
}

export interface MetaMatchup {
  archetype: string
  winRate: number
  gameCount: number
  keyCards: string[]
  strategy: string
}

export interface MetaPositioning {
  tier: number
  competitiveViability: number
  metaShare: number
  trendDirection: 'up' | 'stable' | 'down'
}

export interface PerformanceData {
  gamesPlayed: number
  winRate: number
  averageGameLength: number
  
  matchupData: Record<string, MatchupStats>
  performanceTrends: PerformanceTrend[]
  keyMetrics: Record<string, number>
}

export interface MatchupStats {
  wins: number
  losses: number
  draws: number
  winRate: number
  averageGameLength: number
}

export interface PerformanceTrend {
  date: Date
  winRate: number
  gamesPlayed: number
  averageGameLength: number
}

export interface OptimizationSuggestion {
  type: 'add' | 'remove' | 'replace'
  cardId?: string
  replacementId?: string
  category: string
  reasoning: string
  impact: number
  confidence: number
}

export interface GoldfishSimulation {
  id: string
  deckId: string
  userId: string
  simulationRuns: number
  openingHandStats: OpeningHandStats
  earlyGameStats: EarlyGameStats
  keepableHands: number
  averageTurnToPlay: Record<string, number>
  mulliganRate: number
  gameplayConsistency: number
  simulationParameters: SimulationParameters
  createdAt: Date
}

export interface SimulationParameters {
  iterations: number
  mulliganStrategy: 'aggressive' | 'conservative' | 'balanced'
  playPattern: 'curve' | 'combo' | 'control'
  opponentPressure: 'low' | 'medium' | 'high'
}

export interface GameResult {
  id: string
  userId: string
  deckId: string
  opponent?: string
  opponentDeck?: string
  result: 'win' | 'loss' | 'draw'
  gameLength?: number
  format: string
  notes?: string
  metadata?: Record<string, any>
  playedAt: Date
}

// =====================================================
// SOCIAL AND COMMUNITY TYPES
// =====================================================

export interface PublicDeck {
  id: string
  deckId: string
  name: string
  description?: string
  commander: string
  format: string
  
  // Author information
  userId: string
  authorName: string
  authorAvatar?: string
  
  // Deck data
  cardCount: number
  estimatedBudget?: number
  powerLevel?: number
  archetype?: string
  tags: string[]
  
  // Community metrics
  views: number
  likes: number
  comments: number
  copies: number
  rating: number
  
  // Status
  isActive: boolean
  
  // Timestamps
  publishedAt: Date
  lastUpdated: Date
}

export interface DeckComment {
  id: string
  publicDeckId: string
  userId: string
  userName: string
  userAvatar?: string
  
  content: string
  parentId?: string
  replies: DeckComment[]
  
  likes: number
  isEdited: boolean
  isDeleted: boolean
  
  createdAt: Date
  updatedAt: Date
}

export interface UserProfile {
  id: string
  userId: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  
  // Deck building stats
  totalDecks: number
  publicDecks: number
  totalLikes: number
  totalViews: number
  
  // Preferences
  favoriteFormats: string[]
  favoriteArchetypes: string[]
  brewingStyle: string[]
  
  // Social
  followers: number
  following: number
  
  // Achievements
  achievements: Achievement[]
  
  // Status
  isPublic: boolean
  
  createdAt: Date
  lastActive: Date
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic'
  unlockedAt: Date
}

export interface UserFollow {
  id: string
  followerId: string
  followingId: string
  createdAt: Date
}

export interface DeckLike {
  id: string
  userId: string
  publicDeckId: string
  createdAt: Date
}

export interface CommentLike {
  id: string
  userId: string
  commentId: string
  createdAt: Date
}

export interface TrendingData {
  decks: TrendingDeck[]
  cards: TrendingCard[]
  archetypes: TrendingArchetype[]
  commanders: TrendingCommander[]
  
  timeframe: 'day' | 'week' | 'month'
  lastUpdated: Date
}

export interface TrendingDeck {
  id: string
  name: string
  commander: string
  archetype: string
  score: number
  trend: 'up' | 'stable' | 'down'
}

export interface TrendingCard {
  cardId: string
  name: string
  score: number
  trend: 'up' | 'stable' | 'down'
  playRate: number
  winRate: number
}

export interface TrendingArchetype {
  name: string
  score: number
  trend: 'up' | 'stable' | 'down'
  metaShare: number
  winRate: number
}

export interface TrendingCommander {
  cardId: string
  name: string
  score: number
  trend: 'up' | 'stable' | 'down'
  deckCount: number
  winRate: number
}

// =====================================================
// PERFORMANCE AND CACHING TYPES
// =====================================================

export interface PerformanceMetric {
  id: string
  userId?: string
  operation: string
  duration: number
  success: boolean
  errorMessage?: string
  metadata?: Record<string, any>
  timestamp: Date
}

export interface CacheEntry {
  id: string
  key: string
  value: any
  tags: string[]
  expiresAt?: Date
  hitCount: number
  lastAccessed: Date
  createdAt: Date
}

export interface BackgroundJob {
  id: string
  type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: number
  data: Record<string, any>
  result?: Record<string, any>
  error?: string
  attempts: number
  maxAttempts: number
  scheduledFor?: Date
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
}

export interface SystemHealth {
  id: string
  component: string
  status: 'healthy' | 'warning' | 'critical'
  metrics: Record<string, any>
  message?: string
  timestamp: Date
}

// =====================================================
// BULK OPERATIONS TYPES
// =====================================================

export interface BulkOperation {
  type: 'export' | 'delete' | 'move' | 'clone' | 'tag'
  deckIds: string[]
  parameters: Record<string, any>
}

export interface BulkOperationResult {
  success: boolean
  processedCount: number
  errorCount: number
  errors: BulkOperationError[]
  results: Record<string, any>
}

export interface BulkOperationError {
  deckId: string
  error: string
  context?: Record<string, any>
}

// =====================================================
// SHARING AND COLLABORATION TYPES
// =====================================================

export interface SharingSettings {
  isPublic: boolean
  allowComments: boolean
  allowCopying: boolean
  showPrices: boolean
  description: string
  tags: string[]
}

export interface CollaborationInvite {
  id: string
  deckId: string
  inviterId: string
  inviteeId: string
  permissions: CollaborationPermissions
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  createdAt: Date
  expiresAt: Date
}

export interface CollaborationPermissions {
  canEdit: boolean
  canComment: boolean
  canShare: boolean
  canDelete: boolean
}

// =====================================================
// COMMUNITY FILTERS AND SEARCH TYPES
// =====================================================

export interface CommunityFilters {
  format?: string[]
  archetype?: string[]
  powerLevel?: [number, number]
  budget?: [number, number]
  colors?: string[]
  tags?: string[]
  sortBy?: 'newest' | 'popular' | 'rating' | 'views'
  timeframe?: 'day' | 'week' | 'month' | 'all'
}

export interface DeckSearchResult {
  decks: PublicDeck[]
  totalCount: number
  hasMore: boolean
  filters: CommunityFilters
}

// =====================================================
// MOBILE OPTIMIZATION TYPES
// =====================================================

export interface MobileLayoutPreferences {
  cardListView: 'compact' | 'detailed' | 'grid'
  statisticsLayout: 'tabs' | 'accordion' | 'scroll'
  touchSensitivity: 'low' | 'medium' | 'high'
  gestureEnabled: boolean
}

export interface TouchSettings {
  swipeToDelete: boolean
  longPressActions: boolean
  doubleTapZoom: boolean
  pinchToZoom: boolean
}

// =====================================================
// VALIDATION AND ERROR TYPES
// =====================================================

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface APIError {
  message: string
  code: string
  details?: Record<string, any>
}

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: APIError
  metadata?: Record<string, any>
}
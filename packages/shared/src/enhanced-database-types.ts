// Enhanced Database Types
// This file contains enhanced versions of database models with computed properties and methods

import type {
  DeckFolder,
  DeckTemplate,
  EnhancedCardData,
  ImportJob,
  ExportJob,
  DeckAnalytics,
  GoldfishSimulation,
  PublicDeck,
  UserProfile,
  PricePoint,
  RelatedCard,
  OptimizationSuggestion,
  PerformanceMetric,
  CacheEntry
} from './moxfield-parity-types'

import type {
  CardSynergy
} from './types'

// =====================================================
// ENHANCED DECK ORGANIZATION TYPES
// =====================================================

export interface EnhancedDeckFolder extends Omit<DeckFolder, 'children'> {
  children: EnhancedDeckFolder[]
  deckCount: number
  totalDecks: number // includes nested folders
  depth: number
  path: string[] // array of folder names from root
  isRoot: boolean
  canDelete: boolean
  canMove: boolean
}

export interface EnhancedDeckTemplate extends DeckTemplate {
  // Computed properties
  categoryCount: number
  coreCardCount: number
  flexSlotCount: number
  completionPercentage: number
  
  // Template statistics
  averageUsageRating: number
  lastUsed?: Date
  successRate: number // percentage of successful deck generations
  
  // Validation
  isValid: boolean
  validationErrors: string[]
  
  // Methods (these would be implemented in service layer)
  canUse: (userId: string) => boolean
  canEdit: (userId: string) => boolean
  canDelete: (userId: string) => boolean
}

// =====================================================
// ENHANCED CARD DATABASE TYPES
// =====================================================

export interface EnhancedCardDataWithMetrics extends EnhancedCardData {
  // Computed metrics
  priceVolatility: number
  priceDirection: 'up' | 'down' | 'stable'
  popularityDirection: 'rising' | 'falling' | 'stable'
  
  // Market intelligence
  isRecommendedBuy: boolean
  priceTarget?: number
  reprints: ReprintInfo[]
  
  // Usage statistics
  deckUsageCount: number
  winRateContribution: number
  synergyStrength: number
  
  // Availability
  isAvailable: boolean
  estimatedRestockDate?: Date
  alternativeCards: string[]
  
  // Methods
  getPriceHistory: (days: number) => PricePoint[]
  getPopularityTrend: (days: number) => PopularityPoint[]
  getSynergyCards: (limit?: number) => RelatedCard[]
}

export interface ReprintInfo {
  setCode: string
  setName: string
  expectedDate: Date
  confirmed: boolean
  priceImpact: 'high' | 'medium' | 'low'
}

export interface PopularityPoint {
  date: Date
  score: number
  playRate: number
  winRate: number
}

// =====================================================
// ENHANCED IMPORT/EXPORT TYPES
// =====================================================

export interface EnhancedImportJob extends ImportJob {
  // Progress tracking
  progressPercentage: number
  currentStep: string
  estimatedTimeRemaining?: number
  
  // Results analysis
  successRate: number
  mostCommonErrors: string[]
  suggestedFixes: string[]
  
  // Retry information
  canRetry: boolean
  retryCount: number
  maxRetries: number
  
  // Methods
  canCancel: () => boolean
  getDetailedErrors: () => DetailedImportError[]
  getProcessingStats: () => ImportProcessingStats
}

export interface DetailedImportError {
  type: string
  message: string
  cardName?: string
  deckName?: string
  lineNumber?: number
  suggestedFix?: string
  canAutoFix: boolean
}

export interface ImportProcessingStats {
  totalLines: number
  processedLines: number
  skippedLines: number
  errorLines: number
  warningLines: number
  processingRate: number // lines per second
}

export interface EnhancedExportJob extends ExportJob {
  // Progress tracking
  progressPercentage: number
  currentDeck: string
  estimatedTimeRemaining?: number
  
  // File information
  previewUrl?: string
  thumbnailUrl?: string
  fileFormat: string
  compressionRatio?: number
  
  // Download statistics
  downloadCount: number
  lastDownloaded?: Date
  
  // Methods
  canCancel: () => boolean
  getPreview: () => string
  getDownloadStats: () => DownloadStats
}

export interface DownloadStats {
  totalDownloads: number
  uniqueDownloaders: number
  averageDownloadTime: number
  popularityScore: number
}

// =====================================================
// ENHANCED ANALYTICS TYPES
// =====================================================

export interface EnhancedDeckAnalytics extends DeckAnalytics {
  // Analysis status
  isUpToDate: boolean
  needsRefresh: boolean
  analysisAge: number // hours since last analysis
  
  // Confidence scores
  manaAnalysisConfidence: number
  metaAnalysisConfidence: number
  performanceConfidence: number
  
  // Comparison data
  similarDecks: SimilarDeckInfo[]
  metaComparison: MetaComparisonData
  improvementPotential: number
  
  // Trend analysis
  performanceTrend: 'improving' | 'declining' | 'stable'
  metaPositionTrend: 'rising' | 'falling' | 'stable'
  
  // Methods
  getOptimizationPriority: () => OptimizationPriority[]
  getWeakestAreas: () => WeaknessArea[]
  getStrengthAreas: () => StrengthArea[]
}

export interface SimilarDeckInfo {
  deckId: string
  deckName: string
  similarity: number
  keyDifferences: string[]
  performanceComparison: number
}

export interface MetaComparisonData {
  tierPosition: number
  metaShare: number
  winRateVsMeta: number
  popularityRank: number
  competitiveViability: number
}

export interface OptimizationPriority {
  area: string
  impact: number
  difficulty: number
  cost: number
  timeToImplement: number
}

export interface WeaknessArea {
  category: string
  severity: number
  description: string
  suggestedFixes: string[]
}

export interface StrengthArea {
  category: string
  strength: number
  description: string
  leverageOpportunities: string[]
}

export interface EnhancedGoldfishSimulation extends GoldfishSimulation {
  // Simulation status
  isComplete: boolean
  progressPercentage: number
  estimatedTimeRemaining?: number
  
  // Result analysis
  confidenceLevel: number
  statisticalSignificance: number
  recommendedIterations: number
  
  // Comparison data
  previousResults?: GoldfishSimulation
  improvementSuggestions: SimulationImprovement[]
  
  // Performance metrics
  simulationSpeed: number // iterations per second
  memoryUsage: number
  
  // Methods
  canRerun: () => boolean
  getDetailedStats: () => DetailedSimulationStats
  compareWith: (other: GoldfishSimulation) => SimulationComparison
}

export interface SimulationImprovement {
  type: 'mana_base' | 'curve' | 'consistency' | 'speed'
  description: string
  expectedImprovement: number
  implementationCost: number
}

export interface DetailedSimulationStats {
  handQuality: HandQualityStats
  manaConsistency: ManaConsistencyStats
  gameplayFlow: GameplayFlowStats
  bottlenecks: BottleneckAnalysis[]
}

export interface HandQualityStats {
  averagePlayables: number
  averageLands: number
  averageCMC: number
  keepRate: number
  mulliganReasons: Record<string, number>
}

export interface ManaConsistencyStats {
  colorConsistency: Record<string, number>
  curveConsistency: number
  rampConsistency: number
  fixingEfficiency: number
}

export interface GameplayFlowStats {
  averageTurnToFirstSpell: number
  averageTurnToCommander: number
  averageTurnToWinCon: number
  gameplayVariance: number
}

export interface BottleneckAnalysis {
  turn: number
  issue: string
  frequency: number
  impact: number
  solutions: string[]
}

export interface SimulationComparison {
  improvementAreas: string[]
  regressionAreas: string[]
  overallChange: number
  significance: number
}

// =====================================================
// ENHANCED SOCIAL TYPES
// =====================================================

export interface EnhancedPublicDeck extends PublicDeck {
  // Engagement metrics
  engagementRate: number
  shareRate: number
  copyRate: number
  
  // Quality indicators
  qualityScore: number
  completenessScore: number
  originalityScore: number
  
  // Community feedback
  averageRating: number
  ratingCount: number
  featuredScore: number
  
  // Trend analysis
  viewsTrend: 'rising' | 'falling' | 'stable'
  popularityTrend: 'rising' | 'falling' | 'stable'
  
  // Competitive metrics
  tournamentResults: TournamentResult[]
  metaRelevance: number
  
  // Methods
  canEdit: (userId: string) => boolean
  canDelete: (userId: string) => boolean
  canFeature: (userId: string) => boolean
  getEngagementStats: () => EngagementStats
}

export interface TournamentResult {
  tournamentName: string
  placement: number
  totalPlayers: number
  date: Date
  format: string
}

export interface EngagementStats {
  dailyViews: number[]
  weeklyViews: number[]
  monthlyViews: number[]
  commentEngagement: number
  likeEngagement: number
  shareEngagement: number
}

export interface EnhancedUserProfile extends UserProfile {
  // Activity metrics
  activityScore: number
  contributionScore: number
  helpfulnessScore: number
  
  // Reputation system
  reputationLevel: number
  trustScore: number
  expertiseAreas: string[]
  
  // Social metrics
  engagementRate: number
  followerGrowthRate: number
  contentQuality: number
  
  // Achievements progress
  nextAchievements: NextAchievement[]
  achievementProgress: Record<string, number>
  
  // Privacy and preferences
  privacySettings: PrivacySettings
  notificationPreferences: NotificationPreferences
  
  // Methods
  canFollow: (userId: string) => boolean
  canMessage: (userId: string) => boolean
  getActivitySummary: () => ActivitySummary
}

export interface NextAchievement {
  id: string
  name: string
  description: string
  progress: number
  target: number
  estimatedCompletion: Date
}

export interface PrivacySettings {
  showEmail: boolean
  showActivity: boolean
  showDecks: boolean
  showFollowers: boolean
  allowMessages: boolean
  allowFollows: boolean
}

export interface NotificationPreferences {
  emailNotifications: boolean
  pushNotifications: boolean
  deckComments: boolean
  deckLikes: boolean
  newFollowers: boolean
  achievements: boolean
  systemUpdates: boolean
}

export interface ActivitySummary {
  decksCreated: number
  decksShared: number
  commentsPosted: number
  likesGiven: number
  helpfulComments: number
  featuredDecks: number
}

// =====================================================
// ENHANCED DECK TYPES
// =====================================================

export interface EnhancedDeckWithAnalytics {
  id: string
  userId: string
  name: string
  commander: string
  format: string
  // Real-time computed properties
  cardCount: number
  averageCMC: number
  colorDistribution: Record<string, number>
  typeDistribution: Record<string, number>
  
  // Performance metrics
  winRate: number
  playRate: number
  metaShare: number
  
  // AI insights
  strengthScore: number
  consistencyScore: number
  innovationScore: number
  
  // Maintenance status
  needsUpdate: boolean
  lastOptimized: Date
  optimizationScore: number
  
  // Collection integration
  ownedPercentage: number
  missingCards: EnhancedDeckCardWithMetrics[]
  totalValue: number
  
  // Methods
  canOptimize: () => boolean
  getOptimizationSuggestions: () => OptimizationSuggestion[]
  calculateUpgradeCost: () => number
  getAlternativeCards: () => AlternativeCard[]
}

export interface EnhancedDeckCardWithMetrics {
  id: string
  deckId: string
  cardId: string
  quantity: number
  category: string
  role: string
  // Card performance in deck
  synergyRating: number
  replacementPriority: number
  metaRelevance: number
  
  // Market information
  currentMarketPrice: number
  priceHistory: PricePoint[]
  availability: string
  
  // Alternative suggestions
  upgrades: AlternativeCard[]
  budgetOptions: AlternativeCard[]
  sidegrades: AlternativeCard[]
  
  // Usage statistics
  playRate: number
  winRateWhenDrawn: number
  averageTurnPlayed: number
  
  // Methods
  canReplace: () => boolean
  getReplacementOptions: () => AlternativeCard[]
  calculateSynergyWith: (cardId: string) => number
}

export interface AlternativeCard {
  cardId: string
  name: string
  reason: string
  improvement: number
  cost: number
  availability: string
  confidence: number
}

// =====================================================
// PERFORMANCE AND CACHING ENHANCED TYPES
// =====================================================

export interface EnhancedPerformanceMetric extends PerformanceMetric {
  // Trend analysis
  trend: 'improving' | 'degrading' | 'stable'
  percentileRank: number
  
  // Comparison data
  averageForOperation: number
  bestPerformance: number
  worstPerformance: number
  
  // Alert information
  isAlert: boolean
  alertLevel: 'info' | 'warning' | 'critical'
  alertMessage?: string
}

export interface EnhancedCacheEntry extends CacheEntry {
  // Performance metrics
  hitRate: number
  missRate: number
  averageAccessTime: number
  
  // Efficiency metrics
  memoryEfficiency: number
  compressionRatio: number
  
  // Lifecycle information
  timeToLive: number
  refreshRate: number
  staleness: number
  
  // Methods
  shouldRefresh: () => boolean
  getEfficiencyScore: () => number
  canEvict: () => boolean
}

// =====================================================
// UTILITY TYPES FOR ENHANCED MODELS
// =====================================================

export interface ModelWithTimestamps {
  createdAt: Date
  updatedAt: Date
}

export interface ModelWithUser {
  userId: string
  user?: {
    id: string
    name?: string
    email: string
    image?: string
  }
}

export interface ModelWithSoftDelete {
  isDeleted: boolean
  deletedAt?: Date
}

export interface ModelWithVersioning {
  version: number
  previousVersionId?: string
}

export interface ModelWithAudit {
  createdBy: string
  updatedBy: string
  auditLog: AuditLogEntry[]
}

export interface AuditLogEntry {
  action: string
  userId: string
  timestamp: Date
  changes: Record<string, { from: any; to: any }>
  metadata?: Record<string, any>
}

// =====================================================
// COMPUTED PROPERTY HELPERS
// =====================================================

export interface ComputedProperties {
  // Deck-related computations
  calculateDeckStats: (cards: EnhancedDeckCardWithMetrics[]) => DeckStats
  calculateSynergies: (cards: EnhancedDeckCardWithMetrics[]) => EnhancedCardSynergy[]
  calculateManaBase: (cards: EnhancedDeckCardWithMetrics[]) => ManaBaseAnalysis
  
  // User-related computations
  calculateUserStats: (profile: UserProfile) => UserStats
  calculateReputation: (activities: ActivitySummary[]) => ReputationScore
  
  // Performance computations
  calculateTrends: (metrics: PerformanceMetric[]) => TrendAnalysis
  calculateEfficiency: (operations: PerformanceMetric[]) => EfficiencyScore
}

export interface DeckStats {
  totalCards: number
  averageCMC: number
  colorDistribution: Record<string, number>
  typeDistribution: Record<string, number>
  rarityDistribution: Record<string, number>
  estimatedValue: number
}

export interface EnhancedCardSynergy extends CardSynergy {
  contextualStrength: number
  metaRelevance: number
  implementationCost: number
}

export interface ManaBaseAnalysis {
  totalLands: number
  colorProduction: Record<string, number>
  fixingLands: number
  utilityLands: number
  averageETB: number
  consistency: number
}

export interface UserStats {
  totalActivity: number
  averageRating: number
  contributionScore: number
  expertiseLevel: number
  communityImpact: number
}

export interface ReputationScore {
  overall: number
  helpfulness: number
  expertise: number
  trustworthiness: number
  activity: number
}

export interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable'
  strength: number
  confidence: number
  projectedValue: number
  timeframe: number
}

export interface EfficiencyScore {
  overall: number
  speed: number
  reliability: number
  resourceUsage: number
  scalability: number
}
/**
 * Core Service Layer Interfaces
 * 
 * This file defines the fundamental interfaces for the service layer architecture,
 * supporting deck organization, analytics, community features, and enterprise-grade
 * performance requirements.
 */

import { z } from 'zod'

// ============================================================================
// Base Service Interface
// ============================================================================

export interface BaseService {
  readonly name: string
  readonly version: string
  initialize(): Promise<void>
  shutdown(): Promise<void>
  healthCheck(): Promise<ServiceHealthStatus>
}

export interface ServiceHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  message?: string
  metrics?: Record<string, number>
  timestamp: Date
}

// ============================================================================
// Dependency Injection Container
// ============================================================================

export interface ServiceContainer {
  register<T extends BaseService>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ServiceRegistrationOptions
  ): void
  
  resolve<T extends BaseService>(token: ServiceToken<T>): Promise<T>
  unregister<T extends BaseService>(token: ServiceToken<T>): void
  
  start(): Promise<void>
  stop(): Promise<void>
  
  getHealthStatus(): Promise<Record<string, ServiceHealthStatus>>
}

export interface ServiceToken<T extends BaseService> {
  readonly name: string
  readonly type: new (...args: any[]) => T
}

export interface ServiceFactory<T extends BaseService> {
  (): Promise<T>
}

export interface ServiceRegistrationOptions {
  singleton?: boolean
  lazy?: boolean
  dependencies?: ServiceToken<any>[]
}

// ============================================================================
// Error Handling and Logging
// ============================================================================

export interface Logger {
  debug(message: string, meta?: LogMeta): void
  info(message: string, meta?: LogMeta): void
  warn(message: string, meta?: LogMeta): void
  error(message: string, error?: Error, meta?: LogMeta): void
  
  child(context: LogContext): Logger
}

export interface LogMeta {
  [key: string]: any
}

export interface LogContext {
  service?: string
  userId?: string
  requestId?: string
  operation?: string
  [key: string]: any
}

export interface ErrorHandler {
  handle(error: Error, context?: ErrorContext): Promise<void>
  register(errorType: new (...args: any[]) => Error, handler: ErrorHandlerFunction): void
}

export interface ErrorContext {
  service: string
  operation: string
  userId?: string
  requestId?: string
  metadata?: Record<string, any>
}

export type ErrorHandlerFunction = (error: Error, context: ErrorContext) => Promise<void>

// ============================================================================
// Background Job Processing
// ============================================================================

export interface JobProcessor {
  schedule<T = any>(job: Job<T>): Promise<string>
  process<T = any>(jobType: string, handler: JobHandler<T>): void
  cancel(jobId: string): Promise<boolean>
  
  getJobStatus(jobId: string): Promise<JobStatus | null>
  getQueueStats(): Promise<QueueStats>
}

export interface Job<T = any> {
  type: string
  data: T
  options?: JobOptions
}

export interface JobOptions {
  delay?: number
  attempts?: number
  priority?: number
  removeOnComplete?: boolean
  removeOnFail?: boolean
  timeout?: number
}

export interface JobStatus {
  id: string
  type: string
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress?: number
  result?: any
  error?: string
  createdAt: Date
  processedAt?: Date
  completedAt?: Date
}

export interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export type JobHandler<T = any> = (data: T, job: JobContext) => Promise<any>

export interface JobContext {
  id: string
  updateProgress(progress: number): Promise<void>
  log(message: string, level?: 'info' | 'warn' | 'error'): void
}

// ============================================================================
// Intelligent Caching Layer
// ============================================================================

export interface CacheService {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>
  delete(key: string): Promise<boolean>
  clear(pattern?: string): Promise<number>
  
  getMulti<T>(keys: string[]): Promise<Record<string, T | null>>
  setMulti<T>(entries: Record<string, T>, options?: CacheOptions): Promise<void>
  
  exists(key: string): Promise<boolean>
  ttl(key: string): Promise<number>
  
  invalidateTag(tag: string): Promise<number>
  getStats(): Promise<CacheStats>
}

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  tags?: string[] // Cache tags for invalidation
  compress?: boolean
  serialize?: boolean
}

export interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  memoryUsage: number
  keyCount: number
}

// ============================================================================
// Performance Monitoring and Metrics
// ============================================================================

export interface MetricsCollector {
  increment(metric: string, value?: number, tags?: Record<string, string>): void
  decrement(metric: string, value?: number, tags?: Record<string, string>): void
  gauge(metric: string, value: number, tags?: Record<string, string>): void
  histogram(metric: string, value: number, tags?: Record<string, string>): void
  timing(metric: string, duration: number, tags?: Record<string, string>): void
  
  startTimer(metric: string, tags?: Record<string, string>): Timer
  
  getMetrics(): Promise<MetricSnapshot[]>
  flush(): Promise<void>
}

export interface Timer {
  stop(tags?: Record<string, string>): void
}

export interface MetricSnapshot {
  name: string
  type: 'counter' | 'gauge' | 'histogram' | 'timer'
  value: number
  tags: Record<string, string>
  timestamp: Date
}

export interface PerformanceMonitor {
  trackOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: PerformanceContext
  ): Promise<T>
  
  recordMetric(metric: PerformanceMetric): void
  getPerformanceReport(timeRange?: TimeRange): Promise<PerformanceReport>
  
  startProfiling(operation: string): ProfileSession
  stopProfiling(sessionId: string): Promise<ProfileResult>
}

export interface PerformanceContext {
  userId?: string
  operation: string
  metadata?: Record<string, any>
}

export interface PerformanceMetric {
  operation: string
  duration: number
  success: boolean
  error?: string
  metadata?: Record<string, any>
  timestamp: Date
}

export interface TimeRange {
  start: Date
  end: Date
}

export interface PerformanceReport {
  operations: OperationStats[]
  summary: PerformanceSummary
  timeRange: TimeRange
}

export interface OperationStats {
  operation: string
  count: number
  averageDuration: number
  p50Duration: number
  p95Duration: number
  p99Duration: number
  successRate: number
  errorRate: number
}

export interface PerformanceSummary {
  totalOperations: number
  averageResponseTime: number
  errorRate: number
  throughput: number
}

export interface ProfileSession {
  id: string
  operation: string
  startTime: Date
}

export interface ProfileResult {
  sessionId: string
  operation: string
  duration: number
  memoryUsage: MemoryUsage
  cpuUsage: number
  breakdown: ProfileBreakdown[]
}

export interface MemoryUsage {
  heapUsed: number
  heapTotal: number
  external: number
}

export interface ProfileBreakdown {
  function: string
  duration: number
  percentage: number
  calls: number
}

// ============================================================================
// Deck Organization Service Interface
// ============================================================================

export interface DeckOrganizationService extends BaseService {
  // Folder management
  createFolder(userId: string, folder: CreateFolderRequest): Promise<DeckFolder>
  updateFolder(userId: string, folderId: string, updates: UpdateFolderRequest): Promise<DeckFolder>
  deleteFolder(userId: string, folderId: string): Promise<void>
  getFolders(userId: string): Promise<DeckFolder[]>
  getFolderTree(userId: string): Promise<FolderTree>
  
  // Deck organization
  moveDecks(userId: string, deckIds: string[], folderId: string): Promise<void>
  organizeDeck(userId: string, deckId: string, organization: DeckOrganization): Promise<void>
  
  // Bulk operations
  bulkImport(userId: string, operation: BulkImportOperation): Promise<BulkOperationResult>
  bulkExport(userId: string, operation: BulkExportOperation): Promise<BulkOperationResult>
  bulkDelete(userId: string, deckIds: string[]): Promise<BulkOperationResult>
  
  // Search and filtering
  searchDecks(userId: string, query: DeckSearchQuery): Promise<DeckSearchResult>
  getRecentDecks(userId: string, limit?: number): Promise<DeckSummary[]>
}

// ============================================================================
// Analytics Service Interface
// ============================================================================

export interface AnalyticsService extends BaseService {
  // Deck analysis
  analyzeDeck(deckId: string, options?: AnalysisOptions): Promise<DeckAnalysis>
  getAnalysisHistory(deckId: string): Promise<AnalysisHistory[]>
  
  // Performance tracking
  recordGameResult(result: GameResult): Promise<void>
  getPerformanceStats(deckId: string, timeRange?: TimeRange): Promise<PerformanceStats>
  
  // Meta analysis
  getMetaAnalysis(format: string, timeRange?: TimeRange): Promise<MetaAnalysis>
  compareToMeta(deckId: string): Promise<MetaComparison>
  
  // Optimization suggestions
  getOptimizationSuggestions(deckId: string): Promise<OptimizationSuggestion[]>
  applyOptimization(deckId: string, suggestionId: string): Promise<OptimizationResult>
}

// ============================================================================
// Community Service Interface
// ============================================================================

export interface CommunityService extends BaseService {
  // Deck sharing
  publishDeck(userId: string, deckId: string, settings: PublishSettings): Promise<PublicDeck>
  unpublishDeck(userId: string, deckId: string): Promise<void>
  updatePublicDeck(userId: string, deckId: string, updates: PublicDeckUpdate): Promise<PublicDeck>
  
  // Discovery
  discoverDecks(query: DiscoveryQuery): Promise<DiscoveryResult>
  getTrendingDecks(timeframe: TrendingTimeframe): Promise<TrendingDeck[]>
  getRecommendedDecks(userId: string): Promise<RecommendedDeck[]>
  
  // Social interactions
  likeDeck(userId: string, deckId: string): Promise<void>
  unlikeDeck(userId: string, deckId: string): Promise<void>
  commentOnDeck(userId: string, deckId: string, comment: string): Promise<DeckComment>
  followUser(userId: string, targetUserId: string): Promise<void>
  unfollowUser(userId: string, targetUserId: string): Promise<void>
  
  // User profiles
  getUserProfile(userId: string): Promise<UserProfile>
  updateUserProfile(userId: string, updates: ProfileUpdate): Promise<UserProfile>
  getUserActivity(userId: string, limit?: number): Promise<UserActivity[]>
}

// ============================================================================
// Supporting Types
// ============================================================================

// Deck Organization Types
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

export interface FolderTree {
  root: DeckFolder[]
  totalFolders: number
  totalDecks: number
}

export interface CreateFolderRequest {
  name: string
  description?: string
  color?: string
  parentId?: string
}

export interface UpdateFolderRequest {
  name?: string
  description?: string
  color?: string
  parentId?: string
}

export interface DeckOrganization {
  folderId?: string
  tags?: string[]
  notes?: string
  priority?: number
}

export interface BulkImportOperation {
  source: 'moxfield' | 'archidekt' | 'tappedout' | 'csv' | 'text'
  data: string
  options: ImportOptions
}

export interface BulkExportOperation {
  deckIds: string[]
  format: 'moxfield' | 'archidekt' | 'csv' | 'text'
  options: ExportOptions
}

export interface BulkOperationResult {
  success: boolean
  processed: number
  failed: number
  errors: string[]
  results?: any[]
}

export interface ImportOptions {
  overwriteExisting?: boolean
  preserveCategories?: boolean
  defaultFolder?: string
}

export interface ExportOptions {
  includePrivateNotes?: boolean
  includeCategories?: boolean
  format?: 'tournament' | 'casual' | 'proxy'
}

export interface DeckSearchQuery {
  text?: string
  format?: string
  colors?: string[]
  tags?: string[]
  folderId?: string
  sortBy?: 'name' | 'updated' | 'created' | 'format'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface DeckSearchResult {
  decks: DeckSummary[]
  total: number
  hasMore: boolean
}

export interface DeckSummary {
  id: string
  name: string
  format: string
  commander?: string
  colors: string[]
  tags: string[]
  folderId?: string
  updatedAt: Date
}

// Analytics Types
export interface AnalysisOptions {
  includeMetaComparison?: boolean
  includeSuggestions?: boolean
  forceRefresh?: boolean
}

export interface DeckAnalysis {
  deckId: string
  manaAnalysis: ManaAnalysis
  synergyAnalysis: SynergyAnalysis
  metaAnalysis: MetaAnalysis
  suggestions: OptimizationSuggestion[]
  timestamp: Date
}

export interface AnalysisHistory {
  id: string
  deckId: string
  analysis: DeckAnalysis
  createdAt: Date
}

export interface ManaAnalysis {
  curve: ManaCurvePoint[]
  colorDistribution: ColorDistribution
  consistency: number
  efficiency: number
}

export interface ManaCurvePoint {
  cmc: number
  count: number
  percentage: number
}

export interface ColorDistribution {
  [color: string]: number
}

export interface SynergyAnalysis {
  score: number
  keyInteractions: CardInteraction[]
  weaknesses: string[]
}

export interface CardInteraction {
  cards: string[]
  type: 'combo' | 'synergy' | 'support'
  strength: number
  description: string
}

export interface GameResult {
  deckId: string
  userId: string
  won: boolean
  turns: number
  opponents: string[]
  format: string
  notes?: string
  timestamp: Date
}

export interface PerformanceStats {
  winRate: number
  averageTurns: number
  gamesPlayed: number
  matchups: MatchupStats[]
  trends: PerformanceTrend[]
}

export interface MatchupStats {
  opponent: string
  wins: number
  losses: number
  winRate: number
}

export interface PerformanceTrend {
  date: Date
  winRate: number
  gamesPlayed: number
}

export interface MetaAnalysis {
  format: string
  topDecks: MetaDeck[]
  trends: MetaTrend[]
  recommendations: string[]
}

export interface MetaDeck {
  archetype: string
  percentage: number
  winRate: number
  trend: 'rising' | 'stable' | 'falling'
}

export interface MetaTrend {
  archetype: string
  change: number
  timeframe: string
}

export interface MetaComparison {
  deckArchetype: string
  metaPosition: number
  strengths: string[]
  weaknesses: string[]
  adaptations: string[]
}

export interface OptimizationSuggestion {
  id: string
  type: 'add' | 'remove' | 'replace'
  cards: string[]
  reasoning: string
  impact: 'low' | 'medium' | 'high'
  confidence: number
}

export interface OptimizationResult {
  applied: boolean
  changes: DeckChange[]
  newAnalysis?: DeckAnalysis
}

export interface DeckChange {
  type: 'add' | 'remove' | 'replace'
  cardId: string
  quantity: number
  reason: string
}

// Community Types
export interface PublishSettings {
  isPublic: boolean
  allowComments: boolean
  allowCopying: boolean
  description?: string
  tags?: string[]
}

export interface PublicDeck {
  id: string
  name: string
  description?: string
  authorId: string
  authorName: string
  format: string
  commander?: string
  tags: string[]
  likes: number
  views: number
  comments: number
  publishedAt: Date
  updatedAt: Date
}

export interface PublicDeckUpdate {
  description?: string
  tags?: string[]
  allowComments?: boolean
  allowCopying?: boolean
}

export interface DiscoveryQuery {
  format?: string
  archetype?: string
  colors?: string[]
  budget?: [number, number]
  sortBy?: 'popular' | 'recent' | 'rating'
  limit?: number
  offset?: number
}

export interface DiscoveryResult {
  decks: PublicDeck[]
  total: number
  hasMore: boolean
}

export type TrendingTimeframe = 'day' | 'week' | 'month'

export interface TrendingDeck extends PublicDeck {
  trendScore: number
  recentLikes: number
  recentViews: number
}

export interface RecommendedDeck extends PublicDeck {
  recommendationScore: number
  reason: string
}

export interface DeckComment {
  id: string
  deckId: string
  userId: string
  userName: string
  content: string
  likes: number
  createdAt: Date
  updatedAt: Date
}

export interface UserProfile {
  id: string
  username: string
  displayName: string
  bio?: string
  avatar?: string
  deckCount: number
  followers: number
  following: number
  joinedAt: Date
}

export interface ProfileUpdate {
  displayName?: string
  bio?: string
  avatar?: string
}

export interface UserActivity {
  id: string
  userId: string
  type: 'deck_published' | 'deck_liked' | 'comment_posted' | 'user_followed'
  data: Record<string, any>
  timestamp: Date
}

// Validation Schemas
export const CreateFolderRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentId: z.string().uuid().optional()
})

export const DeckSearchQuerySchema = z.object({
  text: z.string().optional(),
  format: z.string().optional(),
  colors: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  folderId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'updated', 'created', 'format']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
})

export const PublishSettingsSchema = z.object({
  isPublic: z.boolean(),
  allowComments: z.boolean(),
  allowCopying: z.boolean(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional()
})
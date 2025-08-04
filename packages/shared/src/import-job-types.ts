/**
 * Import Job Processing System Types
 * 
 * Defines interfaces and types for the asynchronous import job processing system
 * with progress tracking, error handling, and conflict resolution.
 */

export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type ImportJobType = 'single' | 'batch' | 'bulk'
export type ImportSource = 'moxfield' | 'archidekt' | 'tappedout' | 'edhrec' | 'mtggoldfish' | 'csv' | 'text' | 'custom'
export type ConflictResolution = 'skip' | 'overwrite' | 'merge' | 'rename' | 'ask_user'

// Core import job interfaces
export interface ImportJob {
  id: string
  userId: string
  type: ImportJobType
  source: ImportSource
  status: ImportJobStatus
  priority: number

  // Input data
  rawData?: string
  sourceUrl?: string
  fileName?: string
  fileSize?: number
  mimeType?: string

  // Processing configuration
  options: ImportJobOptions
  conflictResolution: ConflictResolution

  // Progress tracking
  progress: number
  currentStep?: string
  totalSteps?: number
  estimatedTimeRemaining?: number

  // Results
  decksFound: number
  decksImported: number
  cardsProcessed: number
  cardsResolved: number
  errors: ImportError[]
  warnings: ImportWarning[]

  // Metadata
  processingStartedAt?: Date
  processingCompletedAt?: Date
  processingTime?: number
  retryCount: number
  maxRetries: number
  nextRetryAt?: Date

  // Timestamps
  createdAt: Date
  updatedAt: Date

  // Relations
  items?: ImportJobItem[]
  conflicts?: ImportConflict[]
  preview?: ImportPreview
  history?: ImportHistory[]
}

export interface ImportJobItem {
  id: string
  importJobId: string
  itemIndex: number
  status: ImportJobStatus

  // Input data for this item
  rawData: string
  sourceIdentifier?: string

  // Processing results
  deckId?: string
  deckName?: string
  cardsFound: number
  cardsImported: number
  errors: ImportError[]
  warnings: ImportWarning[]

  // Timing
  processingStartedAt?: Date
  processingCompletedAt?: Date
  processingTime?: number

  // Timestamps
  createdAt: Date
  updatedAt: Date

  // Relations
  conflicts?: ImportConflict[]
}

export interface ImportConflict {
  id: string
  importJobId: string
  itemId?: string
  conflictType: string
  description: string
  existingData?: any
  newData?: any
  resolution?: ConflictResolution
  resolvedAt?: Date
  resolvedBy?: string

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface ImportPreview {
  id: string
  importJobId: string
  previewData: any
  decksPreview: PreviewDeck[]
  statistics: ImportPreviewStatistics
  warnings: ImportWarning[]
  conflicts: ImportConflict[]
  isApproved: boolean
  approvedAt?: Date
  expiresAt: Date

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface ImportHistory {
  id: string
  userId: string
  importJobId: string
  action: string
  description?: string
  metadata: Record<string, any>
  canRollback: boolean
  rollbackData?: any
  rolledBackAt?: Date

  // Timestamps
  createdAt: Date
}

export interface ImportAnalytics {
  id: string
  userId: string
  source: ImportSource
  jobType: ImportJobType
  status: ImportJobStatus
  decksCount: number
  cardsCount: number
  processingTime?: number
  errorCount: number
  warningCount: number
  successRate?: number
  fileSize?: number
  metadata: Record<string, any>

  // Timestamps
  createdAt: Date
}

export interface ImportTemplate {
  id: string
  userId: string
  name: string
  description?: string
  source: ImportSource
  template: any
  options: ImportJobOptions
  isPublic: boolean
  usageCount: number
  rating: number
  ratingCount: number

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

// Configuration and options
export interface ImportJobOptions {
  // Processing options
  validateCards?: boolean
  resolveCardNames?: boolean
  preserveCategories?: boolean
  includeMetadata?: boolean
  customFields?: string[]
  timeout?: number

  // Batch processing options
  batchSize?: number
  concurrency?: number
  continueOnError?: boolean

  // Conflict resolution
  defaultConflictResolution?: ConflictResolution
  autoResolveConflicts?: boolean

  // Preview options
  generatePreview?: boolean
  previewTimeout?: number

  // Rollback options
  enableRollback?: boolean
  rollbackTimeout?: number

  // Custom processing options
  customProcessors?: string[]
  processingHooks?: ProcessingHook[]
}

export interface ProcessingHook {
  stage: 'pre_parse' | 'post_parse' | 'pre_import' | 'post_import'
  handler: string
  options?: Record<string, any>
}

// Error and warning types
export interface ImportError {
  type: 'card_not_found' | 'invalid_format' | 'parsing_error' | 'validation_error' | 'conflict_error' | 'timeout_error' | 'system_error'
  message: string
  code?: string
  line?: number
  column?: number
  context?: string
  severity: 'error' | 'warning'
  recoverable?: boolean
  suggestions?: string[]
}

export interface ImportWarning {
  type: 'card_variant' | 'missing_metadata' | 'format_assumption' | 'data_loss' | 'performance_warning'
  message: string
  suggestion?: string
  context?: string
  impact?: 'low' | 'medium' | 'high'
}

// Preview types
export interface PreviewDeck {
  name: string
  commander?: string
  format: string
  cardCount: number
  estimatedValue?: number
  powerLevel?: number
  colors?: string[]
  archetype?: string
  warnings: ImportWarning[]
  conflicts: ImportConflict[]
}

export interface ImportPreviewStatistics {
  totalDecks: number
  totalCards: number
  uniqueCards: number
  resolvedCards: number
  unresolvedCards: number
  estimatedProcessingTime: number
  estimatedValue?: number
  formatDistribution: Record<string, number>
  colorDistribution: Record<string, number>
  rarityDistribution: Record<string, number>
}

// Job creation and management
export interface CreateImportJobRequest {
  type: ImportJobType
  source: ImportSource
  rawData?: string
  sourceUrl?: string
  file?: File
  options?: Partial<ImportJobOptions>
  priority?: number
}

export interface UpdateImportJobRequest {
  status?: ImportJobStatus
  conflictResolution?: ConflictResolution
  options?: Partial<ImportJobOptions>
  priority?: number
}

export interface ResolveConflictRequest {
  conflictId: string
  resolution: ConflictResolution
  customData?: any
}

export interface ApprovePreviewRequest {
  previewId: string
  approved: boolean
  conflictResolutions?: Record<string, ConflictResolution>
}

// Batch operations
export interface BatchImportRequest {
  items: BatchImportItem[]
  options?: Partial<ImportJobOptions>
  priority?: number
}

export interface BatchImportItem {
  source: ImportSource
  rawData?: string
  sourceUrl?: string
  file?: File
  identifier?: string
}

export interface BulkImportRequest {
  source: ImportSource
  files: File[]
  options?: Partial<ImportJobOptions>
  priority?: number
}

// Progress tracking
export interface ImportProgress {
  jobId: string
  status: ImportJobStatus
  progress: number
  currentStep?: string
  totalSteps?: number
  estimatedTimeRemaining?: number
  itemsCompleted: number
  itemsTotal: number
  errors: ImportError[]
  warnings: ImportWarning[]
  lastUpdated: Date
}

// Analytics and reporting
export interface ImportSuccessRate {
  source: ImportSource
  period: 'day' | 'week' | 'month' | 'year'
  totalJobs: number
  successfulJobs: number
  failedJobs: number
  successRate: number
  averageProcessingTime: number
  averageFileSize: number
  commonErrors: Array<{
    type: string
    count: number
    percentage: number
  }>
}

export interface ImportPerformanceMetrics {
  source: ImportSource
  averageProcessingTime: number
  averageCardsPerSecond: number
  averageMemoryUsage: number
  peakMemoryUsage: number
  errorRate: number
  timeoutRate: number
  retryRate: number
}

// Rollback operations
export interface RollbackOperation {
  id: string
  importJobId: string
  userId: string
  description: string
  rollbackData: any
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
}

export interface RollbackRequest {
  importJobId: string
  reason?: string
  selectiveRollback?: {
    deckIds?: string[]
    itemIds?: string[]
  }
}

// Template system
export interface ImportTemplateRequest {
  name: string
  description?: string
  source: ImportSource
  template: any
  options?: Partial<ImportJobOptions>
  isPublic?: boolean
}

export interface ImportTemplateRating {
  templateId: string
  userId: string
  rating: number
  review?: string
  createdAt: Date
}

// Event types for real-time updates
export interface ImportJobEvent {
  type: 'job_created' | 'job_started' | 'job_progress' | 'job_completed' | 'job_failed' | 'job_cancelled'
  jobId: string
  userId: string
  data: any
  timestamp: Date
}

export interface ImportConflictEvent {
  type: 'conflict_detected' | 'conflict_resolved'
  jobId: string
  conflictId: string
  userId: string
  data: any
  timestamp: Date
}

// Validation types
export interface ImportJobValidation {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  estimatedProcessingTime?: number
  estimatedMemoryUsage?: number
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
}

// Queue management
export interface ImportQueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  cancelled: number
  totalProcessingTime: number
  averageWaitTime: number
  queueLength: number
}

export interface ImportQueueConfiguration {
  maxConcurrentJobs: number
  maxQueueSize: number
  defaultTimeout: number
  retryAttempts: number
  retryDelay: number
  priorityLevels: number
  cleanupInterval: number
  maxHistoryAge: number
}
/**
 * Export Format Engine Types
 * 
 * Defines interfaces and types for the customizable export format system
 * that supports tournament lists, proxy sheets, and platform formats.
 */

export type ExportJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type ExportJobType = 'single' | 'batch' | 'bulk' | 'scheduled'
export type ExportFormat = 'text' | 'json' | 'moxfield' | 'archidekt' | 'tappedout' | 'edhrec' | 'mtggoldfish' | 'csv' | 'tournament' | 'proxy' | 'custom'
export type CompressionType = 'none' | 'zip' | 'gzip'

export interface ExportJob {
  id: string
  userId: string
  type: ExportJobType
  format: ExportFormat
  status: ExportJobStatus
  priority: number
  
  // Input data
  deckIds: string[]
  customFormatId?: string
  
  // Export configuration
  options: ExportOptions
  compression: CompressionType
  includeMetadata: boolean
  includeAnalysis: boolean
  includePricing: boolean
  includeAIInsights: boolean
  
  // Progress tracking
  progress: number
  currentStep?: string
  totalSteps?: number
  estimatedTimeRemaining?: number
  
  // Results
  decksProcessed: number
  totalDecks: number
  fileSize?: number
  downloadUrl?: string
  fileName?: string
  mimeType?: string
  expiresAt?: Date
  errors: ExportError[]
  warnings: ExportWarning[]
  
  // Metadata
  processingStartedAt?: Date
  processingCompletedAt?: Date
  processingTime?: number
  retryCount: number
  maxRetries: number
  nextRetryAt?: Date
  
  // Scheduling
  scheduledFor?: Date
  cronExpression?: string
  isRecurring: boolean
  lastRunAt?: Date
  nextRunAt?: Date
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface ExportJobItem {
  id: string
  exportJobId: string
  deckId: string
  itemIndex: number
  status: ExportJobStatus
  
  // Processing results
  deckName?: string
  cardsExported: number
  fileSize?: number
  errors: ExportError[]
  warnings: ExportWarning[]
  
  // Timing
  processingStartedAt?: Date
  processingCompletedAt?: Date
  processingTime?: number
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface ExportOptions {
  // Content options
  includeCommander?: boolean
  includeSideboard?: boolean
  includeTokens?: boolean
  includeBasicLands?: boolean
  groupByCategory?: boolean
  includeQuantities?: boolean
  includePrices?: boolean
  includeImages?: boolean
  includeRulings?: boolean
  includeLegalities?: boolean
  
  // Format-specific options
  customFields?: string[]
  categoryOrder?: string[]
  sortBy?: 'name' | 'cmc' | 'type' | 'color' | 'category'
  sortOrder?: 'asc' | 'desc'
  
  // Template options
  templateId?: string
  customTemplate?: string
  variables?: Record<string, any>
  
  // Output options
  fileName?: string
  compression?: CompressionType
  splitByDeck?: boolean
  maxFileSize?: number
  
  // Tournament-specific options
  includePlayerInfo?: boolean
  includeDeckRegistration?: boolean
  formatForJudges?: boolean
  
  // Proxy-specific options
  cardsPerPage?: number
  includeSetSymbols?: boolean
  highResolution?: boolean
  includeCollectorNumbers?: boolean
}

export interface CustomFormat {
  id: string
  userId: string
  name: string
  description?: string
  fileExtension: string
  mimeType: string
  template: string
  variables: CustomFormatVariable[]
  validation: CustomFormatValidation
  isPublic: boolean
  usageCount: number
  rating: number
  ratingCount: number
  tags: string[]
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface CustomFormatVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date'
  description: string
  required: boolean
  defaultValue?: any
  validation?: {
    min?: number
    max?: number
    pattern?: string
    options?: string[]
  }
}

export interface CustomFormatValidation {
  schema?: string
  rules: ValidationRule[]
}

export interface ValidationRule {
  field: string
  type: 'required' | 'format' | 'range' | 'custom'
  parameters: Record<string, any>
  message: string
}

export interface ExportTemplate {
  id: string
  userId: string
  name: string
  description?: string
  format: ExportFormat
  template: Record<string, any>
  options: ExportOptions
  isPublic: boolean
  usageCount: number
  rating: number
  ratingCount: number
  tags: string[]
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface ExportResult {
  success: boolean
  data: string | Buffer
  fileName: string
  mimeType: string
  fileSize: number
  compression?: CompressionType
  errors: ExportError[]
  warnings: ExportWarning[]
  metadata: ExportMetadata
}

export interface ExportError {
  type: 'format_error' | 'template_error' | 'data_error' | 'file_error' | 'compression_error'
  message: string
  context?: string
  deckId?: string
  cardName?: string
}

export interface ExportWarning {
  type: 'data_missing' | 'format_limitation' | 'template_fallback' | 'compression_issue'
  message: string
  suggestion?: string
  context?: string
}

export interface ExportMetadata {
  format: ExportFormat
  processingTime: number
  fileSize: number
  compression?: CompressionType
  compressionRatio?: number
  decksExported: number
  cardsExported: number
  templateUsed?: string
  customFormatUsed?: string
}

export interface ExportHistory {
  id: string
  userId: string
  exportJobId: string
  action: string
  description?: string
  metadata: Record<string, any>
  fileSize?: number
  downloadCount: number
  lastDownloadAt?: Date
  
  // Timestamps
  createdAt: Date
}

export interface ExportAnalytics {
  id: string
  userId: string
  format: ExportFormat
  jobType: ExportJobType
  status: ExportJobStatus
  decksCount: number
  cardsCount: number
  processingTime?: number
  fileSize?: number
  compressionRatio?: number
  downloadCount: number
  errorCount: number
  warningCount: number
  successRate?: number
  metadata: Record<string, any>
  
  // Timestamps
  createdAt: Date
}

export interface ExportSchedule {
  id: string
  userId: string
  name: string
  description?: string
  deckIds: string[]
  format: ExportFormat
  customFormatId?: string
  options: ExportOptions
  cronExpression: string
  timezone: string
  isActive: boolean
  lastRunAt?: Date
  nextRunAt?: Date
  runCount: number
  failureCount: number
  maxFailures: number
  notifyOnSuccess: boolean
  notifyOnFailure: boolean
  retentionDays: number
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface FormatRating {
  id: string
  userId: string
  customFormatId?: string
  exportTemplateId?: string
  rating: number
  review?: string
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

// Built-in format definitions
export interface TournamentListFormat {
  playerName: string
  deckName: string
  format: string
  commander?: string
  includeDecklist: boolean
  includeSideboard: boolean
  judgeNotes?: string
}

export interface ProxySheetFormat {
  cardsPerPage: number
  pageSize: 'letter' | 'a4' | 'legal'
  cardSize: 'standard' | 'oversized'
  includeSetSymbols: boolean
  includeCollectorNumbers: boolean
  highResolution: boolean
  bleedMargin: number
  cutLines: boolean
}

// Export engine interfaces
export interface ExportEngine {
  readonly supportedFormats: ExportFormat[]
  
  exportDeck(deckId: string, format: ExportFormat, options?: ExportOptions): Promise<ExportResult>
  exportDecks(deckIds: string[], format: ExportFormat, options?: ExportOptions): Promise<ExportResult>
  createCustomFormat(format: Omit<CustomFormat, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomFormat>
  updateCustomFormat(id: string, updates: Partial<CustomFormat>): Promise<CustomFormat>
  deleteCustomFormat(id: string): Promise<void>
  validateCustomFormat(format: CustomFormat): Promise<ValidationResult>
  previewExport(deckId: string, format: ExportFormat, options?: ExportOptions): Promise<ExportPreview>
}

export interface ExportPreview {
  format: ExportFormat
  fileName: string
  estimatedFileSize: number
  sampleContent: string
  warnings: ExportWarning[]
  metadata: {
    decksCount: number
    cardsCount: number
    estimatedProcessingTime: number
  }
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
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

// Bulk export types
export interface BulkExportJob {
  id: string
  userId: string
  status: ExportJobStatus
  deckIds: string[]
  format: ExportFormat
  options: ExportOptions
  results: BulkExportResult[]
  progress: BulkExportProgress
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

export interface BulkExportResult {
  deckId: string
  success: boolean
  fileName?: string
  fileSize?: number
  errors: ExportError[]
  processingTime: number
}

export interface BulkExportProgress {
  total: number
  completed: number
  failed: number
  currentDeck?: string
  estimatedTimeRemaining?: number
}

// Compression utilities
export interface CompressionOptions {
  type: CompressionType
  level?: number
  includeManifest?: boolean
  preserveStructure?: boolean
}

export interface CompressionResult {
  data: Buffer
  originalSize: number
  compressedSize: number
  compressionRatio: number
  manifest?: CompressionManifest
}

export interface CompressionManifest {
  files: CompressionFileEntry[]
  totalSize: number
  compressedSize: number
  compressionRatio: number
  createdAt: Date
}

export interface CompressionFileEntry {
  name: string
  originalSize: number
  compressedSize: number
  checksum: string
}

// Template engine types
export interface TemplateEngine {
  render(template: string, data: any, options?: TemplateOptions): Promise<string>
  validate(template: string): Promise<TemplateValidationResult>
  getAvailableVariables(deckId: string): Promise<TemplateVariables>
}

export interface TemplateOptions {
  escapeHtml?: boolean
  allowUnsafe?: boolean
  customHelpers?: Record<string, Function>
}

export interface TemplateValidationResult {
  isValid: boolean
  errors: TemplateError[]
  warnings: TemplateWarning[]
  usedVariables: string[]
  unusedVariables: string[]
}

export interface TemplateError {
  line: number
  column: number
  message: string
  code: string
}

export interface TemplateWarning {
  line: number
  column: number
  message: string
  suggestion?: string
}

export interface TemplateVariables {
  deck: DeckVariables
  cards: CardVariables[]
  statistics: StatisticsVariables
  user: UserVariables
  system: SystemVariables
}

export interface DeckVariables {
  id: string
  name: string
  commander?: string
  format: string
  description?: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface CardVariables {
  id: string
  name: string
  quantity: number
  category: string
  manaCost: string
  cmc: number
  typeLine: string
  oracleText: string
  colors: string[]
  colorIdentity: string[]
  rarity: string
  set: string
  price?: number
}

export interface StatisticsVariables {
  totalCards: number
  landCount: number
  nonlandCount: number
  averageCMC: number
  colorDistribution: Record<string, number>
  typeDistribution: Record<string, number>
  rarityDistribution: Record<string, number>
  totalValue?: number
}

export interface UserVariables {
  id: string
  name?: string
  email: string
}

export interface SystemVariables {
  exportedAt: Date
  version: string
  format: ExportFormat
  options: ExportOptions
}
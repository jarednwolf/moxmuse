/**
 * Platform Adapter Types
 * 
 * Defines interfaces and types for the universal import/export system
 * that supports major deck building platforms and formats.
 */

export interface PlatformAdapter {
  readonly name: string
  readonly id: string
  readonly version: string
  readonly supportedFormats: string[]
  readonly capabilities: AdapterCapabilities
  
  // Core methods
  canHandle(input: string | File): Promise<boolean>
  parseDecks(input: string | File, options?: ParseOptions): Promise<ParseResult>
  exportDeck(deck: StandardDeck, format: string, options?: ExportOptions): Promise<ExportResult>
  validateInput(input: string | File): Promise<ValidationResult>
}

export interface AdapterCapabilities {
  canImport: boolean
  canExport: boolean
  supportsMultipleDecks: boolean
  supportsBulkOperations: boolean
  supportsMetadata: boolean
  supportsCategories: boolean
  supportsCustomFields: boolean
  requiresAuthentication: boolean
}

export interface ParseOptions {
  includeMetadata?: boolean
  validateCards?: boolean
  resolveCardNames?: boolean
  preserveCategories?: boolean
  customFields?: string[]
  timeout?: number
}

export interface ExportOptions {
  format?: string
  includeMetadata?: boolean
  includeCategories?: boolean
  includePrices?: boolean
  customTemplate?: string
  compression?: boolean
}

export interface ParseResult {
  success: boolean
  decks: StandardDeck[]
  errors: ParseError[]
  warnings: ParseWarning[]
  metadata: ParseMetadata
}

export interface ExportResult {
  success: boolean
  data: string | Buffer
  filename: string
  mimeType: string
  errors: ExportError[]
  metadata: ExportMetadata
}

export interface ValidationResult {
  isValid: boolean
  format: string | null
  confidence: number
  errors: ValidationError[]
  suggestions: string[]
}

export interface StandardDeck {
  id?: string
  name: string
  description?: string
  format: string
  commander?: StandardCard
  cards: StandardCard[]
  sideboard?: StandardCard[]
  maybeboard?: StandardCard[]
  categories?: DeckCategory[]
  tags?: string[]
  metadata: DeckMetadata
}

export interface StandardCard {
  name: string
  quantity: number
  category?: string
  isFoil?: boolean
  condition?: string
  language?: string
  set?: string
  collectorNumber?: string
  scryfallId?: string
  metadata?: Record<string, any>
}

export interface DeckCategory {
  name: string
  cards: string[]
  description?: string
  color?: string
}

export interface DeckMetadata {
  source: string
  sourceUrl?: string
  author?: string
  createdAt?: Date
  updatedAt?: Date
  powerLevel?: number
  budget?: number
  archetype?: string
  colors?: string[]
  customFields?: Record<string, any>
}

export interface ParseMetadata {
  source: string
  processingTime: number
  cardResolutionRate: number
  totalCards: number
  resolvedCards: number
  unresolvedCards: string[]
}

export interface ExportMetadata {
  format: string
  processingTime: number
  fileSize: number
  compression?: string
}

export interface ParseError {
  type: 'card_not_found' | 'invalid_format' | 'parsing_error' | 'validation_error'
  message: string
  line?: number
  column?: number
  context?: string
  severity: 'error' | 'warning'
}

export interface ParseWarning {
  type: 'card_variant' | 'missing_metadata' | 'format_assumption' | 'data_loss'
  message: string
  suggestion?: string
  context?: string
}

export interface ExportError {
  type: 'format_error' | 'template_error' | 'data_error' | 'file_error'
  message: string
  context?: string
}

export interface ValidationError {
  type: 'format_error' | 'structure_error' | 'data_error'
  message: string
  line?: number
  context?: string
}

// Platform-specific types
export interface MoxfieldDeck {
  id: string
  name: string
  description: string
  format: string
  visibility: 'public' | 'unlisted' | 'private'
  mainboard: MoxfieldCard[]
  sideboard: MoxfieldCard[]
  maybeboard: MoxfieldCard[]
  commanders: MoxfieldCard[]
  hubs: string[]
  tokens: MoxfieldCard[]
  createdByUser: MoxfieldUser
  createdAtUtc: string
  lastUpdatedAtUtc: string
}

export interface MoxfieldCard {
  quantity: number
  card: {
    id: string
    name: string
    cmc: number
    type_line: string
    oracle_text: string
    mana_cost: string
    colors: string[]
    color_identity: string[]
    legalities: Record<string, string>
    set: string
    set_name: string
    collector_number: string
    rarity: string
    image_uris?: Record<string, string>
    prices?: Record<string, string>
  }
  isFoil: boolean
  isAlter: boolean
  isProxy: boolean
  useCmcOverride: boolean
  useManaCostOverride: boolean
  useColorIdentityOverride: boolean
  tags: string[]
}

export interface MoxfieldUser {
  id: string
  userName: string
  displayName: string
  profileImageUrl?: string
}

export interface ArchidektDeck {
  id: number
  name: string
  description: string
  format: number
  owner: number
  ownerName: string
  createdAt: string
  updatedAt: string
  cards: ArchidektCard[]
  categories: ArchidektCategory[]
}

export interface ArchidektCard {
  id: number
  quantity: number
  card: {
    uid: string
    name: string
    cmc: number
    typeLine: string
    oracleText: string
    manaCost: string
    colors: string[]
    colorIdentity: string[]
    set: string
    collectorNumber: string
    rarity: string
  }
  categories: string[]
}

export interface ArchidektCategory {
  name: string
  includedInDeck: boolean
  isPremier: boolean
}

export interface TappedOutDeck {
  name: string
  description: string
  format: string
  user: string
  url: string
  cards: TappedOutCard[]
  sideboard: TappedOutCard[]
  maybeboard: TappedOutCard[]
}

export interface TappedOutCard {
  name: string
  quantity: number
  set?: string
  foil?: boolean
  category?: string
}

export interface EDHRECDeck {
  name: string
  commander: string
  cards: EDHRECCard[]
  themes: string[]
  saltScore?: number
}

export interface EDHRECCard {
  name: string
  quantity: number
  synergy?: number
  saltScore?: number
  inclusion?: number
}

export interface MTGGoldfishDeck {
  name: string
  format: string
  author: string
  date: string
  mainboard: MTGGoldfishCard[]
  sideboard: MTGGoldfishCard[]
}

export interface MTGGoldfishCard {
  name: string
  quantity: number
  set?: string
  price?: number
}

// CSV format types
export interface CSVDeckFormat {
  nameColumn: string
  quantityColumn: string
  setColumn?: string
  categoryColumn?: string
  priceColumn?: string
  foilColumn?: string
  conditionColumn?: string
  hasHeaders: boolean
  delimiter: string
}

// Text format types
export interface TextFormatOptions {
  quantityFirst: boolean
  separator: string
  categoryMarkers: string[]
  commentMarkers: string[]
  ignoreEmptyLines: boolean
  trimWhitespace: boolean
}

// Custom format builder types
export interface CustomFormatDefinition {
  id: string
  name: string
  description: string
  fileExtension: string
  mimeType: string
  template: string
  variables: CustomFormatVariable[]
  validation: CustomFormatValidation
}

export interface CustomFormatVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required: boolean
  defaultValue?: any
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

// Adapter registry types
export interface AdapterRegistry {
  register(adapter: PlatformAdapter): void
  unregister(adapterId: string): void
  getAdapter(adapterId: string): PlatformAdapter | null
  getAllAdapters(): PlatformAdapter[]
  findAdapterForInput(input: string | File): Promise<PlatformAdapter | null>
  getSupportedFormats(): string[]
}

// Bulk operation types
export interface BulkImportJob {
  id: string
  userId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  inputs: BulkImportInput[]
  results: BulkImportResult[]
  options: BulkImportOptions
  progress: BulkImportProgress
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

export interface BulkImportInput {
  id: string
  source: string
  data: string | File
  adapter: string
  options?: ParseOptions
}

export interface BulkImportResult {
  inputId: string
  success: boolean
  decks: StandardDeck[]
  errors: ParseError[]
  warnings: ParseWarning[]
  processingTime: number
}

export interface BulkImportOptions {
  concurrency: number
  timeout: number
  continueOnError: boolean
  validateCards: boolean
  resolveCardNames: boolean
}

export interface BulkImportProgress {
  total: number
  completed: number
  failed: number
  currentItem?: string
  estimatedTimeRemaining?: number
}

export interface BulkExportJob {
  id: string
  userId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  deckIds: string[]
  format: string
  adapter: string
  options: ExportOptions
  result?: BulkExportResult
  progress: BulkExportProgress
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

export interface BulkExportResult {
  success: boolean
  data: string | Buffer
  filename: string
  mimeType: string
  fileSize: number
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
// Advanced Deck Search and Filtering Types

export interface DeckSearchQuery {
  // Text search
  text?: string
  name?: string
  description?: string
  commander?: string
  
  // Format and archetype filters
  formats?: string[]
  archetypes?: string[]
  
  // Color filters
  colors?: string[]
  colorIdentity?: string[]
  colorRequirement?: 'exact' | 'subset' | 'superset' | 'any'
  
  // Numeric filters
  powerLevelRange?: [number, number]
  budgetRange?: [number, number]
  cardCountRange?: [number, number]
  
  // Tags and categories
  tags?: string[]
  categories?: string[]
  
  // Date filters
  createdAfter?: Date
  createdBefore?: Date
  updatedAfter?: Date
  updatedBefore?: Date
  
  // User filters
  userId?: string
  isPublic?: boolean
  
  // Folder filters
  folderId?: string
  includeSubfolders?: boolean
  
  // Sorting options
  sortBy?: DeckSortOption
  sortOrder?: 'asc' | 'desc'
  
  // Pagination
  limit?: number
  offset?: number
}

export type DeckSortOption = 
  | 'name'
  | 'createdAt'
  | 'updatedAt'
  | 'powerLevel'
  | 'budget'
  | 'cardCount'
  | 'commander'
  | 'format'
  | 'relevance'

export interface DeckSearchFilters {
  formats: FilterOption[]
  archetypes: FilterOption[]
  colors: FilterOption[]
  powerLevels: FilterRange
  budgets: FilterRange
  tags: FilterOption[]
  users: FilterOption[]
}

export interface FilterOption {
  value: string
  label: string
  count: number
  selected?: boolean
}

export interface FilterRange {
  min: number
  max: number
  step: number
  selectedMin?: number
  selectedMax?: number
}

export interface DeckSearchResult {
  decks: SearchableDeck[]
  totalCount: number
  hasMore: boolean
  filters: DeckSearchFilters
  query: DeckSearchQuery
  searchTime: number
}

export interface SearchableDeck {
  id: string
  name: string
  description?: string
  commander?: string
  format: string
  archetype?: string
  colors: string[]
  colorIdentity: string[]
  powerLevel?: number
  budget?: number
  cardCount: number
  tags: string[]
  isPublic: boolean
  userId: string
  userName?: string
  userAvatar?: string
  folderId?: string
  folderName?: string
  createdAt: Date
  updatedAt: Date
  
  // Search relevance
  relevanceScore?: number
  matchedFields?: string[]
}

export interface SavedDeckSearch {
  id: string
  userId: string
  name: string
  query: DeckSearchQuery
  isPublic: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

export interface DeckSearchSuggestion {
  type: 'deck' | 'commander' | 'archetype' | 'tag' | 'user'
  value: string
  label: string
  count?: number
  icon?: string
}

export interface DeckSearchHistory {
  id: string
  userId: string
  query: DeckSearchQuery
  resultCount: number
  searchedAt: Date
}

export interface DeckViewMode {
  type: 'grid' | 'list' | 'compact'
  cardsPerRow?: number
  showDetails?: boolean
  showStats?: boolean
  showThumbnails?: boolean
}

export interface DeckSearchPreferences {
  defaultViewMode: DeckViewMode
  defaultSortBy: DeckSortOption
  defaultSortOrder: 'asc' | 'desc'
  autoSaveSearches: boolean
  showSearchHistory: boolean
  maxHistoryItems: number
}

// Advanced search operators
export interface SearchOperator {
  field: string
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'range' | 'in' | 'not'
  value: any
}

export interface AdvancedSearchQuery {
  operators: SearchOperator[]
  logic: 'and' | 'or'
  nested?: AdvancedSearchQuery[]
}

// Search analytics
export interface SearchAnalytics {
  totalSearches: number
  popularQueries: Array<{
    query: string
    count: number
  }>
  popularFilters: Array<{
    filter: string
    value: string
    count: number
  }>
  averageResultCount: number
  averageSearchTime: number
  noResultQueries: Array<{
    query: string
    count: number
  }>
}

// Autocomplete and suggestions
export interface AutocompleteResult {
  suggestions: DeckSearchSuggestion[]
  recentSearches: SavedDeckSearch[]
  popularSearches: SavedDeckSearch[]
}

export interface SearchIndexEntry {
  id: string
  type: 'deck' | 'commander' | 'archetype' | 'tag'
  value: string
  searchableText: string
  metadata: Record<string, any>
  popularity: number
  lastUpdated: Date
}
export { ProgressiveLoaderService } from './progressive-loader'
export { IntelligentCacheService } from './intelligent-cache'
export { BackgroundProcessorService } from './background-processor'

// Re-export types for external use
export type {
  ProgressiveLoadOptions,
  ProgressiveLoadResult,
  DeckCardSummary,
  CollectionSummary
} from './progressive-loader'

export type {
  CacheEntry,
  CacheStats,
  CacheConfiguration,
  DeckAnalysisCache,
  AIModelCache
} from './intelligent-cache'

export type {
  BackgroundJob,
  JobProcessor,
  ProcessorStats,
  OptimisticUpdate
} from './background-processor'
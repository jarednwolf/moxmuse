export { SetMonitorService } from './set-monitor'
export { ProactiveSuggestionsService } from './proactive-suggestions'
export { MultiDeckOptimizerService } from './multi-deck-optimizer'
export { AutomaticAnalysisService } from './automatic-analysis'
export { MaintenanceSchedulerService } from './maintenance-scheduler'

// Re-export types for external use
export type {
  SetRelease,
  NewCardAnalysis,
  SetImpactAnalysis
} from './set-monitor'

export type {
  ProactiveSuggestion,
  SuggestionAction
} from './proactive-suggestions'

export type {
  DeckPortfolio,
  OptimizationOpportunity,
  PortfolioMetrics
} from './multi-deck-optimizer'

export type {
  AnalysisTrigger,
  AnalysisResult,
  DeckChangeEvent
} from './automatic-analysis'

export type {
  ScheduledTask,
  MaintenanceJob,
  MaintenanceReport
} from './maintenance-scheduler'
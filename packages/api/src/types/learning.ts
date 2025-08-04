export type LearningEventType = 
  | 'user_interaction'
  | 'suggestion_feedback'
  | 'manual_change'
  | 'deck_performance'
  | 'strategy_evolution'
  | 'collection_sync'
  | 'meta_adaptation'

export interface LearningEvent {
  id: string
  eventType: LearningEventType
  deckId?: string
  cardId?: string
  suggestionId?: string
  context: Record<string, any>
  outcome?: string
  confidence?: number
  metadata?: Record<string, any>
  timestamp: Date
}

export interface UserInteraction {
  userId: string
  deckId?: string
  cardId?: string
  action: string
  component: string
  timestamp: Date
  sessionId: string
  metadata?: Record<string, any>
}

export interface SuggestionFeedback {
  userId: string
  deckId: string
  cardId?: string
  suggestionId: string
  suggestionType: string
  action: 'accepted' | 'rejected' | 'modified' | 'ignored'
  reason?: string
  alternativeChosen?: string
  satisfactionRating?: number
  timestamp: Date
  sessionContext?: Record<string, any>
}

export interface DeckPerformanceEvent {
  userId: string
  deckId: string
  performanceType: 'game_result' | 'tournament_result' | 'playtesting'
  winRate?: number
  gameLength?: number
  opponentDecks?: string[]
  keyCards?: string[]
  outcome: 'win' | 'loss' | 'draw'
  confidence: number
  timestamp: Date
  gameContext?: Record<string, any>
}

export interface UserBehaviorPattern {
  userId: string
  patternType: string
  pattern: Record<string, any>
  confidence: number
  frequency: number
  lastObserved: Date
  context?: Record<string, any>
}

export interface PreferenceInference {
  userId: string
  preferenceType: string
  preference: any
  confidence: number
  evidence: LearningEvent[]
  lastUpdated: Date
}

export interface AdaptiveSuggestion {
  id: string
  userId: string
  deckId: string
  suggestionType: string
  suggestion: Record<string, any>
  confidence: number
  personalizationScore: number
  reasoning: string[]
  evidence: LearningEvent[]
  createdAt: Date
  expiresAt?: Date
}

export interface CollectiveLearningInsight {
  insightType: string
  insight: Record<string, any>
  confidence: number
  userCount: number
  evidence: string[]
  applicableUserTypes: string[]
  createdAt: Date
}

export interface StrategyEvolution {
  userId: string
  deckId: string
  evolutionType: string
  previousState: Record<string, any>
  newState: Record<string, any>
  trigger: string
  confidence: number
  timestamp: Date
  context?: Record<string, any>
}

export interface UserStyleProfile {
  userId: string
  preferredStrategies: string[]
  avoidedStrategies: string[]
  complexityPreference: 'simple' | 'moderate' | 'complex'
  innovationTolerance: number
  favoriteCardTypes: string[]
  preferredManaCosts: number[]
  competitiveLevel: number
  budgetSensitivity: number
  collectionDependency: number
  suggestionAcceptanceRate: number
  preferenceConfidence: number
  lastUpdated: Date
}

export interface DeckRelationship {
  deckId1: string
  deckId2: string
  relationshipType: 'similar_strategy' | 'complementary' | 'upgrade_path' | 'budget_variant'
  strength: number
  sharedCards: string[]
  strategicOverlap: number
  lastAnalyzed: Date
}

export interface PersonalizedMetaAnalysis {
  userId: string
  localMeta: {
    popularDecks: string[]
    winRates: Record<string, number>
    trends: Record<string, 'rising' | 'stable' | 'declining'>
  }
  personalPerformance: {
    bestMatchups: string[]
    worstMatchups: string[]
    adaptationSuggestions: string[]
  }
  confidence: number
  lastUpdated: Date
}

export interface AdaptiveComplexity {
  userId: string
  currentLevel: number
  skillProgression: {
    deckBuilding: number
    strategyUnderstanding: number
    metaAwareness: number
    cardEvaluation: number
  }
  learningVelocity: number
  recommendedComplexity: 'simple' | 'moderate' | 'complex'
  lastAssessed: Date
}

export interface PersonalizedBudget {
  userId: string
  totalBudget: number
  deckBudgets: Record<string, number>
  spendingPriorities: string[]
  valueThresholds: Record<string, number>
  upgradeQueue: Array<{
    deckId: string
    cardId: string
    priority: number
    expectedImpact: number
  }>
  lastOptimized: Date
}

export interface SmartNotification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  data: Record<string, any>
  priority: 'low' | 'medium' | 'high'
  channels: ('in_app' | 'email' | 'push')[]
  scheduledFor?: Date
  expiresAt?: Date
  createdAt: Date
}
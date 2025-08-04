# Deck Manager System Design

## Overview

The Deck Manager System transforms basic deck storage into a comprehensive deck development platform. It provides strategic context, evolution tracking, AI-powered optimization, and community features while maintaining the existing MTG aesthetic and user experience patterns.

## Architecture

### Component Structure
```
DeckManager (Main System)
├── DeckProfile (Strategy & Goals)
│   ├── StrategyDefinition
│   ├── WinConditionTracker
│   └── PowerLevelManager
├── DeckEvolution (Version Control)
│   ├── SnapshotManager
│   ├── ChangeTracker
│   └── VersionComparison
├── SetIntegration (New Card Analysis)
│   ├── SetMonitor
│   ├── CardAnalyzer
│   └── SuggestionEngine
├── DeckAnalytics (Performance Insights)
│   ├── CompositionAnalyzer
│   ├── SynergyDetector
│   └── MetaComparison
└── AIConsultant (Contextual Recommendations)
    ├── StrategyAwareAI
    ├── HistoryAnalyzer
    └── GoalOptimizer
```

### State Management
- Deck profiles stored in database with strategy metadata
- Version history maintained with automatic snapshots
- AI context enriched with deck strategy and goals
- Real-time analytics computed from current deck state

## Data Models

### Enhanced Deck Schema
```typescript
interface DeckProfile {
  id: string
  userId: string
  name: string
  format: string
  
  // Strategic Context
  strategy: DeckStrategy
  winConditions: WinCondition[]
  powerLevelTarget: number
  budgetConstraints: BudgetConstraints
  
  // Evolution Tracking
  currentVersion: number
  versions: DeckVersion[]
  
  // Performance Data
  analytics: DeckAnalytics
  playHistory: PlaySession[]
  
  // Metadata
  description: string
  tags: string[]
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

interface DeckStrategy {
  primaryType: 'aggro' | 'control' | 'combo' | 'midrange' | 'ramp' | 'tribal' | 'other'
  secondaryTypes: string[]
  keyThemes: string[]
  avoidedStrategies: string[]
  playstyle: 'casual' | 'focused' | 'optimized' | 'competitive'
  complexity: 'low' | 'medium' | 'high'
}

interface WinCondition {
  type: 'combat' | 'combo' | 'alternative' | 'control'
  description: string
  keyCards: string[] // Card IDs
  priority: 'primary' | 'secondary' | 'backup'
  reliability: number // 1-10 scale
}

interface DeckVersion {
  id: string
  version: number
  changes: CardChange[]
  changeReason: string
  performanceNotes?: string
  createdAt: Date
  snapshot: DeckCard[] // Full deck state at this version
}

interface CardChange {
  cardId: string
  changeType: 'added' | 'removed' | 'quantity_changed'
  oldQuantity?: number
  newQuantity?: number
  reason: string
  category?: string
}

interface DeckAnalytics {
  composition: {
    manaCurve: number[]
    colorDistribution: Record<string, number>
    typeDistribution: Record<string, number>
    rarityDistribution: Record<string, number>
  }
  synergies: CardSynergy[]
  weaknesses: string[]
  suggestions: AnalyticsSuggestion[]
  lastAnalyzed: Date
}

interface CardSynergy {
  cards: string[] // Card IDs
  synergyType: string
  strength: number // 1-10
  description: string
}
```

### Set Integration Schema
```typescript
interface SetRelease {
  id: string
  code: string
  name: string
  releaseDate: Date
  analyzed: boolean
  cardCount: number
}

interface DeckSuggestion {
  id: string
  deckId: string
  userId: string
  cardId: string
  suggestionType: 'upgrade' | 'addition' | 'replacement' | 'sideboard'
  reasoning: string
  confidence: number
  estimatedImpact: string
  status: 'pending' | 'accepted' | 'dismissed' | 'considering'
  createdAt: Date
}

interface NewCardAnalysis {
  cardId: string
  setCode: string
  relevantDecks: string[] // Deck IDs
  analysisResults: DeckRelevance[]
}

interface DeckRelevance {
  deckId: string
  relevanceScore: number
  fitReason: string
  suggestedRole: string
  replacementTargets?: string[] // Card IDs this could replace
}
```

## Components and Interfaces

### DeckProfile Component
```typescript
interface DeckProfileProps {
  deck: DeckProfile
  onUpdateStrategy: (strategy: DeckStrategy) => void
  onUpdateWinConditions: (conditions: WinCondition[]) => void
  onUpdateBudget: (budget: BudgetConstraints) => void
}

interface StrategyEditorProps {
  strategy: DeckStrategy
  onChange: (strategy: DeckStrategy) => void
  suggestions: string[]
}

interface WinConditionEditorProps {
  conditions: WinCondition[]
  deckCards: DeckCard[]
  onChange: (conditions: WinCondition[]) => void
}
```

### DeckEvolution Component
```typescript
interface DeckHistoryProps {
  deck: DeckProfile
  onRevertToVersion: (version: number) => void
  onCompareVersions: (v1: number, v2: number) => void
}

interface VersionComparisonProps {
  version1: DeckVersion
  version2: DeckVersion
  cardDetails: Map<string, ScryfallCard>
}

interface ChangeLogProps {
  changes: CardChange[]
  cardDetails: Map<string, ScryfallCard>
  showReasons: boolean
}
```

### SetIntegration Component
```typescript
interface SetSuggestionsProps {
  deckId: string
  suggestions: DeckSuggestion[]
  onAcceptSuggestion: (suggestionId: string) => void
  onDismissSuggestion: (suggestionId: string) => void
  onGetMoreInfo: (cardId: string) => void
}

interface NewCardAlertProps {
  newSets: SetRelease[]
  relevantSuggestions: number
  onViewSuggestions: () => void
}
```

### DeckAnalytics Component
```typescript
interface DeckAnalyticsProps {
  deck: DeckProfile
  analytics: DeckAnalytics
  onRefreshAnalytics: () => void
}

interface CompositionChartProps {
  manaCurve: number[]
  colorDistribution: Record<string, number>
  typeDistribution: Record<string, number>
}

interface SynergyMapProps {
  synergies: CardSynergy[]
  deckCards: DeckCard[]
  onHighlightCards: (cardIds: string[]) => void
}
```

## AI Integration Enhancements

### Strategy-Aware AI System
```typescript
interface AIConsultationContext {
  deck: DeckProfile
  strategy: DeckStrategy
  winConditions: WinCondition[]
  recentChanges: CardChange[]
  performanceHistory: PlaySession[]
  budgetConstraints: BudgetConstraints
  ownedCards: Set<string>
}

interface StrategyPromptBuilder {
  buildSystemPrompt(context: AIConsultationContext): string
  buildUserPrompt(query: string, context: AIConsultationContext): string
  enrichWithStrategy(prompt: string, strategy: DeckStrategy): string
}
```

### Enhanced OpenAI Service
```typescript
interface EnhancedCardRecommendationInput extends CardRecommendationInput {
  deckProfile?: DeckProfile
  analysisContext?: {
    recentChanges: CardChange[]
    performanceIssues: string[]
    strategicGoals: string[]
  }
}
```

## Database Schema Extensions

### New Tables
```sql
-- Deck strategy and profile data
CREATE TABLE deck_profiles (
  id TEXT PRIMARY KEY,
  deck_id TEXT REFERENCES decks(id) ON DELETE CASCADE,
  strategy_type TEXT NOT NULL,
  secondary_types TEXT[],
  key_themes TEXT[],
  avoided_strategies TEXT[],
  playstyle TEXT NOT NULL,
  complexity TEXT NOT NULL,
  power_level_target INTEGER,
  budget_max DECIMAL(10,2),
  budget_current DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Win conditions tracking
CREATE TABLE win_conditions (
  id TEXT PRIMARY KEY,
  deck_id TEXT REFERENCES decks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  key_cards TEXT[], -- Array of card IDs
  priority TEXT NOT NULL,
  reliability INTEGER CHECK (reliability >= 1 AND reliability <= 10),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Deck version history
CREATE TABLE deck_versions (
  id TEXT PRIMARY KEY,
  deck_id TEXT REFERENCES decks(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  change_reason TEXT,
  performance_notes TEXT,
  snapshot JSONB NOT NULL, -- Full deck state
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(deck_id, version)
);

-- Card change tracking
CREATE TABLE card_changes (
  id TEXT PRIMARY KEY,
  version_id TEXT REFERENCES deck_versions(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  old_quantity INTEGER,
  new_quantity INTEGER,
  reason TEXT,
  category TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Set releases and analysis
CREATE TABLE set_releases (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  release_date DATE NOT NULL,
  analyzed BOOLEAN DEFAULT FALSE,
  card_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Deck suggestions from new sets
CREATE TABLE deck_suggestions (
  id TEXT PRIMARY KEY,
  deck_id TEXT REFERENCES decks(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  set_code TEXT REFERENCES set_releases(code),
  suggestion_type TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  estimated_impact TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Deck analytics cache
CREATE TABLE deck_analytics (
  id TEXT PRIMARY KEY,
  deck_id TEXT REFERENCES decks(id) ON DELETE CASCADE,
  mana_curve INTEGER[],
  color_distribution JSONB,
  type_distribution JSONB,
  rarity_distribution JSONB,
  synergies JSONB,
  weaknesses TEXT[],
  last_analyzed TIMESTAMP DEFAULT NOW(),
  UNIQUE(deck_id)
);
```

## API Enhancements

### New tRPC Procedures
```typescript
// Deck profile management
deckProfile: {
  get: protectedProcedure
    .input(z.object({ deckId: z.string() }))
    .query(async ({ ctx, input }) => { /* Get deck profile */ }),
    
  updateStrategy: protectedProcedure
    .input(DeckStrategyUpdateSchema)
    .mutation(async ({ ctx, input }) => { /* Update strategy */ }),
    
  updateWinConditions: protectedProcedure
    .input(WinConditionsUpdateSchema)
    .mutation(async ({ ctx, input }) => { /* Update win conditions */ }),
}

// Version control
deckHistory: {
  getVersions: protectedProcedure
    .input(z.object({ deckId: z.string() }))
    .query(async ({ ctx, input }) => { /* Get version history */ }),
    
  revertToVersion: protectedProcedure
    .input(z.object({ deckId: z.string(), version: z.number() }))
    .mutation(async ({ ctx, input }) => { /* Revert to version */ }),
    
  compareVersions: protectedProcedure
    .input(z.object({ deckId: z.string(), v1: z.number(), v2: z.number() }))
    .query(async ({ ctx, input }) => { /* Compare versions */ }),
}

// Set integration
setIntegration: {
  getSuggestions: protectedProcedure
    .input(z.object({ deckId: z.string() }))
    .query(async ({ ctx, input }) => { /* Get new card suggestions */ }),
    
  acceptSuggestion: protectedProcedure
    .input(z.object({ suggestionId: z.string() }))
    .mutation(async ({ ctx, input }) => { /* Accept suggestion */ }),
    
  analyzeNewSet: protectedProcedure
    .input(z.object({ setCode: z.string() }))
    .mutation(async ({ ctx, input }) => { /* Analyze new set */ }),
}
```

## Performance Considerations

### Caching Strategy
- Deck analytics cached and refreshed on deck changes
- Set analysis results cached per deck
- AI consultation context cached for session duration
- Version snapshots compressed for storage efficiency

### Background Processing
- New set analysis runs as background job
- Deck suggestions generated asynchronously
- Analytics updates triggered by deck modifications
- Performance tracking aggregated periodically

## Security and Privacy

### Data Protection
- Deck strategies and notes encrypted at rest
- Version history access controlled by ownership
- Shared deck data sanitized of personal information
- AI consultation logs anonymized for privacy

### Access Control
- Deck profiles private by default
- Version history only accessible to deck owner
- Suggestions require deck ownership to accept
- Analytics data filtered by user permissions

## Migration Strategy

### Phase 1: Core Profile System
- Add deck profile tables and basic UI
- Implement strategy definition and win conditions
- Create basic version tracking

### Phase 2: AI Integration
- Enhance AI service with strategy context
- Implement strategy-aware recommendations
- Add consultation history tracking

### Phase 3: Set Integration
- Build set monitoring system
- Implement suggestion generation
- Create notification system

### Phase 4: Advanced Analytics
- Add comprehensive deck analysis
- Implement synergy detection
- Create performance tracking

### Phase 5: Community Features
- Add deck sharing with strategy context
- Implement collaborative features
- Create meta analysis tools
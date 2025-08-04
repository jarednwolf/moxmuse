# AI Deck Building Tutor - Developer Guide

## Architecture Overview

The AI Deck Building Tutor extends the existing tutor system with a comprehensive deck building workflow. The system is built using:

- **Frontend**: Next.js with React components
- **Backend**: tRPC API with Prisma ORM
- **AI Integration**: OpenAI GPT-4 for deck generation
- **Database**: PostgreSQL with enhanced schema
- **State Management**: React Context and hooks

## Database Schema

### New Tables

#### generated_decks
Stores complete generated decks with strategy context.

```sql
CREATE TABLE generated_decks (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  commander TEXT NOT NULL,
  format TEXT DEFAULT 'commander',
  
  -- Strategy context
  strategy JSONB NOT NULL,
  win_conditions JSONB NOT NULL,
  power_level INTEGER,
  estimated_budget DECIMAL(10,2),
  
  -- Generation metadata
  consultation_data JSONB NOT NULL,
  generation_prompt TEXT,
  
  -- Status
  status TEXT DEFAULT 'generated',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### generated_deck_cards
Stores individual cards with categorization and reasoning.

```sql
CREATE TABLE generated_deck_cards (
  id TEXT PRIMARY KEY,
  deck_id TEXT REFERENCES generated_decks(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Categorization
  category TEXT NOT NULL,
  role TEXT,
  reasoning TEXT,
  
  -- Alternatives and upgrades
  alternatives TEXT[],
  upgrade_options TEXT[],
  budget_options TEXT[],
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### deck_analysis
Caches deck statistics and analysis.

```sql
CREATE TABLE deck_analysis (
  id TEXT PRIMARY KEY,
  deck_id TEXT REFERENCES generated_decks(id) ON DELETE CASCADE,
  
  -- Statistics
  statistics JSONB NOT NULL,
  synergies JSONB NOT NULL,
  weaknesses TEXT[],
  
  -- Strategy analysis
  strategy_description TEXT,
  win_condition_analysis TEXT,
  play_pattern_description TEXT,
  
  analyzed_at TIMESTAMP DEFAULT NOW()
);
```

#### consultation_sessions
Tracks wizard progress and session data.

```sql
CREATE TABLE consultation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE NOT NULL,
  
  -- Session data
  consultation_data JSONB NOT NULL,
  current_step TEXT,
  completed BOOLEAN DEFAULT FALSE,
  
  -- Results
  generated_deck_id TEXT REFERENCES generated_decks(id),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Enhanced tRPC Tutor Router

#### generateFullDeck
Generates a complete 100-card Commander deck.

```typescript
generateFullDeck: protectedProcedure
  .input(z.object({
    sessionId: z.string(),
    consultationData: ConsultationDataSchema,
    commander: z.string(),
    constraints: z.object({
      budget: z.number().optional(),
      powerLevel: z.number().optional(),
      useCollection: z.boolean().optional(),
    }).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Implementation details
  })
```

**Input Parameters:**
- `sessionId`: Unique session identifier
- `consultationData`: Complete wizard preferences
- `commander`: Selected commander card name
- `constraints`: Optional budget and collection constraints

**Returns:** `GeneratedDeck` object with full card list and analysis

#### analyzeDeck
Analyzes deck composition and generates statistics.

```typescript
analyzeDeck: protectedProcedure
  .input(z.object({
    deckId: z.string(),
  }))
  .query(async ({ ctx, input }) => {
    // Implementation details
  })
```

**Returns:** `DeckAnalysis` with statistics, synergies, and strategy information

#### suggestDeckImprovements
Provides AI-generated improvement suggestions.

```typescript
suggestDeckImprovements: protectedProcedure
  .input(z.object({
    deckId: z.string(),
    focusArea: z.enum(['mana-curve', 'removal', 'draw', 'ramp', 'win-cons']).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Implementation details
  })
```

#### exportDeck
Exports deck in various formats.

```typescript
exportDeck: protectedProcedure
  .input(z.object({
    deckId: z.string(),
    format: z.enum(['text', 'json', 'moxfield', 'archidekt']),
  }))
  .mutation(async ({ ctx, input }) => {
    // Implementation details
  })
```

#### saveConsultationSession
Saves wizard progress for resumption.

```typescript
saveConsultationSession: protectedProcedure
  .input(z.object({
    sessionId: z.string(),
    consultationData: ConsultationDataSchema,
    currentStep: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Implementation details
  })
```

## Core Components

### EntryPointSelector
Main entry component for choosing deck building path.

```typescript
interface EntryPointSelectorProps {
  onDeckBuilding: () => void;
  onCardRecommendations: () => void;
}

const EntryPointSelector: React.FC<EntryPointSelectorProps>
```

**Location:** `apps/web/src/components/tutor/EntryPointSelector.tsx`

### DeckBuildingWizard
Multi-step wizard for collecting user preferences.

```typescript
interface DeckBuildingWizardProps {
  onComplete: (data: ConsultationData) => void;
  onBack: () => void;
  initialData?: Partial<ConsultationData>;
}

const DeckBuildingWizard: React.FC<DeckBuildingWizardProps>
```

**Location:** `apps/web/src/components/tutor/wizard/DeckBuildingWizard.tsx`

**Key Features:**
- Step-by-step preference collection
- Progress tracking and navigation
- Data validation and persistence
- Responsive design

### CommanderSelection
AI-powered commander recommendation system.

```typescript
interface CommanderSelectionProps {
  consultationData: ConsultationData;
  onCommanderSelected: (commander: string) => void;
  onRequestMore: () => void;
}

const CommanderSelection: React.FC<CommanderSelectionProps>
```

**Location:** `apps/web/src/components/tutor/commander/CommanderSelection.tsx`

### DeckGenerationEngine
Handles AI deck generation with progress tracking.

```typescript
interface DeckGenerationEngineProps {
  consultationData: ConsultationData;
  commander: string;
  onDeckGenerated: (deck: GeneratedDeck) => void;
}

const DeckGenerationEngine: React.FC<DeckGenerationEngineProps>
```

**Location:** `apps/web/src/components/tutor/DeckGenerationEngine.tsx`

### DeckEditor
Comprehensive deck editing interface.

```typescript
interface DeckEditorProps {
  deck: GeneratedDeck;
  onDeckUpdate: (deck: GeneratedDeck) => void;
  onSave: () => void;
  onExport: (format: string) => void;
}

const DeckEditor: React.FC<DeckEditorProps>
```

**Location:** `apps/web/src/components/tutor/deck-editor/DeckEditor.tsx`

## Data Types

### ConsultationData
Complete user preferences from wizard.

```typescript
interface ConsultationData {
  buildingFullDeck: boolean;
  needsCommanderSuggestions: boolean;
  commander?: string;
  commanderColors?: string[];
  strategy?: 'aggro' | 'control' | 'combo' | 'midrange' | 'tribal' | 'value' | 'stax';
  themes?: string[];
  customTheme?: string;
  budget?: number;
  powerLevel?: number;
  useCollection?: boolean;
  colorPreferences?: string[];
  specificColors?: string[];
  winConditions?: {
    primary: 'combat' | 'combo' | 'alternative' | 'control';
    secondary?: string[];
    combatStyle?: 'aggro' | 'voltron' | 'tokens' | 'big-creatures';
    comboType?: 'infinite' | 'synergy' | 'engine';
  };
  interaction?: {
    level: 'low' | 'medium' | 'high';
    types: string[];
    timing: 'proactive' | 'reactive' | 'balanced';
  };
  politics?: {
    style: 'diplomatic' | 'aggressive' | 'hidden' | 'chaotic';
    threatLevel: 'low-profile' | 'moderate' | 'high-threat';
  };
  avoidStrategies?: string[];
  avoidCards?: string[];
  petCards?: string[];
  complexityLevel?: 'simple' | 'moderate' | 'complex';
  manaStrategy?: {
    fetchlands: boolean;
    utilityLands: boolean;
    tapLandRatio: 'low' | 'medium' | 'high';
    budget: number;
  };
}
```

### GeneratedDeck
Complete deck structure with analysis.

```typescript
interface GeneratedDeck {
  id: string;
  name: string;
  commander: string;
  format: 'commander';
  strategy: DeckStrategy;
  winConditions: WinCondition[];
  powerLevel: number;
  estimatedBudget: number;
  cards: GeneratedDeckCard[];
  categories: DeckCategory[];
  statistics: DeckStatistics;
  synergies: CardSynergy[];
  weaknesses: string[];
  generatedAt: Date;
  consultationData: ConsultationData;
}
```

## OpenAI Service Extensions

### generateCompleteDeck
Main deck generation method.

```typescript
async generateCompleteDeck(input: DeckGenerationInput): Promise<DeckRecommendation[]>
```

**Parameters:**
- `consultationData`: User preferences from wizard
- `commander`: Selected commander
- `constraints`: Budget and collection constraints

**Returns:** Array of card recommendations with categorization

### analyzeDeckSynergies
Analyzes card interactions within a deck.

```typescript
async analyzeDeckSynergies(cards: DeckCard[]): Promise<CardSynergy[]>
```

### suggestDeckStrategy
Generates strategy descriptions and analysis.

```typescript
async suggestDeckStrategy(deck: GeneratedDeck): Promise<StrategyAnalysis>
```

## Testing

### Unit Tests
Located in `__tests__` directories alongside components.

**Key Test Files:**
- `EntryPointSelector.test.tsx`
- `DeckBuildingWizard.test.tsx`
- `DeckGenerationEngine.test.tsx`
- `DeckEditor.test.tsx`

### Integration Tests
- `DeckBuildingWorkflow.test.tsx` - Complete user journey
- `deck-analysis.performance.test.ts` - Performance benchmarks

### E2E Tests
- `deck-building-tutor.spec.ts` - Full workflow testing

## Performance Considerations

### Caching
- Deck analysis results cached in database
- Commander suggestions cached by preference hash
- Card data cached with Redis

### Optimization
- Lazy loading for card images
- Virtualization for large card lists
- Debounced search and filtering
- Code splitting for wizard steps

### Monitoring
- Performance monitoring in `apps/web/src/lib/performance/monitor.ts`
- Deck generation timing metrics
- User interaction analytics

## Deployment

### Environment Variables
```bash
# AI Service
OPENAI_API_KEY=your_openai_key

# Database
DATABASE_URL=your_postgres_url

# Feature Flags
ENABLE_DECK_BUILDING_TUTOR=true
ENABLE_COMMANDER_SUGGESTIONS=true
```

### Feature Flags
Implemented in `packages/shared/src/constants.ts`:

```typescript
export const FEATURE_FLAGS = {
  DECK_BUILDING_TUTOR: process.env.ENABLE_DECK_BUILDING_TUTOR === 'true',
  COMMANDER_SUGGESTIONS: process.env.ENABLE_COMMANDER_SUGGESTIONS === 'true',
  ADVANCED_STATISTICS: process.env.ENABLE_ADVANCED_STATISTICS === 'true',
} as const;
```

### Migration Scripts
Database migrations in `packages/db/prisma/migrations/`

### Rollout Strategy
1. Enable for beta users first
2. Gradual rollout with feature flags
3. Monitor performance and user feedback
4. Full deployment after validation

## Contributing

### Code Style
- Follow existing TypeScript patterns
- Use proper error boundaries
- Implement comprehensive error handling
- Add unit tests for new components

### Adding New Wizard Steps
1. Create step component in `wizard/steps/`
2. Add to wizard step array
3. Update validation schema
4. Add unit tests
5. Update user documentation

### Extending Statistics
1. Add new chart component to `deck-editor/`
2. Update `DeckStatistics` interface
3. Modify analysis calculation
4. Add interactive filtering
5. Update performance tests

---

*For questions about implementation details, consult the existing codebase or reach out to the development team.*
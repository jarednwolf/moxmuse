# MoxMuse Implementation Roadmap

## Overview
This roadmap outlines practical steps to transform MoxMuse into the premier AI-powered deck building platform, leveraging the extensive infrastructure already in place.

## Current State Assessment

### ✅ What's Already Built
- Comprehensive AI deck generation pipeline
- Multi-step consultation wizard
- Database schema supporting deck visions
- Card synergy detection system
- Format legality validation
- Import/export functionality
- Collection management
- Advanced search capabilities

### 🎯 What Needs Enhancement
- Natural language deck vision input
- Deep construction explanations
- Educational content generation
- Visual synergy mapping
- Budget optimization tools
- Construction principles extraction

## Phase 1: Core Vision Features (Weeks 1-4)

### Week 1: Natural Language Vision Input
**Goal**: Let users describe their deck idea in plain English

#### Tasks:
1. **Create Vision Input Component**
   ```typescript
   // apps/web/src/components/deck-builder/VisionInput.tsx
   - Large textarea for natural language input
   - Example prompts for inspiration
   - Real-time parsing feedback
   - Constraint sliders (budget, power level)
   ```

2. **Extend AI Service for Vision Parsing**
   ```typescript
   // packages/api/src/services/ai/vision-parser.ts
   export class VisionParser {
     async parseNaturalLanguage(input: string): Promise<ConsultationData> {
       // Use existing aiServiceOrchestrator
       const parsed = await aiServiceOrchestrator.executeAITask({
         taskType: 'vision-parsing',
         prompt: VISION_PARSE_PROMPT,
         variables: { userInput: input }
       });
       
       return this.mapToConsultationData(parsed);
     }
   }
   ```

3. **Add Vision Validation**
   ```typescript
   // Validate parsed vision makes sense
   async validateVision(vision: ConsultationData): Promise<ValidationResult> {
     // Check for conflicts
     // Ensure feasibility
     // Suggest clarifications
   }
   ```

### Week 2: Enhanced Explanation System
**Goal**: Explain every card choice clearly

#### Tasks:
1. **Extend GeneratedDeckCard with Deep Reasoning**
   ```sql
   -- Migration to add explanation fields
   ALTER TABLE generated_deck_cards
   ADD COLUMN detailed_explanation TEXT,
   ADD COLUMN synergy_explanations JSONB,
   ADD COLUMN without_this_card TEXT;
   ```

2. **Create Explanation Generator Service**
   ```typescript
   // packages/api/src/services/explanation-engine.ts
   export class ExplanationEngine {
     async generateCardExplanation(
       card: GeneratedDeckCard,
       deck: GeneratedDeck
     ): Promise<CardExplanation> {
       // Use AI to generate detailed explanations
       const explanation = await aiServiceOrchestrator.executeAITask({
         taskType: 'explain-card-choice',
         prompt: CARD_EXPLANATION_PROMPT,
         variables: {
           card: card.name,
           role: card.role,
           strategy: deck.strategy,
           synergies: this.findSynergies(card, deck)
         }
       });
       
       return this.formatExplanation(explanation);
     }
   }
   ```

3. **Build Explanation UI Components**
   ```typescript
   // apps/web/src/components/deck-builder/CardExplanation.tsx
   - Hover tooltips with quick explanations
   - Click for detailed modal
   - Synergy connections visualization
   - "Without this card" scenarios
   ```

### Week 3: Deck Construction Principles
**Goal**: Teach users WHY the deck is built this way

#### Tasks:
1. **Create Principle Extraction Service**
   ```typescript
   // packages/api/src/services/education/principle-extractor.ts
   export class PrincipleExtractor {
     async extractBuildingPrinciples(deck: GeneratedDeck): Promise<BuildingPrinciple[]> {
       const principles = [];
       
       // Analyze mana curve
       principles.push(await this.analyzeCurve(deck));
       
       // Analyze card ratios
       principles.push(await this.analyzeRatios(deck));
       
       // Analyze synergy density
       principles.push(await this.analyzeSynergies(deck));
       
       return principles;
     }
   }
   ```

2. **Add Educational Content Generation**
   ```typescript
   // Generate learning content from deck
   async generateEducationalContent(deck: GeneratedDeck): Promise<EducationalContent> {
     return {
       principles: await this.extractBuildingPrinciples(deck),
       commonMistakes: await this.identifyPitfalls(deck.strategy),
       improvementTips: await this.suggestImprovements(deck),
       relatedGuides: await this.findRelevantGuides(deck.strategy)
     };
   }
   ```

3. **Create Educational UI Components**
   ```typescript
   // apps/web/src/components/education/DeckPrinciples.tsx
   - Principle cards with examples
   - Interactive ratio visualizations
   - Common mistakes warnings
   - "Learn More" links
   ```

### Week 4: Visual Synergy Mapping
**Goal**: Show how cards work together visually

#### Tasks:
1. **Enhance Synergy Detection**
   ```typescript
   // Extend existing card-synergy-detection.ts
   async generateSynergyMap(deck: GeneratedDeck): Promise<SynergyMap> {
     const nodes = deck.cards.map(card => ({
       id: card.cardId,
       name: card.name,
       role: card.role,
       importance: card.importanceScore
     }));
     
     const edges = await this.findAllSynergies(deck.cards);
     
     return { nodes, edges };
   }
   ```

2. **Create Synergy Visualization Component**
   ```typescript
   // apps/web/src/components/deck-builder/SynergyWeb.tsx
   - Interactive force-directed graph
   - Click nodes for card details
   - Highlight synergy chains
   - Filter by interaction type
   ```

3. **Add Synergy Explanations**
   ```typescript
   // Explain each synergy connection
   async explainSynergy(card1: Card, card2: Card): Promise<string> {
     return await aiServiceOrchestrator.executeAITask({
       taskType: 'explain-synergy',
       prompt: SYNERGY_EXPLANATION_PROMPT,
       variables: { card1, card2 }
     });
   }
   ```

## Phase 2: Optimization Tools (Weeks 5-8)

### Week 5-6: Budget Optimization Engine
**Goal**: Build the best deck within budget constraints

#### Tasks:
1. **Enhance Budget Optimizer**
   ```typescript
   // packages/api/src/services/optimization/budget-optimizer.ts
   export class BudgetOptimizer {
     async optimizeDeckBudget(
       deck: GeneratedDeck,
       targetBudget: number
     ): Promise<OptimizedDeck> {
       // Smart downgrade algorithm
       const downgrades = await this.findOptimalDowngrades(deck, targetBudget);
       
       // Maintain strategy coherence
       const optimized = await this.applyDowngrades(deck, downgrades);
       
       // Explain trade-offs
       const tradeoffs = await this.explainTradeoffs(downgrades);
       
       return { deck: optimized, tradeoffs };
     }
   }
   ```

2. **Create Budget Visualization**
   ```typescript
   // apps/web/src/components/deck-builder/BudgetBreakdown.tsx
   - Pie chart of budget allocation
   - Expensive cards highlighted
   - Suggested downgrades
   - Impact analysis
   ```

### Week 7-8: Alternative Path Explorer
**Goal**: Show different ways to build the same strategy

#### Tasks:
1. **Generate Alternative Builds**
   ```typescript
   // Generate 3-5 alternative approaches
   async generateAlternativePaths(vision: DeckVision): Promise<AlternativeBuild[]> {
     const paths = [];
     
     // Budget-focused build
     paths.push(await this.generateBudgetBuild(vision));
     
     // Power-focused build
     paths.push(await this.generatePowerBuild(vision));
     
     // Resilient build
     paths.push(await this.generateResilientBuild(vision));
     
     return paths;
   }
   ```

2. **Create Comparison UI**
   ```typescript
   // apps/web/src/components/deck-builder/PathComparison.tsx
   - Side-by-side deck comparisons
   - Key differences highlighted
   - Trade-off explanations
   - One-click switching
   ```

## Phase 3: Educational Platform (Weeks 9-12)

### Week 9-10: Interactive Deck Breakdowns
**Goal**: Make every deck a learning opportunity

#### Tasks:
1. **Create Deck Anatomy View**
   ```typescript
   // apps/web/src/components/education/DeckAnatomy.tsx
   - Visual deck breakdown by role
   - Click to explore each category
   - Ratio explanations
   - Strategy overview
   ```

2. **Add Interactive Tutorials**
   ```typescript
   // Step-by-step deck building lessons
   const tutorials = [
     'Understanding Mana Curves',
     'Balancing Card Roles',
     'Identifying Win Conditions',
     'Budget Optimization Strategies'
   ];
   ```

### Week 11-12: Community Learning Features
**Goal**: Let users learn from each other

#### Tasks:
1. **Annotated Decklists**
   ```typescript
   // Allow builders to explain their choices
   interface AnnotatedDeck extends GeneratedDeck {
     annotations: CardAnnotation[];
     builderNotes: string;
     keyDecisions: Decision[];
   }
   ```

2. **Deck Workshop System**
   ```typescript
   // Collaborative deck improvement
   export class DeckWorkshop {
     async createWorkshop(deck: GeneratedDeck): Promise<Workshop> {
       // Allow community feedback
       // Track suggested changes
       // Version control
     }
   }
   ```

## Technical Infrastructure Updates

### Database Optimizations
```sql
-- Add indexes for vision-based queries
CREATE INDEX idx_consultation_data_strategy ON generated_decks USING GIN ((consultation_data->'strategy'));
CREATE INDEX idx_generated_deck_cards_synergies ON generated_deck_cards USING GIN (synergy_explanations);

-- Add materialized view for popular strategies
CREATE MATERIALIZED VIEW popular_deck_strategies AS
SELECT 
  consultation_data->>'strategy' as strategy,
  COUNT(*) as deck_count,
  AVG((consultation_data->>'powerLevel')::int) as avg_power_level,
  AVG(estimated_budget) as avg_budget
FROM generated_decks
GROUP BY consultation_data->>'strategy'
ORDER BY deck_count DESC;
```

### Caching Strategy
```typescript
// Cache configuration
const CACHE_KEYS = {
  visionParse: (input: string) => `vision:${hash(input)}`,
  deckConstruction: (vision: DeckVision) => `construction:${hashVision(vision)}`,
  explanations: (deckId: string) => `explanations:${deckId}`,
  principles: (strategy: string) => `principles:${strategy}`,
  synergyMap: (deckId: string) => `synergy:${deckId}`
};

const CACHE_TTL = {
  visionParse: 3600,        // 1 hour
  deckConstruction: 86400,  // 24 hours
  explanations: 604800,     // 7 days
  principles: 2592000,      // 30 days
  synergyMap: 604800        // 7 days
};
```

### Performance Monitoring
```typescript
// Track key metrics
const METRICS = {
  visionParseTime: new Histogram('vision_parse_duration_ms'),
  deckGenerationTime: new Histogram('deck_generation_duration_ms'),
  explanationGenerationTime: new Histogram('explanation_generation_duration_ms'),
  userSatisfaction: new Gauge('user_satisfaction_score'),
  aiTokenUsage: new Counter('ai_tokens_used_total')
};
```

## Success Metrics

### Technical KPIs
- Vision parse success rate > 95%
- Deck generation time < 30 seconds
- Explanation generation time < 5 seconds
- Cache hit rate > 80%
- API response time p95 < 200ms

### User Experience KPIs
- Vision to deck completion rate > 80%
- Explanation clarity rating > 4.5/5
- Alternative acceptance rate > 30%
- Educational content engagement > 50%
- User return rate > 60%

### Business KPIs
- Free to paid conversion > 10%
- Monthly active builders > 10,000
- Decks built per user > 5/month
- API usage growth > 20% MoM
- User satisfaction NPS > 50

## Risk Mitigation

### Technical Risks
1. **AI API Rate Limits**
   - Implement request queuing
   - Use multiple API keys
   - Cache aggressively

2. **Database Performance**
   - Add read replicas
   - Implement connection pooling
   - Optimize heavy queries

3. **Cache Invalidation**
   - Use event-driven invalidation
   - Implement cache warming
   - Monitor cache effectiveness

### Business Risks
1. **User Adoption**
   - Beta test with power users
   - Iterate based on feedback
   - Create compelling demos

2. **AI Quality**
   - A/B test prompts
   - Monitor satisfaction scores
   - Continuous improvement

## Next Steps

### Immediate Actions (This Week)
1. [ ] Set up development environment for vision features
2. [ ] Create feature flags for gradual rollout
3. [ ] Design UI mockups for vision input
4. [ ] Write integration tests for existing services
5. [ ] Set up monitoring dashboards

### Sprint 1 Goals (Weeks 1-2)
1. [ ] Deploy vision input UI
2. [ ] Implement basic explanation generation
3. [ ] Launch closed beta for 50 users
4. [ ] Gather initial feedback
5. [ ] Iterate on AI prompts

### Sprint 2 Goals (Weeks 3-4)
1. [ ] Launch educational features
2. [ ] Deploy synergy visualization
3. [ ] Open beta to 500 users
4. [ ] Implement caching layer
5. [ ] Optimize performance

This roadmap builds on MoxMuse's existing strengths while adding the differentiating features that will make it the go-to platform for AI-powered deck building.

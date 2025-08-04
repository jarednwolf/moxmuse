# MoxMuse Deck Building Architecture

## Overview
This document outlines how MoxMuse's existing architecture supports the vision of becoming the premier AI-powered deck construction platform. We'll build on the robust foundation already in place.

## Existing Infrastructure

### Core Services Already Built

#### 1. AI Deck Generation Pipeline (`packages/api/src/services/ai/`)
- **deck-generation-service.ts**: Orchestrates the complete generation pipeline
- **deck-assembler.ts**: Intelligent card selection and categorization
- **deck-validator.ts**: Format compliance and viability validation
- **research-engine.ts**: Deep research on commanders and strategies
- **intelligent-personalization.ts**: Personalization without user profiling

#### 2. Database Schema (Already Optimized)
```typescript
// Existing tables that support deck building
- GeneratedDeck: Stores complete deck with vision and strategy
- GeneratedDeckCard: Individual cards with reasoning and alternatives
- DeckAnalysis: Cached analysis and statistics
- ConsultationSession: Wizard progress tracking
- EnhancedDeck & EnhancedDeckCard: Advanced deck optimization
```

#### 3. Consultation Flow
- Multi-step wizard already implemented
- ConsultationData type captures deck vision perfectly
- Session management for resumable deck building

## Architectural Enhancements for the Vision

### 1. Leverage Existing DeckGenerationService

The current `DeckGenerationService` already provides:
- Progress tracking through generation stages
- Commander research integration
- Meta-aware optimization
- Alternative card suggestions
- Performance metrics

**Enhancement Opportunities:**
```typescript
// Extend the existing service with vision-specific features
class EnhancedDeckGenerationService extends DeckGenerationService {
  // Add natural language vision parsing
  async parseNaturalLanguageVision(input: string): Promise<ConsultationData> {
    // Use existing AI orchestrator
    return await aiServiceOrchestrator.executeAITask({
      taskType: 'vision-parsing',
      prompt: `Convert this deck vision to structured ConsultationData: "${input}"`,
      variables: { userInput: input }
    });
  }

  // Enhanced explanation generation
  async generateDeepExplanations(deck: GeneratedDeck): Promise<DeckExplanations> {
    // Leverage existing deck-analysis-engine
    const analysis = await deckAnalysisEngine.analyzeDeck(deck);
    
    // Add educational layer
    return {
      ...analysis,
      buildingPrinciples: await this.extractPrinciples(deck),
      roleExplanations: await this.explainRoles(deck),
      synergyMap: await this.visualizeSynergies(deck)
    };
  }
}
```

### 2. Utilize Existing Database Schema

The current schema already supports our vision:

```sql
-- GeneratedDeck table already has:
- strategy (JSON): Stores deck vision and approach
- winConditions (JSON): Multiple win condition support
- consultationData (JSON): Complete user preferences
- generationPrompt: Natural language input

-- GeneratedDeckCard table already has:
- reasoning: Why each card is included
- alternatives: Budget/power alternatives
- category & role: Clear card purposes
```

**New Indexes for Performance:**
```sql
-- Add these indexes to support vision-based queries
CREATE INDEX idx_generated_decks_strategy ON generated_decks USING GIN (strategy);
CREATE INDEX idx_generated_deck_cards_role ON generated_deck_cards (role);
CREATE INDEX idx_generated_deck_cards_category ON generated_deck_cards (category);
```

### 3. Extend Existing AI Services

#### Research Engine Enhancement
```typescript
// Extend existing research-engine.ts
class EnhancedResearchEngine extends AIResearchEngine {
  // Add vision-specific research
  async researchDeckVision(vision: DeckVision): Promise<VisionResearch> {
    // Use existing web research orchestrator
    const sources = await webResearchOrchestrator.research({
      query: `${vision.coreStrategy} commander deck building guide`,
      sources: ['edhrec', 'reddit', 'articles'],
      depth: 'deep'
    });
    
    return this.synthesizeVisionResearch(sources);
  }
}
```

#### Intelligent Personalization Without Profiling
```typescript
// Build on existing intelligent-personalization.ts
class DeckSpecificPersonalization extends IntelligentPersonalization {
  // Personalize for THIS deck, not the user
  async personalizeDeckRecommendations(
    deck: GeneratedDeck,
    vision: DeckVision
  ): Promise<PersonalizedRecommendations> {
    // Use deck context, not user history
    return {
      cardSuggestions: await this.suggestForVision(vision),
      upgradePaths: await this.calculateUpgrades(deck, vision.constraints),
      alternativeStrategies: await this.findAlternativeApproaches(vision)
    };
  }
}
```

### 4. API Layer Optimization

#### Existing tRPC Routers to Extend
```typescript
// Enhanced tutor router (already exists)
export const enhancedTutorRouter = router({
  // Add vision-based generation
  generateFromVision: protectedProcedure
    .input(z.object({
      vision: z.string(), // Natural language
      constraints: DeckConstraintsSchema
    }))
    .mutation(async ({ ctx, input }) => {
      // Parse vision using existing AI
      const consultationData = await parseNaturalLanguageVision(input.vision);
      
      // Use existing deck generation service
      return await deckGenerationService.generateDeck({
        sessionId: generateId(),
        consultationData,
        constraints: input.constraints
      });
    }),

  // Add explanation endpoint
  explainDeckConstruction: protectedProcedure
    .input(z.object({ deckId: z.string() }))
    .query(async ({ ctx, input }) => {
      const deck = await ctx.db.generatedDeck.findUnique({
        where: { id: input.deckId },
        include: { cards: true, analysis: true }
      });
      
      return await generateDeepExplanations(deck);
    })
});
```

### 5. Caching Strategy Using Existing Infrastructure

```typescript
// Leverage existing Redis service
class DeckBuildingCache {
  constructor(private redis: RedisService) {}

  // Cache vision interpretations
  async cacheVisionParse(input: string, result: ConsultationData): Promise<void> {
    const key = `vision:${hash(input)}`;
    await this.redis.setex(key, 3600, JSON.stringify(result));
  }

  // Cache deck constructions by vision hash
  async cacheDeckConstruction(vision: DeckVision, deck: GeneratedDeck): Promise<void> {
    const key = `construction:${this.hashVision(vision)}`;
    await this.redis.setex(key, 86400, JSON.stringify(deck));
  }

  // Cache educational content
  async cacheEducationalContent(deckId: string, content: EducationalContent): Promise<void> {
    const key = `education:${deckId}`;
    await this.redis.setex(key, 604800, JSON.stringify(content)); // 7 days
  }
}
```

## Implementation Priorities

### Phase 1: Enhance Existing Services (Week 1-2)
1. **Extend DeckGenerationService**
   - Add natural language vision parsing
   - Enhance explanation generation
   - Improve alternative suggestions

2. **Optimize Database Queries**
   - Add strategic indexes
   - Implement query performance monitoring
   - Cache frequently accessed deck analyses

3. **Enhance AI Integration**
   - Fine-tune prompts for construction reasoning
   - Add educational content generation
   - Implement vision validation

### Phase 2: Build Vision Features (Week 3-4)
1. **Vision Input UI**
   - Natural language text area
   - Guided constraint inputs
   - Real-time vision parsing feedback

2. **Construction Explanation UI**
   - Interactive card reasoning tooltips
   - Synergy visualization
   - Role-based card grouping

3. **Educational Layer**
   - Deck building principles extraction
   - Interactive tutorials
   - Common mistakes identification

### Phase 3: Optimize Performance (Week 5-6)
1. **Caching Implementation**
   - Vision parse caching
   - Construction caching by hash
   - Educational content caching

2. **Query Optimization**
   - Batch card fetching
   - Parallel research execution
   - Incremental deck updates

3. **AI Performance**
   - Prompt optimization for speed
   - Model selection by task
   - Result confidence scoring

## Monitoring & Analytics

### Leverage Existing Performance Tracking
```typescript
// Use existing prompt-performance-tracking.ts
await promptPerformanceTracking.recordMetrics({
  templateId: 'vision-based-generation',
  taskType: 'deck-construction',
  success: true,
  responseTime: generationTime,
  userSatisfactionScore: feedbackScore
});
```

### Key Metrics to Track
- Vision parsing accuracy
- Deck construction time
- Explanation clarity ratings
- Alternative acceptance rate
- Educational content engagement

## Testing Strategy

### Unit Tests for New Features
```typescript
describe('Vision-Based Deck Building', () => {
  it('should parse natural language visions correctly', async () => {
    const vision = "I want a budget deck that steals my opponents' creatures";
    const parsed = await parseNaturalLanguageVision(vision);
    
    expect(parsed.strategy).toContain('theft');
    expect(parsed.budget).toBeLessThan(100);
  });

  it('should generate comprehensive explanations', async () => {
    const deck = await generateTestDeck();
    const explanations = await generateDeepExplanations(deck);
    
    expect(explanations.cardReasons).toHaveLength(100);
    expect(explanations.buildingPrinciples).not.toBeEmpty();
  });
});
```

### Integration Tests
```typescript
describe('Complete Vision Flow', () => {
  it('should build deck from vision to explanation', async () => {
    // Test the complete flow using existing services
    const vision = "Token swarm strategy with Ghave";
    const deck = await enhancedDeckGenerationService.generateFromVision(vision);
    
    expect(deck.cards).toHaveLength(100);
    expect(deck.strategy.name).toContain('token');
    expect(deck.explanations).toBeDefined();
  });
});
```

## Summary

MoxMuse already has a powerful deck building infrastructure. By extending the existing services rather than rebuilding, we can:

1. **Leverage** the sophisticated AI pipeline already in place
2. **Enhance** with vision parsing and educational features
3. **Optimize** using the existing caching and performance tracking
4. **Scale** by building on the proven architecture

The path forward is clear: extend what works, optimize what exists, and add the vision-specific features that will differentiate MoxMuse as the premier deck building platform.

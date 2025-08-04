# Deck Generation Architecture Decisions

## Current State Analysis

### OpenAI Timeout Considerations

**Current Implementation:**
- 30-second timeout for OpenAI calls
- 60-second timeout for Scryfall lookups
- Falls back to mock data on timeout

**Your Concerns:**
- Thinking models may need longer processing time
- Deep research models could take 10-15 minutes
- Need to balance user experience with processing needs

### Recommended Timeout Strategy

```typescript
// Enhanced timeout configuration
interface ModelTimeoutConfig {
  'gpt-4': 30000,        // 30 seconds for standard models
  'gpt-4-turbo': 45000,  // 45 seconds for turbo
  'o1-preview': 180000,  // 3 minutes for reasoning models
  'o1': 300000,          // 5 minutes for advanced reasoning
  'deep-research': 900000 // 15 minutes for deep research
}

// Dynamic timeout based on model
async function getModelTimeout(model: string): number {
  return ModelTimeoutConfig[model] || 60000 // Default 1 minute
}

// Enhanced service with configurable timeouts
export const enhancedOpenAIService = {
  async generateCompleteDeckOptimized(input: DeckGenerationInput & { model?: string }) {
    const timeout = await getModelTimeout(input.model || 'gpt-4')
    
    // Show different UI states based on expected time
    if (timeout > 60000) {
      // For long-running models, implement:
      // 1. Progress indicators
      // 2. Estimated time remaining
      // 3. Option to queue and notify
      // 4. Background processing with email/notification
    }
  }
}
```

## Scryfall Data Architecture Options

### Option 1: Local Database Mirror (Recommended)

**Implementation:**
```typescript
// Database schema for local card storage
model Card {
  id            String   @id // Scryfall ID
  oracleId      String
  name          String
  manaCost      String?
  cmc           Float
  typeLine      String
  oracleText    String?
  power         String?
  toughness     String?
  colors        String[]
  colorIdentity String[]
  keywords      String[]
  producedMana  String[]
  legalities    Json
  prices        Json
  imageUris     Json
  relatedUris   Json
  rulings       Json[]
  
  // Metadata
  scryfallUpdatedAt DateTime
  localUpdatedAt    DateTime @updatedAt
  
  // Indexes for performance
  @@index([name])
  @@index([oracleId])
  @@index([colorIdentity])
  @@index([typeLine])
  @@index([cmc])
}
```

**Advantages:**
- Instant lookups (< 1ms vs 50-200ms API calls)
- No API rate limits
- Works offline
- Can add custom indexes for specific queries
- Full-text search capabilities
- Complex filtering without API constraints

**Disadvantages:**
- Initial data load (~500MB compressed, ~2GB uncompressed)
- Requires daily/weekly sync process
- Database storage costs
- Maintenance overhead

**Implementation Steps:**
```bash
# 1. Initial bulk import
npm run scryfall:bulk-download
npm run scryfall:import-to-db

# 2. Daily sync job
npm run scryfall:sync-changes

# 3. Fallback to API if needed
npm run scryfall:validate-data
```

### Option 2: Hybrid Approach (Best of Both)

**Architecture:**
```typescript
class HybridScryfallService {
  // Cache frequently used cards in DB
  private async getCachedCard(name: string): Promise<Card | null> {
    return await prisma.card.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } }
    })
  }
  
  // Fallback to API for missing cards
  private async fetchFromAPI(name: string): Promise<Card | null> {
    const card = await scryfallAPI.getCard(name)
    if (card) {
      // Cache for future use
      await this.cacheCard(card)
    }
    return card
  }
  
  // Smart lookup with fallback
  async lookupCard(name: string): Promise<Card | null> {
    // Try cache first
    const cached = await this.getCachedCard(name)
    if (cached) return cached
    
    // Fallback to API
    return await this.fetchFromAPI(name)
  }
}
```

### Option 3: Intelligent Pre-caching

**Strategy:**
- Pre-cache top 10,000 most-played cards
- Pre-cache all commanders
- Pre-cache staples by format
- Use API for rare/new cards

```sql
-- Most played cards analysis
SELECT card_name, COUNT(*) as usage_count
FROM deck_cards
GROUP BY card_name
ORDER BY usage_count DESC
LIMIT 10000;
```

## Cost Analysis

### Local Database Costs

**Storage:**
- PostgreSQL: ~5GB for complete card database
- Monthly cost: ~$5-10 on most cloud providers
- One-time setup: 2-4 hours

**Compute:**
- Bulk import: ~30 minutes initial
- Daily sync: ~5 minutes
- Query performance: < 1ms

### API Costs

**Current Usage:**
- 100 decks/day = 9,900 API calls
- Scryfall rate limit: 10 requests/second
- Monthly API calls: ~297,000
- Cost: Free (Scryfall is free)
- Risk: Rate limiting during peak usage

## Recommended Architecture

### Phase 1: Hybrid Approach (Immediate)
```typescript
// 1. Cache commander cards immediately
await cacheAllCommanders()

// 2. Cache top staples
await cacheTopCards(5000)

// 3. Use smart lookup
const card = await hybridLookup(cardName)
```

### Phase 2: Local Mirror (3-6 months)
```typescript
// 1. Set up dedicated card database
await setupCardDatabase()

// 2. Implement sync pipeline
await setupDailySyncJob()

// 3. Build advanced search features
await implementFuzzySearch()
await implementSimilarCards()
```

### Phase 3: Advanced Features (6-12 months)
- ML-powered card recommendations
- Price trend analysis
- Meta-game tracking
- Custom card evaluation metrics

## Implementation Priority

### Immediate Actions (This Week)
1. **Increase OpenAI Timeout**
   ```typescript
   // Update openai-enhanced.ts
   const OPENAI_TIMEOUT = process.env.OPENAI_MODEL_TIMEOUT || 120000 // 2 minutes default
   ```

2. **Add Progress Indicators**
   ```typescript
   // Frontend updates
   const [progress, setProgress] = useState({
     stage: 'initializing',
     percent: 0,
     message: 'Starting deck generation...'
   })
   ```

3. **Implement Basic Caching**
   ```typescript
   // Add to schema
   model CachedCard {
     id         String @id
     name       String @unique
     data       Json
     cachedAt   DateTime @default(now())
   }
   ```

### Next Sprint (2 Weeks)
1. Download Scryfall bulk data
2. Create card import pipeline
3. Build hybrid lookup service
4. Add database indexes

### Future Enhancements
1. Background job processing
2. WebSocket progress updates
3. Email notifications for long jobs
4. Advanced caching strategies

## Decision Matrix

| Factor | API Only | Local DB | Hybrid |
|--------|----------|----------|---------|
| Setup Complexity | Low | High | Medium |
| Performance | Slow | Fast | Fast |
| Maintenance | None | High | Medium |
| Cost | Free | $5-10/mo | $5-10/mo |
| Reliability | Medium | High | High |
| Features | Limited | Unlimited | Unlimited |

**Recommendation: Start with Hybrid, migrate to Local DB**

## Code Examples

### 1. Configurable Timeout System
```typescript
// config/timeouts.ts
export const TIMEOUT_CONFIGS = {
  models: {
    'gpt-4': { timeout: 30000, retries: 2 },
    'gpt-4-turbo': { timeout: 45000, retries: 2 },
    'o1-preview': { timeout: 180000, retries: 1 },
    'deep-research': { timeout: 900000, retries: 0 }
  },
  
  operations: {
    'deck-generation': { multiplier: 1.5 },
    'card-analysis': { multiplier: 1.0 },
    'meta-research': { multiplier: 2.0 }
  }
}
```

### 2. Progress Tracking
```typescript
// services/progress-tracker.ts
export class DeckGenerationProgress {
  private stages = [
    { id: 'consultation', weight: 10, message: 'Analyzing requirements...' },
    { id: 'ai-generation', weight: 60, message: 'AI creating deck list...' },
    { id: 'card-lookup', weight: 20, message: 'Finding card details...' },
    { id: 'validation', weight: 10, message: 'Validating deck...' }
  ]
  
  async trackProgress(stageId: string, progress: number) {
    // Send to frontend via WebSocket/SSE
    await this.broadcast({
      stage: stageId,
      progress,
      message: this.getStageMessage(stageId, progress)
    })
  }
}
```

### 3. Scryfall Bulk Import
```typescript
// scripts/import-scryfall-bulk.ts
import { createReadStream } from 'fs'
import { pipeline } from 'stream/promises'
import { parse } from 'JSONStream'

export async function importScryfallBulk() {
  const bulkDataUrl = 'https://api.scryfall.com/bulk-data/default-cards'
  
  // Download and stream process
  await pipeline(
    createReadStream('./scryfall-default-cards.json'),
    parse('*'),
    new Transform({
      objectMode: true,
      async transform(card, encoding, callback) {
        // Process each card
        await prisma.card.upsert({
          where: { id: card.id },
          create: mapScryfallToCard(card),
          update: mapScryfallToCard(card)
        })
        callback()
      }
    })
  )
}
```

## Summary

1. **Timeouts**: Make them configurable per model, with UI adaptations for long-running processes
2. **Data Architecture**: Start with hybrid approach, plan migration to local database
3. **User Experience**: Add progress tracking, background processing, and better feedback
4. **Cost**: Minimal ($5-10/month) for significant performance gains

The hybrid approach gives you immediate performance benefits while you plan the full migration. The local database will enable advanced features that would be impossible with API-only access.

# API Services Documentation

This directory contains the core business logic services for the MTG deck building application. Each service is responsible for a specific domain of functionality and follows consistent patterns for error handling, validation, and testing.

## Phase 3: Advanced Card Database Integration Services

### Enhanced Card Data Management

#### `enhanced-card-data.ts`
Manages comprehensive card data ingestion, enrichment, and synchronization.

**Key Features:**
- Scryfall API integration for card data
- Community data enrichment (EDHREC rankings, popularity)
- Market data integration (pricing, trends)
- Automatic data updates and synchronization
- Card image optimization and caching
- Data versioning and change tracking

**Usage:**
```typescript
import { enhancedCardDataService } from './enhanced-card-data'

// Get enhanced card data
const cardData = await enhancedCardDataService.getEnhancedCardData('sol-ring')

// Sync card data
await enhancedCardDataService.syncCardData(['sol-ring', 'lightning-bolt'])
```

#### `card-data-sync.ts`
Handles automated synchronization of card data from external sources.

**Key Features:**
- Scheduled sync jobs using cron
- Batch processing for large datasets
- Rate limiting and API quota management
- Error handling and retry logic
- Progress tracking and status reporting
- Incremental sync capabilities

**Usage:**
```typescript
import { cardDataSyncService } from './card-data-sync'

// Start sync process
await cardDataSyncService.startFullSync()

// Get sync status
const status = await cardDataSyncService.getSyncStatus()
```

### Complex Card Search Engine

#### `card-search.ts`
Provides advanced card search capabilities with multiple filters and ranking.

**Key Features:**
- Advanced search with CMC ranges, power/toughness, rules text
- Full-text search with relevance scoring
- Search suggestions and autocomplete
- Multiple filter combinations (colors, types, sets, legality)
- Search history and saved searches
- Performance optimization with caching

**Usage:**
```typescript
import { cardSearchService } from './card-search'

// Perform advanced search
const results = await cardSearchService.searchCards({
  query: 'Lightning',
  colors: ['R'],
  cmcRange: { min: 1, max: 3 },
  types: ['Instant'],
  rarities: ['common', 'uncommon']
})

// Get search suggestions
const suggestions = await cardSearchService.getSearchSuggestions('light')
```

### Format Legality Validation

#### `format-legality-validator.ts`
Handles real-time format legality checking and validation.

**Key Features:**
- Real-time legality checking for all major formats
- Banned list updates and notifications
- Format-specific deck validation rules
- Custom format support
- Rotation tracking and warnings
- Violation detection and reporting

**Usage:**
```typescript
import { formatLegalityValidatorService } from './format-legality-validator'

// Validate deck legality
const validation = await formatLegalityValidatorService.validateDeck({
  deckId: 'deck-123',
  format: 'standard'
})

// Check card legality
const isLegal = await formatLegalityValidatorService.isCardLegal('lightning-bolt', 'standard')
```

### Card Relationship and Synergy Detection

#### `card-synergy-detection.ts`
AI-powered analysis of card interactions and synergies.

**Key Features:**
- AI-powered synergy analysis using community data
- Related card suggestion engine
- Synergy strength scoring and explanations
- Combo detection and interaction mapping
- Alternative card suggestions with reasoning
- Upgrade path recommendations with budget considerations

**Usage:**
```typescript
import { cardSynergyDetectionService } from './card-synergy-detection'

// Analyze deck synergies
const analysis = await cardSynergyDetectionService.analyzeSynergies({
  cards: [
    { cardId: 'sol-ring', cardName: 'Sol Ring', quantity: 1 },
    { cardId: 'mana-vault', cardName: 'Mana Vault', quantity: 1 }
  ],
  commander: 'Krenko, Mob Boss',
  strategy: 'Goblin Tribal',
  format: 'commander'
})
```

## Service Architecture Patterns

### Error Handling
All services follow consistent error handling patterns:

```typescript
try {
  const result = await service.performOperation(params)
  return { success: true, data: result }
} catch (error) {
  console.error('Operation failed:', error)
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : 'Unknown error'
  })
}
```

### Validation
Input validation using Zod schemas:

```typescript
const RequestSchema = z.object({
  param1: z.string().min(1),
  param2: z.number().optional()
})

export type Request = z.infer<typeof RequestSchema>

async function serviceMethod(request: Request) {
  const validated = RequestSchema.parse(request)
  // ... implementation
}
```

### Caching
Services implement intelligent caching where appropriate:

```typescript
// Check cache first
const cached = await cache.get(cacheKey)
if (cached) return cached

// Perform operation
const result = await performExpensiveOperation()

// Cache result
await cache.set(cacheKey, result, ttl)
return result
```

### Testing
Each service has comprehensive test coverage:

- Unit tests for all public methods
- Integration tests for external API interactions
- Error handling and edge case testing
- Performance testing for large datasets
- Mock implementations for dependencies

### Performance Considerations

1. **Batch Processing**: Large operations are processed in batches
2. **Rate Limiting**: External API calls respect rate limits
3. **Caching**: Frequently accessed data is cached
4. **Async Operations**: Long-running tasks use background jobs
5. **Database Optimization**: Queries are optimized with proper indexes

### Dependencies

Services may depend on:
- **Database**: Prisma ORM for data persistence
- **External APIs**: Scryfall, EDHREC, price providers
- **Caching**: Redis for performance optimization
- **Background Jobs**: Queue system for async processing
- **AI Services**: OpenAI for intelligent analysis

### Configuration

Services are configured through environment variables:
- API keys for external services
- Database connection strings
- Cache configuration
- Rate limiting settings
- Feature flags

## Testing

Run tests for all services:
```bash
npm test -- services/
```

Run specific service tests:
```bash
npm test -- card-search.test.ts
```

## Monitoring

Services include built-in monitoring:
- Performance metrics collection
- Error rate tracking
- API usage statistics
- Cache hit rates
- Background job status

## Contributing

When adding new services:

1. Follow the established patterns
2. Include comprehensive tests
3. Add proper error handling
4. Document public APIs
5. Consider performance implications
6. Add monitoring and logging

## Phase 3 Completion Status

✅ **Enhanced Card Data Management** - Complete with sync capabilities
✅ **Complex Card Search Engine** - Advanced search with multiple filters
✅ **Format Legality Validation** - Real-time validation for all formats
✅ **Card Synergy Detection** - AI-powered analysis with upgrade recommendations

All Phase 3 services are production-ready with comprehensive test coverage and documentation.
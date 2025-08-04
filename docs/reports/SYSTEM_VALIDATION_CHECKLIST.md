# MoxMuse System Validation Checklist

## Overview
This document provides a comprehensive checklist to validate that all existing systems are functioning correctly before implementing new features.

## 1. Core AI Services Validation

### 1.1 Deck Generation Service
**Location**: `packages/api/src/services/ai/deck-generation-service.ts`

#### Tests to Run:
```bash
# Unit tests
cd packages/api
pnpm test deck-generation-service.test.ts

# Integration test
pnpm test:integration deck-generation-flow
```

#### Manual Validation:
1. [ ] Generate a basic Commander deck
   - Navigate to `/tutor`
   - Complete consultation wizard
   - Verify deck generates with 100 cards
   - Check that all cards have reasoning

2. [ ] Test budget constraints
   - Set budget to $50
   - Verify all cards are within budget
   - Check alternatives are suggested

3. [ ] Test power level constraints
   - Generate decks at each power level (1-4)
   - Verify appropriate card choices

4. [ ] Test progress tracking
   - Monitor generation progress
   - Verify all stages complete
   - Check time estimates are reasonable

### 1.2 AI Service Orchestrator
**Location**: `packages/api/src/services/ai/index.ts`

#### Validation Steps:
1. [ ] Test task routing
   ```typescript
   // Test different task types
   const tasks = [
     'vision-parsing',
     'card-recommendation',
     'strategy-research',
     'deck-optimization'
   ];
   ```

2. [ ] Verify model selection
   - Check appropriate models are used
   - Verify fallback mechanisms work

3. [ ] Test error handling
   - Simulate API failures
   - Verify graceful degradation

### 1.3 Research Engine
**Location**: `packages/api/src/services/ai/research-engine.ts`

#### Tests:
1. [ ] Commander research
   - Research popular commanders
   - Verify synergy data is accurate
   - Check meta relevance scores

2. [ ] Strategy research
   - Test different strategies
   - Verify research sources are used
   - Check confidence scores

## 2. Database Schema Validation

### 2.1 Core Tables
```sql
-- Verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
  'generated_decks',
  'generated_deck_cards',
  'deck_analysis',
  'consultation_sessions',
  'enhanced_decks',
  'enhanced_deck_cards'
);
```

### 2.2 Data Integrity Checks
1. [ ] Foreign key constraints
   ```sql
   -- Check deck-card relationships
   SELECT COUNT(*) 
   FROM generated_deck_cards gdc
   LEFT JOIN generated_decks gd ON gdc.deck_id = gd.id
   WHERE gd.id IS NULL;
   -- Should return 0
   ```

2. [ ] JSON field validation
   ```sql
   -- Verify consultation_data structure
   SELECT id, consultation_data
   FROM generated_decks
   WHERE consultation_data IS NOT NULL
   LIMIT 5;
   ```

3. [ ] Index performance
   ```sql
   -- Check index usage
   EXPLAIN ANALYZE
   SELECT * FROM generated_decks
   WHERE consultation_data->>'strategy' = 'tokens';
   ```

## 3. API Endpoint Testing

### 3.1 tRPC Router Validation
**Location**: `packages/api/src/routers/`

#### Test Each Router:
1. [ ] **enhanced-tutor.ts**
   ```typescript
   // Test deck generation
   const result = await trpc.enhancedTutor.generateFullDeck.mutate({
     sessionId: 'test-session',
     consultationData: mockConsultationData,
     commander: 'Atraxa, Praetors\' Voice'
   });
   ```

2. [ ] **card-synergy.ts**
   ```typescript
   // Test synergy detection
   const synergies = await trpc.cardSynergy.detectSynergies.query({
     cardIds: ['card1', 'card2']
   });
   ```

3. [ ] **format-legality.ts**
   ```typescript
   // Test format validation
   const validation = await trpc.formatLegality.validateDeck.mutate({
     deckId: 'test-deck-id',
     format: 'commander'
   });
   ```

### 3.2 Authentication Flow
1. [ ] Sign in with demo account
   - Email: demo@moxmuse.com
   - Password: demo123
   - Verify session creation

2. [ ] Protected endpoints
   - Try accessing without auth
   - Verify 401 responses
   - Test with valid session

## 4. Frontend Component Testing

### 4.1 Consultation Wizard
**Location**: `apps/web/src/components/tutor/wizard/`

1. [ ] Multi-step navigation
   - Progress through all steps
   - Test back/forward navigation
   - Verify data persistence

2. [ ] Input validation
   - Test required fields
   - Verify constraints work
   - Check error messages

3. [ ] Commander selection
   - Search functionality
   - Color filtering
   - Selection persistence

### 4.2 Deck Display Components
1. [ ] Card grid rendering
   - Load a generated deck
   - Verify all 100 cards display
   - Test category filtering

2. [ ] Card explanations
   - Click cards for details
   - Verify reasoning displays
   - Check alternatives show

3. [ ] Statistics visualization
   - Mana curve chart
   - Category breakdown
   - Budget analysis

## 5. Performance Validation

### 5.1 Response Times
```typescript
// Measure key operations
const metrics = {
  deckGeneration: [], // Target: < 30s
  cardSearch: [],     // Target: < 200ms
  synergyAnalysis: [], // Target: < 5s
  pageLoad: []        // Target: < 3s
};
```

### 5.2 Database Queries
1. [ ] Check slow query log
2. [ ] Verify indexes are used
3. [ ] Test concurrent operations

### 5.3 Memory Usage
1. [ ] Monitor during deck generation
2. [ ] Check for memory leaks
3. [ ] Verify garbage collection

## 6. Integration Testing

### 6.1 End-to-End Deck Building Flow
```typescript
describe('Complete Deck Building Journey', () => {
  it('should build deck from consultation to display', async () => {
    // 1. Start consultation
    // 2. Complete wizard
    // 3. Generate deck
    // 4. View results
    // 5. Check explanations
  });
});
```

### 6.2 Collection Integration
1. [ ] Import CSV collection
2. [ ] Generate deck with collection
3. [ ] Verify owned cards marked
4. [ ] Check budget calculations

### 6.3 Export Functionality
1. [ ] Export to different formats
2. [ ] Verify data integrity
3. [ ] Test re-import

## 7. Error Handling Validation

### 7.1 API Failures
1. [ ] Simulate OpenAI timeout
   - Verify fallback behavior
   - Check error messages
   - Test retry logic

2. [ ] Database connection loss
   - Test connection pooling
   - Verify recovery
   - Check data consistency

### 7.2 User Input Errors
1. [ ] Invalid commander names
2. [ ] Impossible constraints
3. [ ] Malformed requests

## 8. Caching Validation

### 8.1 Redis Cache
```typescript
// Test cache operations
const cacheTests = [
  'deck-generation-cache',
  'card-data-cache',
  'search-results-cache'
];
```

### 8.2 Cache Invalidation
1. [ ] Update deck -> cache cleared
2. [ ] New card data -> refresh
3. [ ] TTL expiration

## 9. Security Validation

### 9.1 Authentication
1. [ ] Session management
2. [ ] Token validation
3. [ ] Protected routes

### 9.2 Authorization
1. [ ] User can only access own decks
2. [ ] Public deck visibility
3. [ ] Admin endpoints

### 9.3 Input Sanitization
1. [ ] SQL injection attempts
2. [ ] XSS prevention
3. [ ] CSRF protection

## 10. Monitoring & Logging

### 10.1 Application Logs
```bash
# Check for errors
grep ERROR logs/application.log | tail -100

# Monitor AI usage
grep "AI_TASK" logs/application.log | wc -l
```

### 10.2 Performance Metrics
1. [ ] Check Prometheus metrics
2. [ ] Review response time graphs
3. [ ] Analyze error rates

## Validation Script

Create a comprehensive validation script:

```typescript
// scripts/validate-system.ts
import { validateAIServices } from './validators/ai-services';
import { validateDatabase } from './validators/database';
import { validateAPI } from './validators/api';
import { validateFrontend } from './validators/frontend';
import { validatePerformance } from './validators/performance';

async function runSystemValidation() {
  console.log('🔍 Starting MoxMuse System Validation...\n');
  
  const results = {
    ai: await validateAIServices(),
    database: await validateDatabase(),
    api: await validateAPI(),
    frontend: await validateFrontend(),
    performance: await validatePerformance()
  };
  
  // Generate report
  const report = generateValidationReport(results);
  
  // Save report
  await fs.writeFile('validation-report.md', report);
  
  console.log('✅ Validation complete! See validation-report.md');
}

runSystemValidation().catch(console.error);
```

## Critical Issues to Fix First

### Priority 1 (Blocking)
1. [ ] Database migrations are up to date
2. [ ] All required environment variables set
3. [ ] Redis connection working
4. [ ] OpenAI API key valid

### Priority 2 (Important)
1. [ ] Deck generation completes successfully
2. [ ] Card data fetching works
3. [ ] Authentication flow functional
4. [ ] Basic UI components render

### Priority 3 (Nice to Have)
1. [ ] Performance optimizations
2. [ ] Enhanced error messages
3. [ ] Additional logging
4. [ ] UI polish

## Next Steps

1. **Run automated tests**
   ```bash
   pnpm test
   pnpm test:integration
   pnpm test:e2e
   ```

2. **Manual testing**
   - Follow checklist above
   - Document any issues found
   - Create tickets for fixes

3. **Performance baseline**
   - Record current metrics
   - Set improvement targets
   - Monitor after changes

4. **Create monitoring dashboard**
   - Key metrics visualization
   - Alert configuration
   - Health checks

Once all systems are validated and any critical issues are resolved, we can confidently proceed with implementing the new vision features outlined in the roadmap.

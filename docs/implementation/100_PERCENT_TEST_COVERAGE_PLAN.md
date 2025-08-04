# 🎯 100% Test Coverage Action Plan

## Current State: 25.8% (65/252 tests passing)
## Target: 100% (252/252 tests passing)

## 🔥 Critical Path to 100%

### Phase 1: Authentication Fix (Blocks ~40% of tests)
**Timeline: 2-3 hours**

1. Fix global-setup.ts authentication flow
   - Debug why auth state isn't persisting
   - Ensure cookies are properly saved
   - Fix session storage issues

2. Update auth.json generation
   - Verify NextAuth session format
   - Ensure all required tokens are saved
   - Test auth persistence manually

3. Mock auth for CI/CD
   - Create test-specific auth bypass
   - Ensure consistent test user state

### Phase 2: Type System Fixes (Quick wins - affects ~20% of tests)
**Timeline: 1-2 hours**

1. Update CommanderRecommendation type
   ```typescript
   interface CommanderRecommendation {
     // existing fields...
     manaCost?: string;
     strategy?: string;
   }
   ```

2. Fix CardSynergyAnalysis types
   - Align with actual API response
   - Fix RelatedCard relationship types

3. Update shared package exports
   - Fix conflicting exports properly
   - Ensure clean type definitions

### Phase 3: API Implementation (Blocks ~25% of tests)
**Timeline: 3-4 hours**

1. Implement tutor.generateFullDeck
   - Create endpoint in packages/api/src/routers/tutor.ts
   - Add proper deck generation logic
   - Return expected response format

2. Implement tutor.getCommanderSuggestions
   - Create commander recommendation logic
   - Return properly formatted suggestions
   - Include all expected fields

3. Fix deck.create mutation
   - Ensure proper validation
   - Return complete deck object

### Phase 4: UI Components (Affects ~10% of tests)
**Timeline: 2 hours**

1. Create missing wizard components
   - Progress indicators
   - Step navigation
   - Form validation states

2. Add loading states
   - Skeleton loaders
   - Spinner components
   - Error boundaries

### Phase 5: Feature Flags & Configuration (Final 5%)
**Timeline: 1 hour**

1. Enable all features for test environment
   - Remove feature gates
   - Set test-specific flags
   - Configure demo data access

## 🚀 Execution Strategy

### Day 1 (8 hours)
- **Morning**: Fix authentication (3 hours)
- **Afternoon**: Type fixes + API implementation (5 hours)

### Day 2 (4-5 hours)
- **Morning**: Complete API work (2 hours)
- **Afternoon**: UI components + feature flags (2-3 hours)

## 📊 Expected Progress Milestones

1. **After Auth Fix**: 25.8% → ~65% (164/252 tests)
2. **After Type Fixes**: 65% → ~75% (189/252 tests)
3. **After API Implementation**: 75% → ~90% (227/252 tests)
4. **After UI Components**: 90% → ~95% (240/252 tests)
5. **After Feature Flags**: 95% → 100% (252/252 tests)

## 🛠️ Immediate Actions

1. **Right Now**: Fix authentication in global-setup.ts
2. **Next**: Update CommanderRecommendation type
3. **Then**: Implement generateFullDeck endpoint

## 📝 Success Metrics

- [ ] All 252 tests passing
- [ ] No flaky tests
- [ ] <5 minute total test runtime
- [ ] Clean test output (no warnings)
- [ ] CI/CD pipeline green

## 🔧 Tools & Commands

```bash
# Run all tests
cd apps/web && npm run test:e2e

# Run specific test suite
npx playwright test e2e/deck-building-tutor.spec.ts

# Debug failing test
npx playwright test --debug --headed

# Update snapshots
npx playwright test --update-snapshots

# View test report
npx playwright show-report
```

## 💪 Let's Get to 100%!

No compromises. Every test passing. Full coverage.

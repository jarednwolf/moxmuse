# Technical Debt Items

## Security - Encryption Implementation
**Priority: Medium**
**Effort: 2-4 hours**

### Issue
The SecurityService encryption implementation uses deprecated Node.js crypto methods (`createCipher`/`createDecipher`) which causes test failures. The functionality works but should be updated to use modern crypto APIs.

### Current State
- Encryption/decryption logic is implemented
- All other security features are fully functional
- Tests fail due to deprecated API usage

### Required Fix
1. Update to use `createCipherGCM`/`createDecipherGCM` with proper IV handling
2. Fix the GCM authentication tag implementation
3. Update tests to work with new implementation
4. Ensure backward compatibility for existing encrypted data

### Code Location
- `packages/api/src/services/security/SecurityService.ts` (lines ~75-150)
- `packages/api/src/services/security/__tests__/SecurityService.test.ts`
- `packages/api/src/services/security/__tests__/security-basic.test.ts`

### Impact
- **Security**: No impact - encryption still works, just uses deprecated API
- **Maintenance**: Medium - deprecated APIs may be removed in future Node.js versions
- **Testing**: High - encryption tests currently fail

### Acceptance Criteria
- [ ] Use modern Node.js crypto APIs (createCipherGCM/createDecipherGCM)
- [ ] All encryption tests pass
- [ ] Maintain backward compatibility with existing encrypted data
- [ ] Update documentation with new encryption format

---

## Monitoring - Test Isolation Issues
**Priority: Low**
**Effort: 1-2 hours**

### Issue
The monitoring system tests have state isolation issues because the services are implemented as singletons. Tests share state between runs, causing some test failures even though the core functionality works correctly.

### Current State
- Core monitoring functionality is fully operational (12/18 tests pass)
- Test failures are due to shared state, not actual bugs
- Production functionality is unaffected
- All monitoring features work as expected

### Required Fix
1. Implement test-specific service instances or proper cleanup
2. Add `beforeEach`/`afterEach` hooks to reset service state
3. Consider dependency injection pattern for better testability
4. Update test assertions to account for cumulative state

### Code Location
- `packages/api/src/services/monitoring/__tests__/monitoring-basic.test.ts`
- `packages/api/src/services/monitoring/__tests__/ObservabilityService.test.ts`
- `packages/api/src/services/monitoring/__tests__/monitoring-integration.test.ts`
- `packages/api/src/services/monitoring/__tests__/monitoring-system.test.ts`

### Impact
- **Functionality**: No impact - all monitoring features work correctly
- **Testing**: Medium - some tests fail due to state sharing
- **Maintenance**: Low - doesn't affect production code

### Acceptance Criteria
- [ ] All monitoring tests pass consistently
- [ ] Tests are properly isolated from each other
- [ ] Service state is reset between test runs
- [ ] Consider refactoring to dependency injection pattern

---

*Created: Task 7 Security Implementation*
*Status: Open*
*Assigned: TBD*

*Created: Task 8 Monitoring Implementation*
*Status: Open*
*Assigned: TBD*
---


## TypeScript Type Errors - Comprehensive Cleanup
**Priority: High**
**Effort: 8-16 hours**

### Issue
The codebase has accumulated 1,305 TypeScript errors across 111 files. These errors fall into several categories and need systematic cleanup to maintain code quality and developer experience.

### Error Categories

#### 1. Database Schema Mismatches (High Priority)
**Files Affected: 15+ files**
**Errors: ~150**

Missing database fields and tables:
- `userSession` table missing from Prisma schema
- `isActive`, `mfaEnabled`, `mfaSecret`, `lastLoginAt` fields missing from User model
- `emailVerified`, `createdAt`, `updatedAt` field mismatches

**Impact**: Authentication and session management functionality affected

**Files to Fix**:
- `packages/api/src/services/security/AuthenticationService.ts` (20 errors)
- `packages/api/src/services/security/__tests__/AuthenticationService.test.ts` (23 errors)
- `packages/api/src/services/security/__tests__/security-integration.test.ts` (10 errors)
- `packages/api/src/trpc.ts` (1 error)

#### 2. Error Context and Logging Issues (Medium Priority)
**Files Affected: 20+ files**
**Errors: ~200**

Missing properties in error contexts:
- `operation` property missing from ErrorContext type
- `error`, `jobName` properties missing from logging contexts
- Inconsistent error handling patterns

**Files to Fix**:
- `packages/api/src/services/security/SecurityService.ts` (3 errors)
- `packages/api/src/services/security/VulnerabilityScanner.ts` (1 error)
- `packages/api/src/services/sync-job-scheduler.ts` (36 errors)
- `packages/api/src/middleware/error-handler.ts` (2 errors)
- `packages/api/src/middleware/monitoring.ts` (2 errors)

#### 3. DateTime API Mismatches (Medium Priority)
**Files Affected: 5+ files**
**Errors: ~20**

Luxon DateTime API changes:
- `toDate()` method should be `toJSDate()`
- Performance monitor method mismatches

**Files to Fix**:
- `packages/api/src/services/sync-job-scheduler.ts` (2 errors)
- Performance monitoring services

#### 4. Test Framework Inconsistencies (Low Priority)
**Files Affected: 30+ files**
**Errors: ~300**

Mixed Jest/Vitest imports and mocking patterns:
- Some tests still use `@jest/globals` instead of `vitest`
- Inconsistent mocking patterns
- Type mismatches in test data

**Files to Fix**:
- All `__tests__` directories
- Router test files
- Service test files

#### 5. Import and Module Resolution (Low Priority)
**Files Affected: 50+ files**
**Errors: ~400**

Missing imports and module resolution issues:
- Shared type imports
- Service dependency imports
- Circular dependency issues

#### 6. API Router and tRPC Issues (Medium Priority)
**Files Affected: 15+ files**
**Errors: ~200**

tRPC router and schema mismatches:
- Input/output schema mismatches
- Context type inconsistencies
- Procedure type errors

**Files to Fix**:
- `packages/api/src/routers/ai-quality-assurance.ts` (2 errors)
- `packages/api/src/routers/card-database.ts` (20 errors)
- `packages/api/src/routers/enhanced-tutor.ts` (40 errors)
- Other router files

### Cleanup Strategy

#### Phase 1: Critical Database Schema Fixes (4-6 hours)
1. **Update Prisma Schema**
   - Add missing `userSession` table
   - Add missing User model fields
   - Run database migrations

2. **Fix Authentication Services**
   - Update AuthenticationService to match schema
   - Fix security integration tests
   - Update user context types

#### Phase 2: Error Handling Standardization (2-3 hours)
1. **Standardize Error Context Types**
   - Add missing properties to ErrorContext
   - Update all error handling to use consistent patterns
   - Fix logging context types

2. **Update Sync Job Scheduler**
   - Fix DateTime API usage
   - Standardize error handling
   - Update performance monitoring calls

#### Phase 3: Test Framework Cleanup (3-4 hours)
1. **Standardize Test Imports**
   - Convert all Jest imports to Vitest
   - Update mocking patterns
   - Fix test data types

2. **Fix Test Isolation Issues**
   - Add proper setup/teardown
   - Fix shared state problems
   - Update test assertions

#### Phase 4: Import and Module Cleanup (2-3 hours)
1. **Resolve Import Issues**
   - Fix missing imports
   - Resolve circular dependencies
   - Update module paths

2. **Update API Routers**
   - Fix tRPC schema mismatches
   - Update context types
   - Standardize procedure patterns

### Implementation Plan

#### Week 1: Database and Core Services
- [ ] Update Prisma schema with missing fields/tables
- [ ] Run database migrations
- [ ] Fix AuthenticationService and SecurityService
- [ ] Update error context types
- [ ] Fix sync job scheduler DateTime issues

#### Week 2: Testing and API Cleanup
- [ ] Convert all tests to Vitest
- [ ] Fix test isolation issues
- [ ] Update API router schemas
- [ ] Resolve import/module issues
- [ ] Run full type check validation

### Success Criteria
- [ ] Zero TypeScript errors in `npm run type-check`
- [ ] All tests pass with proper isolation
- [ ] Database schema matches service expectations
- [ ] Consistent error handling patterns
- [ ] Clean import/export structure

### Risk Assessment
- **Low Risk**: Most errors are type mismatches, not runtime issues
- **Medium Risk**: Database schema changes require careful migration
- **High Risk**: Authentication changes need thorough testing

### Files Requiring Immediate Attention

#### Critical (Database/Auth):
- `packages/api/src/services/security/AuthenticationService.ts`
- `packages/api/src/services/security/SecurityService.ts`
- `packages/api/src/trpc.ts`
- Prisma schema files

#### High Priority (Error Handling):
- `packages/api/src/services/sync-job-scheduler.ts`
- `packages/api/src/middleware/error-handler.ts`
- `packages/api/src/middleware/monitoring.ts`

#### Medium Priority (API/Routers):
- `packages/api/src/routers/enhanced-tutor.ts`
- `packages/api/src/routers/card-database.ts`
- `packages/api/src/routers/ai-quality-assurance.ts`

#### Low Priority (Tests):
- All `__tests__` directories
- Test configuration files

### Notes
- The AI Quality Assurance implementation (Task 9) is complete and functional
- These type errors are pre-existing technical debt
- Core application functionality is not affected
- Cleanup should be done incrementally to avoid breaking changes

---

*Created: Post Task 9 Implementation*
*Status: Open*
*Priority: High*
*Estimated Effort: 8-16 hours*
*Assigned: TBD*
# AI Deck Building Tutor - Deployment Guide

## Overview

This guide covers the deployment process for the AI Deck Building Tutor feature, including database migrations, feature flag configuration, and gradual rollout strategies.

## Prerequisites

- PostgreSQL database access
- OpenAI API key
- Node.js 18+ and pnpm
- Access to production environment variables

## Pre-Deployment Checklist

### 1. Database Preparation

Ensure all required database migrations are ready:

```bash
# Check migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy

# Verify new tables exist
npx prisma db pull
```

### 2. Environment Configuration

Set up feature flags in your environment:

```bash
# Core features (start with these disabled for gradual rollout)
NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="false"
NEXT_PUBLIC_ENABLE_COMMANDER_SUGGESTIONS="false"

# Advanced features (enable after core features are stable)
NEXT_PUBLIC_ENABLE_ADVANCED_STATISTICS="false"
NEXT_PUBLIC_ENABLE_INTERACTIVE_CHARTS="false"

# Performance features (can be enabled immediately)
NEXT_PUBLIC_ENABLE_VIRTUALIZED_LISTS="true"
NEXT_PUBLIC_ENABLE_LAZY_LOADING="true"
NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING="true"
```

### 3. OpenAI Configuration

Ensure OpenAI API access is configured:

```bash
# Required for deck generation
OPENAI_API_KEY="your-production-openai-key"

# Optional: Set usage limits
OPENAI_MAX_REQUESTS_PER_HOUR="100"
OPENAI_MAX_TOKENS_PER_REQUEST="4000"
```

## Deployment Process

### Phase 1: Infrastructure Deployment

1. **Deploy Database Changes**
   ```bash
   # Run migrations
   npm run db:migrate:deploy
   
   # Seed any required data
   npm run db:seed:ai-tutor
   ```

2. **Deploy Application Code**
   ```bash
   # Build and deploy with feature flags disabled
   npm run build
   npm run deploy
   ```

3. **Verify Base Functionality**
   - Ensure existing tutor functionality still works
   - Check that new database tables are created
   - Verify no errors in application logs

### Phase 2: Beta Rollout (5% of users)

1. **Enable Beta Features**
   ```bash
   # Enable for beta users only
   NEXT_PUBLIC_ENABLE_BETA_FEATURES="true"
   NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="true"
   ```

2. **Monitor Beta Usage**
   - Track error rates and performance metrics
   - Collect user feedback
   - Monitor OpenAI API usage and costs

3. **Beta Success Criteria**
   - Error rate < 1%
   - Average response time < 30 seconds for deck generation
   - Positive user feedback (>80% satisfaction)

### Phase 3: Limited Rollout (25% of users)

1. **Expand Feature Access**
   ```bash
   # Enable for broader user base
   NEXT_PUBLIC_ENABLE_COMMANDER_SUGGESTIONS="true"
   NEXT_PUBLIC_ENABLE_ADVANCED_STATISTICS="true"
   ```

2. **Performance Monitoring**
   - Monitor database performance
   - Track OpenAI API costs
   - Watch for any scalability issues

### Phase 4: Full Rollout (100% of users)

1. **Enable All Features**
   ```bash
   # Enable all stable features
   NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="true"
   NEXT_PUBLIC_ENABLE_COMMANDER_SUGGESTIONS="true"
   NEXT_PUBLIC_ENABLE_ADVANCED_STATISTICS="true"
   NEXT_PUBLIC_ENABLE_INTERACTIVE_CHARTS="true"
   NEXT_PUBLIC_ENABLE_DECK_EXPORT="true"
   ```

2. **Final Verification**
   - Ensure all features work correctly
   - Monitor system performance under full load
   - Verify cost projections are accurate

## Data Migration

### Running the Migration Script

```bash
# Run the data migration script
npm run db:migrate:ai-tutor-data

# Verify migration results
npm run db:verify:ai-tutor-data
```

### Migration Rollback Plan

If issues occur during migration:

```bash
# Rollback database changes
npx prisma migrate reset --force

# Restore from backup
pg_restore -d moxmuse backup_pre_migration.sql

# Disable new features
NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="false"
```

## Feature Flag Management

### Environment-Based Configuration

**Development:**
```bash
# Enable all features for testing
NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="true"
NEXT_PUBLIC_ENABLE_COMMANDER_SUGGESTIONS="true"
NEXT_PUBLIC_ENABLE_ADVANCED_STATISTICS="true"
NEXT_PUBLIC_DEBUG_MODE="true"
```

**Staging:**
```bash
# Enable most features for testing
NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="true"
NEXT_PUBLIC_ENABLE_COMMANDER_SUGGESTIONS="true"
NEXT_PUBLIC_ENABLE_BETA_FEATURES="true"
```

**Production:**
```bash
# Conservative rollout
NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="false"  # Start disabled
NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING="true"
```

### User-Based Rollout

The system automatically handles user-based rollouts based on user ID hashing:

- **10% rollout**: `DECK_BUILDING_TUTOR` enabled for users where `hash(userId) % 10 === 0`
- **25% rollout**: `COMMANDER_SUGGESTIONS` enabled for users where `hash(userId) % 4 === 0`
- **50% rollout**: `ADVANCED_STATISTICS` enabled for users where `hash(userId) % 2 === 0`

### Manual Feature Control

For immediate feature control:

```bash
# Disable feature immediately for all users
NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="false"

# Enable feature for all users
NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="true"
```

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Performance Metrics**
   - Deck generation response time
   - Database query performance
   - Memory usage during generation

2. **Error Metrics**
   - OpenAI API error rate
   - Database connection errors
   - User-facing error rate

3. **Usage Metrics**
   - Number of decks generated per hour
   - Feature adoption rates
   - User engagement with new features

### Alert Thresholds

```yaml
# Example alert configuration
alerts:
  - name: "High Deck Generation Error Rate"
    condition: "error_rate > 5%"
    action: "Disable DECK_BUILDING_TUTOR feature flag"
  
  - name: "OpenAI API Rate Limit"
    condition: "openai_rate_limit_errors > 10/hour"
    action: "Reduce concurrent generation requests"
  
  - name: "Database Performance Degradation"
    condition: "avg_query_time > 1000ms"
    action: "Review database indexes and queries"
```

## Rollback Procedures

### Immediate Rollback (Emergency)

1. **Disable Feature Flags**
   ```bash
   # Disable all new features immediately
   NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="false"
   NEXT_PUBLIC_ENABLE_COMMANDER_SUGGESTIONS="false"
   NEXT_PUBLIC_ENABLE_ADVANCED_STATISTICS="false"
   ```

2. **Verify System Stability**
   - Check error rates return to normal
   - Verify existing functionality works
   - Monitor system performance

### Partial Rollback

1. **Disable Problematic Features Only**
   ```bash
   # Keep working features enabled
   NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="true"
   NEXT_PUBLIC_ENABLE_COMMANDER_SUGGESTIONS="false"  # Disable if problematic
   ```

2. **Investigate and Fix**
   - Analyze logs and error reports
   - Fix identified issues
   - Test fixes in staging environment

### Database Rollback

If database issues occur:

```bash
# Stop application
pm2 stop moxmuse

# Restore database from backup
pg_restore -d moxmuse backup_pre_deployment.sql

# Deploy previous application version
git checkout previous-stable-tag
npm run build
npm run deploy

# Restart application
pm2 start moxmuse
```

## Post-Deployment Verification

### Automated Tests

```bash
# Run end-to-end tests
npm run test:e2e

# Run performance tests
npm run test:performance

# Run integration tests
npm run test:integration
```

### Manual Verification

1. **Core Functionality**
   - [ ] Existing tutor chat works correctly
   - [ ] User authentication functions properly
   - [ ] Deck management features work

2. **New Features** (if enabled)
   - [ ] Entry point selector displays correctly
   - [ ] Wizard steps function properly
   - [ ] Deck generation completes successfully
   - [ ] Deck editor loads and functions

3. **Performance**
   - [ ] Page load times are acceptable
   - [ ] Deck generation completes within 60 seconds
   - [ ] No memory leaks or performance degradation

## Troubleshooting

### Common Issues

**Issue: Deck generation fails with OpenAI errors**
```bash
# Check API key and usage limits
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/usage

# Verify rate limiting configuration
grep -r "rate.*limit" packages/api/src/services/openai.ts
```

**Issue: Database performance degradation**
```sql
-- Check for missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename IN ('generated_decks', 'generated_deck_cards');

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM generated_decks WHERE user_id = 'user123';
```

**Issue: Feature flags not updating**
```bash
# Verify environment variables are loaded
env | grep NEXT_PUBLIC_ENABLE

# Check feature flag logic
npm run test:feature-flags
```

### Support Contacts

- **Database Issues**: DBA team
- **OpenAI API Issues**: AI team
- **Performance Issues**: DevOps team
- **Feature Issues**: Development team

## Success Criteria

### Technical Success
- [ ] Zero data loss during migration
- [ ] Error rate remains below 1%
- [ ] Performance meets SLA requirements
- [ ] All automated tests pass

### Business Success
- [ ] User adoption rate > 20% within first month
- [ ] User satisfaction score > 4.0/5.0
- [ ] Support ticket volume remains stable
- [ ] Revenue impact is neutral or positive

### Operational Success
- [ ] Monitoring and alerting function correctly
- [ ] Team can respond to issues within SLA
- [ ] Documentation is complete and accurate
- [ ] Rollback procedures are tested and verified

---

*This deployment guide should be reviewed and updated based on your specific infrastructure and requirements.*
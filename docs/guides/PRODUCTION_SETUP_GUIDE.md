# Production Setup Guide

This guide walks through the real-world setup required to make the deployment pipeline operational.

## Current Status: 🟡 Code Complete, Infrastructure Needed

The deployment pipeline code is complete and production-ready, but requires infrastructure setup and configuration.

## Required Setup Steps

### 1. Vercel Project Setup

#### Create Vercel Project
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project to Vercel
vercel link

# Get project details
vercel project ls
```

#### Configure Domains
- **Production**: `moxmuse.com` (requires domain ownership)
- **Staging**: `staging.moxmuse.com` or Vercel preview URLs

#### Required Vercel Environment Variables
```bash
# Production
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://moxmuse.com
OPENAI_API_KEY=sk-...
SENTRY_DSN=https://...

# Staging  
STAGING_DATABASE_URL=postgresql://...
STAGING_NEXTAUTH_SECRET=different-secret
```

### 2. Database Setup

#### Option A: Supabase (Recommended)
```bash
# 1. Create Supabase project
# 2. Get connection strings
# 3. Run migrations
pnpm db:migrate:deploy
```

#### Option B: PlanetScale
```bash
# 1. Create PlanetScale database
# 2. Create production and staging branches
# 3. Get connection strings
```

#### Option C: Self-hosted PostgreSQL
```bash
# Production database requirements:
- PostgreSQL 15+
- SSL enabled
- Connection pooling (PgBouncer)
- Automated backups
- Monitoring
```

### 3. GitHub Repository Configuration

#### Required Secrets (Repository Settings → Secrets)
```bash
# Vercel Integration
VERCEL_TOKEN=vercel_token_here
VERCEL_ORG_ID=team_id_here  
VERCEL_PROJECT_ID=prj_id_here

# Database
DATABASE_URL=postgresql://prod_connection
STAGING_DATABASE_URL=postgresql://staging_connection
TEST_DATABASE_URL=postgresql://test_connection

# Authentication
NEXTAUTH_SECRET=production_secret_32_chars
STAGING_NEXTAUTH_SECRET=staging_secret_32_chars

# External Services
OPENAI_API_KEY=sk-your_openai_key
SENTRY_DSN=https://your_sentry_dsn

# Notifications
SLACK_WEBHOOK=https://hooks.slack.com/services/...
```

#### Environment Setup
```bash
# Create GitHub environments:
1. Go to Settings → Environments
2. Create "staging" environment
3. Create "production" environment with protection rules
4. Add required reviewers for production
```

### 4. External Service Setup

#### Sentry (Error Tracking)
```bash
# 1. Create Sentry account
# 2. Create new project
# 3. Get DSN
# 4. Configure in environment variables
```

#### Slack (Notifications)
```bash
# 1. Create Slack app
# 2. Enable incoming webhooks
# 3. Create webhook URL
# 4. Add to GitHub secrets
```

#### OpenAI (AI Features)
```bash
# 1. Create OpenAI account
# 2. Generate API key
# 3. Set usage limits
# 4. Add to environment variables
```

## Deployment Readiness Checklist

### Infrastructure Ready ✅/❌
- [ ] Vercel project created and linked
- [ ] Production domain configured (moxmuse.com)
- [ ] Staging domain configured
- [ ] Production database provisioned
- [ ] Staging database provisioned
- [ ] SSL certificates configured

### GitHub Configuration ✅/❌
- [ ] All required secrets added
- [ ] Staging environment created
- [ ] Production environment created with protection
- [ ] Required reviewers configured
- [ ] Branch protection rules enabled

### External Services ✅/❌
- [ ] Sentry project created and configured
- [ ] Slack webhook created and tested
- [ ] OpenAI API key generated and tested
- [ ] Domain DNS configured

### Testing ✅/❌
- [ ] Local development working
- [ ] Tests passing locally
- [ ] Database migrations tested
- [ ] Staging deployment tested
- [ ] Health checks working

## Quick Start Commands

### Test Current Setup
```bash
# Check if basic setup works
pnpm build
pnpm test
pnpm type-check

# Test health checks locally
pnpm dev
# Then visit: http://localhost:3000/api/health
```

### Deploy to Staging (Manual)
```bash
# After Vercel setup
vercel --env staging
```

### Test Deployment Scripts
```bash
# Test health check script
node scripts/deployment/health-check.js http://localhost:3000

# Test verification script  
node scripts/deployment/verify.js http://localhost:3000 --skip-e2e
```

## Cost Estimates

### Minimal Production Setup
- **Vercel Pro**: $20/month
- **Supabase Pro**: $25/month  
- **Domain**: $10-15/year
- **Sentry**: Free tier (10k errors/month)
- **Total**: ~$45/month + domain

### Enterprise Setup
- **Vercel Enterprise**: $150+/month
- **Dedicated Database**: $50-200/month
- **Advanced Monitoring**: $50+/month
- **Total**: $250+/month

## Security Considerations

### Required Security Setup
```bash
# 1. Enable 2FA on all accounts
# 2. Use least-privilege access
# 3. Rotate secrets regularly
# 4. Enable audit logging
# 5. Set up security monitoring
```

### Environment Isolation
```bash
# Ensure complete separation:
- Different databases for prod/staging
- Different API keys where possible
- Different domains
- Different monitoring dashboards
```

## Monitoring Setup

### Required Monitoring
```bash
# 1. Application Performance Monitoring (Sentry)
# 2. Infrastructure Monitoring (Vercel Analytics)
# 3. Database Monitoring (built into database provider)
# 4. Custom Business Metrics (implemented in code)
```

### Alert Configuration
```bash
# Set up alerts for:
- Error rate > 1%
- Response time > 2s (P95)
- Availability < 99.9%
- Database connection issues
- Deployment failures
```

## Next Steps to Go Live

### Phase 1: Basic Setup (1-2 days)
1. Create Vercel project
2. Set up Supabase database
3. Configure GitHub secrets
4. Test staging deployment

### Phase 2: Production Deployment (1 day)
1. Configure production domain
2. Set up monitoring
3. Test production deployment
4. Configure alerts

### Phase 3: Optimization (ongoing)
1. Monitor performance
2. Optimize based on real usage
3. Add advanced monitoring
4. Scale infrastructure as needed

## Troubleshooting Common Issues

### Deployment Fails
```bash
# Check:
1. All secrets configured correctly
2. Database accessible
3. Domain DNS configured
4. Vercel project linked
```

### Health Checks Fail
```bash
# Check:
1. Database connection string
2. Environment variables set
3. API endpoints accessible
4. External services available
```

### Performance Issues
```bash
# Check:
1. Database query performance
2. Bundle size
3. CDN configuration
4. Caching strategy
```

## Support and Maintenance

### Regular Maintenance Tasks
```bash
# Weekly:
- Review error logs
- Check performance metrics
- Update dependencies

# Monthly:
- Rotate secrets
- Review security logs
- Optimize database

# Quarterly:
- Security audit
- Performance review
- Infrastructure scaling review
```

---

**Status**: Ready for infrastructure setup
**Estimated Setup Time**: 2-3 days
**Estimated Cost**: $45-250/month depending on scale
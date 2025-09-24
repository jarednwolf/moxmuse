# Required GitHub Secrets for CI/CD

## Absolutely Required (CI will fail without these)

### For Vercel Deployment
- `VERCEL_TOKEN` - Get from: https://vercel.com/account/tokens
- `VERCEL_ORG_ID` - Get from: Vercel project settings
- `VERCEL_PROJECT_ID` - Get from: Vercel project settings

## Optional (CI will continue with warnings)

### For Full Testing
- `TEST_DATABASE_URL` - Test database connection string (falls back to local postgres)
- `OPENAI_API_KEY` - OpenAI API key for AI tests (falls back to mock)

### For Production Deployment
- `DATABASE_URL` - Production database (required for actual deployment)
- `NEXTAUTH_SECRET` - Authentication secret (required for auth features)
- `STAGING_DATABASE_URL` - Staging database (only for staging deploys)
- `STAGING_NEXTAUTH_SECRET` - Staging auth secret

### For Notifications
- `SLACK_WEBHOOK` - Slack notifications (optional)
- `SENTRY_DSN` - Error tracking (optional)
- `SENTRY_AUTH_TOKEN` - Source map uploads (optional)

## Quick Setup Commands

```bash
# Add required secrets for basic CI to pass
gh secret set VERCEL_TOKEN
gh secret set VERCEL_ORG_ID  
gh secret set VERCEL_PROJECT_ID

# The CI will work with just these three!
```

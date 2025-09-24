# Deployment Environment Variables

This document lists all required environment variables for successful deployment to GitHub Actions and Vercel.

## GitHub Secrets (Required for CI/CD)

### Vercel Integration
- `VERCEL_TOKEN` - Your Vercel API token for deployments
- `VERCEL_ORG_ID` - Your Vercel organization ID
- `VERCEL_PROJECT_ID` - Your Vercel project ID

### Database
- `DATABASE_URL` - Production database connection string
- `TEST_DATABASE_URL` - Test database connection string for CI tests
- `STAGING_DATABASE_URL` - Staging database connection string

### Authentication
- `NEXTAUTH_SECRET` - Production NextAuth secret for session encryption
- `STAGING_NEXTAUTH_SECRET` - Staging NextAuth secret
- `NEXTAUTH_URL` - Production URL (https://moxmuse.com)

### AI Services
- `OPENAI_API_KEY` - OpenAI API key for AI features

### Monitoring (Optional but Recommended)
- `SENTRY_DSN` - Sentry DSN for error tracking
- `SENTRY_AUTH_TOKEN` - Sentry auth token for source maps
- `SLACK_WEBHOOK` - Slack webhook URL for deployment notifications

## Vercel Environment Variables

### Production Environment
```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://... # For migrations

# Authentication
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://moxmuse.com

# AI
OPENAI_API_KEY=sk-proj-...

# Monitoring
SENTRY_DSN=https://...
NEXT_PUBLIC_SENTRY_DSN=https://...

# Performance
NODE_OPTIONS=--max-old-space-size=4096
```

### Preview/Staging Environment
```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Authentication
NEXTAUTH_SECRET=staging-secret-here
NEXTAUTH_URL=https://staging.moxmuse.com

# AI
OPENAI_API_KEY=sk-proj-...

# Monitoring
SENTRY_DSN=https://...
NEXT_PUBLIC_SENTRY_DSN=https://...
```

## Local Development (.env.local)

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/moxmuse

# Authentication
NEXTAUTH_SECRET=dev-secret-change-in-production
NEXTAUTH_URL=http://localhost:3000

# AI (Optional for local)
OPENAI_API_KEY=sk-proj-...

# Monitoring (Optional for local)
SENTRY_DSN=
```

## Setting Up GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret listed above

## Setting Up Vercel Environment Variables

1. Go to your Vercel dashboard
2. Select your project
3. Navigate to Settings → Environment Variables
4. Add variables for each environment (Production, Preview, Development)

## Security Notes

- Never commit environment variables to the repository
- Use different secrets for production and staging
- Rotate secrets regularly
- Use GitHub's secret scanning to detect leaked credentials
- Enable Vercel's environment variable encryption

## Validation Script

Run this script to check if all required variables are set:

```bash
#!/bin/bash
# Check required environment variables

required_vars=(
  "DATABASE_URL"
  "NEXTAUTH_SECRET"
  "NEXTAUTH_URL"
)

optional_vars=(
  "OPENAI_API_KEY"
  "SENTRY_DSN"
  "SLACK_WEBHOOK"
)

echo "Checking required environment variables..."
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required: $var"
  else
    echo "✅ Found: $var"
  fi
done

echo ""
echo "Checking optional environment variables..."
for var in "${optional_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "⚠️  Missing optional: $var"
  else
    echo "✅ Found: $var"
  fi
done
```

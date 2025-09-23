# GitHub Secrets Setup

Based on your existing environment variables, here are the GitHub secrets you need to configure to activate the deployment pipeline.

## Required GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

### Vercel Integration
```bash
VERCEL_TOKEN=<your_vercel_api_token>
VERCEL_ORG_ID=<your_vercel_org_id>
VERCEL_PROJECT_ID=<your_vercel_project_id>
```

### Database (Use your existing Supabase)
```bash
DATABASE_URL=<your_database_url>
STAGING_DATABASE_URL=<your_staging_database_url>
TEST_DATABASE_URL=<your_test_database_url>
```

### Authentication
```bash
NEXTAUTH_SECRET=<your_nextauth_secret>
STAGING_NEXTAUTH_SECRET=<your_staging_nextauth_secret>
```

### AI Service
```bash
OPENAI_API_KEY=<your_openai_api_key>
```

### Optional (for enhanced features)
```bash
SLACK_WEBHOOK=<your_slack_webhook_url>
SENTRY_DSN=<your_sentry_dsn>
```

## How to Get Missing Values

### 1. Vercel Token
```bash
# Install Vercel CLI
npm i -g vercel

# Login and create token
vercel login
vercel tokens create
```

### 2. Slack Webhook (Optional)
1. Go to https://api.slack.com/apps
2. Create new app
3. Enable Incoming Webhooks
4. Create webhook URL

### 3. Sentry DSN (Optional)
1. Go to https://sentry.io
2. Create new project
3. Get DSN from project settings

## Test the Setup

Once secrets are added, test by:

1. **Push to main branch** - should trigger full deployment pipeline
2. **Create PR** - should trigger staging deployment
3. **Check Actions tab** - see pipeline running

## Current Status: 🟢 95% Ready!

You have all the core infrastructure. Just need GitHub secrets to activate the CI/CD pipeline.
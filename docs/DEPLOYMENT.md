# MoxMuse Deployment Guide

This guide covers deploying MoxMuse to production environments with best practices for security, performance, and reliability.

## Overview

MoxMuse is designed to be deployed as a modern web application with the following components:
- **Next.js Application**: Frontend and API routes
- **PostgreSQL Database**: Primary data storage
- **Redis Cache**: Session storage and caching (optional)
- **External Services**: OpenAI API, Scryfall API, etc.

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel provides the best experience for Next.js applications with automatic deployments, edge functions, and global CDN.

#### Prerequisites
- Vercel account
- GitHub repository
- PostgreSQL database (Railway, Supabase, or Neon)
- Redis instance (Upstash or Railway)

#### Setup Steps

1. **Connect Repository**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login and connect project
   vercel login
   vercel --cwd apps/web
   ```

2. **Configure Environment Variables**
   ```bash
   # Set production environment variables
   vercel env add DATABASE_URL production
   vercel env add NEXTAUTH_SECRET production
   vercel env add OPENAI_API_KEY production
   vercel env add REDIS_URL production
   ```

3. **Configure Build Settings**
   ```json
   // vercel.json
   {
     "buildCommand": "cd ../.. && pnpm build --filter=web",
     "devCommand": "cd ../.. && pnpm dev --filter=web",
     "installCommand": "cd ../.. && pnpm install",
     "framework": "nextjs",
     "outputDirectory": "apps/web/.next"
   }
   ```

4. **Deploy**
   ```bash
   vercel --prod
   ```

### Option 2: Docker + Cloud Provider

For more control over the deployment environment.

#### Dockerfile
```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY packages/*/package.json ./packages/*/
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm build --filter=web

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "apps/web/server.js"]
```

#### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=moxmuse
      - POSTGRES_USER=moxmuse
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  redis_data:
```

### Option 3: Railway

Railway provides a simple deployment experience with built-in PostgreSQL and Redis.

#### Setup Steps

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Initialize Project**
   ```bash
   railway init
   railway add --database postgresql
   railway add --database redis
   ```

3. **Configure Environment**
   ```bash
   # Railway automatically provides DATABASE_URL and REDIS_URL
   railway variables set NEXTAUTH_SECRET=your-secret
   railway variables set OPENAI_API_KEY=your-key
   railway variables set NEXTAUTH_URL=https://your-app.railway.app
   ```

4. **Deploy**
   ```bash
   railway up
   ```

## Environment Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="https://your-domain.com"

# AI Services
OPENAI_API_KEY="sk-your-openai-api-key"

# Optional: Redis for caching
REDIS_URL="redis://user:password@host:port"

# Optional: OAuth providers
MOXFIELD_CLIENT_ID="your-moxfield-client-id"
MOXFIELD_CLIENT_SECRET="your-moxfield-client-secret"

# Feature flags
NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="true"
NEXT_PUBLIC_ENABLE_COMMANDER_SUGGESTIONS="true"
NEXT_PUBLIC_ENABLE_ADVANCED_STATISTICS="true"
```

### Security Configuration

```env
# Security headers
NEXT_PUBLIC_CSP_NONCE="random-nonce-here"

# Rate limiting
RATE_LIMIT_WINDOW_MS="900000"  # 15 minutes
RATE_LIMIT_MAX_REQUESTS="100"

# AI service limits
OPENAI_DEFAULT_TIMEOUT="120000"
OPENAI_MAX_REQUESTS_PER_HOUR="100"

# Session configuration
SESSION_MAX_AGE="2592000"  # 30 days
SESSION_UPDATE_AGE="86400"  # 1 day
```

## Database Setup

### Production Database

#### Option 1: Railway PostgreSQL
```bash
railway add --database postgresql
# DATABASE_URL is automatically provided
```

#### Option 2: Supabase
```bash
# Create project at supabase.com
# Get connection string from project settings
DATABASE_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"
```

#### Option 3: Neon
```bash
# Create database at neon.tech
# Get connection string from dashboard
DATABASE_URL="postgresql://[user]:[password]@[endpoint]/[dbname]?sslmode=require"
```

### Database Migrations

```bash
# Run migrations in production
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Optional: Seed with initial data
npx prisma db seed
```

### Database Backup

```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql

# Restore from backup
psql $DATABASE_URL < backup_$DATE.sql
```

## Performance Optimization

### Next.js Configuration

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Optimize images
  images: {
    domains: ['cards.scryfall.io', 'c1.scryfall.com'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Enable compression
  compress: true,
  
  // Optimize bundle
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

### Caching Strategy

```typescript
// lib/cache.ts
import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

export const cache = {
  // Cache deck analysis for 1 hour
  async getDeckAnalysis(deckId: string) {
    const cached = await redis.get(`deck:analysis:${deckId}`)
    if (cached) return JSON.parse(cached)
    return null
  },
  
  async setDeckAnalysis(deckId: string, analysis: any) {
    await redis.setex(`deck:analysis:${deckId}`, 3600, JSON.stringify(analysis))
  },
  
  // Cache card data for 24 hours
  async getCardData(cardId: string) {
    const cached = await redis.get(`card:${cardId}`)
    if (cached) return JSON.parse(cached)
    return null
  },
  
  async setCardData(cardId: string, data: any) {
    await redis.setex(`card:${cardId}`, 86400, JSON.stringify(data))
  },
}
```

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_generated_decks_user_id_created_at 
ON generated_decks(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_generated_deck_cards_deck_id_category 
ON generated_deck_cards(deck_id, category);

CREATE INDEX CONCURRENTLY idx_consultation_sessions_user_id_completed 
ON consultation_sessions(user_id, completed);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM generated_decks 
WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10;
```

## Monitoring and Observability

### Error Tracking with Sentry

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  
  beforeSend(event) {
    // Filter out sensitive data
    if (event.request?.headers?.authorization) {
      delete event.request.headers.authorization
    }
    return event
  },
})
```

### Performance Monitoring

```typescript
// lib/analytics.ts
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export function AnalyticsProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Analytics />
      <SpeedInsights />
    </>
  )
}
```

### Health Checks

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@moxmuse/db'

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    
    // Check external services
    const openaiStatus = await checkOpenAI()
    const scryfallStatus = await checkScryfall()
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        openai: openaiStatus,
        scryfall: scryfallStatus,
      }
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: error.message },
      { status: 500 }
    )
  }
}
```

## Security Best Practices

### Environment Security

```bash
# Use strong secrets
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Rotate secrets regularly
# Update in deployment platform
# Update in application configuration
```

### API Security

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
})

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 h'),
  analytics: true,
})

// Apply to API routes
export async function middleware(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1'
  const { success } = await ratelimit.limit(ip)
  
  if (!success) {
    return new Response('Too Many Requests', { status: 429 })
  }
}
```

### Content Security Policy

```typescript
// next.config.js
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://cards.scryfall.io https://c1.scryfall.com;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
        ],
      },
    ]
  },
}
```

## Backup and Recovery

### Database Backups

```bash
#!/bin/bash
# backup.sh
set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="moxmuse_backup_$DATE.sql"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to cloud storage (AWS S3, Google Cloud, etc.)
aws s3 cp $BACKUP_FILE.gz s3://your-backup-bucket/

# Clean up local files older than 7 days
find . -name "moxmuse_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

### Automated Backups

```yaml
# .github/workflows/backup.yml
name: Database Backup

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Create Database Backup
        run: |
          pg_dump ${{ secrets.DATABASE_URL }} > backup.sql
          gzip backup.sql
          
      - name: Upload to S3
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
          
      - name: Upload Backup
        run: |
          aws s3 cp backup.sql.gz s3://your-backup-bucket/$(date +%Y%m%d_%H%M%S)_backup.sql.gz
```

## Deployment Checklist

### Pre-Deployment
- [ ] All tests pass locally
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Error tracking setup
- [ ] Performance monitoring enabled

### Deployment
- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Check health endpoints
- [ ] Verify database connections
- [ ] Test critical user flows
- [ ] Monitor error rates
- [ ] Deploy to production

### Post-Deployment
- [ ] Verify application is accessible
- [ ] Check all integrations work
- [ ] Monitor performance metrics
- [ ] Review error logs
- [ ] Test backup procedures
- [ ] Update documentation
- [ ] Notify team of deployment

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear caches and reinstall
rm -rf node_modules .next
pnpm install
pnpm build

# Check for TypeScript errors
pnpm type-check
```

#### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check migrations
npx prisma migrate status
npx prisma migrate deploy
```

#### Performance Issues
```bash
# Analyze bundle size
npx @next/bundle-analyzer

# Check database queries
EXPLAIN ANALYZE SELECT ...

# Monitor memory usage
node --inspect server.js
```

### Rollback Procedures

```bash
# Vercel rollback
vercel rollback [deployment-url]

# Docker rollback
docker pull your-registry/moxmuse:previous-tag
docker-compose up -d

# Database rollback (if needed)
npx prisma migrate reset
# Restore from backup
psql $DATABASE_URL < backup.sql
```

This deployment guide provides comprehensive instructions for deploying MoxMuse to production with proper security, monitoring, and backup procedures.
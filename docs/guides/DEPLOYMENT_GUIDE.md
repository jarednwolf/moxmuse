# Production Deployment Guide

This guide covers deploying MoxMuse to production using Vercel (for the Next.js app) and Railway (for PostgreSQL and Redis).

## Prerequisites

- GitHub repository with the MoxMuse code
- Vercel account (free tier works)
- Railway account (for database hosting)
- Domain name (optional, for custom domain)

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Vercel    │────▶│  PostgreSQL │     │    Redis    │
│  (Next.js)  │     │  (Railway)  │     │  (Railway)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                         │
       └─────────────────────────────────────────┘
```

## Step 1: Database Setup (Railway)

### PostgreSQL Setup

1. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy PostgreSQL"
   - Railway will provision a PostgreSQL instance

2. **Get Database URL**
   - Click on the PostgreSQL service
   - Go to "Variables" tab
   - Copy `DATABASE_URL` (format: `postgresql://user:pass@host:port/db`)

### Redis Setup

1. **Add Redis to Project**
   - In the same Railway project
   - Click "New" → "Database" → "Add Redis"
   - Railway will provision a Redis instance

2. **Get Redis URL**
   - Click on the Redis service
   - Go to "Variables" tab
   - Copy `REDIS_URL` (format: `redis://default:pass@host:port`)

### Database Migration

1. **Connect to Railway PostgreSQL**
   ```bash
   # Set the DATABASE_URL environment variable
   export DATABASE_URL="your-railway-postgres-url"
   
   # Run migrations
   cd packages/db
   pnpm prisma migrate deploy
   pnpm prisma generate
   ```

2. **Seed Initial Data (Optional)**
   ```bash
   pnpm prisma db seed
   ```

## Step 2: Vercel Deployment

### Initial Setup

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Select the repository containing MoxMuse

2. **Configure Build Settings**
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: `cd ../.. && pnpm install && pnpm run build --filter=web`
   - **Output Directory**: `apps/web/.next`
   - **Install Command**: `pnpm install`

3. **Environment Variables**
   Add these in Vercel's project settings:

   ```env
   # Database
   DATABASE_URL=your-railway-postgres-url
   
   # Redis
   REDIS_URL=your-railway-redis-url
   
   # Auth
   NEXTAUTH_URL=https://your-domain.vercel.app
   NEXTAUTH_SECRET=generate-a-secure-secret
   
   # OAuth (if using Moxfield)
   MOXFIELD_CLIENT_ID=your-moxfield-client-id
   MOXFIELD_CLIENT_SECRET=your-moxfield-client-secret
   MOXFIELD_REDIRECT_URI=https://your-domain.vercel.app/api/auth/callback/moxfield
   
   # OpenAI
   OPENAI_API_KEY=your-openai-api-key
   OPENAI_MODEL=gpt-4-1106-preview
   
   # Affiliate IDs
   TCGPLAYER_AFFILIATE_ID=your-tcgplayer-id
   CARDKINGDOM_AFFILIATE_ID=your-cardkingdom-id
   
   # External APIs
   SCRYFALL_API_BASE=https://api.scryfall.com
   
   # Feature Flags
   ENABLE_COLLECTION_SYNC=true
   ENABLE_AFFILIATE_LINKS=true
   ```

### Generate Secrets

1. **NEXTAUTH_SECRET**
   ```bash
   openssl rand -base64 32
   ```

2. **Update OAuth Redirect URIs**
   - Update Moxfield OAuth app settings with production URL
   - Format: `https://your-domain.vercel.app/api/auth/callback/moxfield`

## Step 3: Deploy

1. **Initial Deployment**
   - Click "Deploy" in Vercel
   - Wait for build to complete (5-10 minutes)
   - Check deployment logs for errors

2. **Verify Deployment**
   - Visit your Vercel URL
   - Test sign-in flow
   - Verify database connectivity

## Step 4: Custom Domain (Optional)

### Vercel Domain Setup

1. **Add Domain**
   - Go to project settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update Environment Variables**
   - Change `NEXTAUTH_URL` to your custom domain
   - Update OAuth redirect URIs

### SSL Certificate

- Vercel automatically provisions SSL certificates
- No additional configuration needed

## Step 5: Production Optimizations

### Database Indexes

1. **Add Performance Indexes**
   ```sql
   -- Add to your Prisma schema or run manually
   CREATE INDEX idx_cards_user_id ON "Card"("userId");
   CREATE INDEX idx_deck_cards_deck_id ON "DeckCard"("deckId");
   CREATE INDEX idx_deck_cards_card_id ON "DeckCard"("cardId");
   ```

### Redis Configuration

1. **Set Eviction Policy**
   - In Railway Redis settings
   - Set maxmemory-policy to `allkeys-lru`
   - Helps with memory management

### Image Optimization

1. **Configure Next.js Images**
   - Already configured for Scryfall domains
   - Add any additional card image domains

## Step 6: Monitoring & Maintenance

### Vercel Analytics

1. **Enable Analytics**
   - In Vercel project settings
   - Enable Web Analytics (free tier available)

2. **Monitor Performance**
   - Check Core Web Vitals
   - Monitor API response times

### Database Backups

1. **Railway Backups**
   - Railway automatically backs up databases
   - Configure backup retention in settings

2. **Manual Backups**
   ```bash
   # Export database
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   ```

### Error Tracking (Optional)

1. **Sentry Integration**
   ```bash
   pnpm add @sentry/nextjs
   ```

2. **Configure Sentry**
   - Add `SENTRY_DSN` to environment variables
   - Follow Sentry Next.js setup guide

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Vercel build logs
   - Ensure all dependencies are in package.json
   - Verify monorepo configuration

2. **Database Connection**
   - Verify DATABASE_URL format
   - Check Railway service is running
   - Ensure SSL mode is configured

3. **Authentication Issues**
   - Verify NEXTAUTH_URL matches deployment
   - Check NEXTAUTH_SECRET is set
   - Ensure OAuth callbacks are updated

### Debug Commands

```bash
# Test database connection
pnpm dlx prisma db pull

# Check environment variables
vercel env ls

# View deployment logs
vercel logs
```

## Security Checklist

- [ ] All secrets are in environment variables
- [ ] NEXTAUTH_SECRET is unique and secure
- [ ] Database has strong passwords
- [ ] OAuth apps use production URLs
- [ ] Affiliate IDs are correct
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Input validation is working

## Post-Deployment

1. **Test Critical Paths**
   - Sign up/Sign in flow
   - Collection import
   - Deck creation
   - AI recommendations

2. **Monitor Usage**
   - Check Vercel dashboard
   - Monitor Railway metrics
   - Track OpenAI usage

3. **Set Up Alerts**
   - Configure uptime monitoring
   - Set database size alerts
   - Monitor error rates

## Scaling Considerations

### When to Scale

- Database CPU > 80% consistently
- Redis memory > 80% full
- API response times > 2s
- Frequent timeout errors

### Scaling Options

1. **Vertical Scaling**
   - Upgrade Railway plan
   - Increase resource limits

2. **Horizontal Scaling**
   - Enable Vercel Edge Functions
   - Implement caching strategies
   - Consider CDN for images

## Cost Estimation

### Monthly Costs (Estimate)

- **Vercel**: $0-20 (free tier usually sufficient)
- **Railway PostgreSQL**: $5-20 (based on usage)
- **Railway Redis**: $5-10 (based on memory)
- **OpenAI API**: $10-50 (based on usage)
- **Domain**: $10-15/year

**Total**: ~$20-100/month depending on usage

## Support

### Resources

- **Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **Railway**: [docs.railway.app](https://docs.railway.app)
- **Next.js**: [nextjs.org/docs](https://nextjs.org/docs)
- **Prisma**: [prisma.io/docs](https://prisma.io/docs)

### Community

- Vercel Discord
- Railway Discord
- Next.js GitHub Discussions

---

**Last Updated**: Current Date
**Version**: 1.0.0 
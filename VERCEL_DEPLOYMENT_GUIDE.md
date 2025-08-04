# Vercel Deployment Guide for MoxMuse

This guide covers deploying MoxMuse to Vercel with Supabase as the database provider.

## Prerequisites

- GitHub repository with your MoxMuse code
- Vercel account (free tier works)
- Supabase account (free tier includes 500MB database)
- OpenAI API key

## Quick Deploy Steps

### 1. Prepare Your Repository

Ensure your repository is pushed to GitHub with all the latest changes:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Deploy to Vercel

1. **Go to [vercel.com](https://vercel.com) and sign in**
2. **Click "Add New..." → "Project"**
3. **Import your GitHub repository**
4. **Configure Project Settings:**
   - Framework Preset: `Next.js` (auto-detected)
   - Root Directory: `.` (leave as is)
   - Build settings will be auto-configured from `vercel.json`

### 3. Configure Environment Variables

Add the following environment variables in Vercel project settings:

#### Database (Supabase)
```
DATABASE_URL=[Your Supabase connection string with pooler]
DATABASE_DIRECT_URL=[Your Supabase direct connection string]
```

#### Supabase Auth
```
NEXT_PUBLIC_SUPABASE_URL=[Your Supabase project URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[Your Supabase anon key]
SUPABASE_SERVICE_ROLE_KEY=[Your Supabase service role key]
```

#### NextAuth
```
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=[Generate with: openssl rand -base64 32]
```

#### OpenAI
```
OPENAI_API_KEY=[Your OpenAI API key]
OPENAI_DEFAULT_TIMEOUT=120000
OPENAI_REASONING_TIMEOUT=300000
OPENAI_RESEARCH_TIMEOUT=900000
DECK_GENERATION_MODEL=gpt-4
```

#### OAuth (Optional)
```
MOXFIELD_CLIENT_ID=[Your Moxfield client ID]
MOXFIELD_CLIENT_SECRET=[Your Moxfield client secret]
MOXFIELD_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback/moxfield
```

#### External APIs
```
SCRYFALL_API_BASE=https://api.scryfall.com
SCRYFALL_BATCH_TIMEOUT=120000
```

#### Feature Flags
```
NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR=true
NEXT_PUBLIC_ENABLE_COMMANDER_SUGGESTIONS=true
NEXT_PUBLIC_ENABLE_ADVANCED_STATISTICS=true
NEXT_PUBLIC_ENABLE_DECK_ANALYSIS_CACHE=true
NEXT_PUBLIC_ENABLE_INTERACTIVE_CHARTS=true
NEXT_PUBLIC_ENABLE_DECK_EXPORT=true
NEXT_PUBLIC_ENABLE_MOXFIELD_INTEGRATION=true
NEXT_PUBLIC_ENABLE_COLLECTION_INTEGRATION=false
NEXT_PUBLIC_ENABLE_VIRTUALIZED_LISTS=true
NEXT_PUBLIC_ENABLE_LAZY_LOADING=true
NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING=false
NEXT_PUBLIC_ENABLE_BETA_FEATURES=true
NEXT_PUBLIC_ENABLE_EXPERIMENTAL_AI=false
NEXT_PUBLIC_DEBUG_MODE=false
ENABLE_PROGRESS_TRACKING=true
PROGRESS_UPDATE_INTERVAL=5000
```

#### Affiliate Settings (Optional)
```
TCGPLAYER_AFFILIATE_ID=[Your TCGPlayer affiliate ID]
CARDKINGDOM_AFFILIATE_ID=[Your Card Kingdom affiliate ID]
CHANNELFIREBALL_AFFILIATE_ID=[Your Channel Fireball affiliate ID]
```

#### Analytics & Monitoring (Optional)
```
NEXT_PUBLIC_GA_MEASUREMENT_ID=[Your Google Analytics ID]
SENTRY_DSN=[Your Sentry DSN]
SENTRY_ORG=[Your Sentry organization]
SENTRY_PROJECT=[Your Sentry project]
SENTRY_AUTH_TOKEN=[Your Sentry auth token]
```

### 4. Database Setup

If you haven't already set up your Supabase database:

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Get your database credentials** from Settings → Database
3. **Run database migrations locally:**

```bash
# Set environment variables
export DATABASE_URL="your-supabase-pooler-url"
export DATABASE_DIRECT_URL="your-supabase-direct-url"

# Run migrations
cd packages/db
pnpm prisma migrate deploy
pnpm prisma generate

# Optional: Seed with demo data
pnpm prisma db seed
```

### 5. Deploy

1. Click **Deploy** in Vercel
2. Wait for the build to complete (5-10 minutes for first deployment)
3. Your app will be available at `https://[your-project].vercel.app`

## Post-Deployment Steps

### 1. Configure Custom Domain (Optional)

1. Go to your Vercel project settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` to your custom domain

### 2. Verify Features

Test the following:
- [ ] Homepage loads correctly
- [ ] Authentication works (sign up/sign in)
- [ ] AI Deck Building Tutor is accessible
- [ ] Card search functionality works
- [ ] Deck generation completes successfully
- [ ] Beta features are visible

### 3. Monitor Performance

1. Check Vercel Analytics dashboard
2. Monitor build times and function execution
3. Review error logs in Vercel Functions tab

## Troubleshooting

### Build Failures

1. **Check build logs** in Vercel dashboard
2. **Common issues:**
   - Missing environment variables
   - TypeScript errors (run `pnpm build` locally)
   - Dependency issues (ensure `pnpm-lock.yaml` is committed)

### Database Connection Issues

1. **Verify DATABASE_URL format:**
   ```
   postgresql://postgres:[password]@[host]:6543/postgres?pgbouncer=true
   ```
2. **Check Supabase dashboard** for connection pool status
3. **Ensure RLS policies** are properly configured

### Authentication Issues

1. **Verify NEXTAUTH_URL** matches your deployment URL
2. **Check NEXTAUTH_SECRET** is set and secure
3. **Update OAuth redirect URIs** if using external providers

### API Timeouts

1. **Vercel Function timeout:** Default is 10s (Pro: 60s, Enterprise: 900s)
2. **For long AI operations:** Consider implementing progress tracking
3. **Use edge functions** for lighter operations

## Optimization Tips

### 1. Image Optimization
- Card images are already configured for Next.js Image component
- Scryfall domains are whitelisted in `next.config.js`

### 2. Caching Strategy
- Static pages are automatically cached by Vercel
- API responses use appropriate cache headers
- Database queries are optimized with indexes

### 3. Bundle Size
- Use dynamic imports for heavy components
- Tree-shaking is enabled by default
- Monitor bundle size in Vercel Analytics

## Environment-Specific Settings

### Development
```bash
NEXT_PUBLIC_DEBUG_MODE=true
NEXT_PUBLIC_ENABLE_EXPERIMENTAL_AI=true
```

### Staging
```bash
NEXT_PUBLIC_ENABLE_BETA_FEATURES=true
NEXT_PUBLIC_DEBUG_MODE=true
```

### Production
```bash
NEXT_PUBLIC_ENABLE_BETA_FEATURES=false
NEXT_PUBLIC_DEBUG_MODE=false
NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING=true
```

## Security Checklist

- [ ] All sensitive keys are in environment variables
- [ ] NEXTAUTH_SECRET is unique and secure
- [ ] Database URLs are not exposed to client
- [ ] Supabase RLS policies are enabled
- [ ] API routes have proper authentication
- [ ] CORS is properly configured

## Cost Estimation

### Free Tier Limits
- **Vercel:** 100GB bandwidth, unlimited deployments
- **Supabase:** 500MB database, 1GB storage, 2GB bandwidth
- **Total:** $0/month for small-medium usage

### Scaling Costs
- **Vercel Pro:** $20/month (increased limits, analytics)
- **Supabase Pro:** $25/month (8GB database, 100GB storage)
- **OpenAI:** Usage-based (~$0.01-0.03 per deck generation)

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [MoxMuse GitHub Issues](https://github.com/yourusername/moxmuse/issues)

---

**Last Updated:** January 2025
**Version:** 1.0.0

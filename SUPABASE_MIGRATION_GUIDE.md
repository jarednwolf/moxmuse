# Supabase Migration Guide for MoxMuse

## Overview
This guide walks through migrating MoxMuse from the current PostgreSQL setup to Supabase, which provides PostgreSQL hosting, authentication, real-time subscriptions, and storage in one platform.

## Why Supabase?
- **Free Tier**: 500MB database, 1GB file storage, 50,000 monthly active users
- **Built-in Auth**: Email/password, OAuth providers, magic links
- **Real-time**: WebSocket subscriptions for live updates
- **Row Level Security**: Fine-grained access control
- **Better than Railway**: More features in free tier, auth included

## Migration Steps

### Step 1: Create Supabase Project

1. **Sign up at [supabase.com](https://supabase.com)**
2. **Create New Project**
   - Project name: `moxmuse` (or `moxmuse-beta`)
   - Database password: Generate a strong password
   - Region: Choose closest to your users
   - Wait for provisioning (~2 minutes)

3. **Get Connection Details**
   - Go to Settings → Database
   - Copy the connection string (use "Transaction" mode)
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres`

### Step 2: Update Prisma Configuration

1. **Update schema.prisma datasource**
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_DIRECT_URL") // For migrations
}
```

2. **Update .env.local**
```env
# Supabase Database URLs
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"
DATABASE_DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"
SUPABASE_SERVICE_ROLE_KEY="[YOUR-SERVICE-KEY]"
```

### Step 3: Migrate Database Schema

```bash
# Set environment variables
export DATABASE_URL="your-supabase-url"
export DATABASE_DIRECT_URL="your-direct-url"

# Generate Prisma client
cd packages/db
pnpm prisma generate

# Push schema to Supabase
pnpm prisma db push

# Optional: Seed with demo data
pnpm prisma db seed
```

### Step 4: Configure Supabase Auth

1. **Enable Email Auth**
   - Go to Authentication → Providers
   - Enable Email provider
   - Configure email templates

2. **Add OAuth Providers (Optional)**
   - Google, GitHub, Discord, etc.
   - Configure redirect URLs

3. **Update Auth Configuration**
   - Set site URL: `https://your-domain.vercel.app`
   - Add redirect URLs for OAuth

### Step 5: Update Application Code

1. **Install Supabase Client**
```bash
pnpm add @supabase/supabase-js @supabase/auth-helpers-nextjs
```

2. **Create Supabase Client** (`packages/shared/src/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

3. **Update Auth Implementation**
   - Replace NextAuth with Supabase Auth
   - Update session management
   - Implement auth middleware

### Step 6: Row Level Security (RLS)

Enable RLS for all tables to secure data access:

```sql
-- Enable RLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Card" ENABLE ROW LEVEL SECURITY;

-- User can only see their own data
CREATE POLICY "Users can view own profile" ON "User"
  FOR SELECT USING (auth.uid() = id);

-- Users can view their own decks
CREATE POLICY "Users can view own decks" ON "Deck"
  FOR SELECT USING (auth.uid() = "userId");

-- Users can create their own decks
CREATE POLICY "Users can create decks" ON "Deck"
  FOR INSERT WITH CHECK (auth.uid() = "userId");

-- Public decks are viewable by all
CREATE POLICY "Public decks are viewable" ON "Deck"
  FOR SELECT USING ("isPublic" = true);
```

### Step 7: Real-time Features (Optional)

Enable real-time subscriptions for live updates:

```typescript
// Subscribe to deck changes
const subscription = supabase
  .channel('deck-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'Deck',
    filter: `userId=eq.${userId}`
  }, (payload) => {
    console.log('Deck changed:', payload)
  })
  .subscribe()
```

### Step 8: Storage for Card Images (Optional)

```typescript
// Upload card image cache
const { data, error } = await supabase.storage
  .from('card-images')
  .upload(`cards/${cardId}.jpg`, imageBlob)
```

## Environment Variables Summary

### Required for Supabase
```env
# Database
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"
DATABASE_DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_KEY]"

# Keep existing
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="[generate-with-openssl]"
OPENAI_API_KEY="[your-key]"
# ... other existing vars
```

## Migration Checklist

- [ ] Create Supabase project
- [ ] Update environment variables
- [ ] Migrate database schema
- [ ] Configure authentication
- [ ] Update auth implementation
- [ ] Set up Row Level Security
- [ ] Test all features
- [ ] Update deployment configuration

## Rollback Plan

If issues arise:
1. Keep Railway database running during migration
2. Test thoroughly on staging first
3. Have database backups ready
4. Can switch back by changing DATABASE_URL

## Next Steps

After successful migration:
1. Update Vercel environment variables
2. Deploy to staging environment
3. Run comprehensive tests
4. Migrate production data
5. Switch DNS when ready

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Prisma with Supabase](https://supabase.com/docs/guides/integrations/prisma)
- [Next.js Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

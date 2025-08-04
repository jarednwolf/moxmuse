# Vercel Prisma Client Generation Fix

## The Problem

Vercel build is failing with:
```
Error: Cannot find module '.prisma/client/default'
```

This happens because Prisma client needs to be generated after installation but before the build.

## Solution Implemented

### 1. Updated `vercel.json`:
```json
{
  "buildCommand": "cd packages/db && pnpm run db:generate && cd ../../apps/web && pnpm run build",
  "installCommand": "pnpm install --no-frozen-lockfile --ignore-scripts --config.dedupe-peer-dependents=false",
  ...
}
```

### 2. Added postinstall script to root `package.json`:
```json
{
  "scripts": {
    ...
    "postinstall": "cd packages/db && pnpm run db:generate"
  }
}
```

### 3. Required Environment Variables

Make sure these are set in Vercel:

**Build & Development Settings:**
- Add `DATABASE_URL` to the environment variables
- Mark it as available during build time

**In Vercel Dashboard:**
1. Go to Settings → Environment Variables
2. Add `DATABASE_URL` with your Supabase connection string
3. **IMPORTANT**: Check the "Production", "Preview", AND "Development" checkboxes
4. Also check "Automatically expose System Environment Variables"

## Alternative: Custom Build Script

If the above doesn't work, create `apps/web/vercel-build.sh`:

```bash
#!/bin/bash
echo "🔧 Generating Prisma Client..."
cd ../../packages/db
pnpm run db:generate

echo "📦 Building Next.js app..."
cd ../../apps/web
pnpm run build
```

Then update `vercel.json`:
```json
{
  "buildCommand": "chmod +x apps/web/vercel-build.sh && ./apps/web/vercel-build.sh",
  ...
}
```

## Debugging Steps

1. Check Vercel build logs for the exact error
2. Ensure DATABASE_URL is available during build
3. Verify Prisma schema location: `packages/db/prisma/schema.prisma`
4. Check that `@prisma/client` is listed in dependencies

## Common Issues

1. **DATABASE_URL not available during build**: 
   - Must be set in Vercel environment variables
   - Must be marked as available during build time

2. **Prisma schema not found**:
   - Ensure schema is at `packages/db/prisma/schema.prisma`
   - Check file is committed to git

3. **Wrong working directory**:
   - Vercel starts at project root
   - All paths must be relative to root

## Quick Test

Run locally to verify:
```bash
# Clean install
rm -rf node_modules packages/*/node_modules
pnpm install

# Check if Prisma client was generated
ls packages/db/node_modules/.prisma/client/

# Try the build
pnpm run build

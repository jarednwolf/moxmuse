# Vercel Deployment Fix - January 4, 2025

## Issues Fixed

### Issue 1: Deployment Stalling During `pnpm install`

The deployment was failing with the following symptoms:
- Build stalls at `pnpm install` while downloading packages
- Progress shows 810 packages to install
- Process times out without completing

### Issue 2: Invalid Functions Configuration

Error: The pattern "apps/web/app/api/trpc/[trpc]/route.ts" defined in `functions` doesn't match any Serverless Functions inside the `api` directory.

## Root Causes Identified

1. **Large dependency count** - 810 packages in monorepo
2. **Network timeout** - Default timeout too short for large installs
3. **Memory constraints** - Node.js running out of memory
4. **Hoisting issues** - pnpm strict mode causing compatibility problems
5. **Invalid functions path** - Vercel expects functions to be in the `api` directory for configuration

## Fixes Applied

### 1. Updated `vercel.json`
```json
{
  "buildCommand": "pnpm turbo run build --filter=@moxmuse/web",
  "installCommand": "pnpm install --frozen-lockfile --prefer-offline",
  "framework": null,
  "outputDirectory": "apps/web/.next",
  "ignoreCommand": "git diff HEAD^ HEAD --quiet .",
  "env": {
    "PNPM_VERSION": "8.14.0",
    "NODE_OPTIONS": "--max-old-space-size=4096"
  },
  "functions": {
    "apps/web/app/api/trpc/[trpc]/route.ts": {
      "maxDuration": 60
    }
  }
}
```

**Key changes:**
- Added `--frozen-lockfile --prefer-offline` to speed up installs
- Added `NODE_OPTIONS` to increase memory to 4GB
- Added filter to only build the web package
- Added maxDuration for API functions

### 2. Created `.npmrc`
```
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=true
node-linker=hoisted
prefer-frozen-lockfile=true
fetch-retries=3
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
fetch-timeout=300000
```

**Key settings:**
- Increased fetch timeout to 5 minutes
- Added retry logic with exponential backoff
- Enabled hoisting for better Vercel compatibility
- Disabled strict peer dependency checks

## Alternative Solutions if Still Failing

### Option 1: Use pnpm workspaces filter
If the deployment still fails, try updating the install command:
```json
"installCommand": "pnpm install --filter=@moxmuse/web... --frozen-lockfile"
```

### Option 2: Pre-bundle dependencies
Create a custom build script that pre-bundles dependencies:
```json
"installCommand": "npm install -g pnpm@8.14.0 && pnpm install --ignore-scripts",
"buildCommand": "pnpm install --frozen-lockfile && pnpm turbo run build"
```

### Option 3: Use Vercel's build cache
Enable build caching in Vercel dashboard:
1. Go to Project Settings > General
2. Enable "Use build cache"
3. Set cache key to include pnpm-lock.yaml

## Monitoring the Deployment

1. Watch the build logs for:
   - Successful package resolution
   - Memory usage warnings
   - Network timeout errors

2. If deployment succeeds but app fails:
   - Check environment variables are set
   - Verify database connections
   - Review function logs for errors

## Next Steps

1. Push these changes to trigger new deployment
2. Monitor build logs closely
3. If still failing, implement alternative solutions
4. Consider contacting Vercel support with build logs

## Related Documentation
- [Vercel pnpm Support](https://vercel.com/docs/build-systems/pnpm)
- [Vercel Build Troubleshooting](https://vercel.com/docs/troubleshooting/deployment)
- [pnpm Configuration](https://pnpm.io/npmrc)

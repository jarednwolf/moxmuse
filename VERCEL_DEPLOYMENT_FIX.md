# Vercel Deployment Fix - January 4, 2025

## Current Status
Multiple attempts to fix deployment timeout during package installation. Latest approach uses the `root` directory setting to isolate the web app build.

## Issues Encountered

### Issue 1: Deployment Stalling During `pnpm install`
- Build consistently stalls while downloading packages
- Shows 846+ packages to install (monorepo includes all workspace packages)
- Process times out without completing

### Issue 2: Invalid Functions Configuration (FIXED)
- Error: The pattern "apps/web/app/api/trpc/[trpc]/route.ts" defined in `functions` doesn't match
- Solution: Removed the functions configuration

## Root Causes
1. **Monorepo complexity** - Vercel trying to install all workspace packages
2. **Large dependency count** - 846+ packages across all workspaces
3. **Network constraints** - Vercel build environment has limited concurrent downloads
4. **Memory constraints** - Node.js running out of memory during install

## Attempted Solutions

### Attempt 1: Basic Optimizations
- Added memory allocation (`NODE_OPTIONS`)
- Used `--frozen-lockfile --prefer-offline`
- Result: Still stalled at ~174 packages

### Attempt 2: Workspace Filtering
- Used `--filter=@moxmuse/web...` to limit packages
- Result: Still installed all 846 packages

### Attempt 3: Aggressive .npmrc Settings
- Limited concurrency to 1
- Increased timeouts to 10 minutes
- Added retries and offline preferences
- Result: Slight improvement but still stalling

### Attempt 4: Root Directory Isolation (CURRENT)
- Set `"root": "apps/web"` in vercel.json
- Using `--no-frozen-lockfile --ignore-scripts`
- This should limit the build to just the web app directory

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

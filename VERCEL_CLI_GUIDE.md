# Vercel CLI Guide for Efficient Deployment

## Installation

```bash
npm install -g vercel
```

## Initial Setup

1. **Login to Vercel**
   ```bash
   vercel login
   ```

2. **Link your project**
   ```bash
   vercel link
   ```
   - Choose your scope (personal or team)
   - Link to existing project or create new one

## Development Commands

### 1. Local Development with Vercel Environment
```bash
vercel dev
```
- Runs your app locally with Vercel's serverless functions
- Automatically loads environment variables from Vercel
- Simulates the Vercel runtime environment

### 2. Pull Environment Variables
```bash
vercel env pull .env.local
```
- Downloads all environment variables from your Vercel project
- Saves them to `.env.local` for local development

### 3. Build Locally (Test Before Deploy)
```bash
vercel build
```
- Builds your project using Vercel's build process
- Helps catch errors before deployment
- Uses the same build configuration as production

## Deployment Commands

### 1. Deploy to Preview
```bash
vercel
```
- Creates a preview deployment
- Gives you a unique URL to test
- Doesn't affect production

### 2. Deploy to Production
```bash
vercel --prod
```
- Deploys directly to production
- Updates your main domain

### 3. Deploy with Custom Build Command
```bash
vercel --build-env NODE_OPTIONS="--max-old-space-size=4096"
```

## Debugging and Monitoring

### 1. View Logs
```bash
vercel logs
```
- Shows real-time logs from your deployment
- Useful for debugging runtime errors

### 2. List Deployments
```bash
vercel ls
```
- Shows all recent deployments
- Includes status and URLs

### 3. Inspect a Deployment
```bash
vercel inspect [deployment-url]
```
- Shows detailed information about a specific deployment
- Includes build logs and configuration

## Environment Variables Management

### 1. List Environment Variables
```bash
vercel env ls
```

### 2. Add Environment Variable
```bash
vercel env add
```
- Interactive prompt to add new variables
- Can specify environment (development/preview/production)

### 3. Remove Environment Variable
```bash
vercel env rm [variable-name]
```

## Useful Scripts for Your Project

Add these to your `package.json`:

```json
{
  "scripts": {
    "vercel:dev": "vercel dev",
    "vercel:build": "vercel build",
    "vercel:deploy": "vercel",
    "vercel:prod": "vercel --prod",
    "vercel:logs": "vercel logs --follow",
    "vercel:env": "vercel env pull .env.local",
    "test:build": "cd apps/web && pnpm run build",
    "fix:types": "node scripts/fix-typescript-errors.js"
  }
}
```

## Troubleshooting Workflow

1. **Test build locally first**
   ```bash
   pnpm test:build
   ```

2. **Fix any TypeScript errors**
   ```bash
   pnpm fix:types
   ```

3. **Test with Vercel build**
   ```bash
   vercel build
   ```

4. **Deploy to preview**
   ```bash
   vercel
   ```

5. **Check logs if deployment fails**
   ```bash
   vercel logs --follow
   ```

6. **Deploy to production when ready**
   ```bash
   vercel --prod
   ```

## Configuration Tips

### 1. Custom Build Configuration
Create a `vercel.json` in your project root (which you already have).

### 2. Ignore Build Errors Temporarily
```bash
vercel --force
```
- Deploys even with build warnings
- Use cautiously

### 3. Skip Build Cache
```bash
vercel --force --no-cache
```
- Forces a fresh build
- Useful when debugging dependency issues

## Common Issues and Solutions

### 1. Build Timeout
- Use `--build-env VERCEL_BUILD_TIMEOUT="45m"` for longer builds
- Already configured in your `vercel.json`

### 2. Memory Issues
- Already configured with `NODE_OPTIONS="--max-old-space-size=4096"`
- Can increase if needed

### 3. Monorepo Issues
- Your configuration already handles this with `cd apps/web`
- Vercel CLI respects your `vercel.json` settings

## Quick Deployment Test

```bash
# 1. Pull latest environment variables
vercel env pull .env.local

# 2. Test build locally
pnpm test:build

# 3. Deploy to preview
vercel

# 4. Check the preview URL
# 5. If everything works, deploy to production
vercel --prod
```

## Benefits of Using Vercel CLI

1. **Faster feedback loop** - Test deployments without pushing to GitHub
2. **Environment parity** - Local dev environment matches production
3. **Better debugging** - Access to detailed logs and build output
4. **Efficient workflows** - Deploy directly from your terminal
5. **Environment management** - Easy env var synchronization

Your project is now ready for efficient Vercel CLI deployment!

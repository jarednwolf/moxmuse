# Environment File Consolidation Guide

## Overview

I've consolidated your environment configuration into a single `.env.local` file, which is the recommended approach for Next.js applications. This eliminates confusion and ensures all your configuration is in one place.

## What Was Done

### 1. **Consolidated Configuration**
- Merged all settings from `.env`, `.env.local`, and `env.example` into a single `.env.local` file
- Added all the new timeout configuration settings from the recent timeout improvements
- Preserved your existing credentials and API keys

### 2. **Added Timeout Configuration**
The following timeout settings have been added to support model-specific timeouts:

```env
# Configurable timeouts (in milliseconds)
OPENAI_DEFAULT_TIMEOUT="120000"  # 2 minutes default
OPENAI_REASONING_TIMEOUT="300000"  # 5 minutes for o1 models
OPENAI_RESEARCH_TIMEOUT="900000"  # 15 minutes for deep research
SCRYFALL_BATCH_TIMEOUT="120000"  # 2 minutes for card lookups

# Model selection
DECK_GENERATION_MODEL="gpt-4o-mini"  # or gpt-4-turbo, o1-preview, etc

# Progress tracking
ENABLE_PROGRESS_TRACKING="true"
PROGRESS_UPDATE_INTERVAL="5000"  # Update every 5 seconds
```

## Best Practices

### 1. **Environment File Structure**
- **`.env`** - Should only contain non-sensitive defaults (rarely needed in Next.js)
- **`.env.local`** - Your actual configuration with sensitive data (always gitignored)
- **`env.example`** - Template file showing required variables without real values

### 2. **Next.js Environment Loading Order**
Next.js loads environment files in this order:
1. `.env.local` (highest priority)
2. `.env.development` or `.env.production`
3. `.env` (lowest priority)

### 3. **Security Considerations**
- `.env.local` is gitignored by default - NEVER commit this file
- Store production secrets in your deployment platform's environment variables
- Use `env.example` to document required variables for other developers

### 4. **Variable Naming Conventions**
- `NEXT_PUBLIC_*` - Exposed to the browser (use for non-sensitive client-side config)
- Regular variables - Only available server-side (use for secrets and sensitive data)

## Next Steps

1. **Delete `.env`** - You no longer need this file since everything is in `.env.local`
   ```bash
   rm .env
   ```

2. **Verify Application** - Restart your development server to ensure all variables load correctly:
   ```bash
   pnpm dev
   ```

3. **Update Documentation** - Consider updating your README or setup documentation to reflect this change

## Using the Timeout Configuration

The timeout configuration is now ready to use with your deck generation system:

- **Default timeout**: 2 minutes for standard models
- **Reasoning timeout**: 5 minutes for o1 models that need more thinking time
- **Research timeout**: 15 minutes for deep research tasks
- **Scryfall timeout**: 2 minutes for card data lookups

These timeouts prevent the 30-second timeout issues you were experiencing with thinking models.

## Environment Variables Reference

All your environment variables are now properly consolidated in `.env.local` with:
- Database and Redis configuration
- Authentication settings
- OAuth credentials
- OpenAI configuration with timeout settings
- Feature flags
- Analytics setup
- Affiliate IDs

The system is now properly configured to handle long-running AI operations without timeout issues!

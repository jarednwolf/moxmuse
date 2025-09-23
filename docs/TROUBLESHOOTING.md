# MoxMuse Troubleshooting Guide

This guide helps you diagnose and resolve common issues when developing or deploying MoxMuse.

## Development Issues

### Installation Problems

#### `pnpm install` fails
```bash
# Clear package manager cache
pnpm store prune

# Remove node_modules and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install

# Check Node.js version
node --version  # Should be 20+
pnpm --version  # Should be 8+
```

#### TypeScript errors after installation
```bash
# Regenerate Prisma client
pnpm db:generate

# Check TypeScript configuration
pnpm type-check

# Clear Next.js cache
rm -rf apps/web/.next
pnpm build
```

### Database Issues

#### Cannot connect to PostgreSQL
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Start PostgreSQL (macOS)
brew services start postgresql

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check environment variables
echo $DATABASE_URL
```

#### Prisma migration errors
```bash
# Check migration status
npx prisma migrate status

# Reset database (WARNING: destroys data)
npx prisma migrate reset

# Apply pending migrations
npx prisma migrate deploy

# Generate client after schema changes
npx prisma generate
```

#### Database schema out of sync
```bash
# Push schema changes without migration
npx prisma db push

# Or create a new migration
npx prisma migrate dev --name fix_schema_sync

# Verify schema
npx prisma db pull
```

### Development Server Issues

#### Port already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 pnpm dev
```

#### Hot reload not working
```bash
# Clear Next.js cache
rm -rf apps/web/.next

# Restart development server
pnpm dev

# Check file watchers (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### Build errors
```bash
# Check for TypeScript errors
pnpm type-check

# Check for linting errors
pnpm lint

# Clear all caches
rm -rf node_modules .next .turbo
pnpm install
pnpm build
```

### AI Service Issues

#### OpenAI API errors
```bash
# Test API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Check rate limits
# OpenAI returns rate limit headers in responses

# Verify environment variable
echo $OPENAI_API_KEY
```

#### Deck generation timeouts
```bash
# Increase timeout in environment
OPENAI_DEFAULT_TIMEOUT=300000  # 5 minutes

# Check OpenAI status
curl https://status.openai.com/api/v2/status.json

# Monitor API usage in OpenAI dashboard
```

#### AI responses malformed
```bash
# Check prompt construction
console.log('Generated prompt:', prompt)

# Verify response parsing
console.log('Raw AI response:', response)

# Test with simpler prompts
```

## Production Issues

### Deployment Failures

#### Vercel build fails
```bash
# Check build logs in Vercel dashboard
vercel logs [deployment-url]

# Test build locally
pnpm build

# Check environment variables
vercel env ls
```

#### Docker build fails
```bash
# Build locally to debug
docker build -t moxmuse .

# Check Dockerfile syntax
docker build --no-cache -t moxmuse .

# Inspect build layers
docker history moxmuse
```

#### Railway deployment issues
```bash
# Check deployment logs
railway logs

# Verify environment variables
railway variables

# Test database connection
railway connect
```

### Runtime Errors

#### 500 Internal Server Error
```bash
# Check application logs
# Vercel: Check Functions tab in dashboard
# Railway: railway logs
# Docker: docker logs container-name

# Common causes:
# - Missing environment variables
# - Database connection issues
# - OpenAI API failures
```

#### Database connection pool exhausted
```bash
# Check connection pool settings in Prisma
# Increase pool size if needed
DATABASE_URL="postgresql://user:pass@host/db?connection_limit=20"

# Monitor active connections
SELECT count(*) FROM pg_stat_activity;

# Check for connection leaks in code
```

#### Memory issues
```bash
# Monitor memory usage
# Vercel: Check Functions tab for memory usage
# Railway: Check metrics in dashboard

# Optimize memory usage:
# - Reduce bundle size
# - Implement proper caching
# - Use streaming for large responses
```

### Performance Issues

#### Slow page loads
```bash
# Analyze bundle size
npx @next/bundle-analyzer

# Check Core Web Vitals
# Use Lighthouse or PageSpeed Insights

# Profile React components
# Use React DevTools Profiler
```

#### Database query performance
```sql
-- Enable query logging
SET log_statement = 'all';

-- Analyze slow queries
EXPLAIN ANALYZE SELECT * FROM generated_decks 
WHERE user_id = $1 ORDER BY created_at DESC;

-- Check for missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats WHERE tablename = 'generated_decks';
```

#### API response times
```bash
# Monitor API performance
# Use Vercel Analytics or custom monitoring

# Profile tRPC procedures
console.time('generateFullDeck')
// ... procedure code
console.timeEnd('generateFullDeck')

# Check external API latency
curl -w "@curl-format.txt" -o /dev/null -s "https://api.openai.com/v1/models"
```

## Testing Issues

### Unit Test Failures

#### Tests fail after dependency updates
```bash
# Clear test cache
pnpm test --clearCache

# Update test snapshots
pnpm test --updateSnapshot

# Check for breaking changes in dependencies
```

#### Mock issues
```bash
# Clear module cache in tests
jest.clearAllMocks()
jest.resetModules()

# Check mock implementations
console.log(jest.mocked(mockFunction).mock.calls)
```

### E2E Test Failures

#### Playwright tests timeout
```bash
# Increase timeout
test.setTimeout(60000)

# Run in headed mode for debugging
pnpm test:e2e --headed

# Check for race conditions
await page.waitForSelector('[data-testid="element"]')
```

#### Test database issues
```bash
# Use separate test database
TEST_DATABASE_URL="postgresql://user:pass@host/test_db"

# Reset test database before tests
beforeAll(async () => {
  await prisma.$executeRaw`TRUNCATE TABLE users CASCADE`
})
```

## Common Error Messages

### "Module not found"
```bash
# Check import paths
# Ensure TypeScript paths are configured correctly
# Verify file exists and has correct extension

# Clear module resolution cache
rm -rf node_modules/.cache
```

### "Cannot read property of undefined"
```bash
# Add null checks
if (data?.property) {
  // Use property
}

# Use optional chaining
const value = data?.nested?.property

# Check data flow in React DevTools
```

### "TRPC_ERROR: UNAUTHORIZED"
```bash
# Check authentication status
console.log('Session:', session)

# Verify NextAuth configuration
# Check session cookie in browser DevTools

# Ensure protected procedures have proper auth
```

### "Prisma Client Validation Error"
```bash
# Check data types match schema
# Verify required fields are provided
# Ensure foreign key relationships exist

# Regenerate Prisma client
pnpm db:generate
```

## Debugging Techniques

### Frontend Debugging

#### React DevTools
```bash
# Install React DevTools browser extension
# Use Components tab to inspect props/state
# Use Profiler tab to identify performance issues
```

#### Browser DevTools
```bash
# Network tab: Check API requests/responses
# Console tab: Check for JavaScript errors
# Application tab: Check localStorage/cookies
# Performance tab: Profile runtime performance
```

#### Next.js Debugging
```bash
# Enable debug mode
DEBUG=* pnpm dev

# Check build analysis
ANALYZE=true pnpm build

# Inspect bundle
npx @next/bundle-analyzer
```

### Backend Debugging

#### Database Debugging
```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;
```

#### API Debugging
```typescript
// Add logging to tRPC procedures
.mutation(async ({ ctx, input }) => {
  console.log('Input:', input)
  console.log('User:', ctx.session?.user)
  
  try {
    const result = await someOperation(input)
    console.log('Result:', result)
    return result
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
})
```

#### OpenAI Debugging
```typescript
// Log prompts and responses
console.log('Prompt sent to OpenAI:', prompt)
console.log('OpenAI response:', response)

// Check token usage
console.log('Tokens used:', response.usage)

// Validate response format
if (!response.choices?.[0]?.message?.content) {
  throw new Error('Invalid OpenAI response format')
}
```

## Performance Monitoring

### Client-Side Monitoring
```typescript
// Core Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

getCLS(console.log)
getFID(console.log)
getFCP(console.log)
getLCP(console.log)
getTTFB(console.log)
```

### Server-Side Monitoring
```typescript
// Response time monitoring
const start = Date.now()
// ... operation
const duration = Date.now() - start
console.log(`Operation took ${duration}ms`)

// Memory usage
console.log('Memory usage:', process.memoryUsage())

// Database connection pool
console.log('DB connections:', await prisma.$queryRaw`
  SELECT count(*) FROM pg_stat_activity
`)
```

## Getting Help

### Before Asking for Help

1. **Check this troubleshooting guide**
2. **Search existing GitHub issues**
3. **Check the documentation**
4. **Try to reproduce the issue**
5. **Gather relevant information**

### Information to Include

When reporting issues, include:

- **Environment details** (OS, Node.js version, pnpm version)
- **Error messages** (full stack traces)
- **Steps to reproduce** (minimal example)
- **Expected vs actual behavior**
- **Configuration files** (sanitized)
- **Logs** (relevant portions)

### Where to Get Help

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community help
- **Discord**: Real-time community support
- **Documentation**: Comprehensive guides and references

### Creating Good Bug Reports

```markdown
## Bug Report

### Environment
- OS: macOS 13.0
- Node.js: 20.5.0
- pnpm: 8.6.0
- MoxMuse version: 1.0.0

### Description
Brief description of the issue.

### Steps to Reproduce
1. Go to /tutor
2. Click "Build Full Deck"
3. Complete wizard
4. See error

### Expected Behavior
Deck should be generated successfully.

### Actual Behavior
Error: "OpenAI API timeout"

### Error Logs
```
[Error logs here]
```

### Additional Context
Any other relevant information.
```

This troubleshooting guide should help you resolve most common issues. If you encounter problems not covered here, please create an issue on GitHub with detailed information.
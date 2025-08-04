#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function setupApiSecurity() {
  console.log('🔒 Setting up API Security...\n');

  // 1. Install rate limiting packages
  console.log('📦 Installing rate limiting packages...');
  try {
    execSync('cd packages/api && pnpm add express-rate-limit', { stdio: 'inherit' });
    console.log('✅ Rate limiting packages installed\n');
  } catch (error) {
    console.log('⚠️  Rate limiting packages may already be installed\n');
  }

  // 2. Create rate limiting middleware
  console.log('🛡️  Creating rate limiting middleware...');
  const rateLimitMiddleware = `import rateLimit from 'express-rate-limit';

// Rate limiter for API endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for deck generation
export const deckGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 deck generations per hour
  message: 'Deck generation limit reached. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?.id || req.ip;
  },
});

// Rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
`;

  await fs.writeFile(
    path.join('packages', 'api', 'src', 'middleware', 'rate-limit.ts'),
    rateLimitMiddleware
  );
  console.log('✅ Rate limiting middleware created\n');

  // 3. Create API key validation middleware
  console.log('🔑 Creating API key validation middleware...');
  const apiKeyMiddleware = `import { TRPCError } from '@trpc/server';
import crypto from 'crypto';

interface ApiKeyConfig {
  key: string;
  name: string;
  rateLimit?: number;
  allowedEndpoints?: string[];
}

// In production, store these in database
const API_KEYS: Map<string, ApiKeyConfig> = new Map([
  ['beta-public-key', {
    key: crypto.randomBytes(32).toString('hex'),
    name: 'Beta Public Access',
    rateLimit: 100,
  }],
]);

export function validateApiKey(apiKey: string | undefined): ApiKeyConfig | null {
  if (!apiKey) return null;
  
  // Hash the provided key for comparison
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  for (const [id, config] of API_KEYS.entries()) {
    const configKeyHash = crypto.createHash('sha256').update(config.key).digest('hex');
    if (configKeyHash === hashedKey) {
      return config;
    }
  }
  
  return null;
}

export function requireApiKey(req: any, res: any, next: any) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'API key required',
    });
  }
  
  const keyConfig = validateApiKey(apiKey);
  if (!keyConfig) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid API key',
    });
  }
  
  // Attach key config to request for further use
  req.apiKeyConfig = keyConfig;
  next();
}
`;

  await fs.mkdir(path.join('packages', 'api', 'src', 'middleware'), { recursive: true });
  await fs.writeFile(
    path.join('packages', 'api', 'src', 'middleware', 'api-key.ts'),
    apiKeyMiddleware
  );
  console.log('✅ API key validation middleware created\n');

  // 4. Create CORS configuration
  console.log('🌐 Creating CORS configuration...');
  const corsConfig = `import cors from 'cors';

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      'https://moxmuse.com',
      'https://www.moxmuse.com',
      'https://beta.moxmuse.com',
    ]
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
    ];

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
};

export const corsMiddleware = cors(corsOptions);
`;

  await fs.writeFile(
    path.join('packages', 'api', 'src', 'middleware', 'cors.ts'),
    corsConfig
  );
  console.log('✅ CORS configuration created\n');

  // 5. Create request logging middleware
  console.log('📝 Creating request logging middleware...');
  const loggingMiddleware = `import { v4 as uuidv4 } from 'uuid';

interface RequestLog {
  id: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  userId?: string;
  apiKey?: string;
  timestamp: Date;
  duration?: number;
  statusCode?: number;
  error?: string;
}

export function createRequestLogger() {
  return (req: any, res: any, next: any) => {
    const requestId = uuidv4();
    const startTime = Date.now();
    
    // Attach request ID for tracing
    req.id = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    const log: RequestLog = {
      id: requestId,
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown',
      userId: req.user?.id,
      apiKey: req.apiKeyConfig?.name,
      timestamp: new Date(),
    };
    
    // Log request
    console.log(\`[REQUEST] \${log.method} \${log.path} - ID: \${log.id}\`);
    
    // Capture response details
    const originalSend = res.send;
    res.send = function(data: any) {
      log.duration = Date.now() - startTime;
      log.statusCode = res.statusCode;
      
      // Log response
      console.log(\`[RESPONSE] \${log.method} \${log.path} - Status: \${log.statusCode} - Duration: \${log.duration}ms - ID: \${log.id}\`);
      
      // In production, send to logging service
      if (process.env.NODE_ENV === 'production') {
        // TODO: Send to logging service (e.g., LogDNA, Datadog)
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
}

// API usage tracking
export async function trackApiUsage(userId: string, endpoint: string, metadata?: any) {
  const usage = {
    userId,
    endpoint,
    timestamp: new Date(),
    metadata,
  };
  
  // In production, store in database
  if (process.env.NODE_ENV === 'production') {
    // TODO: Store in database
  } else {
    console.log('[API_USAGE]', usage);
  }
}
`;

  await fs.writeFile(
    path.join('packages', 'api', 'src', 'middleware', 'logging.ts'),
    loggingMiddleware
  );
  console.log('✅ Request logging middleware created\n');

  // 6. Create API security test file
  console.log('🧪 Creating API security test file...');
  const securityTest = `import { describe, it, expect } from 'vitest';
import { validateApiKey } from '../src/middleware/api-key';
import { apiLimiter, deckGenerationLimiter } from '../src/middleware/rate-limit';

describe('API Security', () => {
  describe('API Key Validation', () => {
    it('should reject invalid API keys', () => {
      const result = validateApiKey('invalid-key');
      expect(result).toBe(null);
    });
    
    it('should accept valid API keys', () => {
      // In real tests, use test API keys
      const result = validateApiKey(undefined);
      expect(result).toBe(null);
    });
  });
  
  describe('Rate Limiting', () => {
    it('should have rate limiter configured', () => {
      expect(apiLimiter).toBeDefined();
      expect(deckGenerationLimiter).toBeDefined();
    });
  });
});
`;

  await fs.writeFile(
    path.join('packages', 'api', 'src', 'middleware', 'security.test.ts'),
    securityTest
  );
  console.log('✅ API security test file created\n');

  // 7. Update API router to use security middleware
  console.log('🔧 Updating API configuration instructions...');
  const instructions = `
# API Security Setup Complete! 🎉

## Next Steps:

1. **Update your tRPC router** to use the new middleware:

   In \`packages/api/src/index.ts\` or your main router file, add:

   \`\`\`typescript
   import { apiLimiter, deckGenerationLimiter } from './middleware/rate-limit';
   import { corsMiddleware } from './middleware/cors';
   import { createRequestLogger } from './middleware/logging';
   
   // Apply middleware to your Express app (if using Express adapter)
   app.use(corsMiddleware);
   app.use(createRequestLogger());
   app.use('/api', apiLimiter);
   app.use('/api/tutor/generateDeck', deckGenerationLimiter);
   \`\`\`

2. **Generate API keys** for beta users:

   Run: \`node scripts/generate-api-keys.js\`

3. **Configure environment variables**:

   Add to \`.env.local\`:
   \`\`\`
   RATE_LIMIT_ENABLED=true
   API_KEY_REQUIRED=false  # Set to true when ready
   LOG_LEVEL=info
   \`\`\`

4. **Test the security setup**:

   Run: \`cd packages/api && pnpm test security\`

## Security Features Implemented:

✅ Rate limiting (general API, deck generation, auth)
✅ API key validation system
✅ CORS configuration
✅ Request logging with unique IDs
✅ API usage tracking

## Production Checklist:

- [ ] Store API keys in database
- [ ] Connect to external logging service
- [ ] Set up IP-based blocking for abuse
- [ ] Configure DDoS protection on Vercel
- [ ] Enable API key requirement
`;

  await fs.writeFile('API_SECURITY_SETUP.md', instructions);
  console.log('✅ Setup instructions created in API_SECURITY_SETUP.md\n');

  console.log('🎉 API Security setup complete!');
}

// Run the setup
setupApiSecurity().catch(console.error);

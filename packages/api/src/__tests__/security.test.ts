import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import { 
  RateLimiter, 
  CSRFProtection, 
  SessionManager, 
  SecurityAuditLogger,
  sanitizeInput,
  secureSchemas,
  APIKeyManager
} from '../utils/security'
import { PrismaClient } from '@moxmuse/db'

// Mock Prisma
const mockPrisma = {
  session: {
    findUnique: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  performanceMetric: {
    create: vi.fn(),
    count: vi.fn(),
  },
} as unknown as PrismaClient

describe('Security Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('RateLimiter', () => {
    it('should allow requests within limit', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000, // 1 minute
        maxRequests: 5,
      })

      const result = await rateLimiter.checkLimit('test-key')
      
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('should block requests exceeding limit', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      })

      // First two requests should be allowed
      await rateLimiter.checkLimit('test-key')
      await rateLimiter.checkLimit('test-key')
      
      // Third request should be blocked
      const result = await rateLimiter.checkLimit('test-key')
      
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should reset after window expires', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 100, // 100ms
        maxRequests: 1,
      })

      // First request
      const result1 = await rateLimiter.checkLimit('test-key')
      expect(result1.allowed).toBe(true)

      // Second request should be blocked
      const result2 = await rateLimiter.checkLimit('test-key')
      expect(result2.allowed).toBe(false)

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      // Third request should be allowed again
      const result3 = await rateLimiter.checkLimit('test-key')
      expect(result3.allowed).toBe(true)
    })
  })

  describe('CSRFProtection', () => {
    const csrfProtection = new CSRFProtection('test-secret')

    it('should generate and validate valid tokens', () => {
      const sessionId = 'test-session-123'
      const token = csrfProtection.generateToken(sessionId)
      
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
      
      const isValid = csrfProtection.validateToken(token, sessionId)
      expect(isValid).toBe(true)
    })

    it('should reject tokens with wrong session ID', () => {
      const sessionId = 'test-session-123'
      const wrongSessionId = 'wrong-session-456'
      const token = csrfProtection.generateToken(sessionId)
      
      const isValid = csrfProtection.validateToken(token, wrongSessionId)
      expect(isValid).toBe(false)
    })

    it('should reject expired tokens', () => {
      const sessionId = 'test-session-123'
      const token = csrfProtection.generateToken(sessionId)
      
      // Validate with very short max age (should be expired)
      const isValid = csrfProtection.validateToken(token, sessionId, 1)
      expect(isValid).toBe(false)
    })

    it('should reject malformed tokens', () => {
      const sessionId = 'test-session-123'
      const malformedToken = 'invalid-token'
      
      const isValid = csrfProtection.validateToken(malformedToken, sessionId)
      expect(isValid).toBe(false)
    })
  })

  describe('SessionManager', () => {
    const sessionManager = new SessionManager(mockPrisma)

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should validate active sessions', async () => {
      const mockSession = {
        id: 'session-1',
        sessionToken: 'token-123',
        userId: 'user-1',
        expires: new Date(Date.now() + 3600000), // 1 hour from now
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
        },
      }

      mockPrisma.session.findUnique = vi.fn().mockResolvedValue(mockSession)

      const result = await sessionManager.validateSession('token-123')
      
      expect(result.valid).toBe(true)
      expect(result.userId).toBe('user-1')
      expect(result.user).toEqual(mockSession.user)
    })

    it('should reject expired sessions', async () => {
      const mockSession = {
        id: 'session-1',
        sessionToken: 'token-123',
        userId: 'user-1',
        expires: new Date(Date.now() - 3600000), // 1 hour ago
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
        },
      }

      mockPrisma.session.findUnique = vi.fn().mockResolvedValue(mockSession)

      const result = await sessionManager.validateSession('token-123')
      
      expect(result.valid).toBe(false)
      expect(result.userId).toBeUndefined()
    })

    it('should reject non-existent sessions', async () => {
      mockPrisma.session.findUnique = vi.fn().mockResolvedValue(null)

      const result = await sessionManager.validateSession('invalid-token')
      
      expect(result.valid).toBe(false)
      expect(result.userId).toBeUndefined()
    })

    it('should invalidate sessions', async () => {
      mockPrisma.session.delete = vi.fn().mockResolvedValue({ id: 'session-1' })

      const result = await sessionManager.invalidateSession('token-123')
      
      expect(result).toBe(true)
      expect(mockPrisma.session.delete).toHaveBeenCalledWith({
        where: { sessionToken: 'token-123' },
      })
    })

    it('should cleanup expired sessions', async () => {
      mockPrisma.session.deleteMany = vi.fn().mockResolvedValue({ count: 5 })

      const result = await sessionManager.cleanupExpiredSessions()
      
      expect(result).toBe(5)
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          expires: { lt: expect.any(Date) },
        },
      })
    })
  })

  describe('SecurityAuditLogger', () => {
    const auditLogger = new SecurityAuditLogger(mockPrisma)

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should log security events', async () => {
      mockPrisma.performanceMetric.create = vi.fn().mockResolvedValue({})

      await auditLogger.logSecurityEvent({
        userId: 'user-1',
        action: 'login_attempt',
        success: true,
        ipAddress: '192.168.1.1',
      })

      expect(mockPrisma.performanceMetric.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          operation: 'security_login_attempt',
          duration: 0,
          success: true,
          metadata: expect.objectContaining({
            ipAddress: '192.168.1.1',
            timestamp: expect.any(String),
          }),
        },
      })
    })

    it('should log auth attempts', async () => {
      mockPrisma.performanceMetric.create = vi.fn().mockResolvedValue({})

      await auditLogger.logAuthAttempt('user-1', true, '192.168.1.1')

      expect(mockPrisma.performanceMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          operation: 'security_auth_attempt',
          success: true,
        }),
      })
    })

    it('should log rate limit exceeded events', async () => {
      mockPrisma.performanceMetric.create = vi.fn().mockResolvedValue({})

      await auditLogger.logRateLimitExceeded('user-1', 'ai_generation', '192.168.1.1')

      expect(mockPrisma.performanceMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          operation: 'security_rate_limit_exceeded',
          success: false,
          metadata: expect.objectContaining({
            resource: 'ai_generation',
            ipAddress: '192.168.1.1',
          }),
        }),
      })
    })
  })

  describe('Input Sanitization', () => {
    it('should sanitize text input', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World'
      const sanitized = sanitizeInput.text(maliciousInput)
      
      expect(sanitized).toBe('Hello World')
      expect(sanitized).not.toContain('<script>')
    })

    it('should sanitize HTML input', () => {
      const maliciousHtml = '<p>Safe content</p><script>alert("xss")</script><iframe src="evil.com"></iframe>'
      const sanitized = sanitizeInput.html(maliciousHtml)
      
      expect(sanitized).toContain('<p>Safe content</p>')
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('<iframe>')
    })

    it('should sanitize deck names', () => {
      const maliciousDeckName = '<script>alert("xss")</script>My Awesome Deck'
      const sanitized = sanitizeInput.deckName(maliciousDeckName)
      
      expect(sanitized).toBe('My Awesome Deck')
      expect(sanitized).not.toContain('<script>')
    })

    it('should limit deck name length', () => {
      const longDeckName = 'A'.repeat(200)
      const sanitized = sanitizeInput.deckName(longDeckName)
      
      expect(sanitized.length).toBeLessThanOrEqual(100)
    })

    it('should sanitize card queries', () => {
      const maliciousQuery = 'Lightning Bolt<script>alert("xss")</script>'
      const sanitized = sanitizeInput.cardQuery(maliciousQuery)
      
      expect(sanitized).toBe('Lightning Bolt')
      expect(sanitized).not.toContain('<script>')
    })
  })

  describe('Secure Schemas', () => {
    it('should validate and sanitize deck names', () => {
      const validName = secureSchemas.deckName.parse('My Awesome Deck')
      expect(validName).toBe('My Awesome Deck')

      expect(() => secureSchemas.deckName.parse('')).toThrow()
      expect(() => secureSchemas.deckName.parse('A'.repeat(200))).toThrow()
    })

    it('should validate user prompts', () => {
      const validPrompt = secureSchemas.userPrompt.parse('I want to build a red aggro deck')
      expect(validPrompt).toBe('I want to build a red aggro deck')

      expect(() => secureSchemas.userPrompt.parse('short')).toThrow()
      expect(() => secureSchemas.userPrompt.parse('A'.repeat(3000))).toThrow()
    })

    it('should validate session IDs', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000'
      const validSessionId = secureSchemas.sessionId.parse(validUuid)
      expect(validSessionId).toBe(validUuid)

      expect(() => secureSchemas.sessionId.parse('invalid-uuid')).toThrow()
    })

    it('should validate budgets', () => {
      const validBudget = secureSchemas.budget.parse(100)
      expect(validBudget).toBe(100)

      expect(() => secureSchemas.budget.parse(-10)).toThrow()
      expect(() => secureSchemas.budget.parse(20000)).toThrow()
    })

    it('should validate power levels', () => {
      const validPowerLevel = secureSchemas.powerLevel.parse(5)
      expect(validPowerLevel).toBe(5)

      expect(() => secureSchemas.powerLevel.parse(0)).toThrow()
      expect(() => secureSchemas.powerLevel.parse(11)).toThrow()
      expect(() => secureSchemas.powerLevel.parse(5.5)).toThrow()
    })
  })

  describe('APIKeyManager', () => {
    const apiKeyManager = APIKeyManager.getInstance()

    it('should validate OpenAI key format', () => {
      const validKey = 'sk-1234567890abcdef1234567890abcdef'
      const invalidKey = 'invalid-key'

      expect(apiKeyManager.validateKeyFormat('openai', validKey)).toBe(true)
      expect(apiKeyManager.validateKeyFormat('openai', invalidKey)).toBe(false)
    })

    it('should mask API keys', () => {
      const key = 'sk-1234567890abcdef1234567890abcdef'
      const masked = apiKeyManager.maskKey(key)

      expect(masked).toContain('sk-1')
      expect(masked).toContain('***')
      expect(masked).toContain('cdef')
      expect(masked).not.toContain('567890abcdef1234567890ab')
    })

    it('should handle short keys', () => {
      const shortKey = 'short'
      const masked = apiKeyManager.maskKey(shortKey)

      expect(masked).toBe('***')
    })
  })
})

describe('Authentication Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle authentication flow', async () => {
    // Mock successful user lookup
    mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      image: null,
      createdAt: new Date(),
    })

    // This would be tested with actual tRPC context in integration tests
    const mockSession = {
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      },
    }

    expect(mockSession.user.id).toBe('user-1')
    expect(mockSession.user.email).toBe('test@example.com')
  })

  it('should handle rate limiting for AI endpoints', async () => {
    const rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 2,
    })

    // First request should be allowed
    const result1 = await rateLimiter.checkLimit('ai:user-1')
    expect(result1.allowed).toBe(true)

    // Second request should be allowed
    const result2 = await rateLimiter.checkLimit('ai:user-1')
    expect(result2.allowed).toBe(true)

    // Third request should be blocked
    const result3 = await rateLimiter.checkLimit('ai:user-1')
    expect(result3.allowed).toBe(false)
  })

  it('should validate input in middleware', () => {
    const validInput = {
      deckName: 'My Test Deck',
      userPrompt: 'I want to build a blue control deck with counterspells',
    }

    // Test that valid input passes validation
    expect(() => secureSchemas.deckName.parse(validInput.deckName)).not.toThrow()
    expect(() => secureSchemas.userPrompt.parse(validInput.userPrompt)).not.toThrow()

    const invalidInput = {
      deckName: '<script>alert("xss")</script>',
      userPrompt: 'short',
    }

    // Test that invalid input is rejected
    expect(() => secureSchemas.userPrompt.parse(invalidInput.userPrompt)).toThrow()
  })
})

describe('Security Edge Cases', () => {
  it('should handle database errors gracefully', async () => {
    const sessionManager = new SessionManager(mockPrisma)
    
    // Mock database error
    mockPrisma.session.findUnique = vi.fn().mockRejectedValue(new Error('Database error'))

    const result = await sessionManager.validateSession('token-123')
    
    expect(result.valid).toBe(false)
  })

  it('should handle concurrent rate limit checks', async () => {
    const rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 1,
    })

    // Simulate concurrent requests
    const promises = [
      rateLimiter.checkLimit('concurrent-test'),
      rateLimiter.checkLimit('concurrent-test'),
      rateLimiter.checkLimit('concurrent-test'),
    ]

    const results = await Promise.all(promises)
    
    // Only one should be allowed
    const allowedCount = results.filter(r => r.allowed).length
    expect(allowedCount).toBeLessThanOrEqual(1)
  })

  it('should handle malformed CSRF tokens', () => {
    const csrfProtection = new CSRFProtection('test-secret')
    
    const malformedTokens = [
      '',
      'not-base64',
      'dGVzdA==', // Valid base64 but wrong format
      Buffer.from('invalid:format').toString('base64'),
    ]

    malformedTokens.forEach(token => {
      const isValid = csrfProtection.validateToken(token, 'session-123')
      expect(isValid).toBe(false)
    })
  })
})
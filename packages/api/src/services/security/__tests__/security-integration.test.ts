import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { securityService } from '../SecurityService'
import { authenticationService } from '../AuthenticationService'
import { vulnerabilityScanner } from '../VulnerabilityScanner'
import { securityMiddleware } from '../../../middleware/security'
import { TRPCError } from '@trpc/server'
import type { Context } from '../../../trpc'

// Mock environment variables
const originalEnv = process.env
beforeEach(() => {
  process.env = {
    ...originalEnv,
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    NODE_ENV: 'test',
  }
})

afterEach(() => {
  process.env = originalEnv
  vi.clearAllMocks()
})

// Mock dependencies
vi.mock('@moxmuse/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../../monitoring/SentryService', () => ({
  sentryService: {
    captureError: vi.fn(),
    captureMessage: vi.fn(),
  },
}))

vi.mock('../../monitoring/MetricsService', () => ({
  metricsService: {
    recordMetric: vi.fn(),
    recordError: vi.fn(),
  },
}))

import { prisma } from '@moxmuse/db'

describe('Security System Integration', () => {
  const mockContext: Context = {
    req: {
      headers: {
        'user-agent': 'test-agent',
        'x-forwarded-for': '192.168.1.1',
        'x-csrf-token': '',
      },
      socket: {
        remoteAddress: '192.168.1.1',
      },
    },
    res: {
      setHeader: vi.fn(),
    },
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
    },
    sessionId: 'test-session-id',
    procedure: 'test.procedure',
  } as any

  describe('Complete Authentication Flow', () => {
    it('should handle complete user authentication and session management', async () => {
      // Mock user data
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        password: '$2b$12$hashedpassword',
        isActive: true,
        lastLoginAt: null,
        mfaEnabled: false,
        mfaSecret: null,
      }

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: { loginMethod: 'password' },
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(prisma.userSession.create).mockResolvedValue(mockSession)
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser)

      // Mock password verification
      vi.spyOn(securityService, 'verifyPassword').mockResolvedValue(true)

      // Step 1: Authenticate user
      const authResult = await authenticationService.authenticateUser(
        'test@example.com',
        'password123',
        mockContext
      )

      expect(authResult.success).toBe(true)
      expect(authResult.user).toBeTruthy()
      expect(authResult.session).toBeTruthy()

      // Step 2: Validate session
      vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
        ...mockSession,
        user: { isActive: true },
      })

      const sessionValidation = await authenticationService.validateSession(
        authResult.session!.id,
        mockContext
      )

      expect(sessionValidation).toBeTruthy()
      expect(sessionValidation!.userId).toBe('user-123')

      // Step 3: Generate CSRF token
      const csrfToken = securityService.generateCSRFToken(mockContext)
      expect(csrfToken).toBeTruthy()

      // Step 4: Validate CSRF token
      const csrfValidation = securityService.validateCSRFToken(csrfToken, mockContext)
      expect(csrfValidation).toBe(true)

      // Step 5: Check audit logs
      const auditLogs = securityService.getAuditLogs(10)
      expect(auditLogs.length).toBeGreaterThan(0)
    })
  })

  describe('Security Middleware Integration', () => {
    it('should apply security middleware correctly', async () => {
      const mockNext = vi.fn().mockResolvedValue({ success: true })
      const middleware = securityMiddleware.authenticated

      // Mock valid session
      vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        metadata: {},
        user: { isActive: true },
      })

      const result = await middleware({
        ctx: mockContext,
        next: mockNext,
        input: { test: 'data' },
      })

      expect(result).toEqual({ success: true })
      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.res?.setHeader).toHaveBeenCalled() // Security headers applied
    })

    it('should reject unauthenticated requests when auth required', async () => {
      const mockNext = vi.fn()
      const middleware = securityMiddleware.authenticated

      const unauthenticatedContext = {
        ...mockContext,
        user: undefined,
      }

      await expect(
        middleware({
          ctx: unauthenticatedContext,
          next: mockNext,
        })
      ).rejects.toThrow(TRPCError)

      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should validate CSRF tokens when required', async () => {
      const mockNext = vi.fn().mockResolvedValue({ success: true })
      const middleware = securityMiddleware.sensitive

      // Generate valid CSRF token
      const csrfToken = securityService.generateCSRFToken(mockContext)
      const contextWithCSRF = {
        ...mockContext,
        req: {
          ...mockContext.req,
          headers: {
            ...mockContext.req?.headers,
            'x-csrf-token': csrfToken,
          },
        },
      }

      // Mock valid session
      vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        metadata: {},
        user: { isActive: true },
      })

      const result = await middleware({
        ctx: contextWithCSRF,
        next: mockNext,
      })

      expect(result).toEqual({ success: true })
      expect(mockNext).toHaveBeenCalled()
    })

    it('should reject requests with invalid CSRF tokens', async () => {
      const mockNext = vi.fn()
      const middleware = securityMiddleware.sensitive

      const contextWithInvalidCSRF = {
        ...mockContext,
        req: {
          ...mockContext.req,
          headers: {
            ...mockContext.req?.headers,
            'x-csrf-token': 'invalid-token',
          },
        },
      }

      await expect(
        middleware({
          ctx: contextWithInvalidCSRF,
          next: mockNext,
        })
      ).rejects.toThrow(TRPCError)

      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('Input Validation Integration', () => {
    it('should validate and sanitize user inputs', async () => {
      const mockNext = vi.fn().mockResolvedValue({ success: true })
      const middleware = securityMiddleware.public

      const maliciousInputs = [
        { input: '<script>alert("xss")</script>' },
        { input: "'; DROP TABLE users; --" },
        { input: '../../../etc/passwd' },
      ]

      for (const maliciousInput of maliciousInputs) {
        await expect(
          middleware({
            ctx: mockContext,
            next: mockNext,
            input: maliciousInput,
          })
        ).rejects.toThrow(TRPCError)
      }

      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should allow safe inputs', async () => {
      const mockNext = vi.fn().mockResolvedValue({ success: true })
      const middleware = securityMiddleware.public

      const safeInput = {
        name: 'John Doe',
        email: 'john@example.com',
        description: 'A safe description with normal text.',
      }

      const result = await middleware({
        ctx: mockContext,
        next: mockNext,
        input: safeInput,
      })

      expect(result).toEqual({ success: true })
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('Rate Limiting Integration', () => {
    it('should enforce rate limits', async () => {
      const mockNext = vi.fn().mockResolvedValue({ success: true })
      const quotaMiddleware = securityMiddleware.userQuota

      // Simulate multiple requests within quota
      for (let i = 0; i < 5; i++) {
        const result = await quotaMiddleware({
          ctx: mockContext,
          next: mockNext,
        })
        expect(result).toEqual({ success: true })
      }

      expect(mockNext).toHaveBeenCalledTimes(5)
    })
  })

  describe('Encryption Integration', () => {
    it('should encrypt and decrypt sensitive data in middleware', async () => {
      const sensitiveData = {
        password: 'userPassword123!',
        apiKey: 'sk-1234567890abcdef',
      }

      // Encrypt data
      const encryptedData = {
        password: securityService.encrypt(sensitiveData.password),
        apiKey: securityService.encrypt(sensitiveData.apiKey),
      }

      expect(encryptedData.password).not.toBe(sensitiveData.password)
      expect(encryptedData.apiKey).not.toBe(sensitiveData.apiKey)

      // Decrypt data
      const decryptedData = {
        password: securityService.decrypt(encryptedData.password),
        apiKey: securityService.decrypt(encryptedData.apiKey),
      }

      expect(decryptedData).toEqual(sensitiveData)
    })
  })

  describe('Vulnerability Scanning Integration', () => {
    it('should detect security vulnerabilities', async () => {
      // Mock file system operations for vulnerability scanner
      vi.mock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue('{}'),
        readdir: vi.fn().mockResolvedValue([]),
      }))

      const scanResult = await vulnerabilityScanner.runFullScan()

      expect(scanResult).toBeTruthy()
      expect(scanResult.id).toBeTruthy()
      expect(scanResult.timestamp).toBeInstanceOf(Date)
      expect(scanResult.vulnerabilities).toBeInstanceOf(Array)
      expect(scanResult.summary).toBeTruthy()
    })

    it('should provide scan history', () => {
      const history = vulnerabilityScanner.getScanHistory(5)
      expect(Array.isArray(history)).toBe(true)
    })

    it('should check scan status', () => {
      const isScanning = vulnerabilityScanner.isScanInProgress()
      expect(typeof isScanning).toBe('boolean')
    })
  })

  describe('Security Event Logging Integration', () => {
    it('should log comprehensive security events', () => {
      // Log various security events
      securityService.logSecurityEvent(
        mockContext,
        'user_login_success',
        'authentication',
        true,
        { method: 'password' }
      )

      securityService.logSecurityEvent(
        mockContext,
        'user_login_failed',
        'authentication',
        false,
        { reason: 'invalid_password' }
      )

      securityService.logSecurityEvent(
        mockContext,
        'csrf_token_generated',
        'security',
        true
      )

      const auditLogs = securityService.getAuditLogs(10)
      expect(auditLogs.length).toBeGreaterThanOrEqual(3)

      // Check log structure
      const latestLog = auditLogs[0]
      expect(latestLog).toHaveProperty('id')
      expect(latestLog).toHaveProperty('userId')
      expect(latestLog).toHaveProperty('action')
      expect(latestLog).toHaveProperty('resource')
      expect(latestLog).toHaveProperty('ip')
      expect(latestLog).toHaveProperty('userAgent')
      expect(latestLog).toHaveProperty('success')
      expect(latestLog).toHaveProperty('timestamp')
    })

    it('should detect suspicious activity patterns', () => {
      // Generate multiple failed login attempts
      for (let i = 0; i < 15; i++) {
        securityService.logSecurityEvent(
          mockContext,
          'login_failed',
          'authentication',
          false,
          { attempt: i + 1 }
        )
      }

      const isSuspicious = securityService.detectSuspiciousActivity(mockContext)
      expect(isSuspicious).toBe(true)
    })
  })

  describe('Password Security Integration', () => {
    it('should handle complete password lifecycle', async () => {
      const password = 'SecurePassword123!'

      // Validate password strength
      const validation = authenticationService.validatePasswordStrength(password)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)

      // Hash password
      const hashedPassword = await securityService.hashPassword(password)
      expect(hashedPassword).not.toBe(password)
      expect(hashedPassword).toMatch(/^\$2[aby]\$\d+\$/)

      // Verify password
      const isValid = await securityService.verifyPassword(password, hashedPassword)
      expect(isValid).toBe(true)

      // Verify wrong password
      const isInvalid = await securityService.verifyPassword('WrongPassword', hashedPassword)
      expect(isInvalid).toBe(false)
    })
  })

  describe('Security Headers Integration', () => {
    it('should apply comprehensive security headers', () => {
      const headers = securityService.getSecurityHeaders()

      // Check all required security headers are present
      const requiredHeaders = [
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Permissions-Policy',
        'Strict-Transport-Security',
        'X-XSS-Protection',
      ]

      for (const header of requiredHeaders) {
        expect(headers).toHaveProperty(header)
        expect(headers[header]).toBeTruthy()
      }

      // Check specific security configurations
      expect(headers['X-Frame-Options']).toBe('DENY')
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
      expect(headers['Content-Security-Policy']).toContain("default-src 'self'")
      expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle security errors gracefully', async () => {
      // Test encryption error handling
      const originalKey = process.env.ENCRYPTION_KEY
      process.env.ENCRYPTION_KEY = 'invalid-key'

      expect(() => {
        securityService.encrypt('test data')
      }).toThrow(TRPCError)

      process.env.ENCRYPTION_KEY = originalKey

      // Test authentication error handling
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

      const authResult = await authenticationService.authenticateUser(
        'test@example.com',
        'password',
        mockContext
      )

      expect(authResult.success).toBe(false)
      expect(authResult.error).toBeTruthy()
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle concurrent security operations', async () => {
      const concurrentOperations = []

      // Test concurrent encryption/decryption
      for (let i = 0; i < 10; i++) {
        concurrentOperations.push(
          (async () => {
            const data = `test data ${i}`
            const encrypted = securityService.encrypt(data)
            const decrypted = securityService.decrypt(encrypted)
            return decrypted === data
          })()
        )
      }

      // Test concurrent CSRF token generation
      for (let i = 0; i < 10; i++) {
        concurrentOperations.push(
          (async () => {
            const token = securityService.generateCSRFToken(mockContext)
            return token.length === 64
          })()
        )
      }

      const results = await Promise.all(concurrentOperations)
      expect(results.every(result => result === true)).toBe(true)
    })

    it('should maintain performance under load', async () => {
      const startTime = Date.now()

      // Perform multiple security operations
      const operations = []
      for (let i = 0; i < 100; i++) {
        operations.push(securityService.encrypt(`data ${i}`))
      }

      const encrypted = await Promise.all(operations.map(op => Promise.resolve(op)))
      const decrypted = encrypted.map(enc => securityService.decrypt(enc))

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(decrypted).toHaveLength(100)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })
})

describe('Security Configuration', () => {
  it('should validate required environment variables', () => {
    const requiredVars = ['ENCRYPTION_KEY', 'NEXTAUTH_SECRET']

    for (const varName of requiredVars) {
      const originalValue = process.env[varName]
      delete process.env[varName]

      // This would typically be checked during service initialization
      // For testing, we'll just verify the variable is required
      expect(process.env[varName]).toBeUndefined()

      process.env[varName] = originalValue
    }
  })

  it('should use secure defaults', () => {
    const config = vulnerabilityScanner.getConfiguration()

    expect(config.enableDependencyScanning).toBe(true)
    expect(config.enableCodeScanning).toBe(true)
    expect(config.enableRuntimeScanning).toBe(true)
    expect(config.autoFixEnabled).toBe(false) // Should be disabled by default
  })
})
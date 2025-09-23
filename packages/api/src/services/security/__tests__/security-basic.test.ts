import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TRPCError } from '@trpc/server'

// Mock dependencies
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

// Set environment variables for testing
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('Security System Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('SecurityService', () => {
    it('should create security service with valid encryption key', async () => {
      const { SecurityService } = await import('../SecurityService')
      expect(() => new SecurityService()).not.toThrow()
    })

    it('should encrypt and decrypt data correctly', async () => {
      const { SecurityService } = await import('../SecurityService')
      const securityService = new SecurityService()
      
      const plaintext = 'sensitive data'
      const encrypted = securityService.encrypt(plaintext)
      const decrypted = securityService.decrypt(encrypted)

      expect(encrypted).not.toBe(plaintext)
      expect(encrypted).toContain(':')
      expect(decrypted).toBe(plaintext)
    })

    it('should validate input for XSS attempts', async () => {
      const { SecurityService } = await import('../SecurityService')
      const securityService = new SecurityService()

      const xssInputs = [
        '<script>alert("xss")</script>',
        '<iframe src="javascript:alert(1)"></iframe>',
        'javascript:alert(1)',
      ]

      for (const input of xssInputs) {
        const isValid = securityService.validateInput(input, 'xss')
        expect(isValid).toBe(false)
      }
    })

    it('should allow safe inputs', async () => {
      const { SecurityService } = await import('../SecurityService')
      const securityService = new SecurityService()

      const safeInputs = [
        'normal text',
        'user@example.com',
        'Card Name',
        'Some description with numbers 123',
      ]

      for (const input of safeInputs) {
        const isValid = securityService.validateInput(input, 'xss')
        expect(isValid).toBe(true)
      }
    })

    it('should generate and validate CSRF tokens', async () => {
      const { SecurityService } = await import('../SecurityService')
      const securityService = new SecurityService()

      const mockContext = {
        req: {
          headers: {
            'user-agent': 'test-agent',
            'x-forwarded-for': '192.168.1.1',
          },
          socket: { remoteAddress: '192.168.1.1' },
        },
        res: { setHeader: vi.fn() },
        user: { id: 'test-user-id', email: 'test@example.com' },
        sessionId: 'test-session-id',
      } as any

      const token = securityService.generateCSRFToken(mockContext)
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.length).toBe(64) // 32 bytes as hex

      const isValid = securityService.validateCSRFToken(token, mockContext)
      expect(isValid).toBe(true)

      // Token should be one-time use
      const isValidSecondTime = securityService.validateCSRFToken(token, mockContext)
      expect(isValidSecondTime).toBe(false)
    })

    it('should provide security headers', async () => {
      const { SecurityService } = await import('../SecurityService')
      const securityService = new SecurityService()

      const headers = securityService.getSecurityHeaders()

      expect(headers).toHaveProperty('Content-Security-Policy')
      expect(headers).toHaveProperty('X-Frame-Options', 'DENY')
      expect(headers).toHaveProperty('X-Content-Type-Options', 'nosniff')
      expect(headers).toHaveProperty('Strict-Transport-Security')

      // Check CSP contains important directives
      expect(headers['Content-Security-Policy']).toContain("default-src 'self'")
      expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    })
  })

  describe('AuthenticationService', () => {
    it('should validate password strength correctly', async () => {
      const { AuthenticationService } = await import('../AuthenticationService')
      const authService = new AuthenticationService()

      const strongPassword = 'StrongPassword123!'
      const weakPassword = 'weak'

      const strongValidation = authService.validatePasswordStrength(strongPassword)
      expect(strongValidation.isValid).toBe(true)
      expect(strongValidation.errors).toHaveLength(0)

      const weakValidation = authService.validatePasswordStrength(weakPassword)
      expect(weakValidation.isValid).toBe(false)
      expect(weakValidation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('VulnerabilityScanner', () => {
    it('should create vulnerability scanner', async () => {
      const { VulnerabilityScanner } = await import('../VulnerabilityScanner')
      expect(() => new VulnerabilityScanner()).not.toThrow()
    })

    it('should provide configuration', async () => {
      const { VulnerabilityScanner } = await import('../VulnerabilityScanner')
      const scanner = new VulnerabilityScanner()

      const config = scanner.getConfiguration()
      expect(config).toHaveProperty('enableDependencyScanning')
      expect(config).toHaveProperty('enableCodeScanning')
      expect(config).toHaveProperty('enableRuntimeScanning')
      expect(config).toHaveProperty('scanInterval')
      expect(config).toHaveProperty('alertThreshold')
    })
  })

  describe('Security Integration', () => {
    it('should handle complete encryption/decryption flow', async () => {
      const { SecurityService } = await import('../SecurityService')
      const securityService = new SecurityService()

      const sensitiveData = {
        password: 'userPassword123!',
        apiKey: 'sk-1234567890abcdef',
        personalInfo: 'John Doe, 123 Main St',
      }

      // Encrypt sensitive fields
      const encrypted = {
        password: securityService.encrypt(sensitiveData.password),
        apiKey: securityService.encrypt(sensitiveData.apiKey),
        personalInfo: securityService.encrypt(sensitiveData.personalInfo),
      }

      // Verify encryption worked
      expect(encrypted.password).not.toBe(sensitiveData.password)
      expect(encrypted.apiKey).not.toBe(sensitiveData.apiKey)
      expect(encrypted.personalInfo).not.toBe(sensitiveData.personalInfo)

      // Decrypt and verify
      const decrypted = {
        password: securityService.decrypt(encrypted.password),
        apiKey: securityService.decrypt(encrypted.apiKey),
        personalInfo: securityService.decrypt(encrypted.personalInfo),
      }

      expect(decrypted).toEqual(sensitiveData)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid encryption key', async () => {
      const originalKey = process.env.ENCRYPTION_KEY
      process.env.ENCRYPTION_KEY = 'invalid-key'

      const { SecurityService } = await import('../SecurityService')
      expect(() => new SecurityService()).toThrow('ENCRYPTION_KEY must be 32 bytes')

      process.env.ENCRYPTION_KEY = originalKey
    })

    it('should handle missing encryption key', async () => {
      const originalKey = process.env.ENCRYPTION_KEY
      delete process.env.ENCRYPTION_KEY

      const { SecurityService } = await import('../SecurityService')
      expect(() => new SecurityService()).toThrow('ENCRYPTION_KEY environment variable is required')

      process.env.ENCRYPTION_KEY = originalKey
    })
  })
})
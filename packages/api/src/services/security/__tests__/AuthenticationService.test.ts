import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { authenticationService } from '../AuthenticationService'
import { TRPCError } from '@trpc/server'
import type { Context } from '../../../trpc'

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

vi.mock('../SecurityService', () => ({
  securityService: {
    verifyPassword: vi.fn(),
    logSecurityEvent: vi.fn(),
    detectSuspiciousActivity: vi.fn(),
    hashPassword: vi.fn(),
  },
}))

vi.mock('../../monitoring/SentryService', () => ({
  sentryService: {
    captureError: vi.fn(),
  },
}))

vi.mock('../../monitoring/MetricsService', () => ({
  metricsService: {
    recordMetric: vi.fn(),
    recordError: vi.fn(),
  },
}))

import { prisma } from '@moxmuse/db'
import { securityService } from '../SecurityService'

describe('AuthenticationService', () => {
  const mockContext: Context = {
    req: {
      headers: {
        'user-agent': 'test-agent',
        'x-forwarded-for': '192.168.1.1',
      },
      socket: {
        remoteAddress: '192.168.1.1',
      },
    },
    res: {
      setHeader: vi.fn(),
    },
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authenticateUser', () => {
    it('should authenticate valid user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        password: 'hashed-password',
        isActive: true,
        lastLoginAt: null,
        mfaEnabled: false,
        mfaSecret: null,
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(securityService.verifyPassword).mockResolvedValue(true)
      vi.mocked(securityService.detectSuspiciousActivity).mockReturnValue(false)
      vi.mocked(prisma.userSession.create).mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {},
      })

      const result = await authenticationService.authenticateUser(
        'test@example.com',
        'password123',
        mockContext
      )

      expect(result.success).toBe(true)
      expect(result.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
      })
      expect(result.session).toBeTruthy()
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lastLoginAt: expect.any(Date) },
      })
    })

    it('should reject authentication with missing credentials', async () => {
      const result = await authenticationService.authenticateUser(
        '',
        'password',
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Email and password are required')
    })

    it('should reject authentication for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await authenticationService.authenticateUser(
        'nonexistent@example.com',
        'password',
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email or password')
    })

    it('should reject authentication for inactive user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        password: 'hashed-password',
        isActive: false,
        lastLoginAt: null,
        mfaEnabled: false,
        mfaSecret: null,
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

      const result = await authenticationService.authenticateUser(
        'test@example.com',
        'password',
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Account is disabled. Please contact support')
    })

    it('should reject authentication with invalid password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        password: 'hashed-password',
        isActive: true,
        lastLoginAt: null,
        mfaEnabled: false,
        mfaSecret: null,
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(securityService.verifyPassword).mockResolvedValue(false)

      const result = await authenticationService.authenticateUser(
        'test@example.com',
        'wrongpassword',
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email or password')
    })

    it('should handle MFA requirement', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        password: 'hashed-password',
        isActive: true,
        lastLoginAt: null,
        mfaEnabled: true,
        mfaSecret: 'mfa-secret',
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(securityService.verifyPassword).mockResolvedValue(true)
      vi.mocked(securityService.detectSuspiciousActivity).mockReturnValue(false)

      const result = await authenticationService.authenticateUser(
        'test@example.com',
        'password123',
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.requiresMFA).toBe(true)
      expect(result.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
      })
    })

    it('should reject authentication when suspicious activity detected', async () => {
      vi.mocked(securityService.detectSuspiciousActivity).mockReturnValue(true)

      const result = await authenticationService.authenticateUser(
        'test@example.com',
        'password123',
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Suspicious activity detected. Please try again later')
    })
  })

  describe('validateSession', () => {
    it('should validate active session successfully', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        metadata: {},
        user: { isActive: true },
      }

      vi.mocked(prisma.userSession.findUnique).mockResolvedValue(mockSession)

      const result = await authenticationService.validateSession('session-123', mockContext)

      expect(result).toBeTruthy()
      expect(result?.id).toBe('session-123')
      expect(result?.userId).toBe('user-123')
    })

    it('should reject expired session', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        metadata: {},
        user: { isActive: true },
      }

      vi.mocked(prisma.userSession.findUnique).mockResolvedValue(mockSession)
      vi.mocked(prisma.userSession.delete).mockResolvedValue(mockSession)

      const result = await authenticationService.validateSession('session-123', mockContext)

      expect(result).toBeNull()
      expect(prisma.userSession.delete).toHaveBeenCalledWith({
        where: { id: 'session-123' },
      })
    })

    it('should reject session for inactive user', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        metadata: {},
        user: { isActive: false },
      }

      vi.mocked(prisma.userSession.findUnique).mockResolvedValue(mockSession)

      const result = await authenticationService.validateSession('session-123', mockContext)

      expect(result).toBeNull()
    })

    it('should handle IP address changes', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        ip: '192.168.1.2', // Different IP
        userAgent: 'test-agent',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        metadata: {},
        user: { isActive: true },
      }

      vi.mocked(prisma.userSession.findUnique).mockResolvedValue(mockSession)

      // In development, should allow IP changes
      process.env.NODE_ENV = 'development'
      const result = await authenticationService.validateSession('session-123', mockContext)
      expect(result).toBeTruthy()

      // In production, should invalidate session on IP change
      process.env.NODE_ENV = 'production'
      vi.mocked(prisma.userSession.delete).mockResolvedValue(mockSession)
      const resultProd = await authenticationService.validateSession('session-123', mockContext)
      expect(resultProd).toBeNull()
    })
  })

  describe('validatePasswordStrength', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'StrongPassword123!',
        'MySecure@Pass2024',
        'Complex#Password99',
      ]

      for (const password of strongPasswords) {
        const result = authenticationService.validatePasswordStrength(password)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      }
    })

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'short', // Too short
        'nouppercase123!', // No uppercase
        'NOLOWERCASE123!', // No lowercase
        'NoNumbers!', // No numbers
        'NoSpecialChars123', // No special characters
        'password', // Common password
      ]

      for (const password of weakPasswords) {
        const result = authenticationService.validatePasswordStrength(password)
        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })

    it('should provide specific error messages', () => {
      const result = authenticationService.validatePasswordStrength('weak')

      expect(result.errors).toContain('Password must be at least 8 characters long')
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
      expect(result.errors).toContain('Password must contain at least one number')
      expect(result.errors).toContain('Password must contain at least one special character')
    })
  })

  describe('Session Management', () => {
    it('should create session successfully', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(),
        metadata: { loginMethod: 'password' },
      }

      vi.mocked(prisma.userSession.create).mockResolvedValue(mockSession)

      const result = await authenticationService.createSession('user-123', mockContext)

      expect(result.userId).toBe('user-123')
      expect(result.ip).toBe('192.168.1.1')
      expect(result.userAgent).toBe('test-agent')
      expect(prisma.userSession.create).toHaveBeenCalled()
    })

    it('should invalidate session successfully', async () => {
      vi.mocked(prisma.userSession.delete).mockResolvedValue({} as any)

      await authenticationService.invalidateSession('session-123')

      expect(prisma.userSession.delete).toHaveBeenCalledWith({
        where: { id: 'session-123' },
      })
    })

    it('should invalidate all user sessions', async () => {
      vi.mocked(prisma.userSession.deleteMany).mockResolvedValue({ count: 3 })

      await authenticationService.invalidateAllUserSessions('user-123')

      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      })
    })

    it('should get user sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userId: 'user-123',
          ip: '192.168.1.1',
          userAgent: 'browser-1',
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          metadata: {},
        },
        {
          id: 'session-2',
          userId: 'user-123',
          ip: '192.168.1.2',
          userAgent: 'browser-2',
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          metadata: {},
        },
      ]

      vi.mocked(prisma.userSession.findMany).mockResolvedValue(mockSessions)

      const result = await authenticationService.getUserSessions('user-123')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('session-1')
      expect(result[1].id).toBe('session-2')
    })
  })

  describe('Account Locking', () => {
    it('should lock account after multiple failed attempts', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        password: 'hashed-password',
        isActive: true,
        lastLoginAt: null,
        mfaEnabled: false,
        mfaSecret: null,
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(securityService.verifyPassword).mockResolvedValue(false)

      // Simulate multiple failed attempts
      for (let i = 0; i < 6; i++) {
        await authenticationService.authenticateUser(
          'test@example.com',
          'wrongpassword',
          mockContext
        )
      }

      // Next attempt should be blocked due to account lock
      const result = await authenticationService.authenticateUser(
        'test@example.com',
        'wrongpassword',
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Account temporarily locked due to too many failed attempts')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

      const result = await authenticationService.authenticateUser(
        'test@example.com',
        'password',
        mockContext
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email or password')
    })

    it('should handle session creation errors', async () => {
      vi.mocked(prisma.userSession.create).mockRejectedValue(new Error('Session creation failed'))

      await expect(
        authenticationService.createSession('user-123', mockContext)
      ).rejects.toThrow()
    })
  })
})
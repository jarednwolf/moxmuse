import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { nanoid } from 'nanoid'
import { createHash, randomBytes } from 'crypto'
import { sign, verify } from 'jsonwebtoken'
import { prisma } from '@moxmuse/db'

// API Key schemas
const APIKeySchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  keyHash: z.string(),
  permissions: z.array(z.string()),
  rateLimit: z.number(),
  expiresAt: z.date().optional(),
  lastUsedAt: z.date().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

type APIKey = z.infer<typeof APIKeySchema>

const CreateAPIKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1),
  rateLimit: z.number().min(1).max(10000).default(1000),
  expiresAt: z.date().optional(),
})

type CreateAPIKeyRequest = z.infer<typeof CreateAPIKeySchema>

// OAuth schemas
const OAuthAppSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  clientId: z.string(),
  clientSecret: z.string(),
  redirectUris: z.array(z.string()),
  scopes: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

type OAuthApp = z.infer<typeof OAuthAppSchema>

const CreateOAuthAppSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  redirectUris: z.array(z.string().url()).min(1),
  scopes: z.array(z.string()).min(1),
})

type CreateOAuthAppRequest = z.infer<typeof CreateOAuthAppSchema>

// JWT payload for API tokens
interface APITokenPayload {
  sub: string // user ID
  iat: number
  exp?: number
  permissions: string[]
  keyId: string
}

// Rate limiting
interface RateLimitInfo {
  remaining: number
  resetTime: number
  limit: number
}

export class APIAuthenticationService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'
  private readonly API_KEY_PREFIX = 'moxmuse_'

  /**
   * Create a new API key for a user
   */
  async createAPIKey(
    userId: string,
    request: CreateAPIKeyRequest
  ): Promise<{ apiKey: APIKey; plainKey: string }> {
    try {
      const validatedRequest = CreateAPIKeySchema.parse(request)
      
      // Generate API key
      const plainKey = this.generateAPIKey()
      const keyHash = this.hashAPIKey(plainKey)
      
      // Create API key record
      const apiKey = await prisma.apiKey.create({
        data: {
          id: nanoid(),
          userId,
          name: validatedRequest.name,
          keyHash,
          permissions: validatedRequest.permissions,
          rateLimit: validatedRequest.rateLimit,
          expiresAt: validatedRequest.expiresAt,
          isActive: true,
        },
      })

      return {
        apiKey: APIKeySchema.parse(apiKey),
        plainKey,
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create API key',
        cause: error,
      })
    }
  }

  /**
   * Validate API key and return user info
   */
  async validateAPIKey(apiKey: string): Promise<{
    userId: string
    permissions: string[]
    rateLimit: number
    keyId: string
  }> {
    try {
      if (!apiKey.startsWith(this.API_KEY_PREFIX)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid API key format',
        })
      }

      const keyHash = this.hashAPIKey(apiKey)
      
      const keyRecord = await prisma.apiKey.findFirst({
        where: {
          keyHash,
          isActive: true,
        },
      })

      if (!keyRecord) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid API key',
        })
      }

      // Check expiration
      if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'API key has expired',
        })
      }

      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      })

      return {
        userId: keyRecord.userId,
        permissions: keyRecord.permissions,
        rateLimit: keyRecord.rateLimit,
        keyId: keyRecord.id,
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to validate API key',
        cause: error,
      })
    }
  }

  /**
   * Create OAuth application
   */
  async createOAuthApp(
    userId: string,
    request: CreateOAuthAppRequest
  ): Promise<OAuthApp> {
    try {
      const validatedRequest = CreateOAuthAppSchema.parse(request)
      
      const clientId = this.generateClientId()
      const clientSecret = this.generateClientSecret()
      
      const oauthApp = await prisma.oauthApp.create({
        data: {
          id: nanoid(),
          userId,
          name: validatedRequest.name,
          description: validatedRequest.description,
          clientId,
          clientSecret,
          redirectUris: validatedRequest.redirectUris,
          scopes: validatedRequest.scopes,
          isActive: true,
        },
      })

      return OAuthAppSchema.parse(oauthApp)
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create OAuth application',
        cause: error,
      })
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthorizationURL(
    clientId: string,
    redirectUri: string,
    scopes: string[],
    state?: string
  ): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moxmuse.com'
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      response_type: 'code',
      state: state || nanoid(),
    })

    return `${baseUrl}/oauth/authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string
  ): Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
    tokenType: string
    scope: string[]
  }> {
    try {
      // Validate OAuth app
      const oauthApp = await prisma.oauthApp.findFirst({
        where: {
          clientId,
          clientSecret,
          isActive: true,
        },
      })

      if (!oauthApp) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid client credentials',
        })
      }

      // Validate authorization code
      const authCode = await prisma.oauthAuthorizationCode.findFirst({
        where: {
          code,
          clientId,
          redirectUri,
          expiresAt: { gt: new Date() },
          used: false,
        },
      })

      if (!authCode) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired authorization code',
        })
      }

      // Mark code as used
      await prisma.oauthAuthorizationCode.update({
        where: { id: authCode.id },
        data: { used: true },
      })

      // Generate tokens
      const accessToken = this.generateAccessToken(
        authCode.userId,
        authCode.scopes,
        oauthApp.id
      )
      const refreshToken = this.generateRefreshToken()

      // Store refresh token
      await prisma.oauthRefreshToken.create({
        data: {
          id: nanoid(),
          token: refreshToken,
          userId: authCode.userId,
          clientId,
          scopes: authCode.scopes,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      })

      return {
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour
        tokenType: 'Bearer',
        scope: authCode.scopes,
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to exchange code for token',
        cause: error,
      })
    }
  }

  /**
   * Validate OAuth access token
   */
  async validateAccessToken(token: string): Promise<{
    userId: string
    scopes: string[]
    clientId: string
  }> {
    try {
      const payload = verify(token, this.JWT_SECRET) as APITokenPayload
      
      return {
        userId: payload.sub,
        scopes: payload.permissions,
        clientId: payload.keyId, // Using keyId field for client ID
      }
    } catch (error) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid access token',
      })
    }
  }

  /**
   * Refresh OAuth access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string
    expiresIn: number
    tokenType: string
  }> {
    try {
      const tokenRecord = await prisma.oauthRefreshToken.findFirst({
        where: {
          token: refreshToken,
          expiresAt: { gt: new Date() },
        },
      })

      if (!tokenRecord) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired refresh token',
        })
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(
        tokenRecord.userId,
        tokenRecord.scopes,
        tokenRecord.clientId
      )

      return {
        accessToken,
        expiresIn: 3600,
        tokenType: 'Bearer',
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to refresh access token',
        cause: error,
      })
    }
  }

  /**
   * Check rate limit for API key
   */
  async checkRateLimit(keyId: string, limit: number): Promise<RateLimitInfo> {
    const now = Date.now()
    const windowStart = now - (60 * 1000) // 1 minute window
    
    // Get recent requests
    const recentRequests = await prisma.apiRequest.count({
      where: {
        keyId,
        createdAt: { gte: new Date(windowStart) },
      },
    })

    const remaining = Math.max(0, limit - recentRequests)
    const resetTime = windowStart + (60 * 1000)

    return {
      remaining,
      resetTime,
      limit,
    }
  }

  /**
   * Record API request for rate limiting
   */
  async recordAPIRequest(
    keyId: string,
    endpoint: string,
    method: string,
    statusCode: number
  ): Promise<void> {
    await prisma.apiRequest.create({
      data: {
        id: nanoid(),
        keyId,
        endpoint,
        method,
        statusCode,
      },
    })
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(keyId: string, userId: string): Promise<void> {
    const result = await prisma.apiKey.updateMany({
      where: {
        id: keyId,
        userId,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    })

    if (result.count === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'API key not found or access denied',
      })
    }
  }

  /**
   * Get user's API keys
   */
  async getUserAPIKeys(userId: string): Promise<Omit<APIKey, 'keyHash'>[]> {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return apiKeys.map(key => {
      const { keyHash, ...safeKey } = key
      return APIKeySchema.omit({ keyHash: true }).parse(safeKey)
    })
  }

  /**
   * Get user's OAuth applications
   */
  async getUserOAuthApps(userId: string): Promise<Omit<OAuthApp, 'clientSecret'>[]> {
    const oauthApps = await prisma.oauthApp.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return oauthApps.map(app => {
      const { clientSecret, ...safeApp } = app
      return OAuthAppSchema.omit({ clientSecret: true }).parse(safeApp)
    })
  }

  /**
   * Generate API key
   */
  private generateAPIKey(): string {
    const randomPart = randomBytes(32).toString('hex')
    return `${this.API_KEY_PREFIX}${randomPart}`
  }

  /**
   * Hash API key for storage
   */
  private hashAPIKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex')
  }

  /**
   * Generate OAuth client ID
   */
  private generateClientId(): string {
    return `moxmuse_${randomBytes(16).toString('hex')}`
  }

  /**
   * Generate OAuth client secret
   */
  private generateClientSecret(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Generate access token
   */
  private generateAccessToken(
    userId: string,
    scopes: string[],
    clientId: string
  ): string {
    const payload: APITokenPayload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      permissions: scopes,
      keyId: clientId,
    }

    return sign(payload, this.JWT_SECRET)
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Get available permissions
   */
  getAvailablePermissions(): string[] {
    return [
      'decks:read',
      'decks:write',
      'decks:delete',
      'collections:read',
      'collections:write',
      'collections:delete',
      'cards:read',
      'ai:generate',
      'export:all',
      'import:all',
      'webhooks:manage',
    ]
  }

  /**
   * Get available OAuth scopes
   */
  getAvailableScopes(): string[] {
    return [
      'read:decks',
      'write:decks',
      'read:collections',
      'write:collections',
      'read:profile',
      'generate:decks',
      'export:data',
      'import:data',
    ]
  }
}

export const apiAuthenticationService = new APIAuthenticationService()
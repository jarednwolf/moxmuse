import { initTRPC, TRPCError } from '@trpc/server'
import { type CreateNextContextOptions } from '@trpc/server/adapters/next'
import { type Session } from 'next-auth'
import { getServerSession } from 'next-auth/next'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { prisma } from '@moxmuse/db'
import { authOptions } from './auth'
import {
  rateLimiters,
  SecurityAuditLogger,
  SessionManager,
  secureSchemas
} from './utils/security'

interface CreateContextOptions {
  session: Session | null
}

export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    prisma,
  }
}

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts

  // Get the session from the server using NextAuth's getServerSession
  const session = await getServerSession(req, res, authOptions)

  return createInnerTRPCContext({
    session,
  })
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router

export const publicProcedure = t.procedure

// Enhanced authentication middleware with session validation
const enforceUserIsAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource'
    })
  }

  // Validate user exists and is active in database
  const dbUser = await ctx.prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true
    }
  })

  if (!dbUser) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User account not found. Please log in again.'
    })
  }

  return next({
    ctx: {
      // infers the `session` as non-nullable with validated user
      session: {
        ...ctx.session,
        user: {
          ...ctx.session.user,
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          image: dbUser.image
        }
      },
      user: dbUser,
    },
  })
})

// Role-based authorization middleware
const enforceUserRole = (allowedRoles: string[] = ['user']) => {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.session || !ctx.session.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    // For now, all users have 'user' role. In future, add role field to User model
    const userRole = 'user' // TODO: Implement role system in database
    
    if (!allowedRoles.includes(userRole)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      })
    }

    return next({ ctx })
  })
}

// Initialize security services
const securityAuditLogger = new SecurityAuditLogger(prisma)
const sessionManager = new SessionManager(prisma)

// Rate limiting middleware for AI endpoints
const rateLimitAI = t.middleware(async ({ ctx, next, path }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  const userId = ctx.session.user.id
  const rateLimitKey = `ai:${userId}`
  
  // Check rate limit using the security utility
  const rateLimitResult = await rateLimiters.ai.checkLimit(rateLimitKey)
  
  if (!rateLimitResult.allowed) {
    // Log rate limit exceeded
    await securityAuditLogger.logRateLimitExceeded(userId, `ai_${path}`)
    
    const resetTime = new Date(rateLimitResult.resetTime)
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `AI rate limit exceeded. You can make more requests after ${resetTime.toLocaleTimeString()}. Remaining: ${rateLimitResult.remaining}`
    })
  }

  // Log the AI request for monitoring
  await ctx.prisma.performanceMetric.create({
    data: {
      userId,
      operation: `ai_${path}`,
      duration: 0, // Will be updated after completion
      success: true,
      metadata: {
        rateLimitCheck: true,
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      }
    }
  })

  return next({ ctx })
})

// General rate limiting middleware
const rateLimitGeneral = t.middleware(async ({ ctx, next, path }) => {
  const userId = ctx.session?.user?.id || 'anonymous'
  const rateLimitKey = `general:${userId}`
  
  const rateLimitResult = await rateLimiters.general.checkLimit(rateLimitKey)
  
  if (!rateLimitResult.allowed) {
    if (userId !== 'anonymous') {
      await securityAuditLogger.logRateLimitExceeded(userId, `general_${path}`)
    }
    
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please slow down.'
    })
  }

  return next({ ctx })
})

// Input validation middleware
const validateInput = t.middleware(async ({ ctx, next, input }) => {
  // Basic input validation and sanitization
  if (input && typeof input === 'object') {
    // Validate common fields if present
    if ('deckName' in input && typeof input.deckName === 'string') {
      try {
        input.deckName = secureSchemas.deckName.parse(input.deckName)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid deck name format'
        })
      }
    }
    
    if ('userPrompt' in input && typeof input.userPrompt === 'string') {
      try {
        input.userPrompt = secureSchemas.userPrompt.parse(input.userPrompt)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid prompt format'
        })
      }
    }
  }

  return next({ ctx })
})

export const protectedProcedure = t.procedure
  .use(rateLimitGeneral)
  .use(enforceUserIsAuthed)
  .use(validateInput)

export const adminProcedure = t.procedure
  .use(rateLimitGeneral)
  .use(enforceUserIsAuthed)
  .use(enforceUserRole(['admin']))
  .use(validateInput)

export const aiProtectedProcedure = t.procedure
  .use(rateLimitGeneral)
  .use(enforceUserIsAuthed)
  .use(rateLimitAI)
  .use(validateInput)

// Export security utilities for use in other parts of the application
export { securityAuditLogger, sessionManager, secureSchemas }
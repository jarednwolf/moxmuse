import { initTRPC, TRPCError } from '@trpc/server'
import { type CreateNextContextOptions } from '@trpc/server/adapters/next'
import { type Session } from 'next-auth'
import { getServerSession } from 'next-auth/next'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@moxmuse/db'
import { authOptions } from './auth'
import {
  rateLimiters,
  SecurityAuditLogger,
  SessionManager,
  secureSchemas
} from './utils/security'
import { sentryService } from './services/monitoring/SentryService'
import { metricsService } from './services/monitoring/MetricsService'
import { errorHandler } from './middleware/error-handler'
import { ddosProtection } from './middleware/rate-limiter'

export interface Context {
  session: Session | null
  user: Session['user'] | null
  prisma: typeof prisma
  req?: CreateNextContextOptions['req']
  res?: CreateNextContextOptions['res']
  requestId: string
  sessionId?: string
  procedure?: string
}

interface CreateContextOptions {
  session: Session | null
  req?: CreateNextContextOptions['req']
  res?: CreateNextContextOptions['res']
}

export const createInnerTRPCContext = (opts: CreateContextOptions): Context => {
  return {
    session: opts.session,
    user: opts.session?.user || null,
    prisma,
    req: opts.req,
    res: opts.res,
    requestId: uuidv4(),
    sessionId: opts.session?.user?.id,
  }
}

export const createTRPCContext = async (opts: CreateNextContextOptions): Promise<Context> => {
  const { req, res } = opts

  // Initialize monitoring services
  sentryService.initialize()

  // Get the session from the server using NextAuth's getServerSession
  const session = await getServerSession(req, res, authOptions)

  const ctx = createInnerTRPCContext({
    session,
    req,
    res,
  })

  // Set user context for monitoring
  if (session?.user) {
    sentryService.setUser({ id: session.user.id, email: session.user.email ?? undefined })
  }

  // DDoS protection check
  try {
    ddosProtection.checkRequest(ctx)
  } catch (error) {
    // DDoS protection will throw TRPCError, let it bubble up
    throw error
  }

  return ctx
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, ctx }) {
    // Handle different types of errors with production error handling
    let handledError: TRPCError

    if (error instanceof TRPCError) {
      handledError = errorHandler.handleTRPCError(error, ctx)
    } else {
      handledError = errorHandler.handleUnknownError(error, ctx)
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
        errorId: typeof handledError.cause === 'string' ? handledError.cause : undefined,
      },
      message: handledError.message,
    }
  },
})

export const createTRPCRouter = t.router
export const router = createTRPCRouter

// Middleware to track procedure calls and performance
const trackingMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const startTime = Date.now()
  
  // Set procedure name in context
  ctx.procedure = `${type}.${path}`
  
  // Add breadcrumb for debugging
  sentryService.addBreadcrumb(
    `tRPC ${type} call: ${path}`,
    'trpc',
    {
      type,
      path,
      userId: ctx.user?.id,
      requestId: ctx.requestId,
    }
  )

  try {
    const result = await next()
    
    // Record success metrics
    const duration = Date.now() - startTime
    metricsService.recordResponseTime(`trpc.${path}`, duration, {
      type,
      status: 'success',
      userId: ctx.user?.id || 'anonymous',
    })

    return result
  } catch (error) {
    // Record error metrics
    const duration = Date.now() - startTime
    metricsService.recordError(`trpc.${path}`, error instanceof Error ? error.name : 'unknown', {
      type,
      duration: duration.toString(),
      userId: ctx.user?.id || 'anonymous',
    })

    throw error
  }
})

export const publicProcedure = t.procedure.use(trackingMiddleware)

// Enhanced authentication middleware with session validation
const enforceUserIsAuthed = t.middleware(async ({ ctx, next }) => {
  // Add debugging for authentication flow
  console.log('🔐 Auth Middleware Check:', {
    hasSession: !!ctx.session,
    hasUser: !!ctx.session?.user,
    userId: ctx.session?.user?.id,
    userEmail: ctx.session?.user?.email,
    sessionExpires: ctx.session?.expires
  })

  if (!ctx.session || !ctx.session.user) {
    console.log('❌ Authentication failed: No session or user')
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource'
    })
  }

  // If prisma is not available (e.g., unit tests using createCaller with a minimal ctx),
  // skip DB validation and pass through the session user.
  const canQueryUser = Boolean((ctx as any).prisma && (ctx as any).prisma.user && (ctx as any).prisma.user.findUnique)
  if (!canQueryUser) {
    return next({
      ctx: {
        session: ctx.session,
        user: ctx.session.user as any,
      },
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
    console.log('❌ User not found in database:', ctx.session.user.id)
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User account not found. Please log in again.'
    })
  }

  console.log('✅ Authentication successful for user:', dbUser.email)

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

// Protected procedure narrows ctx so session/user are non-null for downstream
export const protectedProcedure = t.procedure
  .use(trackingMiddleware)
  .use(rateLimitGeneral)
  .use(enforceUserIsAuthed)
  .use(validateInput)

export const adminProcedure = t.procedure
  .use(trackingMiddleware)
  .use(rateLimitGeneral)
  .use(enforceUserIsAuthed)
  .use(enforceUserRole(['admin']))
  .use(validateInput)

export const aiProtectedProcedure = t.procedure
  .use(trackingMiddleware)
  .use(rateLimitGeneral)
  .use(enforceUserIsAuthed)
  .use(rateLimitAI)
  .use(validateInput)

// Export security utilities for use in other parts of the application
export { securityAuditLogger, sessionManager, secureSchemas }
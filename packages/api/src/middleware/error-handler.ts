import { TRPCError } from '@trpc/server'
import { sentryService } from '../services/monitoring/SentryService'
import type { Context } from '../trpc'

export interface ErrorHandlerOptions {
	includeStack?: boolean
	logErrors?: boolean
}

export class ProductionErrorHandler {
	private options: ErrorHandlerOptions

	constructor(options: ErrorHandlerOptions = {}) {
		this.options = {
			includeStack: process.env.NODE_ENV !== 'production',
			logErrors: true,
			...options,
		}
	}

	handleTRPCError(error: TRPCError, ctx?: Context): TRPCError {
		const errorId = sentryService.captureError(error, {
			userId: (ctx as any)?.user?.id,
			sessionId: (ctx as any)?.sessionId,
			requestId: (ctx as any)?.requestId,
			component: 'tRPC',
			action: (ctx as any)?.procedure,
			metadata: {
				code: error.code,
				cause: (error as any).cause,
			},
		})

		if (this.options.logErrors) {
			console.error(`[${errorId}] tRPC Error:`, {
				code: error.code,
				message: error.message,
				userId: (ctx as any)?.user?.id,
				procedure: (ctx as any)?.procedure,
			})
		}

		// Don't expose internal errors in production
		if (process.env.NODE_ENV === 'production' && error.code === 'INTERNAL_SERVER_ERROR') {
			return new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'An internal error occurred. Please try again later.',
				cause: errorId, // Include error ID for support
			})
		}

		return error
	}

	handleUnknownError(error: unknown, ctx?: Context): TRPCError {
		const actualError = error instanceof Error ? error : new Error(String(error))
		
		const errorId = sentryService.captureError(actualError, {
			userId: (ctx as any)?.user?.id,
			sessionId: (ctx as any)?.sessionId,
			requestId: (ctx as any)?.requestId,
			component: 'Unknown',
			metadata: {
				originalError: error,
			},
		})

		if (this.options.logErrors) {
			console.error(`[${errorId}] Unknown Error:`, actualError)
		}

		return new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: process.env.NODE_ENV === 'production' 
				? 'An unexpected error occurred. Please try again later.'
				: actualError.message,
			cause: this.options.includeStack ? actualError : (errorId as unknown as string),
		})
	}

	handleDatabaseError(error: Error, operation: string, ctx?: Context): TRPCError {
		const errorId = sentryService.captureError(error, {
			userId: (ctx as any)?.user?.id,
			sessionId: (ctx as any)?.sessionId,
			requestId: (ctx as any)?.requestId,
			component: 'Database',
			action: operation,
			metadata: {
				operation,
				errorCode: (error as any).code,
				errorMeta: (error as any).meta,
			},
		})

		if (this.options.logErrors) {
			console.error(`[${errorId}] Database Error in ${operation}:`, error)
		}

		// Handle specific database errors
		if ((error as any).code === 'P2002') {
			return new TRPCError({
				code: 'CONFLICT',
				message: 'A record with this information already exists.',
				cause: errorId as unknown as string,
			})
		}

		if ((error as any).code === 'P2025') {
			return new TRPCError({
				code: 'NOT_FOUND',
				message: 'The requested record was not found.',
				cause: errorId as unknown as string,
			})
		}

		return new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'A database error occurred. Please try again later.',
			cause: errorId as unknown as string,
		})
	}

	handleAIServiceError(error: Error, operation: string, ctx?: Context): TRPCError {
		const errorId = sentryService.captureError(error, {
			userId: (ctx as any)?.user?.id,
			sessionId: (ctx as any)?.sessionId,
			requestId: (ctx as any)?.requestId,
			component: 'AIService',
			action: operation,
			metadata: {
				operation,
				isTimeout: error.message.includes('timeout'),
				isRateLimit: error.message.includes('rate limit'),
			},
		})

		if (this.options.logErrors) {
			console.error(`[${errorId}] AI Service Error in ${operation}:`, error)
		}

		// Handle specific AI service errors
		if (error.message.includes('timeout')) {
			return new TRPCError({
				code: 'TIMEOUT',
				message: 'The AI service is taking longer than expected. Please try again.',
				cause: errorId as unknown as string,
			})
		}

		if (error.message.includes('rate limit')) {
			return new TRPCError({
				code: 'TOO_MANY_REQUESTS',
				message: 'Too many requests. Please wait a moment before trying again.',
				cause: errorId as unknown as string,
			})
		}

		return new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'The AI service is temporarily unavailable. Please try again later.',
			cause: errorId as unknown as string,
		})
	}
}

// Export singleton instance
export const errorHandler = new ProductionErrorHandler()
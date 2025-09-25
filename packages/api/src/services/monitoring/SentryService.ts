import * as Sentry from '@sentry/node'
// Minimal user shape local to avoid prisma type import coupling
type MinimalUser = {
  id?: string | null
  email?: string | null
}

// Optional profiling integration
let ProfilingIntegration: any = null
try {
  // Avoid bundling native module in Next.js by resolving at runtime only
  if (process.env.NEXT_RUNTIME !== 'edge' && process.env.NEXT_PUBLIC_ENABLE_SENTRY_PROFILING === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // Use indirect require to keep webpack from parsing the native .node file
    const mod = (0, eval)('require')('@sentry/profiling-node')
    ProfilingIntegration = mod?.ProfilingIntegration || null
  }
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error)
  console.warn('Sentry profiling integration not available:', msg)
}

export interface ErrorContext {
	userId?: string
	sessionId?: string
	requestId?: string
	component?: string
	action?: string
	operation?: string
	metadata?: Record<string, any>
}

export interface PerformanceContext {
	operation: string
	duration: number
	tags?: Record<string, string>
	metadata?: Record<string, any>
}

export class SentryService {
	private static instance: SentryService
	private initialized = false

	private constructor() {}

	static getInstance(): SentryService {
		if (!SentryService.instance) {
			SentryService.instance = new SentryService()
		}
		return SentryService.instance
	}

	initialize(): void {
		if (this.initialized) return

		const dsn = process.env.SENTRY_DSN
		if (!dsn) {
			console.warn('SENTRY_DSN not configured, error tracking disabled')
			return
		}

		const integrations = [
			new Sentry.Integrations.Http({ tracing: true }),
			new Sentry.Integrations.Express({ app: undefined }),
		]

		// Add profiling integration if available
		if (ProfilingIntegration) {
			integrations.push(new ProfilingIntegration())
		}

		Sentry.init({
			dsn,
			environment: process.env.NODE_ENV || 'development',
			integrations,
			
		// Performance monitoring
		tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
		profilesSampleRate: process.env.NEXT_PUBLIC_ENABLE_SENTRY_PROFILING === 'true' ? (process.env.NODE_ENV === 'production' ? 0.1 : 1.0) : 0,
			
			// Error filtering
			beforeSend(event, hint) {
				// Filter out known non-critical errors
				const err = hint.originalException
				if (err instanceof Error) {
					// Skip client-side network errors
					if (err.message.includes('Network Error') || 
							err.message.includes('fetch')) {
						return null
					}
					
					// Skip rate limiting errors (these are expected)
					if (err.message.includes('Rate limit exceeded')) {
						return null
					}
				}
				
				return event
			},
			
			// Release tracking
			release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
		})

		this.initialized = true
		console.log('Sentry error tracking initialized')
	}

	captureError(error: Error, context?: ErrorContext): string {
		if (!this.initialized) {
			console.error('Sentry not initialized, logging error:', error)
			return ''
		}

		return Sentry.withScope((scope) => {
			if (context) {
				// Set user context
				if (context.userId) {
					scope.setUser({ id: context.userId })
				}

				// Set tags for filtering
				if (context.component) scope.setTag('component', context.component)
				if (context.action) scope.setTag('action', context.action)
				if (context.sessionId) scope.setTag('sessionId', context.sessionId)
				if (context.requestId) scope.setTag('requestId', context.requestId)

				// Set additional context
				if (context.metadata) {
					scope.setContext('metadata', context.metadata)
				}
			}

			return Sentry.captureException(error)
		})
	}

	captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): string {
		if (!this.initialized) {
			console.log(`Sentry not initialized, logging message [${level}]:`, message)
			return ''
		}

		return Sentry.withScope((scope) => {
			if (context) {
				if (context.userId) scope.setUser({ id: context.userId })
				if (context.component) scope.setTag('component', context.component)
				if (context.action) scope.setTag('action', context.action)
				if (context.metadata) scope.setContext('metadata', context.metadata)
			}

			return Sentry.captureMessage(message, level)
		})
	}

	startTransaction(name: string, operation: string = 'http'): Sentry.Transaction {
		if (!this.initialized) {
			// Return a mock transaction for development
			return {
				finish: () => {},
				setTag: () => {},
				setData: () => {},
				setStatus: () => {},
			} as any
		}

		return Sentry.startTransaction({
			name,
			op: operation,
		})
	}

	recordPerformance(context: PerformanceContext): void {
		if (!this.initialized) return

		Sentry.withScope((scope) => {
			scope.setTag('operation', context.operation)
			
			if (context.tags) {
				Object.entries(context.tags).forEach(([key, value]) => {
					scope.setTag(key, value)
				})
			}

			if (context.metadata) {
				scope.setContext('performance', context.metadata)
			}

			// Record as a measurement
			Sentry.addBreadcrumb({
				category: 'performance',
				message: `${context.operation} completed in ${context.duration}ms`,
				level: 'info',
				data: {
					duration: context.duration,
					operation: context.operation,
					...context.metadata,
				},
			})
		})
	}

  setUser(user: MinimalUser): void {
		if (!this.initialized) return

    Sentry.setUser({
      id: user.id != null ? String(user.id) : undefined,
      email: user.email || undefined,
    })
	}

	addBreadcrumb(message: string, category: string = 'custom', data?: Record<string, any>): void {
		if (!this.initialized) return

		Sentry.addBreadcrumb({
			message,
			category,
			level: 'info',
			data,
		})
	}

	flush(timeout: number = 2000): Promise<boolean> {
		if (!this.initialized) return Promise.resolve(true)
		
		return Sentry.flush(timeout)
	}
}

// Export singleton instance
export const sentryService = SentryService.getInstance()
import { Request, Response, NextFunction } from 'express';
import { observabilityService } from '../services/monitoring/ObservabilityService';
import { logAggregationService } from '../services/monitoring/LogAggregationService';

export interface MonitoringContext {
	requestId: string;
	startTime: number;
	userId?: string;
	sessionId?: string;
}

declare global {
	namespace Express {
		interface Request {
			monitoring?: MonitoringContext;
		}
	}
}

// Request tracking middleware
export function requestTrackingMiddleware(req: Request, res: Response, next: NextFunction): void {
	const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	const startTime = Date.now();

	// Extract user and session info from headers or auth
	const userId = req.headers['x-user-id'] as string || undefined;
	const sessionId = (req.headers['x-session-id'] as string) || undefined;

	req.monitoring = {
		requestId,
		startTime,
		userId,
		sessionId
	};

	// Log request start
	logAggregationService.info(
		`${req.method} ${req.path} - Request started`,
		'http-middleware',
		{
			method: req.method,
			path: req.path,
			userAgent: req.headers['user-agent'],
			ip: req.ip,
			userId,
			sessionId,
			requestId
		}
	);

	// Track request metric
	observabilityService.recordMetric('request.count', 1, {
		method: req.method,
		endpoint: req.path,
		userId: userId || 'anonymous'
	});

	// Override res.end to capture response metrics
	const originalEnd = res.end;
	res.end = function(chunk?: any, encoding?: any) {
		const duration = Date.now() - startTime;
		const statusCode = res.statusCode;

		// Record response time
		observabilityService.recordMetric('request.duration', duration, {
			method: req.method,
			endpoint: req.path,
			statusCode: statusCode.toString()
		}, 'timer');

		// Record error if status code indicates error
		if (statusCode >= 400) {
			observabilityService.recordMetric('request.error', 1, {
				method: req.method,
				endpoint: req.path,
				statusCode: statusCode.toString()
			});

			logAggregationService.warn(
				`${req.method} ${req.path} - Request failed with status ${statusCode}`,
				'http-middleware',
				{
					method: req.method,
					path: req.path,
					statusCode,
					duration,
					userId,
					sessionId,
					requestId
				}
			);
		} else {
			logAggregationService.info(
				`${req.method} ${req.path} - Request completed`,
				'http-middleware',
				{
					method: req.method,
					path: req.path,
					statusCode,
					duration,
					userId,
					sessionId,
					requestId
				}
			);
		}

		// Track response time buckets for SLA monitoring
		if (duration > 5000) {
			observabilityService.recordMetric('request.slow', 1, {
				method: req.method,
				endpoint: req.path
			});
		}

		return originalEnd.call(this, chunk, encoding);
	};

	next();
}

// Error tracking middleware
export function errorTrackingMiddleware(error: Error, req: Request, res: Response, next: NextFunction): void {
	const monitoring = req.monitoring;
	
	// Log the error
	logAggregationService.error(
		`Unhandled error in ${req.method} ${req.path}: ${error.message}`,
		'error-middleware',
		error,
		{
			method: req.method,
			path: req.path,
			userId: monitoring?.userId,
			sessionId: monitoring?.sessionId,
			requestId: monitoring?.requestId,
			stack: error.stack
		}
	);

	// Record error metric
	observabilityService.recordMetric('error.unhandled', 1, {
		method: req.method,
		endpoint: req.path,
		errorType: error.name,
		userId: monitoring?.userId || 'anonymous'
	});

	// Create system alert for critical errors
	if (error.name === 'DatabaseError' || error.name === 'AuthenticationError') {
		observabilityService.createAlert({
			severity: 'high',
			title: `Critical Error: ${error.name}`,
			description: `${error.message} in ${req.method} ${req.path}`,
			source: 'error-middleware',
			metadata: {
				error: error.name,
				message: error.message,
				endpoint: `${req.method} ${req.path}`,
				userId: monitoring?.userId,
				requestId: monitoring?.requestId
			}
		});
	}

	next(error);
}

// Performance monitoring middleware
export function performanceMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
	const monitoring = req.monitoring;
	if (!monitoring) return next();

	// Start performance transaction
	const transactionId = observabilityService.startTransaction(`${req.method} ${req.path}`);

	// Override res.end to complete transaction
	const originalEnd = res.end;
	res.end = function(chunk?: any, encoding?: any) {
		observabilityService.endTransaction(transactionId);
		return originalEnd.call(this, chunk, encoding);
	};

	next();
}

// User behavior tracking middleware
export function userBehaviorTrackingMiddleware(req: Request, res: Response, next: NextFunction): void {
	const monitoring = req.monitoring;
	if (!monitoring || !monitoring.sessionId) return next();

	// Track page views
	if (req.method === 'GET' && req.path.startsWith('/')) {
		observabilityService.trackUserEvent({
			userId: monitoring.userId,
			sessionId: monitoring.sessionId,
			event: 'page_view',
			properties: {
				path: req.path,
				referrer: req.headers.referer,
				userAgent: req.headers['user-agent']
			},
			page: req.path,
			userAgent: req.headers['user-agent'] as string
		});
	}

	// Track API calls
	if (req.path.startsWith('/api/')) {
		observabilityService.trackUserEvent({
			userId: monitoring.userId,
			sessionId: monitoring.sessionId,
			event: 'api_call',
			properties: {
				method: req.method,
				endpoint: req.path,
				hasAuth: !!monitoring.userId
			}
		});
	}

	next();
}

// Rate limiting monitoring middleware
export function rateLimitMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
	const monitoring = req.monitoring;
	if (!monitoring) return next();

	// Track rate limit hits
	const rateLimitRemaining = res.getHeader('X-RateLimit-Remaining') as string;
	const rateLimitLimit = res.getHeader('X-RateLimit-Limit') as string;

	if (rateLimitRemaining && rateLimitLimit) {
		const remaining = parseInt(rateLimitRemaining);
		const limit = parseInt(rateLimitLimit);
		const usage = (limit - remaining) / limit;

		observabilityService.recordMetric('rate_limit.usage', usage, {
			endpoint: req.path,
			userId: monitoring.userId || 'anonymous'
		}, 'gauge');

		// Alert if rate limit is being hit frequently
		if (usage > 0.8) {
			observabilityService.recordMetric('rate_limit.high_usage', 1, {
				endpoint: req.path,
				userId: monitoring.userId || 'anonymous'
			});
		}
	}

	// Check if request was rate limited
	if (res.statusCode === 429) {
		observabilityService.recordMetric('rate_limit.exceeded', 1, {
			endpoint: req.path,
			userId: monitoring.userId || 'anonymous'
		});

		logAggregationService.warn(
			`Rate limit exceeded for ${req.method} ${req.path}`,
			'rate-limit-middleware',
			{
				method: req.method,
				path: req.path,
				userId: monitoring.userId,
				sessionId: monitoring.sessionId,
				requestId: monitoring.requestId,
				ip: req.ip
			}
		);
	}

	next();
}

// Database query monitoring middleware
export function databaseMonitoringMiddleware() {
	return {
		beforeQuery: (query: string, params?: any[]) => {
			const queryId = `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
			const startTime = Date.now();

			return {
				queryId,
				startTime,
				query: query.substring(0, 200), // Truncate long queries
				params: params?.length || 0
			};
		},

		afterQuery: (context: any, error?: Error) => {
			const duration = Date.now() - context.startTime;

			if (error) {
				logAggregationService.error(
					`Database query failed: ${error.message}`,
					'database-middleware',
					error,
					{
						queryId: context.queryId,
						query: context.query,
						duration,
						paramCount: context.params
					}
				);

				observabilityService.recordMetric('database.query.error', 1, {
					queryType: context.query.split(' ')[0]?.toUpperCase() || 'UNKNOWN'
				});
			} else {
				observabilityService.recordMetric('database.query.duration', duration, {
					queryType: context.query.split(' ')[0]?.toUpperCase() || 'UNKNOWN'
				}, 'timer');

				// Log slow queries
				if (duration > 1000) {
					logAggregationService.warn(
						`Slow database query detected: ${duration}ms`,
						'database-middleware',
						{
							queryId: context.queryId,
							query: context.query,
							duration,
							paramCount: context.params
						}
					);

					observabilityService.recordMetric('database.query.slow', 1, {
						queryType: context.query.split(' ')[0]?.toUpperCase() || 'UNKNOWN'
					});
				}
			}

			observabilityService.recordMetric('database.query.count', 1, {
				queryType: context.query.split(' ')[0]?.toUpperCase() || 'UNKNOWN',
				status: error ? 'error' : 'success'
			});
		}
	};
}

// AI service monitoring middleware
export function aiServiceMonitoringMiddleware() {
	return {
		beforeRequest: (service: string, operation: string, params?: any) => {
			const requestId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
			const startTime = Date.now();

			logAggregationService.info(
				`AI service request started: ${service}.${operation}`,
				'ai-middleware',
				{
					requestId,
					service,
					operation,
					hasParams: !!params
				}
			);

			observabilityService.recordMetric('ai.request.started', 1, {
				service,
				operation
			});

			return { requestId, startTime, service, operation };
		},

		afterRequest: (context: any, result?: any, error?: Error) => {
			const duration = Date.now() - context.startTime;

			if (error) {
				logAggregationService.error(
					`AI service request failed: ${context.service}.${context.operation} - ${error.message}`,
					'ai-middleware',
					error,
					{
						requestId: context.requestId,
						service: context.service,
						operation: context.operation,
						duration
					}
				);

				observabilityService.recordMetric('ai.request.error', 1, {
					service: context.service,
					operation: context.operation,
					errorType: error.name
				});

				// Create alert for AI service failures
				if (context.operation === 'generateDeck') {
					observabilityService.createAlert({
						severity: 'medium',
						title: 'AI Deck Generation Failed',
						description: `Deck generation failed: ${error.message}`,
						source: 'ai-middleware',
						metadata: {
							requestId: context.requestId,
							duration,
							error: error.message
						}
					});
				}
			} else {
				logAggregationService.info(
					`AI service request completed: ${context.service}.${context.operation}`,
					'ai-middleware',
					{
						requestId: context.requestId,
						service: context.service,
						operation: context.operation,
						duration,
						hasResult: !!result
					}
				);

				observabilityService.recordMetric('ai.request.success', 1, {
					service: context.service,
					operation: context.operation
				});

				observabilityService.recordMetric('ai.request.duration', duration, {
					service: context.service,
					operation: context.operation
				}, 'timer');

				// Track successful deck generations
				if (context.operation === 'generateDeck' && result) {
					observabilityService.trackUserEvent({
						sessionId: context.requestId,
						event: 'deck_generated',
						properties: {
							duration,
							cardCount: result.cards?.length || 0,
							commander: result.commander,
							strategy: result.strategy
						}
					});
				}
			}
		}
	};
}

// Cache monitoring middleware
export function cacheMonitoringMiddleware() {
	return {
		onHit: (key: string, ttl?: number) => {
			observabilityService.recordMetric('cache.hit', 1, {
				keyPrefix: key.split(':')[0] || 'unknown'
			});
		},

		onMiss: (key: string) => {
			observabilityService.recordMetric('cache.miss', 1, {
				keyPrefix: key.split(':')[0] || 'unknown'
			});
		},

		onSet: (key: string, ttl?: number) => {
			observabilityService.recordMetric('cache.set', 1, {
				keyPrefix: key.split(':')[0] || 'unknown',
				hasTtl: (!!ttl).toString()
			});
		},

		onEviction: (key: string, reason: string) => {
			observabilityService.recordMetric('cache.eviction', 1, {
				keyPrefix: key.split(':')[0] || 'unknown',
				reason
			});

			logAggregationService.debug(
				`Cache eviction: ${key} (${reason})`,
				'cache-middleware',
				{ key, reason }
			);
		}
	};
}

// Export all middleware as a bundle
export const monitoringMiddleware = {
	requestTracking: requestTrackingMiddleware,
	errorTracking: errorTrackingMiddleware,
	performance: performanceMonitoringMiddleware,
	userBehavior: userBehaviorTrackingMiddleware,
	rateLimit: rateLimitMonitoringMiddleware,
	database: databaseMonitoringMiddleware,
	aiService: aiServiceMonitoringMiddleware,
	cache: cacheMonitoringMiddleware
};
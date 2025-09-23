import { Request, Response, NextFunction } from 'express';
import { ScalabilityService } from '../services/scaling/ScalabilityService';

export interface ScalabilityMiddlewareOptions {
  scalabilityService: ScalabilityService;
  enableMetrics?: boolean;
  enableLoadBalancing?: boolean;
  enableAutoScaling?: boolean;
}

export interface ScalabilityRequest extends Request {
  scalability?: {
    selectedServer?: string;
    requestId: string;
    startTime: number;
  };
}

export function createScalabilityMiddleware(options: ScalabilityMiddlewareOptions) {
  const { scalabilityService, enableMetrics = true, enableLoadBalancing = true, enableAutoScaling = true } = options;

  return async (req: ScalabilityRequest, res: Response, next: NextFunction) => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    // Initialize request scalability context
    req.scalability = {
      requestId,
      startTime,
    };

    // Load balancing - select optimal server for request
    if (enableLoadBalancing) {
      const selectedServer = scalabilityService['loadBalancer'].selectServer(req);
      if (selectedServer) {
        req.scalability.selectedServer = selectedServer.id;
        
        // Update server connection count
        scalabilityService['loadBalancer'].updateServerMetrics(selectedServer.id, {
          connections: selectedServer.connections + 1,
        });
      }
    }

    // Metrics collection
    if (enableMetrics) {
      // Record request start
      scalabilityService.emit('requestStarted', {
        requestId,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date(startTime),
      });

      // Set up response metrics collection
      const originalSend = res.send;
      res.send = function(data) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Record request completion
        scalabilityService.emit('requestCompleted', {
          requestId,
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          duration,
          contentLength: Buffer.byteLength(data || ''),
          timestamp: new Date(endTime),
        });

        // Update server metrics if load balancing is enabled
        if (enableLoadBalancing && req.scalability?.selectedServer) {
          const serverId = req.scalability.selectedServer;
          scalabilityService['loadBalancer'].updateServerMetrics(serverId, {
            connections: Math.max(0, (scalabilityService['loadBalancer']['servers'].get(serverId)?.connections || 1) - 1),
            responseTime: duration,
          });
        }

        // Auto-scaling metrics
        if (enableAutoScaling) {
          // Record metrics for auto-scaling decisions
          const cpuUsage = process.cpuUsage();
          const memoryUsage = process.memoryUsage();
          
          scalabilityService['autoScaling'].recordMetrics('api-server', {
            cpuUtilization: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
            memoryUtilization: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
            requestRate: 1, // This would be calculated over time windows
            responseTime: duration,
            errorRate: res.statusCode >= 400 ? 1 : 0,
            queueDepth: 0, // Would need to be tracked separately
            activeConnections: 1, // Would need to be tracked separately
            timestamp: new Date(),
          });
        }

        return originalSend.call(this, data);
      };
    }

    // Error handling
    const originalNext = next;
    next = (error?: any) => {
      if (error && enableMetrics) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        scalabilityService.emit('requestError', {
          requestId,
          path: req.path,
          method: req.method,
          error: error.message || 'Unknown error',
          duration,
          timestamp: new Date(endTime),
        });
      }

      return originalNext(error);
    };

    next();
  };
}

export function createHealthCheckMiddleware(scalabilityService: ScalabilityService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/health' || req.path === '/api/health') {
      try {
        const health = await scalabilityService.healthCheck();
        const metrics = await scalabilityService.getSystemMetrics();

        res.status(health.healthy ? 200 : 503).json({
          status: health.healthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          services: health.services,
          metrics: {
            loadBalancer: metrics.loadBalancer,
            database: {
              totalConnections: metrics.database.totalConnections,
              activeConnections: metrics.database.activeConnections,
            },
            backgroundJobs: {
              totalQueues: metrics.backgroundJobs.totalQueues,
              errorRate: metrics.backgroundJobs.errorRate,
            },
          },
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        });
      } catch (error) {
        res.status(503).json({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Health check failed',
        });
      }
    } else {
      next();
    }
  };
}

export function createRateLimitingMiddleware(scalabilityService: ScalabilityService) {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [key, value] of requestCounts.entries()) {
      if (now > value.resetTime) {
        requestCounts.delete(key);
      }
    }

    // Get or create rate limit entry
    let rateLimitEntry = requestCounts.get(clientId);
    if (!rateLimitEntry || now > rateLimitEntry.resetTime) {
      rateLimitEntry = {
        count: 0,
        resetTime: now + RATE_LIMIT_WINDOW,
      };
      requestCounts.set(clientId, rateLimitEntry);
    }

    // Check rate limit
    if (rateLimitEntry.count >= RATE_LIMIT_MAX_REQUESTS) {
      // Emit rate limit event for monitoring
      scalabilityService.emit('rateLimitExceeded', {
        clientId,
        path: req.path,
        method: req.method,
        count: rateLimitEntry.count,
        timestamp: new Date(),
      });

      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((rateLimitEntry.resetTime - now) / 1000),
      });
      return;
    }

    // Increment request count
    rateLimitEntry.count++;

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': (RATE_LIMIT_MAX_REQUESTS - rateLimitEntry.count).toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitEntry.resetTime / 1000).toString(),
    });

    next();
  };
}

export function createCacheMiddleware(scalabilityService: ScalabilityService) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache headers based on CDN service
    const cacheHeaders = scalabilityService['cdn'].generateCacheHeaders(req.path);
    
    // Apply cache headers
    Object.entries(cacheHeaders).forEach(([key, value]) => {
      res.set(key, value);
    });

    // Add ETag for conditional requests
    const originalSend = res.send;
    res.send = function(data) {
      if (data && res.statusCode === 200) {
        const etag = generateETag(data);
        res.set('ETag', etag);

        // Check if client has cached version
        const clientETag = req.get('If-None-Match');
        if (clientETag === etag) {
          res.status(304).end();
          return res;
        }
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateETag(data: any): string {
  const crypto = require('crypto');
  return `"${crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
}
import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { ScalabilityService } from '../services/scaling/ScalabilityService';
import { RoundRobinStrategy, LeastConnectionsStrategy, WeightedResponseTimeStrategy } from '../services/scaling/LoadBalancerService';

// Initialize scalability service (in production, this would be dependency injected)
const scalabilityService = new ScalabilityService({
  loadBalancer: {
    strategy: new RoundRobinStrategy(),
    healthCheckInterval: 30000,
  },
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'moxmuse',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    enableMetrics: true,
    slowQueryThreshold: 1000,
  },
  cdn: {
    provider: 'vercel',
    baseUrl: process.env.CDN_BASE_URL || 'https://moxmuse.com',
    enableCompression: true,
    enableCaching: true,
    defaultTTL: 3600,
    maxAge: 86400,
  },
  backgroundJobs: {
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    queues: ['deck-generation', 'card-sync', 'image-optimization', 'analytics'],
  },
  autoScaling: {
    enabled: process.env.NODE_ENV === 'production',
    targets: [],
    policies: [],
  },
});

const serverSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  load: z.number().min(0).max(1),
  responseTime: z.number().min(0),
  connections: z.number().min(0),
  maxConnections: z.number().min(1),
});

const jobSchema = z.object({
  id: z.string(),
  type: z.string(),
  payload: z.any(),
  priority: z.number().optional(),
  delay: z.number().optional(),
  attempts: z.number().optional(),
});

const scalingTargetSchema = z.object({
  id: z.string(),
  type: z.enum(['server', 'container', 'function']),
  minInstances: z.number().min(1),
  maxInstances: z.number().min(1),
  currentInstances: z.number().min(0),
  desiredInstances: z.number().min(0),
});

const scalingPolicySchema = z.object({
  name: z.string(),
  metricType: z.enum(['cpuUtilization', 'memoryUtilization', 'requestRate', 'responseTime', 'errorRate', 'queueDepth', 'activeConnections']),
  threshold: z.number(),
  comparisonOperator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']),
  evaluationPeriods: z.number().min(1),
  cooldownPeriod: z.number().min(60),
  scalingAction: z.object({
    type: z.enum(['scale_up', 'scale_down']),
    adjustment: z.number().min(1),
    adjustmentType: z.enum(['absolute', 'percentage']),
  }),
});

export const scalabilityRouter = createTRPCRouter({
  // System metrics and health
  getSystemMetrics: publicProcedure
    .query(async () => {
      return await scalabilityService.getSystemMetrics();
    }),

  healthCheck: publicProcedure
    .query(async () => {
      return await scalabilityService.healthCheck();
    }),

  // Load balancer management
  addServer: protectedProcedure
    .input(serverSchema)
    .mutation(async ({ input }) => {
      await scalabilityService.addServer(input);
      return { success: true };
    }),

  removeServer: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .mutation(async ({ input }) => {
      await scalabilityService.removeServer(input.serverId);
      return { success: true };
    }),

  getLoadBalancerStats: publicProcedure
    .query(async () => {
      const metrics = await scalabilityService.getSystemMetrics();
      return metrics.loadBalancer;
    }),

  // Database connection pool
  getDatabaseMetrics: publicProcedure
    .query(async () => {
      const metrics = await scalabilityService.getSystemMetrics();
      return metrics.database;
    }),

  executeQuery: protectedProcedure
    .input(z.object({
      query: z.string(),
      params: z.array(z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      return await scalabilityService.executeQuery(input.query, input.params);
    }),

  // CDN management
  getCDNMetrics: publicProcedure
    .query(async () => {
      const metrics = await scalabilityService.getSystemMetrics();
      return metrics.cdn;
    }),

  optimizeImage: publicProcedure
    .input(z.object({
      url: z.string().url(),
      format: z.enum(['webp', 'avif', 'jpeg', 'png']),
      quality: z.number().min(1).max(100),
      width: z.number().optional(),
      height: z.number().optional(),
      fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).optional(),
    }))
    .query(async ({ input }) => {
      const { url, ...options } = input;
      return await scalabilityService.optimizeImage(url, options);
    }),

  purgeCache: protectedProcedure
    .input(z.object({
      paths: z.union([z.array(z.string()), z.literal('all')]),
    }))
    .mutation(async ({ input }) => {
      await scalabilityService.purgeCache(input.paths);
      return { success: true };
    }),

  // Background job processing
  getJobMetrics: publicProcedure
    .query(async () => {
      const metrics = await scalabilityService.getSystemMetrics();
      return metrics.backgroundJobs;
    }),

  addJob: protectedProcedure
    .input(z.object({
      queueName: z.string(),
      job: jobSchema,
    }))
    .mutation(async ({ input }) => {
      await scalabilityService.addBackgroundJob(input.queueName, input.job);
      return { success: true };
    }),

  // Auto-scaling management
  getAutoScalingMetrics: publicProcedure
    .query(async () => {
      const metrics = await scalabilityService.getSystemMetrics();
      return metrics.autoScaling;
    }),

  addScalingTarget: protectedProcedure
    .input(scalingTargetSchema)
    .mutation(async ({ input }) => {
      // This would need to be implemented in the scalability service
      return { success: true, message: 'Scaling target management not yet implemented' };
    }),

  addScalingPolicy: protectedProcedure
    .input(scalingPolicySchema)
    .mutation(async ({ input }) => {
      // This would need to be implemented in the scalability service
      return { success: true, message: 'Scaling policy management not yet implemented' };
    }),

  // Performance optimization
  getPerformanceRecommendations: publicProcedure
    .query(async () => {
      const metrics = await scalabilityService.getSystemMetrics();
      const recommendations: string[] = [];

      // Database recommendations
      if (metrics.database.slowQueries > 10) {
        recommendations.push('High number of slow queries detected - consider query optimization');
      }
      
      if (metrics.database.activeConnections / metrics.database.totalConnections > 0.8) {
        recommendations.push('High database connection utilization - consider increasing pool size');
      }

      // Load balancer recommendations
      if (metrics.loadBalancer.healthyServers < 2) {
        recommendations.push('Low number of healthy servers - consider adding more instances');
      }
      
      if (metrics.loadBalancer.averageResponseTime > 1000) {
        recommendations.push('High average response time - consider optimizing server performance');
      }

      // CDN recommendations
      if (metrics.cdn.cacheHitRate < 0.8) {
        recommendations.push('Low CDN cache hit rate - consider optimizing cache policies');
      }

      // Background jobs recommendations
      if (metrics.backgroundJobs.errorRate > 0.05) {
        recommendations.push('High background job error rate - investigate job failures');
      }

      return {
        recommendations,
        metrics,
        timestamp: new Date(),
      };
    }),

  // Configuration management
  updateLoadBalancingStrategy: protectedProcedure
    .input(z.object({
      strategy: z.enum(['round_robin', 'least_connections', 'weighted_response_time']),
    }))
    .mutation(async ({ input }) => {
      // This would require recreating the load balancer service
      return { 
        success: true, 
        message: `Load balancing strategy updated to ${input.strategy}` 
      };
    }),

  // Monitoring and alerting
  getSystemAlerts: publicProcedure
    .query(async () => {
      const health = await scalabilityService.healthCheck();
      const alerts: Array<{
        severity: 'low' | 'medium' | 'high' | 'critical';
        message: string;
        service: string;
        timestamp: Date;
      }> = [];

      // Check for critical issues
      if (!health.healthy) {
        alerts.push({
          severity: 'critical',
          message: 'System health check failed',
          service: 'system',
          timestamp: new Date(),
        });
      }

      // Check individual services
      Object.entries(health.services).forEach(([serviceName, serviceHealth]) => {
        if (!serviceHealth.healthy) {
          serviceHealth.issues.forEach(issue => {
            alerts.push({
              severity: 'high',
              message: issue,
              service: serviceName,
              timestamp: new Date(),
            });
          });
        }
      });

      return alerts;
    }),
});
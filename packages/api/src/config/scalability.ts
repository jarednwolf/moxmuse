import { ScalabilityConfig } from '../services/scaling/ScalabilityService';
import { RoundRobinStrategy, LeastConnectionsStrategy, WeightedResponseTimeStrategy } from '../services/scaling/LoadBalancerService';

export function createScalabilityConfig(): ScalabilityConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Load balancing strategy based on environment
  let loadBalancingStrategy;
  switch (process.env.LOAD_BALANCING_STRATEGY) {
    case 'least_connections':
      loadBalancingStrategy = new LeastConnectionsStrategy();
      break;
    case 'weighted_response_time':
      loadBalancingStrategy = new WeightedResponseTimeStrategy();
      break;
    default:
      loadBalancingStrategy = new RoundRobinStrategy();
  }

  return {
    loadBalancer: {
      strategy: loadBalancingStrategy,
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
    },
    database: {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'moxmuse',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || '',
      
      // Connection pool settings
      max: parseInt(process.env.DB_POOL_MAX || (isProduction ? '20' : '10')),
      min: parseInt(process.env.DB_POOL_MIN || (isProduction ? '5' : '2')),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'),
      
      // Monitoring settings
      enableMetrics: process.env.DB_ENABLE_METRICS !== 'false',
      slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000'),
      validateConnection: process.env.DB_VALIDATE_CONNECTION !== 'false',
      validationQuery: process.env.DB_VALIDATION_QUERY || 'SELECT 1',
    },
    cdn: {
      provider: (process.env.CDN_PROVIDER as any) || 'vercel',
      baseUrl: process.env.CDN_BASE_URL || process.env.VERCEL_URL || 'https://moxmuse.com',
      apiKey: process.env.CDN_API_KEY,
      zoneId: process.env.CLOUDFLARE_ZONE_ID,
      distributionId: process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID,
      
      enableCompression: process.env.CDN_ENABLE_COMPRESSION !== 'false',
      enableCaching: process.env.CDN_ENABLE_CACHING !== 'false',
      defaultTTL: parseInt(process.env.CDN_DEFAULT_TTL || '3600'),
      maxAge: parseInt(process.env.CDN_MAX_AGE || '86400'),
    },
    backgroundJobs: {
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      queues: [
        'deck-generation',
        'card-sync',
        'image-optimization',
        'analytics',
        'email-notifications',
        'data-export',
        'backup-tasks',
      ],
    },
    autoScaling: {
      enabled: isProduction && process.env.AUTO_SCALING_ENABLED === 'true',
      targets: [
        {
          id: 'api-server',
          type: 'server',
          minInstances: parseInt(process.env.MIN_INSTANCES || '1'),
          maxInstances: parseInt(process.env.MAX_INSTANCES || '10'),
          currentInstances: parseInt(process.env.CURRENT_INSTANCES || '1'),
          desiredInstances: parseInt(process.env.CURRENT_INSTANCES || '1'),
          status: 'stable',
        },
      ],
      policies: [
        // CPU-based scaling up
        {
          name: 'cpu-scale-up',
          metricType: 'cpuUtilization',
          threshold: parseFloat(process.env.CPU_SCALE_UP_THRESHOLD || '75'),
          comparisonOperator: 'gt',
          evaluationPeriods: parseInt(process.env.CPU_SCALE_UP_PERIODS || '2'),
          cooldownPeriod: parseInt(process.env.CPU_SCALE_UP_COOLDOWN || '300'),
          scalingAction: {
            type: 'scale_up',
            adjustment: parseInt(process.env.CPU_SCALE_UP_ADJUSTMENT || '1'),
            adjustmentType: 'absolute',
          },
        },
        // CPU-based scaling down
        {
          name: 'cpu-scale-down',
          metricType: 'cpuUtilization',
          threshold: parseFloat(process.env.CPU_SCALE_DOWN_THRESHOLD || '25'),
          comparisonOperator: 'lt',
          evaluationPeriods: parseInt(process.env.CPU_SCALE_DOWN_PERIODS || '5'),
          cooldownPeriod: parseInt(process.env.CPU_SCALE_DOWN_COOLDOWN || '600'),
          scalingAction: {
            type: 'scale_down',
            adjustment: parseInt(process.env.CPU_SCALE_DOWN_ADJUSTMENT || '1'),
            adjustmentType: 'absolute',
          },
        },
        // Memory-based scaling up
        {
          name: 'memory-scale-up',
          metricType: 'memoryUtilization',
          threshold: parseFloat(process.env.MEMORY_SCALE_UP_THRESHOLD || '85'),
          comparisonOperator: 'gt',
          evaluationPeriods: parseInt(process.env.MEMORY_SCALE_UP_PERIODS || '2'),
          cooldownPeriod: parseInt(process.env.MEMORY_SCALE_UP_COOLDOWN || '300'),
          scalingAction: {
            type: 'scale_up',
            adjustment: parseInt(process.env.MEMORY_SCALE_UP_ADJUSTMENT || '1'),
            adjustmentType: 'absolute',
          },
        },
        // Response time-based scaling
        {
          name: 'response-time-scale-up',
          metricType: 'responseTime',
          threshold: parseFloat(process.env.RESPONSE_TIME_THRESHOLD || '2000'),
          comparisonOperator: 'gt',
          evaluationPeriods: parseInt(process.env.RESPONSE_TIME_PERIODS || '3'),
          cooldownPeriod: parseInt(process.env.RESPONSE_TIME_COOLDOWN || '300'),
          scalingAction: {
            type: 'scale_up',
            adjustment: parseInt(process.env.RESPONSE_TIME_ADJUSTMENT || '2'),
            adjustmentType: 'absolute',
          },
        },
        // Error rate-based scaling
        {
          name: 'error-rate-scale-up',
          metricType: 'errorRate',
          threshold: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.05'),
          comparisonOperator: 'gt',
          evaluationPeriods: parseInt(process.env.ERROR_RATE_PERIODS || '2'),
          cooldownPeriod: parseInt(process.env.ERROR_RATE_COOLDOWN || '300'),
          scalingAction: {
            type: 'scale_up',
            adjustment: parseInt(process.env.ERROR_RATE_ADJUSTMENT || '1'),
            adjustmentType: 'absolute',
          },
        },
      ],
    },
  };
}

export const scalabilityConfig = createScalabilityConfig();

// Environment-specific optimizations
export function getEnvironmentOptimizations() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';

  return {
    // Database optimizations
    database: {
      enableQueryLogging: isDevelopment,
      enableSlowQueryLogging: !isTest,
      logLevel: isDevelopment ? 'debug' : 'warn',
      enableConnectionPooling: true,
      enablePreparedStatements: isProduction,
    },
    
    // Caching optimizations
    caching: {
      enableMemoryCache: true,
      enableRedisCache: isProduction,
      enableCDNCache: isProduction,
      defaultTTL: isProduction ? 3600 : 300, // 1 hour in prod, 5 minutes in dev
      maxMemoryCacheSize: isProduction ? 100 : 50, // MB
    },
    
    // Load balancing optimizations
    loadBalancing: {
      enableHealthChecks: !isTest,
      healthCheckInterval: isProduction ? 30000 : 60000,
      enableStickySessions: false,
      enableFailover: isProduction,
    },
    
    // Background job optimizations
    backgroundJobs: {
      enableJobRetries: true,
      maxRetries: isProduction ? 3 : 1,
      retryDelay: isProduction ? 5000 : 1000,
      enableJobPriority: isProduction,
      enableJobScheduling: isProduction,
      concurrency: isProduction ? 10 : 3,
    },
    
    // Auto-scaling optimizations
    autoScaling: {
      enablePredictiveScaling: isProduction,
      enableScheduledScaling: isProduction,
      scaleUpAggressive: false,
      scaleDownConservative: true,
      enableCostOptimization: isProduction,
    },
    
    // Monitoring optimizations
    monitoring: {
      enableDetailedMetrics: isProduction,
      metricsRetentionDays: isProduction ? 30 : 7,
      enableAlerting: isProduction,
      enableDashboards: isProduction,
      sampleRate: isProduction ? 0.1 : 1.0, // 10% sampling in prod, 100% in dev
    },
  };
}

// Validation function for configuration
export function validateScalabilityConfig(config: ScalabilityConfig): string[] {
  const errors: string[] = [];

  // Validate database configuration
  if (!config.database.host) {
    errors.push('Database host is required');
  }
  if (!config.database.database) {
    errors.push('Database name is required');
  }
  const max = config.database.max ?? 0
  const min = config.database.min ?? 0
  if (max <= min) {
    errors.push('Database max connections must be greater than min connections');
  }

  // Validate CDN configuration
  if (!config.cdn.baseUrl) {
    errors.push('CDN base URL is required');
  }
  if (config.cdn.defaultTTL < 0) {
    errors.push('CDN default TTL must be non-negative');
  }

  // Validate background jobs configuration
  if (!config.backgroundJobs.redisUrl) {
    errors.push('Redis URL is required for background jobs');
  }
  if (config.backgroundJobs.queues.length === 0) {
    errors.push('At least one background job queue must be configured');
  }

  // Validate auto-scaling configuration
  if (config.autoScaling.enabled) {
    if (config.autoScaling.targets.length === 0) {
      errors.push('Auto-scaling targets are required when auto-scaling is enabled');
    }
    if (config.autoScaling.policies.length === 0) {
      errors.push('Auto-scaling policies are required when auto-scaling is enabled');
    }

    // Validate each target
    config.autoScaling.targets.forEach((target, index) => {
      if (target.minInstances < 1) {
        errors.push(`Target ${index}: minInstances must be at least 1`);
      }
      if (target.maxInstances < target.minInstances) {
        errors.push(`Target ${index}: maxInstances must be greater than or equal to minInstances`);
      }
    });

    // Validate each policy
    config.autoScaling.policies.forEach((policy, index) => {
      if (policy.evaluationPeriods < 1) {
        errors.push(`Policy ${index}: evaluationPeriods must be at least 1`);
      }
      if (policy.cooldownPeriod < 60) {
        errors.push(`Policy ${index}: cooldownPeriod must be at least 60 seconds`);
      }
      if (policy.scalingAction.adjustment < 1) {
        errors.push(`Policy ${index}: scaling adjustment must be at least 1`);
      }
    });
  }

  return errors;
}
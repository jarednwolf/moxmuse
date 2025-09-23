// Production infrastructure configuration
export const productionConfig = {
  // Sentry configuration
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  },

  // Database backup configuration
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    path: process.env.BACKUP_PATH || './backups',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
    compression: process.env.BACKUP_COMPRESSION === 'true',
    encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
  },

  // Rate limiting configuration
  rateLimiting: {
    redis: {
      url: process.env.REDIS_URL,
      enabled: !!process.env.REDIS_URL,
    },
    general: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
    },
    ai: {
      windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '3600000'), // 1 hour
      maxRequests: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || '50'),
    },
    auth: {
      windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5'),
    },
  },

  // DDoS protection configuration
  ddos: {
    suspiciousThreshold: parseInt(process.env.DDOS_SUSPICIOUS_THRESHOLD || '100'),
    blockDuration: parseInt(process.env.DDOS_BLOCK_DURATION || '3600000'), // 1 hour
  },

  // Health check configuration
  healthCheck: {
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
  },

  // Monitoring configuration
  monitoring: {
    metricsRetention: parseInt(process.env.METRICS_RETENTION_HOURS || '24'),
    alertCooldown: parseInt(process.env.ALERT_COOLDOWN_MINUTES || '15'),
    slackWebhook: process.env.SLACK_WEBHOOK_URL,
  },

  // Performance thresholds
  performance: {
    responseTimeThreshold: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '2000'),
    errorRateThreshold: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.05'),
    memoryUsageThreshold: parseFloat(process.env.MEMORY_USAGE_THRESHOLD || '0.85'),
  },
}

// Validate required configuration
export function validateProductionConfig(): void {
  const errors: string[] = []

  if (process.env.NODE_ENV === 'production') {
    if (!productionConfig.sentry.dsn) {
      errors.push('SENTRY_DSN is required in production')
    }

    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL is required')
    }

    if (!process.env.OPENAI_API_KEY) {
      errors.push('OPENAI_API_KEY is required')
    }
  }

  if (errors.length > 0) {
    throw new Error(`Production configuration errors:\n${errors.join('\n')}`)
  }
}

// Initialize production services
export async function initializeProductionServices(): Promise<void> {
  try {
    // Validate configuration
    validateProductionConfig()

    // Initialize Sentry
    const { sentryService } = await import('../services/monitoring/SentryService')
    sentryService.initialize()

    // Initialize health checks
    const { healthCheckService } = await import('../services/health/HealthCheckService')
    // Health check service auto-initializes

    // Initialize database backup service if enabled
    if (productionConfig.backup.enabled) {
      const { databaseBackupService } = await import('../services/backup/DatabaseBackupService')
      await databaseBackupService.initialize()
    }

    console.log('✅ Production services initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize production services:', error)
    throw error
  }
}
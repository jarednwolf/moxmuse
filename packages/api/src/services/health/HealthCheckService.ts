import { sentryService } from '../monitoring/SentryService'
import { metricsService } from '../monitoring/MetricsService'

export interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  lastCheck: Date
  error?: string
  metadata?: Record<string, any>
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  services: ServiceHealth[]
  summary: {
    total: number
    healthy: number
    degraded: number
    unhealthy: number
  }
  uptime: number
  version: string
}

export interface HealthChecker {
  name: string
  check(): Promise<ServiceHealth>
  timeout?: number
  critical?: boolean
}

export class HealthCheckService {
  private static instance: HealthCheckService
  private checkers: Map<string, HealthChecker> = new Map()
  private lastResults: Map<string, ServiceHealth> = new Map()
  private startTime = Date.now()

  private constructor() {
    this.registerDefaultCheckers()
  }

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService()
    }
    return HealthCheckService.instance
  }

  registerChecker(checker: HealthChecker): void {
    this.checkers.set(checker.name, checker)
    console.log(`Registered health checker: ${checker.name}`)
  }

  async checkHealth(includeNonCritical: boolean = true): Promise<HealthCheckResult> {
    const startTime = Date.now()
    const services: ServiceHealth[] = []
    
    const checkersToRun = Array.from(this.checkers.values()).filter(
      checker => includeNonCritical || checker.critical !== false
    )

    // Run all health checks in parallel
    const checkPromises = checkersToRun.map(async (checker) => {
      try {
        const timeout = checker.timeout || 5000
        const checkPromise = checker.check()
        
        const timeoutPromise = new Promise<ServiceHealth>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), timeout)
        })

        const result = await Promise.race([checkPromise, timeoutPromise])
        this.lastResults.set(checker.name, result)
        return result
      } catch (error) {
        const errorResult: ServiceHealth = {
          name: checker.name,
          status: 'unhealthy',
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        }
        this.lastResults.set(checker.name, errorResult)
        return errorResult
      }
    })

    const results = await Promise.allSettled(checkPromises)
    
    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        services.push(result.value)
      } else {
        const checker = checkersToRun[index]
        services.push({
          name: checker.name,
          status: 'unhealthy',
          lastCheck: new Date(),
          error: result.reason?.message || 'Unknown error',
        })
      }
    })

    // Calculate summary
    const summary = {
      total: services.length,
      healthy: services.filter(s => s.status === 'healthy').length,
      degraded: services.filter(s => s.status === 'degraded').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length,
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (summary.unhealthy > 0) {
      // Check if any critical services are unhealthy
      const criticalUnhealthy = services.some(s => 
        s.status === 'unhealthy' && 
        this.checkers.get(s.name)?.critical !== false
      )
      overallStatus = criticalUnhealthy ? 'unhealthy' : 'degraded'
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded'
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date(),
      services,
      summary,
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
    }

    // Record metrics
    const duration = Date.now() - startTime
    metricsService.recordMetric({
      name: 'health_check.duration',
      value: duration,
      unit: 'milliseconds',
      tags: {
        status: overallStatus,
        services_total: summary.total.toString(),
        services_healthy: summary.healthy.toString(),
      },
    })

    // Log unhealthy services
    const unhealthyServices = services.filter(s => s.status === 'unhealthy')
    if (unhealthyServices.length > 0) {
      console.warn('Unhealthy services detected:', unhealthyServices.map(s => s.name))
      
      sentryService.captureMessage(
        `Health check found ${unhealthyServices.length} unhealthy services`,
        'warning',
        {
          component: 'HealthCheckService',
          metadata: { unhealthyServices: unhealthyServices.map(s => s.name) },
        }
      )
    }

    return result
  }

  async checkService(serviceName: string): Promise<ServiceHealth | null> {
    const checker = this.checkers.get(serviceName)
    if (!checker) {
      return null
    }

    try {
      const result = await checker.check()
      this.lastResults.set(serviceName, result)
      return result
    } catch (error) {
      const errorResult: ServiceHealth = {
        name: serviceName,
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : String(error),
      }
      this.lastResults.set(serviceName, errorResult)
      return errorResult
    }
  }

  getLastResult(serviceName: string): ServiceHealth | null {
    return this.lastResults.get(serviceName) || null
  }

  getRegisteredServices(): string[] {
    return Array.from(this.checkers.keys())
  }

  private registerDefaultCheckers(): void {
    // Database health checker
    this.registerChecker({
      name: 'database',
      critical: true,
      timeout: 5000,
      async check(): Promise<ServiceHealth> {
        const startTime = Date.now()
        
        try {
          // Import Prisma client dynamically to avoid circular dependencies
          const { prisma } = await import('@moxmuse/db')
          
          // Simple query to test database connectivity
          await prisma.$queryRaw`SELECT 1`
          
          const responseTime = Date.now() - startTime
          
          return {
            name: 'database',
            status: responseTime > 1000 ? 'degraded' : 'healthy',
            responseTime,
            lastCheck: new Date(),
            metadata: {
              connectionPool: 'active',
            },
          }
        } catch (error) {
          return {
            name: 'database',
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            lastCheck: new Date(),
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    })

    // OpenAI API health checker
    this.registerChecker({
      name: 'openai',
      critical: true,
      timeout: 10000,
      async check(): Promise<ServiceHealth> {
        const startTime = Date.now()
        
        try {
          // Test OpenAI API with a minimal request
          const response = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(8000),
          })

          const responseTime = Date.now() - startTime

          if (!response.ok) {
            throw new Error(`OpenAI API returned ${response.status}: ${response.statusText}`)
          }

          return {
            name: 'openai',
            status: responseTime > 5000 ? 'degraded' : 'healthy',
            responseTime,
            lastCheck: new Date(),
            metadata: {
              apiStatus: response.status,
            },
          }
        } catch (error) {
          return {
            name: 'openai',
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            lastCheck: new Date(),
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    })

    // Scryfall API health checker
    this.registerChecker({
      name: 'scryfall',
      critical: false,
      timeout: 5000,
      async check(): Promise<ServiceHealth> {
        const startTime = Date.now()
        
        try {
          const response = await fetch('https://api.scryfall.com/cards/random', {
            method: 'GET',
            signal: AbortSignal.timeout(4000),
          })

          const responseTime = Date.now() - startTime

          if (!response.ok) {
            throw new Error(`Scryfall API returned ${response.status}: ${response.statusText}`)
          }

          return {
            name: 'scryfall',
            status: responseTime > 3000 ? 'degraded' : 'healthy',
            responseTime,
            lastCheck: new Date(),
            metadata: {
              apiStatus: response.status,
            },
          }
        } catch (error) {
          return {
            name: 'scryfall',
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            lastCheck: new Date(),
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    })

    // Memory usage health checker
    this.registerChecker({
      name: 'memory',
      critical: false,
      timeout: 1000,
      async check(): Promise<ServiceHealth> {
        try {
          const usage = process.memoryUsage()
          const usagePercent = usage.heapUsed / usage.heapTotal
          
          let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
          if (usagePercent > 0.9) {
            status = 'unhealthy'
          } else if (usagePercent > 0.8) {
            status = 'degraded'
          }

          return {
            name: 'memory',
            status,
            lastCheck: new Date(),
            metadata: {
              heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
              heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
              usagePercent: Math.round(usagePercent * 100),
              external: Math.round(usage.external / 1024 / 1024), // MB
            },
          }
        } catch (error) {
          return {
            name: 'memory',
            status: 'unhealthy',
            lastCheck: new Date(),
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    })

    // Redis health checker (if Redis is configured)
    if (process.env.REDIS_URL) {
      this.registerChecker({
        name: 'redis',
        critical: false,
        timeout: 3000,
        async check(): Promise<ServiceHealth> {
          const startTime = Date.now()
          
          try {
            // Import Redis dynamically
            const Redis = (await import('ioredis')).default
            const redis = new Redis(process.env.REDIS_URL!)
            
            await redis.ping()
            await redis.disconnect()
            
            const responseTime = Date.now() - startTime
            
            return {
              name: 'redis',
              status: responseTime > 1000 ? 'degraded' : 'healthy',
              responseTime,
              lastCheck: new Date(),
            }
          } catch (error) {
            return {
              name: 'redis',
              status: 'unhealthy',
              responseTime: Date.now() - startTime,
              lastCheck: new Date(),
              error: error instanceof Error ? error.message : String(error),
            }
          }
        },
      })
    }

    // File system health checker
    this.registerChecker({
      name: 'filesystem',
      critical: true,
      timeout: 2000,
      async check(): Promise<ServiceHealth> {
        const startTime = Date.now()
        
        try {
          const { writeFile, unlink } = await import('fs/promises')
          const testFile = `/tmp/health-check-${Date.now()}.txt`
          
          await writeFile(testFile, 'health check test')
          await unlink(testFile)
          
          const responseTime = Date.now() - startTime
          
          return {
            name: 'filesystem',
            status: responseTime > 500 ? 'degraded' : 'healthy',
            responseTime,
            lastCheck: new Date(),
          }
        } catch (error) {
          return {
            name: 'filesystem',
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            lastCheck: new Date(),
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
    })
  }
}

// Export singleton instance
export const healthCheckService = HealthCheckService.getInstance()
import { NextResponse } from 'next/server'

// Lazy-load Prisma to avoid requiring generated client during Next build
let db: any
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  db = (0, eval)('require')('@moxmuse/db').db
} catch (_e) {
  db = undefined
}

/**
 * Detailed health check endpoint with service status
 */
export async function GET() {
  const startTime = Date.now()
  const services = []

  try {
    // Check database connectivity
    try {
      if (!db) {
        services.push({
          name: 'database',
          status: 'degraded',
          error: 'Prisma client unavailable in build environment',
          lastCheck: new Date().toISOString()
        })
      } else {
      const dbStart = Date.now()
      await db.$queryRaw`SELECT 1`
      const dbTime = Date.now() - dbStart
      
      services.push({
        name: 'database',
        status: 'up',
        responseTime: dbTime,
        lastCheck: new Date().toISOString()
      })
      }
    } catch (dbError) {
      services.push({
        name: 'database',
        status: 'down',
        error: dbError instanceof Error ? dbError.message : 'Database connection failed',
        lastCheck: new Date().toISOString()
      })
    }

    // Check AI service availability (basic check)
    try {
      if (process.env.OPENAI_API_KEY) {
        services.push({
          name: 'ai-service',
          status: 'up',
          lastCheck: new Date().toISOString(),
          note: 'API key configured'
        })
      } else {
        services.push({
          name: 'ai-service',
          status: 'degraded',
          error: 'API key not configured',
          lastCheck: new Date().toISOString()
        })
      }
    } catch (aiError) {
      services.push({
        name: 'ai-service',
        status: 'down',
        error: aiError instanceof Error ? aiError.message : 'AI service check failed',
        lastCheck: new Date().toISOString()
      })
    }

    // Check environment configuration
    const requiredEnvVars = ['DATABASE_URL', 'NEXTAUTH_SECRET']
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    services.push({
      name: 'configuration',
      status: missingEnvVars.length === 0 ? 'up' : 'degraded',
      lastCheck: new Date().toISOString(),
      ...(missingEnvVars.length > 0 && {
        error: `Missing environment variables: ${missingEnvVars.join(', ')}`
      })
    })

    const totalTime = Date.now() - startTime
    const failedServices = services.filter(s => s.status === 'down').length
    const degradedServices = services.filter(s => s.status === 'degraded').length

    const overallStatus = failedServices > 0 ? 'unhealthy' : 
                         degradedServices > 0 ? 'degraded' : 'healthy'

    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      responseTime: totalTime,
      services,
      metrics: {
        totalServices: services.length,
        healthyServices: services.filter(s => s.status === 'up').length,
        degradedServices,
        failedServices
      }
    }

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503

    return NextResponse.json(health, { status: statusCode })

  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
        responseTime: Date.now() - startTime,
        services
      },
      { status: 500 }
    )
  }
}
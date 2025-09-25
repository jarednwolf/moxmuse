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
 * Database-specific health check endpoint
 */
export async function GET() {
  const startTime = Date.now()

  try {
    if (!db) {
      return NextResponse.json({
        connected: false,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: 'Prisma client unavailable in build environment'
      }, { status: 200 })
    }
    // Test basic connectivity
    await db.$queryRaw`SELECT 1`
    
    // Test a simple query to verify schema
    const userCount = await db.user.count()
    
    // Test connection pool status
    const connectionInfo = {
      connected: true,
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      metrics: {
        userCount,
        // Add more metrics as needed
      }
    }

    return NextResponse.json(connectionInfo, { status: 200 })

  } catch (error) {
    const connectionInfo = {
      connected: false,
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Database connection failed'
    }

    return NextResponse.json(connectionInfo, { status: 503 })
  }
}
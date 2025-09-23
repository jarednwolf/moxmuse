import { NextResponse } from 'next/server'
import { db } from '@moxmuse/db'

/**
 * Database-specific health check endpoint
 */
export async function GET() {
  const startTime = Date.now()

  try {
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
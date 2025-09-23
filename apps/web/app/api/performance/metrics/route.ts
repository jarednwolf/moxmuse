import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const PerformanceMetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  timestamp: z.number(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const metric = PerformanceMetricSchema.parse(body)

    // In production, you would store this in your database or send to monitoring service
    console.log('Performance metric received:', {
      name: metric.name,
      value: metric.value,
      timestamp: new Date(metric.timestamp).toISOString(),
      url: metric.url,
    })

    // Here you could:
    // 1. Store in database for analysis
    // 2. Send to monitoring service (DataDog, New Relic, etc.)
    // 3. Trigger alerts for critical metrics
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to process performance metric:', error)
    return NextResponse.json(
      { error: 'Invalid metric data' },
      { status: 400 }
    )
  }
}

export async function GET() {
  // Return performance metrics summary
  return NextResponse.json({
    message: 'Performance metrics endpoint',
    endpoints: {
      POST: 'Submit performance metrics',
      GET: 'Get metrics summary (not implemented)',
    },
  })
}
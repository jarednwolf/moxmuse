import { NextResponse } from 'next/server'

/**
 * AI service health check endpoint
 */
export async function GET() {
  const startTime = Date.now()

  try {
    // Check if OpenAI API key is configured
    const hasApiKey = !!process.env.OPENAI_API_KEY
    
    if (!hasApiKey) {
      return NextResponse.json(
        {
          available: false,
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          error: 'OpenAI API key not configured'
        },
        { status: 503 }
      )
    }

    // Basic availability check (don't make actual API call to avoid costs)
    const aiHealth = {
      available: true,
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      status: 'configured',
      note: 'API key is configured and ready for use'
    }

    return NextResponse.json(aiHealth, { status: 200 })

  } catch (error) {
    return NextResponse.json(
      {
        available: false,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'AI service check failed'
      },
      { status: 503 }
    )
  }
}
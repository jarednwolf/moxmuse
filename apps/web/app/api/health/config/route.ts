import { NextResponse } from 'next/server'

/**
 * Configuration health check endpoint
 */
export async function GET() {
  try {
    const config = {
      environment: process.env.NODE_ENV || 'unknown',
      vercelEnv: process.env.VERCEL_ENV || 'unknown',
      appEnv: process.env.NEXT_PUBLIC_APP_ENV || 'unknown',
      version: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      timestamp: new Date().toISOString(),
      
      // Check critical environment variables (without exposing values)
      environmentVariables: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        NEXTAUTH_URL: !!process.env.NEXTAUTH_URL
      },
      
      // Runtime information
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    }

    // Check for configuration issues
    const issues = []
    
    if (config.environment === 'development' && config.vercelEnv === 'production') {
      issues.push('Environment mismatch: NODE_ENV is development but VERCEL_ENV is production')
    }
    
    if (!config.environmentVariables.DATABASE_URL) {
      issues.push('DATABASE_URL is not configured')
    }
    
    if (!config.environmentVariables.NEXTAUTH_SECRET) {
      issues.push('NEXTAUTH_SECRET is not configured')
    }

    const response = {
      ...config,
      status: issues.length === 0 ? 'healthy' : 'degraded',
      issues
    }

    return NextResponse.json(response, { 
      status: issues.length === 0 ? 200 : 200 // Return 200 even with issues for monitoring
    })

  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Configuration check failed'
      },
      { status: 500 }
    )
  }
}
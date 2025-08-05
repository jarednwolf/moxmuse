import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@moxmuse/db'

/**
 * API endpoint for collecting frontend performance metrics
 */

interface PerformanceMetricsPayload {
  webVitals: Array<{
    name: string
    value: number
    rating: string
    delta: number
    id: string
    navigationType: string
  }>
  resources: Array<{
    name: string
    type: string
    size: number
    duration: number
    startTime: number
    transferSize: number
    encodedBodySize: number
    decodedBodySize: number
  }>
  navigation: Array<{
    type: string
    duration: number
    domContentLoaded: number
    loadComplete: number
    firstPaint: number
    firstContentfulPaint: number
    largestContentfulPaint?: number
  }>
  userInteractions: Array<{
    type: string
    target: string
    duration: number
    timestamp: number
    metadata?: Record<string, any>
  }>
  memory: Array<{
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
    timestamp: number
  }>
  network: Array<{
    effectiveType: string
    downlink: number
    rtt: number
    saveData: boolean
    timestamp: number
  }>
  timestamp: string
  url: string
  userAgent: string
}

export async function POST(request: NextRequest) {
  try {
    const payload: PerformanceMetricsPayload = await request.json()
    
    // Extract user ID from session if available
    const userId = request.headers.get('x-user-id') || undefined
    
    // Process Web Vitals metrics
    const webVitalPromises = payload.webVitals.map(metric => 
      prisma.performanceMetric.create({
        data: {
          operation: `web_vital_${metric.name.toLowerCase()}`,
          duration: Math.round(metric.value),
          success: metric.rating !== 'poor',
          timestamp: new Date(payload.timestamp),
          userId,
          metadata: {
            metricType: 'web_vital',
            name: metric.name,
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id,
            navigationType: metric.navigationType,
            url: payload.url,
            userAgent: payload.userAgent
          }
        }
      })
    )

    // Process Resource metrics
    const resourcePromises = payload.resources
      .filter(resource => resource.duration > 0) // Only store meaningful metrics
      .slice(0, 50) // Limit to prevent spam
      .map(resource => 
        prisma.performanceMetric.create({
          data: {
            operation: `resource_${resource.type}`,
            duration: Math.round(resource.duration),
            success: resource.duration < 3000, // Consider < 3s as success
            timestamp: new Date(payload.timestamp),
            userId,
            metadata: {
              metricType: 'resource',
              name: resource.name,
              type: resource.type,
              size: resource.size,
              transferSize: resource.transferSize,
              encodedBodySize: resource.encodedBodySize,
              decodedBodySize: resource.decodedBodySize,
              startTime: resource.startTime,
              url: payload.url
            }
          }
        })
      )

    // Process Navigation metrics
    const navigationPromises = payload.navigation.map(nav => 
      prisma.performanceMetric.create({
        data: {
          operation: `navigation_${nav.type}`,
          duration: Math.round(nav.duration),
          success: nav.duration < 5000, // Consider < 5s as success
          timestamp: new Date(payload.timestamp),
          userId,
          metadata: {
            metricType: 'navigation',
            type: nav.type,
            domContentLoaded: nav.domContentLoaded,
            loadComplete: nav.loadComplete,
            firstPaint: nav.firstPaint,
            firstContentfulPaint: nav.firstContentfulPaint,
            largestContentfulPaint: nav.largestContentfulPaint,
            url: payload.url
          }
        }
      })
    )

    // Process User Interaction metrics (sample to prevent spam)
    const interactionPromises = payload.userInteractions
      .filter((_, index) => index % 10 === 0) // Sample every 10th interaction
      .slice(0, 20) // Limit to 20 interactions
      .map(interaction => 
        prisma.performanceMetric.create({
          data: {
            operation: `interaction_${interaction.type}`,
            duration: Math.round(interaction.duration),
            success: true,
            timestamp: new Date(payload.timestamp),
            userId,
            metadata: {
              metricType: 'user_interaction',
              type: interaction.type,
              target: interaction.target,
              interactionTimestamp: interaction.timestamp,
              ...interaction.metadata,
              url: payload.url
            }
          }
        })
      )

    // Process Memory metrics
    const memoryPromises = payload.memory.map(memory => {
      const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      
      return prisma.performanceMetric.create({
        data: {
          operation: 'memory_usage',
          duration: Math.round(usagePercentage), // Store as percentage
          success: usagePercentage < 80, // Consider < 80% as success
          timestamp: new Date(payload.timestamp),
          userId,
          metadata: {
            metricType: 'memory',
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            usagePercentage,
            memoryTimestamp: memory.timestamp,
            url: payload.url
          }
        }
      })
    })

    // Process Network metrics
    const networkPromises = payload.network.map(network => 
      prisma.performanceMetric.create({
        data: {
          operation: 'network_quality',
          duration: Math.round(network.rtt), // Use RTT as duration
          success: network.effectiveType !== 'slow-2g',
          timestamp: new Date(payload.timestamp),
          userId,
          metadata: {
            metricType: 'network',
            effectiveType: network.effectiveType,
            downlink: network.downlink,
            rtt: network.rtt,
            saveData: network.saveData,
            networkTimestamp: network.timestamp,
            url: payload.url
          }
        }
      })
    )

    // Execute all database operations
    await Promise.all([
      ...webVitalPromises,
      ...resourcePromises,
      ...navigationPromises,
      ...interactionPromises,
      ...memoryPromises,
      ...networkPromises
    ])

    // Calculate summary statistics
    const totalMetrics = webVitalPromises.length + 
                        resourcePromises.length + 
                        navigationPromises.length + 
                        interactionPromises.length + 
                        memoryPromises.length + 
                        networkPromises.length

    console.log(`📊 Stored ${totalMetrics} performance metrics from ${payload.url}`)

    return NextResponse.json({ 
      success: true, 
      metricsStored: totalMetrics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to store performance metrics:', error)
    
    // Store the error as a metric
    try {
      await prisma.performanceMetric.create({
        data: {
          operation: 'metrics_collection_error',
          duration: 0,
          success: false,
          timestamp: new Date(),
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          }
        }
      })
    } catch (dbError) {
      console.error('Failed to store error metric:', dbError)
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to store performance metrics',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || 'hour'
    const metricType = url.searchParams.get('type')
    
    const timeRangeMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000
    }[timeRange] || 60 * 60 * 1000

    const since = new Date(Date.now() - timeRangeMs)

    // Build query filters
    const where: any = {
      timestamp: { gte: since }
    }

    if (metricType) {
      where.operation = { contains: metricType }
    }

    // Get metrics
    const metrics = await prisma.performanceMetric.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 1000 // Limit results
    })

    // Calculate summary statistics
    const summary = {
      totalMetrics: metrics.length,
      successRate: metrics.length > 0
        ? (metrics.filter((m: any) => m.success).length / metrics.length) * 100
        : 0,
      avgDuration: metrics.length > 0
        ? metrics.reduce((sum: number, m: any) => sum + m.duration, 0) / metrics.length
        : 0,
      timeRange,
      since: since.toISOString()
    }

    // Group by operation type
    const byOperation = metrics.reduce((acc: any, metric: any) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = {
          count: 0,
          avgDuration: 0,
          successRate: 0,
          durations: []
        }
      }
      
      acc[metric.operation].count++
      acc[metric.operation].durations.push(metric.duration)
      
      return acc
    }, {} as Record<string, any>)

    // Calculate statistics for each operation
    Object.keys(byOperation).forEach(operation => {
      const op = byOperation[operation]
      const successCount = metrics.filter((m: any) => m.operation === operation && m.success).length
      
      op.avgDuration = op.durations.reduce((a: number, b: number) => a + b, 0) / op.durations.length
      op.successRate = (successCount / op.count) * 100
      op.p95Duration = op.durations.sort((a: number, b: number) => a - b)[Math.floor(op.durations.length * 0.95)] || 0
      
      delete op.durations // Remove raw data
    })

    return NextResponse.json({
      success: true,
      summary,
      byOperation,
      sampleMetrics: metrics.slice(0, 10) // Include sample for debugging
    })

  } catch (error) {
    console.error('Failed to retrieve performance metrics:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve performance metrics' 
      },
      { status: 500 }
    )
  }
}
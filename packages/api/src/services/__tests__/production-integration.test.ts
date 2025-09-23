import { describe, it, expect, beforeAll } from 'vitest'
import { healthCheckService } from '../health/HealthCheckService'
import { metricsService } from '../monitoring/MetricsService'

describe('Production Infrastructure Integration', () => {
  beforeAll(async () => {
    // Give services time to initialize
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  it('should have health check service initialized', () => {
    const services = healthCheckService.getRegisteredServices()
    expect(services.length).toBeGreaterThan(0)
    expect(services).toContain('database')
    expect(services).toContain('memory')
    expect(services).toContain('filesystem')
  })

  it('should record and retrieve metrics', () => {
    const testMetric = {
      name: 'test_integration_metric',
      value: 42,
      unit: 'count' as const,
      tags: { test: 'integration' },
    }

    metricsService.recordMetric(testMetric)
    
    const metrics = metricsService.getMetrics('test_integration_metric', 1)
    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      name: 'test_integration_metric',
      value: 42,
      unit: 'count',
      tags: { test: 'integration' },
    })
  })

  it('should provide system metrics', () => {
    const systemMetrics = metricsService.getSystemMetrics()
    
    expect(systemMetrics).toHaveProperty('responseTime')
    expect(systemMetrics).toHaveProperty('throughput')
    expect(systemMetrics).toHaveProperty('errorRate')
    expect(systemMetrics).toHaveProperty('memoryUsage')
    expect(systemMetrics).toHaveProperty('timestamp')
    expect(systemMetrics.timestamp).toBeInstanceOf(Date)
  })

  it('should calculate average metrics correctly', () => {
    const metricName = 'test_average_metric'
    
    // Record multiple metrics
    metricsService.recordMetric({ name: metricName, value: 10 })
    metricsService.recordMetric({ name: metricName, value: 20 })
    metricsService.recordMetric({ name: metricName, value: 30 })
    
    const average = metricsService.getAverageMetric(metricName, 1)
    expect(average).toBe(20)
  })

  it('should handle health check registration', async () => {
    const testChecker = {
      name: 'integration-test-service',
      check: async () => ({
        name: 'integration-test-service',
        status: 'healthy' as const,
        lastCheck: new Date(),
        responseTime: 50,
      }),
    }

    healthCheckService.registerChecker(testChecker)
    
    const result = await healthCheckService.checkService('integration-test-service')
    expect(result).toMatchObject({
      name: 'integration-test-service',
      status: 'healthy',
      responseTime: 50,
    })
  })

  it('should provide comprehensive health status', async () => {
    const healthResult = await healthCheckService.checkHealth()
    
    expect(healthResult).toHaveProperty('status')
    expect(healthResult).toHaveProperty('timestamp')
    expect(healthResult).toHaveProperty('services')
    expect(healthResult).toHaveProperty('summary')
    expect(healthResult).toHaveProperty('uptime')
    expect(healthResult).toHaveProperty('version')
    
    expect(healthResult.summary).toHaveProperty('total')
    expect(healthResult.summary).toHaveProperty('healthy')
    expect(healthResult.summary).toHaveProperty('degraded')
    expect(healthResult.summary).toHaveProperty('unhealthy')
    
    expect(Array.isArray(healthResult.services)).toBe(true)
    expect(healthResult.services.length).toBeGreaterThan(0)
  })
})
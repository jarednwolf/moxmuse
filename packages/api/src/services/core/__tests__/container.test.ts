/**
 * Tests for Dependency Injection Container
 */

import { DIContainer, createServiceToken } from '../container'
import { BaseService, ServiceHealthStatus, Logger } from '../interfaces'
import { StructuredLogger, DEFAULT_LOGGER_CONFIG } from '../logging'

// Mock service for testing
class MockService implements BaseService {
  readonly name = 'MockService'
  readonly version = '1.0.0'
  private initialized = false

  async initialize(): Promise<void> {
    this.initialized = true
  }

  async shutdown(): Promise<void> {
    this.initialized = false
  }

  async healthCheck(): Promise<ServiceHealthStatus> {
    return {
      status: this.initialized ? 'healthy' : 'unhealthy',
      timestamp: new Date()
    }
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

class DependentService implements BaseService {
  readonly name = 'DependentService'
  readonly version = '1.0.0'

  constructor(private dependency: MockService) {}

  async initialize(): Promise<void> {
    // Service depends on MockService being initialized
  }

  async shutdown(): Promise<void> {
    // Cleanup
  }

  async healthCheck(): Promise<ServiceHealthStatus> {
    return {
      status: 'healthy',
      timestamp: new Date()
    }
  }

  getDependency(): MockService {
    return this.dependency
  }
}

describe('DIContainer', () => {
  let container: DIContainer
  let logger: Logger

  beforeEach(() => {
    logger = new StructuredLogger(DEFAULT_LOGGER_CONFIG)
    container = new DIContainer(logger)
  })

  afterEach(async () => {
    await container.stop()
  })

  describe('Service Registration and Resolution', () => {
    it('should register and resolve a service', async () => {
      const token = createServiceToken('MockService', MockService)
      
      container.register(token, async () => new MockService())
      
      const service = await container.resolve(token)
      expect(service).toBeInstanceOf(MockService)
      expect(service.name).toBe('MockService')
    })

    it('should return the same instance for singleton services', async () => {
      const token = createServiceToken('MockService', MockService)
      
      container.register(token, async () => new MockService(), { singleton: true })
      
      const service1 = await container.resolve(token)
      const service2 = await container.resolve(token)
      
      expect(service1).toBe(service2)
    })

    it('should return different instances for non-singleton services', async () => {
      const token = createServiceToken('MockService', MockService)
      
      container.register(token, async () => new MockService(), { singleton: false })
      
      const service1 = await container.resolve(token)
      const service2 = await container.resolve(token)
      
      expect(service1).not.toBe(service2)
    })

    it('should throw error for unregistered service', async () => {
      const token = createServiceToken('UnregisteredService', MockService)
      
      await expect(container.resolve(token)).rejects.toThrow('Service not registered: UnregisteredService')
    })
  })

  describe('Dependency Resolution', () => {
    it('should resolve service dependencies', async () => {
      const mockToken = createServiceToken('MockService', MockService)
      const dependentToken = createServiceToken('DependentService', DependentService)
      
      container.register(mockToken, async () => new MockService())
      container.register(
        dependentToken,
        async () => {
          const dependency = await container.resolve(mockToken)
          return new DependentService(dependency)
        },
        { dependencies: [mockToken] }
      )
      
      const service = await container.resolve(dependentToken)
      expect(service).toBeInstanceOf(DependentService)
      expect(service.getDependency()).toBeInstanceOf(MockService)
    })

    it('should detect circular dependencies', async () => {
      const token1 = createServiceToken('Service1', MockService)
      const token2 = createServiceToken('Service2', MockService)
      
      container.register(token1, async () => {
        await container.resolve(token2)
        return new MockService()
      }, { dependencies: [token2] })
      
      container.register(token2, async () => {
        await container.resolve(token1)
        return new MockService()
      }, { dependencies: [token1] })
      
      await expect(container.resolve(token1)).rejects.toThrow('Circular dependency detected')
    })
  })

  describe('Container Lifecycle', () => {
    it('should initialize services when started', async () => {
      const token = createServiceToken('MockService', MockService)
      const mockService = new MockService()
      
      container.register(token, async () => mockService, { lazy: false })
      
      await container.start()
      
      expect(mockService.isInitialized()).toBe(true)
    })

    it('should shutdown services when stopped', async () => {
      const token = createServiceToken('MockService', MockService)
      const mockService = new MockService()
      
      container.register(token, async () => mockService, { lazy: false })
      
      await container.start()
      expect(mockService.isInitialized()).toBe(true)
      
      await container.stop()
      expect(mockService.isInitialized()).toBe(false)
    })

    it('should provide health status for all services', async () => {
      const token = createServiceToken('MockService', MockService)
      
      container.register(token, async () => new MockService(), { lazy: false })
      
      await container.start()
      
      const healthStatus = await container.getHealthStatus()
      expect(healthStatus).toHaveProperty('MockService')
      expect(healthStatus.MockService.status).toBe('healthy')
    })
  })

  describe('Service Unregistration', () => {
    it('should unregister a service', async () => {
      const token = createServiceToken('MockService', MockService)
      
      container.register(token, async () => new MockService())
      
      // Verify service is registered
      const service = await container.resolve(token)
      expect(service).toBeInstanceOf(MockService)
      
      // Unregister service
      container.unregister(token)
      
      // Verify service is no longer available
      await expect(container.resolve(token)).rejects.toThrow('Service not registered: MockService')
    })
  })
})
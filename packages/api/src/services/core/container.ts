/**
 * Dependency Injection Container Implementation
 * 
 * Provides service registration, resolution, and lifecycle management
 * with support for singleton patterns, lazy loading, and dependency resolution.
 */

import {
  ServiceContainer,
  ServiceToken,
  ServiceFactory,
  ServiceRegistrationOptions,
  BaseService,
  ServiceHealthStatus,
  Logger
} from './interfaces'

interface ServiceRegistration<T extends BaseService> {
  factory: ServiceFactory<T>
  options: ServiceRegistrationOptions
  instance?: T
  dependencies: ServiceToken<any>[]
}

export class DIContainer implements ServiceContainer {
  private services = new Map<string, ServiceRegistration<any>>()
  private instances = new Map<string, BaseService>()
  private logger: Logger
  private isStarted = false

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'DIContainer' })
  }

  register<T extends BaseService>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options: ServiceRegistrationOptions = {}
  ): void {
    const registration: ServiceRegistration<T> = {
      factory,
      options: {
        singleton: true,
        lazy: false,
        dependencies: [],
        ...options
      },
      dependencies: options.dependencies || []
    }

    this.services.set(token.name, registration)
    this.logger.debug(`Registered service: ${token.name}`, {
      singleton: registration.options.singleton,
      lazy: registration.options.lazy,
      dependencies: registration.dependencies.map(dep => dep.name)
    })
  }

  async resolve<T extends BaseService>(token: ServiceToken<T>): Promise<T> {
    const registration = this.services.get(token.name)
    if (!registration) {
      throw new Error(`Service not registered: ${token.name}`)
    }

    // Return existing instance if singleton
    if (registration.options.singleton && registration.instance) {
      return registration.instance as T
    }

    // Check for circular dependencies
    const resolutionStack = new Set<string>()
    await this.checkCircularDependencies(token.name, resolutionStack)

    // Resolve dependencies first
    const dependencies = await this.resolveDependencies(registration.dependencies)

    // Create instance
    const instance = await registration.factory()
    
    // Initialize if container is started
    if (this.isStarted) {
      await instance.initialize()
    }

    // Store instance if singleton
    if (registration.options.singleton) {
      registration.instance = instance
      this.instances.set(token.name, instance)
    }

    this.logger.debug(`Resolved service: ${token.name}`)
    return instance as T
  }

  unregister<T extends BaseService>(token: ServiceToken<T>): void {
    const registration = this.services.get(token.name)
    if (registration && registration.instance) {
      // Shutdown instance if it exists
      registration.instance.shutdown().catch((error: any) => {
        this.logger.error(`Error shutting down service ${token.name}`, error)
      })
    }

    this.services.delete(token.name)
    this.instances.delete(token.name)
    this.logger.debug(`Unregistered service: ${token.name}`)
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      return
    }

    this.logger.info('Starting service container')

    // Initialize all non-lazy services
    const initPromises: Promise<void>[] = []
    
    for (const [name, registration] of Array.from(this.services.entries())) {
      if (!registration.options.lazy) {
        initPromises.push(
          this.initializeService(name, registration).catch(error => {
            this.logger.error(`Failed to initialize service ${name}`, error)
            throw error
          })
        )
      }
    }

    await Promise.all(initPromises)
    this.isStarted = true
    this.logger.info('Service container started successfully')
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return
    }

    this.logger.info('Stopping service container')

    // Shutdown all instances in reverse order
    const shutdownPromises: Promise<void>[] = []
    const instances = Array.from(this.instances.entries()).reverse()

    for (const [name, instance] of instances) {
      shutdownPromises.push(
        instance.shutdown().catch(error => {
          this.logger.error(`Error shutting down service ${name}`, error)
        })
      )
    }

    await Promise.all(shutdownPromises)
    this.instances.clear()
    this.isStarted = false
    this.logger.info('Service container stopped')
  }

  async getHealthStatus(): Promise<Record<string, ServiceHealthStatus>> {
    const healthStatuses: Record<string, ServiceHealthStatus> = {}

    const healthPromises = Array.from(this.instances.entries()).map(
      async ([name, instance]) => {
        try {
          const status = await instance.healthCheck()
          healthStatuses[name] = status
        } catch (error) {
          healthStatuses[name] = {
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          }
        }
      }
    )

    await Promise.all(healthPromises)
    return healthStatuses
  }

  private async initializeService(
    name: string,
    registration: ServiceRegistration<any>
  ): Promise<void> {
    if (registration.instance) {
      return
    }

    // Resolve dependencies
    const dependencies = await this.resolveDependencies(registration.dependencies)

    // Create and initialize instance
    const instance = await registration.factory()
    await instance.initialize()

    registration.instance = instance
    this.instances.set(name, instance)
  }

  private async resolveDependencies(
    dependencies: ServiceToken<any>[]
  ): Promise<BaseService[]> {
    const resolved: BaseService[] = []

    for (const dependency of dependencies) {
      const instance = await this.resolve(dependency)
      resolved.push(instance)
    }

    return resolved
  }

  private async checkCircularDependencies(
    serviceName: string,
    resolutionStack: Set<string>
  ): Promise<void> {
    if (resolutionStack.has(serviceName)) {
      const cycle = Array.from(resolutionStack).join(' -> ') + ' -> ' + serviceName
      throw new Error(`Circular dependency detected: ${cycle}`)
    }

    resolutionStack.add(serviceName)

    const registration = this.services.get(serviceName)
    if (registration) {
      for (const dependency of registration.dependencies) {
        await this.checkCircularDependencies(dependency.name, new Set(resolutionStack))
      }
    }

    resolutionStack.delete(serviceName)
  }
}

// Service token factory
export function createServiceToken<T extends BaseService>(
  name: string,
  type: new (...args: any[]) => T
): ServiceToken<T> {
  return { name, type }
}

// Common service tokens
export const SERVICE_TOKENS = {
  LOGGER: createServiceToken('Logger', class {} as any),
  CACHE: createServiceToken('CacheService', class {} as any),
  METRICS: createServiceToken('MetricsCollector', class {} as any),
  JOB_PROCESSOR: createServiceToken('JobProcessor', class {} as any),
  ERROR_HANDLER: createServiceToken('ErrorHandler', class {} as any),
  PERFORMANCE_MONITOR: createServiceToken('PerformanceMonitor', class {} as any),
  DECK_ORGANIZATION: createServiceToken('DeckOrganizationService', class {} as any),
  ANALYTICS: createServiceToken('AnalyticsService', class {} as any),
  COMMUNITY: createServiceToken('CommunityService', class {} as any)
} as const

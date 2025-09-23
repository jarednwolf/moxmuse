import { ScalabilityService } from './ScalabilityService';
import { scalabilityConfig, validateScalabilityConfig } from '../../config/scalability';

export class ScalabilityDeployment {
  private scalabilityService: ScalabilityService | null = null;
  private isInitialized = false;

  async initialize(): Promise<ScalabilityService> {
    if (this.isInitialized && this.scalabilityService) {
      return this.scalabilityService;
    }

    // Validate configuration
    const configErrors = validateScalabilityConfig(scalabilityConfig);
    if (configErrors.length > 0) {
      throw new Error(`Scalability configuration errors: ${configErrors.join(', ')}`);
    }

    // Initialize scalability service
    this.scalabilityService = new ScalabilityService(scalabilityConfig);

    // Set up event listeners for monitoring
    this.setupEventListeners();

    // Add initial servers if configured
    await this.addInitialServers();

    // Set up graceful shutdown
    this.setupGracefulShutdown();

    this.isInitialized = true;
    console.log('Scalability services initialized successfully');

    return this.scalabilityService;
  }

  private setupEventListeners(): void {
    if (!this.scalabilityService) return;

    // Server events
    this.scalabilityService.on('serverAdded', (server) => {
      console.log(`Server added: ${server.id} (${server.url})`);
    });

    this.scalabilityService.on('serverRemoved', (server) => {
      console.log(`Server removed: ${server.id} (${server.url})`);
    });

    // Database events
    this.scalabilityService.on('dbConnectionCreated', (data) => {
      console.log(`Database connection created. Total: ${data.totalConnections}`);
    });

    this.scalabilityService.on('slowQuery', (data) => {
      console.warn(`Slow query detected: ${data.query.substring(0, 100)}... (${data.duration}ms)`);
    });

    // Job processing events
    this.scalabilityService.on('jobCompleted', (data) => {
      console.log(`Job completed: ${data.jobId} in queue ${data.queueName}`);
    });

    this.scalabilityService.on('jobFailed', (data) => {
      console.error(`Job failed: ${data.jobId} in queue ${data.queueName}`, data.error);
    });

    // Auto-scaling events
    this.scalabilityService.on('scalingCompleted', (event) => {
      console.log(`Scaling completed: ${event.targetId} scaled from ${event.fromInstances} to ${event.toInstances} instances`);
    });

    this.scalabilityService.on('scalingFailed', (event) => {
      console.error(`Scaling failed: ${event.targetId}`, event.error);
    });

    // Metrics events
    this.scalabilityService.on('metricsCollected', (metrics) => {
      // Log key metrics periodically
      if (Date.now() % 300000 < 30000) { // Every 5 minutes
        console.log('System metrics:', {
          loadBalancer: {
            totalServers: metrics.loadBalancer.totalServers,
            healthyServers: metrics.loadBalancer.healthyServers,
            averageResponseTime: metrics.loadBalancer.averageResponseTime,
          },
          database: {
            activeConnections: metrics.database.activeConnections,
            totalConnections: metrics.database.totalConnections,
            slowQueries: metrics.database.slowQueries,
          },
          backgroundJobs: {
            totalQueues: metrics.backgroundJobs.totalQueues,
            errorRate: metrics.backgroundJobs.errorRate,
          },
        });
      }
    });

    this.scalabilityService.on('metricsError', (error) => {
      console.error('Metrics collection error:', error);
    });
  }

  private async addInitialServers(): Promise<void> {
    if (!this.scalabilityService) return;

    // Add servers from environment configuration
    const serverUrls = process.env.INITIAL_SERVERS?.split(',') || [];
    
    for (const [index, url] of serverUrls.entries()) {
      if (url.trim()) {
        try {
          await this.scalabilityService.addServer({
            id: `server-${index + 1}`,
            url: url.trim(),
            load: 0,
            responseTime: 0,
            connections: 0,
            maxConnections: parseInt(process.env.MAX_CONNECTIONS_PER_SERVER || '100'),
          });
          console.log(`Added initial server: ${url.trim()}`);
        } catch (error) {
          console.error(`Failed to add initial server ${url.trim()}:`, error);
        }
      }
    }
  }

  private setupGracefulShutdown(): void {
    if (!this.scalabilityService) return;

    const gracefulShutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down scalability services gracefully...`);
      
      try {
        if (this.scalabilityService) {
          await this.scalabilityService.shutdown();
          console.log('Scalability services shut down successfully');
        }
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    services: any;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
  }> {
    if (!this.scalabilityService) {
      return {
        healthy: false,
        services: { error: 'Scalability service not initialized' },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      };
    }

    const health = await this.scalabilityService.healthCheck();
    
    return {
      healthy: health.healthy,
      services: health.services,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };
  }

  async getMetrics() {
    if (!this.scalabilityService) {
      throw new Error('Scalability service not initialized');
    }

    return await this.scalabilityService.getSystemMetrics();
  }

  getService(): ScalabilityService | null {
    return this.scalabilityService;
  }

  isReady(): boolean {
    return this.isInitialized && this.scalabilityService !== null;
  }
}

// Singleton instance for the application
export const scalabilityDeployment = new ScalabilityDeployment();

// Helper function to ensure scalability service is initialized
export async function ensureScalabilityService(): Promise<ScalabilityService> {
  if (!scalabilityDeployment.isReady()) {
    return await scalabilityDeployment.initialize();
  }
  
  const service = scalabilityDeployment.getService();
  if (!service) {
    throw new Error('Scalability service is not available');
  }
  
  return service;
}

// Environment-specific initialization
export async function initializeForEnvironment(): Promise<ScalabilityService> {
  const environment = process.env.NODE_ENV || 'development';
  
  console.log(`Initializing scalability services for ${environment} environment`);
  
  try {
    const service = await scalabilityDeployment.initialize();
    
    // Environment-specific setup
    if (environment === 'production') {
      // Production-specific initialization
      console.log('Production scalability features enabled');
      
      // Set up production monitoring
      setInterval(async () => {
        try {
          const health = await scalabilityDeployment.healthCheck();
          if (!health.healthy) {
            console.error('System health check failed:', health.services);
          }
        } catch (error) {
          console.error('Health check error:', error);
        }
      }, 60000); // Check every minute
      
    } else if (environment === 'development') {
      // Development-specific initialization
      console.log('Development scalability features enabled');
      
      // More verbose logging in development
      service.on('requestStarted', (data) => {
        console.log(`Request started: ${data.method} ${data.path}`);
      });
      
      service.on('requestCompleted', (data) => {
        console.log(`Request completed: ${data.method} ${data.path} (${data.duration}ms)`);
      });
    }
    
    return service;
  } catch (error) {
    console.error('Failed to initialize scalability services:', error);
    throw error;
  }
}

// Export configuration for external use
export { scalabilityConfig } from '../../config/scalability';
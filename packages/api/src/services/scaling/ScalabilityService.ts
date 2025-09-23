import { EventEmitter } from 'events';
import { LoadBalancerService, LoadBalancingStrategy, RoundRobinStrategy } from './LoadBalancerService';
import { DatabaseConnectionPool, ConnectionPoolConfig } from './DatabaseConnectionPool';
import { CDNService, CDNConfig } from './CDNService';
import { BackgroundJobProcessor, JobProcessor } from './BackgroundJobProcessor';
import { AutoScalingService, ScalingTarget, ScalingPolicy } from './AutoScalingService';

export interface ScalabilityConfig {
  loadBalancer: {
    strategy: LoadBalancingStrategy;
    healthCheckInterval: number;
  };
  database: ConnectionPoolConfig;
  cdn: CDNConfig;
  backgroundJobs: {
    redisUrl: string;
    queues: string[];
  };
  autoScaling: {
    enabled: boolean;
    targets: ScalingTarget[];
    policies: ScalingPolicy[];
  };
}

export interface SystemMetrics {
  loadBalancer: {
    totalServers: number;
    healthyServers: number;
    averageLoad: number;
    averageResponseTime: number;
  };
  database: {
    totalConnections: number;
    activeConnections: number;
    averageQueryTime: number;
    slowQueries: number;
  };
  cdn: {
    cacheHitRate: number;
    bandwidthSaved: number;
    averageResponseTime: number;
  };
  backgroundJobs: {
    totalQueues: number;
    totalJobs: number;
    averageProcessingTime: number;
    errorRate: number;
  };
  autoScaling: {
    totalTargets: number;
    scalingEvents: number;
    averageInstances: number;
  };
}

export class ScalabilityService extends EventEmitter {
  private loadBalancer: LoadBalancerService;
  private dbPool: DatabaseConnectionPool;
  private cdn: CDNService;
  private jobProcessor: BackgroundJobProcessor;
  private autoScaling: AutoScalingService;
  private config: ScalabilityConfig;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(config: ScalabilityConfig) {
    super();
    this.config = config;
    
    this.initializeServices();
    this.setupEventListeners();
    this.startMetricsCollection();
  }  private i
nitializeServices(): void {
    // Initialize load balancer
    this.loadBalancer = new LoadBalancerService(this.config.loadBalancer.strategy);

    // Initialize database connection pool
    this.dbPool = new DatabaseConnectionPool(this.config.database);

    // Initialize CDN service
    this.cdn = new CDNService(this.config.cdn);

    // Initialize background job processor
    this.jobProcessor = new BackgroundJobProcessor(this.config.backgroundJobs.redisUrl);

    // Initialize queues
    this.config.backgroundJobs.queues.forEach(queueName => {
      this.jobProcessor.createQueue(queueName);
    });

    // Initialize auto-scaling service
    this.autoScaling = new AutoScalingService();
    
    if (this.config.autoScaling.enabled) {
      this.config.autoScaling.targets.forEach(target => {
        this.autoScaling.addScalingTarget(target);
      });
      
      this.config.autoScaling.policies.forEach(policy => {
        this.autoScaling.addScalingPolicy(policy);
      });
    }
  }

  private setupEventListeners(): void {
    // Load balancer events
    this.loadBalancer.on('serverAdded', (server) => {
      this.emit('serverAdded', server);
    });

    this.loadBalancer.on('serverRemoved', (server) => {
      this.emit('serverRemoved', server);
    });

    // Database events
    this.dbPool.on('connectionCreated', (data) => {
      this.emit('dbConnectionCreated', data);
    });

    this.dbPool.on('slowQuery', (data) => {
      this.emit('slowQuery', data);
    });

    // Job processor events
    this.jobProcessor.on('jobCompleted', (data) => {
      this.emit('jobCompleted', data);
    });

    this.jobProcessor.on('jobFailed', (data) => {
      this.emit('jobFailed', data);
    });

    // Auto-scaling events
    this.autoScaling.on('scalingCompleted', (event) => {
      this.emit('scalingCompleted', event);
    });

    this.autoScaling.on('scalingFailed', (event) => {
      this.emit('scalingFailed', event);
    });
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      await this.collectAndEmitMetrics();
    }, 30000); // Collect every 30 seconds
  }

  private async collectAndEmitMetrics(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics();
      this.emit('metricsCollected', metrics);
    } catch (error) {
      this.emit('metricsError', error);
    }
  }

  // Public API methods
  async addServer(server: { id: string; url: string; load: number; responseTime: number; connections: number; maxConnections: number }): Promise<void> {
    this.loadBalancer.addServer(server);
  }

  async removeServer(serverId: string): Promise<void> {
    this.loadBalancer.removeServer(serverId);
  }

  async executeQuery<T = any>(query: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    return await this.dbPool.query(query, params);
  }

  async addBackgroundJob(queueName: string, jobData: any): Promise<void> {
    await this.jobProcessor.addJob(queueName, jobData);
  }

  async registerJobProcessor(queueName: string, processor: JobProcessor): Promise<void> {
    this.jobProcessor.createWorker(queueName, processor);
  }

  async optimizeImage(url: string, options: any): Promise<string> {
    return this.cdn.optimizeImageUrl(url, options);
  }

  async purgeCache(paths: string[] | 'all'): Promise<void> {
    await this.cdn.purgeCache(paths);
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const [
      lbStats,
      dbMetrics,
      cdnMetrics,
      jobMetrics,
      scalingTargets
    ] = await Promise.all([
      this.loadBalancer.getServerStats(),
      this.dbPool.getMetrics(),
      this.cdn.getMetrics(),
      this.jobProcessor.getAllQueueMetrics(),
      this.autoScaling.getAllTargets()
    ]);

    return {
      loadBalancer: {
        totalServers: lbStats.total,
        healthyServers: lbStats.healthy,
        averageLoad: lbStats.averageLoad,
        averageResponseTime: lbStats.averageResponseTime,
      },
      database: {
        totalConnections: dbMetrics.totalConnections,
        activeConnections: dbMetrics.activeConnections,
        averageQueryTime: dbMetrics.averageQueryTime,
        slowQueries: dbMetrics.slowQueries,
      },
      cdn: {
        cacheHitRate: cdnMetrics.cacheHitRate,
        bandwidthSaved: cdnMetrics.bandwidthSaved,
        averageResponseTime: cdnMetrics.averageResponseTime,
      },
      backgroundJobs: {
        totalQueues: jobMetrics.size,
        totalJobs: Array.from(jobMetrics.values()).reduce((sum, m) => sum + m.totalProcessed, 0),
        averageProcessingTime: Array.from(jobMetrics.values()).reduce((sum, m) => sum + m.averageProcessingTime, 0) / jobMetrics.size,
        errorRate: Array.from(jobMetrics.values()).reduce((sum, m) => sum + m.errorRate, 0) / jobMetrics.size,
      },
      autoScaling: {
        totalTargets: scalingTargets.length,
        scalingEvents: 0, // Would need to track this
        averageInstances: scalingTargets.reduce((sum, t) => sum + t.currentInstances, 0) / scalingTargets.length,
      },
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    services: {
      loadBalancer: { healthy: boolean; issues: string[] };
      database: { healthy: boolean; issues: string[] };
      backgroundJobs: { healthy: boolean; issues: string[] };
      autoScaling: { healthy: boolean; issues: string[] };
    };
  }> {
    const [dbHealth, jobHealth, scalingHealth] = await Promise.all([
      this.dbPool.healthCheck(),
      this.jobProcessor.healthCheck(),
      this.autoScaling.healthCheck(),
    ]);

    const lbStats = this.loadBalancer.getServerStats();
    const lbHealthy = lbStats.healthy > 0;

    return {
      healthy: dbHealth.healthy && jobHealth.healthy && scalingHealth.healthy && lbHealthy,
      services: {
        loadBalancer: {
          healthy: lbHealthy,
          issues: lbHealthy ? [] : ['No healthy servers available'],
        },
        database: {
          healthy: dbHealth.healthy,
          issues: dbHealth.issues,
        },
        backgroundJobs: {
          healthy: jobHealth.healthy,
          issues: jobHealth.queues.flatMap(q => q.issues),
        },
        autoScaling: {
          healthy: scalingHealth.healthy,
          issues: scalingHealth.targets.flatMap(t => t.issues),
        },
      },
    };
  }

  async shutdown(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    await Promise.all([
      this.dbPool.destroy(),
      this.jobProcessor.shutdown(),
    ]);

    this.autoScaling.destroy();
    this.loadBalancer.destroy();

    this.emit('shutdown');
  }
}
import { EventEmitter } from 'events';

export interface ServerInstance {
  id: string;
  url: string;
  health: 'healthy' | 'unhealthy' | 'degraded';
  load: number; // 0-1 scale
  responseTime: number;
  lastHealthCheck: Date;
  connections: number;
  maxConnections: number;
}

export interface LoadBalancingStrategy {
  selectServer(servers: ServerInstance[], request?: any): ServerInstance | null;
}

export class RoundRobinStrategy implements LoadBalancingStrategy {
  private currentIndex = 0;

  selectServer(servers: ServerInstance[]): ServerInstance | null {
    const healthyServers = servers.filter(s => s.health === 'healthy');
    if (healthyServers.length === 0) return null;

    const server = healthyServers[this.currentIndex % healthyServers.length];
    this.currentIndex = (this.currentIndex + 1) % healthyServers.length;
    return server;
  }
}

export class LeastConnectionsStrategy implements LoadBalancingStrategy {
  selectServer(servers: ServerInstance[]): ServerInstance | null {
    const healthyServers = servers.filter(s => s.health === 'healthy');
    if (healthyServers.length === 0) return null;

    return healthyServers.reduce((least, current) => 
      current.connections < least.connections ? current : least
    );
  }
}

export class WeightedResponseTimeStrategy implements LoadBalancingStrategy {
  selectServer(servers: ServerInstance[]): ServerInstance | null {
    const healthyServers = servers.filter(s => s.health === 'healthy');
    if (healthyServers.length === 0) return null;

    // Select server with lowest response time and available capacity
    return healthyServers
      .filter(s => s.connections < s.maxConnections * 0.9) // 90% capacity threshold
      .sort((a, b) => a.responseTime - b.responseTime)[0] || healthyServers[0];
  }
}

export class LoadBalancerService extends EventEmitter {
  private servers: Map<string, ServerInstance> = new Map();
  private strategy: LoadBalancingStrategy;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(strategy: LoadBalancingStrategy = new RoundRobinStrategy()) {
    super();
    this.strategy = strategy;
    this.startHealthChecks();
  }

  addServer(server: Omit<ServerInstance, 'health' | 'lastHealthCheck'>): void {
    const serverInstance: ServerInstance = {
      ...server,
      health: 'healthy',
      lastHealthCheck: new Date(),
    };

    this.servers.set(server.id, serverInstance);
    this.emit('serverAdded', serverInstance);
  }

  removeServer(serverId: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      this.servers.delete(serverId);
      this.emit('serverRemoved', server);
    }
  }

  selectServer(request?: any): ServerInstance | null {
    const servers = Array.from(this.servers.values());
    return this.strategy.selectServer(servers, request);
  }

  updateServerMetrics(serverId: string, metrics: Partial<ServerInstance>): void {
    const server = this.servers.get(serverId);
    if (server) {
      Object.assign(server, metrics);
      this.emit('serverUpdated', server);
    }
  }

  getServerStats(): {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
    averageLoad: number;
    averageResponseTime: number;
  } {
    const servers = Array.from(this.servers.values());
    
    return {
      total: servers.length,
      healthy: servers.filter(s => s.health === 'healthy').length,
      unhealthy: servers.filter(s => s.health === 'unhealthy').length,
      degraded: servers.filter(s => s.health === 'degraded').length,
      averageLoad: servers.reduce((sum, s) => sum + s.load, 0) / servers.length || 0,
      averageResponseTime: servers.reduce((sum, s) => sum + s.responseTime, 0) / servers.length || 0,
    };
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.servers.values()).map(async (server) => {
      try {
        const startTime = Date.now();
        const response = await fetch(`${server.url}/health`, {
          method: 'GET',
          timeout: 5000,
        });

        const responseTime = Date.now() - startTime;
        const isHealthy = response.ok && responseTime < 2000;

        this.updateServerMetrics(server.id, {
          health: isHealthy ? 'healthy' : 'degraded',
          responseTime,
          lastHealthCheck: new Date(),
        });

      } catch (error) {
        this.updateServerMetrics(server.id, {
          health: 'unhealthy',
          lastHealthCheck: new Date(),
        });
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}
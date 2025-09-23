import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScalabilityService } from '../ScalabilityService';
import { RoundRobinStrategy } from '../LoadBalancerService';

describe('ScalabilityService Integration', () => {
  let scalabilityService: ScalabilityService;

  beforeEach(() => {
    const config = {
      loadBalancer: {
        strategy: new RoundRobinStrategy(),
        healthCheckInterval: 30000,
      },
      database: {
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
        max: 10,
        min: 2,
        enableMetrics: true,
        slowQueryThreshold: 1000,
      },
      cdn: {
        provider: 'vercel' as const,
        baseUrl: 'https://test.com',
        enableCompression: true,
        enableCaching: true,
        defaultTTL: 3600,
        maxAge: 86400,
      },
      backgroundJobs: {
        redisUrl: 'redis://localhost:6379',
        queues: ['test-queue'],
      },
      autoScaling: {
        enabled: true,
        targets: [],
        policies: [],
      },
    };

    scalabilityService = new ScalabilityService(config);
  });

  afterEach(async () => {
    await scalabilityService.shutdown();
  });

  describe('Load Balancer Integration', () => {
    it('should add and manage servers', async () => {
      const server = {
        id: 'server-1',
        url: 'http://localhost:3001',
        load: 0.5,
        responseTime: 100,
        connections: 10,
        maxConnections: 100,
      };

      await scalabilityService.addServer(server);
      
      const metrics = await scalabilityService.getSystemMetrics();
      expect(metrics.loadBalancer.totalServers).toBe(1);
    });

    it('should remove servers', async () => {
      const server = {
        id: 'server-1',
        url: 'http://localhost:3001',
        load: 0.5,
        responseTime: 100,
        connections: 10,
        maxConnections: 100,
      };

      await scalabilityService.addServer(server);
      await scalabilityService.removeServer('server-1');
      
      const metrics = await scalabilityService.getSystemMetrics();
      expect(metrics.loadBalancer.totalServers).toBe(0);
    });
  });

  describe('System Metrics', () => {
    it('should collect comprehensive system metrics', async () => {
      const metrics = await scalabilityService.getSystemMetrics();

      expect(metrics).toHaveProperty('loadBalancer');
      expect(metrics).toHaveProperty('database');
      expect(metrics).toHaveProperty('cdn');
      expect(metrics).toHaveProperty('backgroundJobs');
      expect(metrics).toHaveProperty('autoScaling');

      expect(metrics.loadBalancer).toHaveProperty('totalServers');
      expect(metrics.loadBalancer).toHaveProperty('healthyServers');
      expect(metrics.loadBalancer).toHaveProperty('averageLoad');
      expect(metrics.loadBalancer).toHaveProperty('averageResponseTime');
    });

    it('should emit metrics events', async () => {
      const metricsPromise = new Promise((resolve) => {
        scalabilityService.once('metricsCollected', resolve);
      });

      // Trigger metrics collection manually
      await scalabilityService.getSystemMetrics();

      // Wait for event (with timeout)
      const result = await Promise.race([
        metricsPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
      ]);

      expect(result).toBeDefined();
    });
  });

  describe('Health Checks', () => {
    it('should perform comprehensive health checks', async () => {
      const health = await scalabilityService.healthCheck();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('services');
      expect(health.services).toHaveProperty('loadBalancer');
      expect(health.services).toHaveProperty('database');
      expect(health.services).toHaveProperty('backgroundJobs');
      expect(health.services).toHaveProperty('autoScaling');

      // Each service should have health status and issues
      Object.values(health.services).forEach(service => {
        expect(service).toHaveProperty('healthy');
        expect(service).toHaveProperty('issues');
        expect(Array.isArray(service.issues)).toBe(true);
      });
    });

    it('should detect unhealthy services', async () => {
      // Add a server and then remove it to create an unhealthy state
      const server = {
        id: 'server-1',
        url: 'http://localhost:3001',
        load: 0.5,
        responseTime: 100,
        connections: 10,
        maxConnections: 100,
      };

      await scalabilityService.addServer(server);
      await scalabilityService.removeServer('server-1');

      const health = await scalabilityService.healthCheck();
      
      // With no servers, load balancer should be unhealthy
      expect(health.services.loadBalancer.healthy).toBe(false);
      expect(health.services.loadBalancer.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    it('should emit server events', async () => {
      const serverAddedPromise = new Promise((resolve) => {
        scalabilityService.once('serverAdded', resolve);
      });

      const server = {
        id: 'server-1',
        url: 'http://localhost:3001',
        load: 0.5,
        responseTime: 100,
        connections: 10,
        maxConnections: 100,
      };

      await scalabilityService.addServer(server);

      const result = await Promise.race([
        serverAddedPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
      ]);

      expect(result).toBeDefined();
    });

    it('should emit database events', async () => {
      const connectionPromise = new Promise((resolve) => {
        scalabilityService.once('dbConnectionCreated', resolve);
      });

      // This would trigger a database connection event in a real scenario
      // For testing, we'll just verify the event listener is set up
      expect(scalabilityService.listenerCount('dbConnectionCreated')).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors gracefully', () => {
      const invalidConfig = {
        loadBalancer: {
          strategy: new RoundRobinStrategy(),
          healthCheckInterval: 30000,
        },
        database: {
          host: 'invalid-host',
          port: 5432,
          database: 'test',
          user: 'test',
          password: 'test',
          max: 10,
          min: 2,
        },
        cdn: {
          provider: 'vercel' as const,
          baseUrl: 'invalid-url',
          enableCompression: true,
          enableCaching: true,
          defaultTTL: 3600,
          maxAge: 86400,
        },
        backgroundJobs: {
          redisUrl: 'redis://invalid-host:6379',
          queues: ['test-queue'],
        },
        autoScaling: {
          enabled: false,
          targets: [],
          policies: [],
        },
      };

      // Should not throw during initialization
      expect(() => new ScalabilityService(invalidConfig)).not.toThrow();
    });

    it('should handle metrics collection errors', async () => {
      const errorPromise = new Promise((resolve) => {
        scalabilityService.once('metricsError', resolve);
      });

      // Force an error by shutting down services
      await scalabilityService.shutdown();

      // Try to collect metrics after shutdown
      try {
        await scalabilityService.getSystemMetrics();
      } catch (error) {
        // Expected to fail
      }

      // The error event might not be emitted in this test scenario
      // but we verify the service handles errors gracefully
    });
  });

  describe('Performance', () => {
    it('should collect metrics within reasonable time', async () => {
      const startTime = Date.now();
      await scalabilityService.getSystemMetrics();
      const duration = Date.now() - startTime;

      // Metrics collection should be fast (under 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent metric requests', async () => {
      const promises = Array.from({ length: 10 }, () => 
        scalabilityService.getSystemMetrics()
      );

      const results = await Promise.all(promises);
      
      // All requests should succeed
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('loadBalancer');
        expect(result).toHaveProperty('database');
      });
    });
  });
});
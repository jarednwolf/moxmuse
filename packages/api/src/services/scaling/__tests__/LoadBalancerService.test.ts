import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoadBalancerService, RoundRobinStrategy, LeastConnectionsStrategy, WeightedResponseTimeStrategy } from '../LoadBalancerService';

// Mock fetch for health checks
global.fetch = vi.fn();

describe('LoadBalancerService', () => {
  let loadBalancer: LoadBalancerService;

  beforeEach(() => {
    loadBalancer = new LoadBalancerService(new RoundRobinStrategy());
    vi.clearAllMocks();
  });

  afterEach(() => {
    loadBalancer.destroy();
  });

  describe('Server Management', () => {
    it('should add servers', () => {
      const server = {
        id: 'server-1',
        url: 'http://localhost:3001',
        load: 0.5,
        responseTime: 100,
        connections: 10,
        maxConnections: 100,
      };

      loadBalancer.addServer(server);
      const stats = loadBalancer.getServerStats();
      
      expect(stats.total).toBe(1);
      expect(stats.healthy).toBe(1);
    });

    it('should remove servers', () => {
      const server = {
        id: 'server-1',
        url: 'http://localhost:3001',
        load: 0.5,
        responseTime: 100,
        connections: 10,
        maxConnections: 100,
      };

      loadBalancer.addServer(server);
      loadBalancer.removeServer('server-1');
      
      const stats = loadBalancer.getServerStats();
      expect(stats.total).toBe(0);
    });

    it('should emit events when servers are added/removed', () => {
      const addedSpy = vi.fn();
      const removedSpy = vi.fn();
      
      loadBalancer.on('serverAdded', addedSpy);
      loadBalancer.on('serverRemoved', removedSpy);

      const server = {
        id: 'server-1',
        url: 'http://localhost:3001',
        load: 0.5,
        responseTime: 100,
        connections: 10,
        maxConnections: 100,
      };

      loadBalancer.addServer(server);
      expect(addedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'server-1' }));

      loadBalancer.removeServer('server-1');
      expect(removedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'server-1' }));
    });
  });

  describe('Load Balancing Strategies', () => {
    beforeEach(() => {
      // Add multiple servers for testing
      const servers = [
        { id: 'server-1', url: 'http://localhost:3001', load: 0.3, responseTime: 100, connections: 5, maxConnections: 100 },
        { id: 'server-2', url: 'http://localhost:3002', load: 0.7, responseTime: 200, connections: 15, maxConnections: 100 },
        { id: 'server-3', url: 'http://localhost:3003', load: 0.5, responseTime: 150, connections: 10, maxConnections: 100 },
      ];

      servers.forEach(server => loadBalancer.addServer(server));
    });

    it('should use round robin strategy', () => {
      const selections = [];
      for (let i = 0; i < 6; i++) {
        const server = loadBalancer.selectServer();
        selections.push(server?.id);
      }

      // Should cycle through servers
      expect(selections).toEqual(['server-1', 'server-2', 'server-3', 'server-1', 'server-2', 'server-3']);
    });

    it('should use least connections strategy', () => {
      const leastConnectionsLB = new LoadBalancerService(new LeastConnectionsStrategy());
      
      const servers = [
        { id: 'server-1', url: 'http://localhost:3001', load: 0.3, responseTime: 100, connections: 5, maxConnections: 100 },
        { id: 'server-2', url: 'http://localhost:3002', load: 0.7, responseTime: 200, connections: 15, maxConnections: 100 },
        { id: 'server-3', url: 'http://localhost:3003', load: 0.5, responseTime: 150, connections: 3, maxConnections: 100 },
      ];

      servers.forEach(server => leastConnectionsLB.addServer(server));

      const server = leastConnectionsLB.selectServer();
      expect(server?.id).toBe('server-3'); // Has least connections (3)

      leastConnectionsLB.destroy();
    });

    it('should use weighted response time strategy', () => {
      const weightedLB = new LoadBalancerService(new WeightedResponseTimeStrategy());
      
      const servers = [
        { id: 'server-1', url: 'http://localhost:3001', load: 0.3, responseTime: 300, connections: 5, maxConnections: 100 },
        { id: 'server-2', url: 'http://localhost:3002', load: 0.7, responseTime: 200, connections: 15, maxConnections: 100 },
        { id: 'server-3', url: 'http://localhost:3003', load: 0.5, responseTime: 100, connections: 10, maxConnections: 100 },
      ];

      servers.forEach(server => weightedLB.addServer(server));

      const server = weightedLB.selectServer();
      expect(server?.id).toBe('server-3'); // Has lowest response time (100ms)

      weightedLB.destroy();
    });
  });

  describe('Health Checks', () => {
    beforeEach(() => {
      const server = {
        id: 'server-1',
        url: 'http://localhost:3001',
        load: 0.5,
        responseTime: 100,
        connections: 10,
        maxConnections: 100,
      };

      loadBalancer.addServer(server);
    });

    it('should mark servers as healthy on successful health check', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      // Trigger health check manually
      await loadBalancer['performHealthChecks']();

      const stats = loadBalancer.getServerStats();
      expect(stats.healthy).toBe(1);
    });

    it('should mark servers as unhealthy on failed health check', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      // Trigger health check manually
      await loadBalancer['performHealthChecks']();

      const stats = loadBalancer.getServerStats();
      expect(stats.unhealthy).toBe(1);
    });

    it('should mark servers as degraded on slow response', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock a slow but successful response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
          } as Response), 3000) // 3 second delay
        )
      );

      // Trigger health check manually
      await loadBalancer['performHealthChecks']();

      const stats = loadBalancer.getServerStats();
      expect(stats.degraded).toBe(1);
    });
  });

  describe('Server Selection', () => {
    it('should return null when no healthy servers available', () => {
      const server = loadBalancer.selectServer();
      expect(server).toBeNull();
    });

    it('should only select healthy servers', () => {
      const servers = [
        { id: 'server-1', url: 'http://localhost:3001', load: 0.5, responseTime: 100, connections: 10, maxConnections: 100 },
        { id: 'server-2', url: 'http://localhost:3002', load: 0.5, responseTime: 100, connections: 10, maxConnections: 100 },
      ];

      servers.forEach(server => loadBalancer.addServer(server));

      // Mark one server as unhealthy
      loadBalancer.updateServerMetrics('server-1', { health: 'unhealthy' });

      const selectedServer = loadBalancer.selectServer();
      expect(selectedServer?.id).toBe('server-2');
    });
  });

  describe('Metrics and Statistics', () => {
    it('should calculate server statistics correctly', () => {
      const servers = [
        { id: 'server-1', url: 'http://localhost:3001', load: 0.2, responseTime: 100, connections: 10, maxConnections: 100 },
        { id: 'server-2', url: 'http://localhost:3002', load: 0.8, responseTime: 200, connections: 20, maxConnections: 100 },
      ];

      servers.forEach(server => loadBalancer.addServer(server));

      const stats = loadBalancer.getServerStats();
      
      expect(stats.total).toBe(2);
      expect(stats.healthy).toBe(2);
      expect(stats.averageLoad).toBe(0.5); // (0.2 + 0.8) / 2
      expect(stats.averageResponseTime).toBe(150); // (100 + 200) / 2
    });

    it('should update server metrics', () => {
      const server = {
        id: 'server-1',
        url: 'http://localhost:3001',
        load: 0.5,
        responseTime: 100,
        connections: 10,
        maxConnections: 100,
      };

      loadBalancer.addServer(server);
      loadBalancer.updateServerMetrics('server-1', { 
        load: 0.8, 
        responseTime: 200,
        connections: 20 
      });

      const stats = loadBalancer.getServerStats();
      expect(stats.averageLoad).toBe(0.8);
      expect(stats.averageResponseTime).toBe(200);
    });

    it('should emit server updated events', () => {
      const updatedSpy = vi.fn();
      loadBalancer.on('serverUpdated', updatedSpy);

      const server = {
        id: 'server-1',
        url: 'http://localhost:3001',
        load: 0.5,
        responseTime: 100,
        connections: 10,
        maxConnections: 100,
      };

      loadBalancer.addServer(server);
      loadBalancer.updateServerMetrics('server-1', { load: 0.8 });

      expect(updatedSpy).toHaveBeenCalledWith(expect.objectContaining({ 
        id: 'server-1',
        load: 0.8 
      }));
    });
  });
});
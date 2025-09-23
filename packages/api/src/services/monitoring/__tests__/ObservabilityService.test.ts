import { vi } from 'vitest';
import { observabilityService, ObservabilityService } from '../ObservabilityService';

describe('ObservabilityService', () => {
  let service: ObservabilityService;

  beforeEach(() => {
    service = new ObservabilityService();
  });

  afterEach(() => {
    service.removeAllListeners();
  });

  describe('Metric Recording', () => {
    it('should record metrics with correct metadata', () => {
      const metricSpy = vi.fn();
      service.on('metric', metricSpy);

      service.recordMetric('test.metric', 42, { tag: 'value' }, 'counter');

      expect(metricSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test.metric',
          value: 42,
          tags: { tag: 'value' },
          type: 'counter',
          timestamp: expect.any(Date)
        })
      );
    });

    it('should maintain metric history with size limits', () => {
      // Record more than the limit
      for (let i = 0; i < 1100; i++) {
        service.recordMetric('test.metric', i);
      }

      const dashboardData = service.getDashboardData();
      const metrics = dashboardData.metrics['test.metric'];

      expect(metrics).toBeDefined();
      expect(metrics.length).toBeLessThanOrEqual(1000);
      expect(metrics[metrics.length - 1].value).toBe(1099); // Latest value preserved
    });

    it('should retrieve metrics by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const twoHoursAgo = new Date(now.getTime() - 7200000);

      // Record metrics at different times
      service.recordMetric('test.metric', 1);
      
      // Simulate older metrics by directly manipulating the internal state
      const dashboardData = service.getDashboardData();
      if (dashboardData.metrics['test.metric']) {
        dashboardData.metrics['test.metric'][0].timestamp = twoHoursAgo;
      }

      const recentMetrics = service.getMetricsByTimeRange('test.metric', oneHourAgo, now);
      expect(recentMetrics.length).toBe(0); // Should not include the old metric
    });
  });

  describe('User Behavior Tracking', () => {
    it('should track user events with proper metadata', () => {
      const eventSpy = vi.fn();
      service.on('userEvent', eventSpy);

      service.trackUserEvent({
        userId: 'user123',
        sessionId: 'session456',
        event: 'deck_generated',
        properties: { commander: 'Atraxa' },
        page: '/tutor'
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          sessionId: 'session456',
          event: 'deck_generated',
          properties: { commander: 'Atraxa' },
          page: '/tutor',
          timestamp: expect.any(Date)
        })
      );
    });

    it('should track conversion events as metrics', () => {
      const metricSpy = vi.fn();
      service.on('metric', metricSpy);

      service.trackUserEvent({
        sessionId: 'session456',
        event: 'deck_generated',
        properties: {}
      });

      expect(metricSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'conversion',
          value: 1,
          tags: {
            event: 'deck_generated',
            userId: 'anonymous'
          }
        })
      );
    });

    it('should calculate user funnel correctly', () => {
      // Track events for funnel analysis
      service.trackUserEvent({
        sessionId: 'session1',
        event: 'consultation_started',
        properties: {}
      });

      service.trackUserEvent({
        sessionId: 'session1',
        event: 'consultation_completed',
        properties: {}
      });

      service.trackUserEvent({
        sessionId: 'session2',
        event: 'consultation_started',
        properties: {}
      });

      const funnel = service.getUserFunnel([
        'consultation_started',
        'consultation_completed',
        'deck_generated'
      ]);

      expect(funnel).toEqual({
        consultation_started: 2,
        consultation_completed: 1,
        deck_generated: 0
      });
    });

    it('should calculate conversion rates correctly', () => {
      const now = Date.now();
      
      // Mock events with specific timing
      service.trackUserEvent({
        sessionId: 'session1',
        event: 'consultation_started',
        properties: {}
      });

      // Simulate a conversion within the time window
      setTimeout(() => {
        service.trackUserEvent({
          sessionId: 'session1',
          event: 'deck_generated',
          properties: {}
        });

        const conversionRate = service.getConversionRate(
          'consultation_started',
          'deck_generated',
          60000 // 1 minute window
        );

        expect(conversionRate).toBe(1.0); // 100% conversion
      }, 100);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track transaction duration', (done) => {
      const metricSpy = vi.fn();
      service.on('metric', metricSpy);

      const transactionId = service.startTransaction('test.operation');
      
      setTimeout(() => {
        service.endTransaction(transactionId);

        expect(metricSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'transaction.duration',
            type: 'timer',
            tags: { name: 'test.operation' },
            value: expect.any(Number)
          })
        );

        done();
      }, 50);
    });

    it('should handle invalid transaction IDs gracefully', () => {
      expect(() => {
        service.endTransaction('invalid-transaction-id');
      }).not.toThrow();
    });

    it('should collect performance metrics automatically', (done) => {
      const performanceSpy = vi.fn();
      service.on('performanceMetric', performanceSpy);

      // Wait for at least one performance collection cycle
      setTimeout(() => {
        expect(performanceSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            responseTime: expect.any(Number),
            throughput: expect.any(Number),
            errorRate: expect.any(Number),
            cpuUsage: expect.any(Number),
            memoryUsage: expect.any(Number),
            activeConnections: expect.any(Number),
            timestamp: expect.any(Date)
          })
        );

        done();
      }, 100);
    });
  });

  describe('Alert Management', () => {
    it('should create alerts with proper metadata', () => {
      const alertSpy = vi.fn();
      service.on('alert', alertSpy);

      const alertId = service.createAlert({
        severity: 'high',
        title: 'Test Alert',
        description: 'This is a test alert',
        source: 'test'
      });

      expect(alertId).toBeTruthy();
      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: alertId,
          severity: 'high',
          title: 'Test Alert',
          description: 'This is a test alert',
          source: 'test',
          timestamp: expect.any(Date),
          resolved: false
        })
      );
    });

    it('should emit critical alerts separately', () => {
      const criticalAlertSpy = vi.fn();
      service.on('criticalAlert', criticalAlertSpy);

      service.createAlert({
        severity: 'critical',
        title: 'Critical Test Alert',
        description: 'This is a critical test alert',
        source: 'test'
      });

      expect(criticalAlertSpy).toHaveBeenCalled();
    });

    it('should resolve alerts correctly', () => {
      const resolvedSpy = vi.fn();
      service.on('alertResolved', resolvedSpy);

      const alertId = service.createAlert({
        severity: 'medium',
        title: 'Test Alert',
        description: 'This is a test alert',
        source: 'test'
      });

      const resolved = service.resolveAlert(alertId);

      expect(resolved).toBe(true);
      expect(resolvedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: alertId,
          resolved: true
        })
      );
    });

    it('should maintain alert history with size limits', () => {
      // Create more alerts than the limit
      for (let i = 0; i < 1100; i++) {
        service.createAlert({
          severity: 'low',
          title: `Test Alert ${i}`,
          description: `Alert number ${i}`,
          source: 'test'
        });
      }

      const dashboardData = service.getDashboardData();
      expect(dashboardData.activeAlerts.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Dashboard Data', () => {
    it('should provide comprehensive dashboard data', () => {
      // Record some test data
      service.recordMetric('test.metric', 100);
      service.trackUserEvent({
        sessionId: 'session1',
        event: 'test_event',
        properties: {}
      });
      service.createAlert({
        severity: 'medium',
        title: 'Test Alert',
        description: 'Test alert',
        source: 'test'
      });

      const dashboardData = service.getDashboardData();

      expect(dashboardData).toHaveProperty('metrics');
      expect(dashboardData).toHaveProperty('recentEvents');
      expect(dashboardData).toHaveProperty('activeAlerts');
      expect(dashboardData).toHaveProperty('performanceMetrics');

      expect(dashboardData.metrics['test.metric']).toBeDefined();
      expect(dashboardData.recentEvents.length).toBeGreaterThan(0);
      expect(dashboardData.activeAlerts.length).toBeGreaterThan(0);
    });

    it('should limit dashboard data to recent items', () => {
      // Add many events
      for (let i = 0; i < 200; i++) {
        service.trackUserEvent({
          sessionId: `session${i}`,
          event: 'test_event',
          properties: { index: i }
        });
      }

      const dashboardData = service.getDashboardData();
      expect(dashboardData.recentEvents.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance Alerts', () => {
    it('should create alerts for high response times', (done) => {
      const alertSpy = vi.fn();
      service.on('alert', alertSpy);

      // Mock high response time by directly triggering the check
      const highResponseTimeMetrics = {
        responseTime: 6000, // 6 seconds
        throughput: 10,
        errorRate: 0.01,
        cpuUsage: 0.5,
        memoryUsage: 0.5,
        activeConnections: 5,
        timestamp: new Date()
      };

      // Simulate the performance check
      service.emit('performanceMetric', highResponseTimeMetrics);

      setTimeout(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'high',
            title: 'High Response Time',
            source: 'performance-monitor'
          })
        );
        done();
      }, 100);
    });

    it('should create alerts for high error rates', (done) => {
      const alertSpy = vi.fn();
      service.on('alert', alertSpy);

      const highErrorRateMetrics = {
        responseTime: 1000,
        throughput: 10,
        errorRate: 0.1, // 10% error rate
        cpuUsage: 0.5,
        memoryUsage: 0.5,
        activeConnections: 5,
        timestamp: new Date()
      };

      service.emit('performanceMetric', highErrorRateMetrics);

      setTimeout(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'high',
            title: 'High Error Rate',
            source: 'performance-monitor'
          })
        );
        done();
      }, 100);
    });

    it('should create alerts for high memory usage', (done) => {
      const alertSpy = vi.fn();
      service.on('alert', alertSpy);

      const highMemoryMetrics = {
        responseTime: 1000,
        throughput: 10,
        errorRate: 0.01,
        cpuUsage: 0.5,
        memoryUsage: 0.95, // 95% memory usage
        activeConnections: 5,
        timestamp: new Date()
      };

      service.emit('performanceMetric', highMemoryMetrics);

      setTimeout(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'medium',
            title: 'High Memory Usage',
            source: 'performance-monitor'
          })
        );
        done();
      }, 100);
    });
  });
});
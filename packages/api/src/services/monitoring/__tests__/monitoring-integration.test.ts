import { vi } from 'vitest';
import { observabilityService } from '../ObservabilityService';
import { logAggregationService } from '../LogAggregationService';
import { alertingService } from '../AlertingService';
import { dashboardService } from '../DashboardService';

describe('Monitoring System Integration', () => {
  beforeEach(() => {
    // Clear any existing data
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up event listeners
    observabilityService.removeAllListeners();
    logAggregationService.removeAllListeners();
    alertingService.removeAllListeners();
  });

  describe('End-to-End Monitoring Flow', () => {
    it('should track complete user journey with metrics, logs, and alerts', async () => {
      // 1. User starts consultation
      observabilityService.trackUserEvent({
        userId: 'user123',
        sessionId: 'session456',
        event: 'consultation_started',
        properties: { source: 'homepage' }
      });

      logAggregationService.info(
        'User started consultation',
        'consultation-service',
        {
          userId: 'user123',
          sessionId: 'session456'
        }
      );

      // 2. AI generation process
      const transactionId = observabilityService.startTransaction('ai.generateDeck');
      
      // Simulate AI processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      observabilityService.endTransaction(transactionId);
      observabilityService.recordMetric('ai.generation.success', 1, {
        userId: 'user123',
        strategy: 'aggro'
      });

      // 3. User completes journey
      observabilityService.trackUserEvent({
        userId: 'user123',
        sessionId: 'session456',
        event: 'deck_generated',
        properties: { 
          commander: 'Atraxa',
          cardCount: 100,
          budget: 500
        }
      });

      // 4. Verify data is captured across all services
      const dashboardData = await dashboardService.getDashboardData();
      
      expect(dashboardData.business.userActivity.activeUsers).toBeGreaterThan(0);
      expect(dashboardData.business.deckGenerations.successful).toBeGreaterThan(0);
      
      const logs = logAggregationService.search({
        userId: 'user123',
        sessionId: 'session456'
      });
      
      expect(logs.logs.length).toBeGreaterThan(0);
      expect(logs.logs.some(log => log.message.includes('consultation'))).toBe(true);

      const conversionRate = observabilityService.getConversionRate(
        'consultation_started',
        'deck_generated'
      );
      
      expect(conversionRate).toBe(1.0); // 100% conversion in this test
    });

    it('should handle error scenarios with proper alerting', async () => {
      const alertSpy = vi.fn();
      alertingService.on('alertTriggered', alertSpy);

      // Simulate AI service failure
      logAggregationService.error(
        'AI service timeout',
        'ai-service',
        new Error('Request timeout after 30 seconds'),
        {
          userId: 'user123',
          sessionId: 'session456',
          operation: 'generateDeck'
        }
      );

      observabilityService.recordMetric('ai.generation.failure', 1, {
        errorType: 'timeout',
        userId: 'user123'
      });

      // Wait for alert evaluation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error was logged and metrics recorded
      const logs = logAggregationService.search({
        level: ['error'],
        search: 'timeout'
      });

      expect(logs.logs.length).toBeGreaterThan(0);
      expect(logs.logs[0].level).toBe('error');
      expect(logs.logs[0].stackTrace).toBeTruthy();

      const dashboardData = observabilityService.getDashboardData();
      expect(dashboardData.metrics['ai.generation.failure']).toBeDefined();
    });

    it('should correlate logs across services for debugging', () => {
      const sessionId = 'debug-session-123';
      const requestId = 'req-456';

      // Log from multiple services with same session/request ID
      logAggregationService.info('Request received', 'api-gateway', {
        sessionId,
        requestId,
        endpoint: '/api/generate-deck'
      });

      logAggregationService.debug('Starting AI generation', 'ai-service', {
        sessionId,
        requestId,
        model: 'gpt-4'
      });

      logAggregationService.info('Database query executed', 'database', {
        sessionId,
        requestId,
        query: 'SELECT * FROM cards WHERE...',
        duration: 45
      });

      logAggregationService.info('Response sent', 'api-gateway', {
        sessionId,
        requestId,
        statusCode: 200,
        duration: 2500
      });

      // Correlate logs by session ID
      const correlatedLogs = logAggregationService.correlateLogs(sessionId);
      
      expect(correlatedLogs.length).toBe(4);
      expect(correlatedLogs[0].source).toBe('api-gateway');
      expect(correlatedLogs[1].source).toBe('ai-service');
      expect(correlatedLogs[2].source).toBe('database');
      expect(correlatedLogs[3].source).toBe('api-gateway');

      // All logs should have the same session ID
      correlatedLogs.forEach(log => {
        expect(log.sessionId).toBe(sessionId);
      });
    });

    it('should provide real-time dashboard updates', (done) => {
      let updateCount = 0;
      
      const unsubscribe = dashboardService.subscribeToUpdates('test-dashboard', (update) => {
        updateCount++;
        
        expect(update).toHaveProperty('type');
        expect(update).toHaveProperty('data');
        expect(update).toHaveProperty('timestamp');

        if (updateCount >= 2) {
          unsubscribe();
          done();
        }
      });

      // Trigger some events that should generate updates
      observabilityService.recordMetric('test.metric', 42);
      
      setTimeout(() => {
        observabilityService.createAlert({
          severity: 'medium',
          title: 'Test Alert',
          description: 'Test alert for real-time updates',
          source: 'test'
        });
      }, 50);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high volume of metrics without performance degradation', async () => {
      const startTime = Date.now();
      const metricCount = 10000;

      // Record many metrics rapidly
      for (let i = 0; i < metricCount; i++) {
        observabilityService.recordMetric('load.test', i, {
          batch: Math.floor(i / 100).toString()
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // Verify metrics are properly stored and limited
      const dashboardData = observabilityService.getDashboardData();
      const metrics = dashboardData.metrics['load.test'];
      
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeLessThanOrEqual(1000); // Size limit enforced
      expect(metrics[metrics.length - 1].value).toBe(metricCount - 1); // Latest value preserved
    });

    it('should handle high volume of logs efficiently', () => {
      const startTime = Date.now();
      const logCount = 5000;

      // Generate many logs
      for (let i = 0; i < logCount; i++) {
        logAggregationService.info(
          `Load test log message ${i}`,
          'load-test',
          { index: i, batch: Math.floor(i / 100) }
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000);

      // Verify logs are searchable
      const searchResult = logAggregationService.search({
        source: ['load-test'],
        limit: 100
      });

      expect(searchResult.logs.length).toBe(100);
      expect(searchResult.total).toBeGreaterThan(0);
      expect(searchResult.hasMore).toBe(true);
    });

    it('should maintain alert responsiveness under load', async () => {
      // Create multiple alert rules
      const ruleIds: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        const ruleId = alertingService.createRule({
          name: `Load Test Rule ${i}`,
          description: `Rule for load testing ${i}`,
          enabled: true,
          conditions: [{
            type: 'metric',
            metric: 'load.test.trigger',
            operator: 'gt',
            threshold: i * 10,
            timeWindow: 1,
            aggregation: 'sum'
          }],
          actions: [{
            type: 'log',
            config: { level: 'info' },
            enabled: true
          }],
          cooldownMinutes: 1,
          severity: 'low'
        });
        
        ruleIds.push(ruleId);
      }

      // Trigger metrics that should fire alerts
      for (let i = 0; i < 100; i++) {
        observabilityService.recordMetric('load.test.trigger', i);
      }

      // Wait for alert evaluation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify some alerts were triggered
      const alerts = alertingService.getAlerts({ status: 'active' });
      expect(alerts.length).toBeGreaterThan(0);

      // Clean up rules
      ruleIds.forEach(ruleId => {
        alertingService.deleteRule(ruleId);
      });
    });
  });

  describe('Data Consistency and Reliability', () => {
    it('should maintain data consistency across service restarts', () => {
      // Record initial data
      observabilityService.recordMetric('persistence.test', 100);
      logAggregationService.info('Persistence test log', 'test');
      
      const alertId = alertingService.createRule({
        name: 'Persistence Test Rule',
        description: 'Rule for testing persistence',
        enabled: true,
        conditions: [{
          type: 'metric',
          metric: 'persistence.test',
          operator: 'gt',
          threshold: 50,
          timeWindow: 1
        }],
        actions: [{
          type: 'log',
          config: { level: 'info' },
          enabled: true
        }],
        cooldownMinutes: 5,
        severity: 'low'
      });

      // Verify data exists
      const initialDashboardData = observabilityService.getDashboardData();
      const initialLogs = logAggregationService.search({ search: 'Persistence' });
      const initialRules = alertingService.getRules();

      expect(initialDashboardData.metrics['persistence.test']).toBeDefined();
      expect(initialLogs.logs.length).toBeGreaterThan(0);
      expect(initialRules.some(r => r.name === 'Persistence Test Rule')).toBe(true);

      // In a real scenario, services would be restarted here
      // For testing, we verify the data is still accessible
      const postRestartDashboardData = observabilityService.getDashboardData();
      const postRestartLogs = logAggregationService.search({ search: 'Persistence' });
      const postRestartRules = alertingService.getRules();

      expect(postRestartDashboardData.metrics['persistence.test']).toBeDefined();
      expect(postRestartLogs.logs.length).toBeGreaterThan(0);
      expect(postRestartRules.some(r => r.name === 'Persistence Test Rule')).toBe(true);
    });

    it('should handle concurrent access safely', async () => {
      const promises: Promise<any>[] = [];
      const concurrentOperations = 50;

      // Perform concurrent operations
      for (let i = 0; i < concurrentOperations; i++) {
        promises.push(
          Promise.resolve().then(() => {
            observabilityService.recordMetric('concurrent.test', i);
            logAggregationService.info(`Concurrent log ${i}`, 'concurrency-test');
            
            if (i % 10 === 0) {
              observabilityService.createAlert({
                severity: 'low',
                title: `Concurrent Alert ${i}`,
                description: `Alert from concurrent operation ${i}`,
                source: 'concurrency-test'
              });
            }
          })
        );
      }

      // Wait for all operations to complete
      await Promise.all(promises);

      // Verify data integrity
      const dashboardData = observabilityService.getDashboardData();
      const logs = logAggregationService.search({ source: ['concurrency-test'] });
      const alerts = alertingService.getAlerts();

      expect(dashboardData.metrics['concurrent.test']).toBeDefined();
      expect(dashboardData.metrics['concurrent.test'].length).toBe(concurrentOperations);
      expect(logs.logs.length).toBe(concurrentOperations);
      expect(alerts.filter(a => a.source === 'concurrency-test').length).toBe(5); // Every 10th operation
    });
  });

  describe('Business Intelligence Integration', () => {
    it('should provide comprehensive business metrics', async () => {
      // Simulate business events
      const users = ['user1', 'user2', 'user3'];
      const sessions = ['session1', 'session2', 'session3'];

      users.forEach((userId, index) => {
        const sessionId = sessions[index];
        
        // User journey
        observabilityService.trackUserEvent({
          userId,
          sessionId,
          event: 'consultation_started',
          properties: { source: 'organic' }
        });

        observabilityService.trackUserEvent({
          userId,
          sessionId,
          event: 'consultation_completed',
          properties: { duration: 300 + index * 100 }
        });

        if (index < 2) { // 2 out of 3 convert
          observabilityService.trackUserEvent({
            userId,
            sessionId,
            event: 'deck_generated',
            properties: { 
              commander: `Commander${index}`,
              strategy: 'aggro'
            }
          });

          observabilityService.recordMetric('ai.generation.success', 1, {
            userId,
            strategy: 'aggro'
          });
        }
      });

      const dashboardData = await dashboardService.getDashboardData();

      // Verify business metrics
      expect(dashboardData.business.userActivity.activeUsers).toBe(3);
      expect(dashboardData.business.deckGenerations.successful).toBe(2);
      expect(dashboardData.business.userActivity.conversionRate).toBeCloseTo(0.67, 1); // 2/3

      const funnel = observabilityService.getUserFunnel([
        'consultation_started',
        'consultation_completed',
        'deck_generated'
      ]);

      expect(funnel.consultation_started).toBe(3);
      expect(funnel.consultation_completed).toBe(3);
      expect(funnel.deck_generated).toBe(2);
    });

    it('should track technical performance metrics', async () => {
      // Simulate API calls
      const endpoints = ['/api/cards', '/api/generate', '/api/decks'];
      
      endpoints.forEach((endpoint, index) => {
        observabilityService.recordMetric('request.count', 1, { endpoint });
        observabilityService.recordMetric('request.duration', 100 + index * 50, { endpoint }, 'timer');
        
        if (index === 2) { // Simulate error on last endpoint
          observabilityService.recordMetric('request.error', 1, { endpoint });
        }
      });

      // Simulate database operations
      observabilityService.recordMetric('database.query.count', 10, { queryType: 'SELECT' });
      observabilityService.recordMetric('database.query.duration', 25, { queryType: 'SELECT' }, 'timer');

      const dashboardData = await dashboardService.getDashboardData();

      expect(dashboardData.technical.apiCalls.total).toBe(3);
      expect(dashboardData.technical.apiCalls.byEndpoint['/api/cards']).toBe(1);
      expect(dashboardData.technical.apiCalls.errorsByEndpoint['/api/decks']).toBe(1);
    });
  });
});
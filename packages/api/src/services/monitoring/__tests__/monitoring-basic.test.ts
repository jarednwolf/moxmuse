import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { observabilityService, ObservabilityService } from '../ObservabilityService';
import { logAggregationService, LogAggregationService } from '../LogAggregationService';
import { alertingService, AlertingService } from '../AlertingService';
import { dashboardService, DashboardService } from '../DashboardService';

describe('Monitoring System Basic Tests', () => {
  beforeEach(() => {
    // Reset services to clean state
  });

  afterEach(() => {
    // Clean up event listeners
    observabilityService.removeAllListeners();
    logAggregationService.removeAllListeners();
    alertingService.removeAllListeners();
  });

  describe('ObservabilityService', () => {
    it('should record metrics correctly', () => {
      observabilityService.recordMetric('test.metric', 42, { tag: 'value' }, 'counter');
      
      const dashboardData = observabilityService.getDashboardData();
      expect(dashboardData.metrics['test.metric']).toBeDefined();
      expect(dashboardData.metrics['test.metric'].length).toBe(1);
      expect(dashboardData.metrics['test.metric'][0].value).toBe(42);
      expect(dashboardData.metrics['test.metric'][0].tags?.tag).toBe('value');
      expect(dashboardData.metrics['test.metric'][0].type).toBe('counter');
    });

    it('should track user events', () => {
      observabilityService.trackUserEvent({
        userId: 'user123',
        sessionId: 'session456',
        event: 'deck_generated',
        properties: { commander: 'Atraxa' }
      });

      const dashboardData = observabilityService.getDashboardData();
      expect(dashboardData.recentEvents.length).toBeGreaterThan(0);
      
      const event = dashboardData.recentEvents.find(e => e.event === 'deck_generated');
      expect(event).toBeDefined();
      expect(event?.userId).toBe('user123');
      expect(event?.sessionId).toBe('session456');
      expect(event?.properties.commander).toBe('Atraxa');
    });

    it('should manage transactions', async () => {
      const transactionId = observabilityService.startTransaction('test.operation');
      expect(transactionId).toBeTruthy();
      
      // Wait a bit to ensure measurable duration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      observabilityService.endTransaction(transactionId);
      
      const dashboardData = observabilityService.getDashboardData();
      expect(dashboardData.metrics['transaction.duration']).toBeDefined();
      expect(dashboardData.metrics['transaction.duration'].length).toBe(1);
      expect(dashboardData.metrics['transaction.duration'][0].value).toBeGreaterThan(0);
    });

    it('should create and resolve alerts', () => {
      const alertId = observabilityService.createAlert({
        severity: 'high',
        title: 'Test Alert',
        description: 'This is a test alert',
        source: 'test'
      });

      expect(alertId).toBeTruthy();
      
      const dashboardData = observabilityService.getDashboardData();
      expect(dashboardData.activeAlerts.length).toBe(1);
      expect(dashboardData.activeAlerts[0].id).toBe(alertId);
      expect(dashboardData.activeAlerts[0].severity).toBe('high');
      expect(dashboardData.activeAlerts[0].title).toBe('Test Alert');

      const resolved = observabilityService.resolveAlert(alertId);
      expect(resolved).toBe(true);
    });

    it('should calculate user funnel', () => {
      // Track events for funnel analysis
      observabilityService.trackUserEvent({
        sessionId: 'session1',
        event: 'consultation_started',
        properties: {}
      });

      observabilityService.trackUserEvent({
        sessionId: 'session1',
        event: 'consultation_completed',
        properties: {}
      });

      observabilityService.trackUserEvent({
        sessionId: 'session2',
        event: 'consultation_started',
        properties: {}
      });

      const funnel = observabilityService.getUserFunnel([
        'consultation_started',
        'consultation_completed',
        'deck_generated'
      ]);

      expect(funnel.consultation_started).toBe(2);
      expect(funnel.consultation_completed).toBe(1);
      expect(funnel.deck_generated).toBe(0);
    });
  });

  describe('LogAggregationService', () => {
    it('should log messages with different levels', () => {
      const infoId = logAggregationService.info('Info message', 'test-service');
      const warnId = logAggregationService.warn('Warning message', 'test-service');
      const errorId = logAggregationService.error('Error message', 'test-service', new Error('Test error'));

      expect(infoId).toBeTruthy();
      expect(warnId).toBeTruthy();
      expect(errorId).toBeTruthy();

      const logs = logAggregationService.search({ source: ['test-service'] });
      expect(logs.logs.length).toBe(3);
      
      const infoLog = logs.logs.find(log => log.level === 'info');
      const warnLog = logs.logs.find(log => log.level === 'warn');
      const errorLog = logs.logs.find(log => log.level === 'error');

      expect(infoLog?.message).toBe('Info message');
      expect(warnLog?.message).toBe('Warning message');
      expect(errorLog?.message).toBe('Error message');
      expect(errorLog?.stackTrace).toBeTruthy();
    });

    it('should search logs by various criteria', () => {
      // Create test logs
      logAggregationService.info('User login successful', 'auth-service', { userId: 'user123' });
      logAggregationService.warn('Rate limit approaching', 'api-gateway', { userId: 'user456' });
      logAggregationService.error('Database connection failed', 'db-service');

      // Search by level
      const errorLogs = logAggregationService.search({ level: ['error'] });
      expect(errorLogs.logs.length).toBe(1);
      expect(errorLogs.logs[0].message).toBe('Database connection failed');

      // Search by source
      const authLogs = logAggregationService.search({ source: ['auth-service'] });
      expect(authLogs.logs.length).toBe(1);
      expect(authLogs.logs[0].message).toBe('User login successful');

      // Search by text
      const loginLogs = logAggregationService.search({ search: 'login' });
      expect(loginLogs.logs.length).toBe(1);
      expect(loginLogs.logs[0].message).toBe('User login successful');
    });

    it('should correlate logs by session ID', () => {
      const sessionId = 'test-session-123';

      logAggregationService.info('Request started', 'api-gateway', { sessionId });
      logAggregationService.debug('Processing request', 'business-logic', { sessionId });
      logAggregationService.info('Request completed', 'api-gateway', { sessionId });

      const correlatedLogs = logAggregationService.correlateLogs(sessionId);
      expect(correlatedLogs.length).toBe(3);
      
      // Should be sorted by timestamp
      expect(correlatedLogs[0].message).toBe('Request started');
      expect(correlatedLogs[1].message).toBe('Processing request');
      expect(correlatedLogs[2].message).toBe('Request completed');

      // All should have the same session ID
      correlatedLogs.forEach(log => {
        expect(log.sessionId).toBe(sessionId);
      });
    });

    it('should provide log statistics', () => {
      // Create diverse logs
      logAggregationService.info('Info 1', 'service-a');
      logAggregationService.info('Info 2', 'service-b');
      logAggregationService.warn('Warning 1', 'service-a');
      logAggregationService.error('Error 1', 'service-c');

      const stats = logAggregationService.getStatistics();
      
      expect(stats.totalLogs).toBe(4);
      expect(stats.logsByLevel.info).toBe(2);
      expect(stats.logsByLevel.warn).toBe(1);
      expect(stats.logsByLevel.error).toBe(1);
      expect(stats.logsBySource['service-a']).toBe(2);
      expect(stats.logsBySource['service-b']).toBe(1);
      expect(stats.logsBySource['service-c']).toBe(1);
      expect(stats.errorRate).toBe(0.25); // 1 error out of 4 logs
    });

    it('should export logs in different formats', () => {
      logAggregationService.info('Export test log', 'export-service', { key: 'value' });

      // Test JSON export
      const jsonExport = logAggregationService.exportLogs({ source: ['export-service'] }, 'json');
      expect(() => JSON.parse(jsonExport)).not.toThrow();
      const parsedJson = JSON.parse(jsonExport);
      expect(parsedJson.length).toBe(1);
      expect(parsedJson[0].message).toBe('Export test log');

      // Test CSV export
      const csvExport = logAggregationService.exportLogs({ source: ['export-service'] }, 'csv');
      expect(csvExport).toContain('timestamp,level,source,message');
      expect(csvExport).toContain('Export test log');

      // Test text export
      const textExport = logAggregationService.exportLogs({ source: ['export-service'] }, 'txt');
      expect(textExport).toContain('Export test log');
      expect(textExport).toContain('INFO');
    });
  });

  describe('AlertingService', () => {
    it('should create and manage alert rules', () => {
      const ruleId = alertingService.createRule({
        name: 'Test Rule',
        description: 'A test alert rule',
        enabled: true,
        conditions: [{
          type: 'metric',
          metric: 'test.metric',
          operator: 'gt',
          threshold: 100,
          timeWindow: 5
        }],
        actions: [{
          type: 'log',
          config: { level: 'warn' },
          enabled: true
        }],
        cooldownMinutes: 10,
        severity: 'medium'
      });

      expect(ruleId).toBeTruthy();

      const rules = alertingService.getRules();
      expect(rules.length).toBeGreaterThan(0);
      
      const rule = rules.find(r => r.id === ruleId);
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('Test Rule');
      expect(rule?.enabled).toBe(true);
      expect(rule?.severity).toBe('medium');

      // Update rule
      const updated = alertingService.updateRule(ruleId, { enabled: false });
      expect(updated).toBe(true);

      const updatedRule = alertingService.getRule(ruleId);
      expect(updatedRule?.enabled).toBe(false);

      // Delete rule
      const deleted = alertingService.deleteRule(ruleId);
      expect(deleted).toBe(true);

      const deletedRule = alertingService.getRule(ruleId);
      expect(deletedRule).toBeUndefined();
    });

    it('should manage alert instances', () => {
      // Create a rule first
      const ruleId = alertingService.createRule({
        name: 'Instance Test Rule',
        description: 'Rule for testing alert instances',
        enabled: true,
        conditions: [{
          type: 'metric',
          metric: 'test.metric',
          operator: 'gt',
          threshold: 50,
          timeWindow: 1
        }],
        actions: [{
          type: 'log',
          config: { level: 'info' },
          enabled: true
        }],
        cooldownMinutes: 1,
        severity: 'low'
      });

      // Trigger a test alert
      const alertId = alertingService.triggerTestAlert(ruleId);
      expect(alertId).toBeTruthy();

      // Get alerts
      const alerts = alertingService.getAlerts({ status: 'active' });
      expect(alerts.length).toBeGreaterThan(0);
      
      const alert = alerts.find(a => a.id === alertId);
      expect(alert).toBeDefined();
      expect(alert?.status).toBe('active');
      expect(alert?.severity).toBe('low');

      // Acknowledge alert
      const acknowledged = alertingService.acknowledgeAlert(alertId!, 'test-user');
      expect(acknowledged).toBe(true);

      // Resolve alert
      const resolved = alertingService.resolveAlert(alertId!, 'test-user');
      expect(resolved).toBe(true);

      // Clean up
      alertingService.deleteRule(ruleId);
    });

    it('should provide alerting statistics', () => {
      // Create some test rules and alerts
      const ruleId1 = alertingService.createRule({
        name: 'Stats Test Rule 1',
        description: 'Rule 1 for stats testing',
        enabled: true,
        conditions: [{ type: 'metric', metric: 'test', operator: 'gt', threshold: 1, timeWindow: 1 }],
        actions: [{ type: 'log', config: {}, enabled: true }],
        cooldownMinutes: 1,
        severity: 'high'
      });

      const ruleId2 = alertingService.createRule({
        name: 'Stats Test Rule 2',
        description: 'Rule 2 for stats testing',
        enabled: false,
        conditions: [{ type: 'metric', metric: 'test', operator: 'gt', threshold: 1, timeWindow: 1 }],
        actions: [{ type: 'log', config: {}, enabled: true }],
        cooldownMinutes: 1,
        severity: 'medium'
      });

      const alertId1 = alertingService.triggerTestAlert(ruleId1);
      const alertId2 = alertingService.triggerTestAlert(ruleId1);

      const stats = alertingService.getStats();
      
      expect(stats.totalRules).toBeGreaterThanOrEqual(2);
      expect(stats.activeRules).toBeGreaterThanOrEqual(1); // Only enabled rules
      expect(stats.totalAlerts).toBeGreaterThanOrEqual(2);
      expect(stats.activeAlerts).toBeGreaterThanOrEqual(2);
      expect(stats.alertsBySeverity.high).toBeGreaterThanOrEqual(2);

      // Clean up
      alertingService.deleteRule(ruleId1);
      alertingService.deleteRule(ruleId2);
    });
  });

  describe('DashboardService', () => {
    it('should create and manage dashboards', () => {
      const dashboardId = dashboardService.createDashboard({
        name: 'Test Dashboard',
        description: 'A test dashboard',
        widgets: [{
          id: 'widget-1',
          type: 'metric',
          title: 'Test Metric',
          config: { metric: 'test.metric' },
          position: { x: 0, y: 0, width: 4, height: 2 }
        }],
        isPublic: true,
        createdBy: 'test-user'
      });

      expect(dashboardId).toBeTruthy();

      const dashboard = dashboardService.getDashboard(dashboardId);
      expect(dashboard).toBeDefined();
      expect(dashboard?.name).toBe('Test Dashboard');
      expect(dashboard?.widgets.length).toBe(1);
      expect(dashboard?.isPublic).toBe(true);

      // Update dashboard
      const updated = dashboardService.updateDashboard(dashboardId, {
        description: 'Updated description'
      });
      expect(updated).toBe(true);

      const updatedDashboard = dashboardService.getDashboard(dashboardId);
      expect(updatedDashboard?.description).toBe('Updated description');

      // Get dashboards list
      const dashboards = dashboardService.getDashboards();
      expect(dashboards.length).toBeGreaterThan(0);
      expect(dashboards.some(d => d.id === dashboardId)).toBe(true);

      // Delete dashboard
      const deleted = dashboardService.deleteDashboard(dashboardId);
      expect(deleted).toBe(true);

      const deletedDashboard = dashboardService.getDashboard(dashboardId);
      expect(deletedDashboard).toBeUndefined();
    });

    it('should provide comprehensive dashboard data', async () => {
      // Generate some test data
      observabilityService.recordMetric('dashboard.test', 100);
      observabilityService.trackUserEvent({
        sessionId: 'dashboard-session',
        event: 'test_event',
        properties: {}
      });
      logAggregationService.info('Dashboard test log', 'dashboard-service');

      const dashboardData = await dashboardService.getDashboardData();

      expect(dashboardData).toHaveProperty('systemHealth');
      expect(dashboardData).toHaveProperty('performance');
      expect(dashboardData).toHaveProperty('business');
      expect(dashboardData).toHaveProperty('alerts');
      expect(dashboardData).toHaveProperty('logs');

      expect(dashboardData.systemHealth.status).toMatch(/healthy|degraded|unhealthy/);
      expect(dashboardData.systemHealth.uptime).toBeGreaterThan(0);
      expect(dashboardData.performance.current).toBeDefined();
      expect(dashboardData.business.userActivity).toBeDefined();
      expect(dashboardData.alerts.active).toBeDefined();
      expect(dashboardData.logs.recent).toBeDefined();
    });

    it('should export and import dashboards', () => {
      const dashboardId = dashboardService.createDashboard({
        name: 'Export Test Dashboard',
        description: 'Dashboard for export testing',
        widgets: [{
          id: 'export-widget',
          type: 'chart',
          title: 'Export Chart',
          config: { metric: 'export.metric', chartType: 'line' },
          position: { x: 0, y: 0, width: 6, height: 4 }
        }],
        isPublic: false,
        createdBy: 'export-user'
      });

      // Export dashboard
      const exportedJson = dashboardService.exportDashboard(dashboardId);
      expect(exportedJson).toBeTruthy();
      expect(() => JSON.parse(exportedJson!)).not.toThrow();

      const exportedData = JSON.parse(exportedJson!);
      expect(exportedData.name).toBe('Export Test Dashboard');
      expect(exportedData.widgets.length).toBe(1);

      // Import dashboard
      const importedId = dashboardService.importDashboard(exportedJson!, 'import-user');
      expect(importedId).toBeTruthy();

      const importedDashboard = dashboardService.getDashboard(importedId!);
      expect(importedDashboard).toBeDefined();
      expect(importedDashboard?.name).toBe('Export Test Dashboard');
      expect(importedDashboard?.createdBy).toBe('import-user'); // Should update creator
      expect(importedDashboard?.id).not.toBe(dashboardId); // Should have new ID

      // Clean up
      dashboardService.deleteDashboard(dashboardId);
      dashboardService.deleteDashboard(importedId!);
    });
  });

  describe('Integration Tests', () => {
    it('should handle a complete monitoring workflow', async () => {
      const userId = 'integration-user';
      const sessionId = 'integration-session';

      // 1. Start user journey
      observabilityService.trackUserEvent({
        userId,
        sessionId,
        event: 'consultation_started',
        properties: { source: 'test' }
      });

      logAggregationService.info('User started consultation', 'consultation-service', {
        userId,
        sessionId
      });

      // 2. Process with metrics
      const transactionId = observabilityService.startTransaction('test.workflow');
      observabilityService.recordMetric('workflow.step', 1, { userId });

      await new Promise(resolve => setTimeout(resolve, 50));

      observabilityService.endTransaction(transactionId);
      observabilityService.recordMetric('workflow.success', 1, { userId });

      // 3. Complete journey
      observabilityService.trackUserEvent({
        userId,
        sessionId,
        event: 'workflow_completed',
        properties: { duration: 50 }
      });

      logAggregationService.info('Workflow completed', 'workflow-service', {
        userId,
        sessionId,
        duration: 50
      });

      // 4. Verify all data is captured
      const dashboardData = await dashboardService.getDashboardData();
      expect(dashboardData.business.userActivity.activeUsers).toBeGreaterThan(0);

      const logs = logAggregationService.correlateLogs(sessionId);
      expect(logs.length).toBe(2);
      expect(logs.every(log => log.sessionId === sessionId)).toBe(true);

      const observabilityData = observabilityService.getDashboardData();
      expect(observabilityData.metrics['workflow.step']).toBeDefined();
      expect(observabilityData.metrics['workflow.success']).toBeDefined();
      expect(observabilityData.metrics['transaction.duration']).toBeDefined();

      const funnel = observabilityService.getUserFunnel([
        'consultation_started',
        'workflow_completed'
      ]);
      expect(funnel.consultation_started).toBe(1);
      expect(funnel.workflow_completed).toBe(1);
    });

    it('should handle error scenarios with proper monitoring', async () => {
      const sessionId = 'error-session';
      const error = new Error('Test workflow error');

      // Log error
      logAggregationService.error('Workflow failed', 'workflow-service', error, {
        sessionId,
        operation: 'test-operation'
      });

      // Record error metric
      observabilityService.recordMetric('workflow.error', 1, {
        errorType: error.name
      });

      // Create alert
      const alertId = observabilityService.createAlert({
        severity: 'medium',
        title: 'Workflow Error',
        description: `Workflow failed: ${error.message}`,
        source: 'integration-test'
      });

      // Verify error monitoring
      const errorLogs = logAggregationService.search({
        level: ['error'],
        sessionId
      });
      expect(errorLogs.logs.length).toBe(1);
      expect(errorLogs.logs[0].message).toBe('Workflow failed');
      expect(errorLogs.logs[0].stackTrace).toBeTruthy();

      const observabilityData = observabilityService.getDashboardData();
      expect(observabilityData.metrics['workflow.error']).toBeDefined();
      expect(observabilityData.activeAlerts.length).toBeGreaterThan(0);

      const alert = observabilityData.activeAlerts.find(a => a.id === alertId);
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('medium');
    });
  });
});
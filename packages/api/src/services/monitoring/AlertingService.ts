import { EventEmitter } from 'events';
import { observabilityService, SystemAlert } from './ObservabilityService';
import { logAggregationService, LogEntry } from './LogAggregationService';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldownMinutes: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertCondition {
  type: 'metric' | 'log' | 'performance' | 'custom';
  metric?: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'not_contains';
  threshold: number | string;
  timeWindow: number; // minutes
  aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min';
}

export interface AlertAction {
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'log';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertRule['severity'];
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved' | 'suppressed';
  metadata: Record<string, any>;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface AlertingStats {
  totalRules: number;
  activeRules: number;
  totalAlerts: number;
  activeAlerts: number;
  alertsByRule: Record<string, number>;
  alertsBySeverity: Record<string, number>;
  meanTimeToResolve: number;
  falsePositiveRate: number;
}

export class AlertingService extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, AlertInstance> = new Map();
  private cooldowns: Map<string, Date> = new Map();
  private evaluationInterval = 60000; // 1 minute
  private evaluationTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupDefaultRules();
    this.startEvaluation();
    this.setupEventListeners();
  }

  // Rule Management
  createRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    const alertRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.rules.set(alertRule.id, alertRule);
    this.emit('ruleCreated', alertRule);
    
    return alertRule.id;
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: new Date()
    };

    this.rules.set(ruleId, updatedRule);
    this.emit('ruleUpdated', updatedRule);
    
    return true;
  }

  deleteRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    this.rules.delete(ruleId);
    this.cooldowns.delete(ruleId);
    
    // Resolve any active alerts for this rule
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.ruleId === ruleId && alert.status === 'active') {
        this.resolveAlert(alertId, 'Rule deleted');
      }
    }

    this.emit('ruleDeleted', rule);
    return true;
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  // Alert Management
  getAlerts(filters?: {
    status?: AlertInstance['status'];
    severity?: AlertRule['severity'];
    ruleId?: string;
    startTime?: Date;
    endTime?: Date;
  }): AlertInstance[] {
    let alerts = Array.from(this.alerts.values());

    if (filters) {
      if (filters.status) {
        alerts = alerts.filter(a => a.status === filters.status);
      }
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters.ruleId) {
        alerts = alerts.filter(a => a.ruleId === filters.ruleId);
      }
      if (filters.startTime) {
        alerts = alerts.filter(a => a.triggeredAt >= filters.startTime!);
      }
      if (filters.endTime) {
        alerts = alerts.filter(a => a.triggeredAt <= filters.endTime!);
      }
    }

    return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'active') return false;

    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.emit('alertAcknowledged', alert);
    return true;
  }

  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status === 'resolved') return false;

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.metadata.resolvedBy = resolvedBy;

    this.emit('alertResolved', alert);
    return true;
  }

  suppressAlert(alertId: string, suppressedBy: string, reason: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'suppressed';
    alert.metadata.suppressedBy = suppressedBy;
    alert.metadata.suppressionReason = reason;

    this.emit('alertSuppressed', alert);
    return true;
  }

  // Statistics and Analytics
  getStats(): AlertingStats {
    const alerts = Array.from(this.alerts.values());
    const rules = Array.from(this.rules.values());

    const activeAlerts = alerts.filter(a => a.status === 'active');
    const resolvedAlerts = alerts.filter(a => a.status === 'resolved');

    const alertsByRule: Record<string, number> = {};
    const alertsBySeverity: Record<string, number> = {};

    alerts.forEach(alert => {
      alertsByRule[alert.ruleName] = (alertsByRule[alert.ruleName] || 0) + 1;
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
    });

    // Calculate mean time to resolve
    const resolutionTimes = resolvedAlerts
      .filter(a => a.resolvedAt)
      .map(a => a.resolvedAt!.getTime() - a.triggeredAt.getTime());
    
    const meanTimeToResolve = resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
      : 0;

    // Estimate false positive rate (alerts resolved within 5 minutes)
    const quickResolutions = resolvedAlerts.filter(a => 
      a.resolvedAt && (a.resolvedAt.getTime() - a.triggeredAt.getTime()) < 300000
    );
    const falsePositiveRate = resolvedAlerts.length > 0
      ? quickResolutions.length / resolvedAlerts.length
      : 0;

    return {
      totalRules: rules.length,
      activeRules: rules.filter(r => r.enabled).length,
      totalAlerts: alerts.length,
      activeAlerts: activeAlerts.length,
      alertsByRule,
      alertsBySeverity,
      meanTimeToResolve,
      falsePositiveRate
    };
  }

  // Manual alert triggering for testing
  triggerTestAlert(ruleId: string): string | null {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    return this.createAlert(rule, 'Test alert triggered manually', {
      test: true,
      triggeredBy: 'manual'
    });
  }

  private setupDefaultRules(): void {
    // High error rate rule
    this.createRule({
      name: 'High Error Rate',
      description: 'Triggers when error rate exceeds 5% over 5 minutes',
      enabled: true,
      conditions: [{
        type: 'metric',
        metric: 'request.error',
        operator: 'gt',
        threshold: 0.05,
        timeWindow: 5,
        aggregation: 'avg'
      }],
      actions: [{
        type: 'log',
        config: { level: 'error' },
        enabled: true
      }],
      cooldownMinutes: 15,
      severity: 'high',
      tags: ['performance', 'errors']
    });

    // High response time rule
    this.createRule({
      name: 'High Response Time',
      description: 'Triggers when average response time exceeds 5 seconds',
      enabled: true,
      conditions: [{
        type: 'performance',
        metric: 'responseTime',
        operator: 'gt',
        threshold: 5000,
        timeWindow: 5,
        aggregation: 'avg'
      }],
      actions: [{
        type: 'log',
        config: { level: 'warn' },
        enabled: true
      }],
      cooldownMinutes: 10,
      severity: 'medium',
      tags: ['performance']
    });

    // Critical error pattern rule
    this.createRule({
      name: 'Critical Error Pattern',
      description: 'Triggers on fatal errors or database connection failures',
      enabled: true,
      conditions: [{
        type: 'log',
        operator: 'contains',
        threshold: 'fatal',
        timeWindow: 1,
        aggregation: 'count'
      }],
      actions: [{
        type: 'log',
        config: { level: 'error' },
        enabled: true
      }],
      cooldownMinutes: 5,
      severity: 'critical',
      tags: ['critical', 'errors']
    });

    // AI generation failure rule
    this.createRule({
      name: 'AI Generation Failures',
      description: 'Triggers when AI deck generation fails repeatedly',
      enabled: true,
      conditions: [{
        type: 'metric',
        metric: 'ai.generation.failure',
        operator: 'gt',
        threshold: 5,
        timeWindow: 10,
        aggregation: 'sum'
      }],
      actions: [{
        type: 'log',
        config: { level: 'error' },
        enabled: true
      }],
      cooldownMinutes: 20,
      severity: 'high',
      tags: ['ai', 'generation']
    });
  }

  private startEvaluation(): void {
    this.evaluationTimer = setInterval(() => {
      this.evaluateRules();
    }, this.evaluationInterval);
  }

  private evaluateRules(): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (this.isInCooldown(rule.id)) continue;

      try {
        const shouldTrigger = this.evaluateRule(rule);
        if (shouldTrigger) {
          const message = this.generateAlertMessage(rule);
          const metadata = this.gatherAlertMetadata(rule);
          
          this.createAlert(rule, message, metadata);
          this.setCooldown(rule.id, rule.cooldownMinutes);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.name}:`, error);
      }
    }
  }

  private evaluateRule(rule: AlertRule): boolean {
    return rule.conditions.every(condition => this.evaluateCondition(condition));
  }

  private evaluateCondition(condition: AlertCondition): boolean {
    const timeWindowMs = condition.timeWindow * 60 * 1000;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeWindowMs);

    switch (condition.type) {
      case 'metric':
        return this.evaluateMetricCondition(condition, startTime, endTime);
      
      case 'log':
        return this.evaluateLogCondition(condition, startTime, endTime);
      
      case 'performance':
        return this.evaluatePerformanceCondition(condition);
      
      default:
        return false;
    }
  }

  private evaluateMetricCondition(condition: AlertCondition, startTime: Date, endTime: Date): boolean {
    if (!condition.metric) return false;

    const metrics = observabilityService.getMetricsByTimeRange(condition.metric, startTime, endTime);
    if (metrics.length === 0) return false;

    let value: number;
    
    switch (condition.aggregation) {
      case 'sum':
        value = metrics.reduce((sum, m) => sum + m.value, 0);
        break;
      case 'avg':
        value = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
        break;
      case 'count':
        value = metrics.length;
        break;
      case 'max':
        value = Math.max(...metrics.map(m => m.value));
        break;
      case 'min':
        value = Math.min(...metrics.map(m => m.value));
        break;
      default:
        value = metrics[metrics.length - 1].value; // Latest value
    }

    return this.compareValues(value, condition.operator, Number(condition.threshold));
  }

  private evaluateLogCondition(condition: AlertCondition, startTime: Date, endTime: Date): boolean {
    const logs = logAggregationService.search({
      startTime,
      endTime,
      search: typeof condition.threshold === 'string' ? condition.threshold : undefined
    });

    const value = logs.logs.length;
    const threshold = typeof condition.threshold === 'number' ? condition.threshold : 1;

    return this.compareValues(value, condition.operator, threshold);
  }

  private evaluatePerformanceCondition(condition: AlertCondition): boolean {
    const dashboardData = observabilityService.getDashboardData();
    const latestMetrics = dashboardData.performanceMetrics[dashboardData.performanceMetrics.length - 1];
    
    if (!latestMetrics) return false;

    let value: number;
    switch (condition.metric) {
      case 'responseTime':
        value = latestMetrics.responseTime;
        break;
      case 'errorRate':
        value = latestMetrics.errorRate;
        break;
      case 'memoryUsage':
        value = latestMetrics.memoryUsage;
        break;
      case 'cpuUsage':
        value = latestMetrics.cpuUsage;
        break;
      default:
        return false;
    }

    return this.compareValues(value, condition.operator, Number(condition.threshold));
  }

  private compareValues(value: number | string, operator: AlertCondition['operator'], threshold: number | string): boolean {
    switch (operator) {
      case 'gt':
        return Number(value) > Number(threshold);
      case 'gte':
        return Number(value) >= Number(threshold);
      case 'lt':
        return Number(value) < Number(threshold);
      case 'lte':
        return Number(value) <= Number(threshold);
      case 'eq':
        return value === threshold;
      case 'contains':
        return String(value).includes(String(threshold));
      case 'not_contains':
        return !String(value).includes(String(threshold));
      default:
        return false;
    }
  }

  private createAlert(rule: AlertRule, message: string, metadata: Record<string, any>): string {
    const alert: AlertInstance = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message,
      triggeredAt: new Date(),
      status: 'active',
      metadata
    };

    this.alerts.set(alert.id, alert);
    this.executeActions(rule.actions, alert);
    this.emit('alertTriggered', alert);

    return alert.id;
  }

  private executeActions(actions: AlertAction[], alert: AlertInstance): void {
    actions.forEach(action => {
      if (!action.enabled) return;

      try {
        switch (action.type) {
          case 'log':
            logAggregationService.log({
              level: action.config.level || 'warn',
              message: `ALERT: ${alert.message}`,
              source: 'alerting-service',
              metadata: {
                alertId: alert.id,
                ruleName: alert.ruleName,
                severity: alert.severity,
                ...alert.metadata
              }
            });
            break;

          case 'webhook':
            // In a real implementation, this would make HTTP requests
            console.log('Webhook alert:', alert);
            break;

          case 'email':
            // In a real implementation, this would send emails
            console.log('Email alert:', alert);
            break;

          case 'slack':
            // In a real implementation, this would send Slack messages
            console.log('Slack alert:', alert);
            break;

          default:
            console.warn(`Unknown alert action type: ${action.type}`);
        }
      } catch (error) {
        console.error(`Error executing alert action ${action.type}:`, error);
      }
    });
  }

  private generateAlertMessage(rule: AlertRule): string {
    return `Alert triggered: ${rule.name} - ${rule.description}`;
  }

  private gatherAlertMetadata(rule: AlertRule): Record<string, any> {
    const dashboardData = observabilityService.getDashboardData();
    
    return {
      ruleConditions: rule.conditions,
      systemMetrics: dashboardData.performanceMetrics.slice(-1)[0],
      recentErrors: dashboardData.recentEvents.filter(e => e.event.includes('error')).slice(-5),
      timestamp: new Date().toISOString()
    };
  }

  private isInCooldown(ruleId: string): boolean {
    const cooldownEnd = this.cooldowns.get(ruleId);
    return cooldownEnd ? new Date() < cooldownEnd : false;
  }

  private setCooldown(ruleId: string, minutes: number): void {
    const cooldownEnd = new Date(Date.now() + minutes * 60 * 1000);
    this.cooldowns.set(ruleId, cooldownEnd);
  }

  private setupEventListeners(): void {
    // Listen for critical system events
    observabilityService.on('criticalAlert', (alert: SystemAlert) => {
      // Auto-create alert instance for critical system alerts
      const rule = Array.from(this.rules.values()).find(r => 
        r.name === 'Critical System Alert' || r.severity === 'critical'
      );

      if (rule) {
        this.createAlert(rule, alert.description, {
          systemAlert: true,
          originalAlertId: alert.id,
          source: alert.source
        });
      }
    });

    // Listen for error logs
    logAggregationService.on('errorLog', (log: LogEntry) => {
      if (log.level === 'fatal') {
        const rule = Array.from(this.rules.values()).find(r => 
          r.name === 'Critical Error Pattern'
        );

        if (rule && !this.isInCooldown(rule.id)) {
          this.createAlert(rule, `Fatal error: ${log.message}`, {
            logEntry: log,
            autoTriggered: true
          });
          this.setCooldown(rule.id, 5); // 5 minute cooldown for fatal errors
        }
      }
    });
  }

  destroy(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }
    this.removeAllListeners();
  }
}

export const alertingService = new AlertingService();
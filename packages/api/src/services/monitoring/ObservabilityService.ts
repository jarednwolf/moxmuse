import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export interface BusinessMetric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface UserBehaviorEvent {
  userId?: string;
  sessionId: string;
  event: string;
  properties: Record<string, any>;
  timestamp: Date;
  page?: string;
  userAgent?: string;
}

export interface SystemAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  timestamp: Date;
}

export class ObservabilityService extends EventEmitter {
  private metrics: Map<string, BusinessMetric[]> = new Map();
  private userEvents: UserBehaviorEvent[] = [];
  private alerts: SystemAlert[] = [];
  private performanceData: PerformanceMetrics[] = [];
  private activeTransactions: Map<string, { startTime: number; name: string }> = new Map();

  constructor() {
    super();
    this.startPerformanceCollection();
  }

  // Business Metrics Collection
  recordMetric(name: string, value: number, tags?: Record<string, string>, type: BusinessMetric['type'] = 'counter'): void {
    const metric: BusinessMetric = {
      name,
      value,
      tags,
      timestamp: new Date(),
      type
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);
    
    // Keep only last 1000 metrics per type
    const metricArray = this.metrics.get(name)!;
    if (metricArray.length > 1000) {
      metricArray.shift();
    }

    this.emit('metric', metric);
  }

  // User Behavior Analytics
  trackUserEvent(event: Omit<UserBehaviorEvent, 'timestamp'>): void {
    const userEvent: UserBehaviorEvent = {
      ...event,
      timestamp: new Date()
    };

    this.userEvents.push(userEvent);
    
    // Keep only last 10000 events
    if (this.userEvents.length > 10000) {
      this.userEvents.shift();
    }

    this.emit('userEvent', userEvent);

    // Track conversion events
    if (this.isConversionEvent(event.event)) {
      this.recordMetric('conversion', 1, {
        event: event.event,
        userId: event.userId || 'anonymous'
      });
    }
  }

  // Performance Monitoring
  startTransaction(name: string): string {
    const transactionId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.activeTransactions.set(transactionId, {
      startTime: performance.now(),
      name
    });

    return transactionId;
  }

  endTransaction(transactionId: string): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return;

    const duration = performance.now() - transaction.startTime;
    
    this.recordMetric('transaction.duration', duration, {
      name: transaction.name
    }, 'timer');

    this.activeTransactions.delete(transactionId);
  }

  // System Health Monitoring
  createAlert(alert: Omit<SystemAlert, 'id' | 'timestamp' | 'resolved'>): string {
    const systemAlert: SystemAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(systemAlert);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }

    this.emit('alert', systemAlert);

    // Auto-escalate critical alerts
    if (alert.severity === 'critical') {
      this.emit('criticalAlert', systemAlert);
    }

    return systemAlert.id;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  // Dashboard Data
  getDashboardData(): {
    metrics: Record<string, BusinessMetric[]>;
    recentEvents: UserBehaviorEvent[];
    activeAlerts: SystemAlert[];
    performanceMetrics: PerformanceMetrics[];
  } {
    return {
      metrics: Object.fromEntries(this.metrics),
      recentEvents: this.userEvents.slice(-100),
      activeAlerts: this.alerts.filter(a => !a.resolved),
      performanceMetrics: this.performanceData.slice(-100)
    };
  }

  // Analytics Queries
  getMetricsByTimeRange(name: string, startTime: Date, endTime: Date): BusinessMetric[] {
    const metrics = this.metrics.get(name) || [];
    return metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  getUserFunnel(events: string[]): Record<string, number> {
    const funnel: Record<string, number> = {};
    
    events.forEach(event => {
      funnel[event] = this.userEvents.filter(e => e.event === event).length;
    });

    return funnel;
  }

  getConversionRate(fromEvent: string, toEvent: string, timeWindowMs: number = 3600000): number {
    const fromEvents = this.userEvents.filter(e => e.event === fromEvent);
    const toEvents = this.userEvents.filter(e => e.event === toEvent);

    let conversions = 0;

    fromEvents.forEach(fromEvent => {
      const hasConversion = toEvents.some(toEvent => 
        toEvent.sessionId === fromEvent.sessionId &&
        toEvent.timestamp.getTime() - fromEvent.timestamp.getTime() <= timeWindowMs &&
        toEvent.timestamp > fromEvent.timestamp
      );

      if (hasConversion) conversions++;
    });

    return fromEvents.length > 0 ? conversions / fromEvents.length : 0;
  }

  private startPerformanceCollection(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      
      const performanceMetric: PerformanceMetrics = {
        responseTime: this.getAverageResponseTime(),
        throughput: this.getThroughput(),
        errorRate: this.getErrorRate(),
        cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
        memoryUsage: memUsage.heapUsed / memUsage.heapTotal,
        activeConnections: this.activeTransactions.size,
        timestamp: new Date()
      };

      this.performanceData.push(performanceMetric);
      
      // Keep only last 1000 performance metrics
      if (this.performanceData.length > 1000) {
        this.performanceData.shift();
      }

      this.emit('performanceMetric', performanceMetric);

      // Check for performance alerts
      this.checkPerformanceAlerts(performanceMetric);
    }, 30000); // Every 30 seconds
  }

  private getAverageResponseTime(): number {
    const recentTransactions = this.metrics.get('transaction.duration') || [];
    const recent = recentTransactions.slice(-100);
    
    if (recent.length === 0) return 0;
    
    const sum = recent.reduce((acc, metric) => acc + metric.value, 0);
    return sum / recent.length;
  }

  private getThroughput(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentRequests = this.metrics.get('request.count') || [];
    return recentRequests.filter(m => 
      m.timestamp.getTime() > oneMinuteAgo
    ).length;
  }

  private getErrorRate(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentRequests = this.metrics.get('request.count') || [];
    const recentErrors = this.metrics.get('request.error') || [];
    
    const requestCount = recentRequests.filter(m => 
      m.timestamp.getTime() > oneMinuteAgo
    ).length;
    
    const errorCount = recentErrors.filter(m => 
      m.timestamp.getTime() > oneMinuteAgo
    ).length;

    return requestCount > 0 ? errorCount / requestCount : 0;
  }

  private checkPerformanceAlerts(metrics: PerformanceMetrics): void {
    // High response time alert
    if (metrics.responseTime > 5000) { // 5 seconds
      this.createAlert({
        severity: 'high',
        title: 'High Response Time',
        description: `Average response time is ${metrics.responseTime.toFixed(2)}ms`,
        source: 'performance-monitor'
      });
    }

    // High error rate alert
    if (metrics.errorRate > 0.05) { // 5%
      this.createAlert({
        severity: 'high',
        title: 'High Error Rate',
        description: `Error rate is ${(metrics.errorRate * 100).toFixed(2)}%`,
        source: 'performance-monitor'
      });
    }

    // High memory usage alert
    if (metrics.memoryUsage > 0.9) { // 90%
      this.createAlert({
        severity: 'medium',
        title: 'High Memory Usage',
        description: `Memory usage is ${(metrics.memoryUsage * 100).toFixed(2)}%`,
        source: 'performance-monitor'
      });
    }
  }

  private isConversionEvent(event: string): boolean {
    const conversionEvents = [
      'deck_generated',
      'deck_exported',
      'user_registered',
      'consultation_completed',
      'deck_saved'
    ];
    
    return conversionEvents.includes(event);
  }
}

export const observabilityService = new ObservabilityService();
import { observabilityService, BusinessMetric, UserBehaviorEvent, PerformanceMetrics } from './ObservabilityService';
import { logAggregationService, LogStatistics } from './LogAggregationService';
import { alertingService, AlertingStats, AlertInstance } from './AlertingService';

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'log' | 'custom';
  title: string;
  description?: string;
  config: Record<string, any>;
  position: { x: number; y: number; width: number; height: number };
  refreshInterval?: number; // seconds
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface DashboardData {
  // System Overview
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    version: string;
    lastDeployment: Date;
  };

  // Performance Metrics
  performance: {
    current: PerformanceMetrics;
    trends: PerformanceMetrics[];
    sla: {
      availability: number;
      responseTime: number;
      errorRate: number;
    };
  };

  // Business Metrics
  business: {
    deckGenerations: {
      total: number;
      successful: number;
      failed: number;
      averageTime: number;
      trends: Array<{ date: Date; count: number; success: number }>;
    };
    userActivity: {
      activeUsers: number;
      newUsers: number;
      sessions: number;
      conversionRate: number;
      funnel: Record<string, number>;
    };
    revenue: {
      total: number;
      recurring: number;
      trends: Array<{ date: Date; amount: number }>;
    };
  };

  // Technical Metrics
  technical: {
    apiCalls: {
      total: number;
      byEndpoint: Record<string, number>;
      errorsByEndpoint: Record<string, number>;
      responseTimesByEndpoint: Record<string, number>;
    };
    database: {
      connections: number;
      queryTime: number;
      slowQueries: number;
      deadlocks: number;
    };
    cache: {
      hitRate: number;
      missRate: number;
      evictions: number;
      memory: number;
    };
  };

  // Alerts and Logs
  alerts: {
    active: AlertInstance[];
    recent: AlertInstance[];
    stats: AlertingStats;
  };

  logs: {
    recent: Array<{ timestamp: Date; level: string; message: string; source: string }>;
    stats: LogStatistics;
    errorTrends: Array<{ timestamp: Date; count: number }>;
  };
}

export interface RealtimeUpdate {
  type: 'metric' | 'alert' | 'log' | 'performance';
  data: any;
  timestamp: Date;
}

export class DashboardService {
  private dashboards: Map<string, Dashboard> = new Map();
  private realtimeSubscriptions: Map<string, Set<(update: RealtimeUpdate) => void>> = new Map();

  constructor() {
    this.setupDefaultDashboards();
    this.setupRealtimeUpdates();
  }

  // Dashboard Management
  createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): string {
    const newDashboard: Dashboard = {
      ...dashboard,
      id: `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dashboards.set(newDashboard.id, newDashboard);
    return newDashboard.id;
  }

  updateDashboard(dashboardId: string, updates: Partial<Dashboard>): boolean {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return false;

    const updatedDashboard = {
      ...dashboard,
      ...updates,
      updatedAt: new Date()
    };

    this.dashboards.set(dashboardId, updatedDashboard);
    return true;
  }

  deleteDashboard(dashboardId: string): boolean {
    return this.dashboards.delete(dashboardId);
  }

  getDashboard(dashboardId: string): Dashboard | undefined {
    return this.dashboards.get(dashboardId);
  }

  getDashboards(userId?: string): Dashboard[] {
    const dashboards = Array.from(this.dashboards.values());
    
    if (userId) {
      return dashboards.filter(d => d.createdBy === userId || d.isPublic);
    }
    
    return dashboards.filter(d => d.isPublic);
  }

  // Data Aggregation
  async getDashboardData(timeRange?: { start: Date; end: Date }): Promise<DashboardData> {
    const observabilityData = observabilityService.getDashboardData();
    const logStats = logAggregationService.getStatistics(timeRange);
    const alertStats = alertingService.getStats();
    const alerts = alertingService.getAlerts({ status: 'active' });

    return {
      systemHealth: await this.getSystemHealth(),
      performance: this.getPerformanceData(observabilityData.performanceMetrics),
      business: await this.getBusinessMetrics(timeRange),
      technical: await this.getTechnicalMetrics(timeRange),
      alerts: {
        active: alerts,
        recent: alertingService.getAlerts().slice(0, 10),
        stats: alertStats
      },
      logs: {
        recent: logAggregationService.search({ limit: 50 }).logs.map(log => ({
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
          source: log.source
        })),
        stats: logStats,
        errorTrends: this.calculateErrorTrends(timeRange)
      }
    };
  }

  // Widget Data
  getWidgetData(widgetId: string, widget: DashboardWidget, timeRange?: { start: Date; end: Date }): any {
    switch (widget.type) {
      case 'metric':
        return this.getMetricWidgetData(widget, timeRange);
      
      case 'chart':
        return this.getChartWidgetData(widget, timeRange);
      
      case 'table':
        return this.getTableWidgetData(widget, timeRange);
      
      case 'alert':
        return this.getAlertWidgetData(widget);
      
      case 'log':
        return this.getLogWidgetData(widget, timeRange);
      
      default:
        return null;
    }
  }

  // Real-time Updates
  subscribeToUpdates(dashboardId: string, callback: (update: RealtimeUpdate) => void): () => void {
    if (!this.realtimeSubscriptions.has(dashboardId)) {
      this.realtimeSubscriptions.set(dashboardId, new Set());
    }

    this.realtimeSubscriptions.get(dashboardId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subscribers = this.realtimeSubscriptions.get(dashboardId);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.realtimeSubscriptions.delete(dashboardId);
        }
      }
    };
  }

  // Export and Import
  exportDashboard(dashboardId: string): string | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    return JSON.stringify(dashboard, null, 2);
  }

  importDashboard(dashboardJson: string, userId: string): string | null {
    try {
      const dashboard = JSON.parse(dashboardJson) as Dashboard;
      
      // Generate new ID and update metadata
      const importedDashboard: Dashboard = {
        ...dashboard,
        id: `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.dashboards.set(importedDashboard.id, importedDashboard);
      return importedDashboard.id;
    } catch (error) {
      console.error('Error importing dashboard:', error);
      return null;
    }
  }

  private async getSystemHealth(): Promise<DashboardData['systemHealth']> {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Determine health status based on various factors
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    const alertStats = alertingService.getStats();
    if (alertStats.activeAlerts > 0) {
      const criticalAlerts = alertingService.getAlerts({ severity: 'critical', status: 'active' });
      const highAlerts = alertingService.getAlerts({ severity: 'high', status: 'active' });
      
      if (criticalAlerts.length > 0) {
        status = 'unhealthy';
      } else if (highAlerts.length > 2) {
        status = 'degraded';
      }
    }

    return {
      status,
      uptime,
      version: process.env.npm_package_version || '1.0.0',
      lastDeployment: new Date() // In real implementation, this would come from deployment metadata
    };
  }

  private getPerformanceData(performanceMetrics: PerformanceMetrics[]): DashboardData['performance'] {
    const current = performanceMetrics[performanceMetrics.length - 1] || {
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      activeConnections: 0,
      timestamp: new Date()
    };

    // Calculate SLA metrics (last 24 hours)
    const last24Hours = performanceMetrics.filter(m => 
      Date.now() - m.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    const availability = last24Hours.length > 0 
      ? last24Hours.filter(m => m.errorRate < 0.01).length / last24Hours.length 
      : 1;

    const avgResponseTime = last24Hours.length > 0
      ? last24Hours.reduce((sum, m) => sum + m.responseTime, 0) / last24Hours.length
      : 0;

    const avgErrorRate = last24Hours.length > 0
      ? last24Hours.reduce((sum, m) => sum + m.errorRate, 0) / last24Hours.length
      : 0;

    return {
      current,
      trends: performanceMetrics.slice(-100), // Last 100 data points
      sla: {
        availability,
        responseTime: avgResponseTime,
        errorRate: avgErrorRate
      }
    };
  }

  private async getBusinessMetrics(timeRange?: { start: Date; end: Date }): Promise<DashboardData['business']> {
    const observabilityData = observabilityService.getDashboardData();
    
    // Deck generation metrics
    const deckGenerationMetrics = observabilityData.metrics['ai.generation.success'] || [];
    const deckGenerationFailures = observabilityData.metrics['ai.generation.failure'] || [];
    
    const totalGenerations = deckGenerationMetrics.length + deckGenerationFailures.length;
    const successfulGenerations = deckGenerationMetrics.length;
    const failedGenerations = deckGenerationFailures.length;

    const generationTimes = observabilityData.metrics['ai.generation.duration'] || [];
    const averageTime = generationTimes.length > 0
      ? generationTimes.reduce((sum, m) => sum + m.value, 0) / generationTimes.length
      : 0;

    // User activity metrics
    const userEvents = observabilityData.recentEvents;
    const uniqueUsers = new Set(userEvents.map(e => e.userId).filter(Boolean)).size;
    const newUsers = userEvents.filter(e => e.event === 'user_registered').length;
    const sessions = new Set(userEvents.map(e => e.sessionId)).size;

    // Conversion funnel
    const funnel = observabilityService.getUserFunnel([
      'consultation_started',
      'consultation_completed',
      'deck_generated',
      'deck_saved',
      'deck_exported'
    ]);

    const conversionRate = observabilityService.getConversionRate('consultation_started', 'deck_generated');

    return {
      deckGenerations: {
        total: totalGenerations,
        successful: successfulGenerations,
        failed: failedGenerations,
        averageTime,
        trends: this.calculateDeckGenerationTrends(timeRange)
      },
      userActivity: {
        activeUsers: uniqueUsers,
        newUsers,
        sessions,
        conversionRate,
        funnel
      },
      revenue: {
        total: 0, // Would be calculated from actual revenue data
        recurring: 0,
        trends: []
      }
    };
  }

  private async getTechnicalMetrics(timeRange?: { start: Date; end: Date }): Promise<DashboardData['technical']> {
    const observabilityData = observabilityService.getDashboardData();
    
    // API metrics
    const apiCallMetrics = observabilityData.metrics['request.count'] || [];
    const apiErrorMetrics = observabilityData.metrics['request.error'] || [];
    
    const totalApiCalls = apiCallMetrics.length;
    const byEndpoint: Record<string, number> = {};
    const errorsByEndpoint: Record<string, number> = {};
    const responseTimesByEndpoint: Record<string, number> = {};

    // Group by endpoint (from tags)
    apiCallMetrics.forEach(metric => {
      const endpoint = metric.tags?.endpoint || 'unknown';
      byEndpoint[endpoint] = (byEndpoint[endpoint] || 0) + 1;
    });

    apiErrorMetrics.forEach(metric => {
      const endpoint = metric.tags?.endpoint || 'unknown';
      errorsByEndpoint[endpoint] = (errorsByEndpoint[endpoint] || 0) + 1;
    });

    return {
      apiCalls: {
        total: totalApiCalls,
        byEndpoint,
        errorsByEndpoint,
        responseTimesByEndpoint
      },
      database: {
        connections: 10, // Would come from actual DB monitoring
        queryTime: 50,
        slowQueries: 2,
        deadlocks: 0
      },
      cache: {
        hitRate: 0.85,
        missRate: 0.15,
        evictions: 100,
        memory: 256 * 1024 * 1024 // 256MB
      }
    };
  }

  private calculateErrorTrends(timeRange?: { start: Date; end: Date }): Array<{ timestamp: Date; count: number }> {
    const logStats = logAggregationService.getStatistics(timeRange);
    return logStats.recentTrends
      .filter(trend => trend.level === 'error' || trend.level === 'fatal')
      .map(trend => ({
        timestamp: trend.timestamp,
        count: trend.count
      }));
  }

  private calculateDeckGenerationTrends(timeRange?: { start: Date; end: Date }): Array<{ date: Date; count: number; success: number }> {
    // This would calculate actual trends from stored metrics
    // For now, return mock data
    const trends: Array<{ date: Date; count: number; success: number }> = [];
    const days = 7;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      trends.push({
        date,
        count: Math.floor(Math.random() * 100) + 50,
        success: Math.floor(Math.random() * 90) + 45
      });
    }
    
    return trends;
  }

  private getMetricWidgetData(widget: DashboardWidget, timeRange?: { start: Date; end: Date }): any {
    const metricName = widget.config.metric;
    if (!metricName) return null;

    const observabilityData = observabilityService.getDashboardData();
    const metrics = observabilityData.metrics[metricName] || [];

    let filteredMetrics = metrics;
    if (timeRange) {
      filteredMetrics = metrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    const aggregation = widget.config.aggregation || 'latest';
    let value: number;

    switch (aggregation) {
      case 'sum':
        value = filteredMetrics.reduce((sum, m) => sum + m.value, 0);
        break;
      case 'avg':
        value = filteredMetrics.length > 0 
          ? filteredMetrics.reduce((sum, m) => sum + m.value, 0) / filteredMetrics.length 
          : 0;
        break;
      case 'count':
        value = filteredMetrics.length;
        break;
      case 'max':
        value = filteredMetrics.length > 0 ? Math.max(...filteredMetrics.map(m => m.value)) : 0;
        break;
      case 'min':
        value = filteredMetrics.length > 0 ? Math.min(...filteredMetrics.map(m => m.value)) : 0;
        break;
      default:
        value = filteredMetrics.length > 0 ? filteredMetrics[filteredMetrics.length - 1].value : 0;
    }

    return {
      value,
      trend: this.calculateTrend(filteredMetrics),
      timestamp: new Date()
    };
  }

  private getChartWidgetData(widget: DashboardWidget, timeRange?: { start: Date; end: Date }): any {
    const metricName = widget.config.metric;
    if (!metricName) return null;

    const observabilityData = observabilityService.getDashboardData();
    const metrics = observabilityData.metrics[metricName] || [];

    let filteredMetrics = metrics;
    if (timeRange) {
      filteredMetrics = metrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    return {
      data: filteredMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.value,
        tags: m.tags
      })),
      chartType: widget.config.chartType || 'line'
    };
  }

  private getTableWidgetData(widget: DashboardWidget, timeRange?: { start: Date; end: Date }): any {
    const dataSource = widget.config.dataSource;
    
    switch (dataSource) {
      case 'logs':
        const logs = logAggregationService.search({
          limit: widget.config.limit || 50,
          startTime: timeRange?.start,
          endTime: timeRange?.end
        });
        return {
          columns: ['timestamp', 'level', 'source', 'message'],
          rows: logs.logs.map(log => [
            log.timestamp.toISOString(),
            log.level,
            log.source,
            log.message
          ])
        };
      
      case 'alerts':
        const alerts = alertingService.getAlerts({
          startTime: timeRange?.start,
          endTime: timeRange?.end
        });
        return {
          columns: ['timestamp', 'severity', 'rule', 'status', 'message'],
          rows: alerts.slice(0, widget.config.limit || 50).map(alert => [
            alert.triggeredAt.toISOString(),
            alert.severity,
            alert.ruleName,
            alert.status,
            alert.message
          ])
        };
      
      default:
        return { columns: [], rows: [] };
    }
  }

  private getAlertWidgetData(widget: DashboardWidget): any {
    const severity = widget.config.severity;
    const alerts = alertingService.getAlerts({
      status: 'active',
      severity: severity
    });

    return {
      alerts: alerts.slice(0, widget.config.limit || 10),
      count: alerts.length
    };
  }

  private getLogWidgetData(widget: DashboardWidget, timeRange?: { start: Date; end: Date }): any {
    const level = widget.config.level;
    const search = widget.config.search;

    const logs = logAggregationService.search({
      level: level ? [level] : undefined,
      search,
      startTime: timeRange?.start,
      endTime: timeRange?.end,
      limit: widget.config.limit || 100
    });

    return {
      logs: logs.logs,
      total: logs.total,
      hasMore: logs.hasMore
    };
  }

  private calculateTrend(metrics: BusinessMetric[]): 'up' | 'down' | 'stable' {
    if (metrics.length < 2) return 'stable';

    const recent = metrics.slice(-10); // Last 10 data points
    const older = metrics.slice(-20, -10); // Previous 10 data points

    if (recent.length === 0 || older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.value, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'stable';
  }

  private setupDefaultDashboards(): void {
    // System Overview Dashboard
    this.createDashboard({
      name: 'System Overview',
      description: 'High-level system health and performance metrics',
      isPublic: true,
      createdBy: 'system',
      widgets: [
        {
          id: 'system-health',
          type: 'metric',
          title: 'System Health',
          config: { metric: 'system.health', aggregation: 'latest' },
          position: { x: 0, y: 0, width: 3, height: 2 }
        },
        {
          id: 'response-time',
          type: 'chart',
          title: 'Response Time',
          config: { metric: 'transaction.duration', chartType: 'line' },
          position: { x: 3, y: 0, width: 6, height: 4 }
        },
        {
          id: 'active-alerts',
          type: 'alert',
          title: 'Active Alerts',
          config: { limit: 5 },
          position: { x: 9, y: 0, width: 3, height: 4 }
        },
        {
          id: 'error-logs',
          type: 'log',
          title: 'Recent Errors',
          config: { level: 'error', limit: 10 },
          position: { x: 0, y: 4, width: 12, height: 4 }
        }
      ]
    });

    // Business Metrics Dashboard
    this.createDashboard({
      name: 'Business Metrics',
      description: 'Key business and user engagement metrics',
      isPublic: true,
      createdBy: 'system',
      widgets: [
        {
          id: 'deck-generations',
          type: 'metric',
          title: 'Deck Generations Today',
          config: { metric: 'ai.generation.success', aggregation: 'count' },
          position: { x: 0, y: 0, width: 3, height: 2 }
        },
        {
          id: 'conversion-rate',
          type: 'metric',
          title: 'Conversion Rate',
          config: { metric: 'conversion', aggregation: 'avg' },
          position: { x: 3, y: 0, width: 3, height: 2 }
        },
        {
          id: 'user-funnel',
          type: 'chart',
          title: 'User Funnel',
          config: { dataSource: 'funnel', chartType: 'funnel' },
          position: { x: 6, y: 0, width: 6, height: 4 }
        }
      ]
    });
  }

  private setupRealtimeUpdates(): void {
    // Listen for new metrics
    observabilityService.on('metric', (metric: BusinessMetric) => {
      this.broadcastUpdate({
        type: 'metric',
        data: metric,
        timestamp: new Date()
      });
    });

    // Listen for new alerts
    alertingService.on('alertTriggered', (alert) => {
      this.broadcastUpdate({
        type: 'alert',
        data: alert,
        timestamp: new Date()
      });
    });

    // Listen for new logs
    logAggregationService.on('log', (log) => {
      if (log.level === 'error' || log.level === 'fatal') {
        this.broadcastUpdate({
          type: 'log',
          data: log,
          timestamp: new Date()
        });
      }
    });

    // Listen for performance updates
    observabilityService.on('performanceMetric', (metrics: PerformanceMetrics) => {
      this.broadcastUpdate({
        type: 'performance',
        data: metrics,
        timestamp: new Date()
      });
    });
  }

  private broadcastUpdate(update: RealtimeUpdate): void {
    for (const [dashboardId, subscribers] of this.realtimeSubscriptions.entries()) {
      subscribers.forEach(callback => {
        try {
          callback(update);
        } catch (error) {
          console.error(`Error broadcasting update to dashboard ${dashboardId}:`, error);
        }
      });
    }
  }
}

export const dashboardService = new DashboardService();
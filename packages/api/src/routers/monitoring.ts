import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { observabilityService } from '../services/monitoring/ObservabilityService';
import { logAggregationService } from '../services/monitoring/LogAggregationService';
import { alertingService } from '../services/monitoring/AlertingService';
import { dashboardService } from '../services/monitoring/DashboardService';

// Input validation schemas
const MetricInputSchema = z.object({
  name: z.string(),
  value: z.number(),
  tags: z.record(z.string()).optional(),
  type: z.enum(['counter', 'gauge', 'histogram', 'timer']).optional()
});

const UserEventInputSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string(),
  event: z.string(),
  properties: z.record(z.any()),
  page: z.string().optional(),
  userAgent: z.string().optional()
});

const LogQuerySchema = z.object({
  level: z.array(z.enum(['debug', 'info', 'warn', 'error', 'fatal'])).optional(),
  source: z.array(z.string()).optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  requestId: z.string().optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional()
});

const AlertRuleInputSchema = z.object({
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  conditions: z.array(z.object({
    type: z.enum(['metric', 'log', 'performance', 'custom']),
    metric: z.string().optional(),
    operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte', 'contains', 'not_contains']),
    threshold: z.union([z.number(), z.string()]),
    timeWindow: z.number(),
    aggregation: z.enum(['sum', 'avg', 'count', 'max', 'min']).optional()
  })),
  actions: z.array(z.object({
    type: z.enum(['email', 'slack', 'webhook', 'sms', 'log']),
    config: z.record(z.any()),
    enabled: z.boolean()
  })),
  cooldownMinutes: z.number(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  tags: z.array(z.string()).optional()
});

const DashboardInputSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  widgets: z.array(z.object({
    id: z.string(),
    type: z.enum(['metric', 'chart', 'table', 'alert', 'log', 'custom']),
    title: z.string(),
    description: z.string().optional(),
    config: z.record(z.any()),
    position: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    }),
    refreshInterval: z.number().optional()
  })),
  isPublic: z.boolean(),
  tags: z.array(z.string()).optional()
});

export const monitoringRouter = createTRPCRouter({
  // Metrics endpoints
  recordMetric: publicProcedure
    .input(MetricInputSchema)
    .mutation(async ({ input }) => {
      observabilityService.recordMetric(
        input.name,
        input.value,
        input.tags,
        input.type
      );
      return { success: true };
    }),

  getMetrics: publicProcedure
    .input(z.object({
      name: z.string(),
      startTime: z.date().optional(),
      endTime: z.date().optional()
    }))
    .query(async ({ input }) => {
      if (input.startTime && input.endTime) {
        return observabilityService.getMetricsByTimeRange(
          input.name,
          input.startTime,
          input.endTime
        );
      }
      
      const dashboardData = observabilityService.getDashboardData();
      return dashboardData.metrics[input.name] || [];
    }),

  // User behavior analytics
  trackUserEvent: publicProcedure
    .input(UserEventInputSchema)
    .mutation(async ({ input }) => {
      observabilityService.trackUserEvent(input);
      return { success: true };
    }),

  getUserFunnel: publicProcedure
    .input(z.object({
      events: z.array(z.string())
    }))
    .query(async ({ input }) => {
      return observabilityService.getUserFunnel(input.events);
    }),

  getConversionRate: publicProcedure
    .input(z.object({
      fromEvent: z.string(),
      toEvent: z.string(),
      timeWindowMs: z.number().optional()
    }))
    .query(async ({ input }) => {
      return observabilityService.getConversionRate(
        input.fromEvent,
        input.toEvent,
        input.timeWindowMs
      );
    }),

  // Performance monitoring
  startTransaction: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const transactionId = observabilityService.startTransaction(input.name);
      return { transactionId };
    }),

  endTransaction: publicProcedure
    .input(z.object({ transactionId: z.string() }))
    .mutation(async ({ input }) => {
      observabilityService.endTransaction(input.transactionId);
      return { success: true };
    }),

  // Logging endpoints
  searchLogs: publicProcedure
    .input(LogQuerySchema)
    .query(async ({ input }) => {
      return logAggregationService.search(input);
    }),

  getLogStatistics: publicProcedure
    .input(z.object({
      startTime: z.date().optional(),
      endTime: z.date().optional()
    }))
    .query(async ({ input }) => {
      const timeRange = input.startTime && input.endTime 
        ? { start: input.startTime, end: input.endTime }
        : undefined;
      
      return logAggregationService.getStatistics(timeRange);
    }),

  correlateLogs: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      return logAggregationService.correlateLogs(input.sessionId);
    }),

  findRelatedLogs: publicProcedure
    .input(z.object({
      logId: z.string(),
      contextMinutes: z.number().optional()
    }))
    .query(async ({ input }) => {
      return logAggregationService.findRelatedLogs(
        input.logId,
        input.contextMinutes
      );
    }),

  exportLogs: publicProcedure
    .input(LogQuerySchema.extend({
      format: z.enum(['json', 'csv', 'txt']).optional()
    }))
    .query(async ({ input }) => {
      const { format, ...query } = input;
      return logAggregationService.exportLogs(query, format);
    }),

  // Alert management
  createAlertRule: protectedProcedure
    .input(AlertRuleInputSchema)
    .mutation(async ({ input, ctx }) => {
      const ruleId = alertingService.createRule(input);
      return { ruleId };
    }),

  updateAlertRule: protectedProcedure
    .input(z.object({
      ruleId: z.string(),
      updates: AlertRuleInputSchema.partial()
    }))
    .mutation(async ({ input }) => {
      const success = alertingService.updateRule(input.ruleId, input.updates);
      return { success };
    }),

  deleteAlertRule: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(async ({ input }) => {
      const success = alertingService.deleteRule(input.ruleId);
      return { success };
    }),

  getAlertRules: publicProcedure
    .query(async () => {
      return alertingService.getRules();
    }),

  getAlerts: publicProcedure
    .input(z.object({
      status: z.enum(['active', 'resolved', 'suppressed']).optional(),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      ruleId: z.string().optional(),
      startTime: z.date().optional(),
      endTime: z.date().optional()
    }))
    .query(async ({ input }) => {
      return alertingService.getAlerts(input);
    }),

  acknowledgeAlert: protectedProcedure
    .input(z.object({
      alertId: z.string(),
      acknowledgedBy: z.string()
    }))
    .mutation(async ({ input }) => {
      const success = alertingService.acknowledgeAlert(
        input.alertId,
        input.acknowledgedBy
      );
      return { success };
    }),

  resolveAlert: protectedProcedure
    .input(z.object({
      alertId: z.string(),
      resolvedBy: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const success = alertingService.resolveAlert(
        input.alertId,
        input.resolvedBy
      );
      return { success };
    }),

  suppressAlert: protectedProcedure
    .input(z.object({
      alertId: z.string(),
      suppressedBy: z.string(),
      reason: z.string()
    }))
    .mutation(async ({ input }) => {
      const success = alertingService.suppressAlert(
        input.alertId,
        input.suppressedBy,
        input.reason
      );
      return { success };
    }),

  getAlertingStats: publicProcedure
    .query(async () => {
      return alertingService.getStats();
    }),

  triggerTestAlert: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(async ({ input }) => {
      const alertId = alertingService.triggerTestAlert(input.ruleId);
      return { alertId };
    }),

  // Dashboard management
  createDashboard: protectedProcedure
    .input(DashboardInputSchema)
    .mutation(async ({ input, ctx }) => {
      const dashboardId = dashboardService.createDashboard({
        ...input,
        createdBy: ctx.session.user.id
      });
      return { dashboardId };
    }),

  updateDashboard: protectedProcedure
    .input(z.object({
      dashboardId: z.string(),
      updates: DashboardInputSchema.partial()
    }))
    .mutation(async ({ input }) => {
      const success = dashboardService.updateDashboard(
        input.dashboardId,
        input.updates
      );
      return { success };
    }),

  deleteDashboard: protectedProcedure
    .input(z.object({ dashboardId: z.string() }))
    .mutation(async ({ input }) => {
      const success = dashboardService.deleteDashboard(input.dashboardId);
      return { success };
    }),

  getDashboard: publicProcedure
    .input(z.object({ dashboardId: z.string() }))
    .query(async ({ input }) => {
      return dashboardService.getDashboard(input.dashboardId);
    }),

  getDashboards: publicProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(async ({ input }) => {
      return dashboardService.getDashboards(input.userId);
    }),

  getDashboardData: publicProcedure
    .input(z.object({
      startTime: z.date().optional(),
      endTime: z.date().optional()
    }))
    .query(async ({ input }) => {
      const timeRange = input.startTime && input.endTime 
        ? { start: input.startTime, end: input.endTime }
        : undefined;
      
      return await dashboardService.getDashboardData(timeRange);
    }),

  getWidgetData: publicProcedure
    .input(z.object({
      widgetId: z.string(),
      widget: z.object({
        id: z.string(),
        type: z.enum(['metric', 'chart', 'table', 'alert', 'log', 'custom']),
        title: z.string(),
        description: z.string().optional(),
        config: z.record(z.any()),
        position: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number()
        }),
        refreshInterval: z.number().optional()
      }),
      startTime: z.date().optional(),
      endTime: z.date().optional()
    }))
    .query(async ({ input }) => {
      const timeRange = input.startTime && input.endTime 
        ? { start: input.startTime, end: input.endTime }
        : undefined;
      
      return dashboardService.getWidgetData(
        input.widgetId,
        input.widget,
        timeRange
      );
    }),

  exportDashboard: publicProcedure
    .input(z.object({ dashboardId: z.string() }))
    .query(async ({ input }) => {
      return dashboardService.exportDashboard(input.dashboardId);
    }),

  importDashboard: protectedProcedure
    .input(z.object({ dashboardJson: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const dashboardId = dashboardService.importDashboard(
        input.dashboardJson,
        ctx.session.user.id
      );
      return { dashboardId };
    }),

  // System health
  getSystemHealth: publicProcedure
    .query(async () => {
      const dashboardData = await dashboardService.getDashboardData();
      return dashboardData.systemHealth;
    }),

  // Real-time monitoring
  subscribeToUpdates: publicProcedure
    .input(z.object({ dashboardId: z.string() }))
    .subscription(async function* ({ input }) {
      // This would be implemented with WebSocket or Server-Sent Events
      // For now, we'll simulate with periodic updates
      const unsubscribe = dashboardService.subscribeToUpdates(
        input.dashboardId,
        (update) => {
          // In a real implementation, this would push to the subscription
          console.log('Real-time update:', update);
        }
      );

      try {
        while (true) {
          // Yield periodic updates
          const dashboardData = await dashboardService.getDashboardData();
          yield {
            type: 'dashboard_update',
            data: dashboardData,
            timestamp: new Date()
          };
          
          // Wait 30 seconds before next update
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      } finally {
        unsubscribe();
      }
    })
});
# Monitoring and Observability Platform

This comprehensive monitoring system provides real-time observability, alerting, and analytics for the AI Deck Building Tutor application.

## Overview

The monitoring platform consists of four main services:

1. **ObservabilityService** - Core metrics collection and user behavior tracking
2. **LogAggregationService** - Centralized logging with search and correlation
3. **AlertingService** - Rule-based alerting and notification system
4. **DashboardService** - Real-time dashboards and data visualization

## Features

### 📊 Business Metrics Collection
- Deck generation success/failure rates
- User conversion funnel tracking
- Performance metrics (response time, throughput, error rates)
- Custom business KPIs

### 📝 Comprehensive Logging
- Structured logging with metadata
- Log correlation by session/request ID
- Full-text search capabilities
- Multiple export formats (JSON, CSV, TXT)

### 🚨 Intelligent Alerting
- Rule-based alert conditions
- Multiple severity levels (low, medium, high, critical)
- Configurable actions (email, Slack, webhook, SMS)
- Alert cooldowns and suppression

### 📈 Real-time Dashboards
- Customizable dashboard widgets
- Real-time data updates
- Performance and business metrics visualization
- System health monitoring

## Quick Start

### Recording Metrics

```typescript
import { observabilityService } from '../services/monitoring/ObservabilityService';

// Record a simple counter
observabilityService.recordMetric('deck.generated', 1, {
  userId: 'user123',
  strategy: 'aggro'
});

// Record a timer metric
const transactionId = observabilityService.startTransaction('ai.generation');
// ... perform operation
observabilityService.endTransaction(transactionId);

// Track user behavior
observabilityService.trackUserEvent({
  userId: 'user123',
  sessionId: 'session456',
  event: 'consultation_completed',
  properties: {
    duration: 300,
    commander: 'Atraxa'
  }
});
```

### Logging

```typescript
import { logAggregationService } from '../services/monitoring/LogAggregationService';

// Basic logging
logAggregationService.info('User started consultation', 'consultation-service', {
  userId: 'user123',
  sessionId: 'session456'
});

// Error logging with stack trace
logAggregationService.error(
  'AI generation failed',
  'ai-service',
  new Error('OpenAI timeout'),
  { userId: 'user123', operation: 'generateDeck' }
);

// Search logs
const logs = logAggregationService.search({
  level: ['error'],
  startTime: new Date(Date.now() - 3600000), // Last hour
  search: 'timeout'
});

// Correlate logs by session
const sessionLogs = logAggregationService.correlateLogs('session456');
```

### Creating Alerts

```typescript
import { alertingService } from '../services/monitoring/AlertingService';

// Create an alert rule
const ruleId = alertingService.createRule({
  name: 'High Error Rate',
  description: 'Triggers when error rate exceeds 5%',
  enabled: true,
  conditions: [{
    type: 'metric',
    metric: 'request.error',
    operator: 'gt',
    threshold: 0.05,
    timeWindow: 5, // minutes
    aggregation: 'avg'
  }],
  actions: [{
    type: 'email',
    config: { recipients: ['admin@example.com'] },
    enabled: true
  }],
  cooldownMinutes: 15,
  severity: 'high'
});

// Get active alerts
const activeAlerts = alertingService.getAlerts({ status: 'active' });

// Acknowledge an alert
alertingService.acknowledgeAlert('alert-id', 'admin-user');
```

### Dashboard Management

```typescript
import { dashboardService } from '../services/monitoring/DashboardService';

// Create a dashboard
const dashboardId = dashboardService.createDashboard({
  name: 'System Overview',
  description: 'High-level system metrics',
  widgets: [{
    id: 'response-time',
    type: 'chart',
    title: 'Response Time',
    config: {
      metric: 'transaction.duration',
      chartType: 'line'
    },
    position: { x: 0, y: 0, width: 6, height: 4 }
  }],
  isPublic: true,
  createdBy: 'admin'
});

// Get dashboard data
const data = await dashboardService.getDashboardData();

// Subscribe to real-time updates
const unsubscribe = dashboardService.subscribeToUpdates(dashboardId, (update) => {
  console.log('Dashboard update:', update);
});
```

## Middleware Integration

The monitoring system includes middleware for automatic instrumentation:

### HTTP Request Tracking

```typescript
import { monitoringMiddleware } from '../middleware/monitoring';

app.use(monitoringMiddleware.requestTracking);
app.use(monitoringMiddleware.performance);
app.use(monitoringMiddleware.userBehavior);
app.use(monitoringMiddleware.errorTracking);
```

### Database Monitoring

```typescript
const dbMonitoring = monitoringMiddleware.database();

// Before query
const context = dbMonitoring.beforeQuery('SELECT * FROM cards WHERE name = ?', ['Atraxa']);

// After query
dbMonitoring.afterQuery(context, error);
```

### AI Service Monitoring

```typescript
const aiMonitoring = monitoringMiddleware.aiService();

// Before AI request
const context = aiMonitoring.beforeRequest('openai', 'generateDeck', params);

// After AI request
aiMonitoring.afterRequest(context, result, error);
```

## API Endpoints

The monitoring system exposes tRPC endpoints for web integration:

- `monitoring.recordMetric` - Record custom metrics
- `monitoring.trackUserEvent` - Track user behavior
- `monitoring.searchLogs` - Search and filter logs
- `monitoring.getAlerts` - Retrieve alerts
- `monitoring.getDashboardData` - Get dashboard data
- `monitoring.createDashboard` - Create custom dashboards

## Performance Considerations

### Memory Management
- Metrics are automatically limited to 1,000 entries per type
- Logs are limited to 100,000 entries with automatic rotation
- Alerts are limited to 1,000 entries with cleanup

### Scalability
- Services use event-driven architecture for real-time updates
- Efficient indexing for log searches
- Configurable collection intervals and retention policies

### Error Handling
- Graceful degradation when monitoring services fail
- Circuit breaker patterns for external dependencies
- Comprehensive error logging and recovery

## Configuration

### Environment Variables

```bash
# Monitoring configuration
MONITORING_ENABLED=true
MONITORING_RETENTION_DAYS=30
MONITORING_ALERT_COOLDOWN_MINUTES=15

# External integrations
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
EMAIL_SERVICE_API_KEY=your-email-api-key
```

### Default Alert Rules

The system comes with pre-configured alert rules:

1. **High Error Rate** - Triggers when error rate > 5% over 5 minutes
2. **High Response Time** - Triggers when avg response time > 5 seconds
3. **Critical Error Pattern** - Triggers on fatal errors or database failures
4. **AI Generation Failures** - Triggers on repeated AI service failures

## Monitoring Best Practices

### Metric Naming
- Use hierarchical naming: `service.operation.metric`
- Include relevant tags for filtering and grouping
- Use consistent units and scales

### Log Structure
- Include correlation IDs (session, request, user)
- Use structured metadata for searchability
- Log at appropriate levels (debug, info, warn, error, fatal)

### Alert Design
- Set meaningful thresholds based on SLA requirements
- Use appropriate cooldown periods to avoid spam
- Include actionable information in alert messages
- Test alert rules with realistic scenarios

### Dashboard Organization
- Group related metrics on the same dashboard
- Use consistent time ranges and refresh intervals
- Include both technical and business metrics
- Provide drill-down capabilities for investigation

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check metric and log retention settings
   - Verify automatic cleanup is working
   - Monitor for memory leaks in event listeners

2. **Missing Metrics**
   - Verify middleware is properly configured
   - Check for errors in metric recording
   - Ensure services are properly initialized

3. **Alert Spam**
   - Adjust alert thresholds and cooldown periods
   - Review alert conditions for false positives
   - Implement alert suppression rules

4. **Dashboard Performance**
   - Optimize widget queries and time ranges
   - Use appropriate aggregation levels
   - Implement caching for expensive calculations

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
// Enable debug logging
logAggregationService.debug('Debug message', 'monitoring-system', {
  component: 'ObservabilityService',
  operation: 'recordMetric'
});
```

## Contributing

When adding new monitoring features:

1. Follow the established patterns for service architecture
2. Include comprehensive tests for new functionality
3. Update documentation and examples
4. Consider performance and memory implications
5. Ensure proper error handling and graceful degradation

## License

This monitoring system is part of the MoxMuse project and follows the same licensing terms.
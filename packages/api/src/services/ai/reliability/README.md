# AI Service Reliability Features

This module provides comprehensive reliability features for AI services in production environments, including retry logic, circuit breakers, timeouts, request queuing, and monitoring.

## Features

### 1. Retry Service
Implements exponential backoff retry logic with configurable parameters:
- Maximum retry attempts
- Base delay and maximum delay
- Backoff factor and jitter
- Retryable vs non-retryable error classification

### 2. Circuit Breaker Service
Prevents cascading failures with automatic recovery:
- Configurable failure threshold
- Recovery timeout
- Monitoring window for error rate calculation
- Three states: CLOSED, OPEN, HALF_OPEN

### 3. Timeout Service
Handles operation timeouts with graceful degradation:
- Per-operation timeout configuration
- Progressive timeout (multiple attempts with increasing timeouts)
- Abort signal support for cancellation
- Warning thresholds for slow operations

### 4. Request Queue Service
Manages high-load scenarios with intelligent queuing:
- Concurrent request limiting
- Priority-based queuing
- Rate limiting per user/minute
- Queue size limits with overflow handling

### 5. Monitoring Service
Comprehensive observability and alerting:
- Error tracking with severity levels
- Performance metrics collection
- Health status reporting
- Automatic alerting based on thresholds

## Usage

### Basic Usage with ReliableAIService

```typescript
import { ReliableAIService } from './ReliableAIService'

// Create service with default configuration
const aiService = new ReliableAIService()

// Generate chat completion with reliability features
const result = await aiService.generateChatCompletion(
  [{ role: 'user', content: 'Hello' }],
  {
    userId: 'user-123',
    sessionId: 'session-456',
    priority: 8, // High priority
    customTimeout: 60000 // 1 minute timeout
  }
)

if (result.success) {
  console.log('Response:', result.result.choices[0].message.content)
  console.log('Metrics:', result.metrics)
} else {
  console.error('Failed:', result.error)
}
```

### Custom Configuration

```typescript
const aiService = new ReliableAIService({
  retry: {
    maxRetries: 5,
    baseDelayMs: 2000,
    maxDelayMs: 60000,
    backoffFactor: 2
  },
  circuitBreaker: {
    failureThreshold: 10,
    recoveryTimeoutMs: 120000
  },
  timeout: {
    defaultTimeoutMs: 180000,
    operationTimeouts: {
      'deck-generation': 300000, // 5 minutes
      'card-recommendation': 90000 // 1.5 minutes
    }
  },
  queue: {
    maxConcurrentRequests: 10,
    maxQueueSize: 200,
    rateLimitPerMinute: 120
  }
})
```

### Health Monitoring

```typescript
// Get overall health status
const health = aiService.getHealthStatus()
console.log('Overall status:', health.overall)
console.log('Recommendations:', health.recommendations)

// Get detailed statistics
const stats = aiService.getStats()
console.log('Error rate:', stats.monitoring.errors.errorRate)
console.log('Average response time:', stats.monitoring.performance.averageResponseTime)
console.log('Circuit breaker state:', stats.circuitBreaker.state)
console.log('Queue size:', stats.queue.queueSize)
```

### Individual Service Usage

```typescript
import { 
  RetryService, 
  CircuitBreakerService, 
  TimeoutService,
  RequestQueueService,
  MonitoringService 
} from './reliability'

// Retry service
const retryService = new RetryService({
  maxRetries: 3,
  baseDelayMs: 1000
})

const result = await retryService.executeWithRetry(async () => {
  // Your operation here
  return await someApiCall()
}, 'api-call')

// Circuit breaker
const circuitBreaker = new CircuitBreakerService('external-api')

const data = await circuitBreaker.execute(async () => {
  return await externalApiCall()
})

// Timeout service
const timeoutService = new TimeoutService()

const timeoutResult = await timeoutService.executeWithTimeout(
  async (signal) => {
    return await longRunningOperation(signal)
  },
  'long-operation',
  30000 // 30 second timeout
)
```

## Health Check Endpoints

The system provides tRPC endpoints for monitoring:

```typescript
// Get health status
const health = await trpc.aiHealth.getHealthStatus.query()

// Get performance metrics
const performance = await trpc.aiHealth.getPerformanceMetrics.query({
  timeWindowMs: 3600000 // Last hour
})

// Get error statistics
const errors = await trpc.aiHealth.getErrorStats.query()

// Test connectivity
const connectivity = await trpc.aiHealth.testConnectivity.query()
```

## Error Handling

The system classifies errors into retryable and non-retryable categories:

### Retryable Errors
- Network errors (ECONNRESET, ENOTFOUND, ETIMEDOUT)
- Rate limiting errors
- Server errors (5xx)
- Timeout errors

### Non-Retryable Errors
- Authentication errors (invalid API key)
- Authorization errors (insufficient quota)
- Invalid request errors (malformed input)
- Model not found errors

## Monitoring and Alerting

The system automatically tracks:
- **Error Rate**: Percentage of failed operations
- **Response Time**: Average, P95, and P99 response times
- **Queue Metrics**: Queue size, wait times, throughput
- **Circuit Breaker State**: Current state and failure counts

Alerts are triggered when:
- Error rate exceeds threshold (default: 10%)
- Response time exceeds threshold (default: 30 seconds)
- Queue size exceeds threshold (default: 50 requests)
- Circuit breaker opens

## Best Practices

1. **Configure timeouts appropriately** for different operation types
2. **Set reasonable retry limits** to avoid overwhelming failing services
3. **Monitor circuit breaker state** and adjust thresholds based on service characteristics
4. **Use priority queuing** for critical operations
5. **Implement graceful degradation** when services are unavailable
6. **Set up alerting** based on health metrics
7. **Test failure scenarios** regularly to ensure reliability features work correctly

## Production Deployment

1. **Environment Variables**: Configure API keys and service endpoints
2. **Monitoring Setup**: Connect to your monitoring system (Sentry, DataDog, etc.)
3. **Alerting Rules**: Set up alerts based on health metrics
4. **Load Testing**: Verify performance under expected load
5. **Graceful Shutdown**: Ensure proper cleanup on service shutdown

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down AI service...')
  await aiService.shutdown()
  process.exit(0)
})
```
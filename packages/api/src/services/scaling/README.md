# Scalability and Performance Architecture

This module implements comprehensive scalability and performance optimization features for the AI Deck Building Tutor application.

## Overview

The scalability architecture consists of five main components:

1. **Load Balancer Service** - Distributes requests across multiple server instances
2. **Database Connection Pool** - Optimizes database connections and query performance
3. **CDN Service** - Manages content delivery and caching strategies
4. **Background Job Processor** - Handles heavy operations asynchronously
5. **Auto-Scaling Service** - Automatically adjusts resources based on demand

## Components

### LoadBalancerService

Manages multiple server instances and distributes incoming requests using configurable strategies.

**Features:**
- Multiple load balancing strategies (Round Robin, Least Connections, Weighted Response Time)
- Health checking with automatic failover
- Real-time server metrics tracking
- Event-driven architecture for monitoring

**Usage:**
```typescript
import { LoadBalancerService, RoundRobinStrategy } from './LoadBalancerService';

const loadBalancer = new LoadBalancerService(new RoundRobinStrategy());

// Add servers
loadBalancer.addServer({
  id: 'server-1',
  url: 'http://localhost:3001',
  load: 0.5,
  responseTime: 100,
  connections: 10,
  maxConnections: 100,
});

// Select optimal server for request
const server = loadBalancer.selectServer();
```

### DatabaseConnectionPool

Provides optimized database connection management with comprehensive monitoring.

**Features:**
- Connection pooling with configurable limits
- Query performance monitoring
- Slow query detection and logging
- Connection validation and health checks
- Automatic connection recovery

**Usage:**
```typescript
import { DatabaseConnectionPool } from './DatabaseConnectionPool';

const pool = new DatabaseConnectionPool({
  host: 'localhost',
  port: 5432,
  database: 'moxmuse',
  max: 20,
  min: 5,
  enableMetrics: true,
  slowQueryThreshold: 1000,
});

// Execute queries
const result = await pool.query('SELECT * FROM cards WHERE name = $1', ['Lightning Bolt']);

// Get pool metrics
const metrics = pool.getMetrics();
```

### CDNService

Manages content delivery network integration and caching policies.

**Features:**
- Multi-provider CDN support (Cloudflare, AWS, Vercel)
- Image optimization with format conversion
- Responsive image generation
- Cache purging and preloading
- Performance analytics

**Usage:**
```typescript
import { CDNService } from './CDNService';

const cdn = new CDNService({
  provider: 'cloudflare',
  baseUrl: 'https://moxmuse.com',
  enableCompression: true,
  enableCaching: true,
});

// Optimize images
const optimizedUrl = cdn.optimizeImageUrl('https://example.com/image.jpg', {
  format: 'webp',
  quality: 85,
  width: 400,
  fit: 'cover',
});

// Generate responsive image sets
const { srcSet, sizes } = cdn.generateResponsiveImageSet(originalUrl, [400, 800, 1200]);
```

### BackgroundJobProcessor

Handles asynchronous job processing with queue management and monitoring.

**Features:**
- Multiple queue support with priorities
- Job retry logic with exponential backoff
- Real-time job monitoring and metrics
- Bulk job processing
- Queue health checks and management

**Usage:**
```typescript
import { BackgroundJobProcessor } from './BackgroundJobProcessor';

const processor = new BackgroundJobProcessor('redis://localhost:6379');

// Create queue and worker
const queue = processor.createQueue('deck-generation');
const worker = processor.createWorker('deck-generation', {
  async process(job) {
    // Process deck generation job
    return await generateDeck(job.data);
  }
});

// Add jobs
await processor.addJob('deck-generation', {
  id: 'job-1',
  type: 'generate-deck',
  payload: { userId: '123', preferences: {...} },
  priority: 1,
});
```

### AutoScalingService

Automatically scales resources based on system metrics and policies.

**Features:**
- Multiple scaling targets (servers, containers, functions)
- Configurable scaling policies with multiple metrics
- Cooldown periods to prevent thrashing
- Policy recommendations based on usage patterns
- Comprehensive scaling event logging

**Usage:**
```typescript
import { AutoScalingService } from './AutoScalingService';

const autoScaling = new AutoScalingService();

// Add scaling target
autoScaling.addScalingTarget({
  id: 'api-server',
  type: 'server',
  minInstances: 2,
  maxInstances: 10,
  currentInstances: 3,
  desiredInstances: 3,
  status: 'stable',
});

// Add scaling policy
autoScaling.addScalingPolicy({
  name: 'cpu-scale-up',
  metricType: 'cpuUtilization',
  threshold: 75,
  comparisonOperator: 'gt',
  evaluationPeriods: 2,
  cooldownPeriod: 300,
  scalingAction: {
    type: 'scale_up',
    adjustment: 1,
    adjustmentType: 'absolute',
  },
});

// Record metrics for scaling decisions
autoScaling.recordMetrics('api-server', {
  cpuUtilization: 80,
  memoryUtilization: 65,
  requestRate: 150,
  responseTime: 200,
  errorRate: 0.02,
  queueDepth: 5,
  activeConnections: 45,
  timestamp: new Date(),
});
```

## Configuration

The scalability services are configured through environment variables and the configuration file:

```typescript
// packages/api/src/config/scalability.ts
export const scalabilityConfig = {
  loadBalancer: {
    strategy: new RoundRobinStrategy(),
    healthCheckInterval: 30000,
  },
  database: {
    max: 20,
    min: 5,
    enableMetrics: true,
    slowQueryThreshold: 1000,
  },
  cdn: {
    provider: 'vercel',
    enableCompression: true,
    enableCaching: true,
  },
  backgroundJobs: {
    redisUrl: process.env.REDIS_URL,
    queues: ['deck-generation', 'card-sync', 'analytics'],
  },
  autoScaling: {
    enabled: process.env.NODE_ENV === 'production',
    targets: [...],
    policies: [...],
  },
};
```

## Environment Variables

### Database Configuration
- `DATABASE_HOST` - Database host (default: localhost)
- `DATABASE_PORT` - Database port (default: 5432)
- `DATABASE_NAME` - Database name (default: moxmuse)
- `DATABASE_USER` - Database user (default: postgres)
- `DATABASE_PASSWORD` - Database password
- `DB_POOL_MAX` - Maximum connections (default: 20 in production, 10 in development)
- `DB_POOL_MIN` - Minimum connections (default: 5 in production, 2 in development)
- `DB_SLOW_QUERY_THRESHOLD` - Slow query threshold in ms (default: 1000)

### CDN Configuration
- `CDN_PROVIDER` - CDN provider (cloudflare, aws, vercel)
- `CDN_BASE_URL` - CDN base URL
- `CDN_API_KEY` - CDN API key
- `CLOUDFLARE_ZONE_ID` - Cloudflare zone ID
- `AWS_CLOUDFRONT_DISTRIBUTION_ID` - AWS CloudFront distribution ID

### Background Jobs Configuration
- `REDIS_URL` - Redis connection URL (default: redis://localhost:6379)

### Auto-Scaling Configuration
- `AUTO_SCALING_ENABLED` - Enable auto-scaling (default: false)
- `MIN_INSTANCES` - Minimum instances (default: 1)
- `MAX_INSTANCES` - Maximum instances (default: 10)
- `CPU_SCALE_UP_THRESHOLD` - CPU threshold for scaling up (default: 75)
- `CPU_SCALE_DOWN_THRESHOLD` - CPU threshold for scaling down (default: 25)
- `MEMORY_SCALE_UP_THRESHOLD` - Memory threshold for scaling up (default: 85)

### Load Balancing Configuration
- `LOAD_BALANCING_STRATEGY` - Strategy (round_robin, least_connections, weighted_response_time)
- `HEALTH_CHECK_INTERVAL` - Health check interval in ms (default: 30000)

## API Endpoints

The scalability services expose REST API endpoints through tRPC:

### System Metrics
- `scalability.getSystemMetrics` - Get comprehensive system metrics
- `scalability.healthCheck` - Perform system health check

### Load Balancer
- `scalability.addServer` - Add server to load balancer
- `scalability.removeServer` - Remove server from load balancer
- `scalability.getLoadBalancerStats` - Get load balancer statistics

### Database
- `scalability.getDatabaseMetrics` - Get database connection metrics
- `scalability.executeQuery` - Execute database query (protected)

### CDN
- `scalability.getCDNMetrics` - Get CDN performance metrics
- `scalability.optimizeImage` - Optimize image URL
- `scalability.purgeCache` - Purge CDN cache (protected)

### Background Jobs
- `scalability.getJobMetrics` - Get job processing metrics
- `scalability.addJob` - Add background job (protected)

### Auto-Scaling
- `scalability.getAutoScalingMetrics` - Get auto-scaling metrics
- `scalability.addScalingTarget` - Add scaling target (protected)
- `scalability.addScalingPolicy` - Add scaling policy (protected)

### Monitoring
- `scalability.getPerformanceRecommendations` - Get optimization recommendations
- `scalability.getSystemAlerts` - Get system alerts and warnings

## Middleware Integration

The scalability services integrate with Express middleware for automatic request handling:

```typescript
import { createScalabilityMiddleware, createHealthCheckMiddleware } from './middleware/scalability';

// Apply scalability middleware
app.use(createScalabilityMiddleware({
  scalabilityService,
  enableMetrics: true,
  enableLoadBalancing: true,
  enableAutoScaling: true,
}));

// Add health check endpoint
app.use(createHealthCheckMiddleware(scalabilityService));
```

## Monitoring and Alerting

The system provides comprehensive monitoring through events and metrics:

```typescript
// Listen for scaling events
scalabilityService.on('scalingCompleted', (event) => {
  console.log(`Scaled ${event.targetId} from ${event.fromInstances} to ${event.toInstances}`);
});

// Listen for performance issues
scalabilityService.on('slowQuery', (data) => {
  console.warn(`Slow query detected: ${data.query} (${data.duration}ms)`);
});

// Listen for rate limiting
scalabilityService.on('rateLimitExceeded', (data) => {
  console.warn(`Rate limit exceeded for ${data.clientId}`);
});
```

## Testing

Comprehensive test suites are provided for all components:

```bash
# Run scalability tests
npm test packages/api/src/services/scaling

# Run integration tests
npm test packages/api/src/services/scaling/__tests__/scalability-integration.test.ts

# Run load balancer tests
npm test packages/api/src/services/scaling/__tests__/LoadBalancerService.test.ts
```

## Performance Considerations

### Database Optimization
- Connection pooling reduces connection overhead
- Query monitoring identifies performance bottlenecks
- Prepared statements improve query performance
- Connection validation prevents stale connections

### Caching Strategy
- Multi-layer caching (memory, Redis, CDN)
- Intelligent cache invalidation
- Responsive image optimization
- Static asset optimization

### Load Distribution
- Health-based server selection
- Automatic failover for unhealthy servers
- Request-based load balancing
- Connection-aware distribution

### Resource Scaling
- Metric-based scaling decisions
- Cooldown periods prevent oscillation
- Predictive scaling for known patterns
- Cost-optimized scaling policies

## Production Deployment

### Prerequisites
- Redis server for background jobs
- Database with connection pooling support
- CDN provider account (optional)
- Monitoring infrastructure

### Deployment Steps
1. Configure environment variables
2. Initialize scalability services
3. Set up monitoring and alerting
4. Configure auto-scaling policies
5. Test health checks and failover

### Monitoring Setup
- Set up dashboards for key metrics
- Configure alerts for critical thresholds
- Monitor scaling events and performance
- Track cost optimization opportunities

This scalability architecture provides a robust foundation for handling increased load while maintaining performance and reliability.
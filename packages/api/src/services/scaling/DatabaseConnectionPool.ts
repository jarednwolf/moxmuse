import { Pool, PoolClient, PoolConfig } from 'pg';
import { EventEmitter } from 'events';

export interface ConnectionPoolConfig extends PoolConfig {
  // Enhanced configuration options
  acquireTimeoutMillis?: number;
  createTimeoutMillis?: number;
  destroyTimeoutMillis?: number;
  reapIntervalMillis?: number;
  createRetryIntervalMillis?: number;
  
  // Monitoring options
  enableMetrics?: boolean;
  slowQueryThreshold?: number;
  
  // Connection validation
  validateConnection?: boolean;
  validationQuery?: string;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  connectionErrors: number;
  poolErrors: number;
}

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export class DatabaseConnectionPool extends EventEmitter {
  private pool: Pool;
  private config: ConnectionPoolConfig;
  private metrics: ConnectionMetrics;
  private queryHistory: QueryMetrics[] = [];
  private maxQueryHistory = 1000;

  constructor(config: ConnectionPoolConfig) {
    super();
    
    this.config = {
      // Default configuration
      max: 20, // Maximum number of connections
      min: 5,  // Minimum number of connections
      idleTimeoutMillis: 30000, // 30 seconds
      connectionTimeoutMillis: 10000, // 10 seconds
      acquireTimeoutMillis: 60000, // 60 seconds
      createTimeoutMillis: 10000, // 10 seconds
      destroyTimeoutMillis: 5000, // 5 seconds
      reapIntervalMillis: 1000, // 1 second
      createRetryIntervalMillis: 200, // 200ms
      enableMetrics: true,
      slowQueryThreshold: 1000, // 1 second
      validateConnection: true,
      validationQuery: 'SELECT 1',
      ...config,
    };

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      connectionErrors: 0,
      poolErrors: 0,
    };

    this.initializePool();
    this.setupEventListeners();
    this.startMetricsCollection();
  }

  private initializePool(): void {
    this.pool = new Pool(this.config);
  }

  private setupEventListeners(): void {
    this.pool.on('connect', (client: PoolClient) => {
      this.metrics.totalConnections++;
      this.emit('connectionCreated', { totalConnections: this.metrics.totalConnections });
    });

    this.pool.on('acquire', (client: PoolClient) => {
      this.metrics.activeConnections++;
      this.emit('connectionAcquired', { activeConnections: this.metrics.activeConnections });
    });

    this.pool.on('release', (client: PoolClient) => {
      this.metrics.activeConnections--;
      this.emit('connectionReleased', { activeConnections: this.metrics.activeConnections });
    });

    this.pool.on('remove', (client: PoolClient) => {
      this.metrics.totalConnections--;
      this.emit('connectionRemoved', { totalConnections: this.metrics.totalConnections });
    });

    this.pool.on('error', (error: Error) => {
      this.metrics.poolErrors++;
      this.emit('poolError', error);
    });
  }

  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const startTime = Date.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      
      if (this.config.enableMetrics) {
        this.recordQueryMetrics(text, duration, success, error);
      }
    }
  }

  async getConnection(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      
      if (this.config.validateConnection) {
        await this.validateConnection(client);
      }
      
      return client;
    } catch (error) {
      this.metrics.connectionErrors++;
      throw error;
    }
  }

  private async validateConnection(client: PoolClient): Promise<void> {
    if (this.config.validationQuery) {
      try {
        await client.query(this.config.validationQuery);
      } catch (error) {
        // Release the invalid connection
        client.release(true);
        throw new Error('Connection validation failed');
      }
    }
  }

  private recordQueryMetrics(query: string, duration: number, success: boolean, error?: string): void {
    this.metrics.totalQueries++;
    
    if (duration > (this.config.slowQueryThreshold || 1000)) {
      this.metrics.slowQueries++;
      this.emit('slowQuery', { query, duration });
    }

    // Update average query time
    this.metrics.averageQueryTime = 
      (this.metrics.averageQueryTime * (this.metrics.totalQueries - 1) + duration) / 
      this.metrics.totalQueries;

    // Store query history
    const queryMetric: QueryMetrics = {
      query: query.substring(0, 100), // Truncate long queries
      duration,
      timestamp: new Date(),
      success,
      error,
    };

    this.queryHistory.push(queryMetric);
    
    // Maintain history size
    if (this.queryHistory.length > this.maxQueryHistory) {
      this.queryHistory.shift();
    }
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.updatePoolMetrics();
    }, 5000); // Update every 5 seconds
  }

  private updatePoolMetrics(): void {
    this.metrics.totalConnections = this.pool.totalCount;
    this.metrics.activeConnections = this.pool.totalCount - this.pool.idleCount;
    this.metrics.idleConnections = this.pool.idleCount;
    this.metrics.waitingClients = this.pool.waitingCount;

    this.emit('metricsUpdated', this.metrics);
  }

  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  getQueryHistory(limit?: number): QueryMetrics[] {
    return limit ? this.queryHistory.slice(-limit) : [...this.queryHistory];
  }

  getSlowQueries(threshold?: number): QueryMetrics[] {
    const queryThreshold = threshold || this.config.slowQueryThreshold || 1000;
    return this.queryHistory.filter(q => q.duration > queryThreshold);
  }

  async getPoolStatus(): Promise<{
    totalCount: number;
    idleCount: number;
    waitingCount: number;
    maxConnections: number;
    minConnections: number;
  }> {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxConnections: this.config.max || 10,
      minConnections: this.config.min || 0,
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    metrics: ConnectionMetrics;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Check connection availability
    if (this.pool.totalCount === 0) {
      issues.push('No database connections available');
    }
    
    // Check for too many waiting clients
    if (this.pool.waitingCount > 10) {
      issues.push(`High number of waiting clients: ${this.pool.waitingCount}`);
    }
    
    // Check for high error rate
    const errorRate = this.metrics.connectionErrors / Math.max(this.metrics.totalQueries, 1);
    if (errorRate > 0.05) { // 5% error rate threshold
      issues.push(`High connection error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
    
    // Check for slow queries
    const slowQueryRate = this.metrics.slowQueries / Math.max(this.metrics.totalQueries, 1);
    if (slowQueryRate > 0.1) { // 10% slow query threshold
      issues.push(`High slow query rate: ${(slowQueryRate * 100).toFixed(2)}%`);
    }

    return {
      healthy: issues.length === 0,
      metrics: this.getMetrics(),
      issues,
    };
  }

  async drain(): Promise<void> {
    return new Promise((resolve) => {
      this.pool.end(() => {
        resolve();
      });
    });
  }

  async destroy(): Promise<void> {
    await this.drain();
    this.removeAllListeners();
  }
}
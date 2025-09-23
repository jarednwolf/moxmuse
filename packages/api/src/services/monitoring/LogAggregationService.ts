import { EventEmitter } from 'events';
import { createHash } from 'crypto';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  source: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  stackTrace?: string;
}

export interface LogQuery {
  level?: LogEntry['level'][];
  source?: string[];
  userId?: string;
  sessionId?: string;
  requestId?: string;
  startTime?: Date;
  endTime?: Date;
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface LogSearchResult {
  logs: LogEntry[];
  total: number;
  hasMore: boolean;
}

export interface LogStatistics {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  logsBySource: Record<string, number>;
  errorRate: number;
  topErrors: Array<{ message: string; count: number }>;
  recentTrends: Array<{ timestamp: Date; count: number; level: string }>;
}

export class LogAggregationService extends EventEmitter {
  private logs: LogEntry[] = [];
  private logIndex: Map<string, Set<string>> = new Map(); // For fast searching
  private maxLogs = 100000; // Keep last 100k logs in memory
  private errorPatterns: Map<string, number> = new Map();

  constructor() {
    super();
    this.setupIndexes();
    this.startLogRotation();
  }

  // Core logging methods
  log(entry: Omit<LogEntry, 'id' | 'timestamp'>): string {
    const logEntry: LogEntry = {
      ...entry,
      id: this.generateLogId(),
      timestamp: new Date()
    };

    this.logs.push(logEntry);
    this.updateIndexes(logEntry);
    this.trackErrorPatterns(logEntry);

    // Emit for real-time processing
    this.emit('log', logEntry);

    // Emit alerts for high-severity logs
    if (logEntry.level === 'error' || logEntry.level === 'fatal') {
      this.emit('errorLog', logEntry);
    }

    return logEntry.id;
  }

  debug(message: string, source: string, metadata?: Record<string, any>): string {
    return this.log({ level: 'debug', message, source, metadata });
  }

  info(message: string, source: string, metadata?: Record<string, any>): string {
    return this.log({ level: 'info', message, source, metadata });
  }

  warn(message: string, source: string, metadata?: Record<string, any>): string {
    return this.log({ level: 'warn', message, source, metadata });
  }

  error(message: string, source: string, error?: Error, metadata?: Record<string, any>): string {
    return this.log({
      level: 'error',
      message,
      source,
      stackTrace: error?.stack,
      metadata: {
        ...metadata,
        errorName: error?.name,
        errorMessage: error?.message
      }
    });
  }

  fatal(message: string, source: string, error?: Error, metadata?: Record<string, any>): string {
    return this.log({
      level: 'fatal',
      message,
      source,
      stackTrace: error?.stack,
      metadata: {
        ...metadata,
        errorName: error?.name,
        errorMessage: error?.message
      }
    });
  }

  // Search and query methods
  search(query: LogQuery): LogSearchResult {
    let filteredLogs = this.logs;

    // Filter by level
    if (query.level && query.level.length > 0) {
      filteredLogs = filteredLogs.filter(log => query.level!.includes(log.level));
    }

    // Filter by source
    if (query.source && query.source.length > 0) {
      filteredLogs = filteredLogs.filter(log => query.source!.includes(log.source));
    }

    // Filter by user ID
    if (query.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === query.userId);
    }

    // Filter by session ID
    if (query.sessionId) {
      filteredLogs = filteredLogs.filter(log => log.sessionId === query.sessionId);
    }

    // Filter by request ID
    if (query.requestId) {
      filteredLogs = filteredLogs.filter(log => log.requestId === query.requestId);
    }

    // Filter by time range
    if (query.startTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= query.endTime!);
    }

    // Text search
    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log =>
        log.message.toLowerCase().includes(searchTerm) ||
        log.source.toLowerCase().includes(searchTerm) ||
        (log.stackTrace && log.stackTrace.toLowerCase().includes(searchTerm)) ||
        (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(searchTerm))
      );
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      filteredLogs = filteredLogs.filter(log =>
        log.tags && query.tags!.some(tag => log.tags!.includes(tag))
      );
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = filteredLogs.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    const paginatedLogs = filteredLogs.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      logs: paginatedLogs,
      total,
      hasMore
    };
  }

  // Analytics and statistics
  getStatistics(timeRange?: { start: Date; end: Date }): LogStatistics {
    let logsToAnalyze = this.logs;

    if (timeRange) {
      logsToAnalyze = this.logs.filter(log =>
        log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
      );
    }

    const logsByLevel: Record<string, number> = {};
    const logsBySource: Record<string, number> = {};

    logsToAnalyze.forEach(log => {
      logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;
      logsBySource[log.source] = (logsBySource[log.source] || 0) + 1;
    });

    const errorCount = (logsByLevel.error || 0) + (logsByLevel.fatal || 0);
    const errorRate = logsToAnalyze.length > 0 ? errorCount / logsToAnalyze.length : 0;

    const topErrors = Array.from(this.errorPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));

    const recentTrends = this.calculateTrends(logsToAnalyze);

    return {
      totalLogs: logsToAnalyze.length,
      logsByLevel,
      logsBySource,
      errorRate,
      topErrors,
      recentTrends
    };
  }

  // Real-time log streaming
  streamLogs(query?: LogQuery): EventEmitter {
    const stream = new EventEmitter();

    const handler = (log: LogEntry) => {
      if (this.matchesQuery(log, query)) {
        stream.emit('log', log);
      }
    };

    this.on('log', handler);

    // Cleanup when stream is closed
    stream.on('close', () => {
      this.off('log', handler);
    });

    return stream;
  }

  // Export logs for external analysis
  exportLogs(query: LogQuery, format: 'json' | 'csv' | 'txt' = 'json'): string {
    const result = this.search(query);
    
    switch (format) {
      case 'json':
        return JSON.stringify(result.logs, null, 2);
      
      case 'csv':
        return this.logsToCSV(result.logs);
      
      case 'txt':
        return this.logsToText(result.logs);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Correlation analysis
  correlateLogs(sessionId: string): LogEntry[] {
    return this.logs
      .filter(log => log.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  findRelatedLogs(logId: string, contextMinutes: number = 5): LogEntry[] {
    const targetLog = this.logs.find(log => log.id === logId);
    if (!targetLog) return [];

    const contextMs = contextMinutes * 60 * 1000;
    const startTime = new Date(targetLog.timestamp.getTime() - contextMs);
    const endTime = new Date(targetLog.timestamp.getTime() + contextMs);

    return this.logs.filter(log =>
      log.timestamp >= startTime &&
      log.timestamp <= endTime &&
      (log.sessionId === targetLog.sessionId ||
       log.requestId === targetLog.requestId ||
       log.userId === targetLog.userId)
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private generateLogId(): string {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupIndexes(): void {
    // Initialize search indexes
    this.logIndex.set('level', new Set());
    this.logIndex.set('source', new Set());
    this.logIndex.set('userId', new Set());
    this.logIndex.set('sessionId', new Set());
    this.logIndex.set('requestId', new Set());
  }

  private updateIndexes(log: LogEntry): void {
    this.logIndex.get('level')!.add(log.level);
    this.logIndex.get('source')!.add(log.source);
    
    if (log.userId) this.logIndex.get('userId')!.add(log.userId);
    if (log.sessionId) this.logIndex.get('sessionId')!.add(log.sessionId);
    if (log.requestId) this.logIndex.get('requestId')!.add(log.requestId);
  }

  private trackErrorPatterns(log: LogEntry): void {
    if (log.level === 'error' || log.level === 'fatal') {
      const pattern = this.extractErrorPattern(log.message);
      this.errorPatterns.set(pattern, (this.errorPatterns.get(pattern) || 0) + 1);
    }
  }

  private extractErrorPattern(message: string): string {
    // Remove specific values to identify patterns
    return message
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID') // Replace UUIDs
      .replace(/\b\w+@\w+\.\w+\b/g, 'EMAIL') // Replace emails
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, 'IP') // Replace IP addresses
      .substring(0, 200); // Limit length
  }

  private startLogRotation(): void {
    setInterval(() => {
      if (this.logs.length > this.maxLogs) {
        const excess = this.logs.length - this.maxLogs;
        this.logs.splice(0, excess);
        
        // Clean up old error patterns
        this.cleanupErrorPatterns();
      }
    }, 60000); // Check every minute
  }

  private cleanupErrorPatterns(): void {
    // Remove error patterns with low counts to prevent memory bloat
    for (const [pattern, count] of this.errorPatterns.entries()) {
      if (count < 5) {
        this.errorPatterns.delete(pattern);
      }
    }
  }

  private matchesQuery(log: LogEntry, query?: LogQuery): boolean {
    if (!query) return true;

    if (query.level && !query.level.includes(log.level)) return false;
    if (query.source && !query.source.includes(log.source)) return false;
    if (query.userId && log.userId !== query.userId) return false;
    if (query.sessionId && log.sessionId !== query.sessionId) return false;
    if (query.requestId && log.requestId !== query.requestId) return false;
    if (query.startTime && log.timestamp < query.startTime) return false;
    if (query.endTime && log.timestamp > query.endTime) return false;

    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      const matchesSearch = 
        log.message.toLowerCase().includes(searchTerm) ||
        log.source.toLowerCase().includes(searchTerm) ||
        (log.stackTrace && log.stackTrace.toLowerCase().includes(searchTerm));
      
      if (!matchesSearch) return false;
    }

    if (query.tags && query.tags.length > 0) {
      if (!log.tags || !query.tags.some(tag => log.tags!.includes(tag))) {
        return false;
      }
    }

    return true;
  }

  private calculateTrends(logs: LogEntry[]): Array<{ timestamp: Date; count: number; level: string }> {
    const trends: Array<{ timestamp: Date; count: number; level: string }> = [];
    const hourlyBuckets: Map<string, Map<string, number>> = new Map();

    logs.forEach(log => {
      const hour = new Date(log.timestamp);
      hour.setMinutes(0, 0, 0);
      const hourKey = hour.toISOString();

      if (!hourlyBuckets.has(hourKey)) {
        hourlyBuckets.set(hourKey, new Map());
      }

      const levelCounts = hourlyBuckets.get(hourKey)!;
      levelCounts.set(log.level, (levelCounts.get(log.level) || 0) + 1);
    });

    for (const [hourKey, levelCounts] of hourlyBuckets.entries()) {
      for (const [level, count] of levelCounts.entries()) {
        trends.push({
          timestamp: new Date(hourKey),
          count,
          level
        });
      }
    }

    return trends.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private logsToCSV(logs: LogEntry[]): string {
    const headers = ['timestamp', 'level', 'source', 'message', 'userId', 'sessionId', 'requestId'];
    const csvLines = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.timestamp.toISOString(),
        log.level,
        log.source,
        `"${log.message.replace(/"/g, '""')}"`, // Escape quotes
        log.userId || '',
        log.sessionId || '',
        log.requestId || ''
      ];
      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }

  private logsToText(logs: LogEntry[]): string {
    return logs.map(log => {
      let line = `[${log.timestamp.toISOString()}] ${log.level.toUpperCase()} ${log.source}: ${log.message}`;
      
      if (log.userId) line += ` (user: ${log.userId})`;
      if (log.sessionId) line += ` (session: ${log.sessionId})`;
      if (log.requestId) line += ` (request: ${log.requestId})`;
      if (log.stackTrace) line += `\n${log.stackTrace}`;
      
      return line;
    }).join('\n\n');
  }
}

export const logAggregationService = new LogAggregationService();
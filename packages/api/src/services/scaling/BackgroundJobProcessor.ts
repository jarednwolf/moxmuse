import { EventEmitter } from 'events';
import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
import Redis from 'ioredis';

export interface JobData {
  id: string;
  type: string;
  payload: any;
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete?: number;
  removeOnFail?: number;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  attempts: number;
}

export interface JobProcessor {
  process(job: Job): Promise<any>;
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  totalProcessed: number;
  throughput: number; // jobs per minute
  averageProcessingTime: number;
  errorRate: number;
}

export class BackgroundJobProcessor extends EventEmitter {
  private redis: Redis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private processors: Map<string, JobProcessor> = new Map();
  private metrics: Map<string, QueueMetrics> = new Map();
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(redisUrl: string) {
    super();
    this.redis = new Redis(redisUrl);
    this.startMetricsCollection();
  }

  createQueue(name: string, options?: QueueOptions): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
      ...options,
    });

    this.queues.set(name, queue);
    this.initializeQueueMetrics(name);

    // Set up queue event listeners
    queue.on('completed', (job) => {
      this.emit('jobCompleted', { queueName: name, jobId: job.id });
      this.updateMetrics(name, 'completed');
    });

    queue.on('failed', (job, error) => {
      this.emit('jobFailed', { queueName: name, jobId: job?.id, error });
      this.updateMetrics(name, 'failed');
    });

    queue.on('progress', (job, progress) => {
      this.emit('jobProgress', { queueName: name, jobId: job.id, progress });
    });

    return queue;
  }

  createWorker(queueName: string, processor: JobProcessor, options?: WorkerOptions): Worker {
    if (this.workers.has(queueName)) {
      throw new Error(`Worker for queue ${queueName} already exists`);
    }

    this.processors.set(queueName, processor);

    const worker = new Worker(queueName, async (job) => {
      const startTime = Date.now();
      
      try {
        const result = await processor.process(job);
        const duration = Date.now() - startTime;
        
        this.emit('jobProcessed', {
          queueName,
          jobId: job.id,
          duration,
          success: true,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        this.emit('jobProcessed', {
          queueName,
          jobId: job.id,
          duration,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      }
    }, {
      connection: this.redis,
      concurrency: 5,
      ...options,
    });

    this.workers.set(queueName, worker);

    // Set up worker event listeners
    worker.on('completed', (job) => {
      this.updateMetrics(queueName, 'processed');
    });

    worker.on('failed', (job, error) => {
      this.updateMetrics(queueName, 'error');
    });

    return worker;
  }

  async addJob(queueName: string, jobData: JobData): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(jobData.type, jobData.payload, {
      priority: jobData.priority,
      delay: jobData.delay,
      attempts: jobData.attempts,
      backoff: jobData.backoff,
      removeOnComplete: jobData.removeOnComplete,
      removeOnFail: jobData.removeOnFail,
      jobId: jobData.id,
    });

    this.emit('jobAdded', { queueName, jobId: job.id, jobType: jobData.type });
    this.updateMetrics(queueName, 'added');

    return job;
  }

  async addBulkJobs(queueName: string, jobs: JobData[]): Promise<Job[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const bulkJobs = jobs.map(jobData => ({
      name: jobData.type,
      data: jobData.payload,
      opts: {
        priority: jobData.priority,
        delay: jobData.delay,
        attempts: jobData.attempts,
        backoff: jobData.backoff,
        removeOnComplete: jobData.removeOnComplete,
        removeOnFail: jobData.removeOnFail,
        jobId: jobData.id,
      },
    }));

    const addedJobs = await queue.addBulk(bulkJobs);
    
    this.emit('bulkJobsAdded', { queueName, count: jobs.length });
    
    return addedJobs;
  }

  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return await queue.getJob(jobId);
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      this.emit('jobRemoved', { queueName, jobId });
    }
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
      this.emit('queuePaused', { queueName });
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
      this.emit('queueResumed', { queueName });
    }
  }

  async drainQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.drain();
      this.emit('queueDrained', { queueName });
    }
  }

  async cleanQueue(queueName: string, grace: number = 0, status?: string): Promise<Job[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const cleanedJobs = await queue.clean(grace, 100, status as any);
    this.emit('queueCleaned', { queueName, cleanedCount: cleanedJobs.length });
    
    return cleanedJobs;
  }

  async getQueueMetrics(queueName: string): Promise<QueueMetrics | null> {
    return this.metrics.get(queueName) || null;
  }

  async getAllQueueMetrics(): Promise<Map<string, QueueMetrics>> {
    return new Map(this.metrics);
  }

  async getQueueStatus(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  } | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await queue.isPaused(),
    };
  }

  private initializeQueueMetrics(queueName: string): void {
    this.metrics.set(queueName, {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      totalProcessed: 0,
      throughput: 0,
      averageProcessingTime: 0,
      errorRate: 0,
    });
  }

  private updateMetrics(queueName: string, event: string): void {
    const metrics = this.metrics.get(queueName);
    if (!metrics) return;

    switch (event) {
      case 'added':
        // Metrics will be updated in the periodic collection
        break;
      case 'completed':
        metrics.completed++;
        metrics.totalProcessed++;
        break;
      case 'failed':
        metrics.failed++;
        metrics.totalProcessed++;
        break;
      case 'processed':
        // Update processing time and throughput
        break;
      case 'error':
        // Update error rate
        break;
    }
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 30000); // Collect every 30 seconds
  }

  private async collectMetrics(): Promise<void> {
    for (const [queueName, queue] of this.queues) {
      try {
        const status = await this.getQueueStatus(queueName);
        if (status) {
          const metrics = this.metrics.get(queueName);
          if (metrics) {
            metrics.waiting = status.waiting;
            metrics.active = status.active;
            metrics.completed = status.completed;
            metrics.failed = status.failed;
            metrics.delayed = status.delayed;
            metrics.paused = status.paused ? 1 : 0;

            // Calculate error rate
            const total = metrics.completed + metrics.failed;
            metrics.errorRate = total > 0 ? metrics.failed / total : 0;

            // Calculate throughput (jobs per minute)
            // This is a simplified calculation - in production you'd want a sliding window
            metrics.throughput = metrics.totalProcessed / 60; // Assuming 1 minute intervals
          }
        }
      } catch (error) {
        this.emit('metricsError', { queueName, error });
      }
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    queues: Array<{
      name: string;
      healthy: boolean;
      issues: string[];
    }>;
  }> {
    const queueHealths = [];
    let overallHealthy = true;

    for (const [queueName] of this.queues) {
      const issues: string[] = [];
      const metrics = this.metrics.get(queueName);
      
      if (metrics) {
        if (metrics.errorRate > 0.1) {
          issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
        }
        
        if (metrics.waiting > 1000) {
          issues.push(`High number of waiting jobs: ${metrics.waiting}`);
        }
        
        if (metrics.paused > 0) {
          issues.push('Queue is paused');
        }
      }

      const healthy = issues.length === 0;
      if (!healthy) overallHealthy = false;

      queueHealths.push({
        name: queueName,
        healthy,
        issues,
      });
    }

    return {
      healthy: overallHealthy,
      queues: queueHealths,
    };
  }

  async shutdown(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Close all workers
    const workerClosePromises = Array.from(this.workers.values()).map(worker => worker.close());
    await Promise.all(workerClosePromises);

    // Close all queues
    const queueClosePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(queueClosePromises);

    // Close Redis connection
    await this.redis.quit();

    this.emit('shutdown');
  }
}
import { EventEmitter } from 'events';

export interface ScalingMetrics {
  cpuUtilization: number;
  memoryUtilization: number;
  requestRate: number;
  responseTime: number;
  errorRate: number;
  queueDepth: number;
  activeConnections: number;
  timestamp: Date;
}

export interface ScalingPolicy {
  name: string;
  metricType: keyof ScalingMetrics;
  threshold: number;
  comparisonOperator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  evaluationPeriods: number;
  cooldownPeriod: number; // seconds
  scalingAction: {
    type: 'scale_up' | 'scale_down';
    adjustment: number;
    adjustmentType: 'absolute' | 'percentage';
  };
}

export interface ScalingTarget {
  id: string;
  type: 'server' | 'container' | 'function';
  minInstances: number;
  maxInstances: number;
  currentInstances: number;
  desiredInstances: number;
  status: 'stable' | 'scaling_up' | 'scaling_down' | 'error';
}

export interface ScalingEvent {
  timestamp: Date;
  targetId: string;
  action: 'scale_up' | 'scale_down';
  reason: string;
  fromInstances: number;
  toInstances: number;
  success: boolean;
  error?: string;
}

export class AutoScalingService extends EventEmitter {
  private targets: Map<string, ScalingTarget> = new Map();
  private policies: Map<string, ScalingPolicy> = new Map();
  private metrics: Map<string, ScalingMetrics[]> = new Map();
  private lastScalingActions: Map<string, Date> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;
  private metricsRetentionPeriod = 3600000; // 1 hour in milliseconds
  private maxMetricsPerTarget = 720; // 1 hour of 5-second intervals

  constructor() {
    super();
    this.startEvaluation();
  }

  addScalingTarget(target: ScalingTarget): void {
    this.targets.set(target.id, { ...target });
    this.metrics.set(target.id, []);
    this.emit('targetAdded', target);
  }

  removeScalingTarget(targetId: string): void {
    const target = this.targets.get(targetId);
    if (target) {
      this.targets.delete(targetId);
      this.metrics.delete(targetId);
      this.lastScalingActions.delete(targetId);
      this.emit('targetRemoved', target);
    }
  }

  addScalingPolicy(policy: ScalingPolicy): void {
    this.policies.set(policy.name, { ...policy });
    this.emit('policyAdded', policy);
  }

  removeScalingPolicy(policyName: string): void {
    const policy = this.policies.get(policyName);
    if (policy) {
      this.policies.delete(policyName);
      this.emit('policyRemoved', policy);
    }
  }

  recordMetrics(targetId: string, metrics: ScalingMetrics): void {
    const targetMetrics = this.metrics.get(targetId);
    if (!targetMetrics) {
      console.warn(`No target found for metrics: ${targetId}`);
      return;
    }

    targetMetrics.push({ ...metrics, timestamp: new Date() });

    // Maintain metrics history size
    if (targetMetrics.length > this.maxMetricsPerTarget) {
      targetMetrics.shift();
    }

    // Clean old metrics
    const cutoffTime = new Date(Date.now() - this.metricsRetentionPeriod);
    const validMetrics = targetMetrics.filter(m => m.timestamp > cutoffTime);
    this.metrics.set(targetId, validMetrics);

    this.emit('metricsRecorded', { targetId, metrics });
  }

  private startEvaluation(): void {
    this.evaluationInterval = setInterval(() => {
      this.evaluateScalingPolicies();
    }, 5000); // Evaluate every 5 seconds
  }

  private async evaluateScalingPolicies(): Promise<void> {
    for (const [targetId, target] of this.targets) {
      if (target.status !== 'stable') {
        continue; // Skip targets that are currently scaling
      }

      const targetMetrics = this.metrics.get(targetId);
      if (!targetMetrics || targetMetrics.length === 0) {
        continue;
      }

      for (const [policyName, policy] of this.policies) {
        const shouldScale = await this.evaluatePolicy(targetId, policy, targetMetrics);
        
        if (shouldScale) {
          await this.executeScalingAction(targetId, policy);
        }
      }
    }
  }

  private async evaluatePolicy(
    targetId: string,
    policy: ScalingPolicy,
    metrics: ScalingMetrics[]
  ): Promise<boolean> {
    // Check cooldown period
    const lastAction = this.lastScalingActions.get(targetId);
    if (lastAction) {
      const timeSinceLastAction = (Date.now() - lastAction.getTime()) / 1000;
      if (timeSinceLastAction < policy.cooldownPeriod) {
        return false;
      }
    }

    // Get recent metrics for evaluation
    const recentMetrics = metrics.slice(-policy.evaluationPeriods);
    if (recentMetrics.length < policy.evaluationPeriods) {
      return false; // Not enough data points
    }

    // Check if all evaluation periods meet the threshold
    const allPeriodsMatch = recentMetrics.every(metric => {
      const value = metric[policy.metricType] as number;
      return this.compareMetric(value, policy.threshold, policy.comparisonOperator);
    });

    return allPeriodsMatch;
  }

  private compareMetric(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  private async executeScalingAction(targetId: string, policy: ScalingPolicy): Promise<void> {
    const target = this.targets.get(targetId);
    if (!target) return;

    const currentInstances = target.currentInstances;
    let newInstances: number;

    if (policy.scalingAction.adjustmentType === 'absolute') {
      newInstances = policy.scalingAction.type === 'scale_up'
        ? currentInstances + policy.scalingAction.adjustment
        : currentInstances - policy.scalingAction.adjustment;
    } else {
      // percentage adjustment
      const adjustment = Math.ceil(currentInstances * (policy.scalingAction.adjustment / 100));
      newInstances = policy.scalingAction.type === 'scale_up'
        ? currentInstances + adjustment
        : currentInstances - adjustment;
    }

    // Enforce min/max constraints
    newInstances = Math.max(target.minInstances, Math.min(target.maxInstances, newInstances));

    if (newInstances === currentInstances) {
      return; // No change needed
    }

    // Update target status
    target.status = policy.scalingAction.type === 'scale_up' ? 'scaling_up' : 'scaling_down';
    target.desiredInstances = newInstances;

    const scalingEvent: ScalingEvent = {
      timestamp: new Date(),
      targetId,
      action: policy.scalingAction.type,
      reason: `${policy.name}: ${policy.metricType} ${policy.comparisonOperator} ${policy.threshold}`,
      fromInstances: currentInstances,
      toInstances: newInstances,
      success: false,
    };

    try {
      // Execute the actual scaling operation
      await this.performScaling(target, newInstances);
      
      // Update target state
      target.currentInstances = newInstances;
      target.status = 'stable';
      scalingEvent.success = true;

      // Record the scaling action time
      this.lastScalingActions.set(targetId, new Date());

      this.emit('scalingCompleted', scalingEvent);
    } catch (error) {
      target.status = 'error';
      scalingEvent.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('scalingFailed', scalingEvent);
    }
  }

  private async performScaling(target: ScalingTarget, newInstances: number): Promise<void> {
    // This is where the actual scaling would happen
    // Implementation depends on the infrastructure (AWS, GCP, Kubernetes, etc.)
    
    switch (target.type) {
      case 'server':
        await this.scaleServers(target, newInstances);
        break;
      case 'container':
        await this.scaleContainers(target, newInstances);
        break;
      case 'function':
        await this.scaleFunctions(target, newInstances);
        break;
      default:
        throw new Error(`Unsupported target type: ${target.type}`);
    }
  }

  private async scaleServers(target: ScalingTarget, newInstances: number): Promise<void> {
    // Placeholder for server scaling logic
    // This would integrate with cloud provider APIs (AWS EC2, GCP Compute Engine, etc.)
    console.log(`Scaling servers for ${target.id} to ${newInstances} instances`);
    
    // Simulate scaling delay
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  private async scaleContainers(target: ScalingTarget, newInstances: number): Promise<void> {
    // Placeholder for container scaling logic
    // This would integrate with Kubernetes, Docker Swarm, or container orchestration platforms
    console.log(`Scaling containers for ${target.id} to ${newInstances} instances`);
    
    // Simulate scaling delay
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async scaleFunctions(target: ScalingTarget, newInstances: number): Promise<void> {
    // Placeholder for serverless function scaling logic
    // This would integrate with AWS Lambda, Google Cloud Functions, etc.
    console.log(`Scaling functions for ${target.id} to ${newInstances} instances`);
    
    // Functions typically auto-scale, so this might just update configuration
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  getTargetStatus(targetId: string): ScalingTarget | null {
    return this.targets.get(targetId) || null;
  }

  getAllTargets(): ScalingTarget[] {
    return Array.from(this.targets.values());
  }

  getMetricsHistory(targetId: string, limit?: number): ScalingMetrics[] {
    const metrics = this.metrics.get(targetId) || [];
    return limit ? metrics.slice(-limit) : metrics;
  }

  getPolicyRecommendations(targetId: string): {
    recommendations: string[];
    suggestedPolicies: Partial<ScalingPolicy>[];
  } {
    const metrics = this.metrics.get(targetId);
    const recommendations: string[] = [];
    const suggestedPolicies: Partial<ScalingPolicy>[] = [];

    if (!metrics || metrics.length < 10) {
      recommendations.push('Insufficient metrics data for recommendations');
      return { recommendations, suggestedPolicies };
    }

    const recentMetrics = metrics.slice(-20); // Last 20 data points
    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpuUtilization, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryUtilization, 0) / recentMetrics.length;
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;

    // CPU-based recommendations
    if (avgCpu > 80) {
      recommendations.push('High CPU utilization detected - consider adding CPU-based scale-up policy');
      suggestedPolicies.push({
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
    }

    if (avgCpu < 20) {
      recommendations.push('Low CPU utilization detected - consider adding CPU-based scale-down policy');
      suggestedPolicies.push({
        name: 'cpu-scale-down',
        metricType: 'cpuUtilization',
        threshold: 25,
        comparisonOperator: 'lt',
        evaluationPeriods: 5,
        cooldownPeriod: 600,
        scalingAction: {
          type: 'scale_down',
          adjustment: 1,
          adjustmentType: 'absolute',
        },
      });
    }

    // Memory-based recommendations
    if (avgMemory > 85) {
      recommendations.push('High memory utilization detected - consider adding memory-based scale-up policy');
    }

    // Response time recommendations
    if (avgResponseTime > 1000) {
      recommendations.push('High response times detected - consider adding response-time-based scaling');
    }

    return { recommendations, suggestedPolicies };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    targets: Array<{
      id: string;
      healthy: boolean;
      issues: string[];
    }>;
    policies: number;
  }> {
    const targetHealths = [];
    let overallHealthy = true;

    for (const [targetId, target] of this.targets) {
      const issues: string[] = [];
      
      if (target.status === 'error') {
        issues.push('Target is in error state');
      }
      
      if (target.currentInstances < target.minInstances) {
        issues.push(`Below minimum instances: ${target.currentInstances} < ${target.minInstances}`);
      }
      
      if (target.currentInstances > target.maxInstances) {
        issues.push(`Above maximum instances: ${target.currentInstances} > ${target.maxInstances}`);
      }

      const metrics = this.metrics.get(targetId);
      if (!metrics || metrics.length === 0) {
        issues.push('No metrics data available');
      } else {
        const lastMetric = metrics[metrics.length - 1];
        const timeSinceLastMetric = Date.now() - lastMetric.timestamp.getTime();
        if (timeSinceLastMetric > 60000) { // 1 minute
          issues.push('Metrics data is stale');
        }
      }

      const healthy = issues.length === 0;
      if (!healthy) overallHealthy = false;

      targetHealths.push({
        id: targetId,
        healthy,
        issues,
      });
    }

    return {
      healthy: overallHealthy,
      targets: targetHealths,
      policies: this.policies.size,
    };
  }

  destroy(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }
    
    this.targets.clear();
    this.policies.clear();
    this.metrics.clear();
    this.lastScalingActions.clear();
    
    this.removeAllListeners();
  }
}
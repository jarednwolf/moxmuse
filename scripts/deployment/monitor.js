#!/usr/bin/env node

/**
 * Post-deployment monitoring and alerting script
 */

const https = require('https');
const { HealthChecker } = require('./health-check.js');

class DeploymentMonitor {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://moxmuse.com';
    this.deploymentId = options.deploymentId || process.env.GITHUB_SHA;
    this.slackWebhook = options.slackWebhook || process.env.SLACK_WEBHOOK;
    this.monitoringDuration = options.monitoringDuration || 2 * 60 * 60 * 1000; // 2 hours
    this.checkInterval = options.checkInterval || 5 * 60 * 1000; // 5 minutes
    
    this.thresholds = {
      errorRate: options.errorRateThreshold || 0.01, // 1%
      responseTimeP95: options.responseTimeThreshold || 2000, // 2 seconds
      availability: options.availabilityThreshold || 0.999, // 99.9%
      ...options.thresholds
    };

    this.metrics = {
      checks: 0,
      failures: 0,
      responseTimes: [],
      errors: [],
      startTime: Date.now()
    };
  }

  async sendSlackAlert(message, severity = 'warning') {
    if (!this.slackWebhook) {
      console.log('📢 Slack webhook not configured, skipping alert');
      return;
    }

    const colors = {
      info: 'good',
      warning: 'warning',
      error: 'danger',
      critical: 'danger'
    };

    const emojis = {
      info: ':information_source:',
      warning: ':warning:',
      error: ':x:',
      critical: ':rotating_light:'
    };

    const payload = {
      text: `${emojis[severity]} Deployment Monitoring Alert`,
      username: 'Deployment Monitor',
      attachments: [{
        color: colors[severity],
        text: message,
        fields: [
          {
            title: 'Deployment ID',
            value: this.deploymentId,
            short: true
          },
          {
            title: 'Timestamp',
            value: new Date().toISOString(),
            short: true
          },
          {
            title: 'URL',
            value: this.baseUrl,
            short: true
          }
        ]
      }]
    };

    return new Promise((resolve, reject) => {
      const url = new URL(this.slackWebhook);
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', reject);
      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  async performHealthCheck() {
    const checker = new HealthChecker(this.baseUrl, {
      timeout: 15000,
      retries: 1,
      retryDelay: 2000
    });

    const startTime = Date.now();
    const result = await checker.runAllChecks();
    const responseTime = Date.now() - startTime;

    this.metrics.checks++;
    this.metrics.responseTimes.push(responseTime);

    if (!result.success) {
      this.metrics.failures++;
      this.metrics.errors.push({
        timestamp: new Date().toISOString(),
        error: result.error,
        responseTime
      });
    }

    return {
      success: result.success,
      responseTime,
      error: result.error,
      results: result.results
    };
  }

  calculateMetrics() {
    const { checks, failures, responseTimes, startTime } = this.metrics;
    
    if (checks === 0) {
      return {
        errorRate: 0,
        availability: 1,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        uptime: 0
      };
    }

    const errorRate = failures / checks;
    const availability = (checks - failures) / checks;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    // Calculate P95 response time
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95ResponseTime = sortedTimes[p95Index] || 0;
    
    const uptime = Date.now() - startTime;

    return {
      errorRate,
      availability,
      avgResponseTime,
      p95ResponseTime,
      uptime,
      totalChecks: checks,
      totalFailures: failures
    };
  }

  async checkThresholds() {
    const metrics = this.calculateMetrics();
    const alerts = [];

    // Check error rate threshold
    if (metrics.errorRate > this.thresholds.errorRate) {
      alerts.push({
        severity: 'error',
        message: `Error rate (${(metrics.errorRate * 100).toFixed(2)}%) exceeds threshold (${(this.thresholds.errorRate * 100).toFixed(2)}%)`
      });
    }

    // Check availability threshold
    if (metrics.availability < this.thresholds.availability) {
      alerts.push({
        severity: 'critical',
        message: `Availability (${(metrics.availability * 100).toFixed(3)}%) below threshold (${(this.thresholds.availability * 100).toFixed(3)}%)`
      });
    }

    // Check response time threshold
    if (metrics.p95ResponseTime > this.thresholds.responseTimeP95) {
      alerts.push({
        severity: 'warning',
        message: `P95 response time (${metrics.p95ResponseTime}ms) exceeds threshold (${this.thresholds.responseTimeP95}ms)`
      });
    }

    // Send alerts
    for (const alert of alerts) {
      console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
      await this.sendSlackAlert(alert.message, alert.severity);
    }

    return alerts;
  }

  async generateReport() {
    const metrics = this.calculateMetrics();
    const uptimeHours = (metrics.uptime / (1000 * 60 * 60)).toFixed(2);

    const report = `📊 Deployment Monitoring Report

**Deployment ID:** ${this.deploymentId}
**Monitoring Duration:** ${uptimeHours} hours
**Base URL:** ${this.baseUrl}

**Metrics:**
• Total Health Checks: ${metrics.totalChecks}
• Failures: ${metrics.totalFailures}
• Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%
• Availability: ${(metrics.availability * 100).toFixed(3)}%
• Average Response Time: ${metrics.avgResponseTime.toFixed(0)}ms
• P95 Response Time: ${metrics.p95ResponseTime.toFixed(0)}ms

**Thresholds:**
• Error Rate: < ${(this.thresholds.errorRate * 100).toFixed(2)}%
• Availability: > ${(this.thresholds.availability * 100).toFixed(3)}%
• P95 Response Time: < ${this.thresholds.responseTimeP95}ms

**Status:** ${metrics.errorRate <= this.thresholds.errorRate && 
                metrics.availability >= this.thresholds.availability && 
                metrics.p95ResponseTime <= this.thresholds.responseTimeP95 ? 
                '✅ All thresholds met' : '⚠️ Some thresholds exceeded'}`;

    return report;
  }

  async startMonitoring() {
    console.log(`🔍 Starting deployment monitoring for ${this.deploymentId}`);
    console.log(`📍 Base URL: ${this.baseUrl}`);
    console.log(`⏱️  Duration: ${this.monitoringDuration / (1000 * 60)} minutes`);
    console.log(`🔄 Check interval: ${this.checkInterval / (1000 * 60)} minutes`);
    console.log('=' .repeat(60));

    // Send initial notification
    await this.sendSlackAlert(`🚀 Starting enhanced monitoring for deployment ${this.deploymentId}`, 'info');

    const endTime = Date.now() + this.monitoringDuration;
    let checkCount = 0;

    while (Date.now() < endTime) {
      checkCount++;
      console.log(`\n🔍 Health check #${checkCount} - ${new Date().toISOString()}`);

      try {
        const result = await this.performHealthCheck();
        
        if (result.success) {
          console.log(`✅ Health check passed (${result.responseTime}ms)`);
        } else {
          console.log(`❌ Health check failed: ${result.error}`);
        }

        // Check thresholds and send alerts if needed
        await this.checkThresholds();

        // Log current metrics
        const metrics = this.calculateMetrics();
        console.log(`📊 Current metrics: ${metrics.totalFailures}/${metrics.totalChecks} failures, ${(metrics.availability * 100).toFixed(2)}% availability`);

      } catch (error) {
        console.error(`💥 Health check error: ${error.message}`);
        this.metrics.failures++;
        this.metrics.errors.push({
          timestamp: new Date().toISOString(),
          error: error.message,
          responseTime: null
        });
      }

      // Wait for next check (unless this is the last iteration)
      if (Date.now() + this.checkInterval < endTime) {
        await new Promise(resolve => setTimeout(resolve, this.checkInterval));
      }
    }

    // Generate final report
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Monitoring completed - generating final report...');
    
    const finalReport = await this.generateReport();
    console.log('\n' + finalReport);

    // Send final report
    await this.sendSlackAlert(finalReport, 'info');

    return this.calculateMetrics();
  }

  async runSingleCheck() {
    console.log(`🔍 Running single health check for ${this.baseUrl}`);
    
    const result = await this.performHealthCheck();
    const metrics = this.calculateMetrics();

    console.log(`Result: ${result.success ? 'PASSED' : 'FAILED'}`);
    console.log(`Response time: ${result.responseTime}ms`);
    
    if (!result.success) {
      console.log(`Error: ${result.error}`);
    }

    return {
      success: result.success,
      responseTime: result.responseTime,
      error: result.error,
      metrics
    };
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'monitor';

  const options = {
    baseUrl: args[1] || process.env.BASE_URL || 'https://moxmuse.com',
    deploymentId: process.env.GITHUB_SHA || 'manual-run',
    monitoringDuration: parseInt(args[2]) || 2 * 60 * 60 * 1000, // 2 hours
    checkInterval: parseInt(args[3]) || 5 * 60 * 1000 // 5 minutes
  };

  const monitor = new DeploymentMonitor(options);

  try {
    switch (command) {
      case 'monitor':
        const metrics = await monitor.startMonitoring();
        console.log('\nFinal metrics:', JSON.stringify(metrics, null, 2));
        process.exit(metrics.availability >= monitor.thresholds.availability ? 0 : 1);
        break;

      case 'check':
        const result = await monitor.runSingleCheck();
        process.exit(result.success ? 0 : 1);
        break;

      case 'report':
        // Generate report from existing metrics (if any)
        const report = await monitor.generateReport();
        console.log(report);
        break;

      default:
        console.log(`Usage: node monitor.js <command> [baseUrl] [duration] [interval]

Commands:
  monitor     - Start continuous monitoring (default)
  check       - Run single health check
  report      - Generate current metrics report

Examples:
  node monitor.js monitor https://moxmuse.com 7200000 300000
  node monitor.js check https://moxmuse.com
  node monitor.js report`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Monitoring script failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DeploymentMonitor };
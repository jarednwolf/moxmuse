#!/usr/bin/env node

/**
 * Automated rollback script for failed deployments
 */

const https = require('https');

class RollbackManager {
  constructor(options = {}) {
    this.vercelToken = options.vercelToken || process.env.VERCEL_TOKEN;
    this.projectId = options.projectId || process.env.VERCEL_PROJECT_ID;
    this.slackWebhook = options.slackWebhook || process.env.SLACK_WEBHOOK;
    
    if (!this.vercelToken || !this.projectId) {
      throw new Error('VERCEL_TOKEN and VERCEL_PROJECT_ID are required');
    }
  }

  async makeVercelRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: 'api.vercel.com',
        path,
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${this.vercelToken}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({
              statusCode: res.statusCode,
              data: parsed
            });
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              data: data
            });
          }
        });
      });

      req.on('error', reject);

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  async getDeployments(limit = 10) {
    console.log('📋 Fetching recent deployments...');
    
    const response = await this.makeVercelRequest(
      `/v6/deployments?projectId=${this.projectId}&limit=${limit}&state=READY`
    );

    if (response.statusCode !== 200) {
      throw new Error(`Failed to fetch deployments: ${response.statusCode}`);
    }

    return response.data.deployments;
  }

  async getCurrentProductionDeployment() {
    console.log('🔍 Finding current production deployment...');
    
    const deployments = await this.getDeployments(20);
    const productionDeployment = deployments.find(d => d.target === 'production');
    
    if (!productionDeployment) {
      throw new Error('No production deployment found');
    }

    return productionDeployment;
  }

  async getPreviousStableDeployment() {
    console.log('🔍 Finding previous stable deployment...');
    
    const deployments = await this.getDeployments(20);
    const productionDeployments = deployments.filter(d => d.target === 'production');
    
    if (productionDeployments.length < 2) {
      throw new Error('No previous production deployment found for rollback');
    }

    // Return the second most recent production deployment
    return productionDeployments[1];
  }

  async rollbackToDeployment(deploymentId) {
    console.log(`🔄 Rolling back to deployment: ${deploymentId}`);
    
    const response = await this.makeVercelRequest(
      `/v9/projects/${this.projectId}`,
      {
        method: 'PATCH',
        body: {
          targets: {
            production: {
              id: deploymentId
            }
          }
        }
      }
    );

    if (response.statusCode !== 200) {
      throw new Error(`Rollback failed: ${response.statusCode} - ${JSON.stringify(response.data)}`);
    }

    return response.data;
  }

  async verifyRollback(expectedDeploymentId) {
    console.log('✅ Verifying rollback...');
    
    // Wait for propagation
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const currentDeployment = await this.getCurrentProductionDeployment();
    
    if (currentDeployment.uid !== expectedDeploymentId) {
      throw new Error(`Rollback verification failed. Expected: ${expectedDeploymentId}, Got: ${currentDeployment.uid}`);
    }

    console.log('✅ Rollback verified successfully');
    return true;
  }

  async sendSlackNotification(message, isError = false) {
    if (!this.slackWebhook) {
      console.log('📢 Slack webhook not configured, skipping notification');
      return;
    }

    const payload = {
      text: message,
      username: 'Deployment Bot',
      icon_emoji: isError ? ':rotating_light:' : ':recycle:',
      attachments: [{
        color: isError ? 'danger' : 'warning',
        fields: [{
          title: 'Timestamp',
          value: new Date().toISOString(),
          short: true
        }]
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

  async performRollback(reason = 'Automated rollback due to deployment failure') {
    console.log('🚨 Starting automated rollback process...');
    console.log(`Reason: ${reason}`);
    console.log('=' .repeat(60));

    try {
      // Get current and previous deployments
      const currentDeployment = await this.getCurrentProductionDeployment();
      const previousDeployment = await this.getPreviousStableDeployment();

      console.log(`Current deployment: ${currentDeployment.uid} (${new Date(currentDeployment.createdAt).toISOString()})`);
      console.log(`Rolling back to: ${previousDeployment.uid} (${new Date(previousDeployment.createdAt).toISOString()})`);

      // Perform rollback
      await this.rollbackToDeployment(previousDeployment.uid);

      // Verify rollback
      await this.verifyRollback(previousDeployment.uid);

      // Send success notification
      const successMessage = `🔄 Automated rollback completed successfully!

**Reason:** ${reason}
**Failed deployment:** ${currentDeployment.uid}
**Rolled back to:** ${previousDeployment.uid}
**Rollback time:** ${new Date().toISOString()}

Please investigate the deployment failure and fix the issues before the next deployment.`;

      await this.sendSlackNotification(successMessage, false);

      console.log('=' .repeat(60));
      console.log('🎉 Rollback completed successfully!');
      console.log('=' .repeat(60));

      return {
        success: true,
        rolledBackFrom: currentDeployment.uid,
        rolledBackTo: previousDeployment.uid,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('💥 Rollback failed:', error.message);

      // Send failure notification
      const errorMessage = `🚨 Automated rollback FAILED!

**Reason:** ${reason}
**Error:** ${error.message}
**Timestamp:** ${new Date().toISOString()}

**URGENT:** Manual intervention required! The production deployment may be in an unstable state.`;

      await this.sendSlackNotification(errorMessage, true);

      throw error;
    }
  }

  async checkDeploymentHealth(baseUrl = 'https://moxmuse.com') {
    console.log(`🏥 Checking deployment health at ${baseUrl}...`);

    const { HealthChecker } = require('./health-check.js');
    const checker = new HealthChecker(baseUrl, {
      timeout: 15000,
      retries: 2,
      retryDelay: 3000
    });

    const result = await checker.runAllChecks();
    return result.success;
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const rollbackManager = new RollbackManager();

  try {
    switch (command) {
      case 'check':
        const isHealthy = await rollbackManager.checkDeploymentHealth(args[1]);
        console.log(`Health check result: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
        process.exit(isHealthy ? 0 : 1);
        break;

      case 'rollback':
        const reason = args[1] || 'Manual rollback requested';
        const result = await rollbackManager.performRollback(reason);
        console.log('Rollback result:', JSON.stringify(result, null, 2));
        process.exit(0);
        break;

      case 'list':
        const deployments = await rollbackManager.getDeployments(10);
        console.log('Recent deployments:');
        deployments.forEach(d => {
          console.log(`- ${d.uid} (${d.target}) - ${new Date(d.createdAt).toISOString()}`);
        });
        break;

      default:
        console.log(`Usage: node rollback.js <command> [args]

Commands:
  check [url]           - Check deployment health
  rollback [reason]     - Perform automated rollback
  list                  - List recent deployments

Examples:
  node rollback.js check https://moxmuse.com
  node rollback.js rollback "Health checks failed"
  node rollback.js list`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Script failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { RollbackManager };
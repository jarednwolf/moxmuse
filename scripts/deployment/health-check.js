#!/usr/bin/env node

/**
 * Comprehensive health check script for deployment verification
 */

const https = require('https');
const http = require('http');

class HealthChecker {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 5000;
  }

  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${path}`;
      const isHttps = url.startsWith('https');
      const client = isHttps ? https : http;
      
      const req = client.request(url, {
        method: options.method || 'GET',
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Deployment-Health-Check/1.0',
          ...options.headers
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  async checkWithRetry(checkFn, name) {
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        console.log(`🔍 ${name} (attempt ${attempt}/${this.retries})`);
        const result = await checkFn();
        console.log(`✅ ${name} - PASSED`);
        return result;
      } catch (error) {
        console.log(`❌ ${name} - FAILED: ${error.message}`);
        
        if (attempt === this.retries) {
          throw error;
        }
        
        console.log(`⏳ Retrying in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  async basicHealthCheck() {
    return this.checkWithRetry(async () => {
      const response = await this.makeRequest('/api/health');
      
      if (response.statusCode !== 200) {
        throw new Error(`Health endpoint returned ${response.statusCode}`);
      }

      const health = JSON.parse(response.body);
      if (health.status !== 'healthy') {
        throw new Error(`Health status is ${health.status}`);
      }

      return health;
    }, 'Basic Health Check');
  }

  async detailedHealthCheck() {
    return this.checkWithRetry(async () => {
      const response = await this.makeRequest('/api/health/detailed');
      
      if (response.statusCode !== 200) {
        throw new Error(`Detailed health endpoint returned ${response.statusCode}`);
      }

      const health = JSON.parse(response.body);
      
      // Check individual services
      const failedServices = health.services?.filter(s => s.status !== 'up') || [];
      if (failedServices.length > 0) {
        throw new Error(`Services failed: ${failedServices.map(s => s.name).join(', ')}`);
      }

      return health;
    }, 'Detailed Health Check');
  }

  async databaseHealthCheck() {
    return this.checkWithRetry(async () => {
      const response = await this.makeRequest('/api/health/database');
      
      if (response.statusCode !== 200) {
        throw new Error(`Database health endpoint returned ${response.statusCode}`);
      }

      const dbHealth = JSON.parse(response.body);
      if (!dbHealth.connected) {
        throw new Error('Database not connected');
      }

      if (dbHealth.responseTime > 1000) {
        console.warn(`⚠️  Database response time is high: ${dbHealth.responseTime}ms`);
      }

      return dbHealth;
    }, 'Database Health Check');
  }

  async aiServiceHealthCheck() {
    return this.checkWithRetry(async () => {
      const response = await this.makeRequest('/api/health/ai');
      
      if (response.statusCode !== 200) {
        throw new Error(`AI service health endpoint returned ${response.statusCode}`);
      }

      const aiHealth = JSON.parse(response.body);
      if (!aiHealth.available) {
        throw new Error('AI service not available');
      }

      return aiHealth;
    }, 'AI Service Health Check');
  }

  async performanceCheck() {
    return this.checkWithRetry(async () => {
      const startTime = Date.now();
      const response = await this.makeRequest('/');
      const loadTime = Date.now() - startTime;
      
      if (response.statusCode !== 200) {
        throw new Error(`Homepage returned ${response.statusCode}`);
      }

      if (loadTime > 5000) {
        throw new Error(`Homepage load time too slow: ${loadTime}ms`);
      }

      if (loadTime > 3000) {
        console.warn(`⚠️  Homepage load time is high: ${loadTime}ms`);
      }

      return { loadTime, statusCode: response.statusCode };
    }, 'Performance Check');
  }

  async criticalUserJourneyCheck() {
    return this.checkWithRetry(async () => {
      // Test the tutor page loads
      const tutorResponse = await this.makeRequest('/tutor');
      if (tutorResponse.statusCode !== 200) {
        throw new Error(`Tutor page returned ${tutorResponse.statusCode}`);
      }

      // Test API endpoints are accessible
      const apiResponse = await this.makeRequest('/api/trpc/health');
      if (apiResponse.statusCode !== 200) {
        throw new Error(`tRPC health endpoint returned ${apiResponse.statusCode}`);
      }

      return { tutorPage: 'ok', apiEndpoint: 'ok' };
    }, 'Critical User Journey Check');
  }

  async runAllChecks() {
    console.log(`🚀 Starting health checks for ${this.baseUrl}`);
    console.log('=' .repeat(60));

    const results = {};
    const startTime = Date.now();

    try {
      // Run checks in order of importance
      results.basic = await this.basicHealthCheck();
      results.detailed = await this.detailedHealthCheck();
      results.database = await this.databaseHealthCheck();
      results.aiService = await this.aiServiceHealthCheck();
      results.performance = await this.performanceCheck();
      results.userJourney = await this.criticalUserJourneyCheck();

      const totalTime = Date.now() - startTime;
      
      console.log('=' .repeat(60));
      console.log(`🎉 All health checks passed in ${totalTime}ms`);
      console.log('=' .repeat(60));

      return {
        success: true,
        totalTime,
        results
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      console.log('=' .repeat(60));
      console.log(`💥 Health checks failed after ${totalTime}ms`);
      console.log(`Error: ${error.message}`);
      console.log('=' .repeat(60));

      return {
        success: false,
        error: error.message,
        totalTime,
        results
      };
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:3000';
  
  const options = {
    timeout: parseInt(args[1]) || 30000,
    retries: parseInt(args[2]) || 3,
    retryDelay: parseInt(args[3]) || 5000
  };

  const checker = new HealthChecker(baseUrl, options);
  const result = await checker.runAllChecks();

  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Health check script failed:', error);
    process.exit(1);
  });
}

module.exports = { HealthChecker };
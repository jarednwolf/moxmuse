#!/usr/bin/env node

/**
 * Comprehensive deployment verification script
 */

const { spawn } = require('child_process');
const { HealthChecker } = require('./health-check.js');

class DeploymentVerifier {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://moxmuse.com';
    this.deploymentId = options.deploymentId || process.env.GITHUB_SHA;
    this.timeout = options.timeout || 300000; // 5 minutes
    this.skipE2E = options.skipE2E || false;
    this.skipPerformance = options.skipPerformance || false;
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      console.log(`🔧 Running: ${command} ${args.join(' ')}`);
      
      const child = spawn(command, args, {
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (!options.silent) {
          process.stdout.write(data);
        }
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
        if (!options.silent) {
          process.stderr.write(data);
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', reject);

      // Set timeout
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${this.timeout}ms`));
      }, this.timeout);
    });
  }

  async verifyHealthChecks() {
    console.log('🏥 Running comprehensive health checks...');
    
    const checker = new HealthChecker(this.baseUrl, {
      timeout: 30000,
      retries: 3,
      retryDelay: 5000
    });

    const result = await checker.runAllChecks();
    
    if (!result.success) {
      throw new Error(`Health checks failed: ${result.error}`);
    }

    console.log('✅ All health checks passed');
    return result;
  }

  async verifySmokeTests() {
    console.log('🚬 Running smoke tests...');
    
    try {
      await this.runCommand('pnpm', ['test:smoke', `--baseURL=${this.baseUrl}`], {
        cwd: process.cwd(),
        env: { ...process.env, BASE_URL: this.baseUrl }
      });
      
      console.log('✅ Smoke tests passed');
      return true;
    } catch (error) {
      console.error('❌ Smoke tests failed:', error.message);
      throw error;
    }
  }

  async verifyPerformance() {
    if (this.skipPerformance) {
      console.log('⏭️  Skipping performance verification');
      return { skipped: true };
    }

    console.log('⚡ Running performance verification...');
    
    try {
      // Run Lighthouse CI
      await this.runCommand('npx', ['lhci', 'autorun', '--config=.lighthouserc.json'], {
        cwd: process.cwd(),
        env: { ...process.env, LHCI_BUILD_CONTEXT__CURRENT_HASH: this.deploymentId }
      });
      
      console.log('✅ Performance verification passed');
      return true;
    } catch (error) {
      console.warn('⚠️  Performance verification failed (non-blocking):', error.message);
      return { failed: true, error: error.message };
    }
  }

  async verifyE2ETests() {
    if (this.skipE2E) {
      console.log('⏭️  Skipping E2E tests');
      return { skipped: true };
    }

    console.log('🎭 Running critical E2E tests...');
    
    try {
      await this.runCommand('pnpm', ['playwright', 'test', '--grep', 'Critical Path'], {
        cwd: 'apps/web',
        env: { ...process.env, BASE_URL: this.baseUrl }
      });
      
      console.log('✅ E2E tests passed');
      return true;
    } catch (error) {
      console.error('❌ E2E tests failed:', error.message);
      throw error;
    }
  }

  async verifyDatabaseMigrations() {
    console.log('🗄️  Verifying database migrations...');
    
    try {
      // Check if migrations are up to date
      await this.runCommand('pnpm', ['db:migrate:status'], {
        cwd: process.cwd(),
        silent: true
      });
      
      console.log('✅ Database migrations verified');
      return true;
    } catch (error) {
      console.error('❌ Database migration verification failed:', error.message);
      throw error;
    }
  }

  async verifyEnvironmentConfig() {
    console.log('⚙️  Verifying environment configuration...');
    
    const requiredEnvVars = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'OPENAI_API_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Test API endpoint for config verification
    try {
      const response = await fetch(`${this.baseUrl}/api/health/config`);
      if (!response.ok) {
        throw new Error(`Config endpoint returned ${response.status}`);
      }
      
      const config = await response.json();
      if (config.environment === 'development' && this.baseUrl.includes('moxmuse.com')) {
        throw new Error('Production deployment is running in development mode');
      }
    } catch (error) {
      console.warn('⚠️  Could not verify config endpoint:', error.message);
    }

    console.log('✅ Environment configuration verified');
    return true;
  }

  async verifySecurityHeaders() {
    console.log('🔒 Verifying security headers...');
    
    try {
      const response = await fetch(this.baseUrl, { method: 'HEAD' });
      const headers = response.headers;

      const securityHeaders = {
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'x-xss-protection': '1; mode=block'
      };

      const missingHeaders = [];
      for (const [header, expectedValue] of Object.entries(securityHeaders)) {
        const actualValue = headers.get(header);
        if (!actualValue) {
          missingHeaders.push(header);
        }
      }

      if (missingHeaders.length > 0) {
        console.warn(`⚠️  Missing security headers: ${missingHeaders.join(', ')}`);
      } else {
        console.log('✅ Security headers verified');
      }

      return { missingHeaders };
    } catch (error) {
      console.warn('⚠️  Could not verify security headers:', error.message);
      return { error: error.message };
    }
  }

  async generateVerificationReport(results) {
    const report = {
      deploymentId: this.deploymentId,
      baseUrl: this.baseUrl,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
        skipped: 0
      }
    };

    // Count results
    Object.values(results).forEach(result => {
      if (result === true) {
        report.summary.passed++;
      } else if (result && result.skipped) {
        report.summary.skipped++;
      } else if (result && result.failed) {
        report.summary.warnings++;
      } else {
        report.summary.failed++;
      }
    });

    return report;
  }

  async runFullVerification() {
    console.log(`🚀 Starting deployment verification for ${this.deploymentId}`);
    console.log(`📍 Base URL: ${this.baseUrl}`);
    console.log('=' .repeat(60));

    const results = {};
    const startTime = Date.now();

    try {
      // Run verifications in order of importance
      results.healthChecks = await this.verifyHealthChecks();
      results.environmentConfig = await this.verifyEnvironmentConfig();
      results.databaseMigrations = await this.verifyDatabaseMigrations();
      results.smokeTests = await this.verifySmokeTests();
      results.securityHeaders = await this.verifySecurityHeaders();
      results.performance = await this.verifyPerformance();
      results.e2eTests = await this.verifyE2ETests();

      const totalTime = Date.now() - startTime;
      const report = await this.generateVerificationReport(results);

      console.log('=' .repeat(60));
      console.log(`🎉 Deployment verification completed in ${totalTime}ms`);
      console.log(`✅ Passed: ${report.summary.passed}`);
      console.log(`❌ Failed: ${report.summary.failed}`);
      console.log(`⚠️  Warnings: ${report.summary.warnings}`);
      console.log(`⏭️  Skipped: ${report.summary.skipped}`);
      console.log('=' .repeat(60));

      // Write report to file
      const fs = require('fs');
      fs.writeFileSync(
        `deployment-verification-${this.deploymentId}.json`,
        JSON.stringify(report, null, 2)
      );

      return {
        success: report.summary.failed === 0,
        report,
        totalTime
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      console.log('=' .repeat(60));
      console.log(`💥 Deployment verification failed after ${totalTime}ms`);
      console.log(`Error: ${error.message}`);
      console.log('=' .repeat(60));

      return {
        success: false,
        error: error.message,
        results,
        totalTime
      };
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    baseUrl: args[0] || process.env.BASE_URL || 'https://moxmuse.com',
    deploymentId: process.env.GITHUB_SHA || 'manual-verification',
    skipE2E: args.includes('--skip-e2e'),
    skipPerformance: args.includes('--skip-performance'),
    timeout: parseInt(args.find(arg => arg.startsWith('--timeout='))?.split('=')[1]) || 300000
  };

  const verifier = new DeploymentVerifier(options);
  const result = await verifier.runFullVerification();

  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Verification script failed:', error);
    process.exit(1);
  });
}

module.exports = { DeploymentVerifier };
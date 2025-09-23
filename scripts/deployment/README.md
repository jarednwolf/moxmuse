# Deployment Scripts

This directory contains scripts for managing production deployments, health checks, monitoring, and rollbacks.

## Scripts Overview

### health-check.js
Comprehensive health check script that verifies all critical system components.

**Usage:**
```bash
# Basic health check
node health-check.js https://moxmuse.com

# With custom timeout and retries
node health-check.js https://moxmuse.com 30000 3 5000
```

**Features:**
- Basic health endpoint verification
- Detailed service status checks
- Database connectivity testing
- AI service availability
- Performance monitoring
- Critical user journey validation

### rollback.js
Automated rollback system for failed deployments.

**Usage:**
```bash
# Perform automated rollback
node rollback.js rollback "Health checks failed"

# Check current deployment health
node rollback.js check https://moxmuse.com

# List recent deployments
node rollback.js list
```

**Features:**
- Automatic detection of previous stable deployment
- Vercel API integration for rollback execution
- Health verification after rollback
- Slack notifications
- Rollback verification

### monitor.js
Post-deployment monitoring and alerting system.

**Usage:**
```bash
# Start 2-hour monitoring session
node monitor.js monitor https://moxmuse.com

# Single health check
node monitor.js check https://moxmuse.com

# Generate metrics report
node monitor.js report
```

**Features:**
- Continuous health monitoring
- Performance metrics tracking
- Threshold-based alerting
- Slack notifications
- Detailed reporting

### verify.js
Comprehensive deployment verification suite.

**Usage:**
```bash
# Full verification
node verify.js https://moxmuse.com

# Skip E2E tests
node verify.js https://moxmuse.com --skip-e2e

# Skip performance tests
node verify.js https://moxmuse.com --skip-performance
```

**Features:**
- Health check verification
- Smoke test execution
- Performance validation
- E2E test running
- Database migration verification
- Security header checks

## Environment Variables

The scripts require the following environment variables:

### Required for all scripts:
- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_PROJECT_ID` - Vercel project ID

### Optional:
- `SLACK_WEBHOOK` - Slack webhook URL for notifications
- `GITHUB_SHA` - Git commit SHA (automatically set in CI)
- `BASE_URL` - Base URL for health checks (defaults to https://moxmuse.com)

## Integration with CI/CD

These scripts are integrated into the GitHub Actions workflows:

1. **health-check.js** - Used in deployment verification steps
2. **rollback.js** - Triggered automatically on deployment failures
3. **monitor.js** - Started after successful deployments
4. **verify.js** - Comprehensive post-deployment validation

## Error Handling

All scripts implement:
- Retry logic with exponential backoff
- Comprehensive error logging
- Graceful failure handling
- Detailed error reporting
- Slack notifications for failures

## Monitoring Thresholds

Default thresholds (configurable):
- Error rate: < 1%
- Availability: > 99.9%
- Response time P95: < 2 seconds
- Database response time: < 500ms

## Manual Operations

### Emergency Rollback
```bash
# Immediate rollback for critical issues
pnpm deployment:rollback "Critical production issue"
```

### Health Check During Incident
```bash
# Quick health assessment
pnpm deployment:health-check https://moxmuse.com
```

### Extended Monitoring
```bash
# Monitor for 4 hours instead of 2
node monitor.js monitor https://moxmuse.com 14400000
```

## Troubleshooting

### Common Issues

1. **Vercel API Errors**
   - Verify `VERCEL_TOKEN` is valid
   - Check `VERCEL_PROJECT_ID` is correct
   - Ensure token has necessary permissions

2. **Health Check Failures**
   - Check database connectivity
   - Verify environment variables
   - Test external service availability

3. **Slack Notification Failures**
   - Verify `SLACK_WEBHOOK` URL is correct
   - Check webhook permissions
   - Test webhook manually

### Debug Mode

Enable debug logging by setting:
```bash
export DEBUG=deployment:*
```

### Log Files

Scripts generate log files in:
- `deployment-verification-{sha}.json` - Verification results
- `monitoring-report-{timestamp}.json` - Monitoring data
- `rollback-log-{timestamp}.json` - Rollback operations

## Security Considerations

- All API tokens are stored as GitHub secrets
- Scripts validate input parameters
- Error messages don't expose sensitive information
- Webhook URLs are validated before use
- Database queries use parameterized statements

## Performance

Scripts are optimized for:
- Fast execution (< 5 minutes for full verification)
- Minimal resource usage
- Efficient API calls
- Parallel execution where possible
- Proper timeout handling
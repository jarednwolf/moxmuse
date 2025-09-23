# Security and Privacy Implementation

This directory contains the comprehensive security and privacy implementation for the AI Deck Building Tutor application. The implementation addresses all requirements from Task 7 of the production-ready specification.

## Overview

The security system provides:

- **Secure Authentication**: Industry-standard password hashing, session management, and MFA support
- **API Rate Limiting**: User-based quotas and DDoS protection
- **Data Encryption**: AES-256-GCM encryption for sensitive information
- **CSRF Protection**: Token-based CSRF protection for state-changing operations
- **Vulnerability Scanning**: Automated security scanning and monitoring
- **Security Monitoring**: Comprehensive audit logging and suspicious activity detection

## Components

### 1. SecurityService (`SecurityService.ts`)

Core security service providing encryption, CSRF protection, input validation, and audit logging.

**Key Features:**
- AES-256-GCM encryption/decryption
- CSRF token generation and validation
- Input validation (XSS, SQL injection, path traversal)
- Security headers management
- Audit logging and suspicious activity detection

**Usage:**
```typescript
import { securityService } from './SecurityService'

// Encrypt sensitive data
const encrypted = securityService.encrypt('sensitive data')
const decrypted = securityService.decrypt(encrypted)

// Generate CSRF token
const token = securityService.generateCSRFToken(ctx)
const isValid = securityService.validateCSRFToken(token, ctx)

// Validate input
const isSafe = securityService.validateInput(userInput, 'xss')

// Log security events
securityService.logSecurityEvent(ctx, 'user_login', 'auth', true)
```

### 2. AuthenticationService (`AuthenticationService.ts`)

Handles user authentication, session management, and password security.

**Key Features:**
- Secure password hashing with bcrypt
- Session creation and validation
- Account lockout protection
- Password strength validation
- Multi-factor authentication support

**Usage:**
```typescript
import { authenticationService } from './AuthenticationService'

// Authenticate user
const result = await authenticationService.authenticateUser(
  'user@example.com',
  'password',
  ctx
)

// Validate session
const session = await authenticationService.validateSession(sessionId, ctx)

// Validate password strength
const validation = authenticationService.validatePasswordStrength(password)
```

### 3. VulnerabilityScanner (`VulnerabilityScanner.ts`)

Automated security vulnerability scanning and reporting.

**Key Features:**
- Dependency vulnerability scanning
- Code security pattern detection
- Runtime environment validation
- Automated reporting and alerting
- Configurable scan schedules

**Usage:**
```typescript
import { vulnerabilityScanner } from './VulnerabilityScanner'

// Run security scan
const report = await vulnerabilityScanner.runFullScan()

// Get scan history
const history = vulnerabilityScanner.getScanHistory(10)

// Update configuration
vulnerabilityScanner.updateConfiguration({
  scanInterval: 24 * 60 * 60 * 1000, // 24 hours
  alertThreshold: 'medium'
})
```

### 4. Security Middleware (`../middleware/security.ts`)

tRPC middleware for applying security controls to API endpoints.

**Key Features:**
- Authentication enforcement
- CSRF protection
- Input validation
- Rate limiting
- Security headers
- Audit logging

**Usage:**
```typescript
import { securityMiddleware } from '../middleware/security'

// Apply to tRPC procedures
const protectedProcedure = publicProcedure
  .use(securityMiddleware.authenticated)
  .mutation(async ({ ctx, input }) => {
    // Protected endpoint logic
  })

const sensitiveProcedure = publicProcedure
  .use(securityMiddleware.sensitive) // Includes CSRF protection
  .mutation(async ({ ctx, input }) => {
    // Sensitive operation logic
  })
```

### 5. Security Router (`../routers/security.ts`)

API endpoints for security management and monitoring.

**Available Endpoints:**
- `generateCSRFToken` - Generate CSRF tokens
- `validatePassword` - Validate password strength
- `getUserSessions` - Get user's active sessions
- `invalidateSession` - Invalidate specific session
- `getAuditLogs` - Get security audit logs
- `runSecurityScan` - Trigger vulnerability scan (admin only)
- `getSecurityStats` - Get security statistics (admin only)

## Configuration

### Environment Variables

Required environment variables:

```bash
# Encryption key (32 bytes as hex - 64 characters)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# NextAuth secret for session management
NEXTAUTH_SECRET=your-secure-random-secret

# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/database

# Optional: Redis for distributed rate limiting
REDIS_URL=redis://localhost:6379
```

### Security Configuration

The security system uses secure defaults but can be configured:

```typescript
// Vulnerability scanner configuration
vulnerabilityScanner.updateConfiguration({
  enableDependencyScanning: true,
  enableCodeScanning: true,
  enableRuntimeScanning: true,
  scanInterval: 24 * 60 * 60 * 1000, // 24 hours
  alertThreshold: 'medium',
  autoFixEnabled: false, // Disabled by default for safety
})

// Rate limiting configuration
const rateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000,
  keyGenerator: (ctx) => `user:${ctx.user?.id || 'anonymous'}`,
})
```

## Database Schema

The security system requires additional database tables:

```sql
-- User sessions for secure session management
CREATE TABLE "UserSession" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP NOT NULL,
    "metadata" JSONB DEFAULT '{}'
);

-- Security audit logs
CREATE TABLE "SecurityAuditLog" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "details" JSONB DEFAULT '{}',
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additional User table columns
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP;
```

## Security Features

### 1. Secure Authentication

- **Password Hashing**: bcrypt with 12 rounds
- **Session Management**: Secure session tokens with expiration
- **Account Lockout**: Automatic lockout after failed attempts
- **MFA Support**: TOTP-based multi-factor authentication
- **Password Policies**: Configurable strength requirements

### 2. API Rate Limiting

- **User-based Quotas**: Different limits for authenticated/anonymous users
- **Endpoint-specific Limits**: Stricter limits for expensive operations
- **DDoS Protection**: Automatic IP blocking for suspicious activity
- **Distributed Support**: Redis-backed rate limiting for multi-instance deployments

### 3. Data Encryption

- **At-rest Encryption**: AES-256-GCM for sensitive database fields
- **In-transit Encryption**: HTTPS/TLS for all communications
- **Key Management**: Secure key derivation and rotation support
- **Field-level Encryption**: Selective encryption of sensitive fields

### 4. CSRF Protection

- **Token-based Protection**: Cryptographically secure tokens
- **Session Binding**: Tokens tied to user sessions
- **One-time Use**: Tokens invalidated after use
- **Automatic Cleanup**: Expired token cleanup

### 5. Vulnerability Scanning

- **Dependency Scanning**: Check for known vulnerable packages
- **Code Analysis**: Static analysis for security patterns
- **Runtime Checks**: Environment and configuration validation
- **Automated Reporting**: Regular scan reports and alerts

## Security Headers

The system applies comprehensive security headers:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-XSS-Protection: 1; mode=block
```

## Monitoring and Alerting

### Security Events

All security-relevant events are logged:

- Authentication attempts (success/failure)
- Session creation/invalidation
- CSRF token generation/validation
- Input validation failures
- Rate limit violations
- Suspicious activity detection

### Metrics

Key security metrics are tracked:

- Authentication success/failure rates
- Session duration and activity
- Rate limit hit rates
- Vulnerability scan results
- Security event frequencies

### Alerting

Automated alerts for:

- High-severity vulnerabilities
- Suspicious activity patterns
- Authentication anomalies
- System security events

## Testing

Comprehensive test coverage includes:

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end security flows
- **Security Tests**: Vulnerability and penetration testing
- **Performance Tests**: Load testing of security components

Run tests:

```bash
# Run all security tests
npm test packages/api/src/services/security

# Run specific test suites
npm test SecurityService.test.ts
npm test AuthenticationService.test.ts
npm test security-integration.test.ts
```

## Best Practices

### Development

1. **Never log sensitive data** - Use sanitization functions
2. **Validate all inputs** - Apply security middleware consistently
3. **Use parameterized queries** - Prevent SQL injection
4. **Implement proper error handling** - Don't leak information
5. **Regular security reviews** - Code review security changes

### Deployment

1. **Use strong secrets** - Generate cryptographically secure keys
2. **Enable HTTPS** - Force secure connections
3. **Monitor security events** - Set up alerting
4. **Regular updates** - Keep dependencies current
5. **Backup encryption keys** - Secure key management

### Operations

1. **Monitor audit logs** - Regular security log review
2. **Run vulnerability scans** - Automated and manual scanning
3. **Update security policies** - Regular policy review
4. **Incident response** - Have security incident procedures
5. **Security training** - Keep team updated on security practices

## Compliance

The security implementation supports compliance with:

- **GDPR**: Data encryption and audit logging
- **SOC 2**: Security controls and monitoring
- **OWASP Top 10**: Protection against common vulnerabilities
- **Industry Standards**: Following security best practices

## Troubleshooting

### Common Issues

1. **Encryption Key Errors**
   - Ensure ENCRYPTION_KEY is 64 hex characters (32 bytes)
   - Verify key is properly set in environment

2. **Session Issues**
   - Check database connectivity
   - Verify session table exists
   - Check session expiration settings

3. **Rate Limiting**
   - Monitor rate limit metrics
   - Adjust limits based on usage patterns
   - Check Redis connectivity for distributed setups

4. **CSRF Token Issues**
   - Ensure tokens are included in requests
   - Check token expiration
   - Verify session consistency

### Debug Mode

Enable debug logging:

```bash
DEBUG=security:* npm start
```

### Health Checks

Monitor security system health:

```typescript
// Check security service status
const healthStatus = await securityService.getHealthStatus()

// Check vulnerability scanner status
const scanStatus = vulnerabilityScanner.isScanInProgress()

// Check authentication service
const authHealth = await authenticationService.getHealthStatus()
```

## Contributing

When contributing to the security system:

1. **Security Review Required** - All security changes need review
2. **Test Coverage** - Maintain high test coverage
3. **Documentation** - Update documentation for changes
4. **Backward Compatibility** - Consider migration paths
5. **Performance Impact** - Monitor performance implications

## Support

For security-related issues:

1. **Security Vulnerabilities** - Report privately to security team
2. **Configuration Help** - Check documentation and examples
3. **Performance Issues** - Monitor metrics and logs
4. **Feature Requests** - Follow standard contribution process

---

This security implementation provides enterprise-grade security controls while maintaining performance and usability. Regular updates and monitoring ensure continued protection against evolving threats.
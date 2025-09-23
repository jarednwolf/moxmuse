-- Add security-related tables to support authentication, sessions, and security monitoring

-- User sessions table for secure session management
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- Security audit logs table
CREATE TABLE "SecurityAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "details" JSONB DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

-- Vulnerability scan reports table
CREATE TABLE "VulnerabilityReport" (
    "id" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "vulnerabilities" JSONB NOT NULL DEFAULT '[]',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VulnerabilityReport_pkey" PRIMARY KEY ("id")
);

-- Rate limiting tracking table
CREATE TABLE "RateLimitEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("id")
);

-- Security configuration table
CREATE TABLE "SecurityConfiguration" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityConfiguration_pkey" PRIMARY KEY ("id")
);

-- Add security fields to existing User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaSecret" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- Create indexes for performance
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");
CREATE INDEX "UserSession_ip_idx" ON "UserSession"("ip");

CREATE INDEX "SecurityAuditLog_userId_idx" ON "SecurityAuditLog"("userId");
CREATE INDEX "SecurityAuditLog_action_idx" ON "SecurityAuditLog"("action");
CREATE INDEX "SecurityAuditLog_timestamp_idx" ON "SecurityAuditLog"("timestamp");
CREATE INDEX "SecurityAuditLog_success_idx" ON "SecurityAuditLog"("success");
CREATE INDEX "SecurityAuditLog_ip_idx" ON "SecurityAuditLog"("ip");

CREATE INDEX "VulnerabilityReport_scanType_idx" ON "VulnerabilityReport"("scanType");
CREATE INDEX "VulnerabilityReport_severity_idx" ON "VulnerabilityReport"("severity");
CREATE INDEX "VulnerabilityReport_timestamp_idx" ON "VulnerabilityReport"("timestamp");

CREATE UNIQUE INDEX "RateLimitEntry_key_key" ON "RateLimitEntry"("key");
CREATE INDEX "RateLimitEntry_resetTime_idx" ON "RateLimitEntry"("resetTime");

CREATE UNIQUE INDEX "SecurityConfiguration_key_key" ON "SecurityConfiguration"("key");
CREATE INDEX "SecurityConfiguration_updatedAt_idx" ON "SecurityConfiguration"("updatedAt");

CREATE INDEX "User_isActive_idx" ON "User"("isActive");
CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");
CREATE INDEX "User_mfaEnabled_idx" ON "User"("mfaEnabled");
CREATE INDEX "User_failedLoginAttempts_idx" ON "User"("failedLoginAttempts");
CREATE INDEX "User_lockedUntil_idx" ON "User"("lockedUntil");

-- Add foreign key constraints
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityAuditLog" ADD CONSTRAINT "SecurityAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
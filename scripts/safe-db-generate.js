#!/usr/bin/env node

/**
 * Safe database generation script for CI/CD environments
 * Only runs prisma generate if DATABASE_URL is set or if we're in development
 */

const { execSync } = require('child_process');

const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.CI;
const hasDatabase = !!process.env.DATABASE_URL;

if (hasDatabase || isDevelopment) {
  try {
    console.log('📦 Generating Prisma Client...');
    execSync('pnpm turbo run db:generate', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Prisma Client generated successfully');
  } catch (error) {
    if (isDevelopment) {
      console.warn('⚠️  Failed to generate Prisma Client. This is okay if you haven\'t set up a database yet.');
      console.warn('   Run "pnpm db:generate" manually when your database is ready.');
    } else {
      console.error('❌ Failed to generate Prisma Client in CI environment');
      process.exit(1);
    }
  }
} else {
  console.log('⏭️  Skipping Prisma Client generation (no DATABASE_URL in CI)');
}

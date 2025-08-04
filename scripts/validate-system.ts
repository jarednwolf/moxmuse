#!/usr/bin/env tsx
/**
 * MoxMuse System Validation Script
 * Run this to validate all systems are working correctly
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@moxmuse/api';
import chalk from 'chalk';
import { z } from 'zod';

const prisma = new PrismaClient();

// Create tRPC client
const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      headers: {
        // Add auth headers if needed
      },
    }),
  ],
});

// Validation results tracking
interface ValidationResult {
  category: string;
  test: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
}

const results: ValidationResult[] = [];

// Helper to record results
function recordResult(category: string, test: string, status: ValidationResult['status'], message?: string, duration?: number) {
  results.push({ category, test, status, message, duration });
  
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  const color = status === 'pass' ? chalk.green : status === 'fail' ? chalk.red : chalk.yellow;
  
  console.log(`${icon} ${color(`[${category}] ${test}`)} ${message || ''} ${duration ? `(${duration}ms)` : ''}`);
}

// Test database connectivity
async function validateDatabase() {
  console.log(chalk.blue('\n🔍 Validating Database...\n'));
  
  try {
    // Test connection
    const start = Date.now();
    await prisma.$connect();
    const duration = Date.now() - start;
    recordResult('Database', 'Connection', 'pass', 'Connected successfully', duration);
    
    // Check critical tables exist (Prisma maps PascalCase to snake_case)
    const tables = [
      'User',
      'GeneratedDeck', 
      'GeneratedDeckCard',
      'DeckAnalysis',
      'ConsultationSession',
      'EnhancedDeck'
    ];
    
    for (const table of tables) {
      try {
        // Use Prisma client methods instead of raw SQL
        let count;
        switch (table) {
          case 'User':
            count = await prisma.user.count();
            break;
          case 'GeneratedDeck':
            count = await prisma.generatedDeck.count();
            break;
          case 'GeneratedDeckCard':
            count = await prisma.generatedDeckCard.count();
            break;
          case 'DeckAnalysis':
            count = await prisma.deckAnalysis.count();
            break;
          case 'ConsultationSession':
            count = await prisma.consultationSession.count();
            break;
          case 'EnhancedDeck':
            count = await prisma.enhancedDeck.count();
            break;
          default:
            throw new Error(`Unknown table: ${table}`);
        }
        recordResult('Database', `Table: ${table}`, 'pass', `${count} records`);
      } catch (error) {
        recordResult('Database', `Table: ${table}`, 'fail', error.message);
      }
    }
    
    // Test indexes on JSON fields using Prisma client
    try {
      const start = Date.now();
      const result = await prisma.generatedDeck.count({
        where: {
          consultationData: {
            path: ['strategy'],
            string_contains: 'tokens'
          }
        }
      });
      const duration = Date.now() - start;
      
      if (duration < 100) {
        recordResult('Database', 'JSON Query Performance', 'pass', `Query completed in ${duration}ms`);
      } else {
        recordResult('Database', 'JSON Query Performance', 'warn', `Query took ${duration}ms (consider adding GIN index)`);
      }
    } catch (error) {
      recordResult('Database', 'JSON Query Performance', 'fail', error.message);
    }
    
  } catch (error) {
    recordResult('Database', 'Connection', 'fail', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Test AI services
async function validateAIServices() {
  console.log(chalk.blue('\n🤖 Validating AI Services...\n'));
  
  // Check environment variables
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      recordResult('Environment', envVar, 'pass', 'Set');
    } else {
      recordResult('Environment', envVar, 'fail', 'Not set');
    }
  }
  
  // Test AI service orchestrator (mock test since we need API key)
  try {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
      recordResult('AI Services', 'OpenAI API Key', 'pass', 'Valid format');
    } else {
      recordResult('AI Services', 'OpenAI API Key', 'warn', 'Mock key detected');
    }
  } catch (error) {
    recordResult('AI Services', 'OpenAI API Key', 'fail', error.message);
  }
}

// Test API endpoints
async function validateAPI() {
  console.log(chalk.blue('\n🌐 Validating API Endpoints...\n'));
  
  // Test health check (Next.js API routes)
  try {
    const start = Date.now();
    const response = await fetch('http://localhost:3000/api/health');
    const duration = Date.now() - start;
    
    if (response.ok) {
      recordResult('API', 'Health Check', 'pass', `Response time: ${duration}ms`);
    } else {
      recordResult('API', 'Health Check', 'fail', `Status: ${response.status}`);
    }
  } catch (error) {
    recordResult('API', 'Health Check', 'fail', 'Server not running');
  }
  
  // Test tRPC endpoint
  try {
    // This would need auth in real scenario
    recordResult('API', 'tRPC Connection', 'warn', 'Skipped (requires auth)');
  } catch (error) {
    recordResult('API', 'tRPC Connection', 'fail', error.message);
  }
}

// Test Redis connection
async function validateRedis() {
  console.log(chalk.blue('\n📦 Validating Redis...\n'));
  
  if (process.env.REDIS_URL) {
    recordResult('Redis', 'Configuration', 'pass', 'REDIS_URL set');
    
    // Would need to import Redis client to test connection
    recordResult('Redis', 'Connection', 'warn', 'Skipped (import Redis client to test)');
  } else {
    recordResult('Redis', 'Configuration', 'warn', 'REDIS_URL not set (optional)');
  }
}

// Test critical user flows
async function validateUserFlows() {
  console.log(chalk.blue('\n👤 Validating User Flows...\n'));
  
  // Check demo user exists
  try {
    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@moxmuse.com' }
    });
    
    if (demoUser) {
      recordResult('User Flows', 'Demo User', 'pass', 'Exists in database');
    } else {
      recordResult('User Flows', 'Demo User', 'fail', 'Not found - run seed script');
    }
  } catch (error) {
    recordResult('User Flows', 'Demo User Check', 'fail', error.message);
  }
  
  // Check if any decks have been generated
  try {
    const deckCount = await prisma.generatedDeck.count();
    if (deckCount > 0) {
      recordResult('User Flows', 'Generated Decks', 'pass', `${deckCount} decks found`);
    } else {
      recordResult('User Flows', 'Generated Decks', 'warn', 'No decks generated yet');
    }
  } catch (error) {
    recordResult('User Flows', 'Deck Count', 'fail', error.message);
  }
}

// Generate summary report
function generateReport() {
  console.log(chalk.blue('\n📊 Validation Summary\n'));
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;
  
  console.log(chalk.green(`✅ Passed: ${passed}`));
  console.log(chalk.yellow(`⚠️  Warnings: ${warned}`));
  console.log(chalk.red(`❌ Failed: ${failed}`));
  
  // Critical issues
  const criticalIssues = results.filter(r => r.status === 'fail' && 
    ['Database Connection', 'Environment'].includes(r.category));
  
  if (criticalIssues.length > 0) {
    console.log(chalk.red('\n🚨 Critical Issues Found:\n'));
    criticalIssues.forEach(issue => {
      console.log(chalk.red(`- [${issue.category}] ${issue.test}: ${issue.message}`));
    });
  }
  
  // Recommendations
  console.log(chalk.blue('\n💡 Recommendations:\n'));
  
  if (!process.env.OPENAI_API_KEY?.startsWith('sk-')) {
    console.log('- Set up a real OpenAI API key for AI features');
  }
  
  if (!process.env.REDIS_URL) {
    console.log('- Consider setting up Redis for caching');
  }
  
  const missingTables = results.filter(r => 
    r.category === 'Database' && 
    r.test.startsWith('Table:') && 
    r.status === 'fail'
  );
  
  if (missingTables.length > 0) {
    console.log('- Run database migrations: pnpm db:push');
  }
  
  const noDemoUser = results.find(r => 
    r.test === 'Demo User' && r.status === 'fail'
  );
  
  if (noDemoUser) {
    console.log('- Seed demo user: cd packages/db && pnpm tsx scripts/seed-demo-user.ts');
  }
  
  // Save detailed report
  const reportContent = `# MoxMuse System Validation Report

Generated: ${new Date().toISOString()}

## Summary
- ✅ Passed: ${passed}
- ⚠️  Warnings: ${warned}
- ❌ Failed: ${failed}

## Detailed Results

${results.map(r => `### ${r.category} - ${r.test}
- Status: ${r.status}
- Message: ${r.message || 'N/A'}
- Duration: ${r.duration ? `${r.duration}ms` : 'N/A'}
`).join('\n')}

## Next Steps

${criticalIssues.length > 0 ? '1. Fix critical issues listed above\n' : ''}
${missingTables.length > 0 ? '2. Run database migrations\n' : ''}
${noDemoUser ? '3. Seed demo user data\n' : ''}
4. Run integration tests: pnpm test:integration
5. Manual testing following SYSTEM_VALIDATION_CHECKLIST.md
`;
  
  require('fs').writeFileSync('validation-report.md', reportContent);
  console.log(chalk.green('\n✅ Detailed report saved to validation-report.md'));
}

// Main validation runner
async function runValidation() {
  console.log(chalk.bold.blue('🚀 MoxMuse System Validation\n'));
  
  try {
    await validateDatabase();
    await validateAIServices();
    await validateAPI();
    await validateRedis();
    await validateUserFlows();
    
    generateReport();
    
  } catch (error) {
    console.error(chalk.red('\n❌ Validation failed with error:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runValidation()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { runValidation };

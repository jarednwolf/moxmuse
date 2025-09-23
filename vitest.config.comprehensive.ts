import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'comprehensive-test-suite',
    root: '.',
    environment: 'node',
    setupFiles: ['./test-setup/comprehensive-setup.ts'],
    testTimeout: 300000, // 5 minutes for complex tests
    hookTimeout: 60000, // 1 minute for setup/teardown
    teardownTimeout: 60000,
    maxConcurrency: 4, // Limit concurrent tests to prevent resource exhaustion
    
    // Test file patterns
    include: [
      'packages/api/src/services/__tests__/comprehensive-unit-tests.test.ts',
      'packages/api/src/services/__tests__/ai-generation-integration.test.ts',
      'packages/api/src/services/__tests__/performance-load-tests.test.ts'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/comprehensive',
      include: [
        'packages/api/src/services/**/*.ts',
        'packages/shared/src/**/*.ts'
      ],
      exclude: [
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/dist/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // Critical services should have higher coverage
        'packages/api/src/services/ai/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'packages/api/src/services/security/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    },
    
    // Reporters
    reporters: [
      'default',
      'json',
      'junit',
      'html'
    ],
    
    // Output configuration
    outputFile: {
      json: './test-results/comprehensive-results.json',
      junit: './test-results/comprehensive-junit.xml',
      html: './test-results/comprehensive-report.html'
    }
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './packages/api/src'),
      '@/lib': path.resolve(__dirname, './packages/shared/src'),
      '@/db': path.resolve(__dirname, './packages/db/src')
    }
  },
  
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.DATABASE_URL': '"postgresql://test:test@localhost:5432/test_db"',
    'process.env.REDIS_URL': '"redis://localhost:6379/1"'
  }
})
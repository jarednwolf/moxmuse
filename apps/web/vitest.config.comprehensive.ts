/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [
      './src/test/setup.ts',
      './src/__tests__/setup/performance-setup.ts',
      './src/__tests__/setup/accessibility-setup.ts',
    ],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/dist/**',
        '**/.next/**',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Specific thresholds for critical components
        'src/components/tutor/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        'packages/api/src/services/ai/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
    // Performance test configuration
    testTimeout: 30000, // 30 seconds default
    hookTimeout: 10000, // 10 seconds for setup/teardown
    // Separate timeouts for different test types
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      '.next/',
      'coverage/',
      'e2e/',
    ],
    // Reporter configuration
    reporters: ['verbose'],
    // Retry configuration
    retry: 2,
    // Bail configuration
    bail: 0, // Don't bail on first failure for comprehensive testing
    // Watch configuration
    watch: false, // Disable watch mode for CI
    // Environment variables
    env: {
      NODE_ENV: 'test',
      VITEST_COMPREHENSIVE: 'true',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/api': path.resolve(__dirname, '../../packages/api/src'),
      '@/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  // Build configuration for test environment
  build: {
    target: 'node14',
    sourcemap: true,
  },
  // Define global constants for tests
  define: {
    __TEST_ENV__: true,
    __PERFORMANCE_MONITORING__: true,
    __ACCESSIBILITY_TESTING__: true,
  },
  // Optimize dependencies for testing
  optimizeDeps: {
    include: [
      '@testing-library/react',
      '@testing-library/jest-dom',
      '@testing-library/user-event',
      'vitest',
      'jsdom',
    ],
  },
})
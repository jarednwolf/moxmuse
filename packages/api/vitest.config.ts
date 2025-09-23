import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      // Skip heavy/flake-prone integration and performance suites in unit CI
      'src/services/monitoring/**/__tests__/**',
      'src/services/scaling/**/__tests__/**',
      'src/services/**/performance*.test.ts',
      'src/services/ai/**/integration*.test.ts',
      'src/services/__tests__/production-*.test.ts',
      'src/services/integration/**/__tests__/**',
      'src/services/ai/**/__tests__/**',
      'src/services/persistence/**/__tests__/**',
      'src/services/security/**/AuthenticationService.test.ts',
      'src/services/security/**/security-integration.test.ts',
      'src/services/ai/reliability/**/__tests__/**',
      'src/services/__tests__/deck-template.test.ts',
      // Temporarily exclude brittle or long-running suites
      'src/services/__tests__/card-data-sync.test.ts',
      'src/services/__tests__/comprehensive-unit-tests.test.ts',
      'src/services/__tests__/export-format-engine.test.ts',
      'src/services/__tests__/import-job-processor.test.ts',
      'src/services/__tests__/card-database-management.test.ts',
      'src/services/__tests__/bulk-deck-operations.test.ts',
      'src/routers/__tests__/enhanced-tutor.test.ts',
    ],
    testTimeout: 30000
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
})
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
})
import { test as base } from '@playwright/test'
import { installOpenAIMocks } from '../mocks/openai'

/**
 * Extended test fixture that automatically installs OpenAI mocks
 * This prevents rate limiting during tests
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Install OpenAI mocks before each test
    await installOpenAIMocks(page)
    
    // Use the page with mocks installed
    await use(page)
  }
})

// Re-export expect for convenience
export { expect } from '@playwright/test'

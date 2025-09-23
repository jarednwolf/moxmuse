import { test, expect, Page } from '@playwright/test'

test.describe('Comprehensive User Journey Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })
  
  test.describe('Complete Deck Building Journey', () => {
    test('should complete full deck building flow with known commander', async ({ page }) => {
      // Step 1: Navigate to tutor
      await page.click('[data-testid="start-deck-building"]')
      await expect(page).toHaveURL('/tutor')
      
      // Step 2: Start consultation wizard
      await page.click('[data-testid="start-consultation"]')
      await page.waitForSelector('[data-testid="consultation-wizard"]')
      
      // Step 3: Complete consultation steps
      await completeConsultationWizard(page, {
        buildingFullDeck: true,
        hasCommander: true,
        commander: 'Atraxa, Praetors\' Voice',
        strategy: 'counters',
        budget: 500,
        powerLevel: 3
      })
      
      // Step 4: Generate deck
      await page.click('[data-testid="generate-deck"]')
      
      // Wait for generation to complete (with timeout)
      await page.waitForSelector('[data-testid="deck-generated"]', { timeout: 180000 })
      
      // Step 5: Verify generated deck
      await verifyGeneratedDeck(page, {
        expectedCardCount: 100,
        expectedCommander: 'Atraxa, Praetors\' Voice',
        maxBudget: 550 // 10% tolerance
      })
      
      // Step 6: Test deck analysis features
      await page.click('[data-testid="view-statistics"]')
      await expect(page.locator('[data-testid="mana-curve-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="card-type-distribution"]')).toBeVisible()
      
      // Step 7: Test deck editing
      await page.click('[data-testid="edit-deck"]')
      await page.waitForSelector('[data-testid="deck-editor"]')
      
      // Add a card
      await page.fill('[data-testid="card-search"]', 'Sol Ring')
      await page.click('[data-testid="search-result-0"]')
      await page.click('[data-testid="add-card"]')
      
      // Remove a card
      await page.click('[data-testid="card-list-item-0"] [data-testid="remove-card"]')
      
      // Verify deck still has 100 cards
      const cardCount = await page.locator('[data-testid="card-count"]').textContent()
      expect(cardCount).toBe('100')
      
      // Step 8: Save deck
      await page.fill('[data-testid="deck-name"]', 'My Atraxa Deck')
      await page.click('[data-testid="save-deck"]')
      await expect(page.locator('[data-testid="save-success"]')).toBeVisible()
      
      // Step 9: Export deck
      await page.click('[data-testid="export-deck"]')
      await page.click('[data-testid="export-moxfield"]')
      
      // Verify export was successful
      await expect(page.locator('[data-testid="export-success"]')).toBeVisible()
    })
    
    test('should complete commander suggestion flow', async ({ page }) => {
      // Navigate to tutor
      await page.click('[data-testid="start-deck-building"]')
      await expect(page).toHaveURL('/tutor')
      
      // Start consultation without commander
      await page.click('[data-testid="start-consultation"]')
      
      await completeConsultationWizard(page, {
        buildingFullDeck: true,
        hasCommander: false,
        strategy: 'artifacts',
        themes: ['vehicles', 'equipment'],
        colors: ['U', 'R'],
        budget: 300,
        powerLevel: 2
      })
      
      // Should show commander suggestions
      await page.waitForSelector('[data-testid="commander-suggestions"]')
      
      const suggestions = await page.locator('[data-testid="commander-suggestion"]').count()
      expect(suggestions).toBeGreaterThan(0)
      expect(suggestions).toBeLessThanOrEqual(5)
      
      // Select first commander
      await page.click('[data-testid="commander-suggestion-0"]')
      await page.click('[data-testid="select-commander"]')
      
      // Continue with deck generation
      await page.click('[data-testid="generate-deck"]')
      await page.waitForSelector('[data-testid="deck-generated"]', { timeout: 180000 })
      
      // Verify deck was generated with selected commander
      const commanderName = await page.locator('[data-testid="deck-commander"]').textContent()
      expect(commanderName).toBeTruthy()
      
      await verifyGeneratedDeck(page, {
        expectedCardCount: 100,
        maxBudget: 330
      })
    })
    
    test('should handle consultation session persistence', async ({ page }) => {
      // Start consultation
      await page.click('[data-testid="start-deck-building"]')
      await page.click('[data-testid="start-consultation"]')
      
      // Complete first few steps
      await page.click('[data-testid="building-full-deck"]')
      await page.click('[data-testid="next-step"]')
      
      await page.click('[data-testid="has-commander"]')
      await page.fill('[data-testid="commander-input"]', 'Ghave, Guru of Spores')
      await page.click('[data-testid="next-step"]')
      
      // Refresh page to simulate interruption
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Should resume from where we left off
      await page.click('[data-testid="resume-consultation"]')
      await expect(page.locator('[data-testid="consultation-step-3"]')).toBeVisible()
      
      // Verify previous answers are preserved
      const commanderValue = await page.locator('[data-testid="commander-input"]').inputValue()
      expect(commanderValue).toBe('Ghave, Guru of Spores')
    })
  })
  
  test.describe('Mobile User Experience', () => {
    test('should work seamlessly on mobile devices', async ({ page, isMobile }) => {
      if (!isMobile) {
        // Simulate mobile viewport
        await page.setViewportSize({ width: 375, height: 667 })
      }
      
      // Navigate to mobile-optimized tutor
      await page.goto('/tutor/mobile')
      await page.waitForLoadState('networkidle')
      
      // Test mobile consultation wizard
      await page.click('[data-testid="mobile-start-consultation"]')
      await page.waitForSelector('[data-testid="mobile-consultation-wizard"]')
      
      // Test swipe navigation
      await page.touchscreen.tap(200, 400)
      await page.touchscreen.tap(300, 400) // Swipe right
      
      // Complete mobile consultation
      await completeMobileConsultation(page, {
        commander: 'Krenko, Mob Boss',
        strategy: 'aggro',
        budget: 200
      })
      
      // Generate deck on mobile
      await page.click('[data-testid="mobile-generate-deck"]')
      await page.waitForSelector('[data-testid="mobile-deck-generated"]', { timeout: 180000 })
      
      // Test mobile deck viewing
      await expect(page.locator('[data-testid="mobile-card-list"]')).toBeVisible()
      await expect(page.locator('[data-testid="mobile-statistics"]')).toBeVisible()
      
      // Test mobile card management
      await page.click('[data-testid="mobile-manage-cards"]')
      await page.waitForSelector('[data-testid="mobile-card-manager"]')
      
      // Test touch interactions
      await page.touchscreen.tap(100, 300) // Tap on card
      await expect(page.locator('[data-testid="card-details-modal"]')).toBeVisible()
    })
    
    test('should handle offline functionality', async ({ page }) => {
      // Load page normally first
      await page.goto('/tutor')
      await page.waitForLoadState('networkidle')
      
      // Go offline
      await page.context().setOffline(true)
      
      // Should show offline indicator
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible()
      
      // Should still allow basic navigation
      await page.click('[data-testid="view-saved-decks"]')
      await expect(page.locator('[data-testid="saved-decks-offline"]')).toBeVisible()
      
      // Should queue actions for when online
      await page.click('[data-testid="start-consultation"]')
      await expect(page.locator('[data-testid="offline-queue-message"]')).toBeVisible()
      
      // Go back online
      await page.context().setOffline(false)
      await page.waitForTimeout(1000)
      
      // Should process queued actions
      await expect(page.locator('[data-testid="consultation-wizard"]')).toBeVisible()
    })
  })
  
  test.describe('Error Handling and Recovery', () => {
    test('should handle generation failures gracefully', async ({ page }) => {
      // Start consultation with problematic parameters
      await page.click('[data-testid="start-deck-building"]')
      await page.click('[data-testid="start-consultation"]')
      
      await completeConsultationWizard(page, {
        buildingFullDeck: true,
        hasCommander: true,
        commander: 'Invalid Commander Name',
        strategy: 'invalid-strategy',
        budget: -100 // Invalid budget
      })
      
      // Attempt generation
      await page.click('[data-testid="generate-deck"]')
      
      // Should show error message
      await expect(page.locator('[data-testid="generation-error"]')).toBeVisible()
      
      // Should offer retry option
      await expect(page.locator('[data-testid="retry-generation"]')).toBeVisible()
      
      // Should allow going back to fix consultation
      await page.click('[data-testid="fix-consultation"]')
      await expect(page.locator('[data-testid="consultation-wizard"]')).toBeVisible()
      
      // Fix the issues
      await page.fill('[data-testid="commander-input"]', 'Atraxa, Praetors\' Voice')
      await page.selectOption('[data-testid="strategy-select"]', 'counters')
      await page.fill('[data-testid="budget-input"]', '500')
      
      // Retry generation
      await page.click('[data-testid="generate-deck"]')
      await page.waitForSelector('[data-testid="deck-generated"]', { timeout: 180000 })
      
      // Should succeed this time
      await verifyGeneratedDeck(page, {
        expectedCardCount: 100,
        expectedCommander: 'Atraxa, Praetors\' Voice'
      })
    })
    
    test('should preserve user data during errors', async ({ page }) => {
      // Start building a deck
      await page.click('[data-testid="start-deck-building"]')
      await page.click('[data-testid="start-consultation"]')
      
      // Fill out consultation partially
      await page.click('[data-testid="building-full-deck"]')
      await page.click('[data-testid="next-step"]')
      
      await page.fill('[data-testid="commander-input"]', 'Meren of Clan Nel Toth')
      await page.click('[data-testid="next-step"]')
      
      await page.selectOption('[data-testid="strategy-select"]', 'graveyard')
      
      // Simulate network error during save
      await page.route('**/api/consultation/save', route => route.abort())
      
      await page.click('[data-testid="next-step"]')
      
      // Should show error but preserve data
      await expect(page.locator('[data-testid="save-error"]')).toBeVisible()
      
      // Data should still be there
      const commanderValue = await page.locator('[data-testid="commander-input"]').inputValue()
      expect(commanderValue).toBe('Meren of Clan Nel Toth')
      
      // Remove network error simulation
      await page.unroute('**/api/consultation/save')
      
      // Retry save
      await page.click('[data-testid="retry-save"]')
      await expect(page.locator('[data-testid="save-success"]')).toBeVisible()
    })
  })
  
  test.describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent users', async ({ browser }) => {
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext()
      ])
      
      const pages = await Promise.all(contexts.map(context => context.newPage()))
      
      // Start deck generation on all pages simultaneously
      const generationPromises = pages.map(async (page, index) => {
        await page.goto('/tutor')
        await page.click('[data-testid="start-consultation"]')
        
        await completeConsultationWizard(page, {
          buildingFullDeck: true,
          hasCommander: true,
          commander: `Test Commander ${index}`,
          strategy: 'control',
          budget: 400
        })
        
        const startTime = Date.now()
        await page.click('[data-testid="generate-deck"]')
        await page.waitForSelector('[data-testid="deck-generated"]', { timeout: 300000 })
        const endTime = Date.now()
        
        return endTime - startTime
      })
      
      const durations = await Promise.all(generationPromises)
      
      // All generations should complete
      expect(durations.every(duration => duration > 0)).toBe(true)
      
      // No generation should take more than 5 minutes
      expect(durations.every(duration => duration < 300000)).toBe(true)
      
      // Clean up
      await Promise.all(contexts.map(context => context.close()))
    })
    
    test('should maintain performance under load', async ({ page }) => {
      const performanceMetrics = []
      
      // Generate multiple decks in sequence
      for (let i = 0; i < 3; i++) {
        await page.goto('/tutor')
        
        const startTime = Date.now()
        
        await page.click('[data-testid="start-consultation"]')
        await completeConsultationWizard(page, {
          buildingFullDeck: true,
          hasCommander: true,
          commander: 'Atraxa, Praetors\' Voice',
          strategy: 'counters',
          budget: 500
        })
        
        await page.click('[data-testid="generate-deck"]')
        await page.waitForSelector('[data-testid="deck-generated"]', { timeout: 180000 })
        
        const endTime = Date.now()
        performanceMetrics.push(endTime - startTime)
        
        // Verify deck quality doesn't degrade
        await verifyGeneratedDeck(page, {
          expectedCardCount: 100,
          expectedCommander: 'Atraxa, Praetors\' Voice'
        })
      }
      
      // Performance should remain consistent
      const avgTime = performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length
      const maxDeviation = Math.max(...performanceMetrics.map(time => Math.abs(time - avgTime)))
      
      // No single generation should deviate more than 50% from average
      expect(maxDeviation / avgTime).toBeLessThan(0.5)
    })
  })
})

// Helper functions
async function completeConsultationWizard(page: Page, options: {
  buildingFullDeck: boolean
  hasCommander?: boolean
  commander?: string
  strategy: string
  themes?: string[]
  colors?: string[]
  budget: number
  powerLevel?: number
}) {
  // Step 1: Building full deck
  if (options.buildingFullDeck) {
    await page.click('[data-testid="building-full-deck"]')
  } else {
    await page.click('[data-testid="improving-existing-deck"]')
  }
  await page.click('[data-testid="next-step"]')
  
  // Step 2: Commander
  if (options.hasCommander && options.commander) {
    await page.click('[data-testid="has-commander"]')
    await page.fill('[data-testid="commander-input"]', options.commander)
  } else {
    await page.click('[data-testid="needs-commander-suggestions"]')
  }
  await page.click('[data-testid="next-step"]')
  
  // Step 3: Strategy
  await page.selectOption('[data-testid="strategy-select"]', options.strategy)
  await page.click('[data-testid="next-step"]')
  
  // Step 4: Themes (if provided)
  if (options.themes) {
    for (const theme of options.themes) {
      await page.click(`[data-testid="theme-${theme}"]`)
    }
  }
  await page.click('[data-testid="next-step"]')
  
  // Step 5: Colors (if provided)
  if (options.colors) {
    for (const color of options.colors) {
      await page.click(`[data-testid="color-${color}"]`)
    }
  }
  await page.click('[data-testid="next-step"]')
  
  // Step 6: Budget
  await page.fill('[data-testid="budget-input"]', options.budget.toString())
  await page.click('[data-testid="next-step"]')
  
  // Step 7: Power level (if provided)
  if (options.powerLevel) {
    await page.click(`[data-testid="power-level-${options.powerLevel}"]`)
  }
  await page.click('[data-testid="finish-consultation"]')
}

async function completeMobileConsultation(page: Page, options: {
  commander: string
  strategy: string
  budget: number
}) {
  // Mobile consultation is simplified
  await page.fill('[data-testid="mobile-commander-input"]', options.commander)
  await page.selectOption('[data-testid="mobile-strategy-select"]', options.strategy)
  await page.fill('[data-testid="mobile-budget-input"]', options.budget.toString())
  await page.click('[data-testid="mobile-finish-consultation"]')
}

async function verifyGeneratedDeck(page: Page, options: {
  expectedCardCount: number
  expectedCommander?: string
  maxBudget?: number
}) {
  // Verify card count
  const cardCount = await page.locator('[data-testid="card-count"]').textContent()
  expect(parseInt(cardCount || '0')).toBe(options.expectedCardCount)
  
  // Verify commander if specified
  if (options.expectedCommander) {
    const commander = await page.locator('[data-testid="deck-commander"]').textContent()
    expect(commander).toBe(options.expectedCommander)
  }
  
  // Verify budget if specified
  if (options.maxBudget) {
    const budgetText = await page.locator('[data-testid="deck-budget"]').textContent()
    const budget = parseFloat(budgetText?.replace('$', '') || '0')
    expect(budget).toBeLessThanOrEqual(options.maxBudget)
  }
  
  // Verify deck has required sections
  await expect(page.locator('[data-testid="deck-statistics"]')).toBeVisible()
  await expect(page.locator('[data-testid="deck-synergies"]')).toBeVisible()
  await expect(page.locator('[data-testid="deck-strategy"]')).toBeVisible()
}
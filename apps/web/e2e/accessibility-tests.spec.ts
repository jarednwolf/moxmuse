import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })
  
  test.describe('WCAG 2.1 AA Compliance', () => {
    test('should pass accessibility audit on homepage', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      
      expect(accessibilityScanResults.violations).toEqual([])
    })
    
    test('should pass accessibility audit on tutor page', async ({ page }) => {
      await page.goto('/tutor')
      await page.waitForLoadState('networkidle')
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      
      expect(accessibilityScanResults.violations).toEqual([])
    })
    
    test('should pass accessibility audit on consultation wizard', async ({ page }) => {
      await page.goto('/tutor')
      await page.click('[data-testid="start-consultation"]')
      await page.waitForSelector('[data-testid="consultation-wizard"]')
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      
      expect(accessibilityScanResults.violations).toEqual([])
    })
    
    test('should pass accessibility audit on deck editor', async ({ page }) => {
      // Navigate to deck editor (assuming we have a test deck)
      await page.goto('/decks/test-deck-id')
      await page.waitForLoadState('networkidle')
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      
      expect(accessibilityScanResults.violations).toEqual([])
    })
  })
  
  test.describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation on homepage', async ({ page }) => {
      // Start from the first focusable element
      await page.keyboard.press('Tab')
      
      // Should be able to navigate to main CTA
      const startButton = page.locator('[data-testid="start-deck-building"]')
      await expect(startButton).toBeFocused()
      
      // Should be able to activate with Enter
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL('/tutor')
    })
    
    test('should support keyboard navigation in consultation wizard', async ({ page }) => {
      await page.goto('/tutor')
      await page.click('[data-testid="start-consultation"]')
      await page.waitForSelector('[data-testid="consultation-wizard"]')
      
      // Test tab navigation through form elements
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="building-full-deck"]')).toBeFocused()
      
      // Test radio button selection with arrow keys
      await page.keyboard.press('ArrowDown')
      await expect(page.locator('[data-testid="improving-existing-deck"]')).toBeFocused()
      
      // Test space bar selection
      await page.keyboard.press('Space')
      await expect(page.locator('[data-testid="improving-existing-deck"]')).toBeChecked()
      
      // Test navigation to next button
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="next-step"]')).toBeFocused()
      
      // Test Enter key activation
      await page.keyboard.press('Enter')
      await expect(page.locator('[data-testid="consultation-step-2"]')).toBeVisible()
    })
    
    test('should support keyboard navigation in deck editor', async ({ page }) => {
      // Assuming we have a test deck available
      await page.goto('/decks/test-deck-id')
      await page.waitForLoadState('networkidle')
      
      // Test card list navigation
      await page.keyboard.press('Tab')
      const firstCard = page.locator('[data-testid="card-list-item-0"]')
      await expect(firstCard).toBeFocused()
      
      // Test arrow key navigation in card list
      await page.keyboard.press('ArrowDown')
      const secondCard = page.locator('[data-testid="card-list-item-1"]')
      await expect(secondCard).toBeFocused()
      
      // Test Enter to open card details
      await page.keyboard.press('Enter')
      await expect(page.locator('[data-testid="card-details-modal"]')).toBeVisible()
      
      // Test Escape to close modal
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid="card-details-modal"]')).not.toBeVisible()
    })
    
    test('should support keyboard shortcuts', async ({ page }) => {
      await page.goto('/tutor')
      
      // Test global shortcuts
      await page.keyboard.press('Alt+h') // Help
      await expect(page.locator('[data-testid="help-modal"]')).toBeVisible()
      
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid="help-modal"]')).not.toBeVisible()
      
      // Test search shortcut
      await page.keyboard.press('Control+k')
      await expect(page.locator('[data-testid="search-modal"]')).toBeVisible()
      
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid="search-modal"]')).not.toBeVisible()
    })
  })
  
  test.describe('Screen Reader Support', () => {
    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.goto('/tutor')
      
      // Check main navigation
      const nav = page.locator('nav[role="navigation"]')
      await expect(nav).toBeVisible()
      
      // Check main content area
      const main = page.locator('main[role="main"]')
      await expect(main).toBeVisible()
      
      // Check consultation wizard has proper structure
      await page.click('[data-testid="start-consultation"]')
      await page.waitForSelector('[data-testid="consultation-wizard"]')
      
      const wizard = page.locator('[role="dialog"]')
      await expect(wizard).toBeVisible()
      await expect(wizard).toHaveAttribute('aria-labelledby')
      
      // Check form elements have labels
      const radioButtons = page.locator('input[type="radio"]')
      const radioCount = await radioButtons.count()
      
      for (let i = 0; i < radioCount; i++) {
        const radio = radioButtons.nth(i)
        const hasLabel = await radio.evaluate((el) => {
          const id = el.id
          const label = document.querySelector(`label[for="${id}"]`)
          const ariaLabel = el.getAttribute('aria-label')
          const ariaLabelledBy = el.getAttribute('aria-labelledby')
          
          return !!(label || ariaLabel || ariaLabelledBy)
        })
        
        expect(hasLabel).toBe(true)
      }
    })
    
    test('should announce dynamic content changes', async ({ page }) => {
      await page.goto('/tutor')
      await page.click('[data-testid="start-consultation"]')
      
      // Check for live regions
      const liveRegion = page.locator('[aria-live="polite"]')
      await expect(liveRegion).toBeVisible()
      
      // Test progress announcements
      await page.click('[data-testid="building-full-deck"]')
      await page.click('[data-testid="next-step"]')
      
      // Should announce step change
      const stepAnnouncement = page.locator('[data-testid="step-announcement"]')
      await expect(stepAnnouncement).toContainText('Step 2 of')
    })
    
    test('should provide descriptive error messages', async ({ page }) => {
      await page.goto('/tutor')
      await page.click('[data-testid="start-consultation"]')
      
      // Skip to a step that requires input
      await page.click('[data-testid="building-full-deck"]')
      await page.click('[data-testid="next-step"]')
      
      // Try to proceed without filling required field
      await page.click('[data-testid="next-step"]')
      
      // Should show accessible error message
      const errorMessage = page.locator('[role="alert"]')
      await expect(errorMessage).toBeVisible()
      await expect(errorMessage).toContainText('required')
      
      // Error should be associated with the field
      const errorId = await errorMessage.getAttribute('id')
      const field = page.locator(`[aria-describedby*="${errorId}"]`)
      await expect(field).toBeVisible()
    })
  })
  
  test.describe('Color and Contrast', () => {
    test('should meet color contrast requirements', async ({ page }) => {
      await page.goto('/tutor')
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .include('[data-testid="main-content"]')
        .analyze()
      
      const contrastViolations = accessibilityScanResults.violations.filter(
        violation => violation.id === 'color-contrast'
      )
      
      expect(contrastViolations).toEqual([])
    })
    
    test('should work without color alone for information', async ({ page }) => {
      await page.goto('/tutor')
      await page.click('[data-testid="start-consultation"]')
      
      // Complete consultation to get to deck generation
      await completeBasicConsultation(page)
      await page.click('[data-testid="generate-deck"]')
      await page.waitForSelector('[data-testid="deck-generated"]', { timeout: 180000 })
      
      // Check mana curve chart has text labels, not just colors
      const manaCurveChart = page.locator('[data-testid="mana-curve-chart"]')
      await expect(manaCurveChart).toBeVisible()
      
      // Should have text labels for each mana cost
      for (let i = 0; i <= 7; i++) {
        const label = page.locator(`[data-testid="mana-cost-${i}-label"]`)
        await expect(label).toBeVisible()
      }
      
      // Check card type distribution has patterns/textures, not just colors
      const typeDistribution = page.locator('[data-testid="card-type-distribution"]')
      await expect(typeDistribution).toBeVisible()
      
      // Should have text labels for each card type
      const cardTypes = ['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land']
      for (const type of cardTypes) {
        const typeLabel = page.locator(`[data-testid="card-type-${type.toLowerCase()}-label"]`)
        await expect(typeLabel).toBeVisible()
      }
    })
  })
  
  test.describe('Focus Management', () => {
    test('should manage focus properly in modals', async ({ page }) => {
      await page.goto('/tutor')
      
      // Open help modal
      await page.keyboard.press('Alt+h')
      await page.waitForSelector('[data-testid="help-modal"]')
      
      // Focus should be on the modal
      const modal = page.locator('[data-testid="help-modal"]')
      await expect(modal).toBeFocused()
      
      // Tab should cycle within modal
      await page.keyboard.press('Tab')
      const firstButton = page.locator('[data-testid="help-modal"] button').first()
      await expect(firstButton).toBeFocused()
      
      // Shift+Tab should go to last focusable element
      await page.keyboard.press('Shift+Tab')
      const lastButton = page.locator('[data-testid="help-modal"] button').last()
      await expect(lastButton).toBeFocused()
      
      // Escape should close modal and return focus
      await page.keyboard.press('Escape')
      await expect(modal).not.toBeVisible()
      
      // Focus should return to trigger element
      const helpTrigger = page.locator('[data-testid="help-trigger"]')
      await expect(helpTrigger).toBeFocused()
    })
    
    test('should manage focus in consultation wizard steps', async ({ page }) => {
      await page.goto('/tutor')
      await page.click('[data-testid="start-consultation"]')
      
      // Focus should be on first input
      const firstInput = page.locator('[data-testid="building-full-deck"]')
      await expect(firstInput).toBeFocused()
      
      // Complete step and move to next
      await page.click('[data-testid="building-full-deck"]')
      await page.click('[data-testid="next-step"]')
      
      // Focus should move to first input of next step
      const secondStepInput = page.locator('[data-testid="has-commander"]')
      await expect(secondStepInput).toBeFocused()
    })
  })
  
  test.describe('Mobile Accessibility', () => {
    test('should be accessible on mobile devices', async ({ page, isMobile }) => {
      if (!isMobile) {
        await page.setViewportSize({ width: 375, height: 667 })
      }
      
      await page.goto('/tutor/mobile')
      await page.waitForLoadState('networkidle')
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      
      expect(accessibilityScanResults.violations).toEqual([])
    })
    
    test('should have proper touch targets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/tutor/mobile')
      
      // Check that interactive elements meet minimum size requirements (44x44px)
      const buttons = page.locator('button, [role="button"]')
      const buttonCount = await buttons.count()
      
      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i)
        const boundingBox = await button.boundingBox()
        
        if (boundingBox) {
          expect(boundingBox.width).toBeGreaterThanOrEqual(44)
          expect(boundingBox.height).toBeGreaterThanOrEqual(44)
        }
      }
    })
    
    test('should support mobile screen readers', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/tutor/mobile')
      
      // Check for mobile-specific accessibility features
      const skipLink = page.locator('[data-testid="skip-to-content"]')
      await expect(skipLink).toBeVisible()
      
      // Check for proper heading structure
      const h1 = page.locator('h1')
      await expect(h1).toBeVisible()
      
      const headings = page.locator('h1, h2, h3, h4, h5, h6')
      const headingCount = await headings.count()
      
      // Should have logical heading hierarchy
      expect(headingCount).toBeGreaterThan(0)
    })
  })
  
  test.describe('Form Accessibility', () => {
    test('should have accessible form validation', async ({ page }) => {
      await page.goto('/tutor')
      await page.click('[data-testid="start-consultation"]')
      
      // Navigate to a step with form inputs
      await page.click('[data-testid="building-full-deck"]')
      await page.click('[data-testid="next-step"]')
      await page.click('[data-testid="has-commander"]')
      await page.click('[data-testid="next-step"]')
      
      // Try to submit without required field
      await page.click('[data-testid="next-step"]')
      
      // Should show accessible validation
      const errorMessage = page.locator('[role="alert"]')
      await expect(errorMessage).toBeVisible()
      
      // Field should be marked as invalid
      const invalidField = page.locator('[aria-invalid="true"]')
      await expect(invalidField).toBeVisible()
      
      // Error should be associated with field
      const errorId = await errorMessage.getAttribute('id')
      const fieldDescribedBy = await invalidField.getAttribute('aria-describedby')
      expect(fieldDescribedBy).toContain(errorId)
    })
    
    test('should provide helpful form instructions', async ({ page }) => {
      await page.goto('/tutor')
      await page.click('[data-testid="start-consultation"]')
      
      // Navigate to budget input step
      await completeBasicConsultation(page)
      
      const budgetInput = page.locator('[data-testid="budget-input"]')
      await expect(budgetInput).toBeVisible()
      
      // Should have helpful description
      const description = page.locator('[data-testid="budget-description"]')
      await expect(description).toBeVisible()
      
      // Input should reference description
      const describedBy = await budgetInput.getAttribute('aria-describedby')
      const descriptionId = await description.getAttribute('id')
      expect(describedBy).toContain(descriptionId)
    })
  })
})

// Helper function for basic consultation completion
async function completeBasicConsultation(page: any) {
  await page.click('[data-testid="building-full-deck"]')
  await page.click('[data-testid="next-step"]')
  
  await page.click('[data-testid="has-commander"]')
  await page.fill('[data-testid="commander-input"]', 'Atraxa, Praetors\' Voice')
  await page.click('[data-testid="next-step"]')
  
  await page.selectOption('[data-testid="strategy-select"]', 'counters')
  await page.click('[data-testid="next-step"]')
  
  await page.fill('[data-testid="budget-input"]', '500')
  await page.click('[data-testid="next-step"]')
  
  await page.click('[data-testid="power-level-3"]')
  await page.click('[data-testid="finish-consultation"]')
}
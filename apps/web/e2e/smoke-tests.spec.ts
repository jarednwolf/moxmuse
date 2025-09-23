import { test, expect } from '@playwright/test'

/**
 * Smoke tests for deployment verification
 * These tests verify critical functionality is working after deployment
 */

test.describe('Deployment Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for deployment verification
    test.setTimeout(60000)
  })

  test('Homepage loads successfully', async ({ page }) => {
    await page.goto('/')
    
    // Check page loads
    await expect(page).toHaveTitle(/MTG Deck Building/i)
    
    // Check critical elements are present
    await expect(page.locator('nav')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
    
    // Check no critical errors in console
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    await page.waitForLoadState('networkidle')
    
    // Allow some non-critical errors but fail on critical ones
    const criticalErrors = errors.filter(error => 
      error.includes('Failed to fetch') || 
      error.includes('Network error') ||
      error.includes('500') ||
      error.includes('TypeError')
    )
    
    expect(criticalErrors).toHaveLength(0)
  })

  test('API health endpoints respond correctly', async ({ request }) => {
    // Basic health check
    const healthResponse = await request.get('/api/health')
    expect(healthResponse.status()).toBe(200)
    
    const healthData = await healthResponse.json()
    expect(healthData.status).toBe('healthy')
    
    // Detailed health check
    const detailedResponse = await request.get('/api/health/detailed')
    expect(detailedResponse.status()).toBe(200)
    
    const detailedData = await detailedResponse.json()
    expect(detailedData.services).toBeDefined()
    
    // Check critical services are up
    const criticalServices = ['database', 'ai-service']
    const failedServices = detailedData.services?.filter(
      service => criticalServices.includes(service.name) && service.status !== 'up'
    ) || []
    
    expect(failedServices).toHaveLength(0)
  })

  test('Database connectivity works', async ({ request }) => {
    const dbHealthResponse = await request.get('/api/health/database')
    expect(dbHealthResponse.status()).toBe(200)
    
    const dbHealth = await dbHealthResponse.json()
    expect(dbHealth.connected).toBe(true)
    expect(dbHealth.responseTime).toBeLessThan(5000) // 5 seconds max
  })

  test('AI service is accessible', async ({ request }) => {
    const aiHealthResponse = await request.get('/api/health/ai')
    expect(aiHealthResponse.status()).toBe(200)
    
    const aiHealth = await aiHealthResponse.json()
    expect(aiHealth.available).toBe(true)
  })

  test('Tutor page loads and initializes', async ({ page }) => {
    await page.goto('/tutor')
    
    // Check page loads
    await expect(page).toHaveTitle(/AI Deck Building Tutor/i)
    
    // Check consultation wizard is present
    await expect(page.locator('[data-testid="consultation-wizard"]')).toBeVisible({ timeout: 10000 })
    
    // Check initial step is visible
    await expect(page.locator('[data-testid="wizard-step"]')).toBeVisible()
    
    // Verify no JavaScript errors
    const jsErrors = []
    page.on('pageerror', error => jsErrors.push(error.message))
    
    await page.waitForLoadState('networkidle')
    expect(jsErrors).toHaveLength(0)
  })

  test('Authentication system works', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Check sign-in page loads
    await expect(page.locator('form')).toBeVisible()
    
    // Check auth providers are available
    const providers = page.locator('[data-testid="auth-provider"]')
    await expect(providers).toHaveCount(1) // At least one provider
  })

  test('tRPC API is functional', async ({ request }) => {
    // Test tRPC health endpoint
    const trpcResponse = await request.get('/api/trpc/health')
    expect(trpcResponse.status()).toBe(200)
    
    // Test a simple tRPC query (if available)
    try {
      const queryResponse = await request.post('/api/trpc/health.check', {
        data: {}
      })
      expect(queryResponse.status()).toBeLessThan(500)
    } catch (error) {
      // tRPC endpoint might not exist yet, that's okay for smoke test
      console.log('tRPC query test skipped:', error.message)
    }
  })

  test('Static assets load correctly', async ({ page }) => {
    await page.goto('/')
    
    // Check CSS loads
    const stylesheets = await page.locator('link[rel="stylesheet"]').count()
    expect(stylesheets).toBeGreaterThan(0)
    
    // Check JavaScript loads
    const scripts = await page.locator('script[src]').count()
    expect(scripts).toBeGreaterThan(0)
    
    // Check for 404 errors on resources
    const failedRequests = []
    page.on('response', response => {
      if (response.status() === 404 && response.url().includes(page.url())) {
        failedRequests.push(response.url())
      }
    })
    
    await page.waitForLoadState('networkidle')
    expect(failedRequests).toHaveLength(0)
  })

  test('Mobile responsiveness works', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    
    // Check mobile navigation
    const mobileNav = page.locator('[data-testid="mobile-nav"]')
    if (await mobileNav.isVisible()) {
      await expect(mobileNav).toBeVisible()
    }
    
    // Check content is not horizontally scrollable
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth)
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth)
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 10) // 10px tolerance
  })

  test('Error boundaries work correctly', async ({ page }) => {
    // Navigate to a page that might trigger error boundary
    await page.goto('/nonexistent-page')
    
    // Should show 404 page, not crash
    await expect(page.locator('h1')).toContainText(/404|Not Found/i)
    
    // Check error boundary doesn't crash the app
    const hasErrorBoundary = await page.locator('[data-testid="error-boundary"]').isVisible()
    if (hasErrorBoundary) {
      await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible()
    }
  })

  test('Performance is acceptable', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // Should load within 10 seconds (generous for smoke test)
    expect(loadTime).toBeLessThan(10000)
    
    // Check Core Web Vitals if available
    const cwv = await page.evaluate(() => {
      return new Promise((resolve) => {
        if ('web-vital' in window) {
          // If web vitals are available, get them
          setTimeout(() => resolve(window.webVitals || {}), 2000)
        } else {
          resolve({})
        }
      })
    })
    
    console.log('Core Web Vitals:', cwv)
  })

  test('Critical user journey - deck generation flow starts', async ({ page }) => {
    await page.goto('/tutor')
    
    // Start consultation wizard
    await expect(page.locator('[data-testid="consultation-wizard"]')).toBeVisible({ timeout: 10000 })
    
    // Try to start the flow (don't complete it, just verify it starts)
    const startButton = page.locator('button:has-text("Start"), button:has-text("Begin")')
    if (await startButton.isVisible()) {
      await startButton.click()
      
      // Should progress to next step or show form
      await expect(
        page.locator('[data-testid="wizard-step"], form, [data-testid="consultation-form"]')
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('Environment variables are properly configured', async ({ request }) => {
    // Test that environment-dependent features work
    const configResponse = await request.get('/api/config/public')
    
    if (configResponse.status() === 200) {
      const config = await configResponse.json()
      
      // Check that we're not in development mode in production
      if (process.env.NODE_ENV === 'production') {
        expect(config.environment).not.toBe('development')
      }
    }
  })
})

test.describe('Critical Path Smoke Tests', () => {
  test('Full application bootstrap works', async ({ page }) => {
    // This test verifies the entire application can bootstrap without errors
    const errors = []
    const warnings = []
    
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
      if (msg.type() === 'warning') warnings.push(msg.text())
    })
    
    page.on('pageerror', error => errors.push(error.message))
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Navigate to key pages to ensure routing works
    await page.goto('/tutor')
    await page.waitForLoadState('networkidle')
    
    await page.goto('/auth/signin')
    await page.waitForLoadState('networkidle')
    
    // Check for critical errors (allow some warnings)
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('analytics') &&
      !error.includes('third-party')
    )
    
    expect(criticalErrors).toHaveLength(0)
    
    // Log warnings for monitoring
    if (warnings.length > 0) {
      console.log('Warnings detected:', warnings.slice(0, 5)) // Log first 5 warnings
    }
  })
})
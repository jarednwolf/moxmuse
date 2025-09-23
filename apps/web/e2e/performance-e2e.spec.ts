import { test, expect } from '@playwright/test'

test.describe('Performance E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })
  
  test.describe('Page Load Performance', () => {
    test('should load homepage within performance budget', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto('/')
      await page.waitForSelector('[data-testid="homepage-loaded"]')
      
      const loadTime = Date.now() - startTime
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000)
      
      // Check Core Web Vitals
      const webVitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const vitals = {}
            
            entries.forEach((entry) => {
              if (entry.name === 'first-contentful-paint') {
                vitals.fcp = entry.startTime
              }
              if (entry.name === 'largest-contentful-paint') {
                vitals.lcp = entry.startTime
              }
            })
            
            resolve(vitals)
          }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] })
          
          // Timeout after 5 seconds
          setTimeout(() => resolve({}), 5000)
        })
      })
      
      console.log('Web Vitals:', webVitals)
      
      // FCP should be under 1.8 seconds
      if (webVitals.fcp) {
        expect(webVitals.fcp).toBeLessThan(1800)
      }
      
      // LCP should be under 2.5 seconds
      if (webVitals.lcp) {
        expect(webVitals.lcp).toBeLessThan(2500)
      }
    })
    
    test('should load tutor page within performance budget', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto('/tutor')
      await page.waitForSelector('[data-testid="tutor-loaded"]')
      
      const loadTime = Date.now() - startTime
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000)
      
      // Check JavaScript bundle size impact
      const performanceEntries = await page.evaluate(() => {
        return performance.getEntriesByType('navigation')[0]
      })
      
      console.log('Navigation timing:', {
        domContentLoaded: performanceEntries.domContentLoadedEventEnd - performanceEntries.domContentLoadedEventStart,
        loadComplete: performanceEntries.loadEventEnd - performanceEntries.loadEventStart
      })
    })
  })
  
  test.describe('Runtime Performance', () => {
    test('should maintain smooth scrolling with large card lists', async ({ page }) => {
      // Navigate to a page with large card lists
      await page.goto('/decks/test-large-deck')
      await page.waitForLoadState('networkidle')
      
      // Measure scroll performance
      const scrollMetrics = await page.evaluate(async () => {
        const cardList = document.querySelector('[data-testid="card-list"]')
        if (!cardList) return { avgFrameTime: 0, droppedFrames: 0 }
        
        let frameCount = 0
        let totalFrameTime = 0
        let droppedFrames = 0
        let lastFrameTime = performance.now()
        
        const measureFrame = () => {
          const currentTime = performance.now()
          const frameTime = currentTime - lastFrameTime
          
          frameCount++
          totalFrameTime += frameTime
          
          if (frameTime > 16.67) { // 60fps threshold
            droppedFrames++
          }
          
          lastFrameTime = currentTime
          
          if (frameCount < 60) { // Measure for 60 frames
            requestAnimationFrame(measureFrame)
          }
        }
        
        // Start scrolling and measuring
        cardList.scrollTop = 0
        requestAnimationFrame(measureFrame)
        
        // Scroll down gradually
        for (let i = 0; i < 10; i++) {
          cardList.scrollTop += 100
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        
        // Wait for measurements to complete
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        return {
          avgFrameTime: totalFrameTime / frameCount,
          droppedFrames,
          frameCount
        }
      })
      
      console.log('Scroll performance:', scrollMetrics)
      
      // Average frame time should be close to 16.67ms (60fps)
      expect(scrollMetrics.avgFrameTime).toBeLessThan(20)
      
      // Should have minimal dropped frames
      const droppedFrameRate = scrollMetrics.droppedFrames / scrollMetrics.frameCount
      expect(droppedFrameRate).toBeLessThan(0.1) // Less than 10% dropped frames
    })
    
    test('should handle deck generation without blocking UI', async ({ page }) => {
      await page.goto('/tutor')
      await page.click('[data-testid="start-consultation"]')
      
      // Complete consultation quickly
      await completeBasicConsultation(page)
      
      // Start deck generation
      await page.click('[data-testid="generate-deck"]')
      
      // UI should remain responsive during generation
      const responsivenessDuringGeneration = await page.evaluate(async () => {
        let responsiveClicks = 0
        let totalClicks = 0
        
        const testButton = document.querySelector('[data-testid="cancel-generation"]')
        if (!testButton) return { responsiveness: 1 }
        
        // Test UI responsiveness during generation
        for (let i = 0; i < 10; i++) {
          totalClicks++
          const clickStart = performance.now()
          
          testButton.click()
          
          // Wait for click to be processed
          await new Promise(resolve => setTimeout(resolve, 100))
          
          const clickEnd = performance.now()
          const clickTime = clickEnd - clickStart
          
          if (clickTime < 100) { // Click processed within 100ms
            responsiveClicks++
          }
          
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        
        return {
          responsiveness: responsiveClicks / totalClicks,
          totalClicks,
          responsiveClicks
        }
      })
      
      console.log('UI responsiveness during generation:', responsivenessDuringGeneration)
      
      // UI should remain at least 80% responsive
      expect(responsivenessDuringGeneration.responsiveness).toBeGreaterThan(0.8)
    })
  })
  
  test.describe('Memory Usage', () => {
    test('should not have significant memory leaks', async ({ page }) => {
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize
          }
        }
        return null
      })
      
      if (!initialMemory) {
        test.skip('Memory API not available')
        return
      }
      
      // Perform memory-intensive operations
      for (let i = 0; i < 5; i++) {
        await page.goto('/tutor')
        await page.click('[data-testid="start-consultation"]')
        await completeBasicConsultation(page)
        await page.click('[data-testid="generate-deck"]')
        
        // Wait for generation to start
        await page.waitForSelector('[data-testid="generation-progress"]', { timeout: 10000 })
        
        // Cancel and restart
        await page.click('[data-testid="cancel-generation"]')
        await page.goto('/')
        
        // Force garbage collection if available
        await page.evaluate(() => {
          if (window.gc) {
            window.gc()
          }
        })
        
        await page.waitForTimeout(1000)
      }
      
      // Get final memory usage
      const finalMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize
          }
        }
        return null
      })
      
      if (finalMemory) {
        const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize
        const memoryIncreasePercentage = (memoryIncrease / initialMemory.usedJSHeapSize) * 100
        
        console.log('Memory usage:', {
          initial: `${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          final: `${(finalMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          increase: `${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercentage.toFixed(1)}%)`
        })
        
        // Memory increase should be reasonable (less than 50%)
        expect(memoryIncreasePercentage).toBeLessThan(50)
      }
    })
  })
  
  test.describe('Network Performance', () => {
    test('should optimize API calls and reduce redundant requests', async ({ page }) => {
      const networkRequests = []
      
      // Monitor network requests
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          networkRequests.push({
            url: request.url(),
            method: request.method(),
            timestamp: Date.now()
          })
        }
      })
      
      // Navigate and perform actions
      await page.goto('/tutor')
      await page.click('[data-testid="start-consultation"]')
      await completeBasicConsultation(page)
      
      // Analyze network requests
      const apiCalls = networkRequests.filter(req => req.url.includes('/api/'))
      const uniqueEndpoints = new Set(apiCalls.map(req => req.url.split('?')[0]))
      
      console.log('Network requests:', {
        totalApiCalls: apiCalls.length,
        uniqueEndpoints: uniqueEndpoints.size,
        endpoints: Array.from(uniqueEndpoints)
      })
      
      // Should not make excessive API calls
      expect(apiCalls.length).toBeLessThan(20)
      
      // Check for duplicate requests within short time windows
      const duplicateRequests = []
      for (let i = 0; i < apiCalls.length - 1; i++) {
        for (let j = i + 1; j < apiCalls.length; j++) {
          if (apiCalls[i].url === apiCalls[j].url && 
              Math.abs(apiCalls[i].timestamp - apiCalls[j].timestamp) < 1000) {
            duplicateRequests.push({
              url: apiCalls[i].url,
              timeDiff: Math.abs(apiCalls[i].timestamp - apiCalls[j].timestamp)
            })
          }
        }
      }
      
      console.log('Duplicate requests:', duplicateRequests)
      
      // Should minimize duplicate requests
      expect(duplicateRequests.length).toBeLessThan(3)
    })
    
    test('should handle slow network conditions gracefully', async ({ page }) => {
      // Simulate slow 3G network
      await page.route('**/*', async route => {
        await new Promise(resolve => setTimeout(resolve, 100)) // Add 100ms delay
        await route.continue()
      })
      
      const startTime = Date.now()
      
      await page.goto('/tutor')
      await page.waitForSelector('[data-testid="tutor-loaded"]')
      
      const loadTime = Date.now() - startTime
      
      // Should still load within reasonable time on slow network
      expect(loadTime).toBeLessThan(10000) // 10 seconds
      
      // Should show loading states
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible()
      
      // Should handle timeouts gracefully
      await page.click('[data-testid="start-consultation"]')
      
      // Should not crash or show error states immediately
      await expect(page.locator('[data-testid="consultation-wizard"]')).toBeVisible({ timeout: 15000 })
    })
  })
  
  test.describe('Bundle Size and Asset Optimization', () => {
    test('should load optimized assets', async ({ page }) => {
      const resourceSizes = []
      
      page.on('response', response => {
        const contentLength = response.headers()['content-length']
        if (contentLength) {
          resourceSizes.push({
            url: response.url(),
            size: parseInt(contentLength),
            type: response.headers()['content-type']
          })
        }
      })
      
      await page.goto('/tutor')
      await page.waitForLoadState('networkidle')
      
      // Analyze resource sizes
      const jsResources = resourceSizes.filter(r => r.type?.includes('javascript'))
      const cssResources = resourceSizes.filter(r => r.type?.includes('css'))
      const imageResources = resourceSizes.filter(r => r.type?.includes('image'))
      
      const totalJsSize = jsResources.reduce((sum, r) => sum + r.size, 0)
      const totalCssSize = cssResources.reduce((sum, r) => sum + r.size, 0)
      const totalImageSize = imageResources.reduce((sum, r) => sum + r.size, 0)
      
      console.log('Resource sizes:', {
        javascript: `${(totalJsSize / 1024).toFixed(2)} KB`,
        css: `${(totalCssSize / 1024).toFixed(2)} KB`,
        images: `${(totalImageSize / 1024).toFixed(2)} KB`,
        total: `${((totalJsSize + totalCssSize + totalImageSize) / 1024).toFixed(2)} KB`
      })
      
      // JavaScript bundle should be reasonable size
      expect(totalJsSize).toBeLessThan(1024 * 1024) // 1MB
      
      // CSS should be optimized
      expect(totalCssSize).toBeLessThan(200 * 1024) // 200KB
      
      // Images should be optimized
      const largeImages = imageResources.filter(r => r.size > 100 * 1024) // 100KB
      expect(largeImages.length).toBeLessThan(5)
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
import { chromium, FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup')

  // Launch browser for setup
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Wait for the development server to be ready
    console.log('⏳ Waiting for development server...')
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
    console.log('✅ Development server is ready')

    // Perform authentication
    await setupAuthentication(page, context)

  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }

  console.log('✅ Global E2E test setup completed')
}

async function setupAuthentication(page: any, context: any) {
  console.log('🔐 Setting up authentication...')
  
  try {
    // Navigate to sign in page
    await page.goto('http://localhost:3000/auth/signin', { waitUntil: 'networkidle' })
    console.log('📍 Navigated to signin page')
    
    // Wait for the form to be ready
    await page.waitForSelector('#email', { timeout: 10000 })
    
    // Fill in demo user credentials
    await page.fill('#email', 'demo@moxmuse.com')
    await page.fill('#password', 'demo123')
    console.log('📝 Filled in credentials')
    
    // Click sign in button and wait for navigation
    await Promise.all([
      page.waitForNavigation({ url: 'http://localhost:3000/', timeout: 30000 }),
      page.click('button[type="submit"]')
    ])
    console.log('✅ Successfully signed in')
    
    // Wait a moment for the session to be established
    await page.waitForTimeout(2000)
    
    // Verify authentication by checking for user-specific content
    try {
      // Check if we can access a protected page
      await page.goto('http://localhost:3000/tutor', { waitUntil: 'networkidle' })
      
      // If we see the tutor content (not the auth prompt), we're authenticated
      const isAuthenticated = await page.locator('text=Build a New Deck').isVisible({ timeout: 5000 }).catch(() => false)
      
      if (isAuthenticated) {
        console.log('✅ Authentication verified - can access protected content')
      } else {
        console.log('⚠️ Could not verify authentication - may need to check selectors')
      }
    } catch (error) {
      console.log('⚠️ Could not verify authentication:', error)
    }
    
    // Save authentication state
    const authFile = path.join(__dirname, '../auth.json')
    await context.storageState({ path: authFile })
    
    // Verify the auth file was created and has content
    if (fs.existsSync(authFile)) {
      const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'))
      const hasCookies = authData.cookies && authData.cookies.length > 0
      const hasLocalStorage = authData.origins && authData.origins.length > 0
      
      console.log(`✅ Auth file created with ${authData.cookies?.length || 0} cookies and ${authData.origins?.length || 0} origins`)
      
      if (!hasCookies) {
        console.warn('⚠️ No cookies found in auth state - authentication may not persist')
      }
    } else {
      console.error('❌ Auth file was not created')
    }
    
  } catch (error) {
    console.error('❌ Authentication setup failed:', error)
    
    // Take a screenshot for debugging
    try {
      await page.screenshot({ path: 'auth-error-screenshot.png' })
      console.log('📸 Screenshot saved to auth-error-screenshot.png')
    } catch (screenshotError) {
      console.error('Could not take screenshot:', screenshotError)
    }
    
    // Don't throw - let tests run without auth
    console.warn('⚠️ Continuing without authentication - some tests may fail')
  }
}

export default globalSetup

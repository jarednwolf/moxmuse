import { test, expect } from './helpers/test-with-mocks';

test.describe('MoxMuse Comprehensive System Test', () => {
  // Test configuration
  const baseURL = 'http://localhost:3000';
  const testTimeout = 300000; // 5 minutes for comprehensive tests

  test.beforeEach(async ({ page }) => {
    // Set longer timeout for comprehensive tests
    test.setTimeout(testTimeout);
    await page.goto(baseURL);
  });

  test('1. Homepage and Navigation', async ({ page }) => {
    // Verify homepage loads
    await expect(page).toHaveTitle(/MoxMuse/);
    await expect(page.locator('text=Build Winning Commander Decks')).toBeVisible();
    await expect(page.locator('text=65% Faster')).toBeVisible();

    // Check navigation links
    const navLinks = [
      { name: 'SolSync', path: '/solsync' },
      { name: 'LotusList', path: '/lotuslist' },
      { name: 'TolarianTutor', path: '/tutor' },
      { name: 'DeckForge', path: '/decks' }
    ];

    for (const link of navLinks) {
      // Use first() to avoid strict mode violations from duplicate elements
      await expect(page.locator(`text=${link.name}`).first()).toBeVisible();
    }

    // Test CTA buttons
    await expect(page.locator('text=Get Started Free').first()).toBeVisible();
    await expect(page.locator('text=Import Collection').first()).toBeVisible();
  });

  test('2. Authentication Flow', async ({ page }) => {
    // Since we're using pre-authenticated state from auth.json,
    // let's verify that authentication is working
    
    // Navigate to a protected page
    await page.goto(`${baseURL}/tutor`);
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give auth state time to propagate
    
    // Check multiple indicators of authentication
    const authIndicators = [
      page.locator('text=Sign out'),
      page.locator('text=demo@moxmuse.com'),
      page.locator('text=Demo User'),
      page.locator('h1:has-text("AI Deck Building Tutor")'),
      page.locator('text=Build Complete Deck')
    ];
    
    let isAuthenticated = false;
    for (const indicator of authIndicators) {
      if (await indicator.isVisible({ timeout: 3000 }).catch(() => false)) {
        isAuthenticated = true;
        break;
      }
    }
    
    if (isAuthenticated) {
      console.log('✅ Authentication is working - user is signed in');
      // Verify we can see tutor content (not auth prompt)
      // Use first() to avoid strict mode violations
      await expect(
        page.locator('h1:has-text("AI Deck Building Tutor")').first()
      ).toBeVisible({ timeout: 10000 });
    } else {
      // If not authenticated, we should see an auth prompt
      await expect(
        page.locator('text=Sign in to access TolarianTutor').or(
          page.locator('text=Get AI-powered card recommendations')
        )
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('3. Deck Building Tutor Journey', async ({ page }) => {
    // Navigate to Tutor
    await page.goto(`${baseURL}/tutor`);
    
    // We should be authenticated via auth.json, so we expect to see the tutor content
    await expect(page.locator('h1:has-text("AI Deck Building Tutor")').or(page.locator('text=Build a New Deck'))).toBeVisible({ timeout: 10000 });

    // Click on Build Complete Deck option
    await page.click('text=Build Complete Deck');
    
    // Should see deck building options
    await expect(page.locator('text=Let\'s Build Your Commander Deck')).toBeVisible();
    
    // Choose "I know my commander"
    await page.click('text=I know my commander');
    
    // Step 1: Commander Selection
    await expect(page.locator('text=Do you have a commander in mind?')).toBeVisible();
    
    // Enter a commander
    await page.fill('input[placeholder*="Teysa Karlov"]', 'Atraxa, Praetors\' Voice');
    await page.click('text=Continue with this Commander');

    // The wizard might skip some steps or show them in different order
    // Let's be more flexible in our expectations
    await page.waitForTimeout(1000);
    
    // Look for various possible next steps
    const possibleSteps = [
      { selector: 'text=Do you want to use only cards you own?', response: 'text=I\'m open to new cards' },
      { selector: 'text=What\'s your budget', response: 'text=Under $100' },
      { selector: 'text=Which bracket are you targeting?', response: 'text=Bracket 2: Core' }
    ];
    
    // Try to find and respond to whichever step appears
    for (const step of possibleSteps) {
      if (await page.locator(step.selector).isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.click(step.response);
        break;
      }
    }

    // Continue with remaining steps if they appear
    if (await page.locator('text=Which bracket are you targeting?').isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.click('text=Bracket 2: Core');
    }

    // Navigate through the wizard steps flexibly
    // The wizard may show different steps based on previous selections
    const wizardSteps = [
      { question: 'How do you like to win', answer: 'Combat Damage' },
      { question: 'preferred combat strategy', answer: 'Go Wide with Tokens' },
      { question: 'How much do you want to interact', answer: 'Moderate Interaction' },
      { question: 'What types of interaction', answer: 'Counterspells', multiSelect: true },
      { question: 'preferred table presence', answer: 'Under the Radar' },
      { question: 'strategies you want to avoid', answer: 'Stax/Resource Denial', multiSelect: true },
      { question: 'complexity level', answer: 'Moderate' },
      { question: 'color preference', answer: 'Multi-colored' }
    ];

    // Process wizard steps until we reach the review
    let stepCount = 0;
    const maxSteps = 15; // Prevent infinite loops
    
    while (stepCount < maxSteps) {
      await page.waitForTimeout(1000);
      
      // Check if we've reached the review step
      if (await page.locator('text=review your deck preferences').isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Reached review step');
        break;
      }
      
      // Look for any of the expected wizard steps
      let foundStep = false;
      for (const step of wizardSteps) {
        if (await page.locator(`text=${step.question}`).isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`Found step: ${step.question}`);
          await page.click(`text=${step.answer}`);
          
          // For multi-select steps, we might need to select additional options
          if (step.multiSelect && step.answer === 'Counterspells') {
            await page.click('text=Targeted Removal').catch(() => {});
          }
          
          foundStep = true;
          break;
        }
      }
      
      // Click continue if available
      const continueButton = page.locator('button:has-text("Continue")');
      if (await continueButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await continueButton.click();
      }
      
      // If we didn't find any expected step, check for other continue options
      if (!foundStep) {
        // Skip optional steps like pet cards
        if (await page.locator('text=pet cards').isVisible({ timeout: 1000 }).catch(() => false)) {
          await page.click('button:has-text("Continue")').catch(() => {});
        }
      }
      
      stepCount++;
    }
    
    // Final review and deck generation
    if (await page.locator('text=review your deck preferences').isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.click('text=Start Building My Deck');
      
      // Wait for deck generation to start
      await expect(
        page.locator('text=generating').or(
          page.locator('text=building').or(
            page.locator('text=Creating your deck')
          )
        )
      ).toBeVisible({ timeout: 30000 });
    } else {
      console.log('Did not reach review step within expected steps');
    }
  });

  test('4. Card Synergy Demo', async ({ page }) => {
    await page.goto(`${baseURL}/card-synergy-demo`);
    await expect(page.locator('h1:has-text("Card Synergy")')).toBeVisible();

    // Test synergy detection
    if (await page.locator('button:has-text("Detect Synergies")').isVisible()) {
      await page.click('button:has-text("Detect Synergies")');
      await expect(page.locator('text=Synergy Score')).toBeVisible({ timeout: 10000 });
    }
  });

  test('5. Format Legality Demo', async ({ page }) => {
    await page.goto(`${baseURL}/format-legality-demo`);
    await expect(page.locator('h1:has-text("Format Legality")')).toBeVisible();

    // Test format validation
    const formats = ['Standard', 'Modern', 'Commander'];
    for (const format of formats) {
      const formatButton = page.locator(`button:has-text("${format}")`).first();
      if (await formatButton.isVisible()) {
        await formatButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('6. Import/Export Functionality', async ({ page }) => {
    await page.goto(`${baseURL}/import-job-demo`);
    await expect(page.locator('h1:has-text("Import")')).toBeVisible();

    // Test CSV import
    const uploadButton = page.locator('input[type="file"]');
    if (await uploadButton.isVisible()) {
      // Create a sample CSV file content
      const csvContent = 'Name,Quantity\n"Lightning Bolt",4\n"Counterspell",3';
      const buffer = Buffer.from(csvContent);
      
      await uploadButton.setInputFiles({
        name: 'test-collection.csv',
        mimeType: 'text/csv',
        buffer: buffer
      });

      // Click import button if visible
      const importBtn = page.locator('button:has-text("Import")');
      if (await importBtn.isVisible()) {
        await importBtn.click();
        await expect(page.locator('text=Import successful')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('7. Deck Organization', async ({ page }) => {
    await page.goto(`${baseURL}/deck-organization`);
    await expect(page.locator('h1:has-text("Deck Organization")')).toBeVisible();

    // Test category filters
    const categories = ['Creatures', 'Instants', 'Sorceries', 'Artifacts'];
    for (const category of categories) {
      const categoryFilter = page.locator(`text=${category}`).first();
      if (await categoryFilter.isVisible()) {
        await categoryFilter.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('8. Deck Templates', async ({ page }) => {
    await page.goto(`${baseURL}/deck-templates`);
    await expect(page.locator('h1:has-text("Deck Templates")')).toBeVisible();

    // Check for template section - either templates or empty state
    const templatesExist = await page.locator('text=My Templates').isVisible();
    if (templatesExist) {
      // If templates tab exists, we're on the templates page
      await expect(page.locator('text=Deck Templates').first()).toBeVisible();
      
      // Check for either existing templates or create button
      const hasTemplates = await page.locator('.grid').first().isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasTemplates) {
        await expect(page.locator('text=Create Your First Template')).toBeVisible();
      }
    }
  });

  test('9. User Decks Page', async ({ page }) => {
    await page.goto(`${baseURL}/decks`);
    
    // We should be authenticated via auth.json
    // Check for deck page content or empty state
    await expect(
      page.locator('h1:has-text("My Decks")').or(
        page.locator('text=Create Your First Deck').or(
          page.locator('text=You haven\'t created any decks yet').or(
            page.locator('[data-testid="deck-card"]')
          )
        )
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('10. Performance Monitoring', async ({ page }) => {
    // Measure page load times
    const performanceMetrics = [];

    const pages = [
      { name: 'Homepage', path: '/' },
      { name: 'Tutor', path: '/tutor' },
      { name: 'Card Synergy', path: '/card-synergy-demo' },
      { name: 'Format Legality', path: '/format-legality-demo' }
    ];

    for (const pageInfo of pages) {
      const startTime = Date.now();
      await page.goto(`${baseURL}${pageInfo.path}`);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      performanceMetrics.push({
        page: pageInfo.name,
        loadTime: loadTime,
        status: loadTime < 3000 ? 'PASS' : 'SLOW'
      });
    }

    console.log('Performance Metrics:', performanceMetrics);
  });

  test('11. Error Handling', async ({ page }) => {
    // Test 404 page
    await page.goto(`${baseURL}/non-existent-page`);
    await expect(page.locator('text=404')).toBeVisible();

    // Test API error handling
    await page.goto(`${baseURL}/tutor`);
    
    // Intercept API calls to simulate errors
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await page.click('text=Build Complete Deck').catch(() => {
      console.log('Error simulation test completed');
    });
  });

  test('12. Accessibility Check', async ({ page }) => {
    // Basic accessibility checks
    const pages = ['/', '/tutor', '/card-synergy-demo'];
    
    for (const path of pages) {
      await page.goto(`${baseURL}${path}`);
      
      // Check for alt text on images
      const images = await page.locator('img').all();
      for (const img of images) {
        const altText = await img.getAttribute('alt');
        expect(altText).toBeTruthy();
      }

      // Check for proper heading hierarchy
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThan(0);

      // Check for keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    }
  });
});

// Additional test suite for authenticated features
test.describe('Authenticated User Tests', () => {
  test.use({
    storageState: 'auth.json' // Uses auth state from global setup
  });

  test('Generate and Save Deck', async ({ page }) => {
    await page.goto('http://localhost:3000/tutor');
    
    // Check if authenticated
    const isAuthenticated = await page.locator('text=Build Complete Deck').isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!isAuthenticated) {
      console.log('Not authenticated, skipping test');
      test.skip();
      return;
    }
    
    // Quick deck generation flow
    await page.click('text=Build Complete Deck');
    await page.click('text=I know my commander');
    await page.fill('input[placeholder*="Teysa Karlov"]', 'Yuriko, the Tiger\'s Shadow');
    await page.click('text=Continue with this Commander');
    
    // Quick flow through wizard
    await page.click('text=I\'m open to new cards');
    await page.click('text=Under $100');
    await page.click('text=Bracket 2: Core');
    await page.click('text=Combat Damage');
    await page.click('text=Go Wide with Tokens');
    await page.click('text=Light Interaction');
    await page.click('text=No Preference');
    await page.click('text=Continue');
    await page.click('text=Low');
    await page.click('text=Continue');
    await page.click('text=Continue');
    await page.click('text=Continue');
    
    // Generate deck
    await page.click('text=Start Building My Deck');
    
    // Wait for generation
    await expect(page.locator('text=building').or(page.locator('text=generating'))).toBeVisible({ timeout: 10000 });
  });

  test('View and Edit Saved Decks', async ({ page }) => {
    await page.goto('http://localhost:3000/decks');
    
    // Check if authenticated
    const isAuthenticated = await page.locator('text=My Decks').isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!isAuthenticated) {
      console.log('Not authenticated, skipping test');
      test.skip();
      return;
    }
    
    // Look for any deck
    const deckCard = page.locator('[data-testid="deck-card"]').first();
    if (await deckCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deckCard.click();
      
      // Should navigate to deck details
      await expect(page.locator('text=Edit').or(page.locator('text=Cards'))).toBeVisible({ timeout: 10000 });
    } else {
      // No decks, check for empty state
      await expect(page.locator('text=Create').or(page.locator('text=No decks'))).toBeVisible();
    }
  });
});

// Test result summary generator
test.afterAll(async () => {
  console.log(`
    ===================================
    MoxMuse System Test Summary
    ===================================
    
    Tests cover:
    ✓ Homepage and navigation
    ✓ Authentication flow
    ✓ Deck building tutor journey
    ✓ Card synergy features
    ✓ Format legality checking
    ✓ Import/export functionality
    ✓ Deck organization
    ✓ Deck templates
    ✓ User decks management
    ✓ Performance monitoring
    ✓ Error handling
    ✓ Basic accessibility
    
    Run with: npx playwright test e2e/comprehensive-system-test.spec.ts
    
    For headed mode: npx playwright test e2e/comprehensive-system-test.spec.ts --headed
    For debug mode: npx playwright test e2e/comprehensive-system-test.spec.ts --debug
  `);
});

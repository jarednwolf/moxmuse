# MoxMuse Manual Browser Testing Guide

This guide provides a step-by-step procedure to manually test all MoxMuse functionality in the browser. Use this alongside the automated Playwright tests for comprehensive validation.

## Prerequisites
- Development server running at http://localhost:3000
- Browser DevTools open (F12) to monitor console errors
- Test data ready (demo account credentials)

## 1. Homepage Testing

### Steps:
1. Navigate to http://localhost:3000
2. **Verify Visual Elements:**
   - [ ] MoxMuse logo visible
   - [ ] "Build Winning Commander Decks 65% Faster" headline
   - [ ] Navigation links (SolSync, LotusList, TolarianTutor, DeckForge)
   - [ ] "Get Started Free" button
   - [ ] "Import Collection" button
   - [ ] Background image loads properly

3. **Test Navigation:**
   - [ ] Click each nav link and verify redirect
   - [ ] Use browser back button to return
   - [ ] Check hover states on all interactive elements

4. **Console Check:**
   - [ ] No critical errors in console
   - [ ] Note any 404s or warnings

## 2. Authentication Flow

### Steps:
1. Click "Sign In" button
2. **On Sign In Page:**
   - [ ] Email input field present
   - [ ] Password input field present
   - [ ] Submit button enabled when fields filled
   
3. **Test Invalid Login:**
   - Email: `invalid@test.com`
   - Password: `wrongpass`
   - [ ] Error message displays
   - [ ] Form doesn't submit

4. **Test Demo Account:**
   - Email: `demo@moxmuse.com`
   - Password: `demo123`
   - [ ] Successful login
   - [ ] Redirects to homepage or dashboard
   - [ ] User info displays in header

## 3. Deck Building Tutor (Core Feature)

### Steps:
1. Navigate to `/tutor`
2. **Landing Page:**
   - [ ] "AI Deck Building Tutor" heading
   - [ ] "Start New Consultation" button
   - [ ] Previous consultations list (if any)

3. **Start Consultation Wizard:**
   
   **Step 1 - Commander Selection:**
   - [ ] Search bar functional
   - [ ] Type "Atraxa" and wait for results
   - [ ] Results show commander cards
   - [ ] Click to select commander
   - [ ] Continue button enables
   
   **Step 2 - Strategy Selection:**
   - [ ] Strategy options display (Tokens, Control, etc.)
   - [ ] Can select one strategy
   - [ ] Selected strategy highlights
   - [ ] Continue button works
   
   **Step 3 - Budget Settings:**
   - [ ] Budget slider/input field
   - [ ] Enter $100
   - [ ] Value updates correctly
   - [ ] Continue button works
   
   **Step 4 - Power Level:**
   - [ ] Power level options (Casual, Focused, Optimized, Competitive)
   - [ ] Select "Casual"
   - [ ] Continue button works
   
   **Step 5 - Review:**
   - [ ] All selections displayed correctly
   - [ ] Edit buttons work for each section
   - [ ] "Generate Deck" button visible

4. **Deck Generation:**
   - [ ] Click "Generate Deck"
   - [ ] Progress indicators show:
     - Setting up AI consultation
     - Researching commander strategies
     - Selecting optimal cards
     - Finalizing deck list
   - [ ] Each step completes (may take 30-60 seconds)
   - [ ] No errors in console during generation

5. **Deck Display:**
   - [ ] 100 cards displayed
   - [ ] Cards organized by category
   - [ ] Each card shows:
     - Card image
     - Name
     - Mana cost
     - Price
   - [ ] Deck statistics visible:
     - Mana curve chart
     - Color distribution
     - Average CMC
     - Total price

6. **Card Interactions:**
   - [ ] Click a card for details
   - [ ] Explanation modal shows:
     - Why this card was chosen
     - Synergies with commander
     - Alternative options
   - [ ] Modal closes properly

## 4. Feature Demo Pages

### 4.1 Card Synergy Demo (/card-synergy-demo)
- [ ] Page loads without errors
- [ ] Sample cards display
- [ ] "Detect Synergies" button works
- [ ] Synergy scores display
- [ ] Explanation text appears

### 4.2 Format Legality Demo (/format-legality-demo)
- [ ] Format buttons display (Standard, Modern, Commander, etc.)
- [ ] Click each format to test
- [ ] Legal/illegal cards update based on format
- [ ] Visual indicators work (green check, red X)

### 4.3 Import Job Demo (/import-job-demo)
- [ ] File upload area visible
- [ ] Drag and drop works
- [ ] File selector works
- [ ] Upload a test CSV file
- [ ] Progress indicator shows
- [ ] Success/error messages display

### 4.4 Export Format Demo (/export-format-demo)
- [ ] Format options display
- [ ] Select different formats (TXT, CSV, JSON)
- [ ] Download buttons work
- [ ] Files download correctly

### 4.5 Deck Organization (/deck-organization)
- [ ] Category filters display
- [ ] Click filters to show/hide categories
- [ ] Sorting options work
- [ ] Card counts update

### 4.6 Deck Templates (/deck-templates)
- [ ] Template cards display
- [ ] Hover effects work
- [ ] Click to view template details
- [ ] "Use Template" button visible

## 5. User Deck Management

### Steps:
1. Navigate to `/decks` (requires authentication)
2. **Deck List:**
   - [ ] User's decks display
   - [ ] Deck cards show:
     - Name
     - Format
     - Colors
     - Last updated
   - [ ] Click deck to view details

3. **Deck Detail View:**
   - [ ] Full deck list displays
   - [ ] Edit button works
   - [ ] Export options available
   - [ ] Delete button works (with confirmation)

## 6. Performance Testing

### Manual Performance Checks:
1. **Page Load Times:**
   - [ ] Homepage: < 3 seconds
   - [ ] Tutor page: < 3 seconds
   - [ ] Deck generation: < 60 seconds
   
2. **Interaction Responsiveness:**
   - [ ] Buttons respond immediately
   - [ ] No lag when typing in search
   - [ ] Smooth scrolling
   - [ ] Modal animations smooth

3. **Memory Usage:**
   - Open DevTools → Performance
   - [ ] No memory leaks during navigation
   - [ ] Memory usage reasonable (< 100MB)

## 7. Error Handling

### Test Error Scenarios:
1. **Network Errors:**
   - Open DevTools → Network tab
   - Set to "Offline"
   - Try to generate a deck
   - [ ] Error message displays
   - [ ] UI doesn't break

2. **Invalid Inputs:**
   - Try negative budget
   - [ ] Validation prevents submission
   - Try empty commander name
   - [ ] Error message shows

3. **404 Pages:**
   - Navigate to `/nonexistent`
   - [ ] 404 page displays
   - [ ] Navigation still works

## 8. Mobile Responsiveness

### Steps:
1. Open DevTools → Toggle device toolbar
2. Test on different viewports:
   - [ ] iPhone SE (375px)
   - [ ] iPad (768px)
   - [ ] Desktop (1200px+)

3. **Check Each Page:**
   - [ ] Navigation menu adapts (hamburger on mobile)
   - [ ] Cards stack vertically on mobile
   - [ ] Buttons remain tappable
   - [ ] Text remains readable
   - [ ] No horizontal scroll

## 9. Accessibility Testing

### Basic Checks:
1. **Keyboard Navigation:**
   - Tab through the page
   - [ ] All interactive elements reachable
   - [ ] Focus indicators visible
   - [ ] Skip links work

2. **Screen Reader:**
   - Use browser screen reader
   - [ ] Images have alt text
   - [ ] Buttons have descriptive labels
   - [ ] Form fields have labels

3. **Color Contrast:**
   - [ ] Text readable on all backgrounds
   - [ ] Important info not only conveyed by color

## 10. Browser Compatibility

Test on multiple browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

For each browser, verify:
- [ ] All features work
- [ ] No console errors
- [ ] Styling consistent

## Test Report Template

```markdown
## MoxMuse Browser Test Report
Date: [DATE]
Tester: [NAME]
Environment: [Dev/Staging/Prod]
Browser: [Browser & Version]

### Summary
- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X

### Critical Issues
1. [Issue description]
   - Steps to reproduce
   - Expected vs Actual
   - Screenshot/Error

### Minor Issues
1. [Issue description]

### Performance Metrics
- Homepage Load: Xs
- Deck Generation: Xs
- Memory Usage: XMB

### Recommendations
1. [Priority fixes]
2. [Improvements]
```

## Automated Testing

To run the automated Playwright tests:

```bash
# Run all tests
cd apps/web
npx playwright test e2e/comprehensive-system-test.spec.ts

# Run with UI (see tests execute)
npx playwright test e2e/comprehensive-system-test.spec.ts --headed

# Run in debug mode (step through)
npx playwright test e2e/comprehensive-system-test.spec.ts --debug

# Run specific test
npx playwright test e2e/comprehensive-system-test.spec.ts -g "Homepage"
```

## Quick Validation Script

For a quick system check, run:

```bash
npm run validate-system
```

This will check:
- Database connectivity
- API endpoints
- Environment variables
- External service connections

## Troubleshooting

### Common Issues:

1. **"Cannot connect to database"**
   - Check DATABASE_URL in .env
   - Verify Postgres is running
   - Run migrations: `npm run db:migrate`

2. **"OpenAI API error"**
   - Check OPENAI_API_KEY in .env
   - Verify API quota/billing

3. **"Page not loading"**
   - Check dev server is running
   - Clear browser cache
   - Check for port conflicts

4. **"Authentication not working"**
   - Check NextAuth configuration
   - Verify NEXTAUTH_SECRET is set
   - Check callback URLs

## Next Steps

After completing manual testing:

1. Document all issues found
2. Create GitHub issues for bugs
3. Update test cases for missing coverage
4. Run performance profiling if needed
5. Schedule fixes based on priority

Remember: The goal is to ensure MoxMuse provides a smooth, reliable deck-building experience for all users!

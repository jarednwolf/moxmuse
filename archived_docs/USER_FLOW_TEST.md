# User Flow Testing Guide

This guide outlines the complete user journey through MoxMuse, from signup to deck creation. Use this to verify all features are working correctly.

## Test Prerequisites

- Development server running (`pnpm run dev`)
- PostgreSQL and Redis services active
- Demo user credentials available

## 1. Landing Page & Authentication Flow

### Test: Unauthenticated Landing Page
1. Navigate to http://localhost:3002/
2. ✓ Verify cycling background images (5 landscapes, 25s cycle)
3. ✓ Verify WUBRG Mox circles in header
4. ✓ Verify three feature cards (SolSync, LotusList, TolarianTutor)
5. ✓ Verify "Get Started Free" and "Sign In" buttons

### Test: Sign In Page
1. Click "Sign In" from landing page
2. ✓ Verify cycling backgrounds on sign-in page
3. ✓ Verify demo account option is prominent
4. ✓ Test demo account login
5. ✓ Verify OAuth options (if configured)

### Test: Protected Routes (Unauthenticated)
1. Try accessing /tutor, /solsync, /lotuslist without auth
2. ✓ Each should show AuthPrompt component
3. ✓ Verify feature-specific benefits listed
4. ✓ Verify "Try Demo Account" button works

## 2. SolSync - Collection Import

### Test: CSV Upload
1. Navigate to /solsync (authenticated)
2. ✓ Download sample template
3. ✓ Verify CSV format matches requirements
4. ✓ Test drag-and-drop upload
5. ✓ Verify progress bar during import
6. ✓ Check error handling for invalid formats
7. ✓ Verify success message and card count

### Test: Moxfield Sync
1. Click "Connect Moxfield" (if OAuth configured)
2. ✓ Complete OAuth flow
3. ✓ Select collection to import
4. ✓ Verify import progress
5. ✓ Check duplicate handling

**Note**: Moxfield OAuth requires configuration - see MOXFIELD_OAUTH_SETUP.md

## 3. LotusList - Collection Browser

### Test: Collection Display
1. Navigate to /lotuslist
2. ✓ Verify collection stats (total cards, unique, value, avg)
3. ✓ Toggle between grid and list views
4. ✓ Verify card images load correctly
5. ✓ Check quantity badges and foil indicators

### Test: Filtering & Search
1. Test search functionality
2. ✓ Filter by colors (WUBRG buttons)
3. ✓ Filter by CMC (range slider)
4. ✓ Filter by card type
5. ✓ Filter by rarity
6. ✓ Verify "Clear all filters" works

### Test: Sorting & Pagination
1. Test all sort options (name, price, CMC, quantity, color)
2. ✓ Toggle sort direction (ascending/descending)
3. ✓ Navigate through pages if >50 cards
4. ✓ Verify page count updates with filters

### Test: Card Detail Modal
1. Click on any card
2. ✓ Verify modal opens with card image
3. ✓ Check oracle text display
4. ✓ Verify price information
5. ✓ Check competitive stats (placeholder data)
6. ✓ Test affiliate links generation
7. ✓ Verify modal closes properly

## 4. Deck Management

### Test: Deck Creation
1. Navigate to /decks
2. Click "Create New Deck"
3. ✓ Enter deck name
4. ✓ Select format (Commander/Standard/Modern)
5. ✓ Add optional description
6. ✓ Verify deck appears in list
7. ✓ Check navigation to deck editor

### Test: Deck Editor
1. Click on a deck from /decks
2. ✓ Verify deck stats display
3. ✓ Check mana curve visualization
4. ✓ Test deck name/description editing
5. ✓ Verify save functionality

### Test: Adding Cards to Deck
1. Click "Add Cards" in deck editor
2. ✓ Modal shows user's collection
3. ✓ Search within collection works
4. ✓ Can increment/decrement quantities
5. ✓ Respects available quantities
6. ✓ "Add X Cards" updates deck
7. ✓ Cards appear in deck view

### Test: Deck Management Features
1. Remove cards from deck (trash icon)
2. ✓ Filter cards by category
3. ✓ Search within deck
4. ✓ Export deck as .txt file
5. ✓ Verify export format is correct
6. ✓ Delete deck from /decks page

## 5. TolarianTutor - AI Recommendations

### Test: Chat Interface
1. Navigate to /tutor
2. ✓ Verify welcome message
3. ✓ Type a commander-related question
4. ✓ Verify AI response appears
5. ✓ Check card recommendations format

### Test: Recommendations
1. Ask for deck recommendations
2. ✓ Verify cards are formatted correctly
3. ✓ Check "View on" affiliate links
4. ✓ Test clicking affiliate links
5. ✓ Verify chat history persists in session

### Test: Error Handling
1. Submit empty message
2. ✓ Try very long message
3. ✓ Test with network offline
4. ✓ Verify error messages are user-friendly

## 6. Cross-Feature Integration

### Test: Collection to Deck Flow
1. Import collection via SolSync
2. Browse in LotusList
3. Create new deck
4. Add cards from collection
5. ✓ Verify only owned cards can be added
6. ✓ Check quantities respect collection limits

### Test: AI to Deck Flow
1. Get recommendations from TolarianTutor
2. Note recommended cards
3. Check if owned in LotusList
4. Add available cards to deck

## 7. Performance & Edge Cases

### Test: Large Collections
1. Import 1000+ cards
2. ✓ Verify pagination works smoothly
3. ✓ Check search/filter performance
4. ✓ Test export of large deck

### Test: Error States
1. Database connection failure
2. ✓ Invalid card data
3. ✓ Network timeouts
4. ✓ Rate limiting (if implemented)

### Test: Mobile Responsiveness
1. Test on mobile viewport
2. ✓ Verify navigation works
3. ✓ Check card grid adjusts
4. ✓ Test modals on small screens

## 8. Data Persistence

### Test: Session Persistence
1. Make changes (import cards, create deck)
2. Refresh page
3. ✓ Verify data persists
4. Sign out and sign back in
5. ✓ Verify user data intact

### Test: Demo Account Limitations
1. Use demo account
2. ✓ Verify can test all features
3. ✓ Note any limitations
4. ✓ Check data isolation from other users

## Checklist Summary

- [ ] Landing page displays correctly
- [ ] Authentication flow works
- [ ] Collection import successful
- [ ] Collection browsing functional
- [ ] Deck creation and editing work
- [ ] AI recommendations generate
- [ ] Affiliate links work
- [ ] Export functionality works
- [ ] Error handling graceful
- [ ] Mobile responsive

## Known Issues / Notes

**Document any issues found during testing:**

1. _Issue_: 
   - Steps to reproduce:
   - Expected behavior:
   - Actual behavior:

2. _Issue_:
   - Steps to reproduce:
   - Expected behavior:
   - Actual behavior:

## Sign-off

- **Tester**: ________________
- **Date**: ________________
- **Version**: ________________
- **Status**: ☐ Pass / ☐ Pass with issues / ☐ Fail 
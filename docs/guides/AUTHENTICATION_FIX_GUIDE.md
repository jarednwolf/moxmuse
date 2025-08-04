# Authentication Fix Guide for Deck Generation Tests

## Issue
The test is failing with a JWT authentication error:
```
Invalid Content Encryption Key length. Expected 512 bits, got 256 bits
```

## Root Cause
The NEXTAUTH_SECRET in your .env.local file is either:
1. Not set
2. Too short (needs to be at least 32 characters)
3. Not properly formatted

## Solution Steps

### 1. Generate a New Secret
```bash
openssl rand -base64 32
```

### 2. Update .env.local
Add or update these lines in your `.env.local` file:
```env
NEXTAUTH_SECRET="[paste-your-generated-secret-here]"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Restart the Dev Server
```bash
# Stop the current server (Ctrl+C)
# Start it again
npm run dev
```

### 4. Get a Fresh Auth Token (if needed)
If the test still fails after fixing the secret:

1. Open http://localhost:3000 in your browser
2. Sign in with the demo account
3. Open Developer Tools > Application > Cookies
4. Find the `next-auth.session-token` cookie
5. Copy its value
6. Update the AUTH_TOKEN in `test-teysa-karlov-deck.js`

### 5. Run the Test Again
```bash
./run-teysa-test.sh
```

## Alternative: Test Without Authentication
If you want to test the core functionality without dealing with auth, you could temporarily modify the `tutor.ts` router to skip authentication for testing:

```typescript
// In packages/api/src/routers/tutor.ts
// Temporarily change from:
.use(isAuthed)
// To:
// .use(isAuthed)  // Comment out for testing
```

**Important**: Remember to re-enable authentication after testing!

## Expected Result
Once authentication is fixed, you should see:
```
✅ SUCCESS! Deck generated in X seconds
📊 Deck Details:
- Deck ID: [generated-id]
- Card Count: 100
- View Deck: http://localhost:3000/decks/[generated-id]
```

## Verification
Run the auth check script to verify your setup:
```bash
./test-auth-check.sh
```

This will tell you if your NEXTAUTH_SECRET is properly configured.

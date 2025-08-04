# MoxMuse Collection Integration Guide

## Current Status

Moxfield does not currently offer a public OAuth API or developer portal. The `/account/developers` page exists but is not functional. This document explains our alternative approach to collection integration.

## Our Multi-Source Approach

Instead of relying solely on Moxfield OAuth, MoxMuse now supports multiple collection sources:

### 1. **Moxfield Public Collections**
- Users can connect their Moxfield username
- Only works for public collections
- Uses the public API endpoint: `https://api2.moxfield.com/v2/users/{username}/collection`
- No authentication required

### 2. **Archidekt Integration**
- Connect via Archidekt username
- Fetches public collections via GraphQL API
- More reliable than Moxfield for public data

### 3. **Manual Import**
- CSV/Text paste functionality
- Supports formats like:
  ```
  4 Lightning Bolt
  2 Counterspell
  1 Black Lotus
  ```
- Cards are matched to Scryfall IDs automatically

## How to Set Up

### For Users:
1. Sign in with email/password or Google OAuth
2. Go to SolSync page
3. Click "Add Source" and choose:
   - **Moxfield**: Enter your username (collection must be public)
   - **Archidekt**: Enter your username (collection must be public)
   - **Manual**: Paste your card list

### For Developers:
1. No Moxfield OAuth setup needed
2. Optional: Set up Google OAuth for authentication
3. Ensure Redis is running for caching
4. Database stores only manually imported collections

## Future Moxfield Private API Access

If you want to request private API access from Moxfield:

1. **Contact Methods:**
   - Join their Discord and message @Owners
   - Email support@moxfield.com

2. **What to Include:**
   - Brief description of MoxMuse
   - How it benefits Moxfield users
   - Expected API usage (< 300 RPM)
   - Commitment to not store private data

3. **Example Request:**
   ```
   Hi Moxfield Team,

   I run MoxMuse (moxmuse.com), a free AI assistant that helps players
   optimize Commander decks. Users want to pull their existing Moxfield
   collections to get personalized recommendations.

   • Read-only access to collection endpoints
   • <300 RPM expected (we cache aggressively)
   • No PII stored; only card IDs + quantities
   • Happy to show "Powered by Moxfield" badge

   Let me know if this aligns with your API policy.

   Thanks!
   ```

## Environment Variables

No Moxfield OAuth variables needed. The following are optional:

```env
# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
```

## Architecture Benefits

1. **No vendor lock-in** - Users can import from multiple sources
2. **Works today** - No waiting for API approval
3. **Privacy-friendly** - Only accesses public data
4. **Flexible** - Easy to add new sources

## Limitations

- Cannot access private Moxfield collections
- No real-time sync for private collections
- Users must make collections public or use manual import
- No automatic updates when collections change

For most users, the combination of public collection access and manual import provides a good experience while we work toward official API partnerships. 
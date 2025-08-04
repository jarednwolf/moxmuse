# Affiliate Setup Guide

This guide explains how to configure real affiliate IDs for TCGPlayer and Card Kingdom in the MoxMuse application.

## Overview

MoxMuse generates affiliate links for card purchases through TCGPlayer and Card Kingdom. Currently, placeholder affiliate IDs are used in development. This guide shows where to add your real affiliate IDs for production.

## Affiliate Programs

### TCGPlayer Affiliate Program
- **Sign up**: https://www.tcgplayer.com/affiliates/
- **Commission**: Typically 3-5% on sales
- **Cookie duration**: 7 days
- **Payment threshold**: $25

### Card Kingdom Affiliate Program
- **Sign up**: https://www.cardkingdom.com/affiliates
- **Commission**: Typically 4-6% on sales
- **Cookie duration**: 30 days
- **Payment threshold**: $50

## Configuration Locations

### 1. Environment Variables

Add your affiliate IDs to the `.env.local` file:

```env
# Affiliate Configuration
TCGPLAYER_AFFILIATE_ID=your_tcgplayer_id_here
CARDKINGDOM_AFFILIATE_ID=your_cardkingdom_id_here
```

### 2. Affiliate Service (`packages/api/src/services/affiliate.ts`)

The affiliate service currently has hardcoded placeholder IDs. Update these locations:

```typescript
// Line 4-5: Replace these with environment variables
const TCGPLAYER_AFFILIATE_ID = process.env.TCGPLAYER_AFFILIATE_ID || 'MOXMUSE'
const CARDKINGDOM_AFFILIATE_ID = process.env.CARDKINGDOM_AFFILIATE_ID || 'MOXMUSE'
```

Currently:
```typescript
const TCGPLAYER_AFFILIATE_ID = 'MOXMUSE' // TODO: Replace with real ID
const CARDKINGDOM_AFFILIATE_ID = 'MOXMUSE' // TODO: Replace with real ID
```

### 3. URL Generation

The affiliate URLs are generated in the following format:

#### TCGPlayer
```
https://www.tcgplayer.com/product/{productId}?utm_campaign=affiliate&utm_medium={AFFILIATE_ID}&utm_source={AFFILIATE_ID}
```

#### Card Kingdom
```
https://www.cardkingdom.com/mtg/{setCode}/{cardSlug}?partner={AFFILIATE_ID}&utm_source={AFFILIATE_ID}&utm_medium=affiliate&utm_campaign={AFFILIATE_ID}
```

## Implementation Steps

1. **Sign up** for both affiliate programs
2. **Get approved** (usually takes 1-3 business days)
3. **Retrieve your affiliate IDs** from each platform's dashboard
4. **Update environment variables** in production
5. **Update the affiliate service** to use environment variables
6. **Test links** to ensure proper tracking

## Testing Affiliate Links

To verify your affiliate links are working:

1. Generate a link through the application
2. Click the link and check the URL parameters
3. Make a test purchase (optional)
4. Verify tracking in your affiliate dashboard (may take 24-48 hours)

## Production Deployment

When deploying to production:

1. Set environment variables in your hosting platform:
   - Vercel: Project Settings → Environment Variables
   - Railway: Variables tab in project settings
   - Other platforms: Refer to platform documentation

2. Ensure the variables are available to the API service

3. Redeploy the application

## Compliance

Remember to:
- Include affiliate disclosures on pages with affiliate links
- Follow FTC guidelines for affiliate marketing
- Comply with each platform's terms of service

## Support

For issues with:
- **TCGPlayer**: affiliates@tcgplayer.com
- **Card Kingdom**: affiliates@cardkingdom.com

## Notes

- Affiliate IDs are case-sensitive
- Test thoroughly before going live
- Monitor conversion rates in affiliate dashboards
- Consider implementing click tracking for analytics 
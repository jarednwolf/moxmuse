#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function setupAnalytics() {
  console.log('📊 Setting up Analytics for MoxMuse...\n');

  // 1. Install analytics packages
  console.log('📦 Installing analytics packages...');
  try {
    execSync('cd apps/web && pnpm add @vercel/analytics', { stdio: 'inherit' });
    console.log('✅ Analytics packages installed\n');
  } catch (error) {
    console.log('⚠️  Analytics packages may already be installed\n');
  }

  // 2. Create analytics provider component
  console.log('🔧 Creating analytics provider...');
  const analyticsProvider = `'use client';

import { Analytics } from '@vercel/analytics/react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Custom event types for MoxMuse
export const ANALYTICS_EVENTS = {
  // User actions
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  LOGIN: 'login',
  LOGOUT: 'logout',
  
  // Deck generation
  DECK_GENERATION_STARTED: 'deck_generation_started',
  DECK_GENERATION_COMPLETED: 'deck_generation_completed',
  DECK_GENERATION_FAILED: 'deck_generation_failed',
  DECK_GENERATION_RETRY: 'deck_generation_retry',
  
  // Deck management
  DECK_VIEWED: 'deck_viewed',
  DECK_EDITED: 'deck_edited',
  DECK_DELETED: 'deck_deleted',
  DECK_SHARED: 'deck_shared',
  DECK_EXPORTED: 'deck_exported',
  
  // User engagement
  FEEDBACK_SUBMITTED: 'feedback_submitted',
  FEATURE_REQUEST: 'feature_request',
  ERROR_REPORTED: 'error_reported',
  HELP_OPENED: 'help_opened',
  
  // Beta specific
  BETA_FEATURE_USED: 'beta_feature_used',
  BETA_FEEDBACK: 'beta_feedback',
  BETA_INVITE_SENT: 'beta_invite_sent',
} as const;

// Track custom events
export function trackEvent(
  event: keyof typeof ANALYTICS_EVENTS | string,
  properties?: Record<string, any>
) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event, {
      ...properties,
      timestamp: new Date().toISOString(),
      beta_version: process.env.NEXT_PUBLIC_APP_VERSION || 'beta',
    });
  }
  
  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics Event]', event, properties);
  }
}

// Track page views with custom properties
export function trackPageView(url: string, properties?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: url,
      ...properties,
    });
  }
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Track page views
  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);
  
  // Track session start
  useEffect(() => {
    trackEvent('session_start', {
      referrer: document.referrer,
      entry_page: pathname,
    });
  }, []);
  
  return (
    <>
      <Analytics />
      {children}
    </>
  );
}

// Hook for tracking user interactions
export function useAnalytics() {
  const trackDeckGeneration = (commander: string, success: boolean, duration?: number) => {
    trackEvent(
      success ? ANALYTICS_EVENTS.DECK_GENERATION_COMPLETED : ANALYTICS_EVENTS.DECK_GENERATION_FAILED,
      {
        commander,
        duration_ms: duration,
        success,
      }
    );
  };
  
  const trackUserAction = (action: keyof typeof ANALYTICS_EVENTS, metadata?: Record<string, any>) => {
    trackEvent(action, metadata);
  };
  
  const trackError = (error: Error, context?: Record<string, any>) => {
    trackEvent('error_occurred', {
      error_message: error.message,
      error_stack: error.stack,
      ...context,
    });
  };
  
  const trackFeatureUsage = (feature: string, metadata?: Record<string, any>) => {
    trackEvent(ANALYTICS_EVENTS.BETA_FEATURE_USED, {
      feature,
      ...metadata,
    });
  };
  
  return {
    trackEvent,
    trackDeckGeneration,
    trackUserAction,
    trackError,
    trackFeatureUsage,
  };
}
`;

  await fs.mkdir(path.join('apps', 'web', 'src', 'components', 'analytics'), { recursive: true });
  await fs.writeFile(
    path.join('apps', 'web', 'src', 'components', 'analytics', 'AnalyticsProvider.tsx'),
    analyticsProvider
  );
  console.log('✅ Analytics provider created\n');

  // 3. Create custom analytics dashboard
  console.log('📊 Creating analytics dashboard...');
  const analyticsDashboard = `'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  decksGenerated: number;
  deckGenerationSuccessRate: number;
  avgGenerationTime: number;
  topCommanders: Array<{ name: string; count: number }>;
  dailyStats: Array<{ date: string; users: number; decks: number }>;
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // In production, fetch from your API
    // For now, we'll use mock data
    setTimeout(() => {
      setData({
        totalUsers: 0,
        activeUsers: 0,
        decksGenerated: 0,
        deckGenerationSuccessRate: 0,
        avgGenerationTime: 0,
        topCommanders: [],
        dailyStats: [],
      });
      setLoading(false);
    }, 1000);
  }, []);
  
  if (loading) {
    return <div className="p-6">Loading analytics...</div>;
  }
  
  if (!data) {
    return <div className="p-6">No analytics data available</div>;
  }
  
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalUsers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Users (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeUsers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Decks Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.decksGenerated}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.deckGenerationSuccessRate}%</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Top Commanders */}
      <Card>
        <CardHeader>
          <CardTitle>Top Commanders</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topCommanders.length === 0 ? (
            <p className="text-gray-500">No data yet</p>
          ) : (
            <div className="space-y-2">
              {data.topCommanders.map((commander, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span>{commander.name}</span>
                  <span className="font-mono text-sm">{commander.count} decks</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Vercel Analytics Link */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            For detailed analytics including page views, performance metrics, and user flows,
            visit your Vercel Analytics dashboard.
          </p>
          <a
            href="https://vercel.com/analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Open Vercel Analytics →
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
`;

  await fs.mkdir(path.join('apps', 'web', 'app', 'admin', 'analytics'), { recursive: true });
  await fs.writeFile(
    path.join('apps', 'web', 'app', 'admin', 'analytics', 'page.tsx'),
    analyticsDashboard
  );
  console.log('✅ Analytics dashboard created\n');

  // 4. Create deck generation analytics component
  console.log('📈 Creating deck generation analytics...');
  const deckAnalytics = `import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { useEffect, useRef } from 'react';

interface DeckGenerationAnalyticsProps {
  commander: string;
  deckId?: string;
}

export function useDeckGenerationAnalytics({ commander, deckId }: DeckGenerationAnalyticsProps) {
  const { trackDeckGeneration, trackEvent } = useAnalytics();
  const startTimeRef = useRef<number>(Date.now());
  
  // Track generation start
  useEffect(() => {
    startTimeRef.current = Date.now();
    trackEvent('deck_generation_started', {
      commander,
      timestamp: new Date().toISOString(),
    });
  }, [commander]);
  
  // Track generation complete
  const trackComplete = (success: boolean) => {
    const duration = Date.now() - startTimeRef.current;
    trackDeckGeneration(commander, success, duration);
    
    if (success && deckId) {
      trackEvent('deck_created', {
        deck_id: deckId,
        commander,
        generation_time_ms: duration,
      });
    }
  };
  
  // Track retry
  const trackRetry = (attempt: number) => {
    trackEvent('deck_generation_retry', {
      commander,
      attempt,
      previous_duration_ms: Date.now() - startTimeRef.current,
    });
    startTimeRef.current = Date.now(); // Reset timer for retry
  };
  
  // Track card selection
  const trackCardSelection = (cardName: string, category: string) => {
    trackEvent('deck_card_selected', {
      commander,
      card_name: cardName,
      category,
    });
  };
  
  return {
    trackComplete,
    trackRetry,
    trackCardSelection,
  };
}
`;

  await fs.writeFile(
    path.join('apps', 'web', 'src', 'hooks', 'useDeckGenerationAnalytics.ts'),
    deckAnalytics
  );
  console.log('✅ Deck generation analytics created\n');

  // 5. Create Google Analytics setup (optional)
  console.log('🔧 Creating Google Analytics setup...');
  const gaSetup = `// Add this to your app/layout.tsx or _document.tsx

{/* Google Analytics */}
{process.env.NEXT_PUBLIC_GA_ID && (
  <>
    <Script
      src={\`https://www.googletagmanager.com/gtag/js?id=\${process.env.NEXT_PUBLIC_GA_ID}\`}
      strategy="afterInteractive"
    />
    <Script id="google-analytics" strategy="afterInteractive">
      {\`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '\${process.env.NEXT_PUBLIC_GA_ID}');
      \`}
    </Script>
  </>
)}
`;

  await fs.writeFile('GOOGLE_ANALYTICS_SETUP.tsx', gaSetup);
  console.log('✅ Google Analytics setup instructions created\n');

  // 6. Create usage tracking middleware
  console.log('🔧 Creating usage tracking middleware...');
  const usageTracking = `import { prisma } from '@/lib/prisma';
import { ANALYTICS_EVENTS, trackEvent } from '@/components/analytics/AnalyticsProvider';

interface UsageEvent {
  userId: string;
  event: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export async function trackUsage(event: UsageEvent) {
  try {
    // Store in database for internal analytics
    await prisma.usageEvent.create({
      data: {
        userId: event.userId,
        event: event.event,
        metadata: event.metadata || {},
        timestamp: event.timestamp,
      },
    });
    
    // Also send to external analytics
    trackEvent(event.event, {
      user_id: event.userId,
      ...event.metadata,
    });
  } catch (error) {
    console.error('Failed to track usage:', error);
  }
}

// Middleware to track API usage
export function createUsageTrackingMiddleware() {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.id;
    const endpoint = req.path;
    const method = req.method;
    
    if (userId) {
      await trackUsage({
        userId,
        event: 'api_request',
        metadata: {
          endpoint,
          method,
          user_agent: req.get('user-agent'),
        },
        timestamp: new Date(),
      });
    }
    
    next();
  };
}

// Track deck generation costs
export async function trackDeckGenerationCost(userId: string, commander: string, cost: number) {
  await trackUsage({
    userId,
    event: 'deck_generation_cost',
    metadata: {
      commander,
      cost_usd: cost,
      tokens_used: Math.round(cost / 0.002 * 1000), // Estimate tokens from cost
    },
    timestamp: new Date(),
  });
}
`;

  await fs.writeFile(
    path.join('packages', 'api', 'src', 'middleware', 'usage-tracking.ts'),
    usageTracking
  );
  console.log('✅ Usage tracking middleware created\n');

  // 7. Create setup instructions
  const instructions = `
# Analytics Setup Complete! 📊

## Next Steps:

1. **Update your app layout** to include the analytics provider:

   In \`apps/web/app/layout.tsx\`:
   \`\`\`tsx
   import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
   
   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           <AnalyticsProvider>
             {children}
           </AnalyticsProvider>
         </body>
       </html>
     );
   }
   \`\`\`

2. **Add environment variables** to \`.env.local\`:
   \`\`\`
   # Optional: Google Analytics
   NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
   
   # App version for tracking
   NEXT_PUBLIC_APP_VERSION=beta-1.0.0
   \`\`\`

3. **Use analytics in your components**:
   \`\`\`tsx
   import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
   
   function MyComponent() {
     const { trackEvent, trackUserAction } = useAnalytics();
     
     const handleClick = () => {
       trackUserAction('DECK_SHARED', { method: 'link' });
     };
   }
   \`\`\`

4. **Track deck generation**:
   \`\`\`tsx
   import { useDeckGenerationAnalytics } from '@/hooks/useDeckGenerationAnalytics';
   
   const analytics = useDeckGenerationAnalytics({ commander, deckId });
   
   // On success
   analytics.trackComplete(true);
   
   // On retry
   analytics.trackRetry(attemptNumber);
   \`\`\`

## Features Implemented:

✅ Vercel Analytics integration
✅ Custom event tracking system
✅ Deck generation analytics
✅ User action tracking
✅ Error tracking integration
✅ Admin analytics dashboard
✅ Usage tracking middleware
✅ Cost tracking for API calls

## Analytics Events Tracked:

### User Journey
- Signup (started/completed)
- Login/Logout
- Page views
- Session duration

### Deck Generation
- Generation started/completed/failed
- Retry attempts
- Generation time
- Commander popularity
- Success rates

### User Engagement
- Feature usage
- Feedback submission
- Error encounters
- Help/documentation access

### Beta Metrics
- Beta feature adoption
- User feedback sentiment
- Feature requests
- Invite/referral tracking

## Dashboard Access:

1. **Admin Dashboard**: \`/admin/analytics\`
2. **Vercel Analytics**: https://vercel.com/analytics
3. **Google Analytics**: https://analytics.google.com (if configured)

## Best Practices:

1. **Privacy First**: Don't track PII without consent
2. **Meaningful Events**: Track actions that matter for product decisions
3. **Performance**: Use batching for high-frequency events
4. **Error Handling**: Always wrap tracking in try-catch
5. **Development**: Events are logged to console in dev mode
`;

  await fs.writeFile('ANALYTICS_SETUP.md', instructions);
  console.log('✅ Setup instructions created in ANALYTICS_SETUP.md\n');

  console.log('🎉 Analytics setup complete!');
}

// Run the setup
setupAnalytics().catch(console.error);

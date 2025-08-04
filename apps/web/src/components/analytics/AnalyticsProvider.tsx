'use client';

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

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (
      command: string,
      event: string,
      parameters?: Record<string, any>
    ) => void;
  }
}

// Track custom events
export function trackEvent(
  event: AnalyticsEvent | string,
  properties?: Record<string, any>
) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event, {
      ...properties,
      timestamp: new Date().toISOString(),
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

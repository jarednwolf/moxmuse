#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function setupErrorTracking() {
  console.log('🐛 Setting up Error Tracking with Sentry...\n');

  // 1. Install Sentry packages
  console.log('📦 Installing Sentry packages...');
  try {
    execSync('pnpm add @sentry/nextjs @sentry/trpc', { stdio: 'inherit' });
    console.log('✅ Sentry packages installed\n');
  } catch (error) {
    console.log('⚠️  Sentry packages may already be installed\n');
  }

  // 2. Create Sentry configuration files
  console.log('🔧 Creating Sentry configuration...');
  
  // sentry.client.config.ts
  const sentryClientConfig = `import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  
  replaysOnErrorSampleRate: 1.0,
  
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,
  
  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    new Sentry.Replay({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  // Filter out common errors
  beforeSend(event, hint) {
    // Filter out known non-critical errors
    const error = hint.originalException;
    
    // Don't send cancelled requests
    if (error?.name === 'AbortError') {
      return null;
    }
    
    // Don't send network errors in development
    if (process.env.NODE_ENV === 'development' && error?.name === 'NetworkError') {
      return null;
    }
    
    return event;
  },
});
`;

  await fs.writeFile(
    path.join('apps', 'web', 'sentry.client.config.ts'),
    sentryClientConfig
  );
  console.log('✅ Client Sentry config created\n');

  // sentry.server.config.ts
  const sentryServerConfig = `import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  
  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: process.env.NODE_ENV === 'development',
  
  beforeSend(event, hint) {
    // Add user context if available
    if (event.user?.id) {
      event.user = {
        ...event.user,
        // Don't send email addresses to Sentry
        email: undefined,
      };
    }
    
    return event;
  },
});
`;

  await fs.writeFile(
    path.join('apps', 'web', 'sentry.server.config.ts'),
    sentryServerConfig
  );
  console.log('✅ Server Sentry config created\n');

  // sentry.edge.config.ts
  const sentryEdgeConfig = `import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
`;

  await fs.writeFile(
    path.join('apps', 'web', 'sentry.edge.config.ts'),
    sentryEdgeConfig
  );
  console.log('✅ Edge Sentry config created\n');

  // 3. Create error boundary component
  console.log('🛡️  Creating error boundary component...');
  const errorBoundary = `'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h2 className="mb-4 text-2xl font-bold">Something went wrong!</h2>
        <p className="mb-4 text-gray-600">
          We've been notified about this error and are working to fix it.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500">
              Error details (development only)
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
        <div className="flex gap-4 justify-center">
          <Button onClick={() => window.location.href = '/'}>
            Go Home
          </Button>
          <Button onClick={reset} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
`;

  await fs.writeFile(
    path.join('apps', 'web', 'app', 'error-boundary.tsx'),
    errorBoundary
  );
  console.log('✅ Error boundary component created\n');

  // 4. Create error reporting hook
  console.log('🪝 Creating error reporting hook...');
  const errorHook = `import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

interface ErrorInfo {
  message: string;
  context?: Record<string, any>;
  level?: 'info' | 'warning' | 'error' | 'fatal';
}

export function useErrorReporting() {
  const reportError = (error: Error | ErrorInfo, additionalContext?: Record<string, any>) => {
    if (error instanceof Error) {
      Sentry.captureException(error, {
        extra: additionalContext,
      });
    } else {
      Sentry.captureMessage(error.message, {
        level: error.level || 'error',
        extra: {
          ...error.context,
          ...additionalContext,
        },
      });
    }
  };

  const reportUserFeedback = (message: string, email?: string, name?: string) => {
    const user = Sentry.getCurrentHub().getScope()?.getUser();
    const eventId = Sentry.captureMessage(message, 'info');
    
    if (user?.id || email) {
      Sentry.captureUserFeedback({
        event_id: eventId,
        email: email || user?.email || 'unknown',
        name: name || user?.username || 'Anonymous',
        comments: message,
      });
    }
  };

  const setUserContext = (userId: string, username?: string, email?: string) => {
    Sentry.setUser({
      id: userId,
      username,
      email,
    });
  };

  const addBreadcrumb = (message: string, category: string, data?: Record<string, any>) => {
    Sentry.addBreadcrumb({
      message,
      category,
      level: 'info',
      data,
      timestamp: Date.now() / 1000,
    });
  };

  return {
    reportError,
    reportUserFeedback,
    setUserContext,
    addBreadcrumb,
  };
}

// Error monitoring for API calls
export function withErrorMonitoring<T extends (...args: any[]) => any>(
  fn: T,
  context: { name: string; [key: string]: any }
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      
      // Track successful API calls
      Sentry.addBreadcrumb({
        message: \`API call: \${context.name}\`,
        category: 'api',
        level: 'info',
        data: {
          ...context,
          duration: Date.now() - startTime,
          success: true,
        },
      });
      
      return result;
    } catch (error) {
      // Track failed API calls
      Sentry.addBreadcrumb({
        message: \`API call failed: \${context.name}\`,
        category: 'api',
        level: 'error',
        data: {
          ...context,
          duration: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      
      Sentry.captureException(error, {
        extra: {
          apiCall: context.name,
          ...context,
        },
      });
      
      throw error;
    }
  }) as T;
}
`;

  await fs.mkdir(path.join('apps', 'web', 'src', 'hooks'), { recursive: true });
  await fs.writeFile(
    path.join('apps', 'web', 'src', 'hooks', 'useErrorReporting.ts'),
    errorHook
  );
  console.log('✅ Error reporting hook created\n');

  // 5. Create monitoring dashboard component
  console.log('📊 Creating monitoring dashboard...');
  const monitoringDashboard = `import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';

interface ErrorStats {
  total: number;
  lastHour: number;
  lastDay: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastSeen: Date;
  }>;
}

export function ErrorMonitoringDashboard() {
  const [stats, setStats] = useState<ErrorStats>({
    total: 0,
    lastHour: 0,
    lastDay: 0,
    topErrors: [],
  });

  useEffect(() => {
    // In production, this would fetch from your backend
    // For now, we'll use local storage to track errors
    const errors = JSON.parse(localStorage.getItem('error_stats') || '[]');
    
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;
    
    const errorCounts = new Map<string, { count: number; lastSeen: Date }>();
    let lastHour = 0;
    let lastDay = 0;
    
    errors.forEach((error: any) => {
      const timestamp = new Date(error.timestamp).getTime();
      
      if (timestamp > dayAgo) {
        lastDay++;
        if (timestamp > hourAgo) {
          lastHour++;
        }
      }
      
      const existing = errorCounts.get(error.message) || { count: 0, lastSeen: new Date(0) };
      errorCounts.set(error.message, {
        count: existing.count + 1,
        lastSeen: new Date(Math.max(existing.lastSeen.getTime(), timestamp)),
      });
    });
    
    const topErrors = Array.from(errorCounts.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    setStats({
      total: errors.length,
      lastHour,
      lastDay,
      topErrors,
    });
  }, []);

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Error Monitoring</h2>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-100 p-4 rounded">
          <div className="text-3xl font-bold">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Errors</div>
        </div>
        
        <div className="bg-yellow-100 p-4 rounded">
          <div className="text-3xl font-bold">{stats.lastHour}</div>
          <div className="text-sm text-gray-600">Last Hour</div>
        </div>
        
        <div className="bg-orange-100 p-4 rounded">
          <div className="text-3xl font-bold">{stats.lastDay}</div>
          <div className="text-sm text-gray-600">Last 24 Hours</div>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-2">Top Errors</h3>
        <div className="space-y-2">
          {stats.topErrors.map((error, index) => (
            <div key={index} className="border p-3 rounded">
              <div className="flex justify-between">
                <span className="font-medium">{error.message}</span>
                <span className="text-sm text-gray-600">{error.count} times</span>
              </div>
              <div className="text-xs text-gray-500">
                Last seen: {error.lastSeen.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <a 
          href={process.env.NEXT_PUBLIC_SENTRY_ORG ? 
            \`https://\${process.env.NEXT_PUBLIC_SENTRY_ORG}.sentry.io\` : 
            'https://sentry.io'
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          View in Sentry →
        </a>
      </div>
    </div>
  );
}
`;

  await fs.mkdir(path.join('apps', 'web', 'app', 'monitoring'), { recursive: true });
  await fs.writeFile(
    path.join('apps', 'web', 'app', 'monitoring', 'ErrorMonitoringDashboard.tsx'),
    monitoringDashboard
  );
  console.log('✅ Monitoring dashboard created\n');

  // 6. Update next.config.js with Sentry
  console.log('🔧 Creating Sentry Next.js configuration update script...');
  const nextConfigUpdate = `// Add this to your next.config.js

const { withSentryConfig } = require('@sentry/nextjs');

// Your existing module.exports
const moduleExports = {
  // ... your existing config
};

const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
};

// Make sure adding Sentry options is the last code to run before exporting, to
// ensure that your source maps include changes from all other Webpack plugins
module.exports = withSentryConfig(moduleExports, sentryWebpackPluginOptions);
`;

  await fs.writeFile('SENTRY_NEXTCONFIG_UPDATE.js', nextConfigUpdate);
  console.log('✅ Next.js config update instructions created\n');

  // 7. Create setup instructions
  const instructions = `
# Sentry Error Tracking Setup Complete! 🎉

## Next Steps:

1. **Create a Sentry account** (if you don't have one):
   - Go to https://sentry.io/signup/
   - Create a new project for MoxMuse

2. **Get your Sentry DSN**:
   - In Sentry dashboard, go to Settings → Projects → [Your Project] → Client Keys
   - Copy the DSN

3. **Add environment variables** to \`.env.local\`:
   \`\`\`
   NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
   SENTRY_ORG=your-org-slug
   SENTRY_PROJECT=moxmuse
   SENTRY_AUTH_TOKEN=your_auth_token
   NEXT_PUBLIC_SENTRY_ORG=your-org-slug
   \`\`\`

4. **Update next.config.js**:
   - See SENTRY_NEXTCONFIG_UPDATE.js for the code to add

5. **Test error reporting**:
   \`\`\`bash
   # In your app, trigger a test error:
   throw new Error('Test Sentry Error');
   \`\`\`

6. **Set up alerts** in Sentry dashboard:
   - Configure email alerts for new errors
   - Set up Slack integration if using Slack
   - Configure alert rules for error rate spikes

## Features Implemented:

✅ Client-side error tracking
✅ Server-side error tracking
✅ Edge runtime error tracking
✅ Error boundary component
✅ Custom error reporting hook
✅ Error monitoring dashboard
✅ User feedback capture
✅ Performance monitoring
✅ Session replay (for errors)

## Usage Examples:

### Using the error reporting hook:
\`\`\`tsx
import { useErrorReporting } from '@/hooks/useErrorReporting';

function MyComponent() {
  const { reportError, addBreadcrumb, setUserContext } = useErrorReporting();
  
  // Set user context when user logs in
  useEffect(() => {
    if (user) {
      setUserContext(user.id, user.username, user.email);
    }
  }, [user]);
  
  // Report errors
  try {
    // your code
  } catch (error) {
    reportError(error, { component: 'MyComponent' });
  }
  
  // Add breadcrumbs for debugging
  addBreadcrumb('User clicked generate deck', 'user-action', { deckType: 'commander' });
}
\`\`\`

### Monitoring API calls:
\`\`\`tsx
import { withErrorMonitoring } from '@/hooks/useErrorReporting';

const generateDeck = withErrorMonitoring(
  async (commander: string) => {
    // your API call
  },
  { name: 'generateDeck', endpoint: '/api/tutor/generateDeck' }
);
\`\`\`

## Production Checklist:

- [ ] Set up source maps upload for better error debugging
- [ ] Configure user privacy settings (PII scrubbing)
- [ ] Set up release tracking
- [ ] Configure performance monitoring thresholds
- [ ] Set up custom dashboards for key metrics
- [ ] Configure data retention policies
`;

  await fs.writeFile('ERROR_TRACKING_SETUP.md', instructions);
  console.log('✅ Setup instructions created in ERROR_TRACKING_SETUP.md\n');

  console.log('🎉 Error tracking setup complete!');
}

// Run the setup
setupErrorTracking().catch(console.error);

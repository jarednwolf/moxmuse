
# Sentry Error Tracking Setup Complete! 🎉

## Next Steps:

1. **Create a Sentry account** (if you don't have one):
   - Go to https://sentry.io/signup/
   - Create a new project for MoxMuse

2. **Get your Sentry DSN**:
   - In Sentry dashboard, go to Settings → Projects → [Your Project] → Client Keys
   - Copy the DSN

3. **Add environment variables** to `.env.local`:
   ```
   NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
   SENTRY_ORG=your-org-slug
   SENTRY_PROJECT=moxmuse
   SENTRY_AUTH_TOKEN=your_auth_token
   NEXT_PUBLIC_SENTRY_ORG=your-org-slug
   ```

4. **Update next.config.js**:
   - See SENTRY_NEXTCONFIG_UPDATE.js for the code to add

5. **Test error reporting**:
   ```bash
   # In your app, trigger a test error:
   throw new Error('Test Sentry Error');
   ```

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
```tsx
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
```

### Monitoring API calls:
```tsx
import { withErrorMonitoring } from '@/hooks/useErrorReporting';

const generateDeck = withErrorMonitoring(
  async (commander: string) => {
    // your API call
  },
  { name: 'generateDeck', endpoint: '/api/tutor/generateDeck' }
);
```

## Production Checklist:

- [ ] Set up source maps upload for better error debugging
- [ ] Configure user privacy settings (PII scrubbing)
- [ ] Set up release tracking
- [ ] Configure performance monitoring thresholds
- [ ] Set up custom dashboards for key metrics
- [ ] Configure data retention policies

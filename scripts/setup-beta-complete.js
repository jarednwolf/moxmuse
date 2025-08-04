#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function runSetupScript(scriptName, description) {
  console.log(`\n🔧 ${description}...`);
  try {
    execSync(`node scripts/${scriptName}`, { stdio: 'inherit' });
    console.log(`✅ ${description} complete!\n`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to run ${scriptName}:`, error.message);
    return false;
  }
}

async function setupBetaComplete() {
  console.log(`
🚀 MoxMuse Beta Launch Automation Suite
======================================

This script will run all setup scripts to prepare your project for beta launch.
It automates Days 1-3 of your launch checklist!

`);

  const setupTasks = [
    {
      script: 'setup-supabase.js',
      description: 'Supabase database setup',
      required: true,
    },
    {
      script: 'setup-api-security.js',
      description: 'API security (rate limiting, CORS, logging)',
      required: true,
    },
    {
      script: 'setup-error-tracking.js',
      description: 'Sentry error tracking',
      required: true,
    },
    {
      script: 'setup-analytics.js',
      description: 'Analytics and monitoring',
      required: true,
    },
    {
      script: 'setup-beta-features.js',
      description: 'Beta features (feedback, badges, status page)',
      required: true,
    },
  ];

  let successCount = 0;
  const results = [];

  for (const task of setupTasks) {
    const success = await runSetupScript(task.script, task.description);
    results.push({ ...task, success });
    if (success) successCount++;
  }

  // Create comprehensive setup summary
  const summaryContent = `# MoxMuse Beta Setup Summary

## Setup Results (${successCount}/${setupTasks.length} completed)

${results.map(r => `- [${r.success ? 'x' : ' '}] ${r.description}`).join('\n')}

## Quick Start Commands

### 1. Install Dependencies
\`\`\`bash
pnpm install
\`\`\`

### 2. Set Up Database
\`\`\`bash
cd packages/db && pnpm prisma db push
\`\`\`

### 3. Start Development
\`\`\`bash
pnpm dev
\`\`\`

### 4. Deploy to Vercel
\`\`\`bash
vercel --prod
\`\`\`

## Environment Variables Checklist

Add these to your \`.env.local\`:

\`\`\`env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# Sentry (optional but recommended)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_ORG=your-org
SENTRY_PROJECT=moxmuse
SENTRY_AUTH_TOKEN=your_auth_token

# Analytics (optional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Beta Features
NEXT_PUBLIC_APP_VERSION=beta-1.0.0
FEEDBACK_WEBHOOK_URL=your_discord_webhook

# Security
RATE_LIMIT_ENABLED=true
API_KEY_REQUIRED=false
\`\`\`

## Created Files & Features

### 🔒 Security
- Rate limiting middleware
- API key validation
- CORS configuration
- Request logging
- Usage tracking

### 🐛 Error Tracking
- Sentry client/server/edge configs
- Error boundary component
- Error reporting hooks
- Monitoring dashboard

### 📊 Analytics
- Vercel Analytics integration
- Custom event tracking
- Deck generation analytics
- Admin dashboard
- Usage metrics

### 🚀 Beta Features
- Beta badge component
- Feedback widget
- Admin feedback view
- Known issues page
- Discord webhook integration

## Next Manual Steps

### Day 1 Remaining Tasks:
- [ ] Purchase domain (moxmuse.com)
- [ ] Configure DNS in Vercel
- [ ] Enable HTTPS
- [ ] Test domain resolution

### Day 2 Tasks:
- [ ] Create Sentry account
- [ ] Set up Sentry alerts
- [ ] Enable Vercel Analytics
- [ ] Configure cost alerts

### Day 3 Tasks:
- [ ] Test all beta features
- [ ] Verify error tracking
- [ ] Check analytics data
- [ ] Review security setup

## Admin Routes Created

- \`/admin/analytics\` - Analytics dashboard
- \`/admin/feedback\` - Manage user feedback
- \`/beta/status\` - Known issues & roadmap
- \`/monitoring\` - Error monitoring

## Testing Your Setup

### 1. Test API Security
\`\`\`bash
# Should be rate limited after 100 requests
for i in {1..101}; do curl http://localhost:3000/api/health; done
\`\`\`

### 2. Test Error Tracking
\`\`\`javascript
// Add to any component
throw new Error('Test Sentry Error');
\`\`\`

### 3. Test Analytics
\`\`\`javascript
// Events are auto-logged in console during dev
// Check browser console for [Analytics Event] logs
\`\`\`

### 4. Test Feedback
- Click feedback button (bottom right)
- Submit test feedback
- Check \`/admin/feedback\` to view

## Launch Timeline Automation

✅ **Day 1-3**: Infrastructure & monitoring (AUTOMATED)
⏳ **Day 4-7**: Auth & core features (manual)
⏳ **Day 8-10**: Beta management (manual)
⏳ **Day 11-14**: Polish & launch (manual)

## Support & Resources

- **Docs**: Check individual setup files (API_SECURITY_SETUP.md, etc.)
- **Issues**: Use the feedback widget to report problems
- **Updates**: Watch /beta/status for latest info

---

🎉 Your beta infrastructure is ready! Good luck with your launch!
`;

  await fs.writeFile('BETA_SETUP_COMPLETE.md', summaryContent);
  
  console.log(`
========================================
✅ Beta Setup Automation Complete!
========================================

${successCount}/${setupTasks.length} setup tasks completed successfully.

📄 Check BETA_SETUP_COMPLETE.md for:
   - Environment variables checklist
   - Next manual steps
   - Testing instructions
   - Admin routes

🚀 You've automated Days 1-3 of your beta launch!

Next steps:
1. Review and add environment variables
2. Push database schema: cd packages/db && pnpm prisma db push
3. Deploy to Vercel: vercel --prod
4. Start testing your beta features!

Good luck with your launch! 🎉
`);
}

// Run the complete setup
setupBetaComplete().catch(console.error);

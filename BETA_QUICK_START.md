# MoxMuse Beta Quick Start Guide

## 🚀 Start Here - Day 1 Tasks

### 1. Set Up Supabase (30 minutes)

1. **Create Supabase Account**
   - Go to [supabase.com](https://supabase.com)
   - Sign up with GitHub for easier integration
   
2. **Create New Project**
   - Project name: `moxmuse-beta`
   - Generate a strong database password
   - Select region closest to your users (e.g., US West)
   - Wait ~2 minutes for provisioning

3. **Run Setup Script**
   ```bash
   node scripts/setup-supabase.js
   ```
   - Have your Supabase project details ready
   - The script will create your .env.local file

4. **Push Database Schema**
   ```bash
   cd packages/db
   pnpm prisma db push
   ```

5. **Apply RLS Policies**
   - Go to Supabase Dashboard → SQL Editor
   - Copy content from `packages/db/supabase-rls-policies.sql`
   - Run the SQL query

### 2. Update Environment Variables (10 minutes)

Edit your `.env.local` file:

```bash
# Generate a new secret
openssl rand -base64 32
```

Update these values:
- `NEXTAUTH_SECRET` - Use the generated secret above
- `OPENAI_API_KEY` - Your OpenAI API key
- `NEXTAUTH_URL` - Keep as http://localhost:3000 for now

### 3. Test Local Setup (10 minutes)

```bash
# Install dependencies
pnpm install

# Generate Prisma client
cd packages/db
pnpm prisma generate
cd ../..

# Start development server
pnpm dev
```

Visit http://localhost:3000 and verify:
- [ ] Homepage loads
- [ ] Can navigate to /tutor
- [ ] No console errors

### 4. Set Up Vercel (20 minutes)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**
   ```bash
   vercel
   ```
   - Follow prompts to link your project
   - Choose your project settings
   - Let it deploy to preview

3. **Configure Environment Variables**
   - Go to Vercel Dashboard
   - Select your project
   - Go to Settings → Environment Variables
   - Add all variables from .env.local
   - For `NEXTAUTH_URL`, use your Vercel preview URL

### 5. Quick Validation (10 minutes)

Test your Vercel deployment:
1. Visit your preview URL
2. Navigate to /tutor
3. Try generating a test deck
4. Check Vercel Functions logs for any errors

## 🎯 Next Immediate Actions

### Tomorrow (Day 2):
1. Purchase domain (moxmuse.com or alternative)
2. Set up basic monitoring (Sentry)
3. Implement rate limiting
4. Add beta badge to UI

### This Week:
1. Complete Supabase Auth integration
2. Connect deck generation to user accounts
3. Add basic deck management (save/view)
4. Set up feedback widget

## 🆘 Troubleshooting

### Common Issues:

**Database connection failed:**
- Check DATABASE_URL format
- Ensure Supabase project is active
- Verify password is correct

**Prisma errors:**
- Run `pnpm prisma generate` in packages/db
- Check schema.prisma datasource config

**Vercel deployment fails:**
- Check all env variables are set
- Look at Function logs for errors
- Ensure build command is correct

**OpenAI errors:**
- Verify API key is valid
- Check you have credits
- Monitor rate limits

## 📞 Quick Resources

- **Supabase Dashboard**: [app.supabase.com](https://app.supabase.com)
- **Vercel Dashboard**: [vercel.com/dashboard](https://vercel.com/dashboard)
- **Project Checklist**: See `BETA_LAUNCH_CHECKLIST.md`
- **Full Migration Guide**: See `SUPABASE_MIGRATION_GUIDE.md`

## ✅ Day 1 Success Criteria

By end of Day 1, you should have:
- [ ] Supabase project created and configured
- [ ] Database schema pushed
- [ ] Local development working
- [ ] Vercel preview deployment live
- [ ] Can generate decks on deployed version

---

**Remember**: Focus on getting the core infrastructure working today. Polish and features come later!

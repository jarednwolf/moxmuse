# Environment Variable Setup Instructions

## 🔐 Update Your .env.local File

The `.env.local` file has been created at `apps/web/.env.local` with the following structure:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/moxmuse

# Redis
REDIS_URL=redis://localhost:6379

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=Kun40uTafxXHhckHcGSvm9xplU/Yi+91Egq+bPru29Y=

# OpenAI
OPENAI_API_KEY=

# Moxfield OAuth (when ready to implement)
MOXFIELD_CLIENT_ID=
MOXFIELD_CLIENT_SECRET=

# Affiliate IDs (when ready to implement)
TCGPLAYER_AFFILIATE_ID=demo-affiliate-id
CARDKINGDOM_AFFILIATE_ID=demo-affiliate-id
```

## ✏️ Required Updates

Please update the following values in `apps/web/.env.local`:

1. **OPENAI_API_KEY**: Add your OpenAI API key (you mentioned you have this)
2. **MOXFIELD_CLIENT_ID**: Add your Moxfield OAuth client ID (you mentioned you have this)
3. **MOXFIELD_CLIENT_SECRET**: Add your Moxfield OAuth client secret (you mentioned you have this)

## 🚀 Next Steps

After updating the environment variables:

1. **Restart the development server** (Ctrl+C and run `pnpm dev` again)
2. The NextAuth errors should be resolved
3. You can test TolarianTutor with your OpenAI API key
4. Moxfield OAuth will be ready when we implement it

## 🔒 Security Note

The `NEXTAUTH_SECRET` has been generated securely. Never commit the `.env.local` file to version control! 
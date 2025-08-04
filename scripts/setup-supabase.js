#!/usr/bin/env node

/**
 * Supabase Setup Helper Script
 * This script helps you set up Supabase for MoxMuse beta launch
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupSupabase() {
  console.log('🚀 MoxMuse Supabase Setup Helper\n');
  
  console.log('📋 Before we begin, make sure you have:');
  console.log('   1. Created a Supabase account at https://supabase.com');
  console.log('   2. Created a new Supabase project');
  console.log('   3. Have your project details ready\n');
  
  const proceed = await question('Ready to continue? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('Setup cancelled.');
    process.exit(0);
  }

  console.log('\n📝 Please enter your Supabase project details:\n');

  // Collect Supabase details
  const projectRef = await question('Supabase Project Reference ID (e.g., abcdefghijklmnop): ');
  const supabaseUrl = `https://${projectRef}.supabase.co`;
  
  const anonKey = await question('Supabase Anon/Public Key: ');
  const serviceKey = await question('Supabase Service Role Key: ');
  const dbPassword = await question('Database Password: ');
  
  // Construct database URLs
  const dbHost = `db.${projectRef}.supabase.co`;
  const databaseUrl = `postgresql://postgres:${dbPassword}@${dbHost}:6543/postgres?pgbouncer=true`;
  const directUrl = `postgresql://postgres:${dbPassword}@${dbHost}:5432/postgres`;

  console.log('\n🔧 Generating environment configuration...\n');

  // Create .env.local content
  const envContent = `# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="${supabaseUrl}"
NEXT_PUBLIC_SUPABASE_ANON_KEY="${anonKey}"
SUPABASE_SERVICE_ROLE_KEY="${serviceKey}"

# Database URLs
DATABASE_URL="${databaseUrl}"
DATABASE_DIRECT_URL="${directUrl}"

# Existing Configuration (update these as needed)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-here"
OPENAI_API_KEY="your-openai-key-here"

# Beta Configuration
NEXT_PUBLIC_BETA_MODE="true"
NEXT_PUBLIC_FEEDBACK_ENABLED="true"
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_DAILY_DECKS="10"
`;

  // Write to .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env.local with Supabase configuration');

  // Create SQL migration file for RLS policies
  const rlsSQL = `-- Enable Row Level Security for all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Card" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CardInDeck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Collection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CollectedCard" ENABLE ROW LEVEL SECURITY;

-- User policies
CREATE POLICY "Users can view own profile" ON "User"
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile" ON "User"
  FOR UPDATE USING (auth.uid()::text = id);

-- Deck policies
CREATE POLICY "Users can view own decks" ON "Deck"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can create decks" ON "Deck"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update own decks" ON "Deck"
  FOR UPDATE USING (auth.uid()::text = "userId");

CREATE POLICY "Users can delete own decks" ON "Deck"
  FOR DELETE USING (auth.uid()::text = "userId");

CREATE POLICY "Public decks are viewable" ON "Deck"
  FOR SELECT USING ("isPublic" = true);

-- Collection policies
CREATE POLICY "Users can view own collection" ON "Collection"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can manage own collection" ON "Collection"
  FOR ALL USING (auth.uid()::text = "userId");

-- Card policies (cards are public data)
CREATE POLICY "Cards are viewable by all" ON "Card"
  FOR SELECT USING (true);

-- CardInDeck policies (inherit from deck permissions)
CREATE POLICY "Users can view cards in accessible decks" ON "CardInDeck"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Deck" 
      WHERE "Deck".id = "CardInDeck"."deckId" 
      AND ("Deck"."userId" = auth.uid()::text OR "Deck"."isPublic" = true)
    )
  );

CREATE POLICY "Users can manage cards in own decks" ON "CardInDeck"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Deck" 
      WHERE "Deck".id = "CardInDeck"."deckId" 
      AND "Deck"."userId" = auth.uid()::text
    )
  );
`;

  const rlsPath = path.join(process.cwd(), 'packages', 'db', 'supabase-rls-policies.sql');
  fs.writeFileSync(rlsPath, rlsSQL);
  console.log('✅ Created RLS policies SQL file');

  console.log('\n📋 Next steps:');
  console.log('1. Run database migration:');
  console.log('   cd packages/db');
  console.log('   pnpm prisma db push');
  console.log('');
  console.log('2. Apply RLS policies:');
  console.log('   - Go to Supabase Dashboard > SQL Editor');
  console.log('   - Run the SQL from packages/db/supabase-rls-policies.sql');
  console.log('');
  console.log('3. Configure Auth:');
  console.log('   - Go to Authentication > Providers');
  console.log('   - Enable Email provider');
  console.log('   - Set Site URL to your domain');
  console.log('');
  console.log('4. Update your .env.local with:');
  console.log('   - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)');
  console.log('   - OPENAI_API_KEY');
  console.log('   - Production NEXTAUTH_URL when deploying');
  
  rl.close();
}

setupSupabase().catch(console.error);

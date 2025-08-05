#!/usr/bin/env node

// Script to set up Vercel environment variables
const { execSync } = require('child_process');

const NEXTAUTH_SECRET = 'PqEPHBniSA53v7VfipvNr8LqJJWX9NXXAMYJp8QIcI=';

// Environment variables to set
const envVars = {
  // NextAuth Configuration
  NEXTAUTH_URL: 'https://moxmuse.vercel.app',
  NEXTAUTH_SECRET: NEXTAUTH_SECRET,

  // Supabase Configuration  
  NEXT_PUBLIC_SUPABASE_URL: 'https://ftunwdctnjahwxaqfqwi.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dW53ZGN0bmphaHd4YXFmcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjYzMTcsImV4cCI6MjA2OTg0MjMxN30.9XkpWRf3E7iTWFfKLwqGwqRBGn-6_FTDrzf7WsBSmzo',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dW53ZGN0bmphaHd4YXFmcXdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI2NjMxNywiZXhwIjoyMDY5ODQyMzE3fQ.kVtxfYcMI1J-bLhBSlrwDTWGUMvF_HXcMhykAvBBGVM',
  SUPABASE_URL: 'https://ftunwdctnjahwxaqfqwi.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dW53ZGN0bmphaHd4YXFmcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjYzMTcsImV4cCI6MjA2OTg0MjMxN30.9XkpWRf3E7iTWFfKLwqGwqRBGn-6_FTDrzf7WsBSmzo',

  // Database URLs
  DATABASE_URL: 'postgresql://postgres:a*728Isely@db.ftunwdctnjahwxaqfqwi.supabase.co:6543/postgres?pgbouncer=true',
  DATABASE_DIRECT_URL: 'postgresql://postgres:a*728Isely@db.ftunwdctnjahwxaqfqwi.supabase.co:5432/postgres',

  // Beta Configuration
  NEXT_PUBLIC_BETA_MODE: 'true',
  NEXT_PUBLIC_FEEDBACK_ENABLED: 'true',
  RATE_LIMIT_ENABLED: 'true',
  RATE_LIMIT_DAILY_DECKS: '10',
  NEXT_PUBLIC_APP_VERSION: 'beta-1.0.0',

  // You'll need to add this one manually or provide it
  // OPENAI_API_KEY: 'your-openai-api-key-here'
};

console.log('🔧 Setting up Vercel environment variables...\n');

// Check if user is logged in to Vercel CLI
try {
  execSync('vercel whoami', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ You need to be logged in to Vercel CLI');
  console.log('   Run: vercel login');
  process.exit(1);
}

// Function to set environment variable
function setEnvVar(key, value, environment = 'production preview development') {
  try {
    const command = `vercel env add ${key} ${environment}`;
    
    // Create a temporary file with the value to avoid shell escaping issues
    const fs = require('fs');
    const tmpFile = `/tmp/vercel-env-${Date.now()}.txt`;
    fs.writeFileSync(tmpFile, value);
    
    execSync(`${command} < ${tmpFile}`, { stdio: 'ignore' });
    fs.unlinkSync(tmpFile);
    
    console.log(`✅ Set ${key}`);
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`⚠️  ${key} already exists (skipping)`);
    } else {
      console.error(`❌ Failed to set ${key}: ${error.message}`);
    }
  }
}

// Set all environment variables
Object.entries(envVars).forEach(([key, value]) => {
  setEnvVar(key, value);
});

console.log('\n🎉 Environment variables setup complete!');
console.log('\n⚠️  IMPORTANT: You still need to add your OPENAI_API_KEY:');
console.log('   Run: vercel env add OPENAI_API_KEY production preview development');
console.log('   Then paste your OpenAI API key when prompted\n');

console.log('📝 Next steps:');
console.log('1. Add your OPENAI_API_KEY as shown above');
console.log('2. Redeploy your project: vercel --prod');
console.log('3. Visit your app at https://moxmuse.vercel.app\n');

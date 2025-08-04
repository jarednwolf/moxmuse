#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

console.log('🔑 Generating environment variables for MoxMuse...\n');

// Generate NEXTAUTH_SECRET
const nextAuthSecret = crypto.randomBytes(32).toString('base64');
console.log('Generated NEXTAUTH_SECRET:', nextAuthSecret);

// Set app version
const appVersion = 'beta-1.0.0';
console.log('Set NEXT_PUBLIC_APP_VERSION:', appVersion);

// Path to .env.local
const envPath = path.join(process.cwd(), '.env.local');

// Read existing .env.local
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (error) {
  console.log('Creating new .env.local file...');
}

// Check if variables already exist
const hasNextAuthSecret = envContent.includes('NEXTAUTH_SECRET=');
const hasAppVersion = envContent.includes('NEXT_PUBLIC_APP_VERSION=');

// Add new variables if they don't exist
let newContent = envContent;

if (!hasNextAuthSecret) {
  newContent += `\n# Authentication secret (generated)\nNEXTAUTH_SECRET=${nextAuthSecret}\n`;
}

if (!hasAppVersion) {
  newContent += `\n# App version for beta\nNEXT_PUBLIC_APP_VERSION=${appVersion}\n`;
}

// Write back to file
fs.writeFileSync(envPath, newContent.trim() + '\n');

console.log('\n✅ Environment variables added to .env.local!');

// Also show the manual commands
console.log('\n📋 Or if you prefer to generate manually:');
console.log('   For NEXTAUTH_SECRET, run: openssl rand -base64 32');
console.log('   For NEXT_PUBLIC_APP_VERSION, just use: beta-1.0.0');

#!/bin/bash

echo "🚀 Deploying MoxMuse to Vercel..."
echo ""
echo "This script will guide you through the deployment process."
echo ""
echo "⚠️  IMPORTANT: You'll need to:"
echo "1. Login to your Vercel account when prompted"
echo "2. Link this to a new project"
echo "3. The environment variables will be added after initial deployment"
echo ""
echo "Press Enter to continue..."
read

# Deploy to Vercel
echo "Starting Vercel deployment..."
echo ""
echo "When prompted:"
echo "- Set up and deploy: Yes"
echo "- Which scope: Select your account"
echo "- Link to existing project: No (create new)"
echo "- Project name: moxmuse (or your choice)"
echo "- Directory: ./ (current directory)"
echo "- Build Command: (auto-detected, just press Enter)"
echo "- Output Directory: (auto-detected, just press Enter)"
echo "- Development Command: (auto-detected, just press Enter)"
echo ""

vercel --yes

echo ""
echo "✅ Initial deployment complete!"
echo ""
echo "Now let's add your environment variables..."
echo ""
echo "You'll need to add these in the Vercel dashboard:"
echo "1. Go to your project at https://vercel.com/dashboard"
echo "2. Click on your moxmuse project"
echo "3. Go to Settings → Environment Variables"
echo "4. Add all the variables from your .env.local file"
echo ""
echo "After adding environment variables, redeploy with:"
echo "vercel --prod"

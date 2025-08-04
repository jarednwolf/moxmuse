#!/bin/bash
set -e

echo "Starting custom Vercel build script..."

# Install only production dependencies for the web app
cd apps/web
npm install --production --legacy-peer-deps

# Build the Next.js app
npm run build

echo "Build completed successfully!"

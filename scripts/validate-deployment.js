#!/usr/bin/env node

/**
 * Deployment Validation Script
 * Checks if the project is ready for Vercel deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

console.log(`${colors.blue}🚀 MoxMuse Deployment Validation${colors.reset}\n`);

let errors = 0;
let warnings = 0;

// Check functions
function checkFile(filePath, description) {
  const exists = fs.existsSync(path.join(process.cwd(), filePath));
  if (exists) {
    console.log(`${colors.green}✓${colors.reset} ${description}`);
  } else {
    console.log(`${colors.red}✗${colors.reset} ${description} - Missing ${filePath}`);
    errors++;
  }
  return exists;
}

function checkEnvExample() {
  console.log(`\n${colors.blue}Checking environment configuration...${colors.reset}`);
  
  if (checkFile('env.example', 'Environment example file exists')) {
    const envContent = fs.readFileSync('env.example', 'utf8');
    const requiredVars = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
      'OPENAI_API_KEY'
    ];
    
    requiredVars.forEach(varName => {
      if (envContent.includes(varName)) {
        console.log(`${colors.green}✓${colors.reset} ${varName} documented in env.example`);
      } else {
        console.log(`${colors.yellow}⚠${colors.reset} ${varName} not found in env.example`);
        warnings++;
      }
    });
  }
}

function checkBuildConfiguration() {
  console.log(`\n${colors.blue}Checking build configuration...${colors.reset}`);
  
  checkFile('vercel.json', 'Vercel configuration file');
  checkFile('package.json', 'Root package.json');
  checkFile('pnpm-workspace.yaml', 'PNPM workspace configuration');
  checkFile('turbo.json', 'Turborepo configuration');
}

function checkNextJsApp() {
  console.log(`\n${colors.blue}Checking Next.js application...${colors.reset}`);
  
  checkFile('apps/web/package.json', 'Web app package.json');
  checkFile('apps/web/next.config.js', 'Next.js configuration');
  checkFile('apps/web/tsconfig.json', 'TypeScript configuration');
  checkFile('apps/web/app/layout.tsx', 'Root layout');
  checkFile('apps/web/app/page.tsx', 'Homepage');
}

function checkDatabase() {
  console.log(`\n${colors.blue}Checking database setup...${colors.reset}`);
  
  checkFile('packages/db/prisma/schema.prisma', 'Prisma schema');
  checkFile('packages/db/package.json', 'Database package.json');
  
  // Check for Supabase RLS policies
  if (checkFile('packages/db/supabase-rls-policies-simple.sql', 'Supabase RLS policies')) {
    console.log(`${colors.green}✓${colors.reset} Database security policies found`);
  }
}

function checkBuildLocally() {
  console.log(`\n${colors.blue}Testing local build...${colors.reset}`);
  
  try {
    console.log('Running build (this may take a few minutes)...');
    execSync('pnpm build', { stdio: 'pipe' });
    console.log(`${colors.green}✓${colors.reset} Build completed successfully`);
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} Build failed - fix errors before deploying`);
    console.log(`${colors.yellow}Run 'pnpm build' to see detailed error messages${colors.reset}`);
    errors++;
  }
}

function checkGitStatus() {
  console.log(`\n${colors.blue}Checking Git status...${colors.reset}`);
  
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
      console.log(`${colors.yellow}⚠${colors.reset} Uncommitted changes detected`);
      console.log(`${colors.yellow}Consider committing changes before deployment${colors.reset}`);
      warnings++;
    } else {
      console.log(`${colors.green}✓${colors.reset} Working directory clean`);
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠${colors.reset} Could not check git status`);
    warnings++;
  }
}

function printDeploymentChecklist() {
  console.log(`\n${colors.blue}Pre-deployment Checklist:${colors.reset}`);
  
  const checklist = [
    'Create Supabase project and get credentials',
    'Generate NEXTAUTH_SECRET with: openssl rand -base64 32',
    'Set up OpenAI API key',
    'Configure OAuth providers (optional)',
    'Review feature flags in env.example',
    'Test authentication flow locally',
    'Verify AI deck generation works'
  ];
  
  checklist.forEach((item, index) => {
    console.log(`${index + 1}. ${item}`);
  });
}

function printResults() {
  console.log(`\n${colors.blue}Validation Results:${colors.reset}`);
  
  if (errors === 0 && warnings === 0) {
    console.log(`${colors.green}✅ All checks passed! Ready for deployment.${colors.reset}`);
  } else {
    if (errors > 0) {
      console.log(`${colors.red}❌ ${errors} error(s) found - fix before deploying${colors.reset}`);
    }
    if (warnings > 0) {
      console.log(`${colors.yellow}⚠️  ${warnings} warning(s) found - review before deploying${colors.reset}`);
    }
  }
  
  console.log(`\n${colors.blue}Next Steps:${colors.reset}`);
  console.log('1. Fix any errors identified above');
  console.log('2. Review VERCEL_DEPLOYMENT_GUIDE.md');
  console.log('3. Push to GitHub: git push origin main');
  console.log('4. Deploy on Vercel: https://vercel.com/new');
}

// Run all checks
console.log('Starting deployment validation...\n');

checkEnvExample();
checkBuildConfiguration();
checkNextJsApp();
checkDatabase();
checkGitStatus();

// Only run build check if no critical errors
if (errors === 0) {
  checkBuildLocally();
}

printDeploymentChecklist();
printResults();

// Exit with error code if there were errors
process.exit(errors > 0 ? 1 : 0);

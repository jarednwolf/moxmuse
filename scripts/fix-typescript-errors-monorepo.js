#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Finding all TypeScript implicit any errors in the monorepo...\n');

// Function to find TypeScript errors in a specific package
function findErrorsInPackage(packagePath, packageName) {
  console.log(`\n📦 Checking ${packageName}...`);
  let errors = [];
  
  try {
    execSync(`cd ${packagePath} && pnpm run build`, { encoding: 'utf8' });
    console.log(`✅ No errors in ${packageName}`);
  } catch (error) {
    // Parse the error output
    const output = error.stdout || error.message;
    const lines = output.split('\n');
    
    lines.forEach((line, index) => {
      if (line.includes("implicitly has an 'any' type")) {
        // Get the file path and line number from previous line
        const prevLine = lines[index - 1];
        const match = prevLine.match(/(.+\.tsx?):(\d+):(\d+)/);
        if (match) {
          const filePath = match[1].startsWith('.') 
            ? path.join(packagePath, match[1]) 
            : match[1];
          
          errors.push({
            file: filePath,
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            fullError: line,
            context: prevLine,
            package: packageName
          });
        }
      }
    });
    
    console.log(`❌ Found ${errors.length} errors in ${packageName}`);
  }
  
  return errors;
}

// Check all packages
const allErrors = [];

// Check web app
allErrors.push(...findErrorsInPackage('apps/web', 'web'));

// Check API package
allErrors.push(...findErrorsInPackage('packages/api', 'api'));

// Check DB package
allErrors.push(...findErrorsInPackage('packages/db', 'db'));

// Check shared package
allErrors.push(...findErrorsInPackage('packages/shared', 'shared'));

console.log(`\n\n📊 Total errors found: ${allErrors.length}\n`);

// Fix each error
allErrors.forEach((error, index) => {
  console.log(`[${index + 1}/${allErrors.length}] Fixing: ${error.file}:${error.line} (${error.package})`);
  console.log(`  Error: ${error.fullError}`);
  
  try {
    const filePath = error.file;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Get the problematic line
    const lineIndex = error.line - 1;
    const line = lines[lineIndex];
    
    // Common patterns to fix
    const patterns = [
      // map((item) => ...)
      { regex: /\.map\(\(([^)]+)\) =>/, replacement: '.map(($1: any) =>' },
      // filter((item) => ...)
      { regex: /\.filter\(\(([^)]+)\) =>/, replacement: '.filter(($1: any) =>' },
      // forEach((item) => ...)
      { regex: /\.forEach\(\(([^)]+)\) =>/, replacement: '.forEach(($1: any) =>' },
      // reduce((sum, item) => ...)
      { regex: /\.reduce\(\(([^,]+), ([^)]+)\) =>/, replacement: '.reduce(($1: any, $2: any) =>' },
      // find((item) => ...)
      { regex: /\.find\(\(([^)]+)\) =>/, replacement: '.find(($1: any) =>' },
      // some((item) => ...)
      { regex: /\.some\(\(([^)]+)\) =>/, replacement: '.some(($1: any) =>' },
      // every((item) => ...)
      { regex: /\.every\(\(([^)]+)\) =>/, replacement: '.every(($1: any) =>' },
      // sort((a, b) => ...)
      { regex: /\.sort\(\(([^,]+), ([^)]+)\) =>/, replacement: '.sort(($1: any, $2: any) =>' },
      // findIndex((item) => ...)
      { regex: /\.findIndex\(\(([^)]+)\) =>/, replacement: '.findIndex(($1: any) =>' },
      // flatMap((item) => ...)
      { regex: /\.flatMap\(\(([^)]+)\) =>/, replacement: '.flatMap(($1: any) =>' },
    ];
    
    let fixed = false;
    let newLine = line;
    
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        newLine = line.replace(pattern.regex, pattern.replacement);
        fixed = true;
        break;
      }
    }
    
    // Handle function parameters like: function(param)
    if (!fixed && line.includes('(') && line.includes(')')) {
      // Try to match function parameters
      const funcMatch = line.match(/function\s*\(([^)]+)\)/);
      const arrowMatch = line.match(/\(([^)]+)\)\s*=>/);
      
      if (funcMatch || arrowMatch) {
        const match = funcMatch || arrowMatch;
        const params = match[1].split(',').map(p => p.trim());
        const newParams = params.map(p => {
          // If parameter doesn't have a type annotation
          if (!p.includes(':')) {
            return `${p}: any`;
          }
          return p;
        });
        
        newLine = line.replace(match[0], match[0].replace(match[1], newParams.join(', ')));
        fixed = true;
      }
    }
    
    if (fixed) {
      lines[lineIndex] = newLine;
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log(`  ✅ Fixed: ${line.trim()} → ${newLine.trim()}\n`);
    } else {
      console.log(`  ⚠️  Could not auto-fix, please fix manually`);
      console.log(`  Line: ${line.trim()}\n`);
    }
  } catch (err) {
    console.log(`  ❌ Error processing file: ${err.message}\n`);
  }
});

console.log('\n✅ TypeScript error fixing complete!');

// Run build again to check
console.log('\n🔨 Running full monorepo build to verify fixes...\n');
try {
  execSync('pnpm run build', { encoding: 'utf8', stdio: 'inherit' });
  console.log('\n✅ Monorepo build successful!');
} catch (error) {
  console.log('\n❌ Build still has errors. Check the output above.');
  
  // Try running web build specifically for Vercel
  console.log('\n🔨 Testing web app build specifically...\n');
  try {
    execSync('cd apps/web && pnpm run build', { encoding: 'utf8', stdio: 'inherit' });
    console.log('\n✅ Web app build successful!');
  } catch (webError) {
    console.log('\n❌ Web app build still has errors.');
  }
}

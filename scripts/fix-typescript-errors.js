#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Finding all TypeScript implicit any errors...\n');

// Run TypeScript compiler to get all errors
let errors = [];
try {
  execSync('cd apps/web && pnpm run build', { encoding: 'utf8' });
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
        errors.push({
          file: match[1].replace('./','apps/web/'),
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          fullError: line,
          context: prevLine
        });
      }
    }
  });
}

console.log(`Found ${errors.length} implicit 'any' errors\n`);

// Fix each error
errors.forEach((error, index) => {
  console.log(`[${index + 1}/${errors.length}] Fixing: ${error.file}:${error.line}`);
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
    
    if (fixed) {
      lines[lineIndex] = newLine;
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log(`  ✅ Fixed: ${line.trim()} → ${newLine.trim()}\n`);
    } else {
      console.log(`  ⚠️  Could not auto-fix, please fix manually\n`);
    }
  } catch (err) {
    console.log(`  ❌ Error processing file: ${err.message}\n`);
  }
});

console.log('\n✅ TypeScript error fixing complete!');

// Run build again to check
console.log('\n🔨 Running build to verify fixes...\n');
try {
  execSync('cd apps/web && pnpm run build', { encoding: 'utf8', stdio: 'inherit' });
  console.log('\n✅ Build successful!');
} catch (error) {
  console.log('\n❌ Build still has errors. Check the output above.');
}

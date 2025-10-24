# Syntax Error Speed-Up Guide

## Current Status

Your project has 3,000+ syntax errors across 300+ files. Here's how to fix them FAST.

## 🚀 Speed Optimization Setup

### 1. **Automated Error Detection + MCP**

#### Install Error Detection Tools

```bash
# TypeScript Error Reporter
npm install -g ts-node typescript @typescript-eslint/parser

# Syntax validation tools
npm install -g prettier eslint jscodeshift

# Real-time error watching
npm install -g chokidar-cli
```

#### Create Master Error Scanner

```bash
#!/bin/bash
# Save as: scripts/scan-all-errors.sh

echo "🔍 Scanning all syntax errors..."

# TypeScript errors
echo "=== TypeScript Errors ==="
npx tsc --noEmit --pretty false 2>&1 | grep -E "error TS" | sort | uniq -c | sort -nr > typescript-errors.txt

# ESLint errors
echo "=== ESLint Errors ==="
npx eslint src --format compact --no-eslintrc -c .eslintrc.json 2>&1 | grep -E "Error|error" > eslint-errors.txt

# Find common patterns
echo "=== Common Error Patterns ==="
grep -r "_error" src --include="*.ts" --include="*.tsx" | wc -l
grep -r "_errorinstanceof" src --include="*.ts" --include="*.tsx" | wc -l
grep -r "content-length" src --include="*.ts" --include="*.tsx" | wc -l

echo "📊 Error summary saved to error-reports/"
```

### 2. **MCP-Powered Error Fixing Workflow**

#### A. Pattern Recognition (Serena + Filesystem)

```bash
# Use Serena to find all instances of a pattern
"Find all files with '_error' pattern"
"Show me all malformed error handling blocks"
"Find all unterminated template literals"
```

#### B. Solution Research (GitHub + Brave)

```bash
# Use GitHub to find fixes
"Search GitHub for 'typescript parsing error _error'"
"Find PRs that fixed similar syntax errors"

# Use Brave for documentation
"Search for TypeScript error TS1005 solutions"
"Find automated syntax fixing tools"
```

#### C. Bulk Fixing (Filesystem + Context 7)

```bash
# Use Filesystem for mass edits
"Replace all '_error' with 'error:' in TypeScript files"
"Fix all instances of '_errorinstanceof' to 'error instanceof'"

# Use Context 7 to track progress
"Remember we fixed all _error patterns in agents directory"
"Save the list of remaining error patterns"
```

### 3. **Automated Fix Scripts**

#### Create Universal Syntax Fixer

```typescript
// Save as: scripts/universal-syntax-fixer.ts
import * as fs from 'fs';
import * as path from 'path';
import { Project, SyntaxKind } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: './tsconfig.json',
});

// Common fixes
const fixes = [
  { pattern: /_error(?!\w)/g, replacement: 'error:' },
  { pattern: /_errorinstanceof/g, replacement: 'error instanceof' },
  { pattern: /_content(?!\w)/g, replacement: 'content:' },
  { pattern: /_request(?!\w)/g, replacement: 'request:' },
  { pattern: /content-length/g, replacement: '"content-length"' },
  { pattern: /content-type/g, replacement: '"content-type"' },
];

// Apply fixes to all files
project.getSourceFiles().forEach((sourceFile) => {
  let text = sourceFile.getFullText();
  let modified = false;

  fixes.forEach((fix) => {
    if (fix.pattern.test(text)) {
      text = text.replace(fix.pattern, fix.replacement);
      modified = true;
    }
  });

  if (modified) {
    sourceFile.replaceWithText(text);
    console.log(`Fixed: ${sourceFile.getFilePath()}`);
  }
});

project.save();
```

### 4. **Real-Time Error Prevention**

#### Set up File Watcher

```bash
# Watch for new errors as you code
chokidar "src/**/*.ts" -c "npm run lint:fix && npm run format"
```

#### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
npm run lint:fix
npm run format
npm run type-check
```

## 🎯 Fastest Error-Fixing Workflow

### Phase 1: Mass Pattern Fixes (1-2 hours)

1. Run automated scanners to identify patterns
2. Use MCP Filesystem for bulk replacements
3. Run fix scripts on entire codebase

### Phase 2: Complex Error Resolution (2-4 hours)

1. Use Serena to find remaining complex errors
2. Use GitHub/Brave to research solutions
3. Apply fixes with Filesystem MCP
4. Save progress with Context 7

### Phase 3: Validation (30 minutes)

1. Run full TypeScript compilation
2. Run ESLint with autofix
3. Run test suite

## 🔧 Command Shortcuts

```bash
# Add to package.json scripts
"scripts": {
  "fix:syntax": "ts-node scripts/universal-syntax-fixer.ts",
  "scan:errors": "bash scripts/scan-all-errors.sh",
  "fix:all": "npm run fix:syntax && npm run lint:fix && npm run format",
  "watch:fix": "chokidar 'src/**/*.ts' -c 'npm run fix:all'"
}
```

## 💡 Pro Tips

1. **Batch Similar Errors**: Group files with similar errors and fix them together
2. **Use MCP Memory**: Store successful fix patterns in Context 7 for reuse
3. **Parallel Processing**: Open multiple terminals for different error types
4. **Progressive Fixing**: Start with most common patterns first

## 📊 Expected Timeline

With this setup:

- **Without optimization**: 20-30 hours
- **With MCP only**: 10-15 hours
- **With MCP + Automation**: 3-5 hours ✨

## Next Immediate Steps

1. Run `chmod +x scripts/setup-context7-mcp.sh && ./scripts/setup-context7-mcp.sh`
2. Install the automated tools above
3. Create and run the scanner script
4. Start with the most common pattern: `_error` → `error:`
5. Use MCP to handle complex cases

This combination of automated tools + MCP will dramatically speed up error fixing!

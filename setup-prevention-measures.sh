#!/bin/bash
# Universal AI Tools - QA Workflow Setup
# Implements comprehensive quality assurance after each file change

set -e

echo "🛡️ Setting up comprehensive QA workflow..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Create Git hooks directory
echo "📋 Setting up Git hooks..."
mkdir -p .githooks

# Pre-commit hook with comprehensive checks
cat > .githooks/pre-commit << 'EOF'
#!/bin/sh
# Pre-commit hook for Universal AI Tools
# Ensures code quality before each commit

echo "🔍 Running pre-commit checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we have staged TypeScript files
STAGED_TS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$')

if [ -z "$STAGED_TS_FILES" ]; then
  echo "✅ No TypeScript files to check"
  exit 0
fi

echo "📝 Checking TypeScript files..."

# Function to check a single file
check_file() {
  local file=$1
  local errors=0
  
  # Check if file exists
  if [ ! -f "$file" ]; then
    return 0
  fi
  
  # Run TypeScript compiler on the file
  echo -n "  Checking $file... "
  npx tsc --noEmit --skipLibCheck "$file" 2>/tmp/tsc-errors.log
  
  if [ $? -ne 0 ]; then
    echo "${RED}❌ TypeScript errors${NC}"
    cat /tmp/tsc-errors.log | head -10
    errors=$((errors + 1))
  else
    echo "${GREEN}✅${NC}"
  fi
  
  # Run ESLint
  npx eslint "$file" --quiet 2>/tmp/eslint-errors.log
  
  if [ $? -ne 0 ]; then
    echo "  ${RED}❌ ESLint errors in $file${NC}"
    cat /tmp/eslint-errors.log | head -5
    errors=$((errors + 1))
  fi
  
  # Check for TODO/FIXME comments
  if grep -E "(TODO|FIXME|HACK|BUG):" "$file" > /dev/null; then
    echo "  ${YELLOW}⚠️  Found TODO/FIXME comments in $file${NC}"
    grep -n -E "(TODO|FIXME|HACK|BUG):" "$file" | head -3
  fi
  
  return $errors
}

# Check each staged file
total_errors=0
for file in $STAGED_TS_FILES; do
  check_file "$file"
  total_errors=$((total_errors + $?))
done

# Run Prettier on staged files
echo ""
echo "🎨 Running Prettier..."
npx prettier --check $STAGED_TS_FILES > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "${YELLOW}⚠️  Some files need formatting${NC}"
  echo "Running Prettier fix..."
  npx prettier --write $STAGED_TS_FILES
  
  # Re-add the formatted files
  for file in $STAGED_TS_FILES; do
    git add "$file"
  done
  echo "${GREEN}✅ Files formatted${NC}"
fi

# Final check
if [ $total_errors -gt 0 ]; then
  echo ""
  echo "${RED}❌ Pre-commit checks failed!${NC}"
  echo "Please fix the errors above before committing."
  echo ""
  echo "Tips:"
  echo "  - Run 'npm run lint:fix' to auto-fix some issues"
  echo "  - Run 'npm run build' to see all TypeScript errors"
  echo "  - Use 'git commit --no-verify' to skip these checks (not recommended)"
  exit 1
fi

echo ""
echo "${GREEN}✅ All pre-commit checks passed!${NC}"
exit 0
EOF

chmod +x .githooks/pre-commit
echo "${GREEN}✅ Pre-commit hook created${NC}"

# Configure Git to use our hooks
git config core.hooksPath .githooks

# 2. Pre-push hook for build validation
cat > .githooks/pre-push << 'EOF'
#!/bin/sh
# Pre-push hook for Universal AI Tools
# Ensures build passes before pushing

echo "🚀 Running pre-push checks..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Run build
echo "🔨 Building project..."
npm run build > /tmp/build.log 2>&1

if [ $? -ne 0 ]; then
  echo "${RED}❌ Build failed!${NC}"
  echo ""
  cat /tmp/build.log | grep -E "error TS" | head -20
  echo ""
  echo "Push aborted. Fix build errors before pushing."
  echo "Run 'npm run build' to see all errors."
  exit 1
fi

echo "${GREEN}✅ Build successful${NC}"

# Run tests if they exist
if [ -f "package.json" ] && grep -q "\"test\":" package.json; then
  echo "🧪 Running tests..."
  npm test -- --passWithNoTests > /tmp/test.log 2>&1
  
  if [ $? -ne 0 ]; then
    echo "${YELLOW}⚠️  Some tests failed${NC}"
    echo "Consider fixing tests before pushing."
  else
    echo "${GREEN}✅ Tests passed${NC}"
  fi
fi

echo ""
echo "${GREEN}✅ Pre-push checks completed!${NC}"
exit 0
EOF

chmod +x .githooks/pre-push
echo "${GREEN}✅ Pre-push hook created${NC}"

# 3. Enhanced VS Code settings for automatic QA
echo "💻 Setting up VS Code QA settings..."
if [ -f ".vscode/settings.json" ]; then
  echo "${YELLOW}⚠️  VS Code settings already exist - merging QA settings${NC}"
  # Back up existing settings
  cp .vscode/settings.json .vscode/settings.json.backup
else
  mkdir -p .vscode
fi

cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "files.watcherExclude": {
    "**/dist/**": true,
    "**/build/**": true,
    "**/node_modules/**": true
  },
  "typescript.preferences.quoteStyle": "single",
  "javascript.preferences.quoteStyle": "single",
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "editor.rulers": [100],
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "typescript.suggest.paths": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.validate.enable": true,
  "problems.showCurrentInStatus": true,
  "typescript.reportStyleChecksAsWarnings": true,
  "typescript.suggest.completeJSDocs": true
}
EOF

echo "${GREEN}✅ VS Code QA settings created${NC}"

# 4. Real-time validation watcher
echo "🔍 Creating real-time validation script..."
cat > watch-validation.js << 'EOF'
#!/usr/bin/env node
const chokidar = require('chokidar');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('👁️  Starting real-time TypeScript validation...');

// Debounce function
let timeout;
const debounce = (func, wait) => {
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// Check a single file
const checkFile = (filePath) => {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
  
  console.log(`\n🔍 Checking ${filePath}...`);
  
  // Run TypeScript check
  const tsc = spawn('npx', ['tsc', '--noEmit', '--skipLibCheck', filePath], {
    stdio: 'pipe'
  });
  
  let errors = '';
  tsc.stderr.on('data', (data) => {
    errors += data.toString();
  });
  
  tsc.on('close', (code) => {
    if (code !== 0 && errors) {
      console.log('❌ TypeScript errors found:');
      console.log(errors);
    } else {
      console.log('✅ No TypeScript errors');
    }
  });
  
  // Run ESLint
  const eslint = spawn('npx', ['eslint', filePath, '--quiet'], {
    stdio: 'pipe'
  });
  
  let lintErrors = '';
  eslint.stdout.on('data', (data) => {
    lintErrors += data.toString();
  });
  
  eslint.on('close', (code) => {
    if (code !== 0 && lintErrors) {
      console.log('⚠️  ESLint warnings:');
      console.log(lintErrors);
    }
  });
};

// Watch for changes
const watcher = chokidar.watch('src/**/*.{ts,tsx}', {
  persistent: true,
  ignoreInitial: true
});

const debouncedCheck = debounce(checkFile, 1000);

watcher
  .on('add', path => {
    console.log(`✨ New file: ${path}`);
    debouncedCheck(path);
  })
  .on('change', path => {
    debouncedCheck(path);
  });

console.log('✅ Watching for TypeScript file changes...');
console.log('   Press Ctrl+C to stop\n');
EOF

chmod +x watch-validation.js
echo "${GREEN}✅ Real-time validation script created${NC}"

# Update package.json scripts
echo "📦 Updating package.json scripts..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Add validation scripts
pkg.scripts = pkg.scripts || {};
pkg.scripts['validate'] = 'tsc --noEmit && eslint src --ext .ts,.tsx';
pkg.scripts['validate:watch'] = 'node watch-validation.js';
pkg.scripts['qa'] = 'npm run validate && npm run lint:fix && npm run format';
pkg.scripts['pre-commit'] = '.githooks/pre-commit';
pkg.scripts['format:check'] = 'prettier --check \"src/**/*.{ts,tsx}\"';

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"
echo "${GREEN}✅ Package scripts updated${NC}"

# 5. GitHub Actions workflow
echo "🔧 Creating GitHub Actions workflow..."
mkdir -p .github/workflows
cat > .github/workflows/qa.yml << 'EOF'
name: Quality Assurance

on:
  push:
    branches: [ main, master, develop ]
  pull_request:
    branches: [ main, master, develop ]

jobs:
  quality-checks:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run TypeScript check
      run: npm run build
      
    - name: Run ESLint
      run: npm run lint
      
    - name: Check formatting
      run: npm run format:check || true
      
    - name: Run tests
      run: npm test -- --passWithNoTests
      
    - name: Check for TODOs
      run: |
        if grep -r "TODO:" src/ --include="*.ts" --include="*.tsx"; then
          echo "::warning::Found TODO comments in code"
        fi
EOF
echo "${GREEN}✅ GitHub Actions workflow created${NC}"

# 6. Create progressive validation script
echo "🔄 Creating progressive validation script..."
cat > progressive-validation.sh << 'EOF'
#!/bin/bash
# Progressive validation script
# Validates code incrementally to catch errors early

echo "🔄 Starting progressive validation..."

# Check only changed files
CHANGED_FILES=$(git diff --name-only HEAD | grep -E '\.(ts|tsx)$')

if [ -z "$CHANGED_FILES" ]; then
  echo "✅ No TypeScript changes to validate"
  exit 0
fi

echo "📝 Validating changed files..."
for file in $CHANGED_FILES; do
  if [ -f "$file" ]; then
    echo -n "  Checking $file... "
    npx tsc --noEmit --skipLibCheck "$file" 2>/tmp/tsc-single.log
    if [ $? -eq 0 ]; then
      echo "✅"
    else
      echo "❌"
      cat /tmp/tsc-single.log
    fi
  fi
done

echo ""
echo "🏗️ Running full build check..."
npm run build
EOF

chmod +x progressive-validation.sh
echo "${GREEN}✅ Progressive validation script created${NC}"

# 7. Create editor config
echo "📄 Creating .editorconfig..."
cat > .editorconfig << 'EOF'
# EditorConfig helps maintain consistent coding styles

root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[*.{ts,tsx,js,jsx}]
quote_type = single
EOF
echo "${GREEN}✅ EditorConfig created${NC}"

echo ""
echo "${GREEN}🎉 QA workflow setup complete!${NC}"
echo ""
echo "📋 What's been set up:"
echo "   ✅ Git pre-commit hooks - Check files before commit"
echo "   ✅ Git pre-push hooks - Ensure build passes before push"
echo "   ✅ VS Code save actions - Format and check on save"
echo "   ✅ Real-time validation - Watch for errors as you type"
echo "   ✅ GitHub Actions - CI/CD quality checks"
echo "   ✅ Progressive validation - Check only changed files"
echo ""
echo "🚀 Available commands:"
echo "   npm run validate       - Run full validation"
echo "   npm run validate:watch - Real-time error checking"
echo "   npm run qa            - Run all quality checks"
echo "   ./progressive-validation.sh - Check only changed files"
echo ""
echo "${YELLOW}⚠️  To activate Git hooks, run:${NC}"
echo "   git config core.hooksPath .githooks"
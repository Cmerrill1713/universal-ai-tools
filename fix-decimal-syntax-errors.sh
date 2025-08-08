#!/bin/bash

echo "🔧 Fixing decimal syntax errors caused by linter corruption..."

# Files that need decimal syntax fixes
FILES=(
  "src/services/code-intelligence-orchestrator.ts"
  "src/services/semantic-code-analyzer.ts"
  "src/core/self-improvement/pattern-mining-system.ts"
  "src/routers/code-intelligence.ts"
)

# Fix patterns: 0?.X -> 0.X, 1?.X -> 1.X, etc.
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    
    # Fix decimal numbers with optional chaining corruption
    sed -i '' 's/0?\.\([0-9]\)/0.\1/g' "$file"
    sed -i '' 's/1?\.\([0-9]\)/1.\1/g' "$file"
    sed -i '' 's/2?\.\([0-9]\)/2.\1/g' "$file"
    sed -i '' 's/3?\.\([0-9]\)/3.\1/g' "$file"
    sed -i '' 's/4?\.\([0-9]\)/4.\1/g' "$file"
    sed -i '' 's/5?\.\([0-9]\)/5.\1/g' "$file"
    sed -i '' 's/6?\.\([0-9]\)/6.\1/g' "$file"
    sed -i '' 's/7?\.\([0-9]\)/7.\1/g' "$file"
    sed -i '' 's/8?\.\([0-9]\)/8.\1/g' "$file"
    sed -i '' 's/9?\.\([0-9]\)/9.\1/g' "$file"
    
    # Fix trailing semicolons after closing braces/parentheses
    sed -i '' 's/};$/}/g' "$file"
    sed -i '' 's/);$/)/g' "$file"
    
    # Fix comma-semicolon mixups
    sed -i '' 's/,$/,/g' "$file"
    sed -i '' 's/;,/,/g' "$file"
    
    echo "✅ Fixed $file"
  else
    echo "⚠️  File not found: $file"
  fi
done

echo "🎉 All decimal syntax errors fixed!"
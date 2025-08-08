#!/bin/bash

echo "🔧 Final comprehensive syntax fix for all files..."

FILES=(
  "src/server.ts"
  "src/services/code-intelligence-orchestrator.ts"
  "src/services/semantic-code-analyzer.ts"
  "src/core/self-improvement/pattern-mining-system.ts"
  "src/routers/code-intelligence.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Final fix for $file..."
    
    # Fix broken object and function syntax
    sed -i '' 's/{ /{ /g' "$file"
    sed -i '' 's/ }{/} => {/g' "$file"
    sed -i '' 's/){ /) => {/g' "$file"
    sed -i '' 's/app\.use()/app.use(/g' "$file"
    sed -i '' 's/res\.json({)/res.json({/g' "$file"
    sed -i '' 's/res\.status({)/res.status(/g' "$file"
    sed -i '' 's/log\.info({)/log.info(/g' "$file"
    sed -i '' 's/log\.error({)/log.error(/g' "$file"
    sed -i '' 's/log\.warn({)/log.warn(/g' "$file"
    
    # Fix missing commas and semicolons
    sed -i '' 's/},$/},/g' "$file"
    sed -i '' 's/;$/;/g' "$file"
    sed -i '' 's/ }/ }/g' "$file"
    
    # Fix broken import/export patterns
    sed -i '' "s/';$/';/g" "$file"
    sed -i '' "s/'$/'/g" "$file"
    
    # Fix broken method calls with parentheses
    sed -i '' 's/app\.get(\/\([^)]*\))/app.get("\/\1",/g' "$file"
    sed -i '' 's/app\.post(\/\([^)]*\))/app.post("\/\1",/g' "$file"
    
    # Fix broken template literals and quotes
    sed -i '' 's/"""/"/g' "$file"
    sed -i '' "s/'''/'/g" "$file"
    
    # Fix object syntax issues
    sed -i '' 's/{;/{/g' "$file"
    sed -i '' 's/;}/}/g' "$file"
    sed -i '' 's/},;/},/g' "$file"
    sed -i '' 's/];$/]/g' "$file"
    
    echo "✅ Final fixes applied to $file"
  else
    echo "⚠️  File not found: $file"
  fi
done

echo "🎉 All final syntax fixes complete!"
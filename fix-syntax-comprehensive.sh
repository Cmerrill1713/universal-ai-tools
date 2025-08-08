#\!/bin/bash

echo "🔧 Comprehensive syntax fix for all corrupted files..."

FILES=(
  "src/core/server-timeouts.ts"
  "src/config/environment.ts"
  "src/utils/api-response.ts"
  "src/server.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    
    # Fix trailing quotes after semicolons and commas
    sed -i '' "s/;'/;/g" "$file"
    sed -i '' "s/,'/,/g" "$file"
    sed -i '' "s/, *'/,/g" "$file"
    
    # Fix object syntax with trailing commas before braces
    sed -i '' 's/{,/{/g' "$file"
    sed -i '' 's/},$/}/g' "$file"
    sed -i '' 's/,$/,/g' "$file"
    
    # Fix broken optional chaining on standard objects
    sed -i '' 's/process?\.env/process.env/g' "$file"
    sed -i '' 's/process?\.env?/process.env/g' "$file"
    
    # Fix double semicolons and comment syntax
    sed -i '' 's/;;/;/g' "$file"
    sed -i '' 's|// [^;]*;'"'"'|// comment|g' "$file"
    
    echo "✅ Fixed $file"
  else
    echo "⚠️  File not found: $file"
  fi
done

echo "🎉 Comprehensive syntax fixes complete\!"

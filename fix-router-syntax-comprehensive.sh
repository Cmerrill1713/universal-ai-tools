#!/bin/bash

echo "Fixing syntax errors in router files..."

# Find all TypeScript files in src/routers
ROUTER_FILES=$(find src/routers -name "*.ts" -type f)

for file in $ROUTER_FILES; do
    echo "Processing: $file"
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Fix malformed JSDoc comments
    sed -i '' 's/\/\*\*;/\/\*\*/g' "$file"
    
    # Fix _error patterns to error:
    sed -i '' 's/_error\([^a-zA-Z0-9_]\)/error:\1/g' "$file"
    sed -i '' 's/_errorinstanceof/error instanceof/g' "$file"
    
    # Fix _content, _request, _input patterns
    sed -i '' 's/_content\([^a-zA-Z0-9_]\)/content:\1/g' "$file"
    sed -i '' 's/_request\([^a-zA-Z0-9_]\)/request:\1/g' "$file"
    sed -i '' 's/_requestendpoint/request endpoint/g' "$file"
    sed -i '' 's/_input\([^a-zA-Z0-9_]\)/input:\1/g' "$file"
    
    # Fix content-type and content-length headers
    sed -i '' "s/'content-type'/'Content-Type'/g" "$file"
    sed -i '' 's/"content-type"/"Content-Type"/g' "$file"
    sed -i '' "s/'content-length'/'Content-Length'/g" "$file"
    sed -i '' 's/"content-length"/"Content-Length"/g' "$file"
    
    # Fix logger calls with missing parentheses
    sed -i '' 's/logger\.error(\([^)]*\)_error/logger.error(\1, error/g' "$file"
    sed -i '' 's/logger\.info(\([^)]*\)_error/logger.info(\1, error/g' "$file"
    sed -i '' 's/logger\.warn(\([^)]*\)_error/logger.warn(\1, error/g' "$file"
    
    # Fix unterminated strings in common patterns
    sed -i '' "s/\('Content-Type'\)\([^:]*\)$/\1\2'/g" "$file"
    sed -i '' 's/\("Content-Type"\)\([^:]*\)$/\1\2"/g' "$file"
    
    # Fix missing commas in object literals
    sed -i '' 's/\([a-zA-Z0-9_]\)\s*}\s*\([a-zA-Z0-9_]\+:\)/\1,\n  }\n  \2/g' "$file"
    
    # Check if changes were made
    if ! diff -q "$file" "$file.backup" > /dev/null; then
        echo "  - Fixed syntax errors in $file"
        rm "$file.backup"
    else
        echo "  - No changes needed in $file"
        rm "$file.backup"
    fi
done

echo "Router syntax fix complete!"
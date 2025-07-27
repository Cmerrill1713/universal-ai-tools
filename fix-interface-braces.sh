#!/bin/bash
# Fix interface closing brace issues
set -e

echo "🔧 Fixing interface closing brace issues..."

# Find all TypeScript files and fix the semicolon after interface properties
find src -name "*.ts" -type f | while read -r file; do
    echo "Processing: $file"
    
    # Fix lines that have just `;` after interface properties
    sed -i '' '/^[[:space:]]*;[[:space:]]*$/c\
}' "$file"
    
    # Fix missing commas in function parameters and object properties
    sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\): \([^,;]*\);$/\1: \2,/g' "$file"
    
    # Fix property access patterns that are missing dots
    sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)\([A-Z][a-zA-Z0-9_]*\)/\1.\2/g' "$file"
    
done

echo "✅ Interface closing brace fixes completed"
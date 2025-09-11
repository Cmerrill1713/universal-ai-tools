#!/bin/bash

# Comprehensive syntax fix script for Universal AI Tools
# This script fixes common syntax errors across the codebase

echo "🔧 Starting comprehensive syntax fix..."

# Function to fix common patterns in a file
fix_file() {
    local file="$1"
    echo "Fixing: $file"
    
    # Create backup
    cp "$file" "$file.bak"
    
    # Fix missing colons in type annotations
    sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\) \([a-zA-Z_][a-zA-Z0-9_]*\):/\1: \2:/g' "$file"
    
    # Fix error: patterns (common typo)
    sed -i '' 's/error:/error)/g' "$file"
    sed -i '' 's/error;/error);/g' "$file"
    
    # Fix _error patterns
    sed -i '' 's/_error\([^a-zA-Z0-9_]\)/error:\1/g' "$file"
    sed -i '' 's/_errorinstanceof/error instanceof/g' "$file"
    
    # Fix missing commas in function calls
    sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\) \([a-zA-Z_][a-zA-Z0-9_]*)\)/\1, \2)/g' "$file"
    
    # Fix unterminated strings (basic cases)
    sed -i '' "s/'\([^']*\)$/'\1'/g" "$file"
    sed -i '' 's/"\([^"]*\)$/"\1"/g' "$file"
    
    # Fix content patterns
    sed -i '' 's/content\([a-zA-Z]\)/content.\1/g' "$file"
    sed -i '' 's/_content/content/g' "$file"
    
    # Fix request patterns
    sed -i '' 's/_request/request/g' "$file"
    sed -i '' 's/requestincludes/request.includes/g' "$file"
    
    # Fix pattern object syntax
    sed -i '' 's/{ pattern \//{ pattern: \//g' "$file"
    
    # Fix missing semicolons
    sed -i '' 's/\([^;{}\s]\)$/\1;/g' "$file"
    
    # Fix logger calls
    sed -i '' 's/logger\.\([a-z]*\)\\/logger.\1(/g' "$file"
    
    # Fix JSON.stringify patterns
    sed -i '' 's/JSON\.stringify(content\./JSON.stringify(content)./g' "$file"
    sed -i '' 's/JSON\.stringify(content;/JSON.stringify(content);/g' "$file"
    
    # Compare with backup and remove if no changes
    if cmp -s "$file" "$file.bak"; then
        rm "$file.bak"
    else
        echo "  ✓ Fixed issues in $file"
    fi
}

# Export the function so it can be used by find
export -f fix_file

# Fix all TypeScript files
echo "🔍 Finding and fixing TypeScript files..."
find src -name "*.ts" -type f -exec bash -c 'fix_file "$0"' {} \;

echo "✅ Syntax fix complete!"

# Run ESLint autofix
echo "🔧 Running ESLint autofix..."
npm run lint:fix

echo "🎉 All done!"
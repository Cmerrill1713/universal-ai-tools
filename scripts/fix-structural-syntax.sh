#!/bin/bash

# Fix structural syntax errors that prevent TypeScript compilation
set -e

echo "🔧 Fixing structural syntax errors..."

# Create backup
BACKUP_DIR="src.backup.structural.$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup at $BACKUP_DIR..."
cp -r src "$BACKUP_DIR"

# Find all TypeScript files
TS_FILES=$(find src -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*")

echo "🔍 Found $(echo "$TS_FILES" | wc -l) TypeScript files to fix"

# Fix structural patterns in each file
for file in $TS_FILES; do
    echo "🔧 Fixing structural syntax in $file..."
    
    # Use sed to fix the most critical structural issues
    sed -i.bak \
        -e 's/{\s*;/{/g' \
        -e 's/;\s*}/}/g' \
        -e 's/\[\s*;/[/g' \
        -e 's/;\s*\]/]/g' \
        -e 's/(\s*;/(/g' \
        -e 's/;\s*)/)/g' \
        -e 's/,\s*;/,/g' \
        -e 's/;\s*,/,/g' \
        -e 's/:\s*;/:/g' \
        -e 's/;\s*:/:/g' \
        -e 's/=\s*;/=/g' \
        -e 's/;\s*=/=/g' \
        -e 's/\.\s*;/./g' \
        -e 's/;\s*\././g' \
        -e 's/!\s*;/!/g' \
        -e 's/;\s*!/!/g' \
        -e 's/\?\s*;/?/g' \
        -e 's/;\s*\?/?/g' \
        -e 's/\|\s*;/|/g' \
        -e 's/;\s*\|/|/g' \
        -e 's/&\s*;/\&/g' \
        -e 's/;\s*\&/\&/g' \
        -e 's/\+\s*;/+/g' \
        -e 's/;\s*\+/+/g' \
        -e 's/-\s*;/-/g' \
        -e 's/;\s*-/-/g' \
        -e 's/\*\s*;/*/g' \
        -e 's/;\s*\*/*/g' \
        -e 's/\/\s*;/\//g' \
        -e 's/;\s*\//\//g' \
        -e 's/%\s*;/%/g' \
        -e 's/;\s*%/%/g' \
        -e 's/<\s*;/</g' \
        -e 's/;\s*</</g' \
        -e 's/>\s*;/>/g' \
        -e 's/;\s*>/>/g' \
        "$file"
    
    # Remove backup file
    rm -f "$file.bak"
    
    echo "✅ Fixed structural syntax in $file"
done

echo ""
echo "🎉 Structural syntax fix complete!"
echo "📦 Backup created at: $BACKUP_DIR"

# Test TypeScript compilation
echo "🔍 Testing TypeScript compilation..."
if npm run type-check:dev 2>&1 | head -20; then
    echo "📊 Compilation test completed (showing first 20 lines of output)"
else
    echo "⚠️  Some compilation issues remain"
fi

echo ""
echo "🚀 Run 'npm run type-check:dev' to see full compilation results"
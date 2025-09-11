#!/bin/bash

# Comprehensive script to fix all remaining corruption patterns
set -e

echo "🔧 Running comprehensive corruption fix..."

# Create backup
BACKUP_DIR="src.backup.$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup at $BACKUP_DIR..."
cp -r src "$BACKUP_DIR"

# Find all TypeScript files
TS_FILES=$(find src -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*")

echo "🔍 Found $(echo "$TS_FILES" | wc -l) TypeScript files to fix"

# Function to fix individual file
fix_file() {
    local file="$1"
    echo "🔧 Fixing $file..."
    
    # Create temporary file
    local temp_file="${file}.tmp"
    
    # Advanced pattern fixes using sed
    sed \
        -e 's/\([a-zA-Z_][a-zA-Z0-9_]*\)\([a-zA-Z]\)/\1.\2/g' \
        -e 's/\([)}]\)\([a-zA-Z]\)/\1.\2/g' \
        -e 's/\([a-zA-Z_][a-zA-Z0-9_]*\)\([a-zA-Z]\)/\1.\2/g' \
        -e 's/\.\.\.args/...args/g' \
        -e 's/\.\([a-zA-Z_][a-zA-Z0-9_]*\)\([a-zA-Z]\)/.\1.\2/g' \
        -e 's/\b([a-zA-Z_][a-zA-Z0-9_]*)\b\([a-zA-Z]\)/\1.\2/g' \
        "$file" > "$temp_file"
    
    # Move temporary file back
    mv "$temp_file" "$file"
    
    # Fix specific patterns that are common but tricky
    python3 << 'EOF'
import sys
import re

file_path = sys.argv[1]

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix common patterns that sed missed
fixes = [
    # Fix property access patterns
    (r'([a-zA-Z_][a-zA-Z0-9_]*)([A-Z][a-zA-Z0-9_]*)', r'\1.\2'),
    
    # Fix method calls
    (r'([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)([a-zA-Z])', r'\1(\2).\3'),
    
    # Fix object property patterns
    (r'([})])([a-zA-Z_])', r'\1.\2'),
    
    # Fix array/object access
    (r'(\]|\))([a-zA-Z_])', r'\1.\2'),
    
    # Fix specific common corruptions
    (r'processenv', 'process.env'),
    (r'consolelog', 'console.log'),
    (r'consoleerror', 'console.error'),
    (r'consolewarn', 'console.warn'),
    (r'consoleinfo', 'console.info'),
    (r'Datenow', 'Date.now'),
    (r'JSONstringify', 'JSON.stringify'),
    (r'JSONparse', 'JSON.parse'),
    (r'Mathmax', 'Math.max'),
    (r'Mathmin', 'Math.min'),
    (r'Mathfloor', 'Math.floor'),
    (r'Mathceil', 'Math.ceil'),
    (r'Mathround', 'Math.round'),
    (r'Objectkeys', 'Object.keys'),
    (r'Objectvalues', 'Object.values'),
    (r'Objectentries', 'Object.entries'),
    (r'Arrayisarray', 'Array.isArray'),
    (r'ArrayisArray', 'Array.isArray'),
    (r'Promiseall', 'Promise.all'),
    (r'Promiserace', 'Promise.race'),
    (r'Promiseresolve', 'Promise.resolve'),
    (r'Promisereject', 'Promise.reject'),
    
    # Fix instanceof patterns
    (r'error instanceof', 'error instanceof'),
    (r'(\w+)instanceof(\w+)', r'\1 instanceof \2'),
    
    # Fix property chains that got broken
    (r'\.\.', '.'),
    
    # Fix semicolon patterns
    (r';\s*;', ';'),
    
    # Fix parenthesis patterns
    (r'\(\s*;', '('),
    (r';\s*\)', ')'),
    
    # Fix brace patterns
    (r'{\s*;', '{'),
    (r';\s*}', '}'),
    
    # Fix quote patterns
    (r"'\s*;", "'"),
    (r';\s*"', '"'),
    
    # Fix comma patterns
    (r',\s*;', ','),
    (r';\s*,', ','),
]

# Apply fixes
original_content = content
for pattern, replacement in fixes:
    content = re.sub(pattern, replacement, content)

# Only write if content changed
if content != original_content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Fixed patterns in {file_path}")
else:
    print(f"⏭️  No changes needed in {file_path}")

EOF
    "$file"
}

# Process each file
total_files=$(echo "$TS_FILES" | wc -l)
current=0

for file in $TS_FILES; do
    current=$((current + 1))
    echo "🔄 Processing ($current/$total_files): $file"
    fix_file "$file"
done

echo ""
echo "🎉 Comprehensive corruption fix complete!"
echo "📦 Backup created at: $BACKUP_DIR"
echo "🔍 Testing TypeScript compilation..."

# Test compilation
if npm run type-check:dev > /dev/null 2>&1; then
    echo "✅ TypeScript compilation successful!"
else
    echo "⚠️  TypeScript compilation still has issues. Running linting fix..."
    npm run lint:dev:fix || true
fi

echo "🚀 Run 'npm run type-check:dev' to check for remaining issues"
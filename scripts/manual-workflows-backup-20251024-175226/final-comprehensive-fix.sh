#!/bin/bash

echo "🚀 Final Comprehensive Syntax Fix"
echo "================================"

# Function to fix all patterns in a file
fix_all_patterns() {
    local file="$1"
    
    # Apply all fixes using perl
    perl -i -pe '
        # Fix type annotations missing colons
        s/\(([a-zA-Z_]\w*)\s+([a-zA-Z_]\w*)([\),])/($1: $2$3/g;
        s/,\s*([a-zA-Z_]\w*)\s+([a-zA-Z_]\w*)([\),])/, $1: $2$3/g;
        s/:\s*([a-zA-Z_]\w*)\s+([a-zA-Z_]\w*)([\s,\)])/: $1: $2$3/g;
        
        # Fix function definitions
        s/private\s+([a-zA-Z_]\w*)\(([a-zA-Z_]\w*)\s+([a-zA-Z_]\w*)/private $1($2: $3/g;
        s/async\s+([a-zA-Z_]\w*)\(([a-zA-Z_]\w*)\s+([a-zA-Z_]\w*)/async $1($2: $3/g;
        
        # Fix all error patterns
        s/error:/error)/g;
        s/throw\s+error:/throw error;/g;
        s/_error\b/error/g;
        s/_errorinstanceof/error instanceof/g;
        
        # Fix content patterns
        s/content([A-Z])/content.$1/g;
        s/_content/content/g;
        s/\bcontent([a-z][a-zA-Z]*)/content.$1/g;
        
        # Fix request patterns
        s/_request/request/g;
        s/\brequest([a-z][a-zA-Z]*)/request.$1/g;
        s/requestincludes/request.includes/g;
        
        # Fix _input patterns
        s/_input/input/g;
        s/\binput([a-z][a-zA-Z]*)/input.$1/g;
        
        # Fix _analysis patterns
        s/_analysis/analysis/g;
        s/\banalysis([a-z][a-zA-Z]*)/analysis.$1/g;
        
        # Fix pattern regex objects
        s/\{\s*pattern\s+(\/)/{pattern: $1/g;
        
        # Fix JSON.stringify calls
        s/JSON\.stringify\(([a-zA-Z_]\w*)([.;])/JSON.stringify($1)$2/g;
        
        # Fix specific string termination patterns
        s/(name|type|message|description|approach):\s*'\''([^'\'']*),/$1: '\''$2'\'',/g;
        s/(name|type|message|description|approach):\s*"([^"]*),/$1: "$2",/g;
        
        # Fix multiple underscore patterns
        s/_\s+'/\" '\" /g;
    ' "$file"
    
    # Second pass for complex patterns
    perl -i -pe '
        # Fix unterminated template literals
        if (/`[^`]*$/ && !/`[^`]*`/) {
            s/$/`/;
        }
        
        # Fix logger calls
        s/logger\.([a-z]+)\\`/logger.$1(`/g;
        
        # Fix missing parentheses in logger
        s/logger\.(error|warn|info|debug)\(`([^`]*)`\s*,\s*error:$/logger.$1(`$2`, error);/g;
    ' "$file"
    
    # Third pass for line-ending fixes
    perl -i -pe '
        # Add missing semicolons carefully
        if (!/[{};,]$/ && !/^\s*\/\// && !/^\s*\*/ && !/^\s*$/) {
            # Skip lines that look like they should have semicolons
            if (!/\s+(if|else|for|while|function|class|interface|type|const|let|var)\s/ &&
                !/^(import|export)/ &&
                /\S/) {
                s/$/;/;
            }
        }
    ' "$file"
}

# Export function
export -f fix_all_patterns

# Find and fix all TypeScript files
echo "🔍 Fixing all TypeScript files..."
find src -name "*.ts" -type f -print0 | while IFS= read -r -d '' file; do
    echo -n "."
    fix_all_patterns "$file"
done
echo ""

# Run the TypeScript fixer for additional fixes
echo "🔧 Running TypeScript syntax fixer..."
npx tsx scripts/fix-specific-parsing-errors.ts

# Clean up any backup files
echo "🧹 Cleaning up..."
find src -name "*.bak" -delete
find src -name "*.backup" -delete

# Final report
echo ""
echo "📊 Final Report:"
REMAINING=$(npm run lint --silent 2>&1 | grep -c "Parsing error" || echo "0")
echo "Remaining parsing errors: $REMAINING"

if [ "$REMAINING" -eq "0" ]; then
    echo "✅ All parsing errors fixed!"
else
    echo "⚠️  Some errors remain. Running detailed analysis..."
    npm run lint --silent 2>&1 | grep -A1 -B1 "Parsing error" | head -20
fi
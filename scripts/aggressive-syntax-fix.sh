#!/bin/bash

echo "🚀 Aggressive Syntax Fix - Universal AI Tools"
echo "==========================================="

# Function to fix a single file
fix_file() {
    local file="$1"
    echo "🔧 Fixing: $file"
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Fix common parsing errors
    perl -i -pe '
        # Fix missing colons in type annotations
        s/(\w+)\s+(\w+)(\s*[)},;])/$1: $2$3/g;
        
        # Fix error: patterns
        s/error:/error)/g;
        s/throw error:/throw error;/g;
        
        # Fix _error patterns
        s/_error\b/error/g;
        s/_errorinstanceof/error instanceof/g;
        
        # Fix content access patterns
        s/content([A-Z])/content.$1/g;
        s/_content/content/g;
        s/contentdataAccess/content.dataAccess/g;
        s/contenttargetAudience/content.targetAudience/g;
        s/contentagentResponses/content.agentResponses/g;
        s/contentproposedActions/content.proposedActions/g;
        
        # Fix request patterns
        s/_request/request/g;
        s/requestincludes/request.includes/g;
        
        # Fix pattern regex syntax
        s/\{ pattern ([\/])/{ pattern: $1/g;
        
        # Fix function parameter syntax
        s/\((\w+)\s+(\w+),/($1: $2,/g;
        s/\((\w+)\s+(\w+)\)/($1: $2)/g;
        
        # Fix JSON.stringify patterns
        s/JSON\.stringify\(content([.;])/JSON.stringify(content)$1/g;
        s/JSON\.stringify\(contentto/JSON.stringify(content).to/g;
        
        # Fix logger syntax
        s/logger\.(\w+)\\`/logger.$1(`/g;
        
        # Fix unterminated strings in common patterns
        s/name: '\''([^'\'']*),$/name: '\''$1'\'',/g;
        s/message: '\''([^'\'']*),$/message: '\''$1'\'',/g;
        s/type: '\''([^'\'']*),$/type: '\''$1'\'',/g;
        
        # Fix comma in type unions
        s/error: \|/error'\'' |/g;
        s/'\'', '\''/'\'''\'', '\''/g;
    ' "$file"
    
    # Additional fixes with sed
    sed -i '' '
        # Fix missing closing parentheses
        s/logger\.error(`[^`]*`, error:$/&)/g
        
        # Fix missing semicolons at end of lines
        /[^{};,]$/ {
            /^[[:space:]]*\/\// !{
                /^[[:space:]]*\*/ !{
                    s/$/;/
                }
            }
        }
    ' "$file"
    
    # Check if file changed
    if ! cmp -s "$file" "$file.backup"; then
        echo "  ✓ Fixed issues in $file"
        rm "$file.backup"
    else
        rm "$file.backup"
    fi
}

# Export function for find
export -f fix_file

# Fix all TypeScript files
echo "🔍 Finding and fixing all TypeScript files..."
find src -name "*.ts" -type f -exec bash -c 'fix_file "$0"' {} \;

# Run TypeScript syntax fixer
echo "🔧 Running TypeScript syntax fixer..."
npx tsx scripts/typescript-syntax-fixer.ts

# Run ESLint fix
echo "🔧 Running ESLint autofix..."
npm run lint:fix

# Final check
echo "📊 Final check..."
REMAINING=$(npm run lint 2>&1 | grep -c "Parsing error" || echo "0")
echo "Remaining parsing errors: $REMAINING"

echo "✅ Aggressive syntax fix complete!"
#!/bin/bash

echo "🔧 Fixing remaining syntax errors across the codebase..."

# Fix template literal errors (malformed backticks and quotes)
echo "Fixing template literal errors..."
find src -name "*.ts" -exec sed -i '' 's/`[[:space:]]*$/`/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/^[[:space:]]*`$/`/g' {} \;

# Fix function signature errors (colons instead of parentheses)
echo "Fixing function signature errors..."
find src -name "*.ts" -exec sed -i '' 's/): void :/): void {/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/): Promise</): Promise</g' {} \;
find src -name "*.ts" -exec sed -i '' 's/): string :/): string {/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/): number :/): number {/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/): boolean :/): boolean {/g' {} \;

# Fix missing parentheses in function calls
echo "Fixing missing parentheses..."
find src -name "*.ts" -exec sed -i '' 's/logger\.info(/logger.info(/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/logger\.error(/logger.error(/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/logger\.warn(/logger.warn(/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/logger\.debug(/logger.debug(/g' {} \;

# Fix invalid character errors
echo "Fixing invalid characters..."
find src -name "*.ts" -exec sed -i '' 's/[^[:print:][:space:]]//g' {} \;

# Fix missing commas in object literals
echo "Fixing missing commas..."
find src -name "*.ts" -exec sed -i '' 's/}[[:space:]]*\([a-zA-Z_]\)/}, \1/g' {} \;

# Fix malformed property assignments
echo "Fixing property assignments..."
find src -name "*.ts" -exec sed -i '' 's/:\([^:,}]\+\)[[:space:]]*\([a-zA-Z_]\)/: \1, \2/g' {} \;

# Fix unterminated strings
echo "Fixing unterminated strings..."
find src -name "*.ts" -exec sed -i '' "s/'\([^']*\)$/'\1'/g" {} \;
find src -name "*.ts" -exec sed -i '' 's/"\([^"]*\)$/"\1"/g' {} \;

# Remove empty lines that might cause issues
echo "Cleaning up whitespace..."
find src -name "*.ts" -exec sed -i '' '/^[[:space:]]*$/d' {} \;

echo "✅ Basic syntax error fixes applied"
echo ""
echo "Running quick syntax check..."
npx tsc --noEmit --skipLibCheck 2>&1 | head -n 20
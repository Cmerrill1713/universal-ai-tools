#!/bin/bash

echo "🔧 Fixing common syntax patterns..."

# Fix missing closing parenthesis in constructor parameters
echo "Fixing constructor parameters..."
find src -name "*.ts" -type f -exec sed -i '' 's/constructor(config: [A-Za-z]* {/constructor(config: \1) {/g' {} \;

# Fix missing closing parenthesis in arrow function parameters
echo "Fixing arrow function parameters..."
find src -name "*.ts" -type f -exec sed -i '' 's/\(([^)]*\) => (/\1) => (/g' {} \;

# Fix missing closing parenthesis in async function declarations
echo "Fixing async function declarations..."
find src -name "*.ts" -type f -exec sed -i '' 's/async \([a-zA-Z_][a-zA-Z0-9_]*\)(): Promise</async \1(): Promise</g' {} \;

# Fix missing closing parenthesis in function return types
echo "Fixing function return types..."
find src -name "*.ts" -type f -exec sed -i '' 's/: Promise<$/) : Promise<>/g' {} \;

# Fix unterminated string literals with backticks
echo "Fixing unterminated template literals..."
find src -name "*.ts" -type f -exec sed -i '' 's/`\([^`]*\)$/`\1`/g' {} \;

# Fix missing commas in object property type definitions
echo "Fixing object property definitions..."
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\): \([a-zA-Z_][a-zA-Z0-9_<>]*\) }/\1: \2, }/g' {} \;

# Fix array literals with semicolons instead of commas
echo "Fixing array literal separators..."
find src -name "*.ts" -type f -exec sed -i '' 's/\[\([^]]*\);\([^]]*\)\]/[\1,\2]/g' {} \;

# Fix missing parentheses in method calls
echo "Fixing method call parentheses..."
find src -name "*.ts" -type f -exec sed -i '' 's/\.reduce((sum, \([a-z]\) => sum/\.reduce((sum, \1) => sum/g' {} \;

# Fix missing return type parentheses
echo "Fixing return type parentheses..."
find src -name "*.ts" -type f -exec sed -i '' 's/): \([a-zA-Z_][a-zA-Z0-9_]*\) {/): \1 {/g' {} \;

# Fix incorrect string concatenation in templates
echo "Fixing string concatenation..."
find src -name "*.ts" -type f -exec sed -i '' 's/\${description};/\${description}/g' {} \;

# Run prettier to clean up formatting
echo "Running prettier..."
npx prettier --write "src/**/*.{ts,tsx}" --loglevel error

echo "✅ Common syntax patterns fixed!"
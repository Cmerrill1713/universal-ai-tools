#!/bin/bash

# Fix final remaining syntax errors in server.ts

echo "🔧 Fixing final syntax errors in server.ts..."

# Fix any remaining extra parentheses
sed -i '' 's/throw error);/throw error;/g' src/server.ts

# Fix any remaining missing commas in object literals
sed -i '' 's/stack: error instanceof Error ? error\.stack : undefined$/stack: error instanceof Error ? error.stack : undefined,/g' src/server.ts

# Fix any remaining object property issues
sed -i '' 's/error: error instanceof Error ? error\.message : error$/error: error instanceof Error ? error.message : error,/g' src/server.ts

# Fix any remaining conditional issues
sed -i '' 's/) throw error);/) throw error;/g' src/server.ts

echo "✅ Final syntax errors fixed!"

# Check if there are any remaining issues
echo "Checking for remaining syntax issues..."
if grep -n "throw error);" src/server.ts; then
    echo "❌ Still found 'throw error);' patterns"
else
    echo "✅ No 'throw error);' patterns found"
fi

if grep -n "error instanceof Error ? error\.message : error$" src/server.ts; then
    echo "❌ Still found incomplete error patterns"
else
    echo "✅ No incomplete error patterns found"
fi
#!/bin/bash

echo "🔧 Fixing TypeScript syntax errors..."

# Fix the misplaced 'return undefined;' in athena.ts
echo "Fixing athena.ts..."
sed -i '' '/^[[:space:]]*return undefined;$/d' src/routers/athena.ts

# Fix the chat.ts issues
echo "Fixing chat.ts..."
if [ -f src/routers/chat.ts ]; then
    # Check for specific line 245 issue
    sed -i '' '245s/([^)]*: [^,)]*,/(/g' src/routers/chat.ts 2>/dev/null || true
fi

# Run TypeScript compiler to check remaining errors
echo "Checking remaining TypeScript errors..."
npx tsc --noEmit 2>&1 | grep -E "error TS" | wc -l
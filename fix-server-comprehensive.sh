#!/bin/bash

echo "Comprehensive fix for server.ts..."

# Backup
cp src/server.ts src/server.ts.backup-$(date +%Y%m%d_%H%M%S)

# Fix 1: Remove problematic template literal endings
echo "Fixing template literal issues..."
sed -i '' 's/\`\`,\`/\`,/g' src/server.ts
sed -i '' 's/\`\`;\`/\`;/g' src/server.ts
sed -i '' 's/\`;\`/\`;/g' src/server.ts
sed -i '' 's/\`);\`/\`);/g' src/server.ts
sed -i '' 's/\`,\`/\`,/g' src/server.ts

# Fix 2: Fix specific known issues
echo "Fixing specific syntax errors..."
# Fix the apiKeyPrefix line
sed -i '' '268s/\`,$//g' src/server.ts

# Fix 3: Check for other common patterns
echo "Checking for other syntax issues..."

# Find all backtick issues
echo "Backtick issues:"
grep -n '`[,;]`' src/server.ts || echo "None found"

# Find unterminated template literals
echo -e "\nUnterminated template literals:"
grep -n '`[^`]*$' src/server.ts | grep -v '//' || echo "None found"

# Fix 4: Run TypeScript check
echo -e "\nRunning TypeScript check..."
npx tsc --noEmit --skipLibCheck src/server.ts 2>&1 | head -20

# Fix 5: Try to start the server
echo -e "\nTrying to start server..."
timeout 5 npx tsx src/server.ts 2>&1 | head -20
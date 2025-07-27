#!/bin/bash

echo "Creating a fixed version of server.ts without emoji issues..."

# Copy the file
cp src/server.ts src/server-fixed.ts

# Replace problematic emojis in console.log statements
sed -i '' 's/`❌/`[ERROR]/g' src/server-fixed.ts
sed -i '' 's/`✅/`[OK]/g' src/server-fixed.ts
sed -i '' 's/`🔄/`[LOADING]/g' src/server-fixed.ts

echo "Testing the fixed server..."
npx tsx src/server-fixed.ts
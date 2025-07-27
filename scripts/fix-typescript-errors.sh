#!/bin/bash

echo "Fixing TypeScript parsing errors..."

# Fix extra parentheses patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/throw error);$/throw error;/g'

# Fix missing commas in object literals
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/error: error$/error: error,/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/message: error$/message: error,/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/data: error$/data: error,/g'

# Fix unterminated strings in common patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s/'_analysis;/'analysis';/g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s/'error;/'error';/g"

# Fix property access patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/\.includes(/.includes(/g'

# Fix malformed error messages
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/Failed to.*:, error);/Failed to:', error);/g'

# Fix _context parameter issues
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/private.*(_context:/private \\1(context:/g'

echo "TypeScript parsing errors fixed!"
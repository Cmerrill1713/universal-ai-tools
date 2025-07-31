#!/bin/bash
# Progressive validation script
# Validates code incrementally to catch errors early

echo "🔄 Starting progressive validation..."

# Check only changed files
CHANGED_FILES=$(git diff --name-only HEAD | grep -E '\.(ts|tsx)$')

if [ -z "$CHANGED_FILES" ]; then
  echo "✅ No TypeScript changes to validate"
  exit 0
fi

echo "📝 Validating changed files..."
for file in $CHANGED_FILES; do
  if [ -f "$file" ]; then
    echo -n "  Checking $file... "
    npx tsc --noEmit --skipLibCheck "$file" 2>/tmp/tsc-single.log
    if [ $? -eq 0 ]; then
      echo "✅"
    else
      echo "❌"
      cat /tmp/tsc-single.log
    fi
  fi
done

echo ""
echo "🏗️ Running full build check..."
npm run build

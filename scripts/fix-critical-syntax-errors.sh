#!/bin/bash

# Fix critical syntax errors preventing server startup

echo "🔧 Fixing critical syntax errors..."

# Fix server.ts logger error patterns - add missing commas
echo "Fixing server.ts logger patterns..."
sed -i '' 's/error: error instanceof Error ? error\.message : error$/error: error instanceof Error ? error.message : error,/g' src/server.ts
sed -i '' 's/stack: error instanceof Error ? error\.stack : undefined,$/stack: error instanceof Error ? error.stack : undefined/g' src/server.ts

# Fix memory.ts content errors
echo "Fixing memory.ts content errors..."
if [ -f "src/routers/memory.ts" ]; then
    sed -i '' 's/contenttrim/content.trim/g' src/routers/memory.ts
    sed -i '' 's/content-length/content.length/g' src/routers/memory.ts
fi

# Fix orchestration.ts import/validation errors
echo "Fixing orchestration.ts validation schema..."
if [ -f "src/routers/orchestration.ts" ]; then
    sed -i '' 's/{ z$/{ z }/g' src/routers/orchestration.ts
    sed -i '' 's/import { z$/import { z }/g' src/routers/orchestration.ts
fi

# Fix common object destructuring errors
echo "Fixing destructuring errors..."
find src -name "*.ts" -exec sed -i '' 's/error count/error, count/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/data error/data, error/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/tools error/tools, error/g' {} \;

# Fix missing parentheses in conditions
echo "Fixing conditional parentheses..."
find src -name "*.ts" -exec sed -i '' 's/if (!.*[^)]{$/&)/g' {} \;

echo "✅ Critical syntax errors fixed!"
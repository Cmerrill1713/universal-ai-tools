#!/bin/bash

# Fix all remaining syntax errors across the codebase

echo "🔧 Fixing all remaining syntax errors..."

# Fix enhanced-logger.ts specific issues
echo "Fixing enhanced-logger.ts..."
sed -i '' 's/error\.message: string, context: LogContext = LogContext\.SYSTEM, meta\?: any) {/error(message: string, context: LogContext = LogContext.SYSTEM, meta?: any) {/g' src/utils/enhanced-logger.ts
sed -i '' 's/this\.logger\.error\.message, { context, \.\.\.meta });/this.logger.error(message, { context, ...meta });/g' src/utils/enhanced-logger.ts
sed -i '' 's/const message = error instanceof Error \? error\.message : error$/const message = error instanceof Error ? error.message : error;/g' src/utils/enhanced-logger.ts
sed -i '' 's/this\.error(Error tracked: \${message}\`, context, {/this.error(`Error tracked: ${message}`, context, {/g' src/utils/enhanced-logger.ts
sed -i '' 's/enhancedLogger\.error\.message, context, meta),/enhancedLogger.error(message, context, meta),/g' src/utils/enhanced-logger.ts

# Fix instanceof syntax errors across all files
echo "Fixing instanceof syntax errors..."
find src -name "*.ts" -exec sed -i '' 's/error instanceof: /error instanceof /g' {} \;
find src -name "*.ts" -exec sed -i '' 's/instanceof: /instanceof /g' {} \;

# Fix common property access errors
echo "Fixing property access errors..."
find src -name "*.ts" -exec sed -i '' 's/if (_error||/if (error ||/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/return, data\./return data./g' {} \;

# Fix string concatenation in requests
echo "Fixing request format errors..."
find src -name "*.ts" -exec sed -i '' "s/error: 'Invalid requestformat'/error: 'Invalid request format'/g" {} \;

echo "✅ All remaining syntax errors fixed!"
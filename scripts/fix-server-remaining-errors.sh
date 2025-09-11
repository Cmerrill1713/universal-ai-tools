#!/bin/bash

# Fix remaining syntax errors in server.ts

SERVER_FILE="src/server.ts"

echo "Fixing remaining syntax errors in $SERVER_FILE..."

# Fix logger error patterns - remove extra commas and fix syntax
sed -i '' 's/error: error instanceof Error ? error\.message : error,/error: error instanceof Error ? error.message : error/g' "$SERVER_FILE"
sed -i '' 's/error: error instanceof Error ? error\.message : error}/error: error instanceof Error ? error.message : error }/g' "$SERVER_FILE"
sed -i '' 's/{ error: }/{ error }/g' "$SERVER_FILE"
sed -i '' 's/{ error:}/{ error }/g' "$SERVER_FILE"

# Fix object property syntax errors
sed -i '' 's/userId: (req as any)\.user\?\.id,/userId: (req as any).user?.id/g' "$SERVER_FILE"
sed -i '' 's/userRole,/userRole/g' "$SERVER_FILE"

# Fix any remaining { error:} patterns
sed -i '' 's/{ error:}/{ error }/g' "$SERVER_FILE"

# Fix any remaining comma issues in object literals
sed -i '' 's/: error,$/: error/g' "$SERVER_FILE"

echo "✅ Fixed remaining syntax errors in server.ts"
#!/bin/bash

# Comprehensive fix for all syntax errors in server.ts

# Backup the original file
cp src/server.ts src/server.ts.backup2

# Fix line 342 - error: error should be just error
sed -i '' '342s/error: error/error/' src/server.ts

# Fix line 450 - malformed if statement
sed -i '' '450s/if (    logger\.error.*$/    logger.error('\''Authentication error'\'', LogContext.SECURITY, { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });/' src/server.ts

# Fix missing commas after error.message : error/String(error
sed -i '' 's/error instanceof Error ? error\.message : error$/error instanceof Error ? error.message : error,/g' src/server.ts
sed -i '' 's/error instanceof Error ? error\.message : String(error$/error instanceof Error ? error.message : String(error),/g' src/server.ts
sed -i '' 's/error instanceof Error ? error\.message : String(error,$/error instanceof Error ? error.message : String(error),/g' src/server.ts

# Fix line 127 - missing closing parenthesis
sed -i '' '127s/String(error,$/String(error)/' src/server.ts

# Fix line 1728 - extra spacing in destructuring
sed -i '' '1728s/{ error: error }/{ error }/' src/server.ts

# Fix all instances where String(error is missing closing parenthesis
sed -i '' 's/String(error,$/String(error),/g' src/server.ts

echo "Fixed all syntax errors in server.ts"
echo "Backup saved as server.ts.backup2"
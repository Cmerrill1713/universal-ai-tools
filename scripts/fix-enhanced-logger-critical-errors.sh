#!/bin/bash

# Fix critical syntax errors in enhanced-logger.ts

echo "🔧 Fixing enhanced-logger.ts critical syntax errors..."

LOGGER_FILE="src/utils/enhanced-logger.ts"

# Fix line 290 - parameter syntax error
sed -i '' 's/_error: : Error | string,/error: Error | string,/g' "$LOGGER_FILE"

# Fix line 296 - constructor reference
sed -i '' 's/_errorconstructor\.name/error.constructor.name/g' "$LOGGER_FILE"

# Fix line 297 - method reference syntax
sed -i '' 's/error(message/error.message/g' "$LOGGER_FILE"
sed -i '' 's/error(stack/error.stack/g' "$LOGGER_FILE"

# Fix line 313 - method call syntax 
sed -i '' 's/this\._error`/this.error(/g' "$LOGGER_FILE"

# Fix line 352 - property reference
sed -i '' 's/userinput userInput/user_input: userInput/g' "$LOGGER_FILE"

# Fix line 367 - conditional syntax
sed -i '' 's/if (    const level = statusCode >= 400) { return '\''_error; } else if (statusCode >= 300) { return '\''warn'\''; } else { return '\''info'\''; }/const level = statusCode >= 400 ? '\''error'\'' : statusCode >= 300 ? '\''warn'\'' : '\''info'\'';/g' "$LOGGER_FILE"

# Fix line 408 - conditional syntax
sed -i '' 's/if (    const level = severity === '\''critical'\'' ? '\''error'\''; } else if (severity === '\''high'\'') { return '\''warn'\''; } else { return '\''info'\''; }/const level = severity === '\''critical'\'' ? '\''error'\'' : severity === '\''high'\'' ? '\''warn'\'' : '\''info'\'';/g' "$LOGGER_FILE"

# Fix line 437 & 442 - comment references
sed -i '' 's/_errorstatistics/error statistics/g' "$LOGGER_FILE"
sed -i '' 's/_errorcounts/error counts/g' "$LOGGER_FILE"

# Fix line 488-489 - function call syntax
sed -i '' 's/trackError: (error Error | string, context: LogContext, metadata\?: Record<string, unknown>) =>/trackError: (error: Error | string, context: LogContext, metadata?: Record<string, unknown>) =>/g' "$LOGGER_FILE"
sed -i '' 's/enhancedLogger\.trackError(_error context, metadata)/enhancedLogger.trackError(error, context, metadata)/g' "$LOGGER_FILE"

echo "✅ Enhanced logger critical errors fixed!"
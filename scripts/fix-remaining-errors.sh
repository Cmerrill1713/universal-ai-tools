#!/bin/bash

# Fix remaining syntax errors that were missed

echo "Fixing remaining syntax errors..."

# Fix unterminated strings and missing quotes
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Fix _analysis patterns
  sed -i '' 's/meta__analysis/meta_analysis/g' "$file"
  sed -i '' 's/_analysisof/analysis of/g' "$file"
  
  # Fix _input patterns
  sed -i '' 's/user__input/user_input/g' "$file"
  sed -i '' 's/_input /input /g' "$file"
  sed -i '' 's/_content/content/g' "$file"
  
  # Fix request patterns
  sed -i '' 's/_request/request/g' "$file"
  sed -i '' 's/_requesttype/request.type/g' "$file"
  sed -i '' 's/_requestto/request to/g' "$file"
  
  # Fix module patterns
  sed -i '' 's/module__analysis/module_analysis/g' "$file"
  sed -i '' 's/module_import_error/module_import_error/g' "$file"
  
  # Fix resource patterns
  sed -i '' 's/resource__request/resource_request/g' "$file"
  sed -i '' 's/coordination__request/coordination_request/g' "$file"
  
  # Fix error patterns in specific contexts
  sed -i '' 's/\. _error/. error/g' "$file"
  sed -i '' 's/, _error/, error/g' "$file"
  sed -i '' 's/: _error/: error/g' "$file"
  
  # Fix content patterns
  sed -i '' 's/_contentlength/content-length/g' "$file"
  sed -i '' 's/_contenttype/content-type/g' "$file"
  sed -i '' 's/_contentstateUpdate/content.stateUpdate/g' "$file"
  sed -i '' 's/_contentrequest/content.request/g' "$file"
  sed -i '' 's/_contenttaskId/content.taskId/g' "$file"
  
  # Fix specific remaining error patterns
  sed -i '' 's/error instanceof/error instanceof/g' "$file"
  sed -i '' 's/\berror\./error./g' "$file"
  
  # Fix LogLevel and LogContext enums
  sed -i '' "s/ERROR = '_error/ERROR = 'error'/g" "$file"
  sed -i '' "s/LogContext.ERROR = '_error/LogContext.ERROR = 'error'/g" "$file"
  
  # Fix status enums
  sed -i '' "s/'error | 'pending'/'error' | 'pending'/g" "$file"
  sed -i '' "s/case 'error:/case 'error':/g" "$file"
  sed -i '' "s/type: 'error,/type: 'error',/g" "$file"
  
  # Fix severity patterns
  sed -i '' "s/severity: '_error/severity: 'error'/g" "$file"
  sed -i '' "s/const level = severity === 'critical') { return '_error/const level = severity === 'critical' ? 'error'/g" "$file"
  sed -i '' "s/const level = status === 'fail' ? '_error/const level = status === 'fail' ? 'error'/g" "$file"
  
  # Fix database error patterns
  sed -i '' 's/Database select _erroron/Database select error on/g' "$file"
  sed -i '' 's/Database insert _erroron/Database insert error on/g' "$file"
  sed -i '' 's/Database update _erroron/Database update error on/g' "$file"
  sed -i '' 's/Database delete _erroron/Database delete error on/g' "$file"
  sed -i '' 's/Database upsert _erroron/Database upsert error on/g' "$file"
  sed -i '' 's/Database RPC _errorfor/Database RPC error for/g' "$file"
  
  # Fix logging patterns
  sed -i '' 's/logger\.error`/logger.error(/g' "$file"
  sed -i '' 's/logger\.warn`/logger.warn(/g' "$file"
  sed -i '' 's/logger\.info`/logger.info(/g' "$file"
  
  # Fix template literal issues
  sed -i '' 's/`, _error/`, error/g' "$file"
  sed -i '' 's/", _error/", error/g' "$file"
  
  # Fix specific patterns in auth files
  sed -i '' 's/Authentication _error/Authentication error/g' "$file"
  sed -i '' 's/Registration _error/Registration error/g' "$file"
  sed -i '' 's/Login _error/Login error/g' "$file"
  sed -i '' 's/Token refresh _error/Token refresh error/g' "$file"
  sed -i '' 's/Logout _error/Logout error/g' "$file"
  sed -i '' 's/Get sessions _error/Get sessions error/g' "$file"
  sed -i '' 's/Revoke session _error/Revoke session error/g' "$file"
  sed -i '' 's/Get security info _error/Get security info error/g' "$file"
  sed -i '' 's/Change password _error/Change password error/g' "$file"
  sed -i '' 's/Get profile _error/Get profile error/g' "$file"
  
  # Fix response patterns
  sed -i '' 's/Internal server _error/Internal server error/g' "$file"
  sed -i '' 's/server _errorduring/server error during/g' "$file"
  sed -i '' 's/server _error/server error/g' "$file"
  sed -i '' 's/Invalid _request/Invalid request/g' "$file"
  sed -i '' 's/Your _requestcontains/Your request contains/g' "$file"
  sed -i '' 's/potentially malicious _content/potentially malicious content/g' "$file"
  sed -i '' 's/Invalid _inputdetected/Invalid input detected/g' "$file"
  sed -i '' 's/Invalid _input/Invalid input/g' "$file"
  sed -i '' 's/malicious _content/malicious content/g' "$file"
  
  # Fix performance error patterns
  sed -i '' 's/Cache get _error/Cache get error/g' "$file"
  sed -i '' 's/Cache set _error/Cache set error/g' "$file"
  sed -i '' 's/Cache delete _error/Cache delete error/g' "$file"
  sed -i '' 's/Cache invalidate by tags _error/Cache invalidate by tags error/g' "$file"
  sed -i '' 's/Cache clear _error/Cache clear error/g' "$file"
  sed -i '' 's/Cache stats _error/Cache stats error/g' "$file"
  
  # Fix Redis patterns
  sed -i '' 's/Redis connection _error/Redis connection error/g' "$file"
  sed -i '' 's/Redis _error/Redis error/g' "$file"
  sed -i '' 's/Redis WebSocket _error/Redis WebSocket error/g' "$file"
  sed -i '' 's/Redis cluster _error/Redis cluster error/g' "$file"
  sed -i '' 's/Redis cluster node _error/Redis cluster node error/g' "$file"
  
  # Fix MCP patterns
  sed -i '' 's/MCP WebSocket _error/MCP WebSocket error/g' "$file"
  sed -i '' 's/execute:_request/execute:request/g' "$file"
  
  # Fix misc patterns
  sed -i '' 's/_errortracking/error tracking/g' "$file"
  sed -i '' 's/_errorrecovery/error recovery/g' "$file"
  sed -i '' 's/Client _error/Client error/g' "$file"
  sed -i '' 's/Unknown _error/Unknown error/g' "$file"
  sed -i '' 's/Validation processor _error/Validation processor error/g' "$file"
  sed -i '' 's/Database validation _error/Database validation error/g' "$file"
done

# Fix enhanced-logger.ts specifically
echo "Fixing enhanced-logger.ts..."
sed -i '' 's/error\./error(/g' src/utils/enhanced-logger.ts
sed -i '' 's/_error\(message/error(message/g' src/utils/enhanced-logger.ts
sed -i '' 's/this\.logger\.errormessage/this.logger.error(message/g' src/utils/enhanced-logger.ts
sed -i '' 's/trackError: (_error/trackError: (error/g' src/utils/enhanced-logger.ts
sed -i '' 's/logConversationTurn(/_error/logConversationTurn(error/g' src/utils/enhanced-logger.ts

echo "Fixing remaining syntax errors completed!"
#!/bin/bash

echo "Fixing common parsing errors..."

# Fix unterminated analysis patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/_analysisfailed/analysis failed/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/_analysisof/analysis of/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/meta__analysis/meta_analysis/g'

# Fix missing semicolons in error logs
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/error;$/error);/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/error:, error;/error:', error);/g'

# Fix content patterns  
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/_contentstateUpdate/content.stateUpdate/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/_contentrequest/content.request/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/_contenttaskId/content.taskId/g'

# Fix request patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/_requestcontains/request contains/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/_requestto/request to/g'

# Fix input patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/_inputdetected/input detected/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/user__input/user_input/g'

# Fix error tracking patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/_errortracking/error tracking/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/_errorrecovery/error recovery/g'

# Fix resource patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/resource__request/resource_request/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/coordination__request/coordination_request/g'

# Fix module patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/module__analysis/module_analysis/g'

echo "Common parsing errors fixed!"
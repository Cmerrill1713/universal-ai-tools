#!/bin/bash

echo "Fixing specific syntax errors identified..."

# Fix _error patterns in specific files
files_with_error=(
  "src/services/backup-recovery-service.ts"
  "src/services/cache-versioning.ts"
  "src/services/universal_llm_orchestrator.ts"
  "src/services/dspy-service.ts"
  "src/services/knowledge-feedback-service.ts"
  "src/services/knowledge-update-automation.ts"
  "src/services/enhanced-context-service.ts"
  "src/services/sweet-athena-websocket.ts"
  "src/services/filesystem-service.ts"
  "src/services/mlx_fine_tuning_service.ts"
  "src/services/kokoro-tts-service.ts"
  "src/services/supabase_service.ts"
  "src/services/production-cache-manager.ts"
)

for file in "${files_with_error[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing _error patterns in $file..."
    # Fix _error patterns
    sed -i '' 's/_error /error /g' "$file"
    sed -i '' 's/_error$/error/g' "$file"
    sed -i '' 's/_error\./error\./g' "$file"
    sed -i '' 's/_error,/error,/g' "$file"
    sed -i '' 's/_error;/error;/g' "$file"
    sed -i '' 's/_error)/error)/g' "$file"
    sed -i '' 's/if (_error /if (error /g' "$file"
    sed -i '' 's/if (_error$/if (error/g' "$file"
    sed -i '' 's/_errorcode/error\.code/g' "$file"
    sed -i '' 's/_errormessage/error\.message/g' "$file"
    
    # Fix specific patterns
    sed -i '' 's/if (_error throw error;/if (error) throw error;/g' "$file"
    sed -i '' "s/gzip\.on('_error,/gzip.on('error',/g" "$file"
    sed -i '' "s/gunzip\.on('_error,/gunzip.on('error',/g" "$file"
    sed -i '' 's/_error&&/error \&\&/g' "$file"
    sed -i '' 's/_pattern_pattern/pattern/g' "$file"
  fi
done

# Fix unterminated template literals
echo "Fixing unterminated template literals..."

# Fix specific known issues
sed -i '' 's/`${type}:${_pattern_pattern`/`${type}:${pattern}`/g' src/services/knowledge-feedback-service.ts 2>/dev/null || true

# Fix missing colons in object literals
echo "Fixing missing colons in object literals..."
sed -i '' 's/content `/content: `/g' src/services/athena-tool-integration.ts 2>/dev/null || true

# Fix common patterns across all TypeScript files
echo "Applying general fixes..."
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Fix _error patterns more comprehensively
  sed -i '' 's/\b_error\b/error/g' "$file"
  
  # Fix common if statement issues
  sed -i '' 's/if (error throw error;/if (error) throw error;/g' "$file"
  
  # Fix common template literal issues
  sed -i '' 's/`[^`]*_error[^`]*`/&/g' "$file"
done

echo "Specific syntax errors fixed!"
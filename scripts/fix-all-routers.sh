#!/bin/bash

echo "Fixing all syntax errors in router files..."

# Fix common patterns in all router files
find src/routers -name "*.ts" | while read file; do
  echo "Fixing $file..."
  
  # Fix error patterns
  sed -i '' 's/_error /error /g' "$file"
  sed -i '' 's/_error$/error/g' "$file"
  sed -i '' 's/_errorresponses/error responses/g' "$file"
  sed -i '' 's/_errorhandling/error handling/g' "$file"
  sed -i '' 's/_erroron/error on/g' "$file"
  
  # Fix object destructuring
  sed -i '' 's/error}/error }/g' "$file"
  sed -i '' 's/error:/error:/g' "$file"
  sed -i '' 's/{ error:}/{ error }/g' "$file"
  
  # Fix if statements
  sed -i '' 's/if (error: /if (error) /g' "$file"
  sed -i '' 's/if (!content {/if (!content) {/g' "$file"
  
  # Fix property access
  sed -i '' 's/content-length/content.length/g' "$file"
  sed -i '' 's/typeof content!==/typeof content !==/g' "$file"
  
  # Fix logger calls
  sed -i '' 's/logger\.error(/logger.error(/g' "$file"
  sed -i '' 's/{ error:})/{ error })/g' "$file"
  
  # Fix common destructuring issues
  sed -i '' 's/const { data, error} =/const { data, error } =/g' "$file"
  sed -i '' 's/const { error:} =/const { error } =/g' "$file"
  sed -i '' 's/const { data, error: serviceError} =/const { data, error: serviceError } =/g' "$file"
done

echo "Router files fixed!"
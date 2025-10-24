#!/bin/bash

echo "Fixing parsing errors..."

# Fix unterminated string literals
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Fix 'meta__analysis patterns
  sed -i '' "s/'meta__analysis,/'meta_analysis',/g" "$file"
  sed -i '' "s/'meta__analysis/'meta_analysis'/g" "$file"
  
  # Fix unterminated strings
  sed -i '' "s/error: '/error: '/g" "$file"
  sed -i '' "s/message: '/message: '/g" "$file"
  
  # Fix missing commas in object literals
  sed -i '' 's/error: error\.message$/error: error.message,/g' "$file"
  sed -i '' 's/error: error$/error: error,/g' "$file"
  
  # Fix _contenttype and _contentlength
  sed -i '' 's/_contenttype/content-type/g' "$file"
  sed -i '' 's/_contentlength/content-length/g' "$file"
  sed -i '' 's/contenttype/content-type/g' "$file"
  sed -i '' 's/contentlength/content-length/g' "$file"
  
  # Fix _requesttype patterns
  sed -i '' 's/_requesttype/request.type/g' "$file"
  sed -i '' 's/_requestdetails/request details/g' "$file"
  
  # Fix _erroron patterns
  sed -i '' 's/_erroron/error on/g' "$file"
  sed -i '' 's/_errorfor/error for/g' "$file"
  sed -i '' 's/_errorduring/error during/g' "$file"
  
  # Fix execute:_request patterns
  sed -i '' 's/execute:_request/execute:request/g' "$file"
  
  # Fix Invalid patterns
  sed -i '' 's/Invalid _request/Invalid request/g' "$file"
  sed -i '' 's/Invalid _input/Invalid input/g' "$file"
  sed -i '' 's/Your _request/Your request/g' "$file"
  
  # Fix missing closing quotes
  sed -i '' "s/error: 'Invalid input,/error: 'Invalid input',/g" "$file"
  sed -i '' "s/message: 'Request contains invalid or malicious content,/message: 'Request contains invalid or malicious content',/g" "$file"
done

echo "Fixing parsing errors completed!"
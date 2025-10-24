#!/bin/bash

echo "======================================"
echo "Comprehensive Syntax Error Auto-Fix"
echo "======================================"

# Function to fix files
fix_file() {
    local file=$1
    echo "Fixing: $file"
    
    # Fix _error patterns
    sed -i '' 's/_error:/_error:/g' "$file"
    sed -i '' 's/_error /_error /g' "$file"
    sed -i '' 's/_erroras/error as/g' "$file"
    sed -i '' 's/_error\./error./g' "$file"
    sed -i '' 's/_errorinstanceof/error instanceof/g' "$file"
    sed -i '' 's/_errormessage/error.message/g' "$file"
    sed -i '' 's/_errorCode/errorCode/g' "$file"
    sed -i '' 's/_errorMessage/errorMessage/g' "$file"
    
    # Fix content patterns
    sed -i '' 's/content-length/content.length/g' "$file"
    sed -i '' 's/content-type/content.type/g' "$file"
    sed -i '' 's/headers-content-type/headers["content-type"]/g' "$file"
    
    # Fix user patterns
    sed -i '' 's/user__input/user_input/g' "$file"
    sed -i '' 's/user__analysis/user_analysis/g' "$file"
    
    # Fix request patterns
    sed -i '' 's/_request /_request /g' "$file"
    sed -i '' 's/_requestto/request to/g' "$file"
    sed -i '' 's/execute:_request/execute:request/g' "$file"
    
    # Fix object property syntax
    sed -i '' 's/, _error/, error:/g' "$file"
    sed -i '' 's/{_error/{error:/g' "$file"
    sed -i '' 's/ _error}/ error}/g' "$file"
    
    # Fix logger patterns
    sed -i '' 's/{ error:}/{ error }/g' "$file"
    sed -i '' 's/{ error: }/{ error }/g' "$file"
    
    # Fix specific patterns
    sed -i '' 's/reject(_error)/reject(error)/g' "$file"
    sed -i '' 's/throw _error/throw error/g' "$file"
    sed -i '' 's/Promise.reject(_error)/Promise.reject(error)/g' "$file"
    
    # Fix analysis patterns  
    sed -i '' 's/__analysis/_analysis/g' "$file"
    sed -i '' 's/__pattern/_pattern/g' "$file"
    
    # Fix unterminated strings in capabilities
    sed -i '' "s/'analyzecontent/'analyze_content'/g" "$file"
    sed -i '' "s/'apirequest/'api_request'/g" "$file"
    sed -i '' "s/'critical__analysis/'critical_analysis'/g" "$file"
    sed -i '' "s/'performance__analysis/'performance_analysis'/g" "$file"
    sed -i '' "s/'ethical__analysis/'ethical_analysis'/g" "$file"
    sed -i '' "s/'cognitive__analysis/'cognitive_analysis'/g" "$file"
    sed -i '' "s/'web__analysis/'web_analysis'/g" "$file"
    sed -i '' "s/'requirements__analysis/'requirements_analysis'/g" "$file"
}

# Find and fix all TypeScript files
echo "Finding files with syntax errors..."
files=$(find src -name "*.ts" -type f -exec grep -l "_error\|content-length\|content-type\|_request\|user__input\|__analysis\|__pattern\|analyzecontent\|apirequest" {} \;)

total=$(echo "$files" | wc -l | tr -d ' ')
echo "Found $total files to fix"

count=0
for file in $files; do
    ((count++))
    echo "[$count/$total] Processing: $file"
    fix_file "$file"
done

echo ""
echo "======================================"
echo "Syntax fixes completed!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Run: npm run lint:fix"
echo "2. Run: npm run dev"
echo "3. Check for any remaining errors"
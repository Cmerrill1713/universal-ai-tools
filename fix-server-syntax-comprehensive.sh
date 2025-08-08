#!/bin/bash

echo "🔧 Comprehensive server.ts syntax fixes..."

FILE="src/server.ts"

if [ -f "$FILE" ]; then
    echo "Fixing $FILE..."
    
    # Fix decimal numbers with optional chaining corruption
    sed -i '' 's/0?\.\([0-9]\)/0.\1/g' "$FILE"
    sed -i '' 's/1?\.\([0-9]\)/1.\1/g' "$FILE"
    sed -i '' 's/2?\.\([0-9]\)/2.\1/g' "$FILE"
    sed -i '' 's/3?\.\([0-9]\)/3.\1/g' "$FILE"
    sed -i '' 's/4?\.\([0-9]\)/4.\1/g' "$FILE"
    sed -i '' 's/5?\.\([0-9]\)/5.\1/g' "$FILE"
    sed -i '' 's/6?\.\([0-9]\)/6.\1/g' "$FILE"
    sed -i '' 's/7?\.\([0-9]\)/7.\1/g' "$FILE"
    sed -i '' 's/8?\.\([0-9]\)/8.\1/g' "$FILE"
    sed -i '' 's/9?\.\([0-9]\)/9.\1/g' "$FILE"
    
    # Fix broken import statements with corrupted quotes
    sed -i '' "s/''/'/g" "$FILE"
    sed -i '' 's/"""/"/g' "$FILE"
    
    # Fix optional chaining on literals that should not have it
    sed -i '' 's/app?\./app\./g' "$FILE"
    sed -i '' 's/this?\./this\./g' "$FILE"
    sed -i '' 's/process?\./process\./g' "$FILE"
    sed -i '' 's/server?\./server\./g' "$FILE"
    sed -i '' 's/io?\./io\./g' "$FILE"
    sed -i '' 's/supabase?\./supabase\./g' "$FILE"
    sed -i '' 's/agentRegistry?\./agentRegistry\./g' "$FILE"
    sed -i '' 's/timeoutManager?\./timeoutManager\./g' "$FILE"
    sed -i '' 's/log?\./log\./g' "$FILE"
    sed -i '' 's/req?\./req\./g' "$FILE"
    sed -i '' 's/res?\./res\./g' "$FILE"
    sed -i '' 's/socket?\./socket\./g' "$FILE"
    sed -i '' 's/Date?\./Date\./g' "$FILE"
    sed -i '' 's/Math?\./Math\./g' "$FILE"
    sed -i '' 's/Buffer?\./Buffer\./g' "$FILE"
    sed -i '' 's/JSON?\./JSON\./g' "$FILE"
    sed -i '' 's/Array?\./Array\./g' "$FILE"
    sed -i '' 's/String?\./String\./g' "$FILE"
    sed -i '' 's/Error?\./Error\./g' "$FILE"
    
    # Fix broken method calls
    sed -i '' 's/app?\.get(/app\.get(/g' "$FILE"
    sed -i '' 's/app?\.post(/app\.post(/g' "$FILE"
    sed -i '' 's/app?\.use(/app\.use(/g' "$FILE"
    sed -i '' 's/res?\.json(/res\.json(/g' "$FILE"
    sed -i '' 's/res?\.status(/res\.status(/g' "$FILE"
    sed -i '' 's/req?\.body/req\.body/g' "$FILE"
    sed -i '' 's/req?\.headers/req\.headers/g' "$FILE"
    
    # Fix broken string literals and quotes
    sed -i '' "s/'/'/g" "$FILE"
    sed -i '' 's/file: \/\//file:\/\//g' "$FILE"
    sed -i '' 's/http: \/\//http:\/\//g' "$FILE"
    sed -i '' 's/https: \/\//https:\/\//g' "$FILE"
    
    # Fix broken object syntax
    sed -i '' 's/{,/{/g' "$FILE"
    sed -i '' 's/},$/}/g' "$FILE"
    sed -i '' 's/];$/]/g' "$FILE"
    sed -i '' 's/);$/)/g' "$FILE"
    
    # Fix import statements
    sed -i '' "s/) => {'/){ /g" "$FILE"
    sed -i '' "s/},'/}/g" "$FILE"
    
    # Fix broken semicolons and quotes at end of lines
    sed -i '' "s/'$/'/g" "$FILE"
    sed -i '' "s/';$/';/g" "$FILE"
    sed -i '' "s/,'/,/g" "$FILE"
    
    # Fix specific broken patterns
    sed -i '' 's/LogContext?\.API/LogContext\.API/g' "$FILE"
    sed -i '' 's/LogContext?\.DATABASE/LogContext\.DATABASE/g' "$FILE"
    sed -i '' 's/LogContext?\.SERVER/LogContext\.SERVER/g' "$FILE"
    sed -i '' 's/LogContext?\.WEBSOCKET/LogContext\.WEBSOCKET/g' "$FILE"
    sed -i '' 's/LogContext?\.SYSTEM/LogContext\.SYSTEM/g' "$FILE"
    sed -i '' 's/LogContext?\.AI/LogContext\.AI/g' "$FILE"
    sed -i '' 's/LogContext?\.MCP/LogContext\.MCP/g' "$FILE"
    sed -i '' 's/LogContext?\.AGENT/LogContext\.AGENT/g' "$FILE"
    
    echo "✅ Fixed $FILE"
else
    echo "⚠️  File not found: $FILE"
fi

echo "🎉 Server syntax fixes complete!"
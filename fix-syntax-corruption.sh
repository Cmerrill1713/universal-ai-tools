#!/bin/bash

# Fix widespread syntax corruption in Universal AI Tools codebase
# This script fixes invalid optional chaining operators (?.) that prevent compilation

echo "🔧 Fixing syntax corruption in Universal AI Tools codebase..."

# Function to fix patterns in a file
fix_file() {
    local file="$1"
    if [[ -f "$file" && "$file" == *.ts && "$file" != *node_modules* ]]; then
        echo "Fixing: $file"
        
        # Fix numeric literals (most common pattern)
        sed -i '' 's/0?\.0/0.0/g' "$file"
        sed -i '' 's/0?\.1/0.1/g' "$file"
        sed -i '' 's/0?\.2/0.2/g' "$file"
        sed -i '' 's/0?\.3/0.3/g' "$file"
        sed -i '' 's/0?\.4/0.4/g' "$file"
        sed -i '' 's/0?\.5/0.5/g' "$file"
        sed -i '' 's/0?\.6/0.6/g' "$file"
        sed -i '' 's/0?\.7/0.7/g' "$file"
        sed -i '' 's/0?\.8/0.8/g' "$file"
        sed -i '' 's/0?\.9/0.9/g' "$file"
        sed -i '' 's/1?\.0/1.0/g' "$file"
        sed -i '' 's/1?\.1/1.1/g' "$file"
        sed -i '' 's/1?\.2/1.2/g' "$file"
        sed -i '' 's/1?\.3/1.3/g' "$file"
        sed -i '' 's/1?\.4/1.4/g' "$file"
        sed -i '' 's/1?\.5/1.5/g' "$file"
        sed -i '' 's/1?\.8/1.8/g' "$file"
        sed -i '' 's/2?\.0/2.0/g' "$file"
        
        # Fix import statements
        sed -i '' "s/'socket?\.io'/'socket.io'/g" "$file"
        sed -i '' 's/from \x27socket?\.io\x27/from \x27socket.io\x27/g' "$file"
        
        # Fix type declarations
        sed -i '' 's/express?\.Application/express.Application/g' "$file"
        sed -i '' 's/express?\.Router/express.Router/g' "$file"
        sed -i '' 's/express?\.Request/express.Request/g' "$file"
        sed -i '' 's/express?\.Response/express.Response/g' "$file"
        
        # Fix object method calls and property access
        sed -i '' 's/this?\.app/this.app/g' "$file"
        sed -i '' 's/this?\.server/this.server/g' "$file"
        sed -i '' 's/this?\.io/this.io/g' "$file"
        sed -i '' 's/this?\.supabase/this.supabase/g' "$file"
        sed -i '' 's/this?\.agentRegistry/this.agentRegistry/g' "$file"
        sed -i '' 's/this?\.timeoutManager/this.timeoutManager/g' "$file"
        
        # Fix common API object access
        sed -i '' 's/Math?\.max/Math.max/g' "$file"
        sed -i '' 's/Math?\.min/Math.min/g' "$file"
        sed -i '' 's/Math?\.round/Math.round/g' "$file"
        sed -i '' 's/Math?\.floor/Math.floor/g' "$file"
        sed -i '' 's/Math?\.random/Math.random/g' "$file"
        sed -i '' 's/Date?\.now/Date.now/g' "$file"
        sed -i '' 's/process?\.env/process.env/g' "$file"
        sed -i '' 's/process?\.exit/process.exit/g' "$file"
        sed -i '' 's/process?\.platform/process.platform/g' "$file"
        sed -i '' 's/process?\.arch/process.arch/g' "$file"
        sed -i '' 's/process?\.uptime/process.uptime/g' "$file"
        sed -i '' 's/process?\.memoryUsage/process.memoryUsage/g' "$file"
        sed -i '' 's/process?\.cpuUsage/process.cpuUsage/g' "$file"
        sed -i '' 's/process?\.version/process.version/g' "$file"
        sed -i '' 's/process?\.cwd/process.cwd/g' "$file"
        sed -i '' 's/process?\.argv/process.argv/g' "$file"
        
        # Fix enum access
        sed -i '' 's/TaskType?\.CODE_GENERATION/TaskType.CODE_GENERATION/g' "$file"
        sed -i '' 's/TaskType?\.CODE_REVIEW/TaskType.CODE_REVIEW/g' "$file"
        sed -i '' 's/TaskType?\.CODE_DEBUGGING/TaskType.CODE_DEBUGGING/g' "$file"
        sed -i '' 's/TaskType?\.CREATIVE_WRITING/TaskType.CREATIVE_WRITING/g' "$file"
        sed -i '' 's/TaskType?\.BRAINSTORMING/TaskType.BRAINSTORMING/g' "$file"
        sed -i '' 's/TaskType?\.DATA_ANALYSIS/TaskType.DATA_ANALYSIS/g' "$file"
        sed -i '' 's/TaskType?\.RESEARCH/TaskType.RESEARCH/g' "$file"
        sed -i '' 's/TaskType?\.FACTUAL_QA/TaskType.FACTUAL_QA/g' "$file"
        sed -i '' 's/TaskType?\.REASONING/TaskType.REASONING/g' "$file"
        sed -i '' 's/TaskType?\.CASUAL_CHAT/TaskType.CASUAL_CHAT/g' "$file"
        sed -i '' 's/TaskType?\.TECHNICAL_SUPPORT/TaskType.TECHNICAL_SUPPORT/g' "$file"
        sed -i '' 's/TaskType?\.SUMMARIZATION/TaskType.SUMMARIZATION/g' "$file"
        sed -i '' 's/TaskType?\.TRANSLATION/TaskType.TRANSLATION/g' "$file"
        sed -i '' 's/TaskType?\.IMAGE_ANALYSIS/TaskType.IMAGE_ANALYSIS/g' "$file"
        sed -i '' 's/TaskType?\.VISUAL_REASONING/TaskType.VISUAL_REASONING/g' "$file"
        sed -i '' 's/TaskType?\.MODEL_TRAINING/TaskType.MODEL_TRAINING/g' "$file"
        
        # Fix LogContext enum access
        sed -i '' 's/LogContext?\.SERVER/LogContext.SERVER/g' "$file"
        sed -i '' 's/LogContext?\.DATABASE/LogContext.DATABASE/g' "$file"
        sed -i '' 's/LogContext?\.AI/LogContext.AI/g' "$file"
        sed -i '' 's/LogContext?\.API/LogContext.API/g' "$file"
        sed -i '' 's/LogContext?\.WEBSOCKET/LogContext.WEBSOCKET/g' "$file"
        sed -i '' 's/LogContext?\.MCP/LogContext.MCP/g' "$file"
        sed -i '' 's/LogContext?\.SYSTEM/LogContext.SYSTEM/g' "$file"
        sed -i '' 's/LogContext?\.AGENT/LogContext.AGENT/g' "$file"
        
        # Fix common function calls
        sed -i '' 's/log?\.info/log.info/g' "$file"
        sed -i '' 's/log?\.warn/log.warn/g' "$file"
        sed -i '' 's/log?\.error/log.error/g' "$file"
        sed -i '' 's/log?\.debug/log.debug/g' "$file"
        
        # Fix config object access
        sed -i '' 's/config?\.port/config.port/g' "$file"
        sed -i '' 's/config?\.environment/config.environment/g' "$file"
        sed -i '' 's/config?\.supabase/config.supabase/g' "$file"
        
        # Fix req/res common patterns
        sed -i '' 's/req?\.body/req.body/g' "$file"
        sed -i '' 's/req?\.params/req.params/g' "$file"
        sed -i '' 's/req?\.query/req.query/g' "$file"
        sed -i '' 's/req?\.headers/req.headers/g' "$file"
        sed -i '' 's/req?\.method/req.method/g' "$file"
        sed -i '' 's/req?\.path/req.path/g' "$file"
        sed -i '' 's/req?\.url/req.url/g' "$file"
        sed -i '' 's/req?\.ip/req.ip/g' "$file"
        sed -i '' 's/req?\.get/req.get/g' "$file"
        sed -i '' 's/res?\.json/res.json/g' "$file"
        sed -i '' 's/res?\.status/res.status/g' "$file"
        sed -i '' 's/res?\.send/res.send/g' "$file"
        sed -i '' 's/res?\.header/res.header/g' "$file"
        sed -i '' 's/res?\.sendStatus/res.sendStatus/g' "$file"
        sed -i '' 's/res?\.on/res.on/g' "$file"
        
        # Fix socket patterns
        sed -i '' 's/socket?\.emit/socket.emit/g' "$file"
        sed -i '' 's/socket?\.on/socket.on/g' "$file"
        sed -i '' 's/socket?\.disconnect/socket.disconnect/g' "$file"
        sed -i '' 's/socket?\.id/socket.id/g' "$file"
        
        # Fix error patterns
        sed -i '' 's/error?\.message/error.message/g' "$file"
        sed -i '' 's/error?\.stack/error.stack/g' "$file"
        
        echo "✅ Fixed: $file"
    fi
}

# Export the function to use with find
export -f fix_file

# Process all TypeScript files in src/ directory
echo "Processing TypeScript files in src/ directory..."
find src -name "*.ts" -type f -exec bash -c 'fix_file "$0"' {} \;

echo "🎉 Syntax corruption fixes completed!"
echo "Running TypeScript check to verify fixes..."

# Test compilation
npx tsc --noEmit --project tsconfig.json
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful!"
else
    echo "⚠️  Some TypeScript errors remain - manual fixes may be needed for complex patterns"
fi
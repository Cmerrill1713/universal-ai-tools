#!/bin/bash

# Critical TypeScript Syntax Error Fix Script
# Fixes systematic corruption in server.ts and service files

echo "🔧 Starting critical TypeScript syntax error fixes..."

# Define the files to fix
SERVER_FILE="src/server.ts"
SERVICE_FILES=$(find src/services -name "*.ts" -type f)

# Function to fix common corruption patterns
fix_corruption_patterns() {
    local file="$1"
    echo "Fixing corruption patterns in: $file"
    
    # Fix dot-separated patterns that should be camelCase or underscores
    sed -i '' 's/create\.Server/createServer/g' "$file"
    sed -i '' 's/Server as SocketI\.O\.Server/Server as SocketIOServer/g' "$file"
    sed -i '' 's/create\.Client/createClient/g' "$file"
    sed -i '' 's/fileURL\.To\.Path/fileURLToPath/g' "$file"
    sed -i '' 's/importmetaurl/import.meta.url/g' "$file"
    sed -i '' 's/pathdirname/path.dirname/g' "$file"
    sed -i '' 's/process\.env([A-Z_]+)\.([A-Z_]+)\.([A-Z_]+)/process.env.\1_\2_\3/g' "$file"
    sed -i '' 's/process\.env([A-Z_]+)\.([A-Z_]+)/process.env.\1_\2/g' "$file"
    sed -i '' 's/process\.envFRONTEND_U\.R\.L/process.env.FRONTEND_URL/g' "$file"
    sed -i '' 's/process\.envPO\.R\.T/process.env.PORT/g' "$file"
    sed -i '' 's/process\.envNODE_E\.N\.V/process.env.NODE_ENV/g' "$file"
    sed -i '' 's/process\.envSUPABASE_U\.R\.L/process.env.SUPABASE_URL/g' "$file"
    sed -i '' 's/process\.envSUPABASE_SERVICE_K\.E\.Y/process.env.SUPABASE_SERVICE_KEY/g' "$file"
    sed -i '' 's/process\.envJWT_SECR\.E\.T/process.env.JWT_SECRET/g' "$file"
    sed -i '' 's/process\.envnpm_package_version/process.env.npm_package_version/g' "$file"
    
    # Fix method calls
    sed -i '' 's/loggerinfo/logger.info/g' "$file"
    sed -i '' 's/loggererror/logger.error/g' "$file"
    sed -i '' 's/loggerwarn/logger.warn/g' "$file"
    sed -i '' 's/appuse/app.use/g' "$file"
    sed -i '' 's/appget/app.get/g' "$file"
    sed -i '' 's/apppost/app.post/g' "$file"
    sed -i '' 's/expressjson/express.json/g' "$file"
    sed -i '' 's/expressurlencoded/express.urlencoded/g' "$file"
    sed -i '' 's/resjson/res.json/g' "$file"
    sed -i '' 's/resstatus/res.status/g' "$file"
    sed -i '' 's/reqmethod/req.method/g' "$file"
    sed -i '' 's/reqpath/req.path/g' "$file"
    sed -i '' 's/reqget/req.get/g' "$file"
    sed -i '' 's/reqip/req.ip/g' "$file"
    sed -i '' 's/reqbody/req.body/g' "$file"
    sed -i '' 's/requser/req.user/g' "$file"
    sed -i '' 's/reqheaders/req.headers/g' "$file"
    sed -i '' 's/jwtverify/jwt.verify/g' "$file"
    sed -i '' 's/new Date()toIS\.O\.String/new Date().toISOString/g' "$file"
    sed -i '' 's/serverlisten/server.listen/g' "$file"
    sed -i '' 's/serverclose/server.close/g' "$file"
    sed -i '' 's/ioclose/io.close/g' "$file"
    sed -i '' 's/ioon/io.on/g' "$file"
    sed -i '' 's/socketon/socket.on/g' "$file"
    sed -i '' 's/socketemit/socket.emit/g' "$file"
    sed -i '' 's/socketid/socket.id/g' "$file"
    sed -i '' 's/processon/process.on/g' "$file"
    sed -i '' 's/processexit/process.exit/g' "$file"
    
    # Fix object property access
    sed -i '' 's/errormessage/error.message/g' "$file"
    sed -i '' 's/agentslength/agents.length/g' "$file"
    sed -i '' 's/agentsmap/agents.map/g' "$file"
    sed -i '' 's/\.join/join/g' "$file"
    
    # Fix HTTP methods
    sed -i '' "s/'G\.E\.T'/'GET'/g" "$file"
    sed -i '' "s/'PO\.S\.T'/'POST'/g" "$file"
    
    # Fix constants and variables
    sed -i '' 's/PO\.R\.T/PORT/g' "$file"
    sed -i '' 's/NODE_E\.N\.V/NODE_ENV/g' "$file"
    
    # Fix class and interface names
    sed -i '' 's/Universal\.Agent\.Registry/UniversalAgentRegistry/g' "$file"
    sed -i '' 's/Memory\.Router/MemoryRouter/g' "$file"
    sed -i '' 's/Orchestration\.Router/OrchestrationRouter/g' "$file"
    sed -i '' 's/Knowledge\.Router/KnowledgeRouter/g' "$file"
    sed -i '' 's/Health\.Router/HealthRouter/g' "$file"
    sed -i '' 's/Auth\.Router/AuthRouter/g' "$file"
    sed -i '' 's/Tool\.Router/ToolRouter/g' "$file"
    sed -i '' 's/Speech\.Router/SpeechRouter/g' "$file"
    sed -i '' 's/Backup\.Router/BackupRouter/g' "$file"
    sed -i '' 's/Chat\.Router/ChatRouter/g' "$file"
    
    # Fix variable declarations and assignments
    sed -i '' 's/supabase: any = null,/supabase: any = null;/g' "$file"
    sed -i '' 's/redis\.Service: any = null,/redisService: any = null;/g' "$file"
    sed -i '' 's/agent\.Registry: any = null,/agentRegistry: any = null;/g' "$file"
    sed -i '' 's/jwt\.Auth\.Service: any = null/jwtAuthService: any = null;/g' "$file"
    
    # Fix variable usage
    sed -i '' 's/redis\.Service/redisService/g' "$file"
    sed -i '' 's/agent\.Registry/agentRegistry/g' "$file"
    sed -i '' 's/jwt\.Auth\.Service/jwtAuthService/g' "$file"
    
    # Fix method calls with dots
    sed -i '' 's/auth\.Header/authHeader/g' "$file"
    sed -i '' 's/api\.Key/apiKey/g' "$file"
    sed -i '' 's/auth\.Headerstarts\.With/authHeader.startsWith/g' "$file"
    sed -i '' 's/auth\.Headersubstring/authHeader.substring/g' "$file"
    sed -i '' 's/user\.Agent/userAgent/g' "$file"
    sed -i '' 's/safe\.Router\.Setup/safeRouterSetup/g' "$file"
    sed -i '' 's/auth\.Middleware/authMiddleware/g' "$file"
    sed -i '' 's/agent\.Name/agentName/g' "$file"
    sed -i '' 's/router\.Factory/routerFactory/g' "$file"
    sed -i '' 's/user\.Id/userId/g' "$file"
    sed -i '' 's/request\.Id/requestId/g' "$file"
    sed -i '' 's/total\.Count/totalCount/g' "$file"
    sed -i '' 's/participating\.Agents/participatingAgents/g' "$file"
    sed -i '' 's/graceful\.Shutdown/gracefulShutdown/g' "$file"
    sed -i '' 's/start\.Server/startServer/g' "$file"
    
    # Fix specific error patterns
    sed -i '' 's/error instanceof Error ? errormessage : String(error)/error instanceof Error ? error.message : String(error)/g' "$file"
    
    # Fix spread operators and object syntax
    sed -i '' 's/\.context/...context/g' "$file"
    
    # Fix template literals and string issues
    sed -i '' 's/Mathrandom()to\.String(36)substr(2, 9)/Math.random().toString(36).substr(2, 9)/g' "$file"
    
    # Fix signal names
    sed -i '' 's/SIGTE\.R\.M/SIGTERM/g' "$file"
    sed -i '' 's/SIGI\.N\.T/SIGINT/g' "$file"
    sed -i '' 's/uncaught\.Exception/uncaughtException/g' "$file"
    sed -i '' 's/unhandled\.Rejection/unhandledRejection/g' "$file"
    
    # Fix missing semicolons and commas
    sed -i '' 's/task;/task,/g' "$file"
    sed -i '' 's/result;/result,/g' "$file"
    sed -i '' 's/agent: agent\.Name,/agent: agentName,/g' "$file"
    
    # Fix service-specific patterns
    sed -i '' 's/Redis\.Options/RedisOptions/g' "$file"
    sed -i '' 's/Redis\.Config/RedisConfig/g' "$file"
    sed -i '' 's/Redis\.Service/RedisService/g' "$file"
    sed -i '' 's/Ollama\.Model/OllamaModel/g' "$file"
    sed -i '' 's/Ollama\.Service/OllamaService/g' "$file"
    sed -i '' 's/DS\.Py\.Service/DSPyService/g' "$file"
    sed -i '' 's/DS\.Py\.Bridge/DSPyBridge/g' "$file"
    sed -i '' 's/Log\.Context/LogContext/g' "$file"
    sed -i '' 's/Cache\.Entry/CacheEntry/g' "$file"
    sed -i '' 's/LR\.U\.Cache/LRUCache/g' "$file"
    sed -i '' 's/Circuit\.Breaker/CircuitBreaker/g' "$file"
    sed -i '' 's/circuit\.Breaker/circuitBreaker/g' "$file"
    
    # Fix specific method calls
    sed -i '' 's/JS\.O\.N\.stringify/JSON.stringify/g' "$file"
    sed -i '' 's/strlength/str.length/g' "$file"
    sed -i '' 's/thisfallback\.Cache/this.fallbackCache/g' "$file"
    sed -i '' 's/thisbase\.Url/this.baseUrl/g' "$file"
    sed -i '' 's/thismetal\.Settings/this.metalSettings/g' "$file"
    sed -i '' 's/thisbridge/this.bridge/g' "$file"
    sed -i '' 's/thismemory\.System/this.memorySystem/g' "$file"
    sed -i '' 's/thisis\.Initialized/this.isInitialized/g' "$file"
    sed -i '' 's/thisinitialize/this.initialize/g' "$file"
    sed -i '' 's/thiswait\.For\.Connection/this.waitForConnection/g' "$file"
    
    # Fix property access patterns
    sed -i '' 's/\.([a-zA-Z_][a-zA-Z0-9_]*)/.\1/g' "$file"
    
    echo "✅ Fixed corruption patterns in: $file"
}

# Function to fix import/export statements
fix_imports_exports() {
    local file="$1"
    echo "Fixing imports/exports in: $file"
    
    # Fix import statements
    sed -i '' "s/import { create\.Server }/import { createServer }/g" "$file"
    sed -i '' "s/import { Server as SocketI\.O\.Server }/import { Server as SocketIOServer }/g" "$file"
    sed -i '' "s/import { create\.Client }/import { createClient }/g" "$file"
    sed -i '' "s/import { fileURL\.To\.Path }/import { fileURLToPath }/g" "$file"
    sed -i '' "s/from 'socketio'/from 'socket.io'/g" "$file"
    
    echo "✅ Fixed imports/exports in: $file"
}

# Function to fix method definitions and calls
fix_methods() {
    local file="$1"
    echo "Fixing method definitions in: $file"
    
    # Fix async function definitions
    sed -i '' 's/async function graceful\.Shutdown/async function gracefulShutdown/g' "$file"
    sed -i '' 's/const start\.Server = async/const startServer = async/g' "$file"
    sed -i '' 's/function safe\.Router\.Setup/function safeRouterSetup/g' "$file"
    
    # Fix method calls
    sed -i '' 's/graceful\.Shutdown/gracefulShutdown/g' "$file"
    sed -i '' 's/start\.Server/startServer/g' "$file"
    sed -i '' 's/safe\.Router\.Setup/safeRouterSetup/g' "$file"
    
    echo "✅ Fixed method definitions in: $file"
}

# Fix server.ts first (most critical)
if [ -f "$SERVER_FILE" ]; then
    echo "🎯 Fixing critical server.ts file..."
    fix_corruption_patterns "$SERVER_FILE"
    fix_imports_exports "$SERVER_FILE"
    fix_methods "$SERVER_FILE"
    
    # Additional server-specific fixes
    sed -i '' 's/const __filename = fileURL\.To\.Path(importmetaurl);/const __filename = fileURLToPath(import.meta.url);/g' "$SERVER_FILE"
    sed -i '' 's/const __dirname = pathdirname(__filename)/const __dirname = path.dirname(__filename);/g' "$SERVER_FILE"
    
    echo "✅ Server.ts syntax fixes completed"
else
    echo "❌ Server.ts not found at $SERVER_FILE"
fi

# Fix service files
echo "🔧 Fixing service files..."
for service_file in $SERVICE_FILES; do
    if [ -f "$service_file" ]; then
        fix_corruption_patterns "$service_file"
        fix_imports_exports "$service_file"
        fix_methods "$service_file"
    fi
done

# Fix specific service imports
echo "🔧 Fixing service-specific imports..."
find src/services -name "*.ts" -exec sed -i '' "s/from '\.\/utils\/enhanced-logger'/from '..\/utils\/enhanced-logger'/g" {} \;
find src/services -name "*.ts" -exec sed -i '' "s/from '\.\/utils\/logger'/from '..\/utils\/logger'/g" {} \;
find src/services -name "*.ts" -exec sed -i '' "s/from '\.\/config'/from '..\/config'/g" {} \;
find src/services -name "*.ts" -exec sed -i '' "s/from '\.\/memory\/enhanced_memory_system'/from '..\/memory\/enhanced_memory_system'/g" {} \;

# Fix router imports
echo "🔧 Fixing router imports in server.ts..."
sed -i '' "s/import { Memory\.Router }/import { MemoryRouter }/g" "$SERVER_FILE"
sed -i '' "s/import { Orchestration\.Router }/import { OrchestrationRouter }/g" "$SERVER_FILE"
sed -i '' "s/import { Knowledge\.Router }/import { KnowledgeRouter }/g" "$SERVER_FILE"
sed -i '' "s/import { Health\.Router }/import { HealthRouter }/g" "$SERVER_FILE"
sed -i '' "s/import { Universal\.Agent\.Registry }/import { UniversalAgentRegistry }/g" "$SERVER_FILE"

# Fix agent registry import
sed -i '' "s/from '\.\/agents\/universal_agent_registry'/from '.\/agents\/universal_agent_registry'/g" "$SERVER_FILE"

echo "🎉 Critical TypeScript syntax error fixes completed!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run build' to check for remaining compilation errors"
echo "2. Run 'npm run lint:fix' to fix any remaining linting issues"
echo "3. Test server startup with 'npm run dev'"
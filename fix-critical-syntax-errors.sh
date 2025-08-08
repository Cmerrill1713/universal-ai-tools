#!/bin/bash

# Fix critical syntax errors that are blocking TypeScript compilation

echo "🔧 Fixing critical syntax errors..."

# Fix agent-registry.ts - remaining issues
echo "Fixing agent-registry.ts..."
sed -i '' 's/this\?\./this\./g' src/agents/agent-registry.ts
sed -i '' 's/config\?\./config\./g' src/agents/agent-registry.ts
sed -i '' 's/process\?\./process\./g' src/agents/agent-registry.ts
sed -i '' 's/log\?\./log\./g' src/agents/agent-registry.ts
sed -i '' 's/LogContext\?\./LogContext\./g' src/agents/agent-registry.ts
sed -i '' 's/127\?\.0\?\.0\?\.1/127.0.0.1/g' src/agents/agent-registry.ts

# Fix base-agent.ts issues
echo "Fixing base-agent.ts..."
sed -i '' 's/this\?\./this\./g' src/agents/base-agent.ts
sed -i '' 's/Math\?\./Math\./g' src/agents/base-agent.ts
sed -i '' 's/Date\?\./Date\./g' src/agents/base-agent.ts
sed -i '' 's/log\?\./log\./g' src/agents/base-agent.ts
sed -i '' 's/LogContext\?\./LogContext\./g' src/agents/base-agent.ts

# Fix base_agent.ts issues
echo "Fixing base_agent.ts..."
sed -i '' 's/this\?\./this\./g' src/agents/base_agent.ts
sed -i '' 's/Math\?\./Math\./g' src/agents/base_agent.ts
sed -i '' 's/Date\?\./Date\./g' src/agents/base_agent.ts

# Fix enhanced-planner-agent.ts
echo "Fixing enhanced-planner-agent.ts..."
sed -i '' 's/super\?\./super\./g' src/agents/cognitive/enhanced-planner-agent.ts
sed -i '' 's/this\?\./this\./g' src/agents/cognitive/enhanced-planner-agent.ts
sed -i '' 's/Math\?\./Math\./g' src/agents/cognitive/enhanced-planner-agent.ts
sed -i '' 's/Array\?\./Array\./g' src/agents/cognitive/enhanced-planner-agent.ts
sed -i '' 's/JSON\?\./JSON\./g' src/agents/cognitive/enhanced-planner-agent.ts

# Fix enhanced-base-agent.ts remaining issues
echo "Fixing enhanced-base-agent.ts..."
sed -i '' 's/this\?\./this\./g' src/agents/enhanced-base-agent.ts

# Fix circuit-breaker.ts
echo "Fixing circuit-breaker.ts..."
sed -i '' 's/this\?\./this\./g' src/utils/circuit-breaker.ts
sed -i '' 's/Date\?\./Date\./g' src/utils/circuit-breaker.ts
sed -i '' 's/Math\?\./Math\./g' src/utils/circuit-breaker.ts

# Fix any remaining semicolon instead of comma issues in object literals
echo "Fixing object literal syntax..."
find src -name "*.ts" -exec sed -i '' 's/: [0-9][0-9]*\?\./: /g' {} \;
find src -name "*.ts" -exec sed -i '' 's/\([^:]\): \([0-9][0-9]*\);\([^}]*[,}]\)/\1: \2,/g' {} \;

# Fix ternary operator issues
echo "Fixing ternary operators..."
find src -name "*.ts" -exec sed -i '' 's/\?\.\?\./\?\./g' {} \;
find src -name "*.ts" -exec sed -i '' 's/\: 0\?\./: 0\./g' {} \;

echo "✅ Critical syntax errors fixed!"

# Check if TypeScript compilation improves
echo "📊 Checking TypeScript compilation..."
npx tsc --noEmit 2>&1 | head -10
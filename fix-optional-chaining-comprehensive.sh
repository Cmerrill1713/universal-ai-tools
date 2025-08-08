#!/bin/bash

# Comprehensive fix for invalid optional chaining patterns
# Fixing patterns like 0?.2 to 0.2, this?.prop to this.prop, Math?.max to Math.max, etc.

echo "🔧 Starting comprehensive optional chaining fixes..."

# Files to fix
FILES=(
  "src/agents/enhanced-base-agent.ts"
  "src/agents/base-agent.ts"
  "src/agents/base_agent.ts"
  "src/agents/cognitive/enhanced-planner-agent.ts"
  "src/agents/cognitive/enhanced-retriever-agent.ts"
  "src/agents/cognitive/enhanced-synthesizer-agent.ts"
  "src/agents/cognitive/multi-tier-planner-agent.ts"
  "src/agents/personal/enhanced-personal-assistant-agent.ts"
  "src/agents/specialized/enhanced-code-assistant-agent.ts"
  "src/agents/agent-registry.ts"
  "src/agents/multi-tier-base-agent.ts"
  "src/services/intelligent-parameter-service.ts"
  "src/services/llm-router-service.ts"
  "src/utils/circuit-breaker.ts"
  "src/utils/enhanced-logger.ts"
  "src/utils/smart-port-manager.ts"
  "src/utils/thompson-sampling.ts"
  "src/utils/validation.ts"
  "src/utils/api-response.ts"
  "src/utils/logger.ts"
  "src/utils/bayesian-model.ts"
  "src/middleware/intelligent-parameters.ts"
  "src/middleware/rate-limiter-enhanced.ts"
  "src/middleware/validation.ts"
  "src/middleware/auth.ts"
  "src/middleware/context-injection-middleware.ts"
  "src/middleware/cors-config.ts"
  "src/middleware/express-validator.ts"
  "src/middleware/request-validator.ts"
)

# Pattern fixes
echo "📋 Applying systematic pattern fixes..."

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    
    # Fix numeric literals with invalid optional chaining
    sed -i '' 's/0\.?2/0.2/g' "$file"
    sed -i '' 's/0\.?1/0.1/g' "$file"
    sed -i '' 's/0\.?3/0.3/g' "$file"
    sed -i '' 's/0\.?4/0.4/g' "$file"
    sed -i '' 's/0\.?5/0.5/g' "$file"
    sed -i '' 's/0\.?6/0.6/g' "$file"
    sed -i '' 's/0\.?7/0.7/g' "$file"
    sed -i '' 's/0\.?8/0.8/g' "$file"
    sed -i '' 's/0\.?9/0.9/g' "$file"
    sed -i '' 's/1\.?0/1.0/g' "$file"
    sed -i '' 's/2\.?0/2.0/g' "$file"
    
    # Fix property access with invalid optional chaining
    sed -i '' 's/this\.\?config/this.config/g' "$file"
    sed -i '' 's/this\.\?taskProfiles/this.taskProfiles/g' "$file"
    sed -i '' 's/this\.\?contextTemplates/this.contextTemplates/g' "$file"
    sed -i '' 's/this\.\?domainAdjustments/this.domainAdjustments/g' "$file"
    sed -i '' 's/this\.\?learnedParameters/this.learnedParameters/g' "$file"
    sed -i '' 's/this\.\?lastMemoryUpdate/this.lastMemoryUpdate/g' "$file"
    sed -i '' 's/this\.\?memoryUpdateInterval/this.memoryUpdateInterval/g' "$file"
    sed -i '' 's/this\.\?conversationHistory/this.conversationHistory/g' "$file"
    sed -i '' 's/this\.\?systemPrompt/this.systemPrompt/g' "$file"
    sed -i '' 's/this\.\?isInitialized/this.isInitialized/g' "$file"
    sed -i '' 's/this\.\?performanceMetrics/this.performanceMetrics/g' "$file"
    sed -i '' 's/this\.\?executionHistory/this.executionHistory/g' "$file"
    sed -i '' 's/this\.\?performanceDistribution/this.performanceDistribution/g' "$file"
    sed -i '' 's/this\.\?dynamicSpawnCount/this.dynamicSpawnCount/g' "$file"
    sed -i '' 's/this\.\?metrics/this.metrics/g' "$file"
    sed -i '' 's/this\.\?memoryCoordinator/this.memoryCoordinator/g' "$file"
    sed -i '' 's/this\.\?logger/this.logger/g' "$file"
    
    # Fix built-in objects with invalid optional chaining
    sed -i '' 's/Math\.\?max/Math.max/g' "$file"
    sed -i '' 's/Math\.\?min/Math.min/g' "$file"
    sed -i '' 's/Math\.\?round/Math.round/g' "$file"
    sed -i '' 's/Math\.\?pow/Math.pow/g' "$file"
    sed -i '' 's/Math\.\?floor/Math.floor/g' "$file"
    sed -i '' 's/Math\.\?random/Math.random/g' "$file"
    sed -i '' 's/Date\.\?now/Date.now/g' "$file"
    sed -i '' 's/JSON\.\?parse/JSON.parse/g' "$file"
    sed -i '' 's/JSON\.\?stringify/JSON.stringify/g' "$file"
    sed -i '' 's/Object\.\?keys/Object.keys/g' "$file"
    sed -i '' 's/Object\.\?entries/Object.entries/g' "$file"
    sed -i '' 's/Object\.\?values/Object.values/g' "$file"
    sed -i '' 's/Array\.\?from/Array.from/g' "$file"
    sed -i '' 's/Array\.\?isArray/Array.isArray/g' "$file"
    
    # Fix log calls with invalid optional chaining
    sed -i '' 's/log\.\?info/log.info/g' "$file"
    sed -i '' 's/log\.\?warn/log.warn/g' "$file"
    sed -i '' 's/log\.\?error/log.error/g' "$file"
    sed -i '' 's/log\.\?debug/log.debug/g' "$file"
    
    # Fix LogContext with invalid optional chaining
    sed -i '' 's/LogContext\.\?AGENT/LogContext.AGENT/g' "$file"
    sed -i '' 's/LogContext\.\?AI/LogContext.AI/g' "$file"
    sed -i '' 's/LogContext\.\?MCP/LogContext.MCP/g' "$file"
    sed -i '' 's/LogContext\.\?ROUTER/LogContext.ROUTER/g' "$file"
    sed -i '' 's/LogContext\.\?SERVICE/LogContext.SERVICE/g' "$file"
    
    # Fix TaskType enum with invalid optional chaining
    sed -i '' 's/TaskType\.\?CODE_GENERATION/TaskType.CODE_GENERATION/g' "$file"
    sed -i '' 's/TaskType\.\?CODE_REVIEW/TaskType.CODE_REVIEW/g' "$file"
    sed -i '' 's/TaskType\.\?CASUAL_CHAT/TaskType.CASUAL_CHAT/g' "$file"
    sed -i '' 's/TaskType\.\?DATA_ANALYSIS/TaskType.DATA_ANALYSIS/g' "$file"
    sed -i '' 's/TaskType\.\?FACTUAL_QA/TaskType.FACTUAL_QA/g' "$file"
    sed -i '' 's/TaskType\.\?CREATIVE_WRITING/TaskType.CREATIVE_WRITING/g' "$file"
    sed -i '' 's/TaskType\.\?TRANSLATION/TaskType.TRANSLATION/g' "$file"
    sed -i '' 's/TaskType\.\?SUMMARIZATION/TaskType.SUMMARIZATION/g' "$file"
    
    # Fix z schema calls with invalid optional chaining
    sed -i '' 's/z\.\?object/z.object/g' "$file"
    sed -i '' 's/z\.\?string/z.string/g' "$file"
    sed -i '' 's/z\.\?number/z.number/g' "$file"
    sed -i '' 's/z\.\?boolean/z.boolean/g' "$file"
    sed -i '' 's/z\.\?array/z.array/g' "$file"
    sed -i '' 's/z\.\?record/z.record/g' "$file"
    sed -i '' 's/z\.\?null/z.null/g' "$file"
    sed -i '' 's/z\.\?unknown/z.unknown/g' "$file"
    sed -i '' 's/z\.\?optional/z.optional/g' "$file"
    
    # Fix context property access
    sed -i '' 's/context\.\?userRequest/context.userRequest/g' "$file"
    sed -i '' 's/context\.\?requestId/context.requestId/g' "$file"
    sed -i '' 's/context\.\?userId/context.userId/g' "$file"
    sed -i '' 's/context\.\?metadata/context.metadata/g' "$file"
    sed -i '' 's/context\.\?workingDirectory/context.workingDirectory/g' "$file"
    
    # Fix response property access
    sed -i '' 's/response\.\?success/response.success/g' "$file"
    sed -i '' 's/response\.\?data/response.data/g' "$file"
    sed -i '' 's/response\.\?confidence/response.confidence/g' "$file"
    sed -i '' 's/response\.\?message/response.message/g' "$file"
    sed -i '' 's/response\.\?metadata/response.metadata/g' "$file"
    
    # Fix llmResponse property access
    sed -i '' 's/llmResponse\.\?content/llmResponse.content/g' "$file"
    sed -i '' 's/llmResponse\.\?model/llmResponse.model/g' "$file"
    sed -i '' 's/llmResponse\.\?provider/llmResponse.provider/g' "$file"
    sed -i '' 's/llmResponse\.\?usage/llmResponse.usage/g' "$file"
    
    # Fix error property access
    sed -i '' 's/error\.\?message/error.message/g' "$file"
    
    # Fix array methods with invalid optional chaining
    sed -i '' 's/\.push\?\(/\.push(/g' "$file"
    sed -i '' 's/\.slice\?\(/\.slice(/g' "$file"
    sed -i '' 's/\.filter\?\(/\.filter(/g' "$file"
    sed -i '' 's/\.map\?\(/\.map(/g' "$file"
    sed -i '' 's/\.reduce\?\(/\.reduce(/g' "$file"
    sed -i '' 's/\.forEach\?\(/\.forEach(/g' "$file"
    sed -i '' 's/\.some\?\(/\.some(/g' "$file"
    sed -i '' 's/\.includes\?\(/\.includes(/g' "$file"
    sed -i '' 's/\.join\?\(/\.join(/g' "$file"
    sed -i '' 's/\.replace\?\(/\.replace(/g' "$file"
    sed -i '' 's/\.toLowerCase\?\(/\.toLowerCase(/g' "$file"
    sed -i '' 's/\.substring\?\(/\.substring(/g' "$file"
    sed -i '' 's/\.trim\?\(/\.trim(/g' "$file"
    sed -i '' 's/\.length\?\?/\.length/g' "$file"
    
    echo "✅ Fixed $file"
  else
    echo "⚠️ File not found: $file"
  fi
done

echo "🎉 Comprehensive optional chaining fixes complete!"
echo "📊 Run 'npx tsc --noEmit' to check remaining TypeScript errors"
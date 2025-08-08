#\!/bin/bash

echo "🔧 Fixing remaining TypeScript syntax errors..."

# Fix intelligent-parameter-service.ts
echo "Fixing intelligent-parameter-service.ts..."
sed -i '' '
# Fix semicolons in interfaces (lines 22, 29, 41, etc.)
s/reasoning?: string,/reasoning?: string;/g
s/userPreferences?: UserPreferences,/userPreferences?: UserPreferences;/g

# Fix line 94 - lastMemoryUpdate
s/private lastMemoryUpdate = 0,/private lastMemoryUpdate = 0;/g

# Fix line 409 - let statement
s/let optimizationsApplied = 0,/let optimizationsApplied = 0;/g

# Fix line 465 - arithmetic expression in template literal
s/normalizedSpeed \* speedWeight;/normalizedSpeed \* speedWeight/g

# Fix line 528 - existingScore declaration
s/const existingScore = (existing as any).__scores?\[key\] || 0,/const existingScore = (existing as any).__scores?[key] || 0;/g

# Fix line 659-661 - ternary operator
s/domainAdjustment?.temperature \!== undefined;/domainAdjustment?.temperature \!== undefined/g

# Fix line 714 - lengthMultipliers declaration
s/const multiplier = lengthMultipliers\[expectedLength as keyof typeof lengthMultipliers\] || 1.0,/const multiplier = lengthMultipliers[expectedLength as keyof typeof lengthMultipliers] || 1.0;/g

# Fix line 762 - tokensUsed calculation
s/const tokensUsed = (response?.metadata?.tokens as unknown).total_tokens || 100,/const tokensUsed = (response?.metadata?.tokens as any)?.total_tokens || 100;/g

# Fix line 808 - TaskType enum
s/return TaskType.CREATIVE_WRITING,/return TaskType.CREATIVE_WRITING;/g
' src/services/intelligent-parameter-service.ts

# Fix enhanced-base-agent.ts
echo "Fixing enhanced-base-agent.ts..."
sed -i '' '
# Fix line 34 - dynamicSpawnCount
s/protected dynamicSpawnCount = 0,/protected dynamicSpawnCount = 0;/g

# Fix line 39 - successRate
s/successRate: 1,/successRate: 1.0,/g

# Fix line 107 - messages declaration
s/const         messages/const messages/g

# Fix line 182 - recentHistory declaration
s/const       recentHistory/const recentHistory/g

# Fix line 276 - responseLength
s/const responseLength = response?.content?.length || 0,/const responseLength = response?.content?.length || 0;/g

# Fix line 308 - ternary operator
s/return this.config?.maxLatencyMs && this.config?.maxLatencyMs < 5000 ? 1000 : 2000,/return this.config?.maxLatencyMs && this.config?.maxLatencyMs < 5000 ? 1000 : 2000;/g

# Fix line 418 - contextValidator
s/const         contextValidator/const contextValidator/g

# Fix line 495 - for loop
s/let         i = 0,/let i = 0;/g
s/i < contexts?.length;/i < contexts.length;/g

# Fix line 557 - Beta sampler semicolon
s/this.performanceDistribution?.beta;/this.performanceDistribution?.beta/g

# Fix line 731 - ternary operator
s/: 0,/: 0;/g

# Fix line 734 - recentTrend declaration
s/const       recentTrend/const recentTrend/g

# Fix line 755 - quality calculation
s/const quality = response?.success ? (response?.confidence || 0) : 0,/const quality = response?.success ? (response?.confidence || 0) : 0;/g

# Fix line 762 - tokensUsed
s/const tokensUsed = (response?.metadata?.tokens as unknown).total_tokens || 100,/const tokensUsed = (response?.metadata?.tokens as any)?.total_tokens || 100;/g

# Fix line 798 - return statement
s/return 0,/return 0;/g

# Fix line 831 - feedback type
s/feedback: ABMCTSFeedback,/feedback: ABMCTSFeedback;/g
' src/agents/enhanced-base-agent.ts

# Fix base_agent.ts
echo "Fixing base_agent.ts..."
sed -i '' '
# Fix line 55 - confidence comment
s/confidence: number; \/\/ 0.0 - 1.0,/confidence: number; \/\/ 0.0 - 1.0/g

# Fix line 69 - confidence comment (duplicate)
s/confidence: number; \/\/ 0.0 - 1.0,/confidence: number; \/\/ 0.0 - 1.0/g

# Fix line 95 - logger import
s/import('..\/utils\/logger?.js')/import("..\/utils\/logger.js")/g

# Fix line 112 - bind
s/this.onRequestStarted?.bind(this)/this.onRequestStarted.bind(this)/g

# Fix line 133-137 - logger calls
s/(this as unknown).logger?/(this.logger as any)/g

# Fix line 311 - userRequest semicolon
s/context?.userRequest;/context.userRequest/g

# Fix line 359 - error semicolon
s/event?.error;/event.error/g

# Fix line 385 - return statement
s/if (this.metrics?.totalRequests === 0) return 1.0,/if (this.metrics?.totalRequests === 0) return 1.0;/g

# Fix line 394 - return statement
s/if (\!this.isInitialized) return 0,/if (\!this.isInitialized) return 0;/g

# Fix line 401-404 - ternary operator
s/this.metrics?.totalRequests > 0,/this.metrics?.totalRequests > 0/g
s/: 0,/: 0;/g
' src/agents/base_agent.ts

# Fix cognitive agents
echo "Fixing cognitive agents..."
for file in src/agents/cognitive/*.ts; do
  if [ -f "$file" ]; then
    sed -i '' '
    # Fix numeric literals with optional chaining
    s/0\?\./0./g
    s/1\?\./1./g
    
    # Fix ternary operators
    s/\? \([^:]*\),/? \1:/g
    
    # Fix semicolons in object literals
    s/};,/},/g
    ' "$file"
  fi
done

echo "✅ Syntax error fixes applied\!"

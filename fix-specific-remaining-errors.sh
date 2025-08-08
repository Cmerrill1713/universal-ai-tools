#\!/bin/bash

echo "🔧 Fixing specific remaining syntax errors..."

# Fix enhanced-base-agent.ts line 308 issue
echo "Fixing enhanced-base-agent.ts line 308..."
sed -i '' '308s/.*/    return this.config?.maxLatencyMs \&\& this.config?.maxLatencyMs < 5000 ? 1000 : 2000;/' src/agents/enhanced-base-agent.ts

# Fix line 375 (missing comma)
sed -i '' '375s/confidence: 0;/confidence: 0,/' src/agents/enhanced-base-agent.ts

# Fix line 579 (semicolon instead of comma)
sed -i '' '579s/feedback: ABMCTSFeedback;/feedback: ABMCTSFeedback,/' src/agents/enhanced-base-agent.ts

# Fix line 637 (semicolon instead of comma)
sed -i '' '637s/variance: 0;/variance: 0,/' src/agents/enhanced-base-agent.ts

# Fix line 730 (semicolon instead of colon)
sed -i '' '730s/: 0;/: 0/' src/agents/enhanced-base-agent.ts

# Fix line 779 (semicolon instead of comma)
sed -i '' '779s/memoryUsed: 0;/memoryUsed: 0,/' src/agents/enhanced-base-agent.ts

# Fix intelligent-parameter-service.ts line 528
echo "Fixing intelligent-parameter-service.ts line 528..."
sed -i '' '528s/.*/      const existingScore = (existing as any).__scores?.[key] || 0;/' src/services/intelligent-parameter-service.ts

# Fix line 958 (semicolon instead of comma)
sed -i '' '958s/userPreferences?: UserPreferences;/userPreferences?: UserPreferences,/' src/services/intelligent-parameter-service.ts

echo "✅ Specific syntax error fixes applied\!"

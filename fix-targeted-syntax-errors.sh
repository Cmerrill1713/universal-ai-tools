#!/bin/bash
# Fix the 5 specific parsing errors identified by ESLint
set -e

echo "🔧 Fixing specific parsing errors in 5 cognitive agent files"

# Fix enhanced_planner_agent.ts import statements
echo "Fixing enhanced_planner_agent.ts imports..."
sed -i '' 's/Agent\.Config/AgentConfig/g' src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' 's/Agent\.Context/AgentContext/g' src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' 's/PartialAgent\.Response/PartialAgentResponse/g' src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' 's/Agent\.Response/AgentResponse/g' src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' 's/EnhancedMemory\.Agent/EnhancedMemoryAgent/g' src/agents/cognitive/enhanced_planner_agent.ts

# Fix ethics_agent.ts import statements
echo "Fixing ethics_agent.ts imports..."
sed -i '' 's/Agent\.Config/AgentConfig/g' src/agents/cognitive/ethics_agent.ts
sed -i '' 's/Agent\.Context/AgentContext/g' src/agents/cognitive/ethics_agent.ts
sed -i '' 's/PartialAgent\.Response/PartialAgentResponse/g' src/agents/cognitive/ethics_agent.ts
sed -i '' 's/Agent\.Response/AgentResponse/g' src/agents/cognitive/ethics_agent.ts
sed -i '' 's/EnhancedMemory\.Agent/EnhancedMemoryAgent/g' src/agents/cognitive/ethics_agent.ts

# Fix evaluation_agent.ts import statements
echo "Fixing evaluation_agent.ts imports..."
sed -i '' 's/Agent\.Config/AgentConfig/g' src/agents/cognitive/evaluation_agent.ts
sed -i '' 's/Agent\.Context/AgentContext/g' src/agents/cognitive/evaluation_agent.ts
sed -i '' 's/Agent\.Response/AgentResponse/g' src/agents/cognitive/evaluation_agent.ts
sed -i '' 's/Base\.Agent/BaseAgent/g' src/agents/cognitive/evaluation_agent.ts
sed -i '' 's/Supabase\.Client/SupabaseClient/g' src/agents/cognitive/evaluation_agent.ts

# Fix evaluation_agent_clean.ts import statements
echo "Fixing evaluation_agent_clean.ts imports..."
sed -i '' 's/Agent\.Config/AgentConfig/g' src/agents/cognitive/evaluation_agent_clean.ts
sed -i '' 's/Agent\.Context/AgentContext/g' src/agents/cognitive/evaluation_agent_clean.ts
sed -i '' 's/Agent\.Response/AgentResponse/g' src/agents/cognitive/evaluation_agent_clean.ts
sed -i '' 's/Base\.Agent/BaseAgent/g' src/agents/cognitive/evaluation_agent_clean.ts
sed -i '' 's/Supabase\.Client/SupabaseClient/g' src/agents/cognitive/evaluation_agent_clean.ts

# Fix devils_advocate_agent.ts remaining method names and property access
echo "Fixing devils_advocate_agent.ts method calls..."
sed -i '' 's/select\.Capability/selectCapability/g' src/agents/cognitive/devils_advocate_agent.ts
sed -i '' 's/generate\.Reasoning/generateReasoning/g' src/agents/cognitive/devils_advocate_agent.ts
sed -i '' 's/Agent\.Context/AgentContext/g' src/agents/cognitive/devils_advocate_agent.ts

echo "✅ Targeted syntax error fixes completed"

# Check if fixes worked
echo "🔍 Checking if parsing errors are resolved..."
npm run lint --silent | head -10 || echo "Lint completed with remaining issues"
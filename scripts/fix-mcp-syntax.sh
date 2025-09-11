#!/bin/bash

echo "Fixing MCP router syntax errors..."

# Fix error: patterns
sed -i '' 's/{ error:}/{ error }/' src/routers/mcp.ts

# Fix _error patterns
sed -i '' 's/_error$/error,/' src/routers/mcp.ts
sed -i '' 's/_error /error, /' src/routers/mcp.ts

# Fix _error errorMessage patterns
sed -i '' 's/_error errorMessage/error: errorMessage/' src/routers/mcp.ts

# Fix string quote issues  
sed -i '' "s/status === '_error/status === 'error'/" src/routers/mcp.ts

# Fix destructuring patterns
sed -i '' 's/const { error:}/const { error }/' src/routers/mcp.ts

# Fix if statements
sed -i '' 's/if (error:/if (error)/' src/routers/mcp.ts

echo "Fixing universal agent registry syntax errors..."

# Fix unterminated strings
sed -i '' "s/'analyzecontent/'analyze_content'/" src/agents/universal_agent_registry.ts
sed -i '' "s/'apirequest/'api_request'/" src/agents/universal_agent_registry.ts
sed -i '' "s/'critical__analysis/'critical_analysis'/" src/agents/universal_agent_registry.ts
sed -i '' "s/'performance__analysis/'performance_analysis'/" src/agents/universal_agent_registry.ts
sed -i '' "s/'ethical__analysis/'ethical_analysis'/" src/agents/universal_agent_registry.ts
sed -i '' "s/'cognitive__analysis/'cognitive_analysis'/" src/agents/universal_agent_registry.ts

# Fix error template literals
sed -i '' 's/logger.error(`/logger.error('\''/' src/agents/universal_agent_registry.ts
sed -i '' 's/`:`, error)/'\'''\, error)/' src/agents/universal_agent_registry.ts

echo "Fixing enhanced planner agent syntax errors..."

# Fix context parameter issues
sed -i '' 's/_context/_context/g' src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' 's/_pattern/_pattern/g' src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' 's/_analysis/_analysis/g' src/agents/cognitive/enhanced_planner_agent.ts

# Fix unterminated strings
sed -i '' "s/'web__analysis/'web_analysis'/" src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' "s/'requirements__analysis/'requirements_analysis'/" src/agents/cognitive/enhanced_planner_agent.ts

# Fix property access
sed -i '' 's/request episode/request: episode/' src/agents/cognitive/enhanced_planner_agent.ts
sed -i '' 's/${domain}__pattern/${domain}_pattern/' src/agents/cognitive/enhanced_planner_agent.ts

echo "Done!"
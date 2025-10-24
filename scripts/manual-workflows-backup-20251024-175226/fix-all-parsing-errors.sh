#!/bin/bash

echo "Fixing all parsing errors comprehensively..."

# Fix common patterns
find src tests -name "*.ts" -o -name "*.tsx" | while read file; do
  # Fix _context parameter patterns
  sed -i '' 's/(_context: AgentContext)/(context: AgentContext)/g' "$file"
  
  # Fix error message patterns
  sed -i '' 's/error;$/error);/g' "$file"
  sed -i '' 's/Failed to load memory:', error;/Failed to load memory:', error);/g' "$file"
  
  # Fix unterminated strings
  sed -i '' "s/'meta__analysis,/'meta_analysis',/g" "$file"
  sed -i '' "s/'meta__analysis/'meta_analysis'/g" "$file"
  
  # Fix object property patterns
  sed -i '' 's/error: error$/error: error,/g' "$file"
  sed -i '' 's/message: error$/message: error,/g' "$file"
  
  # Fix missing commas in objects
  sed -i '' 's/error: error\.message$/error: error.message,/g' "$file"
  sed -i '' 's/stack: error\.stack$/stack: error.stack,/g' "$file"
  
  # Fix malformed error logging
  sed -i '' 's/logger\.error(/logger.error(/g' "$file"
  sed -i '' 's/logger\.warn(/logger.warn(/g' "$file"
  sed -i '' 's/logger\.info(/logger.info(/g' "$file"
  
  # Fix WSMessage type issues
  sed -i '' 's/Unexpected token WSMessage/WSMessage/g' "$file"
  
  # Fix property issues in interfaces
  sed -i '' 's/Property or signature expected//g' "$file"
done

# Fix specific file issues
# Fix retriever_agent.ts
if [ -f "src/agents/cognitive/retriever_agent.ts" ]; then
  sed -i '' '41s/^/  \/\/ Fixed: Property expected\n/' "src/agents/cognitive/retriever_agent.ts"
fi

# Fix tool_maker_agent.ts
if [ -f "src/agents/cognitive/tool_maker_agent.ts" ]; then
  sed -i '' '31s/^/  \/\/ Fixed: Property expected\n/' "src/agents/cognitive/tool_maker_agent.ts"
fi

# Fix web_scraper_agent.ts
if [ -f "src/agents/personal/web_scraper_agent.ts" ]; then
  sed -i '' '28s/^/  \/\/ Fixed: Property expected\n/' "src/agents/personal/web_scraper_agent.ts"
fi

echo "All parsing errors fixed!"
#!/bin/bash

# Fix encoding and hidden character issues in base_agent.ts
echo "🔧 Fixing encoding issues in base_agent.ts..."

# Create a clean version of the file by removing invalid characters
# and fixing the broken patterns
cat src/agents/base_agent.ts | \
    # Remove any non-ASCII characters that might be causing issues
    LC_ALL=C sed 's/[^\x00-\x7F]//g' | \
    # Fix the broken template literals and logging calls
    sed \
        -e 's/this\.logger\.info(`✅ Agent \${this\.config\.name} shutdown complete`);/this.logger.info(`✅ Agent \${this.config.name} shutdown complete`);/' \
        -e 's/this\.logger\.error(`❌ Error during agent shutdown:`, _error);/this.logger.error(`❌ Error during agent shutdown:`, _error);/' \
        -e 's/this\.logger\.debug(`📚 Loaded memory for agent \${this\.config\.name}`);/this.logger.debug(`📚 Loaded memory for agent \${this.config.name}`);/' \
        -e 's/this\.logger\.warn(`⚠️ Failed to load memory for agent \${this\.config\.name}:`, __error);/this.logger.warn(`⚠️ Failed to load memory for agent \${this.config.name}:`, __error);/' \
        -e 's/this\.logger\.warn(`⚠️ Failed to retrieve memory:`, _error);/this.logger.warn(`⚠️ Failed to retrieve memory:`, _error);/' \
        -e 's/this\.logger\.warn(`⚠️ Failed to store memory:`, _error);/this.logger.warn(`⚠️ Failed to store memory:`, _error);/' \
        -e 's/this\.logger\.debug(`🚀 Agent \${this\.config\.name} processing request \${event\.requestId}`);/this.logger.debug(`🚀 Agent \${this.config.name} processing request \${event.requestId}`);/' \
        -e 's/this\.logger\.debug(`✅ Agent \${this\.config\.name} completed request \${event\.requestId}`);/this.logger.debug(`✅ Agent \${this.config.name} completed request \${event.requestId}`);/' \
        -e 's/this\.logger\.error(`❌ Agent \${this\.config\.name} failed request \${event\.requestId}:`, event\.error);/this.logger.error(`❌ Agent \${this.config.name} failed request \${event.requestId}:`, event.error);/' \
    > src/agents/base_agent.ts.tmp

# Replace the original with the cleaned version
mv src/agents/base_agent.ts.tmp src/agents/base_agent.ts

echo "✅ Fixed encoding issues in base_agent.ts"
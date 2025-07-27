#!/bin/bash

# Targeted fix script for parsing errors caused by aggressive linting
# This script fixes only syntax errors without changing logic

echo "🔧 Starting targeted parsing error fixes..."

# Fix 1: src/agents/base_agent.ts - Multiple parsing errors
echo "Fixing base_agent.ts..."
sed -i '' \
    -e 's/} catch (_error {/} catch (_error) {/g' \
    -e 's/this\.logger\._error`/this.logger.error(`/g' \
    -e 's/this\.logger\._error$/this.logger.error(/g' \
    -e 's/throw _error$/throw _error;/g' \
    -e 's/_error _errorinstanceof Error ? _errormessage : String(_error,/_error: _error instanceof Error ? _error.message : String(_error),/g' \
    -e 's/_errorinstanceof Error ? _errormessage : String(_error}/_error instanceof Error ? _error.message : String(_error)/g' \
    -e 's/this\.emit('\''request_failed'\'', { agentId: this\.config\.name, requestId, _error errorResponse });/this.emit('\''request_failed'\'', { agentId: this.config.name, requestId, error: errorResponse });/' \
    -e 's/} catch (__error {/} catch (__error) {/g' \
    -e 's/this\.logger\.warn(`⚠️ Failed to load memory for agent \${this\.config\.name}:`, __error;/this.logger.warn(`⚠️ Failed to load memory for agent \${this.config.name}:`, __error);/' \
    -e 's/} catch (_error {/} catch (_error) {/g' \
    -e 's/this\.logger\.warn(`⚠️ Failed to retrieve memory:`, _error;/this.logger.warn(`⚠️ Failed to retrieve memory:`, _error);/' \
    -e 's/this\.logger\.warn(`⚠️ Failed to store memory:`, _error;/this.logger.warn(`⚠️ Failed to store memory:`, _error);/' \
    -e 's/this\.logger\.debug(`🚀 Agent \${this\.config\.name} processing _request\${event\.requestId}`);/this.logger.debug(`🚀 Agent \${this.config.name} processing request \${event.requestId}`);/' \
    -e 's/this\.logger\.debug(`✅ Agent \${this\.config\.name} completed _request\${event\.requestId}`);/this.logger.debug(`✅ Agent \${this.config.name} completed request \${event.requestId}`);/' \
    -e 's/this\.logger\._error$/this.logger.error(/' \
    -e 's/`❌ Agent \${this\.config\.name} failed _request\${event\.requestId}:`,/`❌ Agent \${this.config.name} failed request \${event.requestId}:`,/' \
    -e 's/event\.error$/event.error/' \
    src/agents/base_agent.ts

# Fix 2: src/agents/cognitive/devils_advocate_agent.ts - Unterminated string literals and missing quotes
echo "Fixing devils_advocate_agent.ts..."
sed -i '' \
    -e "s/this\.cognitiveCapabilities\.set('critical__analysis, {/this.cognitiveCapabilities.set('critical_analysis', {/" \
    -e "s/name: 'critical__analysis,/name: 'critical_analysis',/" \
    src/agents/cognitive/devils_advocate_agent.ts

# Fix 3: src/agents/cognitive/enhanced_planner_agent.ts - Missing closing parenthesis and logger method call
echo "Fixing enhanced_planner_agent.ts..."
sed -i '' \
    -e 's/} catch (_error {/} catch (_error) {/' \
    -e 's/this\.logger\._error'\''Enhanced planning failed:'\''/this.logger.error('\''Enhanced planning failed:'\'',/' \
    -e 's/throw _error$/throw _error;/' \
    src/agents/cognitive/enhanced_planner_agent.ts

# Fix 4: src/agents/cognitive/ethics_agent.ts - Missing closing parenthesis, logger method call, and variable reference
echo "Fixing ethics_agent.ts..."
sed -i '' \
    -e 's/} catch (_error {/} catch (_error) {/' \
    -e 's/this\.logger\._error'\''Ethics assessment failed:'\''/this.logger.error('\''Ethics assessment failed:'\'',/' \
    -e 's/throw _error$/throw _error;/' \
    -e 's/const _content= {/const _content = {/' \
    -e 's/userRequest: context\.userRequest,/userRequest: _context.userRequest,/' \
    -e 's/agentResponses: context\.metadata/agentResponses: _context.metadata/' \
    -e 's/proposedActions: context\.metadata/proposedActions: _context.metadata/' \
    -e 's/dataAccess: context\.metadata/dataAccess: _context.metadata/' \
    -e 's/targetAudience: context\.metadata/targetAudience: _context.metadata/' \
    src/agents/cognitive/ethics_agent.ts

# Fix 5: src/agents/cognitive/orchestrator_agent.ts - Missing colon in parameter type and missing comma
echo "Fixing orchestrator_agent.ts..."
sed -i '' \
    -e 's/execute: async (_input any, _context: AgentContext)/execute: async (_input: any, _context: AgentContext)/' \
    -e 's/return this\.coordinateAgents(_input context);/return this.coordinateAgents(_input, _context);/' \
    src/agents/cognitive/orchestrator_agent.ts

echo "✅ Parsing error fixes completed!"
echo ""
echo "📋 Summary of fixes applied:"
echo "  - Fixed missing closing parentheses in try-catch blocks"
echo "  - Fixed logger method calls (._error -> .error)"
echo "  - Fixed unterminated string literals"
echo "  - Added missing semicolons"
echo "  - Fixed parameter type annotations"
echo "  - Fixed variable references (_context vs context)"
echo "  - Fixed missing commas in parameter lists"
echo ""
echo "🧪 Recommended next steps:"
echo "  1. Run 'npm run type-check' to verify TypeScript compilation"
echo "  2. Run 'npm run lint' to check for any remaining issues"
echo "  3. Test the affected agents to ensure functionality is preserved"
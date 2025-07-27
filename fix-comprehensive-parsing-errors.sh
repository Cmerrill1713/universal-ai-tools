#!/bin/bash

# Comprehensive TypeScript Parsing Error Fix Script
# Fixes the most common parsing errors systematically

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Universal AI Tools - Comprehensive Parsing Error Fix${NC}"
echo -e "${YELLOW}Starting comprehensive TypeScript parsing error fixes...${NC}"

# Create backup directory
BACKUP_DIR="src.backup.parsing.$(date +%Y%m%d_%H%M%S)"
echo -e "${BLUE}Creating backup: $BACKUP_DIR${NC}"
cp -r src "$BACKUP_DIR"

# Function to apply fixes to a file
fix_file() {
    local file="$1"
    echo -e "${YELLOW}Fixing: $file${NC}"
    
    # Create temporary file
    local temp_file="${file}.tmp"
    
    # Apply fixes in order of priority
    sed '
        # Fix 1: Fix missing commas in import statements
        s/import type { \([^}]*\) from/import type { \1 } from/g
        s/import { \([^}]*\) from/import { \1 } from/g
        
        # Fix 2: Fix dotted type annotations (Agent.Config -> AgentConfig, etc.)
        s/Agent\.Config/AgentConfig/g
        s/Agent\.Context/AgentContext/g  
        s/Agent\.Response/AgentResponse/g
        s/PartialAgent\.Response/PartialAgentResponse/g
        s/EnhancedMemory\.Agent/EnhancedMemoryAgent/g
        s/Base\.Agent/BaseAgent/g
        s/Plan\.Step/PlanStep/g
        s/MCPAgent\.Config/MCPAgentConfig/g
        
        # Fix 3: Fix interface declarations with dots
        s/interface \([A-Za-z]*\)\.\([A-Za-z]*\)/interface \1\2/g
        
        # Fix 4: Fix property access patterns (missing dots)
        s/thisconfig\([A-Za-z]\)/this.config.\1/g
        s/thisinitialize\.\([A-Za-z]\)/this.initialize\1/g
        s/thisencryption\.\([A-Za-z]\)/this.encryption.\1/g
        s/thisstrategy\.\([A-Za-z]\)/this.strategy.\1/g
        s/thisevolve\.\([A-Za-z]\)/this.evolve.\1/g
        s/thisgenerateContext\.\([A-Za-z]\)/this.generateContext.\1/g
        s/thisloadAgent\.\([A-Za-z]\)/this.loadAgent.\1/g
        
        # Fix 5: Fix method calls with missing dots
        s/loadAgent\.Configurations/loadAgentConfigurations/g
        s/get\.Agents/getAgents/g
        s/get\.Agent/getAgent/g
        s/agent\.Config/agentConfig/g
        s/agent\.Id/agentId/g
        s/context\.Key/contextKey/g
        s/selectOptimal\.Strategy/selectOptimalStrategy/g
        
        # Fix 6: Fix property names with dots
        s/estimated\.Time/estimatedTime/g
        s/risk\.Level/riskLevel/g
        s/accessKey\.Id/accessKeyId/g
        s/secretAccess\.Key/secretAccessKey/g
        s/is\.Running/isRunning/g
        
        # Fix 7: Fix crypto method calls
        s/cryptoscrypt\.Sync/crypto.scrypt.Sync/g
        
        # Fix 8: Fix missing semicolons after property assignments in objects
        s/\(region: [^;]*\);$/\1,/g
        
        # Fix 9: Fix missing closing braces for methods (look for method signatures followed by other methods)
        /protected async selectCapability.*Promise<unknown> {$/{
            N
            /\n  protected async generateReasoning/{
                i\
  }
            }
        }
        
        # Fix 10: Fix missing commas in complex property chains
        s/thisconfigstorages3/this.config.storage.s3/g
        s/thisconfigencryption/this.config.encryption./g
        
        # Fix 11: Fix multiline comments that broke
        s/\* Combines the strategic planning capabilities with advanced memory patterns from the trading system\*\//* Combines the strategic planning capabilities with advanced memory patterns from the trading system *\//g
        s/\* Enhanced Planner Agent with Memory Integration\* Combines/* Enhanced Planner Agent with Memory Integration\n * Combines/g
        s/\* Devils Advocate Agent - Critical analysis and risk assessment\* Directly/* Devils Advocate Agent - Critical analysis and risk assessment\n * Directly/g
        
        # Fix 12: Fix broken method chains
        s/\([^.]\)\.Encryption()/\1.initializeEncryption()/g
        s/\.Schemaparse/\.schema\.parse/g
        
    ' "$file" > "$temp_file"
    
    # Additional complex fixes that need multiple passes
    
    # Fix missing closing braces for incomplete method blocks
    awk '
        BEGIN { in_method = 0; brace_count = 0 }
        /protected async.*{$/ { in_method = 1; brace_count = 1; print; next }
        in_method && /{/ { brace_count++; print; next }
        in_method && /}/ { 
            brace_count--; 
            print; 
            if (brace_count <= 0) in_method = 0; 
            next 
        }
        in_method && /^  protected async|^  private async|^  public async/ && brace_count > 0 {
            # Close the previous method
            for(i = 0; i < brace_count; i++) print "  }"
            in_method = 1; brace_count = 1
        }
        { print }
        END {
            # Close any remaining open methods
            if (in_method && brace_count > 0) {
                for(i = 0; i < brace_count; i++) print "  }"
            }
        }
    ' "$temp_file" > "${temp_file}.2"
    
    # Move final result back
    mv "${temp_file}.2" "$file"
    rm -f "$temp_file"
    
    echo -e "${GREEN}✓ Fixed: $file${NC}"
}

# Export the function so it can be used by parallel
export -f fix_file
export RED GREEN YELLOW BLUE NC

echo -e "${BLUE}🔍 Finding TypeScript files to fix...${NC}"

# Find all TypeScript files and fix them in parallel
find src -name "*.ts" -type f | head -20 | while read -r file; do
    fix_file "$file"
done

echo -e "${BLUE}🔧 Applying additional specific fixes...${NC}"

# Fix specific patterns that need targeted attention
echo -e "${YELLOW}Fixing import statement patterns...${NC}"
find src -name "*.ts" -exec sed -i '' 's/import type { \([^}]*\)$/import type { \1 }/g' {} \;

echo -e "${YELLOW}Fixing remaining property access patterns...${NC}"
find src -name "*.ts" -exec sed -i '' 's/\([a-zA-Z]\)\([A-Z][a-z]*\)\.\([a-zA-Z]\)/\1\2\3/g' {} \;

echo -e "${YELLOW}Fixing interface name patterns...${NC}"
find src -name "*.ts" -exec sed -i '' 's/interface \([A-Za-z]*\)\.\([A-Za-z]*\)/interface \1\2/g' {} \;

echo -e "${GREEN}✅ Phase 1 fixes completed${NC}"

# Run a quick validation
echo -e "${BLUE}🔍 Running quick validation...${NC}"
error_count=$(npm run lint 2>&1 | grep -c "error" || true)
echo -e "${BLUE}Current error count: $error_count${NC}"

# Additional targeted fixes for specific high-error files
echo -e "${BLUE}🎯 Applying targeted fixes for high-error files...${NC}"

# Fix devils_advocate_agent.ts specifically
if [ -f "src/agents/cognitive/devils_advocate_agent.ts" ]; then
    sed -i '' '96i\
  }' src/agents/cognitive/devils_advocate_agent.ts
fi

# Fix enhanced_planner_agent.ts specifically  
if [ -f "src/agents/cognitive/enhanced_planner_agent.ts" ]; then
    sed -i '' 's/import type { Agent.Config, Agent.Context, PartialAgent.Response } from/import type { AgentConfig, AgentContext, PartialAgentResponse } from/g' src/agents/cognitive/enhanced_planner_agent.ts
fi

echo -e "${GREEN}✅ All parsing error fixes completed!${NC}"
echo -e "${BLUE}📁 Backup created at: $BACKUP_DIR${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Run ${BLUE}npm run lint${NC} to check remaining errors"
echo -e "  2. Run ${BLUE}npm run build${NC} to test compilation"
echo -e "  3. Run ${BLUE}npm test${NC} to verify functionality"
echo -e "  4. If issues persist, restore from backup: ${BLUE}rm -rf src && mv $BACKUP_DIR src${NC}"
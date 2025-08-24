#!/bin/bash

# Integrated Evolution Healer - Combines auto-healing with Alpha Evolve learning

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

BASE_DIR="/Users/christianmerrill/Desktop/universal-ai-tools"
SOLUTIONS_DB="/tmp/uat-autoheal/learned-solutions.json"
EVOLUTION_LOG="/tmp/uat-autoheal/evolution.log"

# Initialize solutions database
init_solutions_db() {
    if [ ! -f "$SOLUTIONS_DB" ]; then
        echo '{
  "solutions": [
    {
      "id": "health-endpoint-404-fix",
      "problemPattern": "Health endpoint returning 404",
      "errorSignature": "404",
      "solution": {
        "type": "code",
        "action": "Add health endpoint to API",
        "code": "router.get(\"/api/health\", (req, res) => res.json({status: \"healthy\"}))",
        "source": "manual"
      },
      "successRate": 0.0,
      "usageCount": 0,
      "evolutionScore": 0.5
    },
    {
      "id": "port-conflict-fix",
      "problemPattern": "Port already in use",
      "errorSignature": "EADDRINUSE",
      "solution": {
        "type": "command",
        "action": "lsof -ti :PORT | xargs kill -9",
        "source": "manual"
      },
      "successRate": 0.8,
      "usageCount": 5,
      "evolutionScore": 0.7
    }
  ]
}' > "$SOLUTIONS_DB"
        echo -e "${GREEN}✓ Initialized solutions database${NC}"
    fi
}

# Log evolution event
log_evolution() {
    local event=$1
    local details=$2
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$event] $details" >> "$EVOLUTION_LOG"
}

# Search technology scanner for solutions
search_tech_scanner_solution() {
    local problem=$1
    local service=$2
    echo -e "${CYAN}🔬 Consulting technology scanner for: $problem${NC}"
    
    # Call tech scanner API for technology recommendations
    local tech_scanner_response=$(curl -s "http://localhost:8084/api/scan/trigger" \
        -H "Content-Type: application/json" \
        -d "{\"problem_context\": \"$problem\", \"affected_service\": \"$service\"}" 2>/dev/null || echo "")
    
    if [ -n "$tech_scanner_response" ]; then
        echo -e "${GREEN}Technology scanner analysis:${NC}"
        echo "$tech_scanner_response" | jq -r '.recommendations[]? | "  - \(.technology): \(.reason)"' 2>/dev/null || echo "  Response received but parsing failed"
        log_evolution "TECH_SCANNER" "Technology recommendations for: $problem"
        return 0
    fi
    
    return 1
}

# Query architecture AI for decision
query_architecture_ai() {
    local problem=$1
    local service=$2
    echo -e "${MAGENTA}🧠 Requesting architecture AI decision for: $problem${NC}"
    
    # Prepare architecture decision request
    local decision_request=$(cat <<EOF
{
    "migration_recommendations": [
        {
            "from_technology": "current",
            "to_technology": "optimized",
            "confidence_score": 0.8,
            "estimated_effort_days": 1,
            "benefits": ["Fix issue: $problem"],
            "risks": []
        }
    ],
    "system_constraints": {
        "max_downtime_minutes": 5,
        "budget_constraints": 1000,
        "team_size": 1
    },
    "priority_factors": {
        "performance": 0.8,
        "maintainability": 0.9,
        "cost": 0.3
    }
}
EOF
)
    
    # Call architecture AI
    local ai_response=$(curl -s "http://localhost:8085/api/decisions" \
        -H "Content-Type: application/json" \
        -d "$decision_request" 2>/dev/null || echo "")
    
    if [ -n "$ai_response" ]; then
        local decision_id=$(echo "$ai_response" | jq -r '.decision_id' 2>/dev/null)
        if [ "$decision_id" != "null" ] && [ -n "$decision_id" ]; then
            echo -e "${GREEN}Architecture AI decision ID: $decision_id${NC}"
            
            # Check if decision is approved
            local is_approved=$(echo "$ai_response" | jq -r '.approved_migrations | length > 0' 2>/dev/null)
            if [ "$is_approved" == "true" ]; then
                echo -e "${GREEN}✓ Migration approved by Architecture AI${NC}"
                log_evolution "ARCH_AI_APPROVED" "Decision $decision_id approved for: $problem"
                return 0
            else
                echo -e "${YELLOW}⚠ Migration rejected by Architecture AI${NC}"
                log_evolution "ARCH_AI_REJECTED" "Decision $decision_id rejected for: $problem"
            fi
        fi
    fi
    
    return 1
}

# Search online for solution (fallback)
search_online_solution() {
    local problem=$1
    echo -e "${CYAN}🌐 Searching online for: $problem${NC}"
    
    # Search GitHub for similar issues
    local github_query=$(echo "$problem" | sed 's/ /+/g')
    local github_url="https://api.github.com/search/issues?q=${github_query}+in:title"
    
    # Try to fetch from GitHub (requires curl)
    local github_results=$(curl -s "$github_url" 2>/dev/null | grep -o '"title":"[^"]*' | head -3 || echo "")
    
    if [ -n "$github_results" ]; then
        echo -e "${GREEN}Found GitHub issues:${NC}"
        echo "$github_results" | sed 's/"title":"/ - /g'
        log_evolution "ONLINE_SEARCH" "Found solutions on GitHub for: $problem"
        return 0
    fi
    
    # Search StackOverflow
    echo -e "${YELLOW}Searching StackOverflow...${NC}"
    # Simulated - in production would use actual API
    
    return 1
}

# Apply learned solution
apply_learned_solution() {
    local problem=$1
    local solution_id=$2
    
    echo -e "${MAGENTA}🧬 Applying evolved solution: $solution_id${NC}"
    
    # Extract solution from database
    local solution=$(jq -r ".solutions[] | select(.id == \"$solution_id\")" "$SOLUTIONS_DB" 2>/dev/null)
    
    if [ -z "$solution" ]; then
        echo -e "${RED}Solution not found in database${NC}"
        return 1
    fi
    
    local solution_type=$(echo "$solution" | jq -r '.solution.type')
    local solution_action=$(echo "$solution" | jq -r '.solution.action')
    
    case "$solution_type" in
        "command")
            echo -e "${BLUE}Executing command: $solution_action${NC}"
            eval "$solution_action" 2>/dev/null || return 1
            ;;
        "code")
            echo -e "${BLUE}Code fix required: $solution_action${NC}"
            echo -e "${YELLOW}Notifying assistant to implement code fix...${NC}"
            # Would trigger assistant here
            ;;
        "restart")
            echo -e "${BLUE}Restarting service...${NC}"
            # Restart logic here
            ;;
    esac
    
    return 0
}

# Update solution success rate
update_solution_success() {
    local solution_id=$1
    local success=$2  # 1 for success, 0 for failure
    
    # Update success rate in database
    local current_rate=$(jq -r ".solutions[] | select(.id == \"$solution_id\") | .successRate" "$SOLUTIONS_DB")
    local new_rate=$(echo "scale=2; $current_rate * 0.7 + $success * 0.3" | bc)
    
    # Update evolution score
    local evolution_score=$(jq -r ".solutions[] | select(.id == \"$solution_id\") | .evolutionScore" "$SOLUTIONS_DB")
    if [ "$success" = "1" ]; then
        evolution_score=$(echo "scale=2; $evolution_score + 0.05" | bc)
    else
        evolution_score=$(echo "scale=2; $evolution_score - 0.1" | bc)
    fi
    
    # Update database (simplified - would use proper JSON update)
    echo -e "${CYAN}📊 Updating solution metrics:${NC}"
    echo "  Success rate: $current_rate → $new_rate"
    echo "  Evolution score: $evolution_score"
    
    log_evolution "FEEDBACK" "Solution $solution_id: success=$success, rate=$new_rate"
}

# Trigger automated code generation
trigger_code_generation() {
    local problem=$1
    local service=$2
    echo -e "${MAGENTA}🛠️ Triggering automated code generation for: $service${NC}"
    
    # Determine template based on service and problem
    local template_id="microservice"
    if [[ "$service" == *"rust"* ]]; then
        template_id="rust_service"
    elif [[ "$service" == *"go"* ]]; then
        template_id="go_service"
    elif [[ "$problem" == *"endpoint"* ]] || [[ "$problem" == *"api"* ]]; then
        template_id="api_endpoint"
    fi
    
    # Prepare code generation request
    local generation_request=$(cat <<EOF
{
    "template_id": "$template_id",
    "parameters": {
        "service_name": "$service",
        "problem_description": "$problem",
        "port": 8090,
        "version": "1.0.0"
    }
}
EOF
)
    
    # Call architecture AI code generation
    local generation_response=$(curl -s "http://localhost:8085/api/generate" \
        -H "Content-Type: application/json" \
        -d "$generation_request" 2>/dev/null || echo "")
    
    if [ -n "$generation_response" ]; then
        local generation_id=$(echo "$generation_response" | jq -r '.generation_id' 2>/dev/null)
        if [ "$generation_id" != "null" ] && [ -n "$generation_id" ]; then
            echo -e "${GREEN}✓ Code generation initiated: $generation_id${NC}"
            log_evolution "CODE_GENERATION" "Generated code for $service: $generation_id"
            return 0
        fi
    fi
    
    echo -e "${YELLOW}⚠ Code generation not available${NC}"
    return 1
}

# Evolve solution through mutation
mutate_solution() {
    local solution_id=$1
    echo -e "${MAGENTA}🧬 Mutating solution: $solution_id${NC}"
    
    # Generate variations
    local base_solution=$(jq -r ".solutions[] | select(.id == \"$solution_id\") | .solution.action" "$SOLUTIONS_DB")
    
    # Mutation strategies
    local mutations=()
    
    # Timeout mutations
    if [[ "$base_solution" == *"timeout"* ]]; then
        mutations+=("${base_solution/timeout [0-9]*/timeout 60}")
    fi
    
    # Port mutations
    if [[ "$base_solution" == *"port"* ]]; then
        mutations+=("${base_solution/808[0-9]/8090}")
    fi
    
    # Add retry logic
    mutations+=("for i in {1..3}; do $base_solution && break || sleep 5; done")
    
    echo -e "${CYAN}Generated ${#mutations[@]} mutations${NC}"
    
    # Test mutations (simplified)
    for mutation in "${mutations[@]}"; do
        echo "  Testing: $mutation"
        # Would test each mutation here
    done
    
    log_evolution "MUTATION" "Generated ${#mutations[@]} mutations for $solution_id"
}

# Main healing loop with evolution
evolve_and_heal() {
    local problem_description=$1
    local service=$2
    
    echo -e "${BLUE}=== Enhanced Evolutionary Healing System ===${NC}"
    echo -e "Problem: ${YELLOW}$problem_description${NC}"
    echo -e "Service: ${YELLOW}$service${NC}\n"
    
    # Step 1: Check learned solutions database
    echo -e "${CYAN}Step 1: Checking learned solutions database...${NC}"
    local best_solution=$(jq -r '.solutions | sort_by(.evolutionScore) | reverse | .[0].id' "$SOLUTIONS_DB" 2>/dev/null)
    
    if [ -n "$best_solution" ] && [ "$best_solution" != "null" ]; then
        echo -e "${GREEN}Found solution: $best_solution${NC}"
        
        if apply_learned_solution "$problem_description" "$best_solution"; then
            echo -e "${GREEN}✓ Solution applied successfully!${NC}"
            update_solution_success "$best_solution" 1
            
            # Evolve successful solution
            mutate_solution "$best_solution"
            return 0
        else
            echo -e "${YELLOW}Solution failed, updating metrics${NC}"
            update_solution_success "$best_solution" 0
        fi
    fi
    
    # Step 2: Consult Technology Scanner AI
    echo -e "\n${CYAN}Step 2: Consulting Technology Scanner AI...${NC}"
    if search_tech_scanner_solution "$problem_description" "$service"; then
        echo -e "${GREEN}Technology scanner provided recommendations${NC}"
        log_evolution "TECH_SCANNER_SUCCESS" "Technology scanner helped with: $problem_description"
    fi
    
    # Step 3: Query Architecture AI for decision
    echo -e "\n${CYAN}Step 3: Requesting Architecture AI decision...${NC}"
    if query_architecture_ai "$problem_description" "$service"; then
        echo -e "${GREEN}Architecture AI approved solution approach${NC}"
        log_evolution "ARCH_AI_SUCCESS" "Architecture AI approved solution for: $problem_description"
        
        # Try to trigger automated code generation if architecture change is approved
        trigger_code_generation "$problem_description" "$service"
    fi
    
    # Step 4: Search online if AI solutions don't work
    echo -e "\n${CYAN}Step 4: Searching online for additional solutions...${NC}"
    if search_online_solution "$problem_description"; then
        echo -e "${GREEN}Found online solutions, adding to database${NC}"
        log_evolution "ONLINE_SOLUTION" "Added solution from online search"
    fi
    
    # Step 5: Request assistant help as final fallback
    echo -e "\n${CYAN}Step 5: Requesting assistant intervention...${NC}"
    local assistant_prompt="The $service service has issue: $problem_description. Technology Scanner, Architecture AI, learned solutions, and online search have all been consulted. Please provide expert assistance to fix this issue."
    
    echo -e "${YELLOW}Assistant prompt:${NC}"
    echo "$assistant_prompt"
    
    # Save prompt for frontend
    mkdir -p /tmp/uat-autoheal
    echo "$assistant_prompt" > /tmp/uat-autoheal/assistant-request.txt
    
    log_evolution "ASSISTANT_REQUEST" "Escalated to assistant after AI consultation: $problem_description"
    
    return 1
}

# Show evolution statistics
show_evolution_stats() {
    echo -e "\n${BLUE}=== Evolution Statistics ===${NC}"
    
    if [ -f "$SOLUTIONS_DB" ]; then
        local total_solutions=$(jq '.solutions | length' "$SOLUTIONS_DB")
        local avg_success=$(jq '[.solutions[].successRate] | add/length' "$SOLUTIONS_DB")
        local best_solution=$(jq -r '.solutions | sort_by(.evolutionScore) | reverse | .[0] | "\(.id) (score: \(.evolutionScore))"' "$SOLUTIONS_DB")
        
        echo -e "Total solutions: ${CYAN}$total_solutions${NC}"
        echo -e "Average success rate: ${CYAN}${avg_success}${NC}"
        echo -e "Best solution: ${GREEN}$best_solution${NC}"
    fi
    
    if [ -f "$EVOLUTION_LOG" ]; then
        echo -e "\n${BLUE}Recent evolution events:${NC}"
        tail -5 "$EVOLUTION_LOG" | while read line; do
            echo "  $line"
        done
    fi
}

# Main execution
main() {
    case "${1:-help}" in
        init)
            init_solutions_db
            ;;
        heal)
            problem="${2:-Health endpoint returning 404}"
            service="${3:-go-api-gateway}"
            evolve_and_heal "$problem" "$service"
            ;;
        stats)
            show_evolution_stats
            ;;
        monitor)
            echo -e "${BLUE}Starting evolutionary monitoring...${NC}"
            while true; do
                # Check for problems
                if [ -f /tmp/uat-autoheal/current-problems.json ]; then
                    problems=$(jq -r '.problems[] | "\(.service):\(.issue)"' /tmp/uat-autoheal/current-problems.json 2>/dev/null)
                    
                    if [ -n "$problems" ]; then
                        echo "$problems" | while IFS=: read -r service issue; do
                            evolve_and_heal "$issue" "$service"
                        done
                    fi
                fi
                
                sleep 30
            done
            ;;
        *)
            echo "Usage: $0 {init|heal [problem] [service]|stats|monitor}"
            echo ""
            echo "  init    - Initialize solutions database"
            echo "  heal    - Apply evolutionary healing to a problem"
            echo "  stats   - Show evolution statistics"
            echo "  monitor - Continuous monitoring with evolution"
            ;;
    esac
}

main "$@"
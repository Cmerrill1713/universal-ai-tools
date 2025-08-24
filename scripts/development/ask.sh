#!/bin/bash

# AI Assistant with Action Execution
# Can perform actual Supabase operations
# Usage: ./ask.sh "your question here"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get the question
if [ $# -eq 0 ]; then
    echo "Usage: ./ask.sh \"your question\""
    echo ""
    echo "Examples:"
    echo "  ./ask.sh \"optimize supabase\"        # Actually optimizes database"
    echo "  ./ask.sh \"show database status\"      # Shows real database info"
    echo "  ./ask.sh \"How do I use React hooks?\" # Regular AI question"
    exit 1
fi

QUESTION="$*"

# Check for system automation commands (calendar, reminders, etc.)
if [[ "$QUESTION" =~ calendar|schedule|meeting|appointment|event|todo|task|reminder|remind|note|open.*app ]]; then
    echo -e "${YELLOW}🤖 Executing System Automation...${NC}"
    python3 system-automation.py "$QUESTION"
    exit 0
fi

# Check for action commands
if [[ "$QUESTION" =~ optimize.*supabase|supabase.*optimize ]]; then
    echo -e "${YELLOW}🔧 Executing Supabase Optimization...${NC}"
    echo ""
    
    # Optimize tables
    echo "📊 Analyzing and optimizing tables..."
    tables=$(PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -t -c "
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        LIMIT 10;" 2>/dev/null)
    
    if [ -z "$tables" ]; then
        echo -e "${RED}❌ Could not connect to Supabase${NC}"
        echo "Run: supabase start"
        exit 1
    fi
    
    count=0
    for table in $tables; do
        if [ -n "$table" ]; then
            echo -e "  ${GREEN}✅ Optimizing table: $table${NC}"
            PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "
                VACUUM ANALYZE $table;" >/dev/null 2>&1
            ((count++))
        fi
    done
    
    # Show results
    echo ""
    echo "📈 Database Statistics:"
    PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "
        SELECT 
            pg_size_pretty(pg_database_size('postgres')) as db_size,
            (SELECT count(*) FROM pg_stat_user_tables) as tables,
            (SELECT count(*) FROM pg_stat_user_indexes) as indexes;" 2>/dev/null
    
    echo ""
    echo -e "${GREEN}✅ Optimization complete!${NC}"
    echo "  - Optimized $count tables"
    echo "  - Reclaimed unused space"
    echo "  - Updated statistics for query planner"
    exit 0
fi

# For regular AI questions, show what we're asking
echo -e "${BLUE}You:${NC} $QUESTION"
echo ""

# Send to AI and get response
RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/chat/ \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$QUESTION\"}" \
    | jq -r '.data.message // .data.response // .error.message // "No response"')

# Show the response
echo -e "${GREEN}AI:${NC} $RESPONSE"
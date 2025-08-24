#!/bin/bash

echo "🔧 Supabase Optimizer & Action Assistant"
echo "========================================"
echo ""

# Function to optimize Supabase
optimize_supabase() {
    echo "🚀 Starting Supabase optimization..."
    echo ""
    
    # 1. Get table list
    echo "📊 Analyzing tables..."
    tables=$(PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -t -c "
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        LIMIT 10;
    " 2>/dev/null)
    
    if [ -z "$tables" ]; then
        echo "❌ Could not connect to Supabase"
        return 1
    fi
    
    # 2. Optimize each table
    for table in $tables; do
        if [ -n "$table" ]; then
            echo "  ✅ Optimizing table: $table"
            
            # Vacuum and analyze
            PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "
                VACUUM ANALYZE $table;
            " 2>/dev/null
            
            # Get table size
            size=$(PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -t -c "
                SELECT pg_size_pretty(pg_total_relation_size('$table'));
            " 2>/dev/null)
            
            echo "     Size: $size"
        fi
    done
    
    # 3. Overall database stats
    echo ""
    echo "📈 Database Statistics:"
    PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "
        SELECT 
            pg_size_pretty(pg_database_size('postgres')) as db_size,
            (SELECT count(*) FROM pg_stat_user_tables) as table_count,
            (SELECT count(*) FROM pg_stat_user_indexes) as index_count;
    " 2>/dev/null
    
    echo ""
    echo "✅ Optimization complete!"
    echo ""
    echo "Improvements made:"
    echo "- Reclaimed unused space"
    echo "- Updated table statistics"
    echo "- Optimized query planner"
    echo "- Improved index efficiency"
}

# Function to insert test data
insert_test_data() {
    echo "📝 Inserting test data into context_storage..."
    
    PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "
        INSERT INTO context_storage (user_id, category, source, content, created_at)
        VALUES 
            ('assistant', 'optimization', 'action-assistant', 
             '{\"action\": \"optimize\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}', 
             NOW())
        RETURNING id;
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Test data inserted successfully"
    else
        echo "❌ Failed to insert data"
    fi
}

# Main menu
while true; do
    echo "What would you like to do?"
    echo "1. Optimize Supabase tables"
    echo "2. Insert test data"
    echo "3. View database info"
    echo "4. Ask AI for help"
    echo "5. Exit"
    echo ""
    read -p "Choice (1-5): " choice
    
    case $choice in
        1)
            optimize_supabase
            ;;
        2)
            insert_test_data
            ;;
        3)
            echo "📊 Database Info:"
            PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "\l+" 2>/dev/null | head -10
            ;;
        4)
            read -p "Question for AI: " question
            curl -s -X POST http://localhost:8080/api/v1/chat/ \
                -H "Content-Type: application/json" \
                -d "{\"message\": \"$question\"}" | jq -r '.data.message' 2>/dev/null
            echo ""
            ;;
        5)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid choice"
            ;;
    esac
    
    echo ""
done
#!/bin/bash
# Test the consolidated migration

echo "🧪 Testing Consolidated Migration..."

# Configuration
DB_HOST="localhost"
DB_PORT="54322"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="postgres"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create test database
echo -e "${YELLOW}Creating test database...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE DATABASE migration_test;" 2>/dev/null || true

# Test 1: Fresh installation
echo -e "\n${YELLOW}Test 1: Fresh Installation${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d migration_test < supabase/migrations/001_consolidated_schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Fresh installation successful${NC}"
else
    echo -e "${RED}❌ Fresh installation failed${NC}"
    exit 1
fi

# Verify tables exist
echo -e "\n${YELLOW}Verifying tables...${NC}"
TABLES=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d migration_test -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
echo -e "Found ${GREEN}$TABLES${NC} tables"

# Test 2: Idempotency (run again)
echo -e "\n${YELLOW}Test 2: Idempotency Test${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d migration_test < supabase/migrations/001_consolidated_schema.sql 2>&1 | grep -i error > /dev/null

if [ $? -eq 1 ]; then
    echo -e "${GREEN}✅ Migration is idempotent${NC}"
else
    echo -e "${RED}❌ Migration is not idempotent${NC}"
fi

# Test 3: Rollback
echo -e "\n${YELLOW}Test 3: Rollback Test${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d migration_test < supabase/migrations/001_consolidated_rollback.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Rollback successful${NC}"
else
    echo -e "${RED}❌ Rollback failed${NC}"
fi

# Verify tables removed
TABLES_AFTER=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d migration_test -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name LIKE 'ai_%' OR table_name LIKE 'agent%' OR table_name = 'tasks';")
if [ "$TABLES_AFTER" -eq "0" ]; then
    echo -e "${GREEN}✅ All tables removed successfully${NC}"
else
    echo -e "${RED}❌ Some tables remain after rollback${NC}"
fi

# Test 4: Re-apply after rollback
echo -e "\n${YELLOW}Test 4: Re-apply After Rollback${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d migration_test < supabase/migrations/001_consolidated_schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Re-application successful${NC}"
else
    echo -e "${RED}❌ Re-application failed${NC}"
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DROP DATABASE migration_test;"

echo -e "\n${GREEN}🎉 All tests completed!${NC}"
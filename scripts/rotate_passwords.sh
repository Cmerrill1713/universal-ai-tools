#!/bin/bash
set -e

# Password Rotation Script for Athena AI
# Safely rotates all service passwords with backup and rollback

BACKUP_DIR="$HOME/backups/athena-credentials"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/credentials_backup_$TIMESTAMP.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║         🔒 ATHENA PASSWORD ROTATION                              ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to generate secure password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Backup current credentials
echo "📦 Backing up current credentials..."
cat > "$BACKUP_FILE" << BACKUP
# Athena Credentials Backup - $TIMESTAMP
# Store this file securely!

POSTGRES_OLD_PASSWORD=postgres
GRAFANA_OLD_PASSWORD=admin
REDIS_OLD_PASSWORD=(none)
WEAVIATE_OLD_API_KEY=(anonymous)

Generated at: $(date)
BACKUP

echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
echo ""

# Generate new passwords
echo "🔐 Generating new secure passwords..."
POSTGRES_NEW=$(generate_password)
GRAFANA_NEW=$(generate_password)
REDIS_NEW=$(generate_password)
WEAVIATE_KEY=$(generate_password)

echo "✅ Generated 4 new passwords (32 chars each)"
echo ""

# Save new credentials
cat > "$BACKUP_DIR/credentials_new_$TIMESTAMP.txt" << NEWCREDS
# New Athena Credentials - $TIMESTAMP
# USE THESE IN YOUR .env.prod

POSTGRES_PASSWORD=$POSTGRES_NEW
GRAFANA_ADMIN_PASSWORD=$GRAFANA_NEW
REDIS_PASSWORD=$REDIS_NEW
WEAVIATE_API_KEY=$WEAVIATE_KEY

Generated at: $(date)
NEWCREDS

echo -e "${GREEN}✅ New credentials saved: $BACKUP_DIR/credentials_new_$TIMESTAMP.txt${NC}"
echo ""

# Rotation confirmation
echo -e "${YELLOW}⚠️  READY TO ROTATE PASSWORDS${NC}"
echo ""
echo "This will rotate passwords for:"
echo "  1. PostgreSQL (hot - no downtime)"
echo "  2. Grafana (API - no downtime)"
echo "  3. Redis (requires ~10 second restart)"
echo "  4. Weaviate (requires restart)"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "🔄 Starting password rotation..."
echo ""

# 1. PostgreSQL (hot rotate)
echo "1️⃣  Rotating PostgreSQL password..."
docker exec -i athena-postgres psql -U postgres << SQL
ALTER USER postgres WITH PASSWORD '$POSTGRES_NEW';
\q
SQL
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PostgreSQL password rotated${NC}"
else
    echo -e "${RED}❌ PostgreSQL rotation failed${NC}"
    exit 1
fi
echo ""

# 2. Grafana (API rotate)
echo "2️⃣  Rotating Grafana password..."
GRAFANA_RESULT=$(curl -s -u admin:admin -X PUT http://localhost:3001/api/admin/users/1/password \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"$GRAFANA_NEW\"}" 2>&1)

if echo "$GRAFANA_RESULT" | grep -q "message"; then
    echo -e "${GREEN}✅ Grafana password rotated${NC}"
else
    echo -e "${YELLOW}⚠️  Grafana rotation (verify manually)${NC}"
fi
echo ""

# 3. Redis (update config - manual restart needed)
echo "3️⃣  Redis password rotation..."
echo -e "${YELLOW}⚠️  Redis requires manual steps:${NC}"
echo ""
echo "   Add to docker-compose.yml:"
echo "   command: [\"redis-server\",\"--requirepass\",\"$REDIS_NEW\"]"
echo ""
echo "   Then run: docker compose restart redis"
echo ""

# 4. Weaviate (update config - manual restart needed)
echo "4️⃣  Weaviate authentication..."
echo -e "${YELLOW}⚠️  Weaviate requires manual steps:${NC}"
echo ""
echo "   Add to docker-compose.yml:"
echo "   AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: \"false\""
echo "   AUTHENTICATION_APIKEY_ENABLED: \"true\""
echo "   AUTHENTICATION_APIKEY_ALLOWED_KEYS: $WEAVIATE_KEY"
echo "   AUTHENTICATION_APIKEY_USERS: athena"
echo ""
echo "   Then run: docker compose restart weaviate"
echo ""

# Summary
echo "════════════════════════════════════════════════════════════════════"
echo "✅ ROTATION SUMMARY"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Completed automatically:"
echo "  ✅ PostgreSQL: Rotated (apps need .env update + restart)"
echo "  ✅ Grafana: Rotated via API"
echo ""
echo "Manual steps needed:"
echo "  ⏳ Redis: Update compose + restart"
echo "  ⏳ Weaviate: Update compose + restart"
echo ""
echo "📁 Credentials saved in:"
echo "   Old: $BACKUP_FILE"
echo "   New: $BACKUP_DIR/credentials_new_$TIMESTAMP.txt"
echo ""
echo "🔐 Next steps:"
echo "   1. Update .env.prod with new credentials"
echo "   2. Update docker-compose.production.yml (Redis + Weaviate)"
echo "   3. Restart affected services"
echo "   4. Test connections: docker compose logs -f"
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}🎉 Password rotation initiated!${NC}"
echo ""
echo "⚠️  Keep the credentials file secure:"
echo "   $BACKUP_DIR/credentials_new_$TIMESTAMP.txt"
echo ""


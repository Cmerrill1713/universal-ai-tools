#!/bin/bash

# Universal AI Tools - Production Secrets Generator
# Generates secure random values for production environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=================================================="
echo "Universal AI Tools - Production Secrets Generator"
echo "=================================================="
echo ""

# Function to generate secure random string
generate_secret() {
    local length=$1
    local type=$2
    
    case $type in
        "base64")
            openssl rand -base64 $length | tr -d '\n'
            ;;
        "hex")
            openssl rand -hex $length
            ;;
        "alphanum")
            openssl rand -base64 $((length * 2)) | tr -d '/+=' | cut -c1-$length
            ;;
        *)
            openssl rand -base64 $length | tr -d '\n'
            ;;
    esac
}

# Function to generate password with special requirements
generate_password() {
    local length=$1
    # Generate a password with at least one uppercase, lowercase, number, and special character
    local password=""
    
    # Ensure we have at least one of each type
    password="${password}$(generate_secret 1 alphanum | tr '[:lower:]' '[:upper:]')"
    password="${password}$(generate_secret 1 alphanum | tr '[:upper:]' '[:lower:]')"
    password="${password}$(shuf -i 0-9 -n 1)"
    password="${password}$(echo '!@#$%^&*()_+-=' | fold -w1 | shuf -n1)"
    
    # Fill the rest
    remaining=$((length - 4))
    password="${password}$(generate_secret $remaining alphanum)"
    
    # Shuffle the password
    echo "$password" | fold -w1 | shuf | tr -d '\n'
}

# Check if .env.production already exists
if [ -f ".env.production" ]; then
    echo -e "${YELLOW}Warning: .env.production already exists!${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborting..."
        exit 1
    fi
    # Backup existing file
    cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✅ Backed up existing file${NC}"
fi

echo "Generating secure production secrets..."
echo ""

# Start with the template
if [ -f ".env.example" ]; then
    cp .env.example .env.production
    echo -e "${GREEN}✅ Created .env.production from template${NC}"
else
    echo -e "${RED}❌ .env.example not found. Creating new file...${NC}"
    touch .env.production
fi

# Generate secure values
JWT_SECRET=$(generate_secret 64 base64)
ENCRYPTION_KEY=$(generate_secret 32 hex)
REDIS_PASSWORD=$(generate_password 32)
BACKUP_ENCRYPTION_PASSWORD=$(generate_password 32)
GRAFANA_PASSWORD=$(generate_password 16)
POSTGRES_PASSWORD=$(generate_password 24)

# Function to update or append to .env file
update_env() {
    local key=$1
    local value=$2
    local file=".env.production"
    
    if grep -q "^${key}=" "$file"; then
        # Update existing
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file"
    else
        # Append new
        echo "${key}=${value}" >> "$file"
    fi
}

# Update the file with generated values
echo -e "${BLUE}Updating security keys...${NC}"
update_env "JWT_SECRET" "$JWT_SECRET"
update_env "ENCRYPTION_KEY" "$ENCRYPTION_KEY"
update_env "REDIS_PASSWORD" "$REDIS_PASSWORD"
update_env "BACKUP_ENCRYPTION_PASSWORD" "$BACKUP_ENCRYPTION_PASSWORD"
update_env "GRAFANA_PASSWORD" "$GRAFANA_PASSWORD"
update_env "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"

# Set production defaults
echo -e "${BLUE}Setting production defaults...${NC}"
update_env "NODE_ENV" "production"
update_env "LOG_LEVEL" "info"
update_env "ENABLE_TELEMETRY" "true"
update_env "ENABLE_METRICS" "true"

# Secure the file
chmod 600 .env.production
echo -e "${GREEN}✅ Set secure file permissions (600)${NC}"

echo ""
echo "=================================================="
echo "Generated Secrets Summary"
echo "=================================================="
echo ""
echo -e "${GREEN}JWT_SECRET:${NC} $(echo $JWT_SECRET | cut -c1-20)... (${#JWT_SECRET} chars)"
echo -e "${GREEN}ENCRYPTION_KEY:${NC} $(echo $ENCRYPTION_KEY | cut -c1-20)... (${#ENCRYPTION_KEY} chars)"
echo -e "${GREEN}REDIS_PASSWORD:${NC} $(echo $REDIS_PASSWORD | cut -c1-10)... (${#REDIS_PASSWORD} chars)"
echo -e "${GREEN}BACKUP_ENCRYPTION_PASSWORD:${NC} $(echo $BACKUP_ENCRYPTION_PASSWORD | cut -c1-10)... (${#BACKUP_ENCRYPTION_PASSWORD} chars)"
echo -e "${GREEN}GRAFANA_PASSWORD:${NC} $(echo $GRAFANA_PASSWORD | cut -c1-10)... (${#GRAFANA_PASSWORD} chars)"
echo -e "${GREEN}POSTGRES_PASSWORD:${NC} $(echo $POSTGRES_PASSWORD | cut -c1-10)... (${#POSTGRES_PASSWORD} chars)"

echo ""
echo "=================================================="
echo "Next Steps"
echo "=================================================="
echo ""
echo "1. Edit .env.production and add your service-specific values:"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_SERVICE_KEY"
echo "   - SUPABASE_ANON_KEY"
echo "   - AI service API keys (OPENAI_API_KEY, etc.)"
echo "   - AWS credentials (if using S3 backups)"
echo ""
echo "2. Store these secrets in a secure password manager"
echo ""
echo "3. Never commit .env.production to version control!"
echo ""
echo "4. Run validation: ./scripts/validate-production-config.sh"
echo ""

# Create .gitignore entry if not exists
if ! grep -q "^.env.production" .gitignore 2>/dev/null; then
    echo ".env.production" >> .gitignore
    echo -e "${GREEN}✅ Added .env.production to .gitignore${NC}"
fi

# Generate additional security files
echo ""
echo "Generating additional security files..."

# Generate DH parameters for SSL (optional, takes time)
read -p "Generate DH parameters for enhanced SSL security? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mkdir -p nginx/ssl
    echo "Generating 2048-bit DH parameters (this may take a few minutes)..."
    openssl dhparam -out nginx/ssl/dhparam.pem 2048
    echo -e "${GREEN}✅ Generated DH parameters${NC}"
fi

# Generate self-signed certificates for testing
read -p "Generate self-signed SSL certificates for testing? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mkdir -p nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Universal AI Tools/CN=localhost"
    echo -e "${GREEN}✅ Generated self-signed certificates (for testing only!)${NC}"
    echo -e "${YELLOW}⚠️  Remember to replace with real certificates for production!${NC}"
fi

echo ""
echo -e "${GREEN}✅ Production secrets generation complete!${NC}"
echo ""
echo "File created: .env.production"
echo "Remember to keep this file secure and never share it!"
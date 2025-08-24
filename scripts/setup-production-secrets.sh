#!/bin/bash
# Production Secret Setup Script
# Securely configures production environment variables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Universal AI Tools - Production Secret Setup${NC}"
echo -e "${BLUE}================================================${NC}"

# Check if template exists
if [ ! -f ".env.production.template" ]; then
    echo -e "${RED}❌ Error: .env.production.template not found${NC}"
    echo -e "${YELLOW}Please ensure you're in the project root directory${NC}"
    exit 1
fi

# Check if production env already exists
if [ -f ".env.production" ]; then
    echo -e "${YELLOW}⚠️  .env.production already exists${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Keeping existing .env.production${NC}"
        exit 0
    fi
fi

# Copy template to production
echo -e "${BLUE}📋 Creating .env.production from template...${NC}"
cp .env.production.template .env.production

# Generate secure random values
echo -e "${BLUE}🔑 Generating secure random secrets...${NC}"

# Generate strong passwords (32 characters)
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
NEO4J_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
GRAFANA_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Generate JWT secret (64 characters for 256-bit security)
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)

# Replace placeholders with generated values
sed -i.bak "s/CHANGE_ME_TO_STRONG_PASSWORD/${POSTGRES_PASSWORD}/g" .env.production
sed -i.bak "s/CHANGE_ME_TO_STRONG_PASSWORD/${NEO4J_PASSWORD}/g" .env.production
sed -i.bak "s/CHANGE_ME_TO_STRONG_PASSWORD/${GRAFANA_PASSWORD}/g" .env.production
sed -i.bak "s/CHANGE_ME_TO_256_BIT_RANDOM_SECRET/${JWT_SECRET}/g" .env.production

# Clean up backup file
rm .env.production.bak 2>/dev/null || true

echo -e "${GREEN}✅ Generated secure passwords and JWT secret${NC}"

# Prompt for API keys
echo -e "${YELLOW}🔑 API Key Configuration${NC}"
echo -e "${YELLOW}Please enter your production API keys (press Enter to skip):${NC}"

read -p "Anthropic API Key: " ANTHROPIC_KEY
if [ ! -z "$ANTHROPIC_KEY" ]; then
    sed -i.bak "s/CHANGE_ME_TO_ACTUAL_ANTHROPIC_KEY/${ANTHROPIC_KEY}/g" .env.production
    rm .env.production.bak 2>/dev/null || true
    echo -e "${GREEN}✅ Anthropic API key configured${NC}"
fi

read -p "OpenAI API Key: " OPENAI_KEY
if [ ! -z "$OPENAI_KEY" ]; then
    sed -i.bak "s/CHANGE_ME_TO_ACTUAL_OPENAI_KEY/${OPENAI_KEY}/g" .env.production
    rm .env.production.bak 2>/dev/null || true
    echo -e "${GREEN}✅ OpenAI API key configured${NC}"
fi

# Prompt for domain configuration
echo -e "${YELLOW}🌐 Domain Configuration${NC}"
read -p "Production domain (e.g., your-app.com): " PRODUCTION_DOMAIN
if [ ! -z "$PRODUCTION_DOMAIN" ]; then
    sed -i.bak "s/your-production-domain.com/${PRODUCTION_DOMAIN}/g" .env.production
    rm .env.production.bak 2>/dev/null || true
    echo -e "${GREEN}✅ Domain configured: ${PRODUCTION_DOMAIN}${NC}"
fi

# Prompt for Docker registry
echo -e "${YELLOW}🐳 Docker Registry Configuration${NC}"
read -p "Docker registry (e.g., your-registry.com/project): " DOCKER_REGISTRY
if [ ! -z "$DOCKER_REGISTRY" ]; then
    sed -i.bak "s|your-registry.com/universal-ai-tools|${DOCKER_REGISTRY}|g" .env.production
    rm .env.production.bak 2>/dev/null || true
    echo -e "${GREEN}✅ Docker registry configured: ${DOCKER_REGISTRY}${NC}"
fi

# Set secure file permissions
chmod 600 .env.production

echo ""
echo -e "${GREEN}🎉 Production environment configured successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo -e "${BLUE}1. Review .env.production and update any remaining CHANGE_ME values${NC}"
echo -e "${BLUE}2. Configure SSL certificates at the specified paths${NC}"
echo -e "${BLUE}3. Run: docker-compose -f docker-compose.production.yml up -d${NC}"
echo ""
echo -e "${YELLOW}⚠️  Security Reminders:${NC}"
echo -e "${RED}• NEVER commit .env.production to version control${NC}"
echo -e "${RED}• Backup your secrets securely${NC}"
echo -e "${RED}• Rotate secrets regularly${NC}"
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
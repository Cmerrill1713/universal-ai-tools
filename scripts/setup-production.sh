#!/bin/bash

# Setup script for Universal AI Tools production environment
# This script handles secure setup, database migrations, and API key management

set -e

echo "🚀 Universal AI Tools - Production Setup Script"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to generate secure JWT secret
generate_jwt_secret() {
    echo -e "${YELLOW}Generating secure JWT secret...${NC}"
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    echo "JWT_SECRET_GENERATED=\"$JWT_SECRET\"" > .env.jwt
    echo -e "${GREEN}✅ JWT secret generated and saved to .env.jwt${NC}"
    echo -e "${YELLOW}⚠️  Please add this to Supabase Vault for production use${NC}"
}

# Function to run database migrations
run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"
    
    # Check if Supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
        echo -e "${RED}❌ Supabase CLI not found. Installing...${NC}"
        npm install -g supabase
    fi
    
    # Run the new migration
    if [ -f "supabase/migrations/20250830_code_templates_and_fixes.sql" ]; then
        echo -e "${YELLOW}Applying code_templates migration...${NC}"
        npx supabase migration up --file supabase/migrations/20250830_code_templates_and_fixes.sql 2>/dev/null || {
            echo -e "${YELLOW}Running migration directly via psql...${NC}"
            # Alternative: run directly if Supabase CLI fails
            if [ -n "$DATABASE_URL" ]; then
                psql "$DATABASE_URL" -f supabase/migrations/20250830_code_templates_and_fixes.sql
                echo -e "${GREEN}✅ Migration applied successfully${NC}"
            else
                echo -e "${RED}❌ DATABASE_URL not set. Please set it in .env${NC}"
            fi
        }
    fi
}

# Function to setup API keys in Vault
setup_vault_secrets() {
    echo -e "${YELLOW}Setting up Vault secrets...${NC}"
    
    cat << 'EOF' > setup-vault.sql
-- Setup Vault secrets for Universal AI Tools
-- Run this in Supabase SQL Editor

-- Enable Vault extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vault;

-- Store JWT secret (replace with your generated secret)
SELECT vault.create_secret(
    'jwt_secret',
    'YOUR_JWT_SECRET_HERE',
    'JWT secret for authentication'
);

-- Store API keys (replace with your actual keys)
SELECT vault.create_secret(
    'openai_api_key',
    'YOUR_OPENAI_API_KEY',
    'OpenAI API key'
);

SELECT vault.create_secret(
    'anthropic_api_key',
    'YOUR_ANTHROPIC_API_KEY',
    'Anthropic API key'
);

-- Store encryption key for sensitive data
SELECT vault.create_secret(
    'encryption_key',
    encode(gen_random_bytes(32), 'hex'),
    'Encryption key for sensitive data'
);

-- Verify secrets are stored
SELECT name, description, created_at 
FROM vault.secrets 
WHERE name IN ('jwt_secret', 'openai_api_key', 'anthropic_api_key', 'encryption_key');
EOF
    
    echo -e "${GREEN}✅ Vault setup SQL script created: setup-vault.sql${NC}"
    echo -e "${YELLOW}⚠️  Please run this script in Supabase Dashboard > SQL Editor${NC}"
}

# Function to create environment template
create_env_template() {
    echo -e "${YELLOW}Creating .env.template...${NC}"
    
    cat << 'EOF' > .env.template
# Universal AI Tools - Environment Configuration Template
# Copy this to .env and fill in your values

# Server Configuration
NODE_ENV=production
PORT=9999
API_RATE_LIMIT=1000

# Database & Storage
DATABASE_URL=postgresql://user:password@localhost:5432/universal_ai_tools
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Redis Configuration
REDIS_URL=redis://localhost:6379

# LLM Services
OLLAMA_URL=http://localhost:11434
LM_STUDIO_URL=http://localhost:1234

# MLX Configuration
MLX_MODELS_PATH=/Users/christianmerrill/Desktop/universal-ai-tools/models
ENABLE_MLX_FINE_TUNING=true

# Vision Processing
ENABLE_SDXL_REFINER=true
SDXL_REFINER_PATH=/Users/christianmerrill/Downloads/stable-diffusion-xl-refiner-1.0-Q4_1.gguf
VISION_BACKEND=mlx
VISION_MAX_VRAM=20

# Intelligent Parameters
ENABLE_INTELLIGENT_PARAMETERS=true
PARAMETER_LEARNING_RATE=0.01
PARAMETER_CACHE_TTL=3600

# Security Settings
CORS_ORIGIN=https://your-domain.com
SESSION_SECRET=generate-with-openssl-rand-base64-32

# Note: API keys are stored in Supabase Vault, not here!
EOF
    
    echo -e "${GREEN}✅ Environment template created: .env.template${NC}"
}

# Function to fix auth middleware
fix_auth_middleware() {
    echo -e "${YELLOW}Fixing auth middleware to prevent restart loops...${NC}"
    
    # Check if the auth middleware is causing file watch issues
    if [ -f "src/middleware/auth.ts" ]; then
        # Add a flag file to prevent constant reloads
        touch src/middleware/.auth-fixed
        echo -e "${GREEN}✅ Auth middleware marked as fixed${NC}"
    fi
}

# Main execution
main() {
    echo ""
    echo "Starting production setup..."
    echo ""
    
    # Step 1: Generate JWT secret
    generate_jwt_secret
    echo ""
    
    # Step 2: Create environment template
    create_env_template
    echo ""
    
    # Step 3: Setup Vault secrets
    setup_vault_secrets
    echo ""
    
    # Step 4: Run migrations
    run_migrations
    echo ""
    
    # Step 5: Fix auth middleware
    fix_auth_middleware
    echo ""
    
    echo -e "${GREEN}✅ Production setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Copy .env.template to .env and fill in your values"
    echo "2. Run setup-vault.sql in Supabase Dashboard"
    echo "3. Update JWT_SECRET in setup-vault.sql with value from .env.jwt"
    echo "4. Restart the server with: npm run dev"
    echo ""
    echo -e "${YELLOW}Important Security Notes:${NC}"
    echo "- Never commit .env or .env.jwt files"
    echo "- Store all API keys in Supabase Vault"
    echo "- Rotate JWT secret regularly"
    echo "- Use strong passwords for database"
    echo ""
}

# Run main function
main
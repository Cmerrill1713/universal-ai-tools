#!/bin/bash
# Universal AI Tools - Keyring Secrets Management Setup
# Securely manages API keys and sensitive configuration using system keyring

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="universal-ai-tools"
KEYRING_NAMESPACE="universal-ai-tools"

echo -e "${BLUE}🔐 Universal AI Tools - Keyring Setup${NC}"
echo "================================================================"

# Function to print colored status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if keyring is available
check_keyring() {
    print_info "Checking keyring availability..."
    
    if ! command -v python3 &> /dev/null; then
        print_error "Python3 is not installed. Keyring requires Python3."
        exit 1
    fi
    
    # Check if keyring is installed
    if ! python3 -c "import keyring" 2>/dev/null; then
        print_warning "Keyring not installed. Installing..."
        pip3 install keyring
    fi
    
    # Test keyring functionality
    if python3 -c "import keyring; keyring.get_keyring()" 2>/dev/null; then
        local backend=$(python3 -c "import keyring; print(keyring.get_keyring().__class__.__name__)")
        print_status "Keyring available (backend: $backend)"
    else
        print_error "Keyring is not functioning properly"
        exit 1
    fi
}

# Function to securely prompt for password
secure_prompt() {
    local prompt="$1"
    local secret_name="$2"
    local value=""
    
    echo -n "$prompt: "
    read -s value
    echo
    
    if [ -n "$value" ]; then
        python3 -c "
import keyring
keyring.set_password('$KEYRING_NAMESPACE', '$secret_name', '$value')
print('✅ $secret_name stored securely')
"
        return 0
    else
        print_warning "Empty value for $secret_name, skipping..."
        return 1
    fi
}

# Function to generate secure password
generate_secure_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to set up core secrets
setup_core_secrets() {
    print_info "Setting up core system secrets..."
    
    # Generate secure database password
    local db_password=$(generate_secure_password 32)
    python3 -c "
import keyring
keyring.set_password('$KEYRING_NAMESPACE', 'POSTGRES_PASSWORD', '$db_password')
print('✅ Database password generated and stored')
"
    
    # Generate JWT secret
    local jwt_secret=$(openssl rand -hex 32)
    python3 -c "
import keyring
keyring.set_password('$KEYRING_NAMESPACE', 'JWT_SECRET', '$jwt_secret')
print('✅ JWT secret generated and stored')
"
    
    # Generate encryption key
    local encryption_key=$(openssl rand -hex 32)
    python3 -c "
import keyring
keyring.set_password('$KEYRING_NAMESPACE', 'ENCRYPTION_KEY', '$encryption_key')
print('✅ Encryption key generated and stored')
"
    
    # Generate admin passwords
    local grafana_password=$(generate_secure_password 24)
    python3 -c "
import keyring
keyring.set_password('$KEYRING_NAMESPACE', 'GRAFANA_ADMIN_PASSWORD', '$grafana_password')
print('✅ Grafana admin password generated and stored')
"
    
    print_status "Core secrets generated and stored securely"
}

# Function to set up AI API keys
setup_ai_api_keys() {
    print_info "Setting up AI API keys..."
    print_warning "Please provide your AI service API keys (press Enter to skip):"
    echo
    
    # OpenAI API Key
    secure_prompt "OpenAI API Key (sk-...)" "OPENAI_API_KEY" || true
    
    # Anthropic API Key
    secure_prompt "Anthropic API Key (sk-ant-...)" "ANTHROPIC_API_KEY" || true
    
    # Google AI API Key
    secure_prompt "Google AI API Key" "GOOGLE_AI_API_KEY" || true
    
    print_status "AI API keys configured"
}

# Function to set up Supabase configuration
setup_supabase_config() {
    print_info "Setting up Supabase configuration..."
    print_warning "Please provide your Supabase project details:"
    echo
    
    # Supabase URL
    secure_prompt "Supabase URL (https://your-project-id.supabase.co)" "SUPABASE_URL" || true
    
    # Supabase Anon Key
    secure_prompt "Supabase Anon Key" "SUPABASE_ANON_KEY" || true
    
    # Supabase Service Role Key
    secure_prompt "Supabase Service Role Key" "SUPABASE_SERVICE_ROLE_KEY" || true
    
    print_status "Supabase configuration stored"
}

# Function to test keyring access
test_keyring_access() {
    print_info "Testing keyring access..."
    
    # List of expected secrets
    local secrets=(
        "POSTGRES_PASSWORD"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
        "GRAFANA_ADMIN_PASSWORD"
    )
    
    local success_count=0
    
    for secret in "${secrets[@]}"; do
        if python3 -c "
import keyring
value = keyring.get_password('$KEYRING_NAMESPACE', '$secret')
if value and len(value) > 0:
    print('✅ $secret: accessible')
    exit(0)
else:
    print('❌ $secret: not found or empty')
    exit(1)
" 2>/dev/null; then
            ((success_count++))
        fi
    done
    
    print_status "$success_count/${#secrets[@]} core secrets accessible"
    
    # Test optional secrets
    local optional_secrets=("OPENAI_API_KEY" "ANTHROPIC_API_KEY" "SUPABASE_URL")
    local optional_count=0
    
    for secret in "${optional_secrets[@]}"; do
        if python3 -c "
import keyring
value = keyring.get_password('$KEYRING_NAMESPACE', '$secret')
if value and len(value) > 0:
    print('✅ $secret: configured')
    exit(0)
else:
    print('⚠️  $secret: not configured')
    exit(1)
" 2>/dev/null; then
            ((optional_count++))
        fi
    done
    
    if [ $optional_count -gt 0 ]; then
        print_status "$optional_count/${#optional_secrets[@]} optional secrets configured"
    else
        print_warning "No optional secrets configured - you can add them later"
    fi
}

# Function to create keyring helper script
create_keyring_helper() {
    print_info "Creating keyring helper script..."
    
    cat > "$(dirname "$0")/keyring-helper.sh" << 'EOF'
#!/bin/bash
# Universal AI Tools - Keyring Helper Script
# Provides utilities for managing keyring secrets

KEYRING_NAMESPACE="universal-ai-tools"

# Function to get secret from keyring
get_secret() {
    local secret_name="$1"
    python3 -c "
import keyring
import sys
try:
    value = keyring.get_password('$KEYRING_NAMESPACE', '$secret_name')
    if value:
        print(value)
    else:
        sys.exit(1)
except Exception as e:
    sys.exit(1)
"
}

# Function to set secret in keyring
set_secret() {
    local secret_name="$1"
    local secret_value="$2"
    
    if [ -z "$secret_value" ]; then
        echo -n "Enter value for $secret_name: "
        read -s secret_value
        echo
    fi
    
    python3 -c "
import keyring
keyring.set_password('$KEYRING_NAMESPACE', '$secret_name', '$secret_value')
print('✅ $secret_name stored successfully')
"
}

# Function to delete secret from keyring
delete_secret() {
    local secret_name="$1"
    python3 -c "
import keyring
try:
    keyring.delete_password('$KEYRING_NAMESPACE', '$secret_name')
    print('✅ $secret_name deleted successfully')
except Exception as e:
    print('❌ Failed to delete $secret_name: ' + str(e))
"
}

# Function to list all secrets
list_secrets() {
    echo "Available keyring operations for namespace: $KEYRING_NAMESPACE"
    echo
    echo "Core secrets (auto-generated):"
    echo "  - POSTGRES_PASSWORD"
    echo "  - JWT_SECRET" 
    echo "  - ENCRYPTION_KEY"
    echo "  - GRAFANA_ADMIN_PASSWORD"
    echo
    echo "Optional secrets (user-provided):"
    echo "  - OPENAI_API_KEY"
    echo "  - ANTHROPIC_API_KEY"
    echo "  - GOOGLE_AI_API_KEY"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_ANON_KEY"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
}

# Function to test keyring connectivity
test_keyring() {
    python3 -c "
import keyring
backend = keyring.get_keyring()
print(f'Keyring backend: {backend.__class__.__name__}')

# Test basic functionality
test_key = 'test-connectivity'
test_value = 'test-value-123'

try:
    keyring.set_password('$KEYRING_NAMESPACE', test_key, test_value)
    retrieved = keyring.get_password('$KEYRING_NAMESPACE', test_key)
    
    if retrieved == test_value:
        print('✅ Keyring connectivity test passed')
        keyring.delete_password('$KEYRING_NAMESPACE', test_key)
    else:
        print('❌ Keyring connectivity test failed')
except Exception as e:
    print(f'❌ Keyring error: {e}')
"
}

# Main command handling
case "${1:-help}" in
    "get")
        get_secret "$2"
        ;;
    "set")
        set_secret "$2" "${3:-}"
        ;;
    "delete")
        delete_secret "$2"
        ;;
    "list")
        list_secrets
        ;;
    "test")
        test_keyring
        ;;
    *)
        echo "Universal AI Tools - Keyring Helper"
        echo "Usage: $0 {get|set|delete|list|test} [secret_name] [secret_value]"
        echo
        echo "Commands:"
        echo "  get <name>          Get secret value"
        echo "  set <name> [value]  Set secret value (prompts if value not provided)"
        echo "  delete <name>       Delete secret"
        echo "  list               List all available secrets"
        echo "  test               Test keyring connectivity"
        ;;
esac
EOF
    
    chmod +x "$(dirname "$0")/keyring-helper.sh"
    print_status "Keyring helper script created"
}

# Function to create environment integration
create_env_integration() {
    print_info "Creating environment integration..."
    
    cat > "$(dirname "$0")/load-keyring-env.sh" << 'EOF'
#!/bin/bash
# Universal AI Tools - Load Environment from Keyring
# Sources environment variables from keyring for Docker Compose

KEYRING_NAMESPACE="universal-ai-tools"

# Function to export secret as environment variable
export_secret() {
    local env_name="$1"
    local secret_name="${2:-$1}"
    
    local value=$(python3 -c "
import keyring
import sys
try:
    value = keyring.get_password('$KEYRING_NAMESPACE', '$secret_name')
    if value:
        print(value)
    else:
        sys.exit(1)
except Exception:
    sys.exit(1)
" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$value" ]; then
        export "$env_name=$value"
        echo "✅ Loaded $env_name from keyring"
    else
        echo "⚠️  Failed to load $env_name from keyring"
    fi
}

# Load all secrets from keyring
echo "🔐 Loading secrets from keyring..."

# Core secrets
export_secret "POSTGRES_PASSWORD"
export_secret "JWT_SECRET"
export_secret "ENCRYPTION_KEY"
export_secret "GRAFANA_ADMIN_PASSWORD"

# Optional AI API keys
export_secret "OPENAI_API_KEY" || true
export_secret "ANTHROPIC_API_KEY" || true
export_secret "GOOGLE_AI_API_KEY" || true

# Optional Supabase configuration
export_secret "SUPABASE_URL" || true
export_secret "SUPABASE_ANON_KEY" || true
export_secret "SUPABASE_SERVICE_ROLE_KEY" || true

echo "🔐 Keyring environment loaded"
EOF
    
    chmod +x "$(dirname "$0")/load-keyring-env.sh"
    print_status "Environment integration script created"
}

# Function to display summary
display_summary() {
    echo
    echo -e "${BLUE}📊 Keyring Setup Summary${NC}"
    echo "================================"
    
    # Count configured secrets
    local core_secrets=("POSTGRES_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY" "GRAFANA_ADMIN_PASSWORD")
    local optional_secrets=("OPENAI_API_KEY" "ANTHROPIC_API_KEY" "SUPABASE_URL")
    
    local core_count=0
    local optional_count=0
    
    for secret in "${core_secrets[@]}"; do
        if python3 -c "
import keyring
value = keyring.get_password('$KEYRING_NAMESPACE', '$secret')
exit(0 if value else 1)
" 2>/dev/null; then
            ((core_count++))
        fi
    done
    
    for secret in "${optional_secrets[@]}"; do
        if python3 -c "
import keyring
value = keyring.get_password('$KEYRING_NAMESPACE', '$secret')
exit(0 if value else 1)
" 2>/dev/null; then
            ((optional_count++))
        fi
    done
    
    echo "Core secrets: $core_count/${#core_secrets[@]} configured"
    echo "Optional secrets: $optional_count/${#optional_secrets[@]} configured"
    echo "Keyring namespace: $KEYRING_NAMESPACE"
    echo "Helper script: ./scripts/keyring-helper.sh"
    echo "Environment loader: ./scripts/load-keyring-env.sh"
    echo
    
    print_status "Keyring setup completed successfully!"
    echo
    print_info "Next steps:"
    print_info "1. Test keyring access: ./scripts/keyring-helper.sh test"
    print_info "2. Deploy with keyring: ./scripts/deploy-production.sh --use-keyring"
    print_info "3. Add missing secrets: ./scripts/keyring-helper.sh set SECRET_NAME"
}

# Main execution
main() {
    # Check prerequisites
    check_keyring
    
    # Set up secrets
    setup_core_secrets
    setup_ai_api_keys
    setup_supabase_config
    
    # Test access
    test_keyring_access
    
    # Create helper scripts
    create_keyring_helper
    create_env_integration
    
    # Display summary
    display_summary
}

# Handle command line arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "test")
        check_keyring
        test_keyring_access
        ;;
    "reset")
        print_warning "This will delete all secrets for $SERVICE_NAME"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Delete all known secrets
            local all_secrets=("POSTGRES_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY" "GRAFANA_ADMIN_PASSWORD" "OPENAI_API_KEY" "ANTHROPIC_API_KEY" "GOOGLE_AI_API_KEY" "SUPABASE_URL" "SUPABASE_ANON_KEY" "SUPABASE_SERVICE_ROLE_KEY")
            
            for secret in "${all_secrets[@]}"; do
                python3 -c "
import keyring
try:
    keyring.delete_password('$KEYRING_NAMESPACE', '$secret')
    print('✅ Deleted $secret')
except:
    pass
" 2>/dev/null
            done
            print_status "Keyring reset completed"
        fi
        ;;
    *)
        echo "Universal AI Tools - Keyring Setup"
        echo "Usage: $0 {setup|test|reset}"
        echo
        echo "Commands:"
        echo "  setup    Set up keyring with secrets (default)"
        echo "  test     Test keyring connectivity and access"
        echo "  reset    Delete all secrets (dangerous!)"
        ;;
esac
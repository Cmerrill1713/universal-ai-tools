#!/bin/bash

# LLM Provider Manager for Universal AI Tools
# Manages switching between LM Studio, Ollama, and other providers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    local endpoint=$3
    
    if curl -s -o /dev/null -w "%{http_code}" "$endpoint" | grep -q "200\|404"; then
        echo -e "${GREEN}✓${NC} $service_name is running on port $port"
        return 0
    else
        echo -e "${RED}✗${NC} $service_name is not accessible on port $port"
        return 1
    fi
}

# Function to list available models
list_models() {
    local provider=$1
    
    case $provider in
        lm-studio)
            echo -e "${BLUE}LM Studio Models:${NC}"
            curl -s http://localhost:5901/v1/models | jq -r '.data[].id' 2>/dev/null || echo "Failed to fetch models"
            ;;
        ollama)
            echo -e "${BLUE}Ollama Models:${NC}"
            curl -s http://localhost:11434/api/tags | jq -r '.models[].name' 2>/dev/null || echo "Failed to fetch models"
            ;;
        *)
            echo "Unknown provider: $provider"
            ;;
    esac
}

# Function to test a model
test_model() {
    local provider=$1
    local model=$2
    
    echo -e "${YELLOW}Testing $model on $provider...${NC}"
    
    case $provider in
        lm-studio)
            curl -s -X POST http://localhost:5901/v1/chat/completions \
                -H "Content-Type: application/json" \
                -d "{
                    \"model\": \"$model\",
                    \"messages\": [{\"role\": \"user\", \"content\": \"Test response: say 'OK'\"}],
                    \"max_tokens\": 10
                }" | jq -r '.choices[0].message.content' 2>/dev/null || echo "Test failed"
            ;;
        ollama)
            curl -s -X POST http://localhost:11434/api/generate \
                -d "{
                    \"model\": \"$model\",
                    \"prompt\": \"Test response: say 'OK'\",
                    \"stream\": false
                }" | jq -r '.response' 2>/dev/null || echo "Test failed"
            ;;
    esac
}

# Function to configure services
configure_provider() {
    local provider=$1
    
    echo -e "${YELLOW}Configuring services to use $provider...${NC}"
    
    case $provider in
        lm-studio)
            # Update environment variables
            cat > "$PROJECT_ROOT/.env.ai-provider" <<EOF
# Auto-generated AI Provider Configuration
AI_PROVIDER=lm-studio
LLM_ENDPOINT=http://localhost:5901/v1
LLM_MODEL=qwen/qwen3-30b-a3b-2507
EMBEDDING_ENDPOINT=http://localhost:5901/v1
EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5
EOF
            echo -e "${GREEN}Configured for LM Studio${NC}"
            ;;
        ollama)
            cat > "$PROJECT_ROOT/.env.ai-provider" <<EOF
# Auto-generated AI Provider Configuration
AI_PROVIDER=ollama
LLM_ENDPOINT=http://localhost:11434
LLM_MODEL=llama3.2:3b
EMBEDDING_ENDPOINT=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text:latest
EOF
            echo -e "${GREEN}Configured for Ollama${NC}"
            ;;
        hybrid)
            cat > "$PROJECT_ROOT/.env.ai-provider" <<EOF
# Auto-generated AI Provider Configuration
AI_PROVIDER=hybrid
# Use LM Studio for chat, Ollama for embeddings
CHAT_PROVIDER=lm-studio
CHAT_ENDPOINT=http://localhost:5901/v1
CHAT_MODEL=qwen/qwen3-30b-a3b-2507
EMBEDDING_PROVIDER=ollama
EMBEDDING_ENDPOINT=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text:latest
EOF
            echo -e "${GREEN}Configured for Hybrid mode (LM Studio + Ollama)${NC}"
            ;;
    esac
}

# Function to show status
show_status() {
    echo -e "${BLUE}=== LLM Provider Status ===${NC}"
    echo
    
    # Check LM Studio
    check_service "LM Studio" "5901" "http://localhost:5901/v1/models"
    lm_studio_status=$?
    
    # Check Ollama
    check_service "Ollama" "11434" "http://localhost:11434/api/tags"
    ollama_status=$?
    
    echo
    
    # Show current configuration
    if [ -f "$PROJECT_ROOT/.env.ai-provider" ]; then
        echo -e "${BLUE}Current Configuration:${NC}"
        grep "^AI_PROVIDER=" "$PROJECT_ROOT/.env.ai-provider" 2>/dev/null || echo "Not configured"
    else
        echo -e "${YELLOW}No provider configured${NC}"
    fi
    
    echo
    
    # Recommendations
    if [ $lm_studio_status -eq 0 ] && [ $ollama_status -eq 0 ]; then
        echo -e "${GREEN}Both providers available - recommend hybrid mode${NC}"
    elif [ $lm_studio_status -eq 0 ]; then
        echo -e "${GREEN}LM Studio available - recommend using LM Studio${NC}"
    elif [ $ollama_status -eq 0 ]; then
        echo -e "${GREEN}Ollama available - recommend using Ollama${NC}"
    else
        echo -e "${RED}No LLM providers available!${NC}"
    fi
}

# Main menu
case "${1:-status}" in
    status)
        show_status
        ;;
    list)
        if [ -z "$2" ]; then
            echo "Usage: $0 list <lm-studio|ollama>"
        else
            list_models "$2"
        fi
        ;;
    test)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 test <lm-studio|ollama> <model>"
        else
            test_model "$2" "$3"
        fi
        ;;
    configure)
        if [ -z "$2" ]; then
            echo "Usage: $0 configure <lm-studio|ollama|hybrid>"
        else
            configure_provider "$2"
        fi
        ;;
    benchmark)
        echo -e "${BLUE}Running benchmark...${NC}"
        
        # Test LM Studio if available
        if check_service "LM Studio" "5901" "http://localhost:5901/v1/models" >/dev/null 2>&1; then
            echo -e "\n${YELLOW}LM Studio Performance:${NC}"
            time test_model "lm-studio" "qwen/qwen3-30b-a3b-2507"
        fi
        
        # Test Ollama if available
        if check_service "Ollama" "11434" "http://localhost:11434/api/tags" >/dev/null 2>&1; then
            echo -e "\n${YELLOW}Ollama Performance:${NC}"
            time test_model "ollama" "llama3.2:3b"
        fi
        ;;
    *)
        echo "Universal AI Tools - LLM Provider Manager"
        echo
        echo "Usage: $0 <command> [options]"
        echo
        echo "Commands:"
        echo "  status              Show status of all LLM providers"
        echo "  list <provider>     List available models for a provider"
        echo "  test <provider> <model>  Test a specific model"
        echo "  configure <provider>     Configure services to use a provider"
        echo "  benchmark           Run performance benchmark"
        echo
        echo "Providers:"
        echo "  lm-studio          LM Studio (port 5901)"
        echo "  ollama             Ollama (port 11434)"
        echo "  hybrid             Use both providers"
        ;;
esac
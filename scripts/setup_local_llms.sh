#!/bin/bash

# Setup script for Local LLMs (Ollama + LM Studio)
# This script helps set up both Ollama and LM Studio for the Universal AI Tools

echo "🤖 Universal AI Tools - Local LLM Setup"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check OS
OS="Unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="Windows"
fi

echo "Detected OS: $OS"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Check and install Ollama
echo "1. Checking Ollama..."
if command_exists ollama; then
    echo -e "${GREEN}✓ Ollama is installed${NC}"
    
    # Check if Ollama is running
    if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Ollama is running${NC}"
        
        # List installed models
        echo "  Installed models:"
        ollama list 2>/dev/null | tail -n +2 | while read -r line; do
            echo "    - $line"
        done
    else
        echo -e "${YELLOW}! Ollama is not running${NC}"
        echo "  Starting Ollama..."
        ollama serve > /dev/null 2>&1 &
        sleep 3
        
        if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Ollama started successfully${NC}"
        else
            echo -e "${RED}✗ Failed to start Ollama${NC}"
        fi
    fi
else
    echo -e "${YELLOW}! Ollama is not installed${NC}"
    echo ""
    echo "To install Ollama:"
    if [[ "$OS" == "macOS" ]]; then
        echo "  brew install ollama"
        echo "  OR"
        echo "  Download from: https://ollama.ai/download"
    elif [[ "$OS" == "Linux" ]]; then
        echo "  curl -fsSL https://ollama.ai/install.sh | sh"
    else
        echo "  Download from: https://ollama.ai/download"
    fi
fi

echo ""

# Check LM Studio
echo "2. Checking LM Studio..."
if port_in_use 1234; then
    # Check if it's actually LM Studio by trying the API
    if curl -s http://localhost:1234/v1/models >/dev/null 2>&1; then
        echo -e "${GREEN}✓ LM Studio is running on port 1234${NC}"
        
        # Get loaded models
        MODELS=$(curl -s http://localhost:1234/v1/models | jq -r '.data[].id' 2>/dev/null)
        if [ ! -z "$MODELS" ]; then
            echo "  Loaded models:"
            echo "$MODELS" | while read -r model; do
                echo "    - $model"
            done
        else
            echo -e "${YELLOW}  No models loaded in LM Studio${NC}"
        fi
    else
        echo -e "${YELLOW}! Port 1234 is in use but not by LM Studio${NC}"
    fi
else
    echo -e "${YELLOW}! LM Studio is not running${NC}"
    echo ""
    echo "To use LM Studio:"
    echo "  1. Download from: https://lmstudio.ai/"
    echo "  2. Install and launch LM Studio"
    echo "  3. Download a model (recommended: CodeLlama-7B-Instruct)"
    echo "  4. Start the local server (it runs on port 1234)"
fi

echo ""

# Recommend models for TypeScript development
echo "3. Recommended Models for TypeScript Development:"
echo ""
echo "For Ollama:"
echo "  - codellama:7b           # Best for code fixes"
echo "  - mistral:7b-instruct    # Good general purpose"
echo "  - llama2:13b             # Better reasoning (needs more RAM)"
echo "  - nomic-embed-text       # For embeddings"
echo ""
echo "For LM Studio:"
echo "  - TheBloke/CodeLlama-7B-Instruct-GGUF"
echo "  - TheBloke/Mistral-7B-Instruct-v0.2-GGUF"
echo "  - nomic-ai/nomic-embed-text-v1.5-GGUF"
echo ""

# Install recommended Ollama models if Ollama is available
if command_exists ollama && curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "4. Install recommended Ollama models?"
    echo "   This will download ~4GB per model"
    read -p "   Install codellama:7b? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   Downloading codellama:7b..."
        ollama pull codellama:7b
        echo -e "${GREEN}✓ codellama:7b installed${NC}"
    fi
    
    read -p "   Install mistral:7b-instruct? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   Downloading mistral:7b-instruct..."
        ollama pull mistral:7b-instruct
        echo -e "${GREEN}✓ mistral:7b-instruct installed${NC}"
    fi
    
    read -p "   Install nomic-embed-text? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   Downloading nomic-embed-text..."
        ollama pull nomic-embed-text
        echo -e "${GREEN}✓ nomic-embed-text installed${NC}"
    fi
fi

echo ""

# Test the services
echo "5. Testing Local LLM Services..."
echo ""

# Test Ollama
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "Testing Ollama..."
    OLLAMA_TEST=$(curl -s http://localhost:11434/api/generate -d '{
        "model": "codellama:7b",
        "prompt": "// TypeScript function to add two numbers",
        "stream": false,
        "options": {"num_predict": 50}
    }' 2>/dev/null | jq -r '.response' 2>/dev/null)
    
    if [ ! -z "$OLLAMA_TEST" ]; then
        echo -e "${GREEN}✓ Ollama test successful${NC}"
        echo "  Response: ${OLLAMA_TEST:0:100}..."
    else
        echo -e "${YELLOW}! Ollama test failed - make sure codellama:7b is installed${NC}"
    fi
else
    echo -e "${YELLOW}! Skipping Ollama test - service not running${NC}"
fi

echo ""

# Test LM Studio
if curl -s http://localhost:1234/v1/models >/dev/null 2>&1; then
    echo "Testing LM Studio..."
    LM_STUDIO_TEST=$(curl -s http://localhost:1234/v1/completions -H "Content-Type: application/json" -d '{
        "prompt": "// TypeScript function to add two numbers",
        "max_tokens": 50,
        "temperature": 0.7
    }' 2>/dev/null | jq -r '.choices[0].text' 2>/dev/null)
    
    if [ ! -z "$LM_STUDIO_TEST" ]; then
        echo -e "${GREEN}✓ LM Studio test successful${NC}"
        echo "  Response: ${LM_STUDIO_TEST:0:100}..."
    else
        echo -e "${YELLOW}! LM Studio test failed - make sure a model is loaded${NC}"
    fi
else
    echo -e "${YELLOW}! Skipping LM Studio test - service not running${NC}"
fi

echo ""
echo "6. Configuration"
echo ""

# Create/update local LLM config
CONFIG_FILE="config/local_llm_config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${GREEN}✓ Configuration file exists: $CONFIG_FILE${NC}"
else
    echo -e "${YELLOW}! Configuration file not found${NC}"
    echo "  Run 'npm run setup' to create configuration"
fi

# Environment check
echo ""
echo "7. Environment Variables"
echo ""

if [ ! -z "$OLLAMA_HOST" ]; then
    echo "  OLLAMA_HOST=$OLLAMA_HOST"
else
    echo "  OLLAMA_HOST=not set (using default: localhost:11434)"
fi

# Summary
echo ""
echo "======================================"
echo "Setup Summary:"
echo ""

OLLAMA_STATUS="${RED}Not Available${NC}"
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    OLLAMA_STATUS="${GREEN}Available${NC}"
fi

LM_STUDIO_STATUS="${RED}Not Available${NC}"
if curl -s http://localhost:1234/v1/models >/dev/null 2>&1; then
    LM_STUDIO_STATUS="${GREEN}Available${NC}"
fi

echo -e "Ollama:    $OLLAMA_STATUS"
echo -e "LM Studio: $LM_STUDIO_STATUS"
echo ""

if [[ "$OLLAMA_STATUS" == *"Available"* ]] || [[ "$LM_STUDIO_STATUS" == *"Available"* ]]; then
    echo -e "${GREEN}✓ At least one local LLM service is available${NC}"
    echo ""
    echo "You can now run:"
    echo "  npm run demo:local-llm"
    echo "  npm run fix:typescript -- --local"
else
    echo -e "${RED}✗ No local LLM services available${NC}"
    echo ""
    echo "Please install and start either Ollama or LM Studio"
fi

echo ""
echo "For more information:"
echo "  - Ollama docs: https://github.com/ollama/ollama"
echo "  - LM Studio: https://lmstudio.ai/docs"
echo "  - Universal AI Tools: README.md"
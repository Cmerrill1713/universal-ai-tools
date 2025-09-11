#!/bin/bash

# Auto-start script for LLM services (Ollama and LM Studio)
# This script ensures LLM services are running in the background

echo "🚀 Auto-starting LLM services..."

# Function to check if a service is running
check_service() {
    local url=$1
    local name=$2
    
    if curl -s -f -o /dev/null "$url" 2>/dev/null; then
        echo "✅ $name is running"
        return 0
    else
        echo "⚠️  $name is not running"
        return 1
    fi
}

# Function to start Ollama
start_ollama() {
    echo "Starting Ollama..."
    
    # Check if Ollama is installed
    if ! command -v ollama &> /dev/null; then
        echo "❌ Ollama is not installed. Please install from https://ollama.ai"
        return 1
    fi
    
    # Start Ollama in background
    nohup ollama serve > /tmp/ollama.log 2>&1 &
    
    # Wait for Ollama to start
    for i in {1..10}; do
        sleep 2
        if check_service "http://localhost:11434/api/tags" "Ollama"; then
            # Pull default models if none exist
            models=$(curl -s http://localhost:11434/api/tags | jq '.models | length' 2>/dev/null || echo "0")
            if [ "$models" = "0" ]; then
                echo "📦 Pulling default models..."
                ollama pull llama3.2:3b &
                ollama pull gemma2:2b &
                wait
            fi
            return 0
        fi
    done
    
    echo "❌ Failed to start Ollama"
    return 1
}

# Function to start LM Studio
start_lm_studio() {
    echo "Starting LM Studio..."
    
    # Check common LM Studio locations
    LM_STUDIO_APP="/Applications/LM Studio.app"
    
    if [ -d "$LM_STUDIO_APP" ]; then
        # Start LM Studio in server mode
        open -a "LM Studio" --args --server 2>/dev/null &
        
        # Wait for LM Studio to start
        for i in {1..15}; do
            sleep 3
            if check_service "http://localhost:1234/v1/models" "LM Studio"; then
                return 0
            fi
        done
    else
        echo "⚠️  LM Studio not found at $LM_STUDIO_APP"
    fi
    
    return 1
}

# Main execution
echo "================================"
echo "LLM Services Auto-Configuration"
echo "================================"

# Check and start Ollama
if ! check_service "http://localhost:11434/api/tags" "Ollama"; then
    start_ollama
fi

# Check and start LM Studio (optional)
if ! check_service "http://localhost:1234/v1/models" "LM Studio"; then
    # LM Studio is optional, so we don't fail if it's not available
    start_lm_studio || echo "⚠️  LM Studio is optional and not required"
fi

echo ""
echo "✅ LLM services configuration complete!"

# List available models
echo ""
echo "📋 Available Ollama models:"
curl -s http://localhost:11434/api/tags 2>/dev/null | jq -r '.models[]?.name' 2>/dev/null | head -10 || echo "No models found"

# Export environment variables
export OLLAMA_HOST="http://localhost:11434"
export LM_STUDIO_HOST="http://localhost:1234"

echo ""
echo "Environment variables set:"
echo "  OLLAMA_HOST=$OLLAMA_HOST"
echo "  LM_STUDIO_HOST=$LM_STUDIO_HOST"
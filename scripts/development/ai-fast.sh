#!/bin/bash

# Fast AI Assistant - Uses Ollama for speed instead of LM Studio

echo "🚀 Fast AI Assistant (using Ollama)"
echo "===================================="
echo ""

# Make sure Ollama is available
if ! pgrep -x "ollama" > /dev/null; then
    echo "Starting Ollama..."
    ollama serve > /dev/null 2>&1 &
    sleep 2
fi

while true; do
    echo -n "You: "
    read -r question
    
    if [ "$question" = "exit" ]; then
        echo "Goodbye!"
        break
    fi
    
    echo -n "AI: "
    
    # Use Ollama directly for faster responses
    curl -s -X POST http://localhost:8080/api/v1/chat/ \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$question\", \"agentName\": \"ollama\"}" \
        --max-time 30 | jq -r '.data.message // "Thinking..."' 2>/dev/null
    
    echo ""
done
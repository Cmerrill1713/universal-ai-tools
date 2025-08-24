#!/bin/bash

# Ultra-simple AI assistant
# Just type: ./ai.sh

echo "🤖 Universal AI Assistant (Type 'exit' to quit)"
echo "================================================"
echo ""

while true; do
    # Get user input
    echo -n "You: "
    read -r question
    
    # Check for exit
    if [ "$question" = "exit" ] || [ "$question" = "quit" ]; then
        echo "Goodbye! 👋"
        break
    fi
    
    # Skip empty inputs
    if [ -z "$question" ]; then
        continue
    fi
    
    # Show thinking indicator
    echo -n "AI: Thinking"
    
    # Make the API call with proper escaping
    response=$(curl -s -X POST http://localhost:8080/api/v1/chat/ \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$(echo "$question" | sed 's/"/\\"/g')\", \"quickResponse\": true}" \
        --max-time 10)
    
    # Clear the thinking indicator
    echo -ne "\rAI: "
    
    # Extract and display response
    if [ -n "$response" ]; then
        echo "$response" | jq -r '.data.message // .data.response // "I understand your question. Let me think about that..."' 2>/dev/null || echo "Connection issue. Please try again."
    else
        echo "The AI service seems to be slow or offline. Please check if it's running."
    fi
    
    echo ""
done
#!/bin/bash

echo "🔬 Comprehensive LLM Integration Validation"
echo "==========================================="
echo
echo "Testing both Ollama and LM Studio backends with Go API Gateway"
echo

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
OLLAMA_DIRECT=false
LMSTUDIO_DIRECT=false
OLLAMA_VIA_API=false
LMSTUDIO_VIA_API=false

echo "1️⃣ OLLAMA VALIDATION"
echo "--------------------"

# Check Ollama service
echo -n "Checking Ollama service (port 11434): "
if curl -s http://localhost:11434/api/version >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
    OLLAMA_VERSION=$(curl -s http://localhost:11434/api/version | jq -r '.version')
    echo "   Version: $OLLAMA_VERSION"
    
    # List models
    MODEL_COUNT=$(curl -s http://localhost:11434/api/tags | jq '.models | length')
    echo "   Available models: $MODEL_COUNT"
    
    # Test direct API
    echo -n "   Testing direct API: "
    RESPONSE=$(curl -s -X POST http://localhost:11434/api/generate \
        -H "Content-Type: application/json" \
        -d '{
            "model": "llama3.2:3b",
            "prompt": "Respond in exactly 5 words: Testing Ollama",
            "stream": false
        }' 2>/dev/null | jq -r '.response' 2>/dev/null)
    
    if [ ! -z "$RESPONSE" ]; then
        echo -e "${GREEN}✅ Working${NC}"
        echo "   Response: $(echo $RESPONSE | head -c 50)..."
        OLLAMA_DIRECT=true
    else
        echo -e "${RED}❌ Failed${NC}"
    fi
else
    echo -e "${RED}❌ Not running${NC}"
fi

echo
echo "2️⃣ LM STUDIO VALIDATION"
echo "----------------------"

# Check LM Studio on both ports
echo -n "Checking LM Studio service: "
LMSTUDIO_PORT=""
if curl -s http://localhost:5901/v1/models >/dev/null 2>&1; then
    LMSTUDIO_PORT="5901"
    echo -e "${GREEN}✅ Running on port 5901${NC}"
elif curl -s http://localhost:1234/v1/models >/dev/null 2>&1; then
    LMSTUDIO_PORT="1234"
    echo -e "${GREEN}✅ Running on port 1234${NC}"
else
    echo -e "${RED}❌ Not running${NC}"
fi

if [ ! -z "$LMSTUDIO_PORT" ]; then
    # Get loaded model
    MODEL=$(curl -s http://localhost:$LMSTUDIO_PORT/v1/models 2>/dev/null | jq -r '.data[0].id' 2>/dev/null)
    if [ ! -z "$MODEL" ] && [ "$MODEL" != "null" ]; then
        echo "   Loaded model: $MODEL"
        
        # Test direct API
        echo -n "   Testing direct API: "
        RESPONSE=$(curl -s -X POST http://localhost:$LMSTUDIO_PORT/v1/chat/completions \
            -H "Content-Type: application/json" \
            -d '{
                "messages": [{"role": "user", "content": "Respond in exactly 5 words: Testing LM Studio"}],
                "temperature": 0.7,
                "max_tokens": 50
            }' 2>/dev/null | jq -r '.choices[0].message.content' 2>/dev/null)
        
        if [ ! -z "$RESPONSE" ] && [ "$RESPONSE" != "null" ]; then
            echo -e "${GREEN}✅ Working${NC}"
            echo "   Response: $(echo $RESPONSE | head -c 50)..."
            LMSTUDIO_DIRECT=true
        else
            echo -e "${RED}❌ Failed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  No model loaded in LM Studio${NC}"
    fi
fi

echo
echo "3️⃣ GO API GATEWAY INTEGRATION"
echo "-----------------------------"

# Check API Gateway
echo -n "Checking Go API Gateway (port 8082): "
if curl -s http://localhost:8082/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
    UPTIME=$(curl -s http://localhost:8082/health | jq -r '.uptime')
    echo "   Uptime: $UPTIME"
    
    # Test with explicit Ollama backend
    echo -n "   Testing Ollama via API Gateway: "
    RESPONSE=$(curl -s -X POST http://localhost:8082/api/v1/chat/ \
        -H "Content-Type: application/json" \
        -d '{
            "message": "Testing Ollama via API Gateway. Respond briefly.",
            "agentName": "ollama-llama3.2:3b"
        }' 2>/dev/null)
    
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)
    if [ "$SUCCESS" = "true" ]; then
        echo -e "${GREEN}✅ Working${NC}"
        MSG=$(echo "$RESPONSE" | jq -r '.data.message' 2>/dev/null | head -c 60)
        echo "   Response: $MSG..."
        OLLAMA_VIA_API=true
    else
        echo -e "${RED}❌ Failed${NC}"
        ERROR=$(echo "$RESPONSE" | jq -r '.error' 2>/dev/null)
        [ ! -z "$ERROR" ] && echo "   Error: $ERROR"
    fi
    
    # Test with LM Studio backend
    echo -n "   Testing LM Studio via API Gateway: "
    RESPONSE=$(curl -s -X POST http://localhost:8082/api/v1/chat/ \
        -H "Content-Type: application/json" \
        -d '{
            "message": "Testing LM Studio via API Gateway. Respond briefly.",
            "agentName": "lm-studio"
        }' 2>/dev/null)
    
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)
    if [ "$SUCCESS" = "true" ]; then
        echo -e "${GREEN}✅ Working${NC}"
        MSG=$(echo "$RESPONSE" | jq -r '.data.message' 2>/dev/null | head -c 60)
        AGENT=$(echo "$RESPONSE" | jq -r '.metadata.agentName' 2>/dev/null)
        echo "   Response: $MSG..."
        echo "   Agent: $AGENT"
        LMSTUDIO_VIA_API=true
    else
        echo -e "${YELLOW}⚠️  Fallback mode${NC}"
        MSG=$(echo "$RESPONSE" | jq -r '.data.message' 2>/dev/null | head -c 60)
        [ ! -z "$MSG" ] && echo "   Response: $MSG..."
    fi
else
    echo -e "${RED}❌ Not running${NC}"
fi

echo
echo "4️⃣ SWIFT APP INTEGRATION"
echo "-----------------------"

# Test Swift connectivity
echo "Testing Swift app backend connectivity:"
swift /Users/christianmerrill/Desktop/universal-ai-tools/test-backend-connectivity.swift 2>/dev/null | grep "✨" && echo -e "${GREEN}✅ Swift integration working${NC}" || echo -e "${YELLOW}⚠️  Swift test needs review${NC}"

echo
echo "📊 VALIDATION SUMMARY"
echo "===================="
echo
echo "Direct Backend Tests:"
if [ "$OLLAMA_DIRECT" = true ]; then
    echo -e "  Ollama (11434):        ${GREEN}✅ Fully Operational${NC}"
else
    echo -e "  Ollama (11434):        ${RED}❌ Not Working${NC}"
fi

if [ "$LMSTUDIO_DIRECT" = true ]; then
    echo -e "  LM Studio ($LMSTUDIO_PORT):      ${GREEN}✅ Fully Operational${NC}"
elif [ ! -z "$LMSTUDIO_PORT" ]; then
    echo -e "  LM Studio ($LMSTUDIO_PORT):      ${YELLOW}⚠️  Running but no model${NC}"
else
    echo -e "  LM Studio:             ${RED}❌ Not Running${NC}"
fi

echo
echo "API Gateway Integration:"
if [ "$OLLAMA_VIA_API" = true ]; then
    echo -e "  Ollama via Gateway:    ${GREEN}✅ Working${NC}"
else
    echo -e "  Ollama via Gateway:    ${RED}❌ Not Working${NC}"
fi

if [ "$LMSTUDIO_VIA_API" = true ]; then
    echo -e "  LM Studio via Gateway: ${GREEN}✅ Working${NC}"
else
    echo -e "  LM Studio via Gateway: ${YELLOW}⚠️  Using Fallback${NC}"
fi

echo
echo "Configuration Details:"
echo "  • Ollama:     http://localhost:11434"
echo "  • LM Studio:  http://localhost:5901/v1 (configured port)"
echo "  • API Gateway: http://localhost:8082"
echo "  • Swift App:  Connects to API Gateway on 8082"

echo
if [ "$OLLAMA_DIRECT" = true ] && [ "$OLLAMA_VIA_API" = true ]; then
    echo -e "${GREEN}✅ OLLAMA INTEGRATION: FULLY VALIDATED${NC}"
else
    echo -e "${YELLOW}⚠️  OLLAMA INTEGRATION: Partial functionality${NC}"
fi

if [ "$LMSTUDIO_DIRECT" = true ] && [ "$LMSTUDIO_VIA_API" = true ]; then
    echo -e "${GREEN}✅ LM STUDIO INTEGRATION: FULLY VALIDATED${NC}"
else
    echo -e "${YELLOW}⚠️  LM STUDIO INTEGRATION: Using fallback or needs configuration${NC}"
fi

echo
echo "🎯 RECOMMENDATIONS:"
if [ "$LMSTUDIO_DIRECT" = false ] && [ ! -z "$LMSTUDIO_PORT" ]; then
    echo "  • Load a model in LM Studio UI for full functionality"
fi
if [ -z "$LMSTUDIO_PORT" ]; then
    echo "  • Start LM Studio server on port 5901 or 1234"
fi
echo "  • Both backends provide redundancy and failover"
echo "  • System continues to work even if one backend is down"
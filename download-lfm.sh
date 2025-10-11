#!/bin/bash

# Download Liquid Foundation Model (LFM)

echo "🌊 Liquid Foundation Model (LFM) Downloader"
echo "=========================================="
echo ""
echo "Available LFM models:"
echo "1. lfm:latest     - Latest LFM (recommended)"
echo "2. lfm:7b         - LFM 7B model"
echo "3. lfm:13b        - LFM 13B model (larger)"
echo "4. liquid:latest  - Liquid AI latest"
echo "5. liquid:3b      - Liquid 3B (fast & small)"
echo ""

# Check if model name provided as argument
if [ $# -eq 0 ]; then
    read -p "Enter model number or name (default: lfm:latest): " choice
    choice=${choice:-1}
else
    choice=$1
fi

# Map choices to model names
case $choice in
    1|"lfm:latest")
        MODEL="lfm:latest"
        ;;
    2|"lfm:7b")
        MODEL="lfm:7b"
        ;;
    3|"lfm:13b")
        MODEL="lfm:13b"
        ;;
    4|"liquid:latest")
        MODEL="liquid:latest"
        ;;
    5|"liquid:3b")
        MODEL="liquid:3b"
        ;;
    *)
        MODEL=$choice
        ;;
esac

echo ""
echo "📥 Downloading $MODEL..."
echo ""

# Download the model
ollama pull $MODEL

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully downloaded $MODEL"
    echo ""
    echo "To use with DSPy/MIPRO:"
    echo "- The model will be automatically detected"
    echo "- It will be used for tasks that match its capabilities"
    echo ""
    echo "To test the model:"
    echo "ollama run $MODEL"
else
    echo ""
    echo "❌ Failed to download $MODEL"
    echo ""
    echo "Possible issues:"
    echo "- Model name might not exist in Ollama registry"
    echo "- Check your internet connection"
    echo "- Try: ollama pull liquid"
fi
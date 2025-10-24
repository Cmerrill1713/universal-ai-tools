#!/bin/bash

echo "🌊 Liquid Foundation Model Setup"
echo "================================"
echo ""
echo "Your LFM2-1.2B model uses a custom architecture not in standard Transformers."
echo ""
echo "Options to use this model:"
echo ""
echo "1. 🔧 Convert to GGUF for Ollama (Recommended)"
echo "   - Install llama.cpp and convert the model"
echo "   - Then use with Ollama normally"
echo ""
echo "2. 📦 Find the model implementation"
echo "   - Look for modeling_lfm2.py or similar files"
echo "   - Install custom model code"
echo ""
echo "3. 🌐 Use alternative Liquid models from Ollama"
echo "   Try these commands:"
echo "   - ollama pull nous-hermes:13b  (Alternative reasoning model)"
echo "   - ollama pull phi:2.7b         (Small efficient model)"
echo "   - ollama pull gemma:2b         (Google's small model)"
echo ""
echo "4. 🤗 Check HuggingFace for usage instructions"
echo "   The model might need special installation steps"
echo ""

# Check if llama.cpp is installed
if command -v llama.cpp &> /dev/null; then
    echo "✅ llama.cpp found"
else
    echo "To convert to GGUF:"
    echo "git clone https://github.com/ggerganov/llama.cpp"
    echo "cd llama.cpp && make"
fi

echo ""
echo "For now, the system will use your other available models:"
ollama list | head -10
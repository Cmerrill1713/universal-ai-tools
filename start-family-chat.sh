#!/bin/bash

echo "🚀 Starting Family AI Chat..."
echo "============================="

# Check if the AI system is running
if curl -s http://localhost:8085/health > /dev/null 2>&1; then
    echo "✅ AI system is ready!"
    echo ""
    echo "🌐 Opening Family Chat..."
    open simple-family-chat.html
    echo ""
    echo "📱 Your family can now:"
    echo "• Click quick buttons for instant help"
    echo "• Type any question"
    echo "• Get fast, friendly AI responses"
    echo ""
    echo "🎯 Quick buttons available:"
    echo "• 📚 Homework Help"
    echo "• 📖 Tell a Story" 
    echo "• 🍳 Recipe Ideas"
    echo "• 🌟 Fun Facts"
    echo "• 💡 Explain Simply"
    echo "• 🎯 Family Activities"
else
    echo "⏳ AI system is starting up..."
    echo "Please wait a moment and try again."
    echo ""
    echo "To start the AI system, run: npm start"
fi

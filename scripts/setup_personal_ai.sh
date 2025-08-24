#!/bin/bash
# Setup script for Personal AI Assistant System

echo "🤖 Personal AI Assistant Setup"
echo "=============================="
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  Warning: This system is optimized for macOS"
    echo "Some features may not work on other platforms"
    echo ""
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "📋 Checking prerequisites..."
echo ""

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js installed: $NODE_VERSION"
else
    echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm -v)
    echo "✅ npm installed: v$NPM_VERSION"
else
    echo "❌ npm not found"
    exit 1
fi

# Check Supabase CLI
if command_exists supabase; then
    SUPABASE_VERSION=$(supabase --version | cut -d' ' -f3)
    echo "✅ Supabase CLI installed: v$SUPABASE_VERSION"
else
    echo "❌ Supabase CLI not found"
    echo "Installing Supabase CLI..."
    brew install supabase/tap/supabase
fi

# Check Ollama
if command_exists ollama; then
    echo "✅ Ollama installed"
    # Check for required models
    if ollama list | grep -q "llama3.2:3b"; then
        echo "✅ llama3.2:3b model installed"
    else
        echo "📥 Pulling llama3.2:3b model..."
        ollama pull llama3.2:3b
    fi
    
    if ollama list | grep -q "deepseek-r1:14b"; then
        echo "✅ deepseek-r1:14b model installed"
    else
        echo "📥 Pulling deepseek-r1:14b model..."
        ollama pull deepseek-r1:14b
    fi
else
    echo "❌ Ollama not found"
    echo "Please install Ollama from https://ollama.ai"
    exit 1
fi

# Check ExifTool
if command_exists exiftool; then
    EXIF_VERSION=$(exiftool -ver)
    echo "✅ ExifTool installed: v$EXIF_VERSION"
else
    echo "❌ ExifTool not found"
    echo "Installing ExifTool..."
    brew install exiftool
fi

# Check Python
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo "✅ Python installed: $PYTHON_VERSION"
else
    echo "❌ Python 3 not found"
    echo "Please install Python 3 from https://python.org"
fi

echo ""
echo "📦 Installing npm dependencies..."
npm install

echo ""
echo "🎭 Installing Playwright browsers..."
npx playwright install chromium

echo ""
echo "🗄️ Setting up Supabase..."

# Check if Supabase is already running
if supabase status 2>/dev/null | grep -q "API URL"; then
    echo "✅ Supabase is already running"
else
    echo "Starting Supabase..."
    supabase start
fi

echo ""
echo "🔐 Setting up environment..."

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "Creating .env.local file..."
    cat > .env.local << EOF
# Supabase Local Configuration
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434

# Personal Agent Settings
PHOTOS_DIRECTORY=$HOME/Pictures
DOWNLOADS_DIRECTORY=$HOME/Downloads
DOCUMENTS_DIRECTORY=$HOME/Documents
DESKTOP_DIRECTORY=$HOME/Desktop

# Agent Memory Settings
MEMORY_RETENTION_DAYS=30
MAX_MEMORIES_PER_AGENT=1000

# System Control Settings
ENABLE_SYSTEM_CONTROL=true
SAFE_MODE=true
EOF
    echo "✅ Created .env.local"
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "🧪 Running integration tests..."
node test_integration.js

echo ""
echo "✨ Setup complete!"
echo ""
echo "🚀 Quick Start Commands:"
echo ""
echo "1. Run the interactive demo:"
echo "   node demo_personal_ai.js"
echo ""
echo "2. Build TypeScript (when ready):"
echo "   npm run build"
echo ""
echo "3. Start the service:"
echo "   npm start"
echo ""
echo "📚 Example Usage:"
echo '   • "Schedule a team meeting next Tuesday at 2pm"'
echo '   • "Organize all photos from my vacation"'
echo '   • "Clean up duplicate files in Downloads"'
echo '   • "Generate a Python script to process CSV files"'
echo '   • "Create a tool to convert markdown to PDF"'
echo ""
echo "🔗 Resources:"
echo "   • Supabase Studio: http://127.0.0.1:54323"
echo "   • API Documentation: http://127.0.0.1:54321"
echo "   • Ollama Models: ollama list"
echo ""
echo "Happy AI Assisting! 🤖✨"
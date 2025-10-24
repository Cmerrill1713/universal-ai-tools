#!/bin/bash

# Setup script for macOS with Metal GPU support

echo "🍎 Setting up Universal AI Tools for macOS with Metal GPU support..."

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is designed for macOS only"
    exit 1
fi

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew is required. Please install it from https://brew.sh"
    exit 1
fi

echo "📦 Installing dependencies..."

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker Desktop..."
    brew install --cask docker
    echo "⚠️  Please start Docker Desktop and wait for it to be ready, then run this script again."
    exit 0
fi

# Install Ollama natively for Metal support
if ! command -v ollama &> /dev/null; then
    echo "Installing Ollama with Metal support..."
    brew install ollama
fi

# Start Ollama service
echo "🚀 Starting Ollama service with Metal acceleration..."
brew services start ollama

# Pull recommended models optimized for Metal
echo "📥 Pulling recommended models..."
ollama pull llama3.2:1b
ollama pull llama3.2:3b
ollama pull phi3:mini
ollama pull codellama:7b

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p nginx/ssl
mkdir -p monitoring/prometheus
mkdir -p monitoring/grafana/provisioning
mkdir -p searxng

# Generate self-signed SSL certificates for local development
if [ ! -f nginx/ssl/cert.pem ]; then
    echo "🔒 Generating self-signed SSL certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOL
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Database
POSTGRES_USER=aitools
POSTGRES_PASSWORD=aitools
POSTGRES_DB=aitools

# Security
SEARXNG_SECRET_KEY=$(openssl rand -hex 32)
GRAFANA_PASSWORD=admin

# Ollama (using native installation)
OLLAMA_HOST=http://host.docker.internal:11434
EOL
    echo "⚠️  Please update .env with your Supabase credentials"
fi

# Docker Compose commands
echo "🐳 Docker commands for Metal setup:"
echo ""
echo "Start services (excluding Ollama which runs natively):"
echo "  docker-compose -f docker-compose.metal.yml up -d"
echo ""
echo "View logs:"
echo "  docker-compose -f docker-compose.metal.yml logs -f"
echo ""
echo "Stop services:"
echo "  docker-compose -f docker-compose.metal.yml down"
echo ""

# System check
echo "🔍 System check:"
echo "- macOS version: $(sw_vers -productVersion)"
echo "- Apple Silicon: $(sysctl -n machdep.cpu.brand_string | grep -q "Apple" && echo "Yes ✅" || echo "No ❌")"
echo "- Docker: $(docker --version)"
echo "- Ollama: $(ollama --version)"
echo ""

# Metal GPU info
echo "🎮 Metal GPU Information:"
system_profiler SPDisplaysDataType | grep -E "Chipset Model:|Metal Support:" | sed 's/^[[:space:]]*/  /'

echo ""
echo "✅ Setup complete! Ollama is running natively with Metal acceleration."
echo "🚀 Start the other services with: docker-compose -f docker-compose.metal.yml up -d"
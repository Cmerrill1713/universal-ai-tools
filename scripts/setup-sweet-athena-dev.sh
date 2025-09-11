#!/bin/bash

# Sweet Athena Development Environment Setup
# One-click setup for developers

set -e

echo "🌸 Sweet Athena Development Setup"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    local missing=()
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing+=("Node.js (v20+)")
    else
        echo "✓ Node.js $(node -v)"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        missing+=("npm")
    else
        echo "✓ npm $(npm -v)"
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        missing+=("Git")
    else
        echo "✓ Git $(git --version | cut -d' ' -f3)"
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        echo "✓ Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
    else
        echo "⚠️  Docker not found (optional)"
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        echo ""
        echo "❌ Missing prerequisites:"
        printf '%s\n' "${missing[@]}"
        echo ""
        echo "Please install missing prerequisites and run again."
        exit 1
    fi
    
    echo ""
}

# Setup project
setup_project() {
    echo "🔧 Setting up project..."
    
    # Install dependencies
    echo "Installing backend dependencies..."
    npm ci
    
    echo "Installing frontend dependencies..."
    cd ui && npm ci && cd ..
    
    # Create environment file
    if [ ! -f .env ]; then
        echo "Creating .env file..."
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Please update .env with your configuration${NC}"
    fi
    
    echo ""
}

# Setup UE5 project
setup_ue5_project() {
    echo "🎮 Setting up UE5 project..."
    
    UE5_PATH="$HOME/UE5-SweetAthena"
    
    if [ ! -d "$UE5_PATH" ]; then
        echo "Creating UE5 project directory..."
        mkdir -p "$UE5_PATH"
        
        # Create project structure
        mkdir -p "$UE5_PATH/Config"
        mkdir -p "$UE5_PATH/Content"
        mkdir -p "$UE5_PATH/Source/SweetAthenaUE5Project"
        mkdir -p "$UE5_PATH/Scripts/SignallingServer"
        mkdir -p "$UE5_PATH/Scripts/WebServer/public"
        mkdir -p "$UE5_PATH/Plugins"
        
        echo "✓ UE5 project structure created"
    else
        echo "✓ UE5 project directory exists"
    fi
    
    # Make scripts executable
    if [ -f "$UE5_PATH/Scripts/StartPixelStreaming.sh" ]; then
        chmod +x "$UE5_PATH/Scripts/StartPixelStreaming.sh"
        echo "✓ Scripts made executable"
    fi
    
    echo ""
}

# Setup database
setup_database() {
    echo "🗄️ Setting up database..."
    
    # Check if database URL is configured
    if grep -q "DATABASE_URL=your_database_url" .env 2>/dev/null; then
        echo -e "${YELLOW}⚠️  DATABASE_URL not configured in .env${NC}"
        echo "   Using in-memory fallback for development"
    else
        # Run migrations
        echo "Running database migrations..."
        npm run db:migrate || echo "⚠️  Migration failed, continuing..."
    fi
    
    echo ""
}

# Build project
build_project() {
    echo "🏗️ Building project..."
    
    # Build TypeScript
    echo "Building backend..."
    npm run build
    
    # Build frontend
    echo "Building frontend..."
    cd ui && npm run build && cd ..
    
    echo ""
}

# Run tests
run_tests() {
    echo "🧪 Running tests..."
    
    # Run integration tests
    if [ -f "test-sweet-athena-integration.cjs" ]; then
        node test-sweet-athena-integration.cjs || true
    fi
    
    echo ""
}

# Setup Git hooks
setup_git_hooks() {
    echo "🪝 Setting up Git hooks..."
    
    # Install Husky
    npx husky install
    
    # Add pre-commit hook
    npx husky add .husky/pre-commit "npm run lint-staged"
    
    echo "✓ Git hooks configured"
    echo ""
}

# Print next steps
print_next_steps() {
    echo -e "${GREEN}✅ Sweet Athena development environment setup complete!${NC}"
    echo ""
    echo "📝 Next steps:"
    echo ""
    echo "1. Update configuration:"
    echo "   - Edit .env with your API keys and database URL"
    echo "   - Get Convai API key from https://convai.com"
    echo ""
    echo "2. Install Unreal Engine 5.6:"
    echo "   - Download Epic Games Launcher"
    echo "   - Install UE5.6 with Pixel Streaming plugin"
    echo "   - Open ~/UE5-SweetAthena/SweetAthenaUE5Project.uproject"
    echo ""
    echo "3. Start development:"
    echo "   - Backend: npm run dev"
    echo "   - Frontend: cd ui && npm run dev"
    echo "   - UE5: ~/UE5-SweetAthena/Scripts/StartPixelStreaming.sh"
    echo ""
    echo "4. Access Sweet Athena:"
    echo "   - Demo: http://localhost/sweet-athena-demo.html"
    echo "   - API: http://localhost:3002/api/sweet-athena/status"
    echo ""
    echo "5. Read documentation:"
    echo "   - Deployment Guide: docs/SWEET_ATHENA_DEPLOYMENT_GUIDE.md"
    echo "   - API Reference: http://localhost:3002/api/docs"
    echo ""
    echo "Happy coding! 🚀"
}

# Main execution
main() {
    check_prerequisites
    setup_project
    setup_ue5_project
    setup_database
    build_project
    run_tests
    setup_git_hooks
    print_next_steps
}

# Run main function
main
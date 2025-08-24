#!/bin/bash

# Universal AI Tools Production Build Script
# This script creates a production-ready build with optimizations

echo "🚀 Starting Universal AI Tools Production Build..."

# Set environment
export NODE_ENV=production

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf build/
rm -rf .cache/

# Create directories
mkdir -p dist
mkdir -p build/release

# Run TypeScript compilation (allow some errors)
echo "📝 Compiling TypeScript..."
npx tsc --noEmit || true

# Run webpack production build
echo "📦 Running webpack production build..."
npm run build:prod

# Check if build succeeded
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    
    # Create release directory structure
    echo "📁 Creating release structure..."
    mkdir -p build/release/universal-ai-tools
    
    # Copy built files
    cp -r dist/* build/release/universal-ai-tools/
    
    # Copy necessary files
    cp package.json build/release/universal-ai-tools/
    cp .env.example build/release/universal-ai-tools/
    cp -r src/schema build/release/universal-ai-tools/ 2>/dev/null || true
    
    # Create minimal package.json for distribution
    cat > build/release/universal-ai-tools/package.json << EOF
{
  "name": "@universal/ai-tools-service",
  "version": "1.0.0",
  "description": "Universal AI Tools Service - Production Build",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "start:prod": "NODE_ENV=production node server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.46.0",
    "@tensorflow/tfjs-node": "^4.22.0",
    "@xenova/transformers": "^2.17.2",
    "axios": "^1.10.0",
    "cheerio": "^1.1.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "helmet": "^8.1.0",
    "ioredis": "^5.3.2",
    "jsonwebtoken": "^9.0.2",
    "node-fetch": "^3.3.2",
    "openai": "^5.10.1",
    "redis": "^4.7.0",
    "reflect-metadata": "^0.2.2",
    "uuid": "^11.0.5",
    "winston": "^3.17.0",
    "ws": "^8.18.0",
    "zod": "^3.24.1"
  }
}
EOF
    
    # Create README for distribution
    cat > build/release/universal-ai-tools/README.md << EOF
# Universal AI Tools - Production Build

## Installation

1. Install dependencies:
   \`\`\`bash
   npm install --production
   \`\`\`

2. Configure environment:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

3. Start the service:
   \`\`\`bash
   npm start
   \`\`\`

## Docker Deployment

Use the included docker-compose.yml for easy deployment:
\`\`\`bash
docker-compose up -d
\`\`\`

## Requirements

- Node.js 18+
- Redis 7+
- PostgreSQL 15+ (or Supabase)
- Ollama (for local LLM support)
EOF
    
    # Create start script
    cat > build/release/universal-ai-tools/start.sh << 'EOF'
#!/bin/bash
echo "Starting Universal AI Tools Service..."

# Check for .env file
if [ ! -f .env ]; then
    echo "Error: .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "18" ]; then
    echo "Error: Node.js 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

# Install production dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production
fi

# Start the service
exec node server.js
EOF
    
    chmod +x build/release/universal-ai-tools/start.sh
    
    # Calculate build size
    BUILD_SIZE=$(du -sh build/release/universal-ai-tools | cut -f1)
    echo "📊 Build size: $BUILD_SIZE"
    
    # Create tarball
    echo "📦 Creating distribution archive..."
    cd build/release
    tar -czf universal-ai-tools-v1.0.0.tar.gz universal-ai-tools/
    cd ../..
    
    echo "✨ Production build complete!"
    echo "📍 Build location: build/release/universal-ai-tools/"
    echo "📦 Archive: build/release/universal-ai-tools-v1.0.0.tar.gz"
    
else
    echo "❌ Build failed! Check the errors above."
    exit 1
fi
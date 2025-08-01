#!/bin/bash

# Universal AI Tools - Backend Server Startup Script

set -e

echo "🚀 Starting Universal AI Tools Backend Server..."
echo "============================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Start the backend server
echo -e "${BLUE}Starting backend server on port 9999...${NC}"
npm run dev

# This will keep running until you press Ctrl+C
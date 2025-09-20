#!/bin/bash

# Agent Coordination Service Build Script
set -e

echo "🦀 Building Agent Coordination Service..."

# Build the service
cargo build --release

echo "✅ Build completed successfully!"

# Optional: Run tests
if [ "$1" = "--test" ]; then
    echo "🧪 Running tests..."
    cargo test
fi

# Optional: Build Docker image
if [ "$1" = "--docker" ]; then
    echo "🐳 Building Docker image..."
    docker build -t agent-coordination-service:latest .
fi

echo "🚀 Agent Coordination Service ready for deployment!"
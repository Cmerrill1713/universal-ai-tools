#!/bin/bash

# Universal AI Tools - Rust Services Build Script
# Builds all Rust services and Go API Gateway

set -e

echo "🚀 Building Universal AI Tools Rust Services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    print_error "Rust is not installed. Please install Rust first:"
    echo "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Check if Go is installed
if ! command -v go &> /dev/null; then
    print_error "Go is not installed. Please install Go first:"
    echo "https://golang.org/doc/install"
    exit 1
fi

# Check if Python is available for FFI
if ! command -v python3 &> /dev/null; then
    print_warning "Python3 not found. FFI bridges may not work properly."
fi

print_status "Building Rust MLX Service..."
cd rust-services/mlx-rust-service
cargo build --release
if [ $? -eq 0 ]; then
    print_success "MLX Service built successfully"
else
    print_error "Failed to build MLX Service"
    exit 1
fi
cd ../..

print_status "Building Rust DSPy Orchestrator..."
cd rust-services/dspy-rust-service
cargo build --release
if [ $? -eq 0 ]; then
    print_success "DSPy Orchestrator built successfully"
else
    print_error "Failed to build DSPy Orchestrator"
    exit 1
fi
cd ../..

print_status "Building Rust Vision Service..."
cd rust-services/vision-rust-service
cargo build --release
if [ $? -eq 0 ]; then
    print_success "Vision Service built successfully"
else
    print_error "Failed to build Vision Service"
    exit 1
fi
cd ../..

print_status "Building Go API Gateway..."
cd go-services/api-gateway
go build -o api-gateway
if [ $? -eq 0 ]; then
    print_success "API Gateway built successfully"
else
    print_error "Failed to build API Gateway"
    exit 1
fi
cd ../..

print_success "All services built successfully! 🎉"

echo ""
echo "📋 Service Locations:"
echo "  • MLX Service:      rust-services/mlx-rust-service/target/release/mlx-server"
echo "  • DSPy Orchestrator: rust-services/dspy-rust-service/target/release/dspy-server"
echo "  • Vision Service:   rust-services/vision-rust-service/target/release/vision-server"
echo "  • API Gateway:      go-services/api-gateway/api-gateway"
echo ""

echo "🚀 To start all services:"
echo "  ./start-rust-services.sh"
echo ""

echo "🔧 To run individual services:"
echo "  # MLX Service (Port 8001)"
echo "  ./rust-services/mlx-rust-service/target/release/mlx-server"
echo ""
echo "  # DSPy Orchestrator (Port 8002)"
echo "  ./rust-services/dspy-rust-service/target/release/dspy-server"
echo ""
echo "  # Vision Service (Port 8003)"
echo "  ./rust-services/vision-rust-service/target/release/vision-server"
echo ""
echo "  # API Gateway (Port 9999)"
echo "  ./go-services/api-gateway/api-gateway"
echo ""

print_success "Build complete! Universal AI Tools is ready to run on Go/Rust! 🚀"
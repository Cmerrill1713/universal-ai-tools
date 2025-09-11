#!/bin/bash

# Build script for all Rust services
# Provides optimized builds with native CPU features

set -e

echo "🚀 Building Universal AI Tools Rust Services"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect platform
PLATFORM=$(uname -s)
ARCH=$(uname -m)

echo "Platform: $PLATFORM"
echo "Architecture: $ARCH"
echo ""

# Set optimization flags based on platform
if [[ "$PLATFORM" == "Darwin" ]]; then
    # macOS optimizations
    if [[ "$ARCH" == "arm64" ]]; then
        echo "Detected Apple Silicon, enabling M-series optimizations"
        export RUSTFLAGS="-C target-cpu=native -C opt-level=3"
    else
        echo "Detected Intel Mac"
        export RUSTFLAGS="-C target-cpu=native -C opt-level=3"
    fi
elif [[ "$PLATFORM" == "Linux" ]]; then
    # Linux optimizations
    export RUSTFLAGS="-C target-cpu=native -C opt-level=3 -C link-arg=-s"
fi

# Function to build a service
build_service() {
    local service_name=$1
    local service_dir=$2
    
    echo -e "${YELLOW}Building $service_name...${NC}"
    
    if [ -d "$service_dir" ]; then
        cd "$service_dir"
        
        # Clean previous builds
        cargo clean
        
        # Build in release mode
        if cargo build --release; then
            echo -e "${GREEN}✅ $service_name built successfully${NC}"
            
            # Get library size
            if [[ "$PLATFORM" == "Darwin" ]]; then
                LIB_EXT="dylib"
            elif [[ "$PLATFORM" == "Linux" ]]; then
                LIB_EXT="so"
            else
                LIB_EXT="dll"
            fi
            
            LIB_PATH="target/release/lib${service_dir##*/}.$LIB_EXT"
            LIB_PATH_ALT="target/release/lib$(echo ${service_dir##*/} | tr '-' '_').$LIB_EXT"
            
            if [ -f "$LIB_PATH" ]; then
                SIZE=$(du -h "$LIB_PATH" | cut -f1)
                echo "  Library size: $SIZE"
            elif [ -f "$LIB_PATH_ALT" ]; then
                SIZE=$(du -h "$LIB_PATH_ALT" | cut -f1)
                echo "  Library size: $SIZE"
            fi
        else
            echo -e "${RED}❌ Failed to build $service_name${NC}"
            return 1
        fi
        
        cd - > /dev/null
    else
        echo -e "${RED}❌ Directory not found: $service_dir${NC}"
        return 1
    fi
    
    echo ""
}

# Build all services
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Starting builds..."
echo "=================="
echo ""

# Track build status
BUILD_SUCCESS=true

# Build AB-MCTS Service
if ! build_service "AB-MCTS Orchestration Service" "ab-mcts-service"; then
    BUILD_SUCCESS=false
fi

# Build Parameter Analytics Service
if ! build_service "Parameter Analytics Service" "parameter-analytics-service"; then
    BUILD_SUCCESS=false
fi

# Build Multimodal Fusion Service
if ! build_service "Multimodal Fusion Service" "multimodal-fusion-service"; then
    BUILD_SUCCESS=false
fi

# Build Intelligent Parameter Service
if ! build_service "Intelligent Parameter Service" "intelligent-parameter-service"; then
    BUILD_SUCCESS=false
fi

# Summary
echo "Build Summary"
echo "============="

if [ "$BUILD_SUCCESS" = true ]; then
    echo -e "${GREEN}✅ All services built successfully!${NC}"
    echo ""
    echo "Libraries are available at:"
    
    for service_dir in */; do
        if [ -d "$service_dir/target/release" ]; then
            service_name=$(echo ${service_dir%/} | tr '-' '_')
            
            if [[ "$PLATFORM" == "Darwin" ]]; then
                echo "  - $service_dir/target/release/lib$service_name.dylib"
            elif [[ "$PLATFORM" == "Linux" ]]; then
                echo "  - $service_dir/target/release/lib$service_name.so"
            fi
        fi
    done
    
    echo ""
    echo "To use these libraries in the TypeScript services:"
    echo "  1. Ensure the libraries are in the correct path"
    echo "  2. Restart the Node.js server"
    echo "  3. The services will automatically detect and use the native modules"
else
    echo -e "${RED}❌ Some services failed to build${NC}"
    exit 1
fi

# Optional: Run tests
read -p "Do you want to run tests for all services? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Running tests..."
    echo "================"
    
    for service_dir in */; do
        if [ -d "$service_dir" ] && [ -f "$service_dir/Cargo.toml" ]; then
            echo -e "${YELLOW}Testing ${service_dir%/}...${NC}"
            cd "$service_dir"
            
            if cargo test --release; then
                echo -e "${GREEN}✅ Tests passed${NC}"
            else
                echo -e "${RED}❌ Tests failed${NC}"
            fi
            
            cd - > /dev/null
            echo ""
        fi
    done
fi

echo "Build process complete!"
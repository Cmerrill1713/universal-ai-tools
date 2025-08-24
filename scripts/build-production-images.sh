#!/bin/bash

# Production Docker Image Build Script
# Builds optimized Docker images for Go/Rust microservices architecture

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="${DOCKER_REGISTRY:-localhost/universal-ai-tools}"
VERSION="${VERSION:-latest}"
BUILD_ARGS="${BUILD_ARGS:-}"
PLATFORM="${PLATFORM:-linux/amd64,linux/arm64}"
PUSH="${PUSH:-false}"

# Validate registry format for production builds
if [ "${PUSH}" = "true" ] && [[ "${REGISTRY}" =~ ^localhost/ ]]; then
    echo -e "${RED}❌ Error: Cannot push to localhost registry. Set DOCKER_REGISTRY environment variable.${NC}"
    echo -e "${YELLOW}Example: export DOCKER_REGISTRY=your-registry.com/universal-ai-tools${NC}"
    exit 1
fi

echo -e "${PURPLE}🐋 Universal AI Tools - Production Image Builder${NC}"
echo -e "${PURPLE}================================================${NC}"
echo -e "${BLUE}Registry: ${REGISTRY}${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}Platform: ${PLATFORM}${NC}"
echo -e "${BLUE}Push to registry: ${PUSH}${NC}"
echo ""

# Check Docker buildx
if ! docker buildx version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker buildx not available. Install Docker Desktop or enable buildx.${NC}"
    exit 1
fi

# Create builder instance for multi-platform builds
echo -e "${BLUE}🔧 Setting up Docker buildx...${NC}"
docker buildx create --name universal-ai-builder --use 2>/dev/null || docker buildx use universal-ai-builder 2>/dev/null || true
docker buildx inspect --bootstrap

# Function to build image
build_image() {
    local service_name=$1
    local dockerfile_path=$2
    local context_path=$3
    local image_tag="${REGISTRY}/${service_name}:${VERSION}"
    
    echo -e "${GREEN}🚀 Building ${service_name}...${NC}"
    echo -e "${BLUE}  Context: ${context_path}${NC}"
    echo -e "${BLUE}  Dockerfile: ${dockerfile_path}${NC}"
    echo -e "${BLUE}  Image: ${image_tag}${NC}"
    
    local build_cmd="docker buildx build"
    build_cmd="${build_cmd} --platform ${PLATFORM}"
    build_cmd="${build_cmd} --target runtime"
    build_cmd="${build_cmd} -f ${dockerfile_path}"
    build_cmd="${build_cmd} -t ${image_tag}"
    
    # Add build args if specified
    if [ -n "${BUILD_ARGS}" ]; then
        build_cmd="${build_cmd} ${BUILD_ARGS}"
    fi
    
    # Add push flag if enabled
    if [ "${PUSH}" = "true" ]; then
        build_cmd="${build_cmd} --push"
    else
        build_cmd="${build_cmd} --load"
    fi
    
    build_cmd="${build_cmd} ${context_path}"
    
    echo -e "${BLUE}  Command: ${build_cmd}${NC}"
    echo ""
    
    if eval ${build_cmd}; then
        echo -e "${GREEN}✅ Successfully built ${service_name}${NC}"
        
        # Get image size for local builds
        if [ "${PUSH}" = "false" ]; then
            local image_size=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "${image_tag}" | awk '{print $2}' || echo "Unknown")
            echo -e "${BLUE}  Image size: ${image_size}${NC}"
        fi
        echo ""
    else
        echo -e "${RED}❌ Failed to build ${service_name}${NC}"
        return 1
    fi
}

# Function to run security scan
security_scan() {
    local image_tag=$1
    local service_name=$2
    
    echo -e "${BLUE}🔍 Running security scan for ${service_name}...${NC}"
    
    # Check if Trivy is available
    if command -v trivy &> /dev/null; then
        trivy image --severity HIGH,CRITICAL --no-progress "${image_tag}" || {
            echo -e "${YELLOW}⚠️  Security scan found issues in ${service_name}${NC}"
        }
    else
        echo -e "${YELLOW}💡 Install trivy for security scanning: brew install trivy${NC}"
    fi
}

# Function to test image
test_image() {
    local image_tag=$1
    local service_name=$2
    local test_port=$3
    
    echo -e "${BLUE}🧪 Testing ${service_name} image...${NC}"
    
    # Start container for testing
    local container_id=$(docker run -d -p "${test_port}:${test_port}" "${image_tag}")
    
    # Wait for service to start
    sleep 10
    
    # Test health endpoint
    if curl -f "http://localhost:${test_port}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ${service_name} health check passed${NC}"
    else
        echo -e "${RED}❌ ${service_name} health check failed${NC}"
    fi
    
    # Cleanup
    docker stop "${container_id}" > /dev/null
    docker rm "${container_id}" > /dev/null
}

# Build all production images
echo -e "${GREEN}🏗️  Building production Docker images...${NC}"
echo ""

# Build GraphRAG Service (Rust)
build_image "graphrag-service" "rust-services/graphrag/Dockerfile" "rust-services/graphrag"

# Build LLM Router (Rust)
build_image "llm-router" "rust-services/llm-router/Dockerfile" "rust-services/llm-router"

# Build WebSocket Service (Go)
build_image "websocket-service" "rust-services/go-websocket/Dockerfile" "rust-services/go-websocket"

echo -e "${GREEN}🎉 All images built successfully!${NC}"
echo ""

# Run security scans if not pushing (local builds only)
if [ "${PUSH}" = "false" ] && [ "${SKIP_SECURITY_SCAN}" != "true" ]; then
    echo -e "${PURPLE}🔒 Running security scans...${NC}"
    echo ""
    
    security_scan "${REGISTRY}/graphrag-service:${VERSION}" "graphrag-service"
    security_scan "${REGISTRY}/llm-router:${VERSION}" "llm-router"
    security_scan "${REGISTRY}/websocket-service:${VERSION}" "websocket-service"
fi

# Run smoke tests if not pushing
if [ "${PUSH}" = "false" ] && [ "${SKIP_TESTS}" != "true" ]; then
    echo -e "${PURPLE}🧪 Running smoke tests...${NC}"
    echo ""
    
    # Note: These tests require the services to support health checks
    # test_image "${REGISTRY}/graphrag-service:${VERSION}" "graphrag-service" "8000"
    # test_image "${REGISTRY}/llm-router:${VERSION}" "llm-router" "8001"  
    # test_image "${REGISTRY}/websocket-service:${VERSION}" "websocket-service" "8080"
    
    echo -e "${YELLOW}💡 Smoke tests disabled. Enable after implementing health check endpoints.${NC}"
fi

# Display image summary
echo -e "${PURPLE}📊 Image Summary${NC}"
echo -e "${PURPLE}================${NC}"

if [ "${PUSH}" = "false" ]; then
    echo -e "${BLUE}Local Images:${NC}"
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep "${REGISTRY}" | head -10
else
    echo -e "${BLUE}Images pushed to registry: ${REGISTRY}${NC}"
    echo -e "  • ${REGISTRY}/graphrag-service:${VERSION}"
    echo -e "  • ${REGISTRY}/llm-router:${VERSION}"
    echo -e "  • ${REGISTRY}/websocket-service:${VERSION}"
fi

echo ""
echo -e "${GREEN}✅ Production image build complete!${NC}"
echo ""

# Usage examples
echo -e "${PURPLE}🚀 Usage Examples${NC}"
echo -e "${PURPLE}=================${NC}"
echo -e "${BLUE}Start production stack:${NC}"
echo -e "  docker-compose -f docker-compose.production.yml up -d"
echo ""
echo -e "${BLUE}Run load tests:${NC}"
echo -e "  cd rust-services/graphrag && ./run_load_test.sh standard"
echo ""
echo -e "${BLUE}Monitor services:${NC}"
echo -e "  open http://localhost:3000  # Grafana dashboards"
echo -e "  open http://localhost:9090  # Prometheus metrics"
echo ""

# Cleanup builder
if [ "${CLEANUP_BUILDER}" = "true" ]; then
    echo -e "${BLUE}🧹 Cleaning up builder...${NC}"
    docker buildx rm universal-ai-builder 2>/dev/null || true
fi
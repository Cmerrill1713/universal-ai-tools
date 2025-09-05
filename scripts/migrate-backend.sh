#!/bin/bash

# Migration script for transitioning from TypeScript to Go/Rust backend

set -e

echo "🚀 Starting backend migration to Go/Rust architecture..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo "Checking prerequisites..."

if ! command_exists go; then
    print_error "Go is not installed. Please install Go 1.21 or later."
    exit 1
fi

if ! command_exists cargo; then
    print_error "Rust is not installed. Please install Rust 1.75 or later."
    exit 1
fi

if ! command_exists docker; then
    print_warning "Docker is not installed. Docker is recommended for deployment."
fi

print_status "All prerequisites met"

# Build Go services
echo ""
echo "Building Go services..."

GO_SERVICES=(
    "api-gateway"
    "auth-service"
    "chat-service"
    "ml-inference"
    "load-balancer"
    "cache-coordinator"
    "metrics-aggregator"
    "service-discovery"
)

for service in "${GO_SERVICES[@]}"; do
    if [ -d "go-services/$service" ]; then
        echo "Building $service..."
        cd "go-services/$service"
        
        # Initialize go.sum if it doesn't exist
        if [ ! -f "go.sum" ]; then
            go mod tidy
        fi
        
        go build -o "../../bin/$service" .
        cd ../..
        print_status "Built $service"
    else
        print_warning "Service directory go-services/$service not found, skipping..."
    fi
done

# Build Rust services
echo ""
echo "Building Rust services..."

RUST_SERVICES=(
    "vision-service"
    "fast-llm-coordinator"
    "llm-router"
    "parameter-analytics"
)

for service in "${RUST_SERVICES[@]}"; do
    if [ -d "crates/$service" ]; then
        echo "Building $service..."
        cd "crates/$service"
        cargo build --release
        cd ../..
        
        # Copy binary to bin directory
        if [ -f "target/release/$service" ]; then
            cp "target/release/$service" "bin/$service"
            print_status "Built $service"
        fi
    else
        print_warning "Service directory crates/$service not found, skipping..."
    fi
done

# Create systemd service files (optional)
echo ""
echo "Creating systemd service files..."

mkdir -p systemd-services

cat > systemd-services/api-gateway.service <<EOF
[Unit]
Description=Universal AI Tools API Gateway
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/universal-ai-tools
ExecStart=/opt/universal-ai-tools/bin/api-gateway
Restart=on-failure
Environment="PORT=8080"
Environment="AUTH_SERVICE_URL=http://localhost:8015"
Environment="CHAT_SERVICE_URL=http://localhost:8016"

[Install]
WantedBy=multi-user.target
EOF

print_status "Created systemd service files"

# Create nginx configuration
echo ""
echo "Creating nginx configuration..."

cat > nginx.conf <<EOF
upstream api_gateway {
    server localhost:8080;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /ws {
        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

print_status "Created nginx configuration"

# Migration checklist
echo ""
echo "======================================"
echo "Migration Checklist:"
echo "======================================"
echo ""
echo "1. Database Migration:"
echo "   - Export data from existing database"
echo "   - Update connection strings in new services"
echo ""
echo "2. Environment Variables:"
echo "   - Copy .env file to each service directory"
echo "   - Update service-specific configurations"
echo ""
echo "3. Testing:"
echo "   - Run: docker-compose -f docker-compose.migration.yml up"
echo "   - Test all API endpoints"
echo "   - Verify WebSocket connections"
echo ""
echo "4. Deployment:"
echo "   - Deploy services using Docker Compose or Kubernetes"
echo "   - Configure load balancer/reverse proxy"
echo "   - Set up monitoring and logging"
echo ""
echo "5. Gradual Migration:"
echo "   - Route traffic gradually to new services"
echo "   - Monitor performance and errors"
echo "   - Keep legacy service running as fallback"
echo ""

# Create test script
cat > test-migration.sh <<'TESTEOF'
#!/bin/bash

echo "Testing migrated services..."

# Test health endpoints
services=("8080" "8015" "8016" "3033")
for port in "${services[@]}"; do
    echo "Testing health endpoint on port $port..."
    curl -f http://localhost:$port/health || echo "Service on port $port not responding"
done

# Test authentication
echo "Testing authentication..."
curl -X POST http://localhost:8080/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","username":"test","password":"test123"}'

# Test chat
echo "Testing chat..."
curl -X POST http://localhost:8080/api/chat \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"message":"Hello, how are you?"}'

echo "Basic tests complete!"
TESTEOF

chmod +x test-migration.sh
print_status "Created test script: test-migration.sh"

echo ""
echo "======================================"
echo "✨ Migration preparation complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Review and update configuration files"
echo "2. Start services with: docker-compose -f docker-compose.migration.yml up"
echo "3. Run tests with: ./test-migration.sh"
echo "4. Monitor logs and performance"
echo ""
echo "For gradual migration, use the API gateway to route traffic"
echo "between new Go/Rust services and legacy TypeScript services."
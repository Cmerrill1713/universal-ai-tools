#!/bin/bash

# Universal AI Tools - Low Resource Setup Script
# This script optimizes the system for running on low-resource environments

set -e

echo "🚀 Universal AI Tools - Low Resource Setup"
echo "============================================="

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

# Check system requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check available memory
    if command -v free >/dev/null 2>&1; then
        TOTAL_MEM=$(free -m | grep '^Mem:' | awk '{print $2}')
        if [ "$TOTAL_MEM" -lt 2048 ]; then
            print_warning "Low memory detected: ${TOTAL_MEM}MB. Optimizations will be aggressive."
            export LOW_MEMORY=true
        else
            print_success "Memory: ${TOTAL_MEM}MB available"
        fi
    elif command -v vm_stat >/dev/null 2>&1; then
        # macOS
        TOTAL_BYTES=$(sysctl -n hw.memsize)
        TOTAL_MB=$((TOTAL_BYTES / 1024 / 1024))
        if [ "$TOTAL_MB" -lt 2048 ]; then
            print_warning "Low memory detected: ${TOTAL_MB}MB. Optimizations will be aggressive."
            export LOW_MEMORY=true
        else
            print_success "Memory: ${TOTAL_MB}MB available"
        fi
    fi
    
    # Check CPU cores
    if command -v nproc >/dev/null 2>&1; then
        CPU_CORES=$(nproc)
    else
        CPU_CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo "2")
    fi
    
    if [ "$CPU_CORES" -lt 2 ]; then
        print_warning "Single core CPU detected. Performance may be limited."
        export LOW_CPU=true
    else
        print_success "CPU cores: $CPU_CORES available"
    fi
    
    # Check disk space
    DISK_AVAIL=$(df -m . | tail -1 | awk '{print $4}')
    if [ "$DISK_AVAIL" -lt 1024 ]; then
        print_warning "Low disk space: ${DISK_AVAIL}MB. Consider cleanup."
    else
        print_success "Disk space: ${DISK_AVAIL}MB available"
    fi
}

# Optimize Node.js settings
optimize_nodejs() {
    print_status "Optimizing Node.js settings..."
    
    # Create optimized environment file
    cat > .env.optimized << EOF
# Optimized settings for low-resource environments
NODE_ENV=production
PORT=9999

# Memory optimizations
NODE_OPTIONS=--max-old-space-size=384 --max-semi-space-size=8 --optimize-for-size

# Process limits
UV_THREADPOOL_SIZE=2
MALLOC_TRIM_THRESHOLD_=100000

# Application optimizations
ENABLE_OPTIMIZATIONS=true
MEMORY_LIMIT_MB=384
CPU_LIMIT_PERCENT=80
CACHE_SIZE_LIMIT=50
BATCH_SIZE_LIMIT=10

# Database optimizations
DB_POOL_SIZE=3
DB_CONNECTION_TIMEOUT=10000

# Redis optimizations
REDIS_MAX_MEMORY=64mb
REDIS_EVICTION_POLICY=allkeys-lru

# Disable heavy features
ENABLE_MLX=false
ENABLE_VISION=false
ENABLE_METRICS=false
ENABLE_DETAILED_LOGGING=false
EOF

    print_success "Created optimized environment configuration"
}

# Setup Docker optimizations
setup_docker() {
    print_status "Setting up Docker optimizations..."
    
    if ! command -v docker >/dev/null 2>&1; then
        print_warning "Docker not found. Skipping Docker setup."
        return
    fi
    
    # Check if docker-compose is available
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        print_warning "Docker Compose not found. Manual Docker setup required."
        return
    fi
    
    # Create optimized Docker daemon configuration
    if [ -w /etc/docker ] || [ "$EUID" -eq 0 ]; then
        print_status "Creating optimized Docker daemon configuration..."
        cat > /tmp/daemon.json << EOF
{
  "default-runtime": "runc",
  "default-ulimits": {
    "memlock": {
      "Hard": 67108864,
      "Name": "memlock",
      "Soft": 67108864
    },
    "nofile": {
      "Hard": 1024,
      "Name": "nofile", 
      "Soft": 1024
    }
  },
  "max-concurrent-downloads": 2,
  "max-concurrent-uploads": 2,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
        
        if [ "$EUID" -eq 0 ]; then
            mv /tmp/daemon.json /etc/docker/daemon.json
            print_success "Docker daemon configuration updated"
        else
            print_warning "Root access required to update Docker daemon. Configuration saved to /tmp/daemon.json"
        fi
    fi
    
    print_success "Docker optimization setup complete"
}

# Build optimized application
build_application() {
    print_status "Building optimized application..."
    
    # Install dependencies with production optimizations
    if [ -f package-lock.json ]; then
        npm ci --only=production --no-audit --no-fund
    else
        npm install --only=production --no-audit --no-fund
    fi
    
    # Build the optimized version
    npm run build:optimized
    
    print_success "Application built successfully"
}

# Setup monitoring
setup_monitoring() {
    print_status "Setting up resource monitoring..."
    
    # Create monitoring script
    chmod +x scripts/monitor-resources.ts
    
    # Create systemd service for monitoring (Linux only)
    if command -v systemctl >/dev/null 2>&1 && [ "$EUID" -eq 0 ]; then
        cat > /etc/systemd/system/ai-tools-monitor.service << EOF
[Unit]
Description=Universal AI Tools Resource Monitor
After=network.target

[Service]
Type=simple
User=nobody
Group=nogroup
WorkingDirectory=$(pwd)
ExecStart=$(which node) scripts/monitor-resources.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload
        systemctl enable ai-tools-monitor
        print_success "Monitoring service installed"
    else
        print_warning "Systemd not available or not root. Manual monitoring setup required."
    fi
}

# Setup swap (Linux only)
setup_swap() {
    if [ "$(uname)" != "Linux" ] || [ "$EUID" -ne 0 ]; then
        print_warning "Swap setup requires Linux with root access. Skipping."
        return
    fi
    
    print_status "Checking swap configuration..."
    
    SWAP_SIZE=$(free -m | grep '^Swap:' | awk '{print $2}')
    if [ "$SWAP_SIZE" -eq 0 ]; then
        print_status "No swap detected. Creating 1GB swap file..."
        
        # Create swap file
        fallocate -l 1G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        
        # Add to fstab
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        
        # Optimize swap settings
        echo 'vm.swappiness=10' >> /etc/sysctl.conf
        echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
        
        sysctl -p
        
        print_success "Swap file created and configured"
    else
        print_success "Swap already configured: ${SWAP_SIZE}MB"
    fi
}

# Create startup scripts
create_scripts() {
    print_status "Creating startup scripts..."
    
    # Create optimized startup script
    cat > start-optimized.sh << 'EOF'
#!/bin/bash

# Universal AI Tools - Optimized Startup Script

echo "🚀 Starting Universal AI Tools (Optimized Mode)"

# Load optimized environment
if [ -f .env.optimized ]; then
    export $(cat .env.optimized | grep -v '^#' | xargs)
fi

# Check system resources
AVAILABLE_MEM=$(free -m 2>/dev/null | grep '^Mem:' | awk '{print $7}' || echo "1000")
if [ "$AVAILABLE_MEM" -lt 512 ]; then
    echo "⚠️  Low memory detected. Using ultra-lightweight mode."
    export ULTRA_LIGHTWEIGHT=true
fi

# Start the optimized server
exec npm run start:optimized
EOF

    chmod +x start-optimized.sh
    
    # Create Docker startup script
    cat > start-docker-optimized.sh << 'EOF'
#!/bin/bash

echo "🐳 Starting Universal AI Tools in Docker (Optimized)"

# Build optimized image
docker build -f Dockerfile.optimized -t universal-ai-tools:optimized .

# Run with resource limits
docker run -d \
  --name universal-ai-tools-optimized \
  --restart unless-stopped \
  -p 9999:9999 \
  --memory=512m \
  --cpus=0.5 \
  --oom-kill-disable=false \
  -e NODE_ENV=production \
  -e ENABLE_OPTIMIZATIONS=true \
  universal-ai-tools:optimized

echo "✅ Universal AI Tools started in optimized Docker container"
echo "📊 Monitor with: docker stats universal-ai-tools-optimized"
EOF

    chmod +x start-docker-optimized.sh
    
    print_success "Startup scripts created"
}

# Main setup function
main() {
    echo
    print_status "Starting low-resource optimization setup..."
    
    check_requirements
    optimize_nodejs
    setup_docker
    build_application
    setup_monitoring
    setup_swap
    create_scripts
    
    echo
    print_success "✅ Low-resource optimization setup complete!"
    echo
    echo "📋 Next steps:"
    echo "   1. Run: ./start-optimized.sh (for direct Node.js)"
    echo "   2. Or: ./start-docker-optimized.sh (for Docker)"
    echo "   3. Monitor: npm run monitor:resources"
    echo "   4. Health check: curl http://localhost:9999/api/v1/health"
    echo
    echo "🔧 Configuration files created:"
    echo "   - .env.optimized (environment settings)"
    echo "   - start-optimized.sh (Node.js startup)"
    echo "   - start-docker-optimized.sh (Docker startup)"
    echo
    
    if [ "$LOW_MEMORY" = true ]; then
        print_warning "⚠️  Low memory system detected. Consider:"
        echo "   - Closing other applications"
        echo "   - Adding swap space"
        echo "   - Using only essential features"
    fi
    
    echo "🎯 Optimizations applied:"
    echo "   - Reduced memory limits (384MB Node.js heap)"
    echo "   - Aggressive caching and batching"
    echo "   - Disabled heavy features (MLX, Vision)"
    echo "   - Optimized Docker configuration"
    echo "   - Resource monitoring setup"
    echo
}

# Run main setup
main "$@"
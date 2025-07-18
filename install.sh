#!/bin/bash

# Universal AI Tools Installer Script
# This script installs and configures Universal AI Tools

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Installation directory
INSTALL_DIR="${INSTALL_DIR:-/opt/universal-ai-tools}"
DATA_DIR="${DATA_DIR:-/var/lib/universal-ai-tools}"
LOG_DIR="${LOG_DIR:-/var/log/universal-ai-tools}"

# Print colored output
print_info() {
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

# Banner
cat << "EOF"
 _   _       _                          _    _    ___ 
| | | |_ __ (_)_   _____ _ __ ___  __ _| |  / \  |_ _|
| | | | '_ \| \ \ / / _ \ '__/ __|/ _` | | / _ \  | | 
| |_| | | | | |\ V /  __/ |  \__ \ (_| | |/ ___ \ | | 
 \___/|_| |_|_| \_/ \___|_|  |___/\__,_|_/_/   \_\___|
                                                       
        Universal AI Tools Installer v1.0.0
EOF

echo ""
print_info "Starting Universal AI Tools installation..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root"
   exit 1
fi

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    DISTRO=$(lsb_release -si 2>/dev/null || echo "Unknown")
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    print_error "Unsupported operating system: $OSTYPE"
    exit 1
fi

print_info "Detected OS: $OS ($DISTRO)"

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt "18" ]; then
        print_error "Node.js 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        print_success "Docker detected"
        DOCKER_AVAILABLE=true
    else
        print_warning "Docker not found. Docker deployment will not be available."
        DOCKER_AVAILABLE=false
    fi
    
    # Check Redis (optional)
    if command -v redis-cli &> /dev/null; then
        print_success "Redis detected"
    else
        print_warning "Redis not found. Will need to be installed separately or use Docker."
    fi
    
    print_success "Prerequisites check completed"
}

# Create directories
create_directories() {
    print_info "Creating directories..."
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$DATA_DIR"/{models,cache,db}
    mkdir -p "$LOG_DIR"
    
    print_success "Directories created"
}

# Extract installation files
extract_files() {
    print_info "Extracting installation files..."
    
    # Check if we're running from the distribution archive
    if [ -f "universal-ai-tools.tar.gz" ]; then
        tar -xzf universal-ai-tools.tar.gz -C "$INSTALL_DIR" --strip-components=1
    elif [ -d "dist" ]; then
        # Running from source directory
        cp -r dist/* "$INSTALL_DIR/"
        cp package.json "$INSTALL_DIR/"
        cp .env.example "$INSTALL_DIR/"
        [ -d "schema" ] && cp -r schema "$INSTALL_DIR/"
    else
        print_error "Installation files not found"
        exit 1
    fi
    
    print_success "Files extracted"
}

# Install dependencies
install_dependencies() {
    print_info "Installing Node.js dependencies..."
    
    cd "$INSTALL_DIR"
    npm install --production --no-audit --no-fund
    
    print_success "Dependencies installed"
}

# Configure environment
configure_environment() {
    print_info "Configuring environment..."
    
    if [ ! -f "$INSTALL_DIR/.env" ]; then
        cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
        
        print_warning "Please edit $INSTALL_DIR/.env to configure your installation"
        print_info "Key configuration items:"
        echo "  - SUPABASE_URL: Your Supabase project URL"
        echo "  - SUPABASE_SERVICE_KEY: Your Supabase service key"
        echo "  - JWT_SECRET: A secure random string for JWT signing"
        echo "  - REDIS_URL: Redis connection URL (default: redis://localhost:6379)"
    fi
    
    # Set permissions
    chmod 600 "$INSTALL_DIR/.env"
    
    print_success "Environment configured"
}

# Create systemd service
create_systemd_service() {
    if [[ "$OS" != "linux" ]]; then
        return
    fi
    
    print_info "Creating systemd service..."
    
    cat > /etc/systemd/system/universal-ai-tools.service << EOF
[Unit]
Description=Universal AI Tools Service
Documentation=https://github.com/your-org/universal-ai-tools
After=network.target redis.service

[Service]
Type=simple
User=aitools
Group=aitools
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/service.log
StandardError=append:$LOG_DIR/error.log
Environment="NODE_ENV=production"
Environment="NODE_OPTIONS=--max-old-space-size=2048"

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR $LOG_DIR

[Install]
WantedBy=multi-user.target
EOF

    # Create service user
    if ! id -u aitools &>/dev/null; then
        useradd --system --home-dir "$INSTALL_DIR" --shell /bin/false aitools
    fi
    
    # Set ownership
    chown -R aitools:aitools "$INSTALL_DIR" "$DATA_DIR" "$LOG_DIR"
    
    # Reload systemd
    systemctl daemon-reload
    
    print_success "Systemd service created"
}

# Setup Docker Compose (optional)
setup_docker_compose() {
    if [[ "$DOCKER_AVAILABLE" != "true" ]]; then
        return
    fi
    
    read -p "Do you want to set up Docker Compose? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi
    
    print_info "Setting up Docker Compose..."
    
    # Copy Docker files
    if [ -f "docker-compose.prod.yml" ]; then
        cp docker-compose.prod.yml "$INSTALL_DIR/docker-compose.yml"
        cp Dockerfile.prod "$INSTALL_DIR/Dockerfile"
    fi
    
    print_success "Docker Compose files copied"
    print_info "To start with Docker: cd $INSTALL_DIR && docker-compose up -d"
}

# Install Ollama (optional)
install_ollama() {
    read -p "Do you want to install Ollama for local LLM support? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi
    
    print_info "Installing Ollama..."
    
    if [[ "$OS" == "linux" ]]; then
        curl -fsSL https://ollama.com/install.sh | sh
    elif [[ "$OS" == "macos" ]]; then
        print_info "Please download Ollama from https://ollama.com/download"
    fi
    
    # Pull default models
    if command -v ollama &> /dev/null; then
        print_info "Pulling default models..."
        ollama pull nomic-embed-text
        ollama pull llama3.2:3b
    fi
    
    print_success "Ollama installed"
}

# Final setup
final_setup() {
    print_info "Performing final setup..."
    
    # Create start script
    cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
exec node server.js
EOF
    chmod +x "$INSTALL_DIR/start.sh"
    
    # Create management script
    cat > /usr/local/bin/aitools << EOF
#!/bin/bash
# Universal AI Tools management script

case "\$1" in
    start)
        if [[ -f /etc/systemd/system/universal-ai-tools.service ]]; then
            systemctl start universal-ai-tools
        else
            cd $INSTALL_DIR && ./start.sh
        fi
        ;;
    stop)
        if [[ -f /etc/systemd/system/universal-ai-tools.service ]]; then
            systemctl stop universal-ai-tools
        else
            pkill -f "node.*server.js"
        fi
        ;;
    restart)
        if [[ -f /etc/systemd/system/universal-ai-tools.service ]]; then
            systemctl restart universal-ai-tools
        else
            \$0 stop
            sleep 2
            \$0 start
        fi
        ;;
    status)
        if [[ -f /etc/systemd/system/universal-ai-tools.service ]]; then
            systemctl status universal-ai-tools
        else
            pgrep -f "node.*server.js" && echo "Running" || echo "Stopped"
        fi
        ;;
    logs)
        if [[ -f /etc/systemd/system/universal-ai-tools.service ]]; then
            journalctl -u universal-ai-tools -f
        else
            tail -f $LOG_DIR/*.log
        fi
        ;;
    *)
        echo "Usage: aitools {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
EOF
    chmod +x /usr/local/bin/aitools
    
    print_success "Final setup completed"
}

# Main installation flow
main() {
    check_prerequisites
    create_directories
    extract_files
    install_dependencies
    configure_environment
    create_systemd_service
    setup_docker_compose
    install_ollama
    final_setup
    
    echo ""
    print_success "Universal AI Tools installation completed!"
    echo ""
    print_info "Next steps:"
    echo "1. Edit configuration: $INSTALL_DIR/.env"
    echo "2. Start the service: aitools start"
    echo "3. Check status: aitools status"
    echo "4. View logs: aitools logs"
    echo ""
    print_info "Default API endpoint: http://localhost:9999"
    print_info "Documentation: https://github.com/your-org/universal-ai-tools"
}

# Run main installation
main
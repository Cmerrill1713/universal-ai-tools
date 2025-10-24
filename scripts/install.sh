#!/bin/bash

# Universal AI Tools - Installation Script
# Supports: Linux (Ubuntu/Debian, CentOS/RHEL), macOS, Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS=$NAME
            VER=$VERSION_ID
        else
            log_error "Cannot detect Linux distribution"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macOS"
        VER=$(sw_vers -productVersion)
    else
        log_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi

    log_info "Detected OS: $OS $VER"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install system dependencies
install_dependencies() {
    log_info "Installing system dependencies..."

    case $OS in
        "Ubuntu"*|"Debian"*)
            sudo apt-get update
            sudo apt-get install -y \
                curl \
                wget \
                git \
                build-essential \
                pkg-config \
                libssl-dev \
                libpq-dev \
                ca-certificates
            ;;
        "CentOS"*|"Red Hat"*|"Fedora"*)
            if command_exists dnf; then
                sudo dnf install -y \
                    curl \
                    wget \
                    git \
                    gcc \
                    gcc-c++ \
                    make \
                    pkgconfig \
                    openssl-devel \
                    postgresql-devel \
                    ca-certificates
            else
                sudo yum install -y \
                    curl \
                    wget \
                    git \
                    gcc \
                    gcc-c++ \
                    make \
                    pkgconfig \
                    openssl-devel \
                    postgresql-devel \
                    ca-certificates
            fi
            ;;
        "macOS")
            if ! command_exists brew; then
                log_info "Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install \
                curl \
                wget \
                git \
                pkg-config \
                openssl \
                postgresql
            ;;
        *)
            log_error "Unsupported operating system: $OS"
            exit 1
            ;;
    esac

    log_success "System dependencies installed"
}

# Install Rust
install_rust() {
    if command_exists cargo; then
        log_info "Rust is already installed: $(cargo --version)"
        return 0
    fi

    log_info "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env

    log_success "Rust installed: $(cargo --version)"
}

# Install Docker
install_docker() {
    if command_exists docker; then
        log_info "Docker is already installed: $(docker --version)"
        return 0
    fi

    log_info "Installing Docker..."

    case $OS in
        "Ubuntu"*|"Debian"*)
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            sudo usermod -aG docker $USER
            ;;
        "CentOS"*|"Red Hat"*|"Fedora"*)
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            sudo usermod -aG docker $USER
            sudo systemctl enable docker
            sudo systemctl start docker
            ;;
        "macOS")
            log_warning "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
            ;;
    esac

    log_success "Docker installed"
}

# Install Docker Compose
install_docker_compose() {
    if command_exists docker-compose; then
        log_info "Docker Compose is already installed: $(docker-compose --version)"
        return 0
    fi

    log_info "Installing Docker Compose..."

    case $OS in
        "Ubuntu"*|"Debian"*|"CentOS"*|"Red Hat"*|"Fedora"*)
            sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
            ;;
        "macOS")
            if command_exists brew; then
                brew install docker-compose
            else
                log_warning "Please install Docker Compose from https://github.com/docker/compose/releases"
            fi
            ;;
    esac

    log_success "Docker Compose installed"
}

# Install PostgreSQL
install_postgresql() {
    if command_exists psql; then
        log_info "PostgreSQL is already installed: $(psql --version)"
        return 0
    fi

    log_info "Installing PostgreSQL..."

    case $OS in
        "Ubuntu"*|"Debian"*)
            sudo apt-get install -y postgresql postgresql-contrib
            sudo systemctl enable postgresql
            sudo systemctl start postgresql
            ;;
        "CentOS"*|"Red Hat"*|"Fedora"*)
            if command_exists dnf; then
                sudo dnf install -y postgresql-server postgresql-contrib
            else
                sudo yum install -y postgresql-server postgresql-contrib
            fi
            sudo postgresql-setup initdb
            sudo systemctl enable postgresql
            sudo systemctl start postgresql
            ;;
        "macOS")
            if command_exists brew; then
                brew install postgresql
                brew services start postgresql
            else
                log_warning "Please install PostgreSQL from https://www.postgresql.org/download/macos/"
            fi
            ;;
    esac

    log_success "PostgreSQL installed"
}

# Install Redis
install_redis() {
    if command_exists redis-server; then
        log_info "Redis is already installed: $(redis-server --version)"
        return 0
    fi

    log_info "Installing Redis..."

    case $OS in
        "Ubuntu"*|"Debian"*)
            sudo apt-get install -y redis-server
            sudo systemctl enable redis-server
            sudo systemctl start redis-server
            ;;
        "CentOS"*|"Red Hat"*|"Fedora"*)
            if command_exists dnf; then
                sudo dnf install -y redis
            else
                sudo yum install -y redis
            fi
            sudo systemctl enable redis
            sudo systemctl start redis
            ;;
        "macOS")
            if command_exists brew; then
                brew install redis
                brew services start redis
            else
                log_warning "Please install Redis from https://redis.io/download"
            fi
            ;;
    esac

    log_success "Redis installed"
}

# Build the application
build_application() {
    log_info "Building Universal AI Tools..."

    # Build all services
    cargo build --release --workspace

    log_success "Application built successfully"
}

# Create systemd services
create_systemd_services() {
    if [[ "$OS" == "macOS" ]]; then
        log_info "Skipping systemd services on macOS"
        return 0
    fi

    log_info "Creating systemd services..."

    # Create service directory
    sudo mkdir -p /etc/systemd/system

    # LLM Router service
    sudo tee /etc/systemd/system/universal-ai-llm-router.service > /dev/null <<EOF
[Unit]
Description=Universal AI Tools - LLM Router
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/target/release/llm-router
Restart=always
RestartSec=5
Environment=LLM_ROUTER_PORT=3033
Environment=OLLAMA_URL=http://localhost:11434

[Install]
WantedBy=multi-user.target
EOF

    # Intelligent Librarian service
    sudo tee /etc/systemd/system/universal-ai-librarian.service > /dev/null <<EOF
[Unit]
Description=Universal AI Tools - Intelligent Librarian
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/target/release/intelligent-librarian
Restart=always
RestartSec=5
Environment=LIBRARIAN_PORT=8082
Environment=DATABASE_URL=postgresql://postgres:password@localhost:5432/universal_ai_tools

[Install]
WantedBy=multi-user.target
EOF

    # Assistant service
    sudo tee /etc/systemd/system/universal-ai-assistant.service > /dev/null <<EOF
[Unit]
Description=Universal AI Tools - Assistant
After=network.target postgresql.service redis.service universal-ai-llm-router.service universal-ai-librarian.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/target/release/assistantd
Restart=always
RestartSec=5
Environment=ASSISTANTD_PORT=8086
Environment=LLM_ROUTER_URL=http://localhost:3033
Environment=LIBRARIAN_URL=http://localhost:8082
Environment=DATABASE_URL=postgresql://postgres:password@localhost:5432/universal_ai_tools
Environment=REDIS_URL=redis://localhost:6379
Environment=RATE_LIMITING_ENABLED=true
Environment=AUTHENTICATION_ENABLED=false
Environment=CORS_ENABLED=true

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable services
    sudo systemctl daemon-reload
    sudo systemctl enable universal-ai-llm-router
    sudo systemctl enable universal-ai-librarian
    sudo systemctl enable universal-ai-assistant

    log_success "Systemd services created and enabled"
}

# Main installation function
main() {
    echo "🚀 Universal AI Tools - Installation Script"
    echo "=========================================="
    echo ""

    # Parse command line arguments
    INSTALL_DOCKER=false
    INSTALL_SYSTEMD=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --docker)
                INSTALL_DOCKER=true
                shift
                ;;
            --systemd)
                INSTALL_SYSTEMD=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--docker] [--systemd] [--help]"
                echo ""
                echo "Options:"
                echo "  --docker    Install Docker and Docker Compose"
                echo "  --systemd   Create systemd services for Linux"
                echo "  --help      Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Detect OS
    detect_os

    # Install dependencies
    install_dependencies
    install_rust
    install_postgresql
    install_redis

    # Optional installations
    if [ "$INSTALL_DOCKER" = true ]; then
        install_docker
        install_docker_compose
    fi

    # Build application
    build_application

    # Create systemd services
    if [ "$INSTALL_SYSTEMD" = true ]; then
        create_systemd_services
    fi

    echo ""
    log_success "Installation completed successfully!"
    echo ""
    echo "🎯 Next Steps:"
    echo "============="
    echo ""
    echo "1. Configure your environment:"
    echo "   cp env.example .env"
    echo "   # Edit .env with your settings"
    echo ""
    echo "2. Start the services:"
    if [ "$INSTALL_SYSTEMD" = true ]; then
        echo "   sudo systemctl start universal-ai-llm-router"
        echo "   sudo systemctl start universal-ai-librarian"
        echo "   sudo systemctl start universal-ai-assistant"
    else
        echo "   # Start services manually or use Docker Compose"
    fi
    echo ""
    if [ "$INSTALL_DOCKER" = true ]; then
        echo "3. Or use Docker Compose:"
        echo "   docker-compose up -d"
    fi
    echo ""
    echo "4. Test the installation:"
    echo "   curl http://localhost:8086/health"
    echo ""
    echo "📚 Documentation: https://github.com/your-repo/universal-ai-tools"
    echo "🐛 Issues: https://github.com/your-repo/universal-ai-tools/issues"
}

# Run main function
main "$@"

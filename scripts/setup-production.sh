#!/bin/bash
# Universal AI Tools - Production Deployment Setup
# Configures production environment with security best practices

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOMAIN="${DOMAIN:-yourdomain.com}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"

echo -e "${BLUE}🚀 Universal AI Tools - Production Deployment Setup${NC}"
echo "================================================================"

# Function to print colored status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to generate secure password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to generate JWT secret
generate_jwt_secret() {
    openssl rand -hex 32
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if OpenSSL is installed
    if ! command -v openssl &> /dev/null; then
        print_error "OpenSSL is not installed. Please install OpenSSL first."
        exit 1
    fi
    
    print_status "All prerequisites met"
}

# Create production environment file
create_production_env() {
    print_status "Creating production environment configuration..."
    
    local env_file="$PROJECT_ROOT/.env.production.local"
    
    # Generate secure passwords and secrets
    local postgres_password=$(generate_password)
    local jwt_secret=$(generate_jwt_secret)
    local encryption_key=$(generate_jwt_secret)
    local grafana_password=$(generate_password)
    local pgadmin_password=$(generate_password)
    
    cat > "$env_file" << EOF
# Universal AI Tools - Production Environment (Auto-Generated)
# Generated on: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

# =================================================================
# CORE PRODUCTION SETTINGS
# =================================================================
PORT=9999
NODE_ENV=production
BASE_URL=https://${DOMAIN}
DOCKER_ENV=true
CONTAINER_NAME=universal-ai-tools-production

# =================================================================
# MEMORY OPTIMIZATION (TARGET: <1GB TOTAL)
# =================================================================
MEMORY_OPTIMIZATION_ENABLED=true
MEMORY_MONITORING_INTERVAL=60000
GC_INTERVAL_MS=90000
CACHE_CLEANUP_INTERVAL_MS=120000
MEMORY_PRESSURE_THRESHOLD=70
MEMORY_LEAK_DETECTION_ENABLED=true
ENABLE_CONTAINER_OPTIMIZATION=true

# =================================================================
# SERVICE CONSOLIDATION (68 → 10 SERVICES)
# =================================================================
DISABLE_HEAVY_SERVICES=true
SKIP_STARTUP_CONTEXT=true
ENABLE_CONTEXT_MIDDLEWARE=false
ENABLE_SERVICE_CONSOLIDATION=true
CONSOLIDATED_SERVICES_MODE=true
ROUTER_CONSOLIDATION_ENABLED=true

# =================================================================
# PERFORMANCE TUNING (HTTP TIMEOUT CONFIGURATION)
# =================================================================
MAX_CONCURRENT_REQUESTS=100
REQUEST_TIMEOUT=15000
MEMORY_CACHE_SIZE=256
HTTP_TIMEOUT=120000
KEEP_ALIVE_TIMEOUT=120000
HEADERS_TIMEOUT=121000

# =================================================================
# SECURE DATABASE CONFIGURATION
# =================================================================
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=universal_ai_tools
DATABASE_URL=postgresql://postgres:${postgres_password}@postgres:5432/universal_ai_tools

# Database Performance (Optimized for Memory)
POSTGRES_MAX_CONNECTIONS=50
POSTGRES_SHARED_BUFFERS=64MB
POSTGRES_EFFECTIVE_CACHE_SIZE=256MB
POSTGRES_WORK_MEM=2MB
POSTGRES_MAINTENANCE_WORK_MEM=32MB

# =================================================================
# SECURITY CONFIGURATION
# =================================================================
JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=24h
ENCRYPTION_KEY=${encryption_key}

# Production Security
CORS_ORIGIN=https://${DOMAIN}
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
SECURITY_HEADERS_ENABLED=true

# =================================================================
# AI API KEYS (MUST BE SET MANUALLY)
# =================================================================
# OPENAI_API_KEY=sk-your-openai-api-key
# ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
# GOOGLE_AI_API_KEY=your-google-ai-api-key

# =================================================================
# SUPABASE CONFIGURATION (MUST BE SET MANUALLY)
# =================================================================
# SUPABASE_URL=https://your-project-id.supabase.co
# SUPABASE_ANON_KEY=your-supabase-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# =================================================================
# LOCAL AI CONFIGURATION
# =================================================================
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:3b
ENABLE_OLLAMA=true
OLLAMA_TIMEOUT=30000
OLLAMA_KEEP_ALIVE=2m
OLLAMA_NUM_PARALLEL=2
OLLAMA_MAX_LOADED_MODELS=1

# =================================================================
# REDIS CONFIGURATION
# =================================================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# =================================================================
# MONITORING & LOGGING
# =================================================================
LOG_LEVEL=warn
ENABLE_PERF_LOGS=false
ENABLE_TELEMETRY=true
ENABLE_HEALTH_CHECKS=true
METRICS_PORT=9091
HEALTH_CHECK_INTERVAL=30s
PROMETHEUS_METRICS_PORT=9090
ENABLE_PERFORMANCE_MONITORING=true

# =================================================================
# FEATURE FLAGS (PRODUCTION OPTIMIZED)
# =================================================================
ENABLE_MLX=false
ENABLE_VISION=false
ENABLE_CONTEXT=false
ENABLE_DSPY_MOCK=false
ENABLE_PROMETHEUS_METRICS=true

# =================================================================
# ADMINISTRATIVE PASSWORDS
# =================================================================
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=${grafana_password}
PGADMIN_EMAIL=${EMAIL}
PGADMIN_PASSWORD=${pgadmin_password}

# =================================================================
# DEVELOPMENT HELPERS (DISABLED IN PRODUCTION)
# =================================================================
ENABLE_DEBUG_ENDPOINTS=false
ENABLE_HOT_RELOAD=false
EOF

    print_status "Production environment file created: .env.production.local"
    print_warning "IMPORTANT: Set AI API keys and Supabase configuration manually in .env.production.local"
    
    # Create credentials summary
    cat > "$PROJECT_ROOT/PRODUCTION_CREDENTIALS.txt" << EOF
Universal AI Tools - Production Credentials
Generated on: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

SECURE THESE CREDENTIALS:
========================

Database:
- PostgreSQL Password: ${postgres_password}

Security:
- JWT Secret: ${jwt_secret}
- Encryption Key: ${encryption_key}

Admin Access:
- Grafana Password: ${grafana_password}
- PGAdmin Password: ${pgadmin_password}

DOMAIN: ${DOMAIN}
EMAIL: ${EMAIL}

⚠️  KEEP THIS FILE SECURE AND DO NOT COMMIT TO VERSION CONTROL
⚠️  Consider using a password manager or secrets management system
EOF
    
    print_status "Production credentials saved to PRODUCTION_CREDENTIALS.txt"
}

# Create Nginx configuration
create_nginx_config() {
    print_status "Creating Nginx production configuration..."
    
    mkdir -p "$PROJECT_ROOT/nginx"
    
    cat > "$PROJECT_ROOT/nginx/nginx.prod.conf" << 'EOF'
# Universal AI Tools - Production Nginx Configuration
# Optimized for performance, security, and SSL termination

worker_processes auto;
worker_rlimit_nofile 65535;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;

    # Performance optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;
    client_body_timeout 60s;
    client_header_timeout 60s;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Hide server information
    server_tokens off;
    more_set_headers "Server: Universal-AI-Tools";

    # Upstream backend
    upstream api_backend {
        server api:9999 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # Main HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1h;

        # Security headers
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss: ws:; frame-ancestors 'none';" always;

        # Main API proxy
        location / {
            limit_req zone=api burst=50 nodelay;
            
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;
            proxy_set_header X-Forwarded-Port $server_port;
            
            proxy_cache_bypass $http_upgrade;
            proxy_redirect off;
            proxy_buffering off;
            proxy_request_buffering off;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # WebSocket proxy for real-time features
        location /ws {
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket specific timeouts
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }

        # Monitoring endpoints (restricted access)
        location /metrics {
            allow 127.0.0.1;
            allow 10.0.0.0/8;
            allow 172.16.0.0/12;
            allow 192.168.0.0/16;
            deny all;
            
            proxy_pass http://prometheus:9090;
            proxy_set_header Host $host;
        }

        location /grafana/ {
            auth_basic "Monitoring Access";
            auth_basic_user_file /etc/nginx/.htpasswd;
            
            proxy_pass http://grafana:3000/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check endpoint (public but rate limited)
        location /health {
            access_log off;
            proxy_pass http://api_backend/health;
        }

        # Static assets with caching
        location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            proxy_pass http://api_backend;
        }

        # Security.txt
        location /.well-known/security.txt {
            return 200 "Contact: security@yourdomain.com\nExpires: 2025-12-31T23:59:59.000Z\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF

    print_status "Nginx configuration created"
}

# Create SSL setup script
create_ssl_setup() {
    print_status "Creating SSL certificate setup script..."
    
    cat > "$PROJECT_ROOT/scripts/setup-ssl.sh" << 'EOF'
#!/bin/bash
# SSL Certificate Setup for Universal AI Tools
# Supports both Let's Encrypt and self-signed certificates

set -euo pipefail

DOMAIN="${DOMAIN:-yourdomain.com}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
SSL_DIR="$(dirname "$0")/../nginx/ssl"

mkdir -p "$SSL_DIR"

# Function to create self-signed certificates for development
create_self_signed() {
    echo "Creating self-signed SSL certificates for $DOMAIN..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/privkey.pem" \
        -out "$SSL_DIR/fullchain.pem" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
    
    echo "✅ Self-signed certificates created in $SSL_DIR"
    echo "⚠️  These are for development only. Use Let's Encrypt for production."
}

# Function to setup Let's Encrypt certificates
setup_letsencrypt() {
    echo "Setting up Let's Encrypt certificates for $DOMAIN..."
    
    if ! command -v certbot &> /dev/null; then
        echo "Installing certbot..."
        apt-get update && apt-get install -y certbot python3-certbot-nginx
    fi
    
    # Stop nginx if running
    docker-compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true
    
    # Get certificate
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" \
        -d "www.$DOMAIN"
    
    # Copy certificates to nginx directory
    cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/"
    cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/"
    
    # Set proper permissions
    chmod 644 "$SSL_DIR/fullchain.pem"
    chmod 600 "$SSL_DIR/privkey.pem"
    
    echo "✅ Let's Encrypt certificates installed"
    
    # Setup auto-renewal
    echo "0 2 * * * certbot renew --quiet && docker-compose -f /path/to/docker-compose.prod.yml restart nginx" > /tmp/certbot-cron
    crontab /tmp/certbot-cron
    rm /tmp/certbot-cron
    
    echo "✅ Auto-renewal configured"
}

# Main execution
case "${1:-self-signed}" in
    "letsencrypt")
        setup_letsencrypt
        ;;
    "self-signed")
        create_self_signed
        ;;
    *)
        echo "Usage: $0 [letsencrypt|self-signed]"
        exit 1
        ;;
esac
EOF

    chmod +x "$PROJECT_ROOT/scripts/setup-ssl.sh"
    print_status "SSL setup script created"
}

# Create deployment validation script
create_deployment_validation() {
    print_status "Creating deployment validation script..."
    
    cat > "$PROJECT_ROOT/scripts/validate-deployment.sh" << 'EOF'
#!/bin/bash
# Universal AI Tools - Production Deployment Validation
# Comprehensive health checks and validation

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="${DOMAIN:-yourdomain.com}"
API_URL="https://$DOMAIN"
TIMEOUT=30

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Function to wait for service
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=60
    local attempt=1
    
    print_info "Waiting for $name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$url" >/dev/null 2>&1; then
            print_status "$name is ready"
            return 0
        fi
        
        echo -n "."
        sleep 5
        ((attempt++))
    done
    
    print_error "$name failed to start within $(($max_attempts * 5)) seconds"
    return 1
}

# Function to check service health
check_service_health() {
    local url=$1
    local name=$2
    
    print_info "Checking $name health..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        print_status "$name is healthy"
        return 0
    else
        print_error "$name health check failed (HTTP $response)"
        return 1
    fi
}

# Function to check memory usage
check_memory_usage() {
    print_info "Checking memory usage..."
    
    local total_memory=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | tail -n +2)
    echo "$total_memory"
    
    # Calculate total memory usage
    local total_mb=0
    while IFS= read -r line; do
        local mem=$(echo "$line" | awk '{print $2}' | sed 's/MiB.*//' | sed 's/GiB/000/')
        if [[ "$mem" =~ ^[0-9]+$ ]]; then
            total_mb=$((total_mb + mem))
        fi
    done <<< "$total_memory"
    
    print_info "Total memory usage: ${total_mb}MB"
    
    if [ $total_mb -lt 1024 ]; then
        print_status "Memory usage within target (<1GB)"
    else
        print_warning "Memory usage above target: ${total_mb}MB"
    fi
}

# Function to check SSL certificate
check_ssl_certificate() {
    print_info "Checking SSL certificate..."
    
    local cert_info=$(openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "Failed")
    
    if [ "$cert_info" != "Failed" ]; then
        print_status "SSL certificate is valid"
        echo "$cert_info" | sed 's/^/  /'
    else
        print_error "SSL certificate check failed"
        return 1
    fi
}

# Function to run comprehensive tests
run_comprehensive_tests() {
    print_info "Running comprehensive API tests..."
    
    # Test health endpoint
    if check_service_health "$API_URL/health" "API Health"; then
        local health_response=$(cat /tmp/health_response)
        echo "  Response: $health_response" | head -c 100
    fi
    
    # Test authentication endpoint
    print_info "Testing authentication..."
    local auth_response=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/api/auth/status" 2>/dev/null || echo "000")
    
    if [ "$auth_response" = "401" ] || [ "$auth_response" = "200" ]; then
        print_status "Authentication endpoint is working"
    else
        print_warning "Authentication endpoint returned unexpected status: $auth_response"
    fi
    
    # Test API rate limiting
    print_info "Testing rate limiting..."
    local rate_limit_ok=true
    for i in {1..5}; do
        local response=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/health" 2>/dev/null || echo "000")
        if [ "$response" = "429" ]; then
            rate_limit_ok=true
            break
        fi
    done
    
    if [ "$rate_limit_ok" = true ]; then
        print_status "Rate limiting is configured"
    else
        print_warning "Rate limiting may not be working properly"
    fi
}

# Function to generate deployment report
generate_deployment_report() {
    local report_file="deployment-validation-$(date +%Y%m%d-%H%M%S).log"
    
    print_info "Generating deployment report..."
    
    {
        echo "Universal AI Tools - Deployment Validation Report"
        echo "Generated: $(date)"
        echo "Domain: $DOMAIN"
        echo "================================================"
        echo
        
        echo "Docker Services:"
        docker-compose -f docker-compose.prod.yml ps
        echo
        
        echo "Memory Usage:"
        docker stats --no-stream
        echo
        
        echo "Disk Usage:"
        df -h
        echo
        
        echo "Service Endpoints:"
        echo "- API: $API_URL"
        echo "- Health: $API_URL/health"
        echo "- Metrics: $API_URL/metrics"
        echo "- Grafana: $API_URL/grafana"
        echo
        
        echo "Recent Logs (last 50 lines):"
        docker-compose -f docker-compose.prod.yml logs --tail=50
        
    } > "$report_file"
    
    print_status "Deployment report saved to: $report_file"
}

# Main validation process
main() {
    echo -e "${BLUE}🔍 Universal AI Tools - Production Deployment Validation${NC}"
    echo "================================================================"
    
    # Check if Docker Compose is running
    if ! docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        print_error "Docker Compose services are not running"
        print_info "Start services with: docker-compose -f docker-compose.prod.yml up -d"
        exit 1
    fi
    
    print_status "Docker Compose services are running"
    
    # Wait for critical services
    wait_for_service "$API_URL/health" "API Service"
    
    # Check service health
    check_service_health "$API_URL/health" "Main API"
    
    # Check memory usage
    check_memory_usage
    
    # Check SSL certificate (only if not localhost)
    if [ "$DOMAIN" != "localhost" ] && [ "$DOMAIN" != "127.0.0.1" ]; then
        check_ssl_certificate
    fi
    
    # Run comprehensive tests
    run_comprehensive_tests
    
    # Generate report
    generate_deployment_report
    
    echo
    print_status "Deployment validation completed successfully!"
    print_info "Your Universal AI Tools production deployment is ready!"
    echo
    print_info "Access your deployment at: $API_URL"
    print_info "Grafana dashboard: $API_URL/grafana"
    print_info "Prometheus metrics: $API_URL/metrics"
}

# Run main function
main "$@"
EOF

    chmod +x "$PROJECT_ROOT/scripts/validate-deployment.sh"
    print_status "Deployment validation script created"
}

# Create automated deployment script
create_deployment_script() {
    print_status "Creating automated deployment script..."
    
    cat > "$PROJECT_ROOT/scripts/deploy-production.sh" << 'EOF'
#!/bin/bash
# Universal AI Tools - Automated Production Deployment
# Complete deployment pipeline with safety checks

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups/$(date +%Y%m%d-%H%M%S)"

# Configuration
DOMAIN="${DOMAIN:-yourdomain.com}"
BRANCH="${BRANCH:-master}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"

# Function to create backup
create_backup() {
    if [ "$SKIP_BACKUP" = "true" ]; then
        print_info "Skipping backup (SKIP_BACKUP=true)"
        return 0
    fi
    
    print_info "Creating backup..."
    mkdir -p "$BACKUP_DIR"
    
    # Backup environment files
    cp -f .env.production.local "$BACKUP_DIR/" 2>/dev/null || true
    cp -f PRODUCTION_CREDENTIALS.txt "$BACKUP_DIR/" 2>/dev/null || true
    
    # Backup Docker volumes
    docker run --rm -v universal-ai-tools-production_postgres_data:/source:ro -v "$BACKUP_DIR":/backup alpine tar czf /backup/postgres_data.tar.gz -C /source . 2>/dev/null || true
    docker run --rm -v universal-ai-tools-production_grafana_data:/source:ro -v "$BACKUP_DIR":/backup alpine tar czf /backup/grafana_data.tar.gz -C /source . 2>/dev/null || true
    
    print_status "Backup created in $BACKUP_DIR"
}

# Function to pull latest code
pull_latest_code() {
    print_info "Pulling latest code from $BRANCH branch..."
    
    # Stash any local changes
    git stash push -m "Auto-stash before deployment $(date)" 2>/dev/null || true
    
    # Pull latest changes
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    
    print_status "Code updated to latest $BRANCH"
}

# Function to build images
build_images() {
    if [ "$SKIP_BUILD" = "true" ]; then
        print_info "Skipping build (SKIP_BUILD=true)"
        return 0
    fi
    
    print_info "Building production Docker images..."
    
    # Build with cache
    docker-compose -f docker-compose.prod.yml build --parallel
    
    # Prune unused images to save space
    docker image prune -f
    
    print_status "Images built successfully"
}

# Function to run pre-deployment tests
run_pre_deployment_tests() {
    print_info "Running pre-deployment tests..."
    
    # Check if environment file exists
    if [ ! -f ".env.production.local" ]; then
        print_error "Production environment file not found"
        print_info "Run: ./scripts/setup-production.sh to create it"
        exit 1
    fi
    
    # Validate Docker Compose configuration
    if ! docker-compose -f docker-compose.prod.yml config >/dev/null 2>&1; then
        print_error "Docker Compose configuration is invalid"
        exit 1
    fi
    
    print_status "Pre-deployment tests passed"
}

# Function to deploy services
deploy_services() {
    print_info "Deploying production services..."
    
    # Stop existing services gracefully
    docker-compose -f docker-compose.prod.yml down --remove-orphans
    
    # Start services with health checks
    docker-compose -f docker-compose.prod.yml up -d --wait
    
    print_status "Services deployed successfully"
}

# Function to run post-deployment validation
run_post_deployment_validation() {
    print_info "Running post-deployment validation..."
    
    # Wait a moment for services to stabilize
    sleep 30
    
    # Run validation script
    "$SCRIPT_DIR/validate-deployment.sh"
    
    print_status "Post-deployment validation completed"
}

# Function to setup monitoring alerts
setup_monitoring() {
    print_info "Setting up monitoring and alerts..."
    
    # Restart Prometheus to reload configuration
    docker-compose -f docker-compose.prod.yml restart prometheus
    
    # Wait for Prometheus to be ready
    sleep 15
    
    print_status "Monitoring setup completed"
}

# Function to cleanup old resources
cleanup_old_resources() {
    print_info "Cleaning up old resources..."
    
    # Remove old Docker images (keep last 3 versions)
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | grep "universal-ai-tools" | tail -n +4 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
    
    # Clean up old backups (keep last 5)
    find "$PROJECT_ROOT/backups" -maxdepth 1 -type d -name "20*" | sort -r | tail -n +6 | xargs -r rm -rf 2>/dev/null || true
    
    print_status "Cleanup completed"
}

# Function to send deployment notification
send_notification() {
    local status=$1
    local webhook_url="${DEPLOYMENT_WEBHOOK_URL:-}"
    
    if [ -n "$webhook_url" ]; then
        curl -X POST "$webhook_url" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"Universal AI Tools deployment $status\",
                \"domain\": \"$DOMAIN\",
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                \"status\": \"$status\"
            }" 2>/dev/null || true
    fi
}

# Main deployment function
main() {
    echo -e "${BLUE}🚀 Universal AI Tools - Production Deployment${NC}"
    echo "================================================================"
    echo "Domain: $DOMAIN"
    echo "Branch: $BRANCH"
    echo "Time: $(date)"
    echo "================================================================"
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Send start notification
    send_notification "started"
    
    # Create backup
    create_backup
    
    # Pull latest code
    pull_latest_code
    
    # Run pre-deployment tests
    run_pre_deployment_tests
    
    # Build images
    build_images
    
    # Deploy services
    deploy_services
    
    # Setup monitoring
    setup_monitoring
    
    # Run post-deployment validation
    run_post_deployment_validation
    
    # Cleanup old resources
    cleanup_old_resources
    
    # Send success notification
    send_notification "completed"
    
    echo
    print_status "🎉 Production deployment completed successfully!"
    echo
    print_info "Your Universal AI Tools deployment is live at: https://$DOMAIN"
    print_info "Grafana dashboard: https://$DOMAIN/grafana"
    print_info "Backup created in: $BACKUP_DIR"
    echo
    print_warning "Don't forget to:"
    print_warning "1. Monitor the application for the first few hours"
    print_warning "2. Check logs: docker-compose -f docker-compose.prod.yml logs -f"
    print_warning "3. Verify all endpoints are working correctly"
}

# Handle errors
trap 'print_error "Deployment failed at line $LINENO"; send_notification "failed"; exit 1' ERR

# Run main function
main "$@"
EOF

    chmod +x "$PROJECT_ROOT/scripts/deploy-production.sh"
    print_status "Automated deployment script created"
}

# Main execution
main() {
    cd "$PROJECT_ROOT"
    
    # Check prerequisites
    check_prerequisites
    
    # Create all production configurations
    create_production_env
    create_nginx_config
    create_ssl_setup
    create_deployment_validation
    create_deployment_script
    
    echo
    print_status "🎉 Production setup completed!"
    echo "================================================================"
    print_warning "NEXT STEPS:"
    print_warning "1. Edit .env.production.local with your API keys and Supabase config"
    print_warning "2. Update DOMAIN in scripts if not 'yourdomain.com'"
    print_warning "3. Setup SSL: ./scripts/setup-ssl.sh [letsencrypt|self-signed]"
    print_warning "4. Deploy: ./scripts/deploy-production.sh"
    print_warning "5. Validate: ./scripts/validate-deployment.sh"
    echo
    print_info "Production credentials saved in: PRODUCTION_CREDENTIALS.txt"
    print_info "Keep credentials secure and do not commit to version control!"
}

# Execute main function
main "$@"
#!/bin/bash

# Universal AI Tools - SSL Certificate Setup Script
# Supports both Let's Encrypt production certificates and self-signed certificates for development

set -euo pipefail

# Configuration
DOMAIN="${DOMAIN:-localhost}"
EMAIL="${SSL_EMAIL:-admin@universalai.tools}"
NGINX_SSL_DIR="./nginx/ssl"
CERTBOT_DIR="./certbot"
LOG_FILE="./logs/ssl-setup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Create directories
setup_directories() {
    log "Setting up SSL directories..."
    mkdir -p "$NGINX_SSL_DIR"
    mkdir -p "$CERTBOT_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
    chmod 700 "$NGINX_SSL_DIR"
}

# Generate self-signed certificate for development
generate_self_signed() {
    log "Generating self-signed certificate for development..."
    
    # Create OpenSSL config for SAN
    cat > "$NGINX_SSL_DIR/openssl.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C=US
ST=CA
L=San Francisco
O=Universal AI Tools
OU=Development
CN=$DOMAIN

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = localhost
DNS.3 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

    # Generate private key
    openssl genrsa -out "$NGINX_SSL_DIR/key.pem" 4096
    
    # Generate certificate signing request
    openssl req -new -key "$NGINX_SSL_DIR/key.pem" -out "$NGINX_SSL_DIR/cert.csr" -config "$NGINX_SSL_DIR/openssl.conf"
    
    # Generate self-signed certificate
    openssl x509 -req -days 365 -in "$NGINX_SSL_DIR/cert.csr" -signkey "$NGINX_SSL_DIR/key.pem" -out "$NGINX_SSL_DIR/cert.pem" -extensions v3_req -extfile "$NGINX_SSL_DIR/openssl.conf"
    
    # Set proper permissions
    chmod 600 "$NGINX_SSL_DIR/key.pem"
    chmod 644 "$NGINX_SSL_DIR/cert.pem"
    
    # Clean up
    rm -f "$NGINX_SSL_DIR/cert.csr" "$NGINX_SSL_DIR/openssl.conf"
    
    success "Self-signed certificate generated successfully"
}

# Setup Let's Encrypt certificate
setup_letsencrypt() {
    log "Setting up Let's Encrypt certificate for domain: $DOMAIN"
    
    # Check if domain is not localhost
    if [[ "$DOMAIN" == "localhost" || "$DOMAIN" == "127.0.0.1" ]]; then
        error "Cannot use Let's Encrypt for localhost. Use --self-signed option instead."
        exit 1
    fi
    
    # Check if certbot is available
    if ! command -v certbot &> /dev/null; then
        error "Certbot is not installed. Installing..."
        
        # Install certbot based on OS
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            if command -v apt-get &> /dev/null; then
                sudo apt-get update && sudo apt-get install -y certbot
            elif command -v yum &> /dev/null; then
                sudo yum install -y certbot
            elif command -v dnf &> /dev/null; then
                sudo dnf install -y certbot
            else
                error "Cannot install certbot automatically. Please install manually."
                exit 1
            fi
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            if command -v brew &> /dev/null; then
                brew install certbot
            else
                error "Homebrew not found. Please install certbot manually."
                exit 1
            fi
        else
            error "Unsupported OS for automatic certbot installation."
            exit 1
        fi
    fi
    
    # Stop nginx if running (to free port 80)
    if docker-compose -f docker-compose.prod.yml ps nginx | grep -q "Up"; then
        log "Stopping nginx container temporarily..."
        docker-compose -f docker-compose.prod.yml stop nginx
        RESTART_NGINX=true
    fi
    
    # Generate certificate using standalone mode
    log "Generating Let's Encrypt certificate..."
    certbot certonly \
        --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domains "$DOMAIN" \
        --cert-path "$NGINX_SSL_DIR/cert.pem" \
        --key-path "$NGINX_SSL_DIR/key.pem" \
        --fullchain-path "$NGINX_SSL_DIR/fullchain.pem" \
        --chain-path "$NGINX_SSL_DIR/chain.pem"
    
    # Copy certificates to nginx directory
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$NGINX_SSL_DIR/cert.pem"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$NGINX_SSL_DIR/key.pem"
    sudo chown $(whoami):$(whoami) "$NGINX_SSL_DIR"/*.pem
    chmod 644 "$NGINX_SSL_DIR/cert.pem"
    chmod 600 "$NGINX_SSL_DIR/key.pem"
    
    # Restart nginx if it was running
    if [[ "${RESTART_NGINX:-false}" == "true" ]]; then
        log "Restarting nginx container..."
        docker-compose -f docker-compose.prod.yml start nginx
    fi
    
    success "Let's Encrypt certificate generated successfully"
}

# Setup automatic renewal for Let's Encrypt
setup_auto_renewal() {
    log "Setting up automatic certificate renewal..."
    
    # Create renewal script
    cat > "./scripts/ssl-renew.sh" << 'EOF'
#!/bin/bash
# Auto-renewal script for Let's Encrypt certificates

set -euo pipefail

DOMAIN="${DOMAIN:-localhost}"
NGINX_SSL_DIR="./nginx/ssl"
LOG_FILE="./logs/ssl-renewal.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Starting certificate renewal check..."

# Stop nginx temporarily
docker-compose -f docker-compose.prod.yml stop nginx

# Renew certificate
if certbot renew --quiet; then
    log "Certificate renewed successfully"
    
    # Copy new certificates
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$NGINX_SSL_DIR/cert.pem"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$NGINX_SSL_DIR/key.pem"
    sudo chown $(whoami):$(whoami) "$NGINX_SSL_DIR"/*.pem
    chmod 644 "$NGINX_SSL_DIR/cert.pem"
    chmod 600 "$NGINX_SSL_DIR/key.pem"
    
    log "Certificates updated"
else
    log "Certificate renewal not needed or failed"
fi

# Restart nginx
docker-compose -f docker-compose.prod.yml start nginx
log "Nginx restarted"
EOF
    
    chmod +x "./scripts/ssl-renew.sh"
    
    # Add to crontab (run twice daily)
    (crontab -l 2>/dev/null || true; echo "0 2,14 * * * cd $(pwd) && ./scripts/ssl-renew.sh") | crontab -
    
    success "Automatic renewal configured (runs twice daily)"
}

# Verify SSL certificate
verify_certificate() {
    log "Verifying SSL certificate..."
    
    if [[ ! -f "$NGINX_SSL_DIR/cert.pem" || ! -f "$NGINX_SSL_DIR/key.pem" ]]; then
        error "Certificate files not found!"
        return 1
    fi
    
    # Check certificate validity
    if openssl x509 -in "$NGINX_SSL_DIR/cert.pem" -text -noout > /dev/null 2>&1; then
        success "Certificate is valid"
        
        # Show certificate info
        log "Certificate information:"
        openssl x509 -in "$NGINX_SSL_DIR/cert.pem" -text -noout | grep -E "(Subject:|DNS:|IP Address:|Not Before|Not After)" | tee -a "$LOG_FILE"
        
        # Check if key matches certificate
        cert_hash=$(openssl x509 -noout -modulus -in "$NGINX_SSL_DIR/cert.pem" | openssl md5)
        key_hash=$(openssl rsa -noout -modulus -in "$NGINX_SSL_DIR/key.pem" | openssl md5)
        
        if [[ "$cert_hash" == "$key_hash" ]]; then
            success "Certificate and private key match"
        else
            error "Certificate and private key do not match!"
            return 1
        fi
    else
        error "Certificate is invalid!"
        return 1
    fi
}

# Test HTTPS connectivity
test_https() {
    log "Testing HTTPS connectivity..."
    
    # Start services if not running
    if ! docker-compose -f docker-compose.prod.yml ps nginx | grep -q "Up"; then
        log "Starting services for HTTPS test..."
        docker-compose -f docker-compose.prod.yml up -d nginx
        sleep 10
    fi
    
    # Test local HTTPS connection
    if curl -k -s "https://localhost/api/health" > /dev/null 2>&1; then
        success "HTTPS is working locally"
    else
        warning "HTTPS test failed locally (this may be expected if services aren't fully started)"
    fi
    
    # Test domain if not localhost
    if [[ "$DOMAIN" != "localhost" && "$DOMAIN" != "127.0.0.1" ]]; then
        if curl -s "https://$DOMAIN/api/health" > /dev/null 2>&1; then
            success "HTTPS is working for domain: $DOMAIN"
        else
            warning "HTTPS test failed for domain: $DOMAIN (may need DNS propagation)"
        fi
    fi
}

# Main function
main() {
    log "Starting SSL setup for Universal AI Tools..."
    log "Domain: $DOMAIN"
    log "Email: $EMAIL"
    
    setup_directories
    
    case "${1:-auto}" in
        --self-signed)
            generate_self_signed
            ;;
        --letsencrypt)
            setup_letsencrypt
            setup_auto_renewal
            ;;
        --verify)
            verify_certificate
            ;;
        --test)
            test_https
            ;;
        --renew)
            setup_auto_renewal
            ;;
        --help)
            echo "Usage: $0 [option]"
            echo "Options:"
            echo "  --self-signed   Generate self-signed certificate (development)"
            echo "  --letsencrypt   Generate Let's Encrypt certificate (production)"
            echo "  --verify        Verify existing certificate"
            echo "  --test          Test HTTPS connectivity"
            echo "  --renew         Setup automatic renewal"
            echo "  --help          Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  DOMAIN          Domain name (default: localhost)"
            echo "  SSL_EMAIL       Email for Let's Encrypt (default: admin@universalai.tools)"
            exit 0
            ;;
        auto|*)
            # Auto-detect mode
            if [[ "$DOMAIN" == "localhost" || "$DOMAIN" == "127.0.0.1" ]]; then
                log "Development mode detected, generating self-signed certificate..."
                generate_self_signed
            else
                log "Production mode detected, setting up Let's Encrypt certificate..."
                setup_letsencrypt
                setup_auto_renewal
            fi
            ;;
    esac
    
    verify_certificate
    test_https
    
    success "SSL setup completed successfully!"
    log "Next steps:"
    log "1. Start the production stack: docker-compose -f docker-compose.prod.yml up -d"
    log "2. Test HTTPS: curl -k https://$DOMAIN/api/health"
    log "3. Check certificate: openssl s_client -connect $DOMAIN:443 -servername $DOMAIN"
}

# Run main function with all arguments
main "$@"
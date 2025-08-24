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

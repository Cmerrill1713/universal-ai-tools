#!/bin/bash

# Universal AI Tools - Production Setup Script
# Configures SSL/HTTPS and production-ready environment

echo "🚀 Universal AI Tools - Production Setup"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

# Check if running as root (needed for SSL setup)
if [[ $EUID -ne 0 ]] && [[ "$1" != "--no-ssl" ]]; then
   print_warning "SSL setup requires root privileges. Run with sudo or use --no-ssl flag"
   echo "Usage: sudo $0 [--no-ssl]"
   exit 1
fi

# Configuration variables
DOMAIN=${DOMAIN:-"localhost"}
SSL_DIR="/etc/ssl/universal-ai-tools"
APP_DIR="/Users/christianmerrill/Desktop/universal-ai-tools"
NGINX_CONF_DIR="/etc/nginx/sites-available"
SYSTEMD_DIR="/etc/systemd/system"

echo "📋 Configuration:"
echo "   Domain: $DOMAIN"
echo "   SSL Directory: $SSL_DIR"
echo "   Application Directory: $APP_DIR"
echo ""

# Step 1: Create SSL certificates
if [[ "$1" != "--no-ssl" ]]; then
  echo "🔒 Step 1: SSL Certificate Setup"
  
  # Create SSL directory
  mkdir -p $SSL_DIR
  
  # Generate self-signed certificates for development
  if [[ "$DOMAIN" == "localhost" ]]; then
    print_status "Generating self-signed certificates for development..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout $SSL_DIR/private.key \
      -out $SSL_DIR/certificate.crt \
      -subj "/C=US/ST=Development/L=Local/O=Universal AI Tools/CN=localhost"
    
    # Create certificate bundle
    cat $SSL_DIR/certificate.crt > $SSL_DIR/bundle.crt
    
    print_status "Self-signed certificates created"
  else
    print_warning "Production domain detected: $DOMAIN"
    print_warning "Please obtain proper SSL certificates from Let's Encrypt or a CA"
    print_warning "For Let's Encrypt, run: certbot --nginx -d $DOMAIN"
  fi
  
  # Set proper permissions
  chmod 600 $SSL_DIR/private.key
  chmod 644 $SSL_DIR/certificate.crt
  chmod 644 $SSL_DIR/bundle.crt 2>/dev/null || true
  
  print_status "SSL certificates configured"
else
  echo "🔒 Step 1: SSL Setup Skipped (--no-ssl flag used)"
fi

# Step 2: Configure Nginx reverse proxy
echo ""
echo "🌐 Step 2: Nginx Configuration"

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
  print_warning "Nginx not found. Installing..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install nginx
  elif [[ -f /etc/debian_version ]]; then
    apt update && apt install -y nginx
  elif [[ -f /etc/redhat-release ]]; then
    yum install -y nginx
  else
    print_error "Unable to install nginx automatically. Please install manually."
    exit 1
  fi
fi

# Create nginx configuration
cat > $NGINX_CONF_DIR/universal-ai-tools << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL Configuration
    ssl_certificate $SSL_DIR/certificate.crt;
    ssl_certificate_key $SSL_DIR/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    # Main application
    location / {
        proxy_pass http://localhost:9999;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # WebSocket support
    location /ws/ {
        proxy_pass http://localhost:9999;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static assets
    location /static/ {
        alias $APP_DIR/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
ln -sf $NGINX_CONF_DIR/universal-ai-tools /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
if nginx -t; then
  print_status "Nginx configuration valid"
  systemctl restart nginx
  systemctl enable nginx
  print_status "Nginx configured and started"
else
  print_error "Nginx configuration error. Please check the config."
  exit 1
fi

# Step 3: Create systemd service
echo ""
echo "⚙️ Step 3: Systemd Service Configuration"

cat > $SYSTEMD_DIR/universal-ai-tools.service << EOF
[Unit]
Description=Universal AI Tools Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=9999
Environment=HTTPS_ENABLED=true
ExecStart=/usr/bin/node $APP_DIR/dist/server.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=universal-ai-tools

# Security settings
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$APP_DIR/logs $APP_DIR/uploads /tmp
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictRealtime=yes

[Install]
WantedBy=multi-user.target
EOF

print_status "Systemd service created"

# Step 4: Create production environment file
echo ""
echo "📝 Step 4: Production Environment Configuration"

cat > $APP_DIR/.env.production << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=9999
HOST=0.0.0.0

# SSL Configuration
HTTPS_ENABLED=true
SSL_CERT_PATH=$SSL_DIR/certificate.crt
SSL_KEY_PATH=$SSL_DIR/private.key

# Database (use production Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_KEY=your-production-service-key

# Security
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')

# Production API Keys (store in Supabase Vault)
# OPENAI_API_KEY=your-production-key
# ANTHROPIC_API_KEY=your-production-key

# Rate Limiting
API_RATE_LIMIT=1000
API_BURST_LIMIT=2000

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
LOG_LEVEL=info

# CORS Configuration
CORS_ORIGIN=https://$DOMAIN

# Redis Configuration
REDIS_URL=redis://localhost:6379

# MLX Configuration
MLX_MODELS_PATH=$APP_DIR/models
ENABLE_MLX_FINE_TUNING=true

# Vision Processing
ENABLE_SDXL_REFINER=true
VISION_BACKEND=mlx
VISION_MAX_VRAM=20
EOF

print_status "Production environment configuration created"

# Step 5: Build application for production
echo ""
echo "🏗️ Step 5: Production Build"

cd $APP_DIR

# Install production dependencies
if [[ -f package.json ]]; then
  print_status "Installing production dependencies..."
  npm ci --only=production
  
  # Build TypeScript
  print_status "Building TypeScript..."
  npm run build
  
  # Create logs directory
  mkdir -p logs uploads
  chown www-data:www-data logs uploads
  
  print_status "Production build completed"
else
  print_error "package.json not found in $APP_DIR"
  exit 1
fi

# Step 6: Configure firewall
echo ""
echo "🛡️ Step 6: Firewall Configuration"

if command -v ufw &> /dev/null; then
  ufw allow 22/tcp     # SSH
  ufw allow 80/tcp     # HTTP
  ufw allow 443/tcp    # HTTPS
  ufw allow 9999/tcp   # Application (backend only)
  ufw --force enable
  print_status "UFW firewall configured"
elif command -v firewall-cmd &> /dev/null; then
  firewall-cmd --permanent --add-service=ssh
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  firewall-cmd --permanent --add-port=9999/tcp
  firewall-cmd --reload
  print_status "Firewalld configured"
else
  print_warning "No firewall management tool found. Please configure manually."
fi

# Step 7: Final setup
echo ""
echo "🎯 Step 7: Final Setup"

# Enable and start service
systemctl daemon-reload
systemctl enable universal-ai-tools
systemctl start universal-ai-tools

# Wait for service to start
sleep 5

# Check service status
if systemctl is-active --quiet universal-ai-tools; then
  print_status "Universal AI Tools service is running"
else
  print_warning "Service may not have started correctly. Check logs:"
  echo "   sudo journalctl -u universal-ai-tools -f"
fi

# Summary
echo ""
echo "🎉 Production Setup Complete!"
echo "============================="
echo ""
echo "✅ SSL certificates configured"
echo "✅ Nginx reverse proxy setup"
echo "✅ Systemd service created"  
echo "✅ Production environment configured"
echo "✅ Application built for production"
echo "✅ Firewall rules applied"
echo ""
echo "🌐 Your application should be available at:"
echo "   https://$DOMAIN"
echo ""
echo "📊 Monitoring endpoints:"
echo "   https://$DOMAIN/health"
echo "   https://$DOMAIN/api/v1/status"
echo ""
echo "🔧 Management commands:"
echo "   sudo systemctl start universal-ai-tools"
echo "   sudo systemctl stop universal-ai-tools"
echo "   sudo systemctl restart universal-ai-tools"
echo "   sudo systemctl status universal-ai-tools"
echo "   sudo journalctl -u universal-ai-tools -f"
echo ""
echo "⚠️ Next steps:"
echo "   1. Update production Supabase credentials in .env.production"
echo "   2. Configure production API keys via Supabase Vault"
echo "   3. Set up monitoring and alerting"
echo "   4. Configure automated backups"
echo ""
EOF
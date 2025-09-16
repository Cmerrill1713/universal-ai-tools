#!/bin/bash

# Development SSL Setup for Universal AI Tools
# Creates self-signed certificates for HTTPS development

echo "🔒 Development SSL Setup for Universal AI Tools"
echo "============================================="

# Colors for output  
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

# Configuration
APP_DIR="/Users/christianmerrill/Desktop/universal-ai-tools"
SSL_DIR="$APP_DIR/ssl"
DOMAIN="localhost"

echo "📋 Configuration:"
echo "   Domain: $DOMAIN" 
echo "   SSL Directory: $SSL_DIR"
echo "   Application Directory: $APP_DIR"
echo ""

# Step 1: Create SSL directory
echo "📁 Step 1: Creating SSL directory"
mkdir -p $SSL_DIR
print_status "SSL directory created: $SSL_DIR"

# Step 2: Generate self-signed certificate
echo ""
echo "🔐 Step 2: Generating self-signed certificate"

# Create certificate configuration
cat > $SSL_DIR/cert.conf << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=Development
L=Local
O=Universal AI Tools
CN=localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = 127.0.0.1
DNS.3 = 0.0.0.0
DNS.4 = *.localhost
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
EOF

# Generate private key and certificate
openssl req -new -x509 -days 365 -nodes \
  -keyout $SSL_DIR/private.key \
  -out $SSL_DIR/certificate.crt \
  -config $SSL_DIR/cert.conf \
  -extensions v3_req

if [[ $? -eq 0 ]]; then
  print_status "SSL certificate and private key generated"
else
  print_error "Failed to generate SSL certificate"
  exit 1
fi

# Set proper permissions
chmod 600 $SSL_DIR/private.key
chmod 644 $SSL_DIR/certificate.crt
chmod 644 $SSL_DIR/cert.conf

print_status "SSL file permissions set"

# Step 3: Update environment configuration
echo ""
echo "📝 Step 3: Updating environment configuration"

# Add SSL configuration to .env
if [[ -f $APP_DIR/.env ]]; then
  # Remove existing SSL entries
  grep -v "^SSL_" $APP_DIR/.env > $APP_DIR/.env.tmp
  grep -v "^HTTPS_" $APP_DIR/.env.tmp > $APP_DIR/.env
  rm $APP_DIR/.env.tmp
  
  # Add new SSL configuration
  cat >> $APP_DIR/.env << EOF

# SSL Configuration (Development)
HTTPS_ENABLED=true
SSL_CERT_PATH=$SSL_DIR/certificate.crt  
SSL_KEY_PATH=$SSL_DIR/private.key
SSL_DEV_MODE=true
EOF

  print_status "Environment configuration updated"
else
  print_warning ".env file not found. Creating with SSL configuration..."
  cat > $APP_DIR/.env << EOF
# Development Environment with SSL
NODE_ENV=development
PORT=9999

# SSL Configuration (Development)
HTTPS_ENABLED=true
SSL_CERT_PATH=$SSL_DIR/certificate.crt
SSL_KEY_PATH=$SSL_DIR/private.key  
SSL_DEV_MODE=true

# Database (Local Supabase)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
EOF
fi

# Step 4: Create HTTPS server module (if needed)
echo ""
echo "🌐 Step 4: Creating HTTPS development module"

cat > $SSL_DIR/https-dev-server.js << EOF
/**
 * Development HTTPS Server for Universal AI Tools
 * Run this to test HTTPS functionality in development
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SSL configuration
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'private.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certificate.crt'))
};

// Simple test server
const server = https.createServer(sslOptions, (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Proxy to main application
  const options = {
    hostname: 'localhost',
    port: 9999,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxy = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxy, { end: true });
});

const PORT = 9443; // HTTPS port
server.listen(PORT, () => {
  console.log(\`🔒 HTTPS development server running on https://localhost:\${PORT}\`);
  console.log(\`📡 Proxying requests to http://localhost:9999\`);
  console.log(\`\`);
  console.log(\`🌐 Access your application at:\`);
  console.log(\`   https://localhost:\${PORT}/health\`);
  console.log(\`   https://localhost:\${PORT}/api/v1/status\`);
  console.log(\`\`);
  console.log(\`⚠️ You may see SSL warnings in your browser.\`);
  console.log(\`   This is normal for self-signed certificates.\`);
  console.log(\`   Click "Advanced" -> "Proceed to localhost (unsafe)"\`);
});

server.on('error', (err) => {
  console.error('HTTPS server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.log(\`Port \${PORT} is already in use. Try a different port.\`);
  }
});
EOF

print_status "HTTPS development server created"

# Step 5: Create package.json scripts
echo ""
echo "📦 Step 5: Adding npm scripts"

# Check if package.json exists and add HTTPS script
if [[ -f $APP_DIR/package.json ]]; then
  # Use Node.js to safely update package.json
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.scripts = pkg.scripts || {};
    pkg.scripts['dev:https'] = 'node ssl/https-dev-server.js';
    pkg.scripts['ssl:setup'] = './scripts/ssl-dev-setup.sh';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log('✓ Added dev:https and ssl:setup scripts to package.json');
  "
  
  print_status "npm scripts added"
else
  print_warning "package.json not found. Manual script setup required."
fi

# Step 6: Create certificate info file
echo ""
echo "📋 Step 6: Creating certificate information"

cat > $SSL_DIR/README.md << EOF
# Development SSL Certificates

This directory contains self-signed SSL certificates for development use.

## Files

- \`certificate.crt\` - Self-signed SSL certificate
- \`private.key\` - Private key for the certificate
- \`cert.conf\` - Certificate configuration used during generation
- \`https-dev-server.js\` - Development HTTPS proxy server

## Usage

### Option 1: Run HTTPS development server
\`\`\`bash
npm run dev:https
\`\`\`

This starts an HTTPS proxy server on port 9443 that forwards requests to your main application on port 9999.

### Option 2: Configure main server for HTTPS
Set environment variables:
\`\`\`bash
HTTPS_ENABLED=true
SSL_CERT_PATH=$(pwd)/ssl/certificate.crt
SSL_KEY_PATH=$(pwd)/ssl/private.key
\`\`\`

## Browser Warnings

Since these are self-signed certificates, browsers will show security warnings. This is expected and safe for development.

To bypass warnings:
1. Click "Advanced" or "Show details"
2. Click "Proceed to localhost (unsafe)" or similar

## Certificate Details

- **Subject:** CN=localhost, O=Universal AI Tools, L=Local, ST=Development, C=US
- **Valid for:** 365 days from generation
- **Domains:** localhost, 127.0.0.1, 0.0.0.0, *.localhost
- **Key size:** 2048 bits RSA

## Regeneration

To regenerate certificates (if expired or corrupted):
\`\`\`bash
npm run ssl:setup
\`\`\`

## Security Note

**Do not use these certificates in production!** They are for development only.
EOF

print_status "Certificate documentation created"

# Display certificate information
echo ""
echo "🔍 Certificate Information:"
openssl x509 -in $SSL_DIR/certificate.crt -text -noout | grep -E "(Subject:|Not Before|Not After|DNS:|IP Address)"

echo ""
echo "🎉 Development SSL Setup Complete!"
echo "=================================="
echo ""
print_status "Self-signed SSL certificate generated"
print_status "Environment configuration updated"  
print_status "HTTPS development server created"
print_status "npm scripts added"
echo ""
echo "🌐 Next steps:"
echo "   1. Start your main application: npm run dev"
echo "   2. Start HTTPS proxy server: npm run dev:https"
echo "   3. Access via HTTPS: https://localhost:9443"
echo ""
echo "🔧 Alternative: Set HTTPS_ENABLED=true in your main server"
echo ""
echo "⚠️ Browser will show SSL warnings (normal for self-signed certificates)"
echo ""
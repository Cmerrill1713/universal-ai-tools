#!/bin/bash

# Security Secret Generation Script
# Generates secure random values for production deployment

echo "🔐 Generating secure secrets for Universal AI Tools..."
echo "=================================================="

# Generate JWT Secret (64 characters)
JWT_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-64)
echo "JWT_SECRET=$JWT_SECRET"

# Generate API Key (32 characters)
API_KEY=$(openssl rand -hex 32)
echo "API_KEY=$API_KEY"

# Generate Encryption Key (32 characters)
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"

# Generate Database Password (16 characters)
DB_PASSWORD=$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-16)
echo "DATABASE_URL=postgresql://universal_ai:$DB_PASSWORD@db:5432/universal_ai"

echo ""
echo "✅ Secure secrets generated successfully!"
echo "📝 Copy these values to your production .env file"
echo "⚠️  Store these values securely and never commit them to version control"
echo ""
echo "🔒 Security Recommendations:"
echo "   • Use a password manager to store these secrets"
echo "   • Rotate secrets regularly (every 30-90 days)"
echo "   • Use different secrets for different environments"
echo "   • Never log or expose these values in application code"

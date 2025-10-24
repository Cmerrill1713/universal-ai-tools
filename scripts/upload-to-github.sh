#!/bin/bash

# Universal AI Tools - GitHub Upload Script
# Creates a clean repository with only essential source files

set -e

echo "🚀 Starting GitHub upload process..."

# Create a clean directory for the upload
CLEAN_DIR="universal-ai-tools-clean"
REPO_NAME="universal-ai-tools"

echo "📁 Creating clean directory: $CLEAN_DIR"
rm -rf "$CLEAN_DIR"
mkdir -p "$CLEAN_DIR"

echo "📋 Copying essential files..."

# Copy essential configuration files
cp package.json "$CLEAN_DIR/" 2>/dev/null || echo "⚠️  package.json not found"
cp package-lock.json "$CLEAN_DIR/" 2>/dev/null || echo "⚠️  package-lock.json not found"
cp .gitignore "$CLEAN_DIR/" 2>/dev/null || echo "⚠️  .gitignore not found"
cp README.md "$CLEAN_DIR/" 2>/dev/null || echo "⚠️  README.md not found"

# Copy Docker files
cp Dockerfile "$CLEAN_DIR/" 2>/dev/null || echo "⚠️  Dockerfile not found"
cp docker-compose.yml "$CLEAN_DIR/" 2>/dev/null || echo "⚠️  docker-compose.yml not found"

# Copy GitHub Actions workflows
mkdir -p "$CLEAN_DIR/.github/workflows"
cp .github/workflows/*.yml "$CLEAN_DIR/.github/workflows/" 2>/dev/null || echo "⚠️  No workflow files found"

# Copy essential source directories (excluding build artifacts)
if [ -d "nodejs-api-server" ]; then
    cp -r nodejs-api-server "$CLEAN_DIR/"
    echo "✅ Copied nodejs-api-server"
fi

if [ -d "rust-services" ]; then
    cp -r rust-services "$CLEAN_DIR/"
    echo "✅ Copied rust-services"
fi

if [ -d "supabase" ]; then
    cp -r supabase "$CLEAN_DIR/"
    echo "✅ Copied supabase"
fi

if [ -d "scripts" ]; then
    cp -r scripts "$CLEAN_DIR/"
    echo "✅ Copied scripts"
fi

# Copy documentation
find . -maxdepth 1 -name "*.md" -exec cp {} "$CLEAN_DIR/" \; 2>/dev/null || echo "⚠️  No markdown files found"

echo "📊 Directory size analysis:"
du -sh "$CLEAN_DIR"

echo "🔧 Initializing Git repository..."
cd "$CLEAN_DIR"
git init
git add .
git commit -m "Initial commit: Clean Universal AI Tools repository

- Core TypeScript/Node.js API server
- Rust microservices architecture
- Supabase integration
- Docker containerization
- GitHub Actions CI/CD
- Essential documentation

Cleaned from 45GB+ to essential source files only."

echo "🌐 Creating GitHub repository..."
gh repo create "$REPO_NAME" --private --description "Universal AI Tools - Microservices platform with TypeScript, Rust, and AI orchestration" --source=. --remote=origin --push

echo "✅ Successfully uploaded to GitHub!"
echo "🔗 Repository: https://github.com/$(gh api user --jq .login)/$REPO_NAME"

cd ..
echo "🎉 Upload complete! Repository is now available on GitHub."


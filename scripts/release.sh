#!/bin/bash

# Universal AI Tools Release Script
# Creates a complete production release package

VERSION=${1:-1.0.0}
RELEASE_DIR="release/universal-ai-tools-v${VERSION}"

echo "🚀 Building Universal AI Tools Release v${VERSION}"

# Clean previous releases
rm -rf release/
mkdir -p "$RELEASE_DIR"

# Run production build
echo "📦 Running production build..."
./build-production.sh

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Copy built files
echo "📁 Assembling release package..."
cp -r build/release/universal-ai-tools/* "$RELEASE_DIR/"

# Add installer
cp install.sh "$RELEASE_DIR/"
chmod +x "$RELEASE_DIR/install.sh"

# Add Docker files
cp Dockerfile.prod "$RELEASE_DIR/Dockerfile"
cp docker-compose.prod.yml "$RELEASE_DIR/docker-compose.yml"
mkdir -p "$RELEASE_DIR/nginx"
cp nginx/nginx.prod.conf "$RELEASE_DIR/nginx/"

# Create release documentation
cat > "$RELEASE_DIR/RELEASE_NOTES.md" << EOF
# Universal AI Tools v${VERSION}

## Release Date: $(date +%Y-%m-%d)

## Features
- Supabase-powered universal tool system
- Support for multiple AI providers (OpenAI, Anthropic, Google, local LLMs)
- Advanced memory system with vector search
- Anti-hallucination mechanisms
- Cognitive agent orchestration
- Metal optimization for Apple Silicon
- Production-ready Docker deployment

## Installation

### Quick Install
\`\`\`bash
sudo ./install.sh
\`\`\`

### Docker Install
\`\`\`bash
docker-compose up -d
\`\`\`

### Manual Install
1. Install dependencies: \`npm install --production\`
2. Configure environment: \`cp .env.example .env && nano .env\`
3. Start service: \`npm start\`

## Requirements
- Node.js 18+
- Redis 7+
- PostgreSQL 15+ or Supabase
- 4GB RAM minimum
- 2 CPU cores recommended

## Configuration
Edit \`.env\` file with your settings:
- Supabase credentials
- AI service API keys
- Redis connection
- Security keys

## Support
- Documentation: https://github.com/your-org/universal-ai-tools
- Issues: https://github.com/your-org/universal-ai-tools/issues
EOF

# Create archive
echo "📦 Creating release archive..."
cd release
tar -czf "universal-ai-tools-v${VERSION}.tar.gz" "universal-ai-tools-v${VERSION}/"
zip -r "universal-ai-tools-v${VERSION}.zip" "universal-ai-tools-v${VERSION}/" -q

# Calculate checksums
echo "🔐 Generating checksums..."
shasum -a 256 "universal-ai-tools-v${VERSION}.tar.gz" > "universal-ai-tools-v${VERSION}.tar.gz.sha256"
shasum -a 256 "universal-ai-tools-v${VERSION}.zip" > "universal-ai-tools-v${VERSION}.zip.sha256"

# Create release manifest
cat > "manifest-v${VERSION}.json" << EOF
{
  "version": "${VERSION}",
  "releaseDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "files": {
    "tarball": {
      "name": "universal-ai-tools-v${VERSION}.tar.gz",
      "size": $(stat -f%z "universal-ai-tools-v${VERSION}.tar.gz" 2>/dev/null || stat -c%s "universal-ai-tools-v${VERSION}.tar.gz"),
      "sha256": "$(cut -d' ' -f1 universal-ai-tools-v${VERSION}.tar.gz.sha256)"
    },
    "zip": {
      "name": "universal-ai-tools-v${VERSION}.zip",
      "size": $(stat -f%z "universal-ai-tools-v${VERSION}.zip" 2>/dev/null || stat -c%s "universal-ai-tools-v${VERSION}.zip"),
      "sha256": "$(cut -d' ' -f1 universal-ai-tools-v${VERSION}.zip.sha256)"
    }
  },
  "requirements": {
    "node": ">=18.0.0",
    "redis": ">=7.0.0",
    "memory": "4GB",
    "cpu": "2 cores"
  }
}
EOF

cd ..

# Summary
echo ""
echo "✅ Release v${VERSION} created successfully!"
echo ""
echo "📦 Release files:"
echo "  - release/universal-ai-tools-v${VERSION}.tar.gz"
echo "  - release/universal-ai-tools-v${VERSION}.zip"
echo "  - release/manifest-v${VERSION}.json"
echo ""
echo "📊 Archive sizes:"
ls -lh release/*.{tar.gz,zip} | awk '{print "  - " $9 ": " $5}'
echo ""
echo "🚀 Next steps:"
echo "  1. Test the release package"
echo "  2. Upload to GitHub releases"
echo "  3. Update documentation"
echo "  4. Announce the release"
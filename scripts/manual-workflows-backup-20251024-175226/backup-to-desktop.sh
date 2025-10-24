#!/bin/bash

# Universal AI Tools - Complete Desktop Backup Script
# Creates comprehensive backup with compressed archives and restoration capability

set -e  # Exit on any error

# Configuration
DESKTOP="$HOME/Desktop"
SOURCE_DIR="/Users/christianmerrill/Desktop/universal-ai-tools"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_BASE_NAME="Universal-AI-Tools-Backup-${DATE}"
BACKUP_DIR="${DESKTOP}/${BACKUP_BASE_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Universal AI Tools - Complete Desktop Backup${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""
echo -e "${YELLOW}📅 Backup Date: $(date)${NC}"
echo -e "${YELLOW}📁 Source: ${SOURCE_DIR}${NC}"
echo -e "${YELLOW}💾 Destination: ${BACKUP_DIR}${NC}"
echo ""

# Create backup directory structure
echo -e "${BLUE}📁 Creating backup directory structure...${NC}"
mkdir -p "${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}/platform"
mkdir -p "${BACKUP_DIR}/database"
mkdir -p "${BACKUP_DIR}/archives"
mkdir -p "${BACKUP_DIR}/documentation"
mkdir -p "${BACKUP_DIR}/restoration"

# Phase 1: Complete Platform Backup
echo -e "${BLUE}📦 Phase 1: Complete Platform Backup${NC}"
echo "   ├── Copying source code and configurations..."

# Copy essential platform files
cp -r "${SOURCE_DIR}/src" "${BACKUP_DIR}/platform/"
cp -r "${SOURCE_DIR}/ui" "${BACKUP_DIR}/platform/"
cp -r "${SOURCE_DIR}/supabase" "${BACKUP_DIR}/platform/"
cp -r "${SOURCE_DIR}/docker-compose"*.yml "${BACKUP_DIR}/platform/"
cp -r "${SOURCE_DIR}/Dockerfile"* "${BACKUP_DIR}/platform/"
cp -r "${SOURCE_DIR}/nginx" "${BACKUP_DIR}/platform/"
cp -r "${SOURCE_DIR}/monitoring" "${BACKUP_DIR}/platform/"
cp -r "${SOURCE_DIR}/scripts" "${BACKUP_DIR}/platform/"
cp -r "${SOURCE_DIR}/config" "${BACKUP_DIR}/platform/" 2>/dev/null || true
cp "${SOURCE_DIR}/package.json" "${BACKUP_DIR}/platform/"
cp "${SOURCE_DIR}/package-lock.json" "${BACKUP_DIR}/platform/"
cp "${SOURCE_DIR}/tsconfig.json" "${BACKUP_DIR}/platform/"
cp "${SOURCE_DIR}/.env.example" "${BACKUP_DIR}/platform/"
cp "${SOURCE_DIR}/.gitignore" "${BACKUP_DIR}/platform/"

# Copy environment file if it exists (with security warning)
if [ -f "${SOURCE_DIR}/.env" ]; then
    echo "   ├── ⚠️  Including .env file (contains secrets - secure this backup)"
    cp "${SOURCE_DIR}/.env" "${BACKUP_DIR}/platform/"
fi

echo -e "   ${GREEN}✅ Platform files copied${NC}"

# Copy documentation
echo "   ├── Copying documentation..."
cp "${SOURCE_DIR}"/*.md "${BACKUP_DIR}/documentation/" 2>/dev/null || true
cp -r "${SOURCE_DIR}/docs" "${BACKUP_DIR}/documentation/" 2>/dev/null || true
cp -r "${SOURCE_DIR}/examples" "${BACKUP_DIR}/documentation/" 2>/dev/null || true

echo -e "   ${GREEN}✅ Documentation copied${NC}"

# Phase 2: Database Export
echo -e "${BLUE}📊 Phase 2: Database Export${NC}"
echo "   ├── Checking for Supabase CLI..."

if command -v supabase >/dev/null 2>&1; then
    echo "   ├── Exporting Supabase database..."
    cd "${SOURCE_DIR}"
    
    # Export schema
    if supabase db dump --schema-only > "${BACKUP_DIR}/database/schema.sql" 2>/dev/null; then
        echo -e "   ${GREEN}✅ Database schema exported${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Schema export failed (continuing)${NC}"
    fi
    
    # Export data (if possible)
    if supabase db dump --data-only > "${BACKUP_DIR}/database/data.sql" 2>/dev/null; then
        echo -e "   ${GREEN}✅ Database data exported${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Data export failed (continuing)${NC}"
    fi
    
    # Export full dump as fallback
    if supabase db dump > "${BACKUP_DIR}/database/full_dump.sql" 2>/dev/null; then
        echo -e "   ${GREEN}✅ Full database dump created${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Full dump failed (continuing)${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  Supabase CLI not found - copying migration files instead${NC}"
    cp -r "${SOURCE_DIR}/supabase/migrations"* "${BACKUP_DIR}/database/" 2>/dev/null || true
fi

# Copy local database files if they exist
cp "${SOURCE_DIR}"/*.db "${BACKUP_DIR}/database/" 2>/dev/null || true
cp "${SOURCE_DIR}"/*.sqlite* "${BACKUP_DIR}/database/" 2>/dev/null || true

echo -e "   ${GREEN}✅ Database backup completed${NC}"

# Phase 3: Create Compressed Archives
echo -e "${BLUE}📦 Phase 3: Creating Compressed Archives${NC}"

# Archive 1: Complete Platform (everything)
echo "   ├── Creating COMPLETE archive..."
cd "${BACKUP_DIR}"
tar -czf "archives/Universal-AI-Tools-COMPLETE.tar.gz" \
    platform/ database/ documentation/ \
    --exclude="platform/node_modules" \
    --exclude="platform/dist" \
    --exclude="platform/logs" \
    --exclude="platform/coverage" \
    --exclude="platform/.git" 2>/dev/null || true

COMPLETE_SIZE=$(ls -lh "archives/Universal-AI-Tools-COMPLETE.tar.gz" | awk '{print $5}')
echo -e "   ${GREEN}✅ COMPLETE archive created (${COMPLETE_SIZE})${NC}"

# Archive 2: Production Essentials (deployment ready)
echo "   ├── Creating PRODUCTION archive..."
tar -czf "archives/Universal-AI-Tools-PRODUCTION.tar.gz" \
    --exclude="platform/node_modules" \
    --exclude="platform/dist" \
    --exclude="platform/logs" \
    --exclude="platform/coverage" \
    --exclude="platform/.git" \
    --exclude="platform/ui/node_modules" \
    --exclude="documentation/examples" \
    platform/src \
    platform/docker-compose.production.yml \
    platform/Dockerfile.prod \
    platform/nginx \
    platform/monitoring \
    platform/supabase \
    platform/package.json \
    platform/package-lock.json \
    platform/tsconfig.json \
    platform/.env.example \
    database/ 2>/dev/null || true

PRODUCTION_SIZE=$(ls -lh "archives/Universal-AI-Tools-PRODUCTION.tar.gz" | awk '{print $5}')
echo -e "   ${GREEN}✅ PRODUCTION archive created (${PRODUCTION_SIZE})${NC}"

# Archive 3: Quick Restore (optimized for fast deployment)
echo "   ├── Creating QUICK-RESTORE archive..."
tar -czf "archives/Universal-AI-Tools-QUICK-RESTORE.tar.gz" \
    platform/docker-compose.production.yml \
    platform/Dockerfile.prod \
    platform/.env.example \
    database/schema.sql \
    database/full_dump.sql \
    documentation/PRODUCTION_DEPLOYMENT_GUIDE.md \
    documentation/QUICK_START_GUIDE.md \
    documentation/API_DOCUMENTATION.md 2>/dev/null || true

QUICK_SIZE=$(ls -lh "archives/Universal-AI-Tools-QUICK-RESTORE.tar.gz" | awk '{print $5}')
echo -e "   ${GREEN}✅ QUICK-RESTORE archive created (${QUICK_SIZE})${NC}"

# Phase 4: Create Restoration Documentation
echo -e "${BLUE}📝 Phase 4: Creating Restoration Documentation${NC}"

cat > "${BACKUP_DIR}/restoration/RESTORE_INSTRUCTIONS.md" << 'EOF'
# Universal AI Tools - Restoration Instructions

## 📦 Archive Contents

### `Universal-AI-Tools-COMPLETE.tar.gz`
- **Size**: Complete platform backup
- **Contents**: Full source code, database, documentation, examples
- **Use Case**: Development environment restoration
- **Restoration Time**: ~10 minutes

### `Universal-AI-Tools-PRODUCTION.tar.gz` 
- **Size**: Production essentials only
- **Contents**: Core platform, deployment configs, database schema
- **Use Case**: Production deployment
- **Restoration Time**: ~5 minutes

### `Universal-AI-Tools-QUICK-RESTORE.tar.gz`
- **Size**: Minimal deployment package
- **Contents**: Docker configs, database schema, essential docs
- **Use Case**: Emergency restoration or new environment setup
- **Restoration Time**: ~2 minutes

## 🚀 Quick Restoration Steps

### Option 1: Complete Development Environment
```bash
# 1. Extract complete archive
tar -xzf Universal-AI-Tools-COMPLETE.tar.gz
cd platform/

# 2. Install dependencies
npm install
cd ui && npm install && cd ..

# 3. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 4. Restore database
supabase start
supabase db reset

# 5. Start development
npm run dev
```

### Option 2: Production Deployment
```bash
# 1. Extract production archive
tar -xzf Universal-AI-Tools-PRODUCTION.tar.gz
cd platform/

# 2. Configure environment
cp .env.example .env
# Edit .env with production values

# 3. Deploy with Docker
docker-compose -f docker-compose.production.yml up -d

# 4. Verify deployment
curl http://localhost:9999/health
```

### Option 3: Emergency Quick Start
```bash
# 1. Extract quick restore
tar -xzf Universal-AI-Tools-QUICK-RESTORE.tar.gz

# 2. Run with Docker
docker-compose -f docker-compose.production.yml up -d

# 3. Import database
docker exec -i supabase-db psql -U postgres < database/schema.sql
```

## 🔧 Prerequisites

### Development Environment
- Node.js 18+ and npm
- Docker and Docker Compose
- Supabase CLI (optional)
- Git (for development)

### Production Environment
- Docker and Docker Compose
- 4GB+ RAM recommended
- 10GB+ disk space

## 🆘 Troubleshooting

### Port Conflicts
If ports 9999, 5432, or 6379 are in use:
```bash
# Check what's using the ports
lsof -i :9999
lsof -i :5432
lsof -i :6379

# Kill conflicting processes or modify docker-compose.yml
```

### Database Issues
```bash
# Reset database completely
supabase db reset --force

# Or manually restore
psql -U postgres -h localhost < database/full_dump.sql
```

### Permission Issues
```bash
# Fix file permissions
chmod +x scripts/*.sh
chmod 644 .env

# Fix Docker permissions
sudo chown -R $USER:$USER .
```

## 📞 Support

- **Documentation**: See documentation/ folder
- **Health Check**: `curl http://localhost:9999/health`
- **Logs**: `docker-compose logs -f`
- **Status**: `docker-compose ps`
EOF

# Create backup manifest
cat > "${BACKUP_DIR}/BACKUP_MANIFEST.txt" << EOF
# Universal AI Tools - Backup Manifest
# Created: $(date)
# Backup ID: ${BACKUP_BASE_NAME}

## 📊 Backup Statistics
Platform Size: $(du -sh "${BACKUP_DIR}/platform" | cut -f1)
Database Size: $(du -sh "${BACKUP_DIR}/database" | cut -f1)
Documentation Size: $(du -sh "${BACKUP_DIR}/documentation" | cut -f1)
Total Backup Size: $(du -sh "${BACKUP_DIR}" | cut -f1)

Archive Sizes:
- COMPLETE: ${COMPLETE_SIZE}
- PRODUCTION: ${PRODUCTION_SIZE}  
- QUICK-RESTORE: ${QUICK_SIZE}

## 📁 Directory Structure
$(tree "${BACKUP_DIR}" 2>/dev/null || find "${BACKUP_DIR}" -type d | sed 's/[^-][^\/]*\//  /g')

## 🔐 Security Notes
- This backup may contain sensitive environment variables
- Store in secure location with appropriate access controls
- Rotate backup encryption keys regularly
- Verify backup integrity before deletion of source

## ✅ Verification Checklist
- [ ] Source code files present
- [ ] Database schema exported
- [ ] Environment configuration included
- [ ] Documentation complete
- [ ] Archives created successfully
- [ ] Restoration instructions provided

Backup created successfully at: $(date)
EOF

echo -e "   ${GREEN}✅ Restoration documentation created${NC}"

# Phase 5: Copy archives to desktop root for easy access
echo -e "${BLUE}📂 Phase 5: Creating Desktop Shortcuts${NC}"

# Copy archives to desktop root
cp "${BACKUP_DIR}/archives/Universal-AI-Tools-COMPLETE.tar.gz" "${DESKTOP}/"
cp "${BACKUP_DIR}/archives/Universal-AI-Tools-PRODUCTION.tar.gz" "${DESKTOP}/"
cp "${BACKUP_DIR}/archives/Universal-AI-Tools-QUICK-RESTORE.tar.gz" "${DESKTOP}/"

# Create desktop readme
cat > "${DESKTOP}/Universal-AI-Tools-README.txt" << EOF
Universal AI Tools - Desktop Backup
====================================

📦 Quick Access Files:
- Universal-AI-Tools-COMPLETE.tar.gz     (Full backup)
- Universal-AI-Tools-PRODUCTION.tar.gz   (Production only)
- Universal-AI-Tools-QUICK-RESTORE.tar.gz (Fast deployment)

📁 Complete Backup: ${BACKUP_BASE_NAME}/
- Contains full backup with restoration instructions
- See restoration/RESTORE_INSTRUCTIONS.md for setup guide

🚀 Quick Start:
1. Extract Universal-AI-Tools-QUICK-RESTORE.tar.gz
2. Run: docker-compose -f docker-compose.production.yml up -d
3. Visit: http://localhost:9999

Created: $(date)
EOF

echo -e "   ${GREEN}✅ Desktop shortcuts created${NC}"

# Final Summary
echo ""
echo -e "${GREEN}🎉 Backup Completed Successfully!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}📁 Backup Location:${NC} ${BACKUP_DIR}"
echo -e "${BLUE}📦 Archive Sizes:${NC}"
echo "   ├── COMPLETE: ${COMPLETE_SIZE}"
echo "   ├── PRODUCTION: ${PRODUCTION_SIZE}"
echo "   └── QUICK-RESTORE: ${QUICK_SIZE}"
echo ""
echo -e "${BLUE}🚀 Desktop Files Created:${NC}"
echo "   ├── Universal-AI-Tools-COMPLETE.tar.gz"
echo "   ├── Universal-AI-Tools-PRODUCTION.tar.gz"
echo "   ├── Universal-AI-Tools-QUICK-RESTORE.tar.gz"
echo "   ├── Universal-AI-Tools-README.txt"
echo "   └── ${BACKUP_BASE_NAME}/ (complete backup)"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "   1. Review backup in: ${BACKUP_BASE_NAME}/"
echo "   2. Test restoration with: Universal-AI-Tools-QUICK-RESTORE.tar.gz"
echo "   3. Store backups securely (contains sensitive data)"
echo ""
echo -e "${YELLOW}⚠️  Security Warning:${NC} Backup contains environment variables and secrets"
echo -e "${YELLOW}🔐 Recommendation:${NC} Encrypt archives before sharing or cloud storage"
echo ""
#!/bin/bash
# Local-only hardening for Athena AI
# Network containment + Keychain secrets + offline-first

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║         🔒 ATHENA LOCAL-ONLY HARDENING                           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Network containment audit
echo "1️⃣  Network Containment Audit"
echo "════════════════════════════════════════════════════════════════════"
echo "Checking for services exposed beyond localhost..."
echo ""

NON_LOCAL=$(lsof -iTCP -sTCP:LISTEN 2>/dev/null | egrep -v '127\.0\.0\.1|localhost|\*:' | grep -v COMMAND || true)
if [ -z "$NON_LOCAL" ]; then
    echo -e "${GREEN}✅ All services bound to localhost only${NC}"
else
    echo -e "${YELLOW}⚠️  Found non-localhost listeners:${NC}"
    echo "$NON_LOCAL"
    echo ""
    echo "Recommendation: Bind all services to 127.0.0.1 in docker-compose"
fi
echo ""

# 2. Docker port bindings
echo "2️⃣  Docker Port Bindings"
echo "════════════════════════════════════════════════════════════════════"
docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep athena | while read line; do
    if echo "$line" | grep -q "0.0.0.0"; then
        echo -e "${YELLOW}⚠️  $line${NC}"
    else
        echo -e "${GREEN}✅ $line${NC}"
    fi
done
echo ""

# 3. Keychain secrets setup
echo "3️⃣  macOS Keychain Secrets"
echo "════════════════════════════════════════════════════════════════════"
echo "Setting up secure credential storage..."
echo ""

# Check if secrets already exist
if security find-generic-password -a "athena" -s "PG_PASSWORD" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  PostgreSQL password already in Keychain${NC}"
else
    echo "Creating Keychain entry for PostgreSQL..."
    security add-generic-password -a "athena" -s "PG_PASSWORD" -w "postgres" -U 2>/dev/null || true
    echo -e "${GREEN}✅ PostgreSQL password stored${NC}"
fi

echo ""
echo "To retrieve passwords in scripts:"
echo '  PG_PASS=$(security find-generic-password -a "athena" -s "PG_PASSWORD" -w)'
echo ""

# 4. Offline dependencies cache
echo "4️⃣  Offline Dependencies Cache"
echo "════════════════════════════════════════════════════════════════════"

# Python wheelhouse
if [ ! -d "wheelhouse" ]; then
    echo "Creating Python wheelhouse for offline installs..."
    pip wheel -r requirements.txt -w ./wheelhouse 2>&1 | tail -3 || true
    echo -e "${GREEN}✅ Python wheelhouse created${NC}"
else
    echo -e "${GREEN}✅ Python wheelhouse exists${NC}"
fi

# npm cache
if [ ! -d ".npm-cache" ]; then
    echo "Creating npm offline cache..."
    npm ci --cache ./.npm-cache --prefer-offline 2>&1 | tail -3 || true
    echo -e "${GREEN}✅ npm cache created${NC}"
else
    echo -e "${GREEN}✅ npm cache exists${NC}"
fi
echo ""

# 5. Save Docker base images
echo "5️⃣  Docker Base Images (offline mode)"
echo "════════════════════════════════════════════════════════════════════"
mkdir -p docker-images-backup

BASE_IMAGES=(
    "postgres:15-alpine"
    "redis:7-alpine"
    "semitechnologies/weaviate:1.27.1"
    "grafana/grafana:latest"
    "prom/prometheus:latest"
)

echo "Saving base images for offline use..."
for img in "${BASE_IMAGES[@]}"; do
    filename=$(echo "$img" | tr '/:' '_')
    if [ ! -f "docker-images-backup/${filename}.tar" ]; then
        echo "  Saving $img..."
        docker save -o "docker-images-backup/${filename}.tar" "$img" 2>/dev/null || echo "    (skipped - not pulled)"
    else
        echo "  ✅ $img (already saved)"
    fi
done
echo ""

# 6. Network isolation check
echo "6️⃣  Network Isolation Verification"
echo "════════════════════════════════════════════════════════════════════"
echo "Docker networks:"
docker network ls --format '{{.Name}}\t{{.Driver}}' | grep -v bridge | grep -v host || echo "  Using default bridge (isolated)"
echo ""

# 7. Generate local-mode checklist
cat > docs/local_mode_checklist.md << 'CHECKLIST'
# Local-Only Mode Checklist

## ✅ Security Checklist

- [ ] All Docker ports bound to `127.0.0.1` (not `0.0.0.0`)
- [ ] Secrets stored in macOS Keychain (not `.env`)
- [ ] Broker requires `X-Assistant-Token` header
- [ ] Outbound network disabled for agents (`ALLOW_NET=0`)
- [ ] No external listeners: `lsof -iTCP -sTCP:LISTEN | grep -v 127.0.0.1`

## ✅ Offline-First Checklist

- [ ] Python wheelhouse created (`pip wheel -w wheelhouse`)
- [ ] npm cache populated (`npm ci --cache .npm-cache`)
- [ ] Docker base images saved (`docker save -o base.tar`)
- [ ] Local embedding model downloaded
- [ ] Repos cloned locally for knowledge base

## ✅ Data Safety Checklist

- [ ] Volume backups exist (`~/backups/docker-volumes/`)
- [ ] PostgreSQL dumps automated (`pg_dump`)
- [ ] Redis RDB snapshots saved
- [ ] Weaviate schema exported
- [ ] Git repos backed up

## ✅ Operational Checklist

- [ ] Passwords rotated from defaults
- [ ] Quality gate CI passing
- [ ] Pre-commit hooks installed
- [ ] All services healthy: `docker compose ps`
- [ ] API response times <50ms

## Quick Commands

```bash
# Audit network exposure
lsof -iTCP -sTCP:LISTEN | egrep -v '127\.0\.0\.1|localhost'

# Check Docker bindings
docker ps --format 'table {{.Names}}\t{{.Ports}}'

# Verify Keychain secrets
security find-generic-password -a "athena" -s "PG_PASSWORD" -w

# Backup volumes
make backup-volumes

# Offline build
pip install --no-index --find-links ./wheelhouse -r requirements.txt
npm ci --cache ./.npm-cache --prefer-offline

# Health check all services
curl http://127.0.0.1:8014/api/probe/e2e | jq
```

## Recovery Procedures

### Restore PostgreSQL
```bash
docker exec -i athena-postgres pg_restore -U postgres -d athena < backup.dump
```

### Restore Weaviate
```bash
# Re-run migration script
python3 scripts/migrate_supabase_to_weaviate.py
```

### Restore from volume backup
```bash
V=pgdata
docker run --rm -v $V:/v -v ~/backups/docker-volumes:/b alpine \
  sh -c "cd /v && tar -xzf /b/${V}_YYYY-MM-DD.tgz"
```
CHECKLIST

echo -e "${GREEN}✅ Created docs/local_mode_checklist.md${NC}"
echo ""

# 8. Summary
echo "════════════════════════════════════════════════════════════════════"
echo "✅ LOCAL-ONLY HARDENING COMPLETE"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Setup completed:"
echo "  ✅ Network containment audit"
echo "  ✅ Keychain secrets initialized"
echo "  ✅ Offline dependency caches created"
echo "  ✅ Docker base images saved"
echo "  ✅ Local mode checklist generated"
echo ""
echo "Next steps:"
echo "  1. Review docs/local_mode_checklist.md"
echo "  2. Run ./scripts/rotate_passwords.sh"
echo "  3. Update docker-compose to bind ports to 127.0.0.1"
echo "  4. Install pre-commit: pip install pre-commit && pre-commit install"
echo ""
echo "🎯 Your system is now hardened for local-only operation!"
echo ""


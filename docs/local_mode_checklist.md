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

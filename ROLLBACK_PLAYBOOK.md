# 🚨 Rollback Playbook

## Quick Rollback to Stable Version

If a bad merge causes production issues, follow this immediate recovery plan:

### Option 1: Rollback to Tagged Release (Recommended)

```bash
# Check available stable tags
git tag -l "v*-import-stabilized"

# Checkout stable tag
git checkout v0.9.0-import-stabilized

# Rebuild and redeploy
docker-compose down
docker-compose up -d --build

# Verify health
make test BASE=http://localhost:8013
```

### Option 2: Revert Last Merge

```bash
# Find the merge commit
git log --oneline --merges -5

# Revert the merge (use -m 1 for main parent)
git revert -m 1 <merge_commit_sha>

# Push the revert
git push origin main

# Rebuild containers
docker-compose down
docker-compose up -d --build
```

### Option 3: Cherry-Pick Specific Fixes

```bash
# Create hotfix branch from stable tag
git checkout -b hotfix/critical-fix v0.9.0-import-stabilized

# Cherry-pick specific commits
git cherry-pick <commit_sha>

# Test locally
make test

# Merge hotfix
git checkout main
git merge hotfix/critical-fix
git push origin main
```

## Verification After Rollback

Run the complete test suite to confirm stability:

```bash
# Local verification
make test BASE=http://localhost:8013

# Multi-service verification
BASE=http://localhost:8000 make sentry
BASE=http://localhost:8013 make sentry
BASE=http://localhost:8888 make sentry

# Comprehensive validation
make validate-all BASE=http://localhost:8013
```

## Emergency Contacts

- **CI/CD Status**: Check `.github/workflows/` for failing jobs
- **Error Logs**: `docker-compose logs -f --tail=100`
- **Database Health**: `python scripts/db_health.py`
- **Import Health**: `python scripts/import_smoke.py`

## Prevention Checklist

Before merging any PR:

- [ ] All CI workflows green (smoke, verify, nightly)
- [ ] Local `make test` passes on all services
- [ ] No new 500 errors (`make sentry`)
- [ ] Import smoke tests pass (`python scripts/import_smoke.py`)
- [ ] Database connectivity verified (`python scripts/db_health.py`)
- [ ] Archive isolation maintained (`python scripts/test_archive_isolation.py`)

## Stable Tags

Maintain stable release tags for quick rollback:

```bash
# Tag current stable state
git tag -a v0.9.0-import-stabilized -m "Stable: All imports + 75% endpoints working"
git push origin v0.9.0-import-stabilized

# Tag before risky changes
git tag -a v0.9.1-pre-refactor -m "Stable before major refactor"
git push origin v0.9.1-pre-refactor
```

## Monitoring & Alerts

### Telegram Alerts (Optional)

Set environment variables:
```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_CHAT_ID="your-chat-id"
```

Then use:
```bash
make notify BASE=http://localhost:8013
```

### CI Alert Integration

Add to `.github/workflows/verify.yml`:

```yaml
- name: Notify on failure
  if: failure()
  run: |
    BASE=http://localhost:8000 python scripts/sentry_notify.py
```

## Known Safe States

| Tag | Date | Description | Tests Passing |
|-----|------|-------------|---------------|
| `v0.9.0-import-stabilized` | 2025-10-11 | All imports fixed, 75% endpoints working | smoke ✅ sentry ✅ validate ✅ |

Update this table after each stable release.


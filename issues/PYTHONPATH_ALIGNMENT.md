# Issue: Align container PYTHONPATH with production layout

## 🐛 Problem

**Impact:** Import failures when launched via alternate entrypoints  
**Scope:** All Python containers

**Current State:**
- Some containers: `PYTHONPATH=/app`
- Others: `PYTHONPATH=/app/src:/app:/app/api`
- Inconsistent across services

---

## 🔍 Root Cause

Not all Dockerfiles and docker-compose files have been updated with the standardized PYTHONPATH.

---

## ✅ Fix

### 1. Confirm sitecustomize.py loads in all services

**Action:** Copy sitecustomize.py to all Python containers

```bash
for container in $(docker ps --format '{{.Names}}' | grep -E 'python|api|assistant|evolutionary'); do
    docker cp sitecustomize.py $container:/app/ 2>/dev/null && echo "✅ $container"
done
```

### 2. Unify WORKDIR

All Dockerfiles should use:
```dockerfile
WORKDIR /app
```

### 3. Set PYTHONPATH in compose & Dockerfiles

**Dockerfiles:**
```dockerfile
ENV PYTHONPATH=/app/src:/app:/app/api
COPY sitecustomize.py /app/sitecustomize.py
```

**docker-compose.yml:**
```yaml
services:
  service-name:
    environment:
      - PYTHONPATH=/app/src:/app:/app/api
    volumes:
      - ./sitecustomize.py:/app/sitecustomize.py
```

---

## 🧪 Validation

### Test in each container
```bash
for container in unified-ai-assistant-api unified-evolutionary-api python-api; do
    echo "Testing $container:"
    docker exec $container python scripts/import_smoke.py
done
```

Expected: `0 errors` in all containers

### Check sys.path
```bash
docker exec CONTAINER python -c "import sys; print(sys.path[:5])"
```

Expected to include:
```
['', '/app/src', '/app/api', '/app', ...]
```

---

## 📋 Implementation Checklist

- [x] Create sitecustomize.py
- [x] Deploy to 5 containers
- [ ] Update all Dockerfiles with PYTHONPATH
- [ ] Update all docker-compose files with PYTHONPATH
- [ ] Standardize WORKDIR=/app everywhere
- [ ] Test import_smoke.py in all containers
- [ ] Verify sys.path includes all required paths

---

## 📝 Containers to Update

Based on current running services:
- [x] universal-ai-tools-python-api ✅ Done
- [x] unified-ai-assistant-api ✅ Done
- [x] unified-evolutionary-api ✅ Done
- [x] agentic-platform ✅ Done
- [x] unified-mcp-ecosystem ✅ Done
- [ ] Any future Python services

---

**Status:** Partially complete (5/5 running containers done)  
**Priority:** Low (sitecustomize.py provides fallback)  
**Estimated effort:** 30 minutes for remaining containers


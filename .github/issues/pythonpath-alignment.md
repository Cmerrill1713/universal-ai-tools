---
title: "Align container PYTHONPATH with production layout"
labels: ["infrastructure", "docker", "priority-high"]
assignees: []
---

## Impact
Import failures when services launched via alternate entrypoints or docker exec

## Root Cause
- Inconsistent `WORKDIR` across Dockerfiles
- `sitecustomize.py` not loading in all contexts
- `PYTHONPATH` set differently in `docker-compose.yml` vs `Dockerfile`

## Current State
```yaml
# docker-compose.yml (multiple services)
environment:
  PYTHONPATH: /app/src:/app  # Missing /app/api in some services
```

```dockerfile
# Various Dockerfiles
WORKDIR /app  # Sometimes /workspace, /code, etc.
ENV PYTHONPATH=/app/src:/app  # Inconsistent
```

## Expected Behavior
- All services use consistent `WORKDIR /app`
- All services include `/app/src:/app/api:/app` in `PYTHONPATH`
- `sitecustomize.py` loads automatically in all Python contexts
- `python -c "import api; import src"` works in all containers

## Fix

### 1. Standardize Dockerfiles
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy sitecustomize.py BEFORE other files
COPY sitecustomize.py /app/sitecustomize.py

# Set PYTHONPATH consistently
ENV PYTHONPATH=/app/src:/app/api:/app

# Copy application code
COPY src/ /app/src/
COPY api/ /app/api/

# ... rest of Dockerfile ...
```

### 2. Verify sitecustomize.py loads
```dockerfile
# Add to all Dockerfiles (after COPY sitecustomize.py)
RUN python -c "import sitecustomize; print('sitecustomize.py loaded')"
```

### 3. Standardize docker-compose.yml
```yaml
services:
  unified-backend:
    environment:
      PYTHONPATH: /app/src:/app/api:/app
    working_dir: /app
  
  agentic-platform:
    environment:
      PYTHONPATH: /app/src:/app/api:/app
    working_dir: /app
  
  # ... repeat for all services ...
```

### 4. Test in all containers
```bash
# Create validation script
cat > scripts/container_import_check.sh << 'EOF'
#!/bin/bash
for service in unified-backend agentic-platform python-api; do
  echo "Testing $service..."
  docker-compose exec -T $service python -c "
import sys
print('PYTHONPATH:', ':'.join(sys.path[:5]))
import api
import src
print('✅ Imports OK')
  " || echo "❌ $service failed"
done
EOF

chmod +x scripts/container_import_check.sh
```

## Validation
```bash
# Rebuild all containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Test imports in each container
docker-compose exec unified-backend python scripts/import_smoke.py
docker-compose exec agentic-platform python scripts/import_smoke.py
docker-compose exec python-api python scripts/import_smoke.py

# Expected: All pass with 0 import errors
```

## Affected Services
- `unified-backend` (port 8000)
- `agentic-platform` (port 8013)
- `python-api` (port 8888)
- Any other Python-based services

## References
- See `issues/PYTHONPATH_ALIGNMENT.md` for comprehensive guide
- Related: `sitecustomize.py`, all `Dockerfile.*`, `docker-compose*.yml`
- Verification: `scripts/import_smoke.py`, `scripts/container_import_check.sh`


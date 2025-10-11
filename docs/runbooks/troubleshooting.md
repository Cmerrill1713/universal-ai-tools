# 🔧 Troubleshooting Runbook

**Quick reference for common issues and fixes**

---

## 🚨 Common Issues

### **Issue: Services won't start**

**Symptoms:**
- `docker-compose up` fails
- Containers immediately exit
- Port conflicts

**Diagnosis:**
```bash
# Check logs
docker-compose logs --tail=100

# Check ports
netstat -an | grep LISTEN | grep -E "8000|8013|8080|3033"

# Check docker status
docker ps -a
```

**Fix:**
```bash
# Stop conflicting services
docker-compose down

# Clear old containers
docker system prune -f

# Restart
make dev
```

---

### **Issue: Import errors in Python**

**Symptoms:**
- `ModuleNotFoundError: No module named 'api'`
- `ModuleNotFoundError: No module named 'src'`

**Diagnosis:**
```bash
# Check PYTHONPATH
docker exec -it unified-backend python -c "import sys; print(sys.path)"

# Run import smoke test
make smoke
```

**Fix:**
```bash
# Verify sitecustomize.py exists
ls -la sitecustomize.py

# Rebuild containers
docker-compose up -d --build --force-recreate

# Test again
make smoke
```

---

### **Issue: 500 errors on endpoints**

**Symptoms:**
- API returns 500 Internal Server Error
- `make sentry` fails

**Diagnosis:**
```bash
# Run error sentry
make sentry

# Check specific endpoint
curl -i http://localhost:8013/api/problem-endpoint

# View logs
docker-compose logs -f unified-backend | grep ERROR
```

**Fix:**
```bash
# Apply surgical patches if documented
# See CONTAINER_PATCHES_GUIDE.md

# Or check specific error
docker exec -it unified-backend python -c "
import traceback
try:
    # Import failing module
    from problem_module import something
except Exception as e:
    traceback.print_exc()
"
```

---

### **Issue: Database connection failures**

**Symptoms:**
- 503 on `/api/corrections/*`
- `psycopg.OperationalError`

**Diagnosis:**
```bash
# Check DB health
python scripts/db_health.py

# Check postgres running
docker ps | grep postgres

# Check credentials
docker exec -it postgres env | grep POSTGRES
```

**Fix:**
```bash
# Restart postgres
docker-compose restart postgres

# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
docker exec -it postgres psql -U postgres -d universal_ai_tools -c "SELECT 1"
```

---

### **Issue: make green fails**

**Symptoms:**
- One or more checks fail
- Red output instead of green

**Diagnosis:**
```bash
# Run individual checks
make sentry      # 500 detector
make validate    # GET endpoints
make validate-all # POST endpoints
make contract    # /chat shape
```

**Fix based on which failed:**

**If sentry fails:**
- Check service logs
- Verify services running
- Apply surgical patches

**If validate fails:**
- Review endpoint errors
- Check for new 500s
- Verify database connectivity

**If contract fails:**
- Check /chat endpoint exists
- Verify response shape
- Update contract_chat.py if shape changed

---

### **Issue: Hot reload not working**

**Symptoms:**
- Code changes not reflected
- Must manually restart containers

**Diagnosis:**
```bash
# Check docker-compose.dev.yml loaded
docker-compose config | grep reload

# Check volumes mounted
docker inspect unified-backend | grep Mounts -A 10
```

**Fix:**
```bash
# Ensure using dev override
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Or use make dev
make dev
```

---

## 🔍 Diagnostic Commands

```bash
# Service health
make green

# Import health
make smoke

# Database health
python scripts/db_health.py

# Performance check
make perf-baseline

# Container status
docker ps

# Container logs
docker-compose logs -f [service-name]

# Network connectivity
docker network inspect universal-ai-network

# Resource usage
docker stats
```

---

## 📞 Escalation Path

1. **Check runbooks:** This file, ROLLBACK_PLAYBOOK.md
2. **Check issues:** .github/issues/*.md
3. **Check docs:** PROJECT_UNDERSTANDING.md
4. **Emergency rollback:** git checkout v0.9.0-import-stabilized

---

**Last updated:** 2025-10-11


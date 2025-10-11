# 📘 Deployment Runbook

**Purpose:** Step-by-step deployment procedures  
**Audience:** DevOps, SRE, Platform Engineers

---

## 🎯 Deployment Types

### **Local Development**
```bash
make dev
make green
```

### **Staging**
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
make green BASE=https://staging.example.com
```

### **Production**
```bash
# See K8s deployment below
kubectl apply -f k8s/production/
```

---

## 📋 Pre-Deployment Checklist

- [ ] All tests passing (`make test`)
- [ ] No 500 errors (`make sentry`)
- [ ] Performance baseline established (`make perf-baseline`)
- [ ] Security scan clean
- [ ] Database migrations reviewed
- [ ] Backup created
- [ ] Rollback plan ready
- [ ] Team on standby

---

## 🚀 Deployment Procedure

### **Step 1: Preparation**
```bash
# Tag release
git tag -a v1.0.0 -m "Production release"
git push origin v1.0.0

# Build images
docker-compose build --no-cache

# Push to registry
docker-compose push
```

### **Step 2: Database Migration**
```bash
# Backup first!
docker exec postgres pg_dump -U postgres universal_ai_tools > backup.sql

# Run migrations
docker exec -it unified-backend python -m alembic upgrade head
```

### **Step 3: Deploy Services**
```bash
# Start new containers
docker-compose up -d --force-recreate

# Wait for health
sleep 30

# Verify
make green BASE=http://production-url
```

### **Step 4: Smoke Test**
```bash
# Critical endpoints
curl https://api.production.com/health
curl https://api.production.com/openapi.json

# Run full validation
make validate-all BASE=https://api.production.com
```

### **Step 5: Monitor**
Watch for 1 hour:
- Error rates in Grafana
- Response times
- CPU/Memory usage
- User feedback

---

## ⏮️ Rollback Procedure

**See:** `ROLLBACK_PLAYBOOK.md` for complete guide

**Quick rollback:**
```bash
# Checkout previous tag
git checkout v0.9.0-import-stabilized

# Rebuild and deploy
docker-compose down
docker-compose up -d --build

# Verify
make green
```

---

## 📊 Post-Deployment Validation

Run these checks:

```bash
#1. Health check
make green BASE=https://api.production.com

# 2. Performance check
make perf-compare BASE=https://api.production.com

# 3. Contract test
make contract BASE=https://api.production.com
```

---

## 🚨 Incident Response

**If deployment fails:**

1. **Check logs:** `docker-compose logs -f`
2. **Check metrics:** Grafana dashboards
3. **Check health:** `make sentry`
4. **Rollback if critical:** See ROLLBACK_PLAYBOOK.md
5. **Document incident:** Create postmortem

---

**Last updated:** 2025-10-11  
**Owner:** Platform Team


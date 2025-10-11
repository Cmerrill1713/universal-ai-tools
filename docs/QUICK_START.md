# 🚀 Quick Start Guide

**Get Universal AI Tools running in 5 minutes**

---

## Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Git

---

## 🏃 Fastest Path

```bash
# 1. Clone and enter
git clone <your-repo>
cd universal-ai-tools

# 2. Start services
make dev

# 3. Verify health
make green

# 4. Start tinkering!
make play
```

**Done!** Services running with hot reload at http://localhost:8013

---

## 📦 What Just Happened

`make dev` started:
- ✅ Postgres (database)
- ✅ Redis (caching)  
- ✅ Ollama (local LLMs)
- ✅ Weaviate (vector DB)
- ✅ Python APIs (with hot reload)
- ✅ Prometheus & Grafana (monitoring)

`make green` verified:
- ✅ No 500s on critical pages
- ✅ GET endpoints working
- ✅ POST endpoints graceful
- ✅ /chat contract valid

---

## 🎮 Dev Commands

```bash
# Quick API test
make play

# Seed demo data
make seed

# Run full test suite
make test

# Performance baseline
make perf-baseline

# Stop everything
make down
```

---

## 📊 Dashboards

- **Grafana**: http://localhost:3003 (admin/admin)
- **Prometheus**: http://localhost:9090
- **pgAdmin**: http://localhost:5050 (admin@example.com/admin)
- **Redis Commander**: http://localhost:8081

---

## 🔧 Development Workflow

### 1. Edit Code
Files in `src/` and `api/` hot-reload automatically

### 2. Test Changes
```bash
make play   # Quick test
make green  # Full validation
```

### 3. Verify Health
```bash
curl http://localhost:8013/health
curl http://localhost:8013/openapi.json
```

---

## 🐛 Troubleshooting

**Services won't start:**
```bash
docker-compose down -v  # Nuclear option
make dev                # Restart
```

**Import errors:**
```bash
# Check PYTHONPATH
docker exec -it universal-ai-tools-backend python -c "import sys; print(sys.path)"

# Run smoke test
make smoke
```

**500 errors:**
```bash
# Check logs
docker-compose logs -f unified-backend

# Run sentry
make sentry
```

---

## ✅ Success Criteria

You're ready when:
- ✅ `make green` passes
- ✅ `make play` shows healthy responses
- ✅ No errors in `docker-compose logs`
- ✅ Grafana shows metrics

---

**Next:** See `PROJECT_UNDERSTANDING.md` for complete architecture


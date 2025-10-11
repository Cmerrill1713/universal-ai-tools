# NeuroForge AI - Quick Start Guide

## 🚀 One-Command Launch

```bash
./start-complete.sh
```

This will:
1. ✅ Start all Docker containers (frontend, backend, database, redis, ollama)
2. ✅ Wait for services to be healthy
3. ✅ Run health checks
4. ✅ **Automatically open your browser to http://localhost:3000**
5. ✅ Show live logs from frontend and backend

## 📍 Service URLs

Once started, you can access:

- **NeuroForge AI (Frontend)**: http://localhost:3000
- **Backend API**: http://localhost:8013
- **API Documentation**: http://localhost:8013/docs
- **OpenAPI Spec**: http://localhost:8013/openapi.json

## 🧪 Verify Everything Works

```bash
# Run comprehensive health check
make green BASE=http://localhost:8013

# Or quick check
curl http://localhost:8013/health
curl http://localhost:3000
```

## 🛑 Stop Everything

```bash
docker-compose -f docker-compose.complete.yml down
```

## 🔧 Troubleshooting

### Frontend can't reach backend
The frontend is configured to connect to the backend at `http://localhost:8013` from your browser.
Inside Docker, it uses `http://unified-backend:8013`.

### Port already in use
If you see port conflicts:
```bash
# Stop existing containers
docker-compose down
docker ps  # Check what's still running
```

### View logs
```bash
# All services
docker-compose -f docker-compose.complete.yml logs -f

# Just frontend
docker-compose -f docker-compose.complete.yml logs -f neuroforge-frontend

# Just backend
docker-compose -f docker-compose.complete.yml logs -f unified-backend
```

### Rebuild containers
```bash
docker-compose -f docker-compose.complete.yml up -d --build --force-recreate
```

## 📊 What's Running?

```bash
docker-compose -f docker-compose.complete.yml ps
```

Should show:
- ✅ `neuroforge-frontend` (port 3000)
- ✅ `unified-backend` (port 8013)
- ✅ `postgres` (port 5432)
- ✅ `redis` (port 6379)
- ✅ `ollama` (port 11434)

## 🎯 Next Steps

1. Open http://localhost:3000 in your browser
2. Start chatting with the AI!
3. Explore the Chat and Tasks tabs
4. Check the API docs at http://localhost:8013/docs

## 🐛 Still Having Issues?

Check the detailed logs:
```bash
# Backend API logs
docker logs unified-ai-assistant-api --tail=50 -f

# Frontend logs
docker logs unified-neuroforge-frontend --tail=50 -f

# Database connection
docker exec -it unified-postgres psql -U postgres -d universal_ai_tools -c "\l"
```

## 💡 Development Mode

For hot-reloading during development:
```bash
make dev
```

This mounts your local `src/` and `api/` directories into the containers so changes are reflected immediately.

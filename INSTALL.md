# 🚀 Universal AI Tools - Installation Guide

## Quick Installation (Recommended)

### Step 1: Prerequisites
- **Docker Desktop** (for easiest setup)
- **Git** (to clone if needed)

### Step 2: Install Docker (if not installed)
```bash
# macOS
brew install --cask docker

# Or download from: https://www.docker.com/products/docker-desktop
```

### Step 3: Start Universal AI Tools
```bash
# Option A: Quick start (recommended)
./start.sh

# Option B: Manual Docker Compose
docker-compose up -d
```

### Step 4: Verify Installation
```bash
# Check if services are running
curl http://localhost:8086/health

# Access the dashboard
open http://localhost:8086/dashboard
```

## Alternative Installation Methods

### Option 1: Automated Installer
```bash
# Full system installation
./install.sh

# With Docker support
./install.sh --docker

# With systemd services
./install.sh --systemd
```

### Option 2: Manual Setup
```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your settings

# 2. Start services
docker-compose up -d

# 3. Check status
docker-compose ps
```

## 🎯 What You Get

| Service | URL | Description |
|---------|-----|-------------|
| **Assistant** | http://localhost:8086 | Main AI chat interface |
| **Dashboard** | http://localhost:8086/dashboard | Monitoring dashboard |
| **LLM Router** | http://localhost:3033 | AI model management |
| **Librarian** | http://localhost:8082 | Knowledge management |

## 🔧 Management Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Check status
docker-compose ps
```

## 🆘 Troubleshooting

### Services won't start?
```bash
# Check Docker is running
docker --version
docker-compose --version

# Check logs
docker-compose logs
```

### Port conflicts?
```bash
# Check what's using the ports
lsof -i :8086
lsof -i :3033
lsof -i :8082
```

### Need help?
- Check `PACKAGING_GUIDE.md` for detailed documentation
- View service logs: `docker-compose logs -f assistantd`
- Health check: `curl http://localhost:8086/health`

## 🎉 Success!

Once running, you can:
- Chat with the AI: `curl -X POST http://localhost:8086/chat -d '{"messages":[{"role":"user","content":"Hello!"}]}'`
- Access the web dashboard: http://localhost:8086/dashboard
- Monitor system health: http://localhost:8086/health

**Welcome to Universal AI Tools! 🤖✨**

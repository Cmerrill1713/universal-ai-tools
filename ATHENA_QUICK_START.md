# Athena Quick Start Guide

## One-Command Start

```bash
cd /Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools
./start-athena.sh
```

That's it! The script will:
- ✅ Start all Docker backend services
- ✅ Wait for services to be healthy  
- ✅ Build the Swift app
- ✅ Launch Athena

## What You Get

### Native macOS App
- **Enter to send messages** (no need for Cmd+Enter)
- **High-quality TTS** using Kokoro voice
- **Voice input** via Whisper
- **Screenshot sharing** in chat
- **Native performance** and UI

### Backend Services (Docker)
- **Backend API** (port 8013) - Main API
- **MLX TTS** (port 8877) - Text-to-speech
- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Cache
- **Netdata** (port 19999) - Monitoring

## Common Commands

```bash
# Start everything
./start-athena.sh

# Stop Docker services
docker-compose -f docker-compose.swift-backend.yml down

# View logs
docker-compose -f docker-compose.swift-backend.yml logs -f

# Restart a service
docker restart athena-backend-api

# Monitor everything
open http://localhost:19999
```

## Testing

```bash
# Test backend API
curl http://localhost:8013/health

# Test TTS
curl -X POST http://localhost:8013/api/tts/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from Athena","voice":"sarah","speed":"normal"}'

# Check all services
docker ps
```

## Troubleshooting

### Can't type in app
- Make sure app is running as `.app` bundle (use `./start-athena.sh`)
- Check app has focus and permissions

### No TTS voice
- Check TTS service: `docker logs athena-mlx-tts`
- Verify backend: `docker logs athena-backend-api`
- Test endpoint: `curl http://localhost:8877/health`

### Services won't start
- Check Docker is running: `docker ps`
- View logs: `docker-compose -f docker-compose.swift-backend.yml logs`
- Clean restart: `docker-compose -f docker-compose.swift-backend.yml down -v && ./start-athena.sh`

## Architecture

```
Athena Swift App (Native macOS)
        ↓
Backend API (Docker:8013)
        ↓
MLX TTS Service (Docker:8877)
```

All backend services run in Docker, Swift app runs natively on macOS.

## Key Files

- `start-athena.sh` - Main launcher script
- `docker-compose.swift-backend.yml` - Docker services config
- `NeuroForgeApp/` - Swift app source code
- `src/api/` - Backend API source code
- `ATHENA_SWIFT_APP.md` - Full documentation

## Next Steps

1. **Try it out**: Send a message, hear the TTS response
2. **Monitor**: Open http://localhost:19999 to see system metrics
3. **Customize**: Edit voice settings in the Swift app
4. **Develop**: Make changes and rebuild with `./start-athena.sh`

## Support

For detailed documentation, see `ATHENA_SWIFT_APP.md`


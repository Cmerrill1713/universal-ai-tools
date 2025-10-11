# Athena Swift App + Docker Backend

## Overview

Athena is a native macOS chat application built with Swift that connects to a comprehensive Docker-based backend. This architecture provides the best of both worlds:

- **Native macOS Experience**: Full SwiftUI interface with native performance and macOS integration
- **Containerized Backend**: All AI, database, and monitoring services run in isolated Docker containers
- **High-Quality TTS**: Kokoro TTS service (MLX Audio) provides natural-sounding speech

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ATHENA SWIFT APP                         │
│                   (Native macOS)                            │
│                                                             │
│  • SwiftUI Interface                                        │
│  • Native Performance                                       │
│  • macOS Integration                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTP/WebSocket
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              DOCKER BACKEND SERVICES                        │
│                                                             │
│  ┌───────────────────┐  ┌──────────────────┐              │
│  │   Backend API     │  │   MLX TTS        │              │
│  │   (FastAPI)       │  │   (Kokoro)       │              │
│  │   Port: 8013      │  │   Port: 8877     │              │
│  └───────────────────┘  └──────────────────┘              │
│                                                             │
│  ┌───────────────────┐  ┌──────────────────┐              │
│  │   PostgreSQL      │  │   Redis          │              │
│  │   Port: 5432      │  │   Port: 6379     │              │
│  └───────────────────┘  └──────────────────┘              │
│                                                             │
│  ┌───────────────────┐  ┌──────────────────┐              │
│  │   Netdata         │  │   Grafana        │              │
│  │   Port: 19999     │  │   Port: 3002     │              │
│  └───────────────────┘  └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- macOS 13.0 or later
- Docker Desktop for Mac
- Xcode Command Line Tools or Swift toolchain
- At least 8GB RAM available

### Starting Athena

```bash
cd /Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools
./start-athena.sh
```

This script will:
1. Stop any existing Docker services
2. Start all backend services in Docker
3. Wait for services to be healthy
4. Build the Swift app
5. Launch Athena

### Manual Start

If you prefer to start services manually:

```bash
# Start Docker backend
docker-compose -f docker-compose.swift-backend.yml up -d

# Build and run Swift app
cd NeuroForgeApp
swift build -c release
open .build/release/NeuroForgeApp.app
```

## Service Endpoints

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Backend API | 8013 | http://localhost:8013 | Main API endpoint |
| TTS Service | 8877 | http://localhost:8877 | Kokoro TTS |
| PostgreSQL | 5432 | localhost:5432 | Database |
| Redis | 6379 | localhost:6379 | Cache |
| Netdata | 19999 | http://localhost:19999 | Monitoring |
| Grafana | 3002 | http://localhost:3002 | Dashboards |
| Prometheus | 9090 | http://localhost:9090 | Metrics |

## Features

### ✅ Implemented

- **Native Chat Interface**: SwiftUI-based chat with message history
- **Text-to-Speech**: High-quality Kokoro TTS integration
- **Speech-to-Text**: Whisper integration for voice input
- **Screenshot Capture**: Take and share screenshots in chat
- **Backend Integration**: Full REST API connectivity
- **Conversation Persistence**: PostgreSQL-backed chat history
- **Real-time Monitoring**: Netdata tracking all services
- **Health Checks**: All services report health status

### 🚧 In Progress

- **Model Management**: Switch between different AI models
- **Advanced Orchestration**: TRM/HRM task routing
- **Learning System**: Feedback and improvement mechanisms
- **macOS Automation**: Native control of macOS features

## Configuration

### Backend API Connection

The Swift app connects to the backend API at `http://localhost:8013`. This is configured in:

```swift
// NeuroForgeApp/Sources/NeuroForgeApp/ChatService.swift
private let baseURL = "http://localhost:8013"
```

### TTS Configuration

TTS requests are proxied through the backend API:

```
Swift App -> Backend API (8013) -> MLX TTS (8877)
```

The backend handles voice selection and speed control:
- Available voices: sarah, jessica, etc.
- Speed options: slow, normal, fast

### Database

PostgreSQL stores:
- Conversation history
- User preferences
- System state

Connection string: `postgresql://postgres:postgres@localhost:5432/athena_db`

## Development

### Building the Swift App

```bash
cd NeuroForgeApp
swift build -c release
```

### Running Tests

```bash
cd NeuroForgeApp
swift test
```

### Development Mode

For hot-reload during development:

```bash
# Terminal 1: Start Docker services
docker-compose -f docker-compose.swift-backend.yml up

# Terminal 2: Run Swift app in development mode
cd NeuroForgeApp
swift run
```

## Monitoring

### Netdata Dashboard

Access comprehensive monitoring at http://localhost:19999

**Key Metrics:**
- Container CPU/Memory usage
- API request rates and latencies
- Database connections and queries
- TTS generation times
- Python process metrics

### Grafana Dashboards

Access at http://localhost:3002 (admin/admin)

**Pre-configured dashboards:**
- System overview
- Container metrics
- API performance
- Database health

## Troubleshooting

### Services Not Starting

```bash
# Check Docker status
docker ps

# View logs
docker-compose -f docker-compose.swift-backend.yml logs

# Restart services
docker-compose -f docker-compose.swift-backend.yml restart
```

### Swift App Not Connecting

1. **Check backend is running:**
   ```bash
   curl http://localhost:8013/health
   ```

2. **Check backend logs:**
   ```bash
   docker logs athena-backend-api
   ```

3. **Verify ports are open:**
   ```bash
   lsof -i :8013
   lsof -i :8877
   ```

### TTS Not Working

1. **Test TTS service directly:**
   ```bash
   curl -X POST http://localhost:8877/synthesize \
     -H "Content-Type: application/json" \
     -d '{"text":"test","voice":"sarah","speed":"normal"}'
   ```

2. **Test TTS proxy:**
   ```bash
   curl -X POST http://localhost:8013/api/tts/speak \
     -H "Content-Type: application/json" \
     -d '{"text":"test","voice":"sarah","speed":"normal"}'
   ```

3. **Check MLX TTS logs:**
   ```bash
   docker logs athena-mlx-tts
   ```

### Keyboard Input Issues

If you can't type in the app:
1. Ensure the app is running as a proper `.app` bundle (not from terminal)
2. Check that the TextField has focus (it should focus automatically)
3. Verify macOS accessibility permissions

### Enter Key Not Working

The app uses `TextField` with `.onSubmit` for Enter key handling. If this doesn't work:
1. Make sure you're running the latest build
2. Check that no other keyboard shortcuts are intercepting Enter
3. Verify the app has keyboard access permissions

## Stopping Services

```bash
# Stop all Docker services
docker-compose -f docker-compose.swift-backend.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.swift-backend.yml down -v

# Quit the Swift app
# Use Cmd+Q or quit from the menu
```

## Performance

### Expected Performance

- **API Response**: < 100ms (95th percentile)
- **TTS Generation**: 2-5 seconds for typical message
- **UI Rendering**: 60 FPS (16ms frame time)
- **Memory Usage**: ~200MB (Swift app) + ~2GB (Docker services)

### Optimization Tips

1. **Reduce Docker resource usage:**
   - Adjust Redis maxmemory in docker-compose
   - Limit PostgreSQL connections
   - Disable unused monitoring services

2. **Swift app optimization:**
   - Use `.lazy` modifiers for long message lists
   - Implement message pagination
   - Cache TTS audio locally

## Next Steps

1. **Add Voice Input**: Implement Whisper integration for speech-to-text
2. **Model Switching**: UI for selecting different AI models
3. **Advanced Features**: Integrate TRM/HRM orchestration
4. **Export Conversations**: Save chats to files
5. **Themes**: Light/dark mode customization
6. **Shortcuts**: Keyboard shortcuts for common actions

## Support

- **Documentation**: See `/docs` folder
- **Issues**: Check existing service logs
- **Performance**: Use Netdata dashboard
- **Debugging**: Enable debug logging in Swift app

## Credits

- **Swift/SwiftUI**: Apple
- **FastAPI**: Sebastián Ramírez
- **Kokoro TTS**: MLX Audio project
- **PostgreSQL**: PostgreSQL Global Development Group
- **Docker**: Docker, Inc.
- **Netdata**: Netdata, Inc.


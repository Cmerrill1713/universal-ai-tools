# Sweet Athena UE5 Avatar System - Deployment Guide

## 🌸 Overview

Sweet Athena is a photorealistic AI avatar system that integrates Unreal Engine 5 with a React/TypeScript web application. This guide covers the complete deployment process from development to production.

## 📋 Prerequisites

### System Requirements
- **macOS**: 13.0+ (for Metal 4 support)
- **RAM**: 16GB minimum, 32GB recommended
- **Storage**: 100GB free space
- **GPU**: Apple Silicon M1/M2/M3 or AMD GPU with Metal support

### Software Requirements
- **Node.js**: v20+ 
- **npm**: v10+
- **Unreal Engine**: 5.6+ (via Epic Games Launcher)
- **Xcode**: Latest version (for Metal development)
- **Docker**: (optional, for containerized deployment)

## 🚀 Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd universal-ai-tools

# Install dependencies
npm install

# Set up UE5 project
cd ~/UE5-SweetAthena
chmod +x Scripts/StartPixelStreaming.sh

# Start all services
./Scripts/StartPixelStreaming.sh
```

## 📦 Installation Steps

### 1. Install Unreal Engine 5.6

1. Download Epic Games Launcher from [unrealengine.com](https://www.unrealengine.com/download)
2. Sign in or create an Epic Games account
3. Navigate to Unreal Engine tab
4. Install Unreal Engine 5.6 (select macOS platform)
5. Install additional content:
   - MetaHuman Plugin
   - Pixel Streaming Plugin
   - Live Link Face iOS

### 2. Set Up Sweet Athena UE5 Project

```bash
# Open the project in UE5
open ~/UE5-SweetAthena/SweetAthenaUE5Project.uproject

# First time setup:
# 1. Let UE5 compile shaders (this may take 10-30 minutes)
# 2. Accept any plugin installation prompts
# 3. Configure project settings for your Mac
```

### 3. Configure Environment Variables

Create `.env` file in the root directory:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Sweet Athena Configuration
SWEET_ATHENA_UE5_PATH=$HOME/UE5-SweetAthena
PIXEL_STREAMING_PORT=8888
SIGNALLING_SERVER_PORT=8080
WEB_SERVER_PORT=80

# Convai Configuration (for voice)
CONVAI_API_KEY=your_convai_api_key
CONVAI_CHARACTER_ID=your_character_id

# Optional: OpenAI for enhanced conversations
OPENAI_API_KEY=your_openai_key
```

### 4. Install MetaHuman Creator

1. Open Epic Games Launcher
2. Go to Marketplace → MetaHuman
3. Launch MetaHuman Creator (web-based)
4. Create your Sweet Athena character:
   - Choose feminine preset
   - Customize appearance to match Sweet Athena aesthetic
   - Export to UE5 project

### 5. Build and Configure Services

```bash
# Build TypeScript services
npm run build

# Initialize database
npm run db:migrate

# Test the installation
npm test -- --run tests/services/sweet-athena-state-manager.test.ts
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   React App     │  │  WebRTC      │  │  WebSocket   │  │
│  │  (TypeScript)   │  │  Video       │  │  Commands    │  │
│  └────────┬────────┘  └──────┬───────┘  └──────┬───────┘  │
└───────────┼───────────────────┼──────────────────┼──────────┘
            │                   │                  │
            ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Backend                           │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Express API    │  │  Signalling  │  │  State       │  │
│  │  Router         │  │  Server      │  │  Manager     │  │
│  └────────┬────────┘  └──────┬───────┘  └──────┬───────┘  │
└───────────┼───────────────────┼──────────────────┼──────────┘
            │                   │                  │
            ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Unreal Engine 5                          │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Sweet Athena   │  │   Pixel      │  │   Convai     │  │
│  │  Character      │  │  Streaming   │  │   Voice      │  │
│  └─────────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🎮 Running Sweet Athena

### Development Mode

```bash
# Terminal 1: Start backend services
npm run dev

# Terminal 2: Start Pixel Streaming
cd ~/UE5-SweetAthena
./Scripts/StartPixelStreaming.sh

# Terminal 3: Open UE5 and hit Play
# The UE5 application will connect to the signalling server automatically
```

### Production Mode

```bash
# Build for production
npm run build

# Start with PM2
npm install -g pm2
pm2 start ecosystem.config.js

# Or use Docker
docker-compose up -d
```

## 🔧 Configuration Options

### Personality Modes
- **Sweet**: Default, caring and friendly
- **Shy**: Timid and reserved
- **Confident**: Assertive and bold
- **Caring**: Empathetic and nurturing
- **Playful**: Fun and energetic

### Clothing Levels
- **Conservative**: Professional attire
- **Moderate**: Casual wear (default)
- **Revealing**: Summer/beach wear
- **Very Revealing**: Minimal coverage

### Voice Settings
Configure in `DefaultEngine.ini`:
```ini
[/Script/ConvAI.ConvAISettings]
DefaultVoiceProfile=female_1
EnableLipSync=True
EnableFacialExpressions=True
AudioSampleRate=16000
```

## 📱 API Endpoints

### Status Check
```bash
GET /api/sweet-athena/status
Authorization: Bearer <token>
```

### Change Personality
```bash
POST /api/sweet-athena/personality
Content-Type: application/json
Authorization: Bearer <token>

{
  "personality": "playful",
  "adaptation": {
    "context": "user wants entertainment"
  }
}
```

### Update Clothing
```bash
POST /api/sweet-athena/clothing
Content-Type: application/json
Authorization: Bearer <token>

{
  "level": "moderate",
  "customization": {
    "top": { "color": "#FF6B6B" }
  }
}
```

### Voice Interaction
```bash
POST /api/sweet-athena/voice/start
Authorization: Bearer <token>

POST /api/sweet-athena/voice/stop
Authorization: Bearer <token>
```

## 🐳 Docker Deployment

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
    volumes:
      - ./config:/app/config
    depends_on:
      - redis
      - postgres

  signalling:
    build: ./UE5-SweetAthena/Scripts/SignallingServer
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production

  web:
    build: ./UE5-SweetAthena/Scripts/WebServer
    ports:
      - "80:80"
    volumes:
      - ./UE5-SweetAthena/Scripts/WebServer/public:/app/public

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: sweet_athena
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 🔒 Security Considerations

1. **Authentication**: All API endpoints require JWT authentication
2. **HTTPS**: Use SSL certificates in production
3. **CORS**: Configure allowed origins in `config/security.ts`
4. **Rate Limiting**: Adjust limits based on usage patterns
5. **Content Filtering**: Implement appropriate content moderation

## 🚨 Troubleshooting

### Common Issues

1. **"Pixel Streaming not connecting"**
   - Check firewall settings for ports 8080, 8888
   - Ensure UE5 project is running with `-PixelStreamingURL` parameter

2. **"Character not appearing"**
   - Verify MetaHuman is properly imported
   - Check character blueprint references in UE5

3. **"Voice not working"**
   - Confirm Convai API key is valid
   - Check microphone permissions in browser

4. **"Performance issues"**
   - Lower streaming resolution in `DefaultEngine.ini`
   - Reduce quality settings in UE5 project
   - Enable GPU acceleration in Docker

### Debug Commands

```bash
# Check service health
curl http://localhost:3002/api/health

# Test Pixel Streaming connection
npm run test:pixel-streaming

# View logs
pm2 logs sweet-athena

# Monitor performance
npm run monitor
```

## 📈 Performance Optimization

### UE5 Settings
```ini
[/Script/Engine.RendererSettings]
r.DefaultFeature.AntiAliasing=2
r.PostProcessAAQuality=3
r.Shadow.MaxCSMResolution=2048
r.VolumetricFog=0
```

### Streaming Optimization
- Use hardware encoding (NVENC/VideoToolbox)
- Adjust bitrate based on network conditions
- Enable adaptive quality in `pixel-streaming-bridge.ts`

## 🎯 Next Steps

1. **Customize Avatar**: Import your MetaHuman character
2. **Train Voice Model**: Fine-tune Convai for your use case
3. **Add Animations**: Create custom animation blueprints
4. **Extend API**: Add domain-specific endpoints
5. **Scale Infrastructure**: Deploy to cloud with auto-scaling

## 📚 Additional Resources

- [UE5 Pixel Streaming Documentation](https://docs.unrealengine.com/5.0/en-US/pixel-streaming)
- [MetaHuman Creator Guide](https://docs.metahuman.unrealengine.com/)
- [Convai Documentation](https://docs.convai.com/)
- [Project Repository Wiki](https://github.com/your-repo/wiki)

## 🤝 Support

For issues or questions:
1. Check the [troubleshooting guide](#-troubleshooting)
2. Search existing GitHub issues
3. Create a new issue with logs and system info
4. Join our Discord community

---

Built with 💜 by Universal AI Tools Team
# Universal AI Tools - Setup Requirements & Documentation

## 🚀 System Requirements

### ✅ Verified Working Versions
- **Go**: `go1.24.5 darwin/arm64`
- **Python3**: `Python 3.9.6`
- **Node.js**: `v24.4.1`
- **Rust**: `rustc 1.89.0 (29483883e 2025-08-04)`

### 📦 Required Package Managers
- **npm**: `/opt/homebrew/bin/npm`
- **cargo**: `/Users/christianmerrill/.cargo/bin/cargo`
- **pip3**: `/usr/bin/pip3`

## 🔧 Current Issues & Solutions

### 1. Node.js Dependencies Issues ✅ FIXED
**Problem**: Missing `ioredis` package
```bash
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'ioredis'
```

**Solution**: 
```bash
npm install ioredis --legacy-peer-deps
npm install tsx --legacy-peer-deps
```

### 2. Go Services Issues ✅ FIXED
**Problem**: Missing `SecretsManager` dependency
```bash
./main.go:47:18: undefined: SecretsManager
./main.go:73:19: undefined: NewSecretsManager
```

**Solution**: 
- `SecretsManager` is defined in `secrets-manager.go`
- Run `go build .` to compile properly
- Use `PORT=8080 ./api-gateway` to start

### 3. Python Services Issues ✅ FIXED
**Problem**: `python` command not found
```bash
zsh: command not found: python
```

**Solution**: 
- Use `python3` instead of `python`
- Create symlink: `ln -s /usr/bin/python3 /usr/local/bin/python`
- Or update scripts to use `python3`

### 4. Python Script Syntax Error ✅ FIXED
**Problem**: Syntax error in `run_services_parallel.py`
```python
f"    ⚠️  {service_name} responded with status {
                                                        ^
SyntaxError: EOL while scanning string literal
```

**Solution**: Fixed the f-string syntax on line 196

### 5. Permission Issues ✅ FIXED
**Problem**: Quick start script permission denied
```bash
zsh: permission denied: ./quick-start.sh
```

**Solution**: 
```bash
chmod +x quick-start.sh
```

## 🏗️ Architecture Overview

### Multi-Language Backend
- **Rust Services**: High-performance ML and AI services
- **Go Services**: Fast, concurrent web services  
- **Python Services**: AI/ML orchestration and specialized services
- **Single Program**: All services managed through unified server

### Service Ports
- **Main API**: `http://localhost:9999` ✅ **WORKING**
- **Health Check**: `http://localhost:9999/health` ✅ **RESPONDING**
- **API Docs**: `http://localhost:9999/api/docs`
- **WebSocket**: `ws://localhost:9999`
- **Redis**: `redis://localhost:6379` ✅ **WORKING**
- **Supabase**: `http://localhost:54321` ✅ **WORKING**
- **Go API Gateway**: Port 8080
- **Auth Service**: Port 8015
- **Chat Service**: Port 8016
- **Memory Service**: Port 8017
- **ML Inference (Rust)**: Port 8084
- **LLM Router (Rust)**: Port 3031
- **Parameter Analytics (Rust)**: Port 3032

## 📋 Setup Steps

### 1. Prerequisites Installation
```bash
# Install Go (if not installed)
brew install go

# Install Python3 (if not installed)
brew install python3

# Install Node.js (if not installed)
brew install node

# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Dependencies Setup
```bash
# Go dependencies
cd go-services/
go mod tidy
go mod download

# Python dependencies
pip3 install -r requirements.txt

# Node.js dependencies
npm install

# Rust dependencies
cargo build
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 4. Service Startup Options

#### Option A: Working Server (Recommended) ✅ WORKING
```bash
# Install dependencies first
npm install ioredis --legacy-peer-deps
npm install limiter --legacy-peer-deps
npm install tsx --legacy-peer-deps

# Configure Supabase (add to .env)
echo "SUPABASE_URL=http://localhost:54321" >> .env
echo "SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" >> .env
echo "SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" >> .env

# Configure Redis (add to .env)
echo "REDIS_URL=redis://localhost:6379" >> .env
echo "REDIS_HOST=localhost" >> .env
echo "REDIS_PORT=6379" >> .env

# Start Redis server
redis-server --daemonize yes --port 6379

# Start the working server (runs on port 9999)
npx tsx src/server-working.ts
```

#### Option B: Go API Gateway ✅ WORKING
```bash
# Build and start Go service
cd go-services/api-gateway
go build .
PORT=8080 ./api-gateway
```

#### Option C: Quick Start Script
```bash
# Fix permissions
chmod +x quick-start.sh

# Start unified server
./quick-start.sh
```

#### Option D: Individual Services
```bash
# Start Python services
cd python-services/dspy-orchestrator
python3 main.py

# Start Rust services
cd rust-services/ml-inference-service
cargo run --release
```

#### Option E: Parallel Service Manager ✅ FIXED
```bash
# Python script syntax error has been fixed
python3 run_services_parallel.py
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill process on port 8080
   lsof -ti:8080 | xargs kill -9
   ```

2. **Missing Dependencies**
   ```bash
   # Go modules
   go mod tidy
   
   # Python packages
   pip3 install -r requirements.txt
   
   # Node modules
   npm install
   ```

3. **Permission Denied**
   ```bash
   # Make scripts executable
   chmod +x *.sh
   ```

4. **Python Command Not Found**
   ```bash
   # Create symlink
   ln -s /usr/bin/python3 /usr/local/bin/python
   ```

## 📱 Frontend Setup

### Swift macOS App
- **Xcode Project**: `UniversalAIToolsMac.xcodeproj`
- **Enhanced Features**: Theme management, model selection, performance metrics
- **Build Command**: ⌘+R in Xcode

### Web Frontend
- **Location**: `ui/` directory
- **Start Command**: `npm run dev`
- **Port**: 3000

## 🔍 Verification

### Health Checks
```bash
# Main API health
curl http://localhost:8080/health

# Service status
./status-go-rust.sh

# Port check
lsof -i :8080
```

### Logs
- **Go Services**: `logs/go-*.log`
- **Python Services**: `logs/python-*.log`
- **Rust Services**: `logs/rust-*.log`

## 📚 Additional Resources

- **API Documentation**: `http://localhost:8080/api/docs`
- **WebSocket**: `ws://localhost:8080`
- **Service Management**: `./start-go-rust.sh` and `./stop-go-rust.sh`

## 🎯 Next Steps

1. Fix the identified issues above
2. Run dependency installation commands
3. Start services using preferred method
4. Verify all endpoints are responding
5. Test Swift frontend connection to backend

---

**Last Updated**: $(date)
**Status**: Documentation created, issues identified, solutions provided

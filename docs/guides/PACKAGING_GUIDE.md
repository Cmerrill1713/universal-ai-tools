# 📦 Universal AI Tools - Packaging Guide

This guide covers all the packaging and deployment options for Universal AI Tools.

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)
```bash
# Clone and start
git clone https://github.com/your-repo/universal-ai-tools.git
cd universal-ai-tools
docker-compose up -d

# Check status
docker-compose ps
curl http://localhost:8086/health
```

### Option 2: Automated Installation
```bash
# Download and run installer
curl -fsSL https://raw.githubusercontent.com/your-repo/universal-ai-tools/main/scripts/install.sh | bash

# Or with Docker support
curl -fsSL https://raw.githubusercontent.com/your-repo/universal-ai-tools/main/scripts/install.sh | bash -s -- --docker --systemd
```

### Option 3: Manual Installation
```bash
# Build from source
cargo build --release --workspace

# Start services
./target/release/llm-router &
./target/release/intelligent-librarian &
./target/release/assistantd &
```

## 🐳 Docker Deployment

### Single Container Services

Each service can be run independently:

```bash
# Assistant Service
docker run -d \
  --name universal-ai-assistant \
  -p 8086:8086 \
  -e DATABASE_URL=postgresql://postgres:password@host.docker.internal:5432/universal_ai_tools \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e LLM_ROUTER_URL=http://host.docker.internal:3033 \
  universal-ai-tools/assistantd:latest

# LLM Router
docker run -d \
  --name universal-ai-llm-router \
  -p 3033:3033 \
  -e OLLAMA_URL=http://host.docker.internal:11434 \
  universal-ai-tools/llm-router:latest

# Intelligent Librarian
docker run -d \
  --name universal-ai-librarian \
  -p 8082:8082 \
  -e DATABASE_URL=postgresql://postgres:password@host.docker.internal:5432/universal_ai_tools \
  universal-ai-tools/intelligent-librarian:latest
```

### Docker Compose Stack

```bash
# Production deployment
docker-compose up -d

# Development with hot reload
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d

# View logs
docker-compose logs -f assistantd

# Scale services
docker-compose up -d --scale assistantd=3
```

### Docker Images

| Service | Image | Description |
|---------|-------|-------------|
| Assistant | `universal-ai-tools/assistantd:latest` | Main AI assistant service |
| LLM Router | `universal-ai-tools/llm-router:latest` | LLM routing and management |
| Librarian | `universal-ai-tools/intelligent-librarian:latest` | Knowledge management |

## 📦 System Packages

### Debian/Ubuntu (.deb)
```bash
# Install dependencies
sudo apt-get update
sudo apt-get install -y postgresql redis-server

# Install package
sudo dpkg -i universal-ai-tools_0.1.0_amd64.deb

# Configure and start
sudo systemctl enable universal-ai-assistant
sudo systemctl start universal-ai-assistant
```

### Red Hat/CentOS (.rpm)
```bash
# Install dependencies
sudo yum install -y postgresql redis

# Install package
sudo rpm -i universal-ai-tools-0.1.0-1.x86_64.rpm

# Configure and start
sudo systemctl enable universal-ai-assistant
sudo systemctl start universal-ai-assistant
```

### macOS (Homebrew)
```bash
# Add tap
brew tap universal-ai-tools/universal-ai-tools

# Install
brew install universal-ai-tools

# Start services
brew services start universal-ai-tools
```

## 🌍 Cross-Platform Binaries

### Available Platforms

| Platform | Architecture | Package |
|----------|-------------|---------|
| Linux | x86_64 | `universal-ai-tools-0.1.0-linux-x86_64.tar.gz` |
| Linux (musl) | x86_64 | `universal-ai-tools-0.1.0-linux-x86_64-musl.tar.gz` |
| macOS | x86_64 | `universal-ai-tools-0.1.0-macos-x86_64.tar.gz` |
| macOS | ARM64 | `universal-ai-tools-0.1.0-macos-aarch64.tar.gz` |
| Windows | x86_64 | `universal-ai-tools-0.1.0-windows-x86_64.zip` |

### Installation from Binary

```bash
# Download and extract
wget https://github.com/your-repo/universal-ai-tools/releases/latest/download/universal-ai-tools-0.1.0-linux-x86_64.tar.gz
tar -xzf universal-ai-tools-0.1.0-linux-x86_64.tar.gz
cd universal-ai-tools-0.1.0-linux-x86_64

# Install dependencies (PostgreSQL, Redis, Ollama)
# See dependency installation guide

# Configure
cp env.example .env
# Edit .env with your settings

# Start services
./assistantd &
./llm-router &
./intelligent-librarian &
```

## 🏗️ Building from Source

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install system dependencies
# Ubuntu/Debian
sudo apt-get install -y pkg-config libssl-dev libpq-dev

# macOS
brew install pkg-config openssl postgresql
```

### Build Commands

```bash
# Development build
cargo build

# Release build
cargo build --release

# Build specific service
cargo build --release -p assistantd

# Build with optimizations
RUSTFLAGS="-C target-cpu=native" cargo build --release
```

### Cross-Compilation

```bash
# Install targets
rustup target add x86_64-unknown-linux-gnu
rustup target add x86_64-apple-darwin
rustup target add x86_64-pc-windows-gnu

# Build for different platforms
cargo build --release --target x86_64-unknown-linux-gnu
cargo build --release --target x86_64-apple-darwin
cargo build --release --target x86_64-pc-windows-gnu
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ASSISTANTD_PORT` | 8086 | Assistant service port |
| `LLM_ROUTER_PORT` | 3033 | LLM router port |
| `LIBRARIAN_PORT` | 8082 | Librarian service port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `REDIS_URL` | redis://localhost:6379 | Redis connection string |
| `OLLAMA_URL` | http://localhost:11434 | Ollama server URL |
| `RATE_LIMITING_ENABLED` | true | Enable rate limiting |
| `AUTHENTICATION_ENABLED` | false | Enable authentication |
| `CORS_ENABLED` | true | Enable CORS headers |

### Configuration Files

- **Environment**: `.env` (copy from `env.example`)
- **Docker Compose**: `docker-compose.yml`
- **Systemd Services**: `/etc/systemd/system/universal-ai-*.service`
- **Logging**: Configured via `RUST_LOG` environment variable

## 🔍 Monitoring & Health Checks

### Health Endpoints

```bash
# Service health
curl http://localhost:8086/health
curl http://localhost:3033/health
curl http://localhost:8082/health

# Detailed health
curl http://localhost:8086/health/detailed

# Metrics
curl http://localhost:8086/metrics
```

### Monitoring Stack

```bash
# Start with monitoring
docker-compose -f docker-compose.yml -f monitoring/docker-compose.monitoring.yml up -d

# Access dashboards
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (if enabled)
```

## 🚀 Production Deployment

### Kubernetes

```yaml
# Example Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: universal-ai-assistant
spec:
  replicas: 3
  selector:
    matchLabels:
      app: universal-ai-assistant
  template:
    metadata:
      labels:
        app: universal-ai-assistant
    spec:
      containers:
      - name: assistantd
        image: universal-ai-tools/assistantd:latest
        ports:
        - containerPort: 8086
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: universal-ai-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /health
            port: 8086
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8086
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml universal-ai-tools

# Scale services
docker service scale universal-ai-tools_assistantd=3
```

### Cloud Platforms

#### AWS ECS
```bash
# Build and push images
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-west-2.amazonaws.com
docker tag universal-ai-tools/assistantd:latest 123456789012.dkr.ecr.us-west-2.amazonaws.com/universal-ai-tools/assistantd:latest
docker push 123456789012.dkr.ecr.us-west-2.amazonaws.com/universal-ai-tools/assistantd:latest
```

#### Google Cloud Run
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT-ID/universal-ai-tools
gcloud run deploy universal-ai-tools --image gcr.io/PROJECT-ID/universal-ai-tools --platform managed
```

## 🔒 Security Considerations

### Production Hardening

```bash
# Enable authentication
export AUTHENTICATION_ENABLED=true

# Configure secure passwords
export POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Enable TLS
export TLS_ENABLED=true
export TLS_CERT_PATH=/path/to/cert.pem
export TLS_KEY_PATH=/path/to/key.pem

# Configure CORS origins
export CORS_ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
```

### Network Security

```yaml
# Docker Compose with network isolation
version: '3.8'
services:
  assistantd:
    networks:
      - frontend
      - backend
  postgres:
    networks:
      - backend
    expose:
      - "5432"

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true
```

## 📊 Performance Tuning

### Resource Limits

```yaml
# Docker Compose with resource limits
services:
  assistantd:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

### Database Optimization

```sql
-- PostgreSQL optimization
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
SELECT pg_reload_conf();
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check port usage
   lsof -i :8086
   netstat -tlnp | grep :8086
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connection
   psql $DATABASE_URL -c "SELECT version();"
   ```

3. **Service Startup Issues**
   ```bash
   # Check logs
   docker-compose logs assistantd
   journalctl -u universal-ai-assistant -f
   ```

4. **Memory Issues**
   ```bash
   # Monitor memory usage
   docker stats
   free -h
   ```

### Debug Mode

```bash
# Enable debug logging
export RUST_LOG=debug
export DEBUG=true

# Run with verbose output
cargo run --release -p assistantd
```

## 📚 Additional Resources

- **GitHub Repository**: https://github.com/your-repo/universal-ai-tools
- **Documentation**: https://docs.universal-ai-tools.com
- **Docker Hub**: https://hub.docker.com/r/universal-ai-tools
- **Issue Tracker**: https://github.com/your-repo/universal-ai-tools/issues
- **Community Forum**: https://community.universal-ai-tools.com

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to:

- Report bugs
- Suggest features
- Submit pull requests
- Join the community

## 📄 License

Universal AI Tools is licensed under the MIT License. See [LICENSE](LICENSE) for details.

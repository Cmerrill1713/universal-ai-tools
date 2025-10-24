# Deployment and Operations Guide

## Overview

This guide provides comprehensive instructions for deploying and operating the Universal AI Tools platform in various environments, from development to production.

## Prerequisites

### System Requirements

- **CPU**: 8+ cores recommended
- **Memory**: 16GB+ RAM recommended
- **Storage**: 100GB+ SSD storage
- **Network**: 1Gbps+ bandwidth
- **OS**: Linux (Ubuntu 20.04+), macOS, or Windows with WSL2

### Software Dependencies

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Rust**: 1.70+
- **Go**: 1.21+
- **Python**: 3.9+
- **Node.js**: 18+ (optional)
- **PostgreSQL**: 14+
- **Redis**: 6.0+
- **NATS**: 2.9+

## Development Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/universal-ai-tools.git
cd universal-ai-tools
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 3. Start Infrastructure Services

```bash
# Start databases and message broker
docker-compose up -d postgres redis nats weaviate

# Wait for services to be ready
sleep 30
```

### 4. Build and Start Services

```bash
# Build Rust services
cargo build --workspace

# Start Go services
cd go-services/auth-service && go run main.go &
cd go-services/api-gateway && go run main.go &
cd go-services/memory-service && go run main.go &
cd go-services/chat-service && go run main.go &
cd go-services/fast-llm-service && go run main.go &
cd go-services/load-balancer && go run main.go &
cd go-services/websocket-hub && go run main.go &
cd go-services/cache-coordinator && go run main.go &
cd go-services/metrics-aggregator && go run main.go &
cd go-services/parameter-analytics && go run main.go &

# Start Rust services
cargo run -p llm-router &
cargo run -p ml-inference &
cargo run -p vision-service &
cargo run -p vector-db &
cargo run -p assistantd &
```

### 5. Verify Deployment

```bash
# Check service health
curl http://localhost:8080/health  # API Gateway
curl http://localhost:3033/health  # LLM Router
curl http://localhost:8091/health  # ML Inference
curl http://localhost:8084/health  # Vision Service
curl http://localhost:8085/health  # Vector DB
curl http://localhost:8086/health  # Assistantd
curl http://localhost:8017/health  # Memory Service
```

## Production Deployment

### Docker Compose Production Setup

#### 1. Production Environment File

```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=info

# Database Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=universal_ai_tools
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# NATS Configuration
NATS_URL=nats://nats:4222

# Service Ports
API_GATEWAY_PORT=8080
LLM_ROUTER_PORT=3033
ML_INFERENCE_PORT=8091
VISION_SERVICE_PORT=8084
VECTOR_DB_PORT=8085
ASSISTANTD_PORT=8086
MEMORY_SERVICE_PORT=8017
AUTH_SERVICE_PORT=8015
CHAT_SERVICE_PORT=8016
FAST_LLM_PORT=3030
LOAD_BALANCER_PORT=8011
WEBSOCKET_HUB_PORT=8018
CACHE_COORDINATOR_PORT=8012
METRICS_AGGREGATOR_PORT=8013
PARAMETER_ANALYTICS_PORT=3032

# Security
JWT_SECRET=your_jwt_secret_key
API_KEY_SECRET=your_api_key_secret

# External Services
OLLAMA_BASE_URL=http://ollama:11434
WEAVIATE_URL=http://weaviate:8080
```

#### 2. Production Docker Compose

```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  # Infrastructure Services
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: universal_ai_tools
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  nats:
    image: nats:2.9-alpine
    ports:
      - "4222:4222"
      - "8222:8222"
    restart: unless-stopped

  weaviate:
    image: semitechnologies/weaviate:latest
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: "true"
      PERSISTENCE_DATA_PATH: "/var/lib/weaviate"
      DEFAULT_VECTORIZER_MODULE: "none"
    volumes:
      - weaviate_data:/var/lib/weaviate
    ports:
      - "8080:8080"
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    restart: unless-stopped

  # Go Services
  api-gateway:
    build:
      context: .
      dockerfile: go-services/api-gateway/Dockerfile
    environment:
      - PORT=${API_GATEWAY_PORT}
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "${API_GATEWAY_PORT}:${API_GATEWAY_PORT}"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  memory-service:
    build:
      context: .
      dockerfile: go-services/memory-service/Dockerfile
    environment:
      - PORT=${MEMORY_SERVICE_PORT}
      - DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/universal_ai_tools
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - WEAVIATE_URL=http://weaviate:8080
    ports:
      - "${MEMORY_SERVICE_PORT}:${MEMORY_SERVICE_PORT}"
    depends_on:
      - postgres
      - redis
      - weaviate
    restart: unless-stopped

  auth-service:
    build:
      context: .
      dockerfile: go-services/auth-service/Dockerfile
    environment:
      - PORT=${AUTH_SERVICE_PORT}
      - DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/universal_ai_tools
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "${AUTH_SERVICE_PORT}:${AUTH_SERVICE_PORT}"
    depends_on:
      - postgres
    restart: unless-stopped

  # Rust Services
  llm-router:
    build:
      context: .
      dockerfile: crates/llm-router/Dockerfile
    environment:
      - PORT=${LLM_ROUTER_PORT}
      - OLLAMA_BASE_URL=http://ollama:11434
    ports:
      - "${LLM_ROUTER_PORT}:${LLM_ROUTER_PORT}"
    depends_on:
      - ollama
    restart: unless-stopped

  ml-inference:
    build:
      context: .
      dockerfile: crates/ml-inference/Dockerfile
    environment:
      - PORT=${ML_INFERENCE_PORT}
    ports:
      - "${ML_INFERENCE_PORT}:${ML_INFERENCE_PORT}"
    restart: unless-stopped

  vision-service:
    build:
      context: .
      dockerfile: crates/vision-service/Dockerfile
    environment:
      - PORT=${VISION_SERVICE_PORT}
    ports:
      - "${VISION_SERVICE_PORT}:${VISION_SERVICE_PORT}"
    restart: unless-stopped

  vector-db:
    build:
      context: .
      dockerfile: crates/vector-db/Dockerfile
    environment:
      - PORT=${VECTOR_DB_PORT}
      - VECTOR_DB_PERSISTENCE=true
    ports:
      - "${VECTOR_DB_PORT}:${VECTOR_DB_PORT}"
    restart: unless-stopped

  assistantd:
    build:
      context: .
      dockerfile: crates/assistantd/Dockerfile
    environment:
      - PORT=${ASSISTANTD_PORT}
      - MEMORY_SERVICE_URL=http://memory-service:${MEMORY_SERVICE_PORT}
      - LLM_ROUTER_URL=http://llm-router:${LLM_ROUTER_PORT}
    ports:
      - "${ASSISTANTD_PORT}:${ASSISTANTD_PORT}"
    depends_on:
      - memory-service
      - llm-router
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  weaviate_data:
  ollama_data:
```

#### 3. Dockerfiles

**Go Service Dockerfile**

```dockerfile
# go-services/api-gateway/Dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go-services/api-gateway/ .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
CMD ["./main"]
```

**Rust Service Dockerfile**

```dockerfile
# crates/llm-router/Dockerfile
FROM rust:1.70 as builder

WORKDIR /app
COPY . .
RUN cargo build --release --bin llm-router

FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/llm-router /usr/local/bin/
CMD ["llm-router"]
```

### Kubernetes Deployment

#### 1. Namespace and ConfigMap

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: universal-ai-tools

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: universal-ai-tools-config
  namespace: universal-ai-tools
data:
  POSTGRES_HOST: postgres
  REDIS_HOST: redis
  NATS_URL: nats://nats:4222
  WEAVIATE_URL: http://weaviate:8080
  OLLAMA_BASE_URL: http://ollama:11434
```

#### 2. Service Deployments

```yaml
# k8s/api-gateway-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: universal-ai-tools
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
        - name: api-gateway
          image: universal-ai-tools/api-gateway:latest
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: universal-ai-tools-config
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: universal-ai-tools
spec:
  selector:
    app: api-gateway
  ports:
    - port: 8080
      targetPort: 8080
  type: LoadBalancer
```

#### 3. Ingress Configuration

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: universal-ai-tools-ingress
  namespace: universal-ai-tools
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
    - hosts:
        - api.yourdomain.com
      secretName: universal-ai-tools-tls
  rules:
    - host: api.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-gateway
                port:
                  number: 8080
```

## Monitoring and Observability

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "universal-ai-tools"
    static_configs:
      - targets:
          - "api-gateway:8080"
          - "llm-router:3033"
          - "ml-inference:8091"
          - "vision-service:8084"
          - "vector-db:8085"
          - "assistantd:8086"
          - "memory-service:8017"
    metrics_path: /metrics
    scrape_interval: 5s
```

### Grafana Dashboards

```json
{
  "dashboard": {
    "title": "Universal AI Tools Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{service}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx Errors"
          }
        ]
      }
    ]
  }
}
```

## Operations Procedures

### Health Checks

```bash
#!/bin/bash
# scripts/health-check.sh

SERVICES=(
  "http://localhost:8080/health:API Gateway"
  "http://localhost:3033/health:LLM Router"
  "http://localhost:8091/health:ML Inference"
  "http://localhost:8084/health:Vision Service"
  "http://localhost:8085/health:Vector DB"
  "http://localhost:8086/health:Assistantd"
  "http://localhost:8017/health:Memory Service"
)

for service in "${SERVICES[@]}"; do
  url=$(echo $service | cut -d: -f1-3)
  name=$(echo $service | cut -d: -f4)

  if curl -f -s $url > /dev/null; then
    echo "✅ $name is healthy"
  else
    echo "❌ $name is unhealthy"
    exit 1
  fi
done

echo "🎉 All services are healthy!"
```

### Backup Procedures

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
pg_dump -h localhost -U postgres universal_ai_tools > $BACKUP_DIR/postgres.sql

# Backup Redis
redis-cli --rdb $BACKUP_DIR/redis.rdb

# Backup Weaviate
curl -X GET "http://localhost:8080/v1/backups" > $BACKUP_DIR/weaviate.json

# Compress backup
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

echo "Backup completed: $BACKUP_DIR.tar.gz"
```

### Log Management

```bash
#!/bin/bash
# scripts/log-rotation.sh

LOG_DIR="/var/log/universal-ai-tools"
RETENTION_DAYS=30

# Rotate logs older than retention period
find $LOG_DIR -name "*.log" -mtime +$RETENTION_DAYS -delete

# Compress old logs
find $LOG_DIR -name "*.log" -mtime +7 -exec gzip {} \;

echo "Log rotation completed"
```

## Troubleshooting

### Common Issues

#### 1. Service Won't Start

```bash
# Check logs
docker logs <container_name>

# Check resource usage
docker stats

# Check network connectivity
docker network ls
docker network inspect <network_name>
```

#### 2. Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -U postgres -d universal_ai_tools -c "SELECT 1;"

# Test Redis connection
redis-cli ping

# Check database logs
docker logs postgres
```

#### 3. High Memory Usage

```bash
# Check memory usage
free -h
docker stats

# Check for memory leaks
go tool pprof http://localhost:6060/debug/pprof/heap
```

### Performance Tuning

#### 1. Database Optimization

```sql
-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Analyze table statistics
ANALYZE;

-- Reindex if needed
REINDEX DATABASE universal_ai_tools;
```

#### 2. Service Scaling

```bash
# Scale services
docker-compose up -d --scale api-gateway=3
docker-compose up -d --scale llm-router=2

# Kubernetes scaling
kubectl scale deployment api-gateway --replicas=5
```

## Security Considerations

### 1. Network Security

- Use TLS/SSL for all communications
- Implement network segmentation
- Use firewalls to restrict access

### 2. Authentication

- Rotate JWT secrets regularly
- Implement API key rotation
- Use strong passwords for databases

### 3. Data Protection

- Encrypt sensitive data at rest
- Use secure communication protocols
- Implement proper access controls

This deployment guide provides comprehensive instructions for deploying and operating the Universal AI Tools platform in various environments.

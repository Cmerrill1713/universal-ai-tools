# Go Services Layer - High-Performance Middleware

This directory contains the Go-based middleware services that provide high-performance coordination between Rust services and the Node.js backend.

## Architecture Overview

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Node.js   │◄──►│ Go Services  │◄──►│ Rust Services   │
│  (Backend)  │    │ (Middleware) │    │ (Performance)   │
└─────────────┘    └──────────────┘    └─────────────────┘
```

## Services

### 1. **Message Broker** (Port 8081)
- Real-time message routing between services
- WebSocket connections for bidirectional communication
- NATS integration for persistent messaging
- Automatic service discovery and routing

### 2. **Load Balancer** (Port 8082)
- Intelligent routing to Rust services
- Health checking and failover
- Request/response metrics
- Weighted load distribution

### 3. **Cache Coordinator** (Port 8083)
- Two-tier caching (local + Redis)
- Service-specific cache namespaces
- LRU eviction policies
- Batch operations support

### 4. **Stream Processor** (Port 8084)
- Real-time stream processing
- Multi-format support (vision, audio, parameters)
- WebSocket subscriptions
- Backpressure handling

## Quick Start

### Prerequisites
- Go 1.21 or higher
- Docker and Docker Compose
- Redis (for cache coordinator)
- NATS (for message broker)

### Local Development

1. **Install dependencies:**
```bash
make setup
```

2. **Start infrastructure services:**
```bash
docker-compose up -d nats redis
```

3. **Run all services:**
```bash
make run-all
```

Or run individual services:
```bash
make run-message-broker
make run-load-balancer
make run-cache-coordinator
make run-stream-processor
```

### Docker Deployment

1. **Build and start all services:**
```bash
make docker-up
```

2. **Check service health:**
```bash
make health-check
```

3. **View logs:**
```bash
make docker-logs
```

4. **Stop services:**
```bash
make docker-down
```

## API Endpoints

### Message Broker
- `GET /health` - Health check
- `GET /ws/:service` - WebSocket connection for services
- `POST /publish` - Publish message to services

### Load Balancer
- `GET /health` - Health check
- `GET /services` - List service status
- `ANY /vision/*` - Route to Rust vision service
- `ANY /ai/*` - Route to Rust AI service
- `ANY /analytics/*` - Route to Rust analytics service

### Cache Coordinator
- `GET /health` - Health check
- `GET /cache/:key` - Get cached value
- `POST /cache/:key` - Set cache value
- `DELETE /cache/:key` - Delete cache entry
- `POST /cache/batch` - Batch get operations
- `GET /cache/stats` - Cache statistics

### Stream Processor
- `GET /health` - Health check
- `POST /stream/create` - Create new stream
- `DELETE /stream/:id` - Delete stream
- `POST /stream/:id/chunk` - Send chunk to stream
- `GET /stream/:id/subscribe` - Subscribe to stream (WebSocket)
- `GET /streams` - List active streams

## Integration with Node.js

Use the provided integration service:

```typescript
import { goIntegration } from './services/go-integration-service';

// Initialize connection
await goIntegration.initialize();

// Route to Rust service via Go load balancer
const result = await goIntegration.routeToRustService('vision', '/process', imageData);

// Cache operations
await goIntegration.cacheSet('key', value, 3600);
const cached = await goIntegration.cacheGet('key');

// Stream processing
const streamId = await goIntegration.createStream({ type: 'vision' });
await goIntegration.sendStreamChunk(streamId, imageBuffer);

// Subscribe to stream updates
const ws = goIntegration.subscribeToStream(streamId);
ws.on('message', (chunk) => {
  console.log('Received chunk:', chunk);
});
```

## Integration with Rust Services

Rust services should expose HTTP endpoints that the Go load balancer can route to:

```rust
// Example Rust service endpoint
#[post("/health")]
async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "healthy",
        "service": "rust_vision"
    }))
}

#[post("/process")]
async fn process_request(data: web::Json<ProcessRequest>) -> impl Responder {
    // Process request
    HttpResponse::Ok().json(result)
}
```

## Monitoring

### Prometheus Metrics (Port 9090)
All services expose Prometheus metrics at `/metrics`:
- Request counts and latencies
- Active connections
- Cache hit/miss rates
- Stream processing metrics

### Grafana Dashboards (Port 3001)
Pre-configured dashboards for:
- Service health overview
- Request routing patterns
- Cache performance
- Stream processing statistics

Access Grafana at http://localhost:3001 (default: admin/admin)

## Configuration

Each service can be configured via environment variables or `config.yaml`:

```yaml
service:
  name: message-broker
  log_level: info

nats:
  url: nats://localhost:4222
  cluster_id: go-services
  max_reconnects: 10

redis:
  addr: localhost:6379
  db: 0
  pool_size: 10

rust:
  vision_service_url: http://localhost:8090
  ai_service_url: http://localhost:8091
  analytics_service_url: http://localhost:8092
  health_check_interval: 30
  request_timeout: 10

metrics:
  enabled: true
  port: 9090
  path: /metrics
```

## Performance Tuning

### Message Broker
- Adjust NATS buffer sizes for high-throughput scenarios
- Configure WebSocket read/write buffer sizes
- Tune goroutine pool sizes for concurrent connections

### Load Balancer
- Configure health check intervals based on service stability
- Adjust request timeout values
- Tune connection pool sizes

### Cache Coordinator
- Set appropriate local cache size limits
- Configure Redis connection pool
- Adjust eviction policies based on usage patterns

### Stream Processor
- Configure buffer sizes based on stream types
- Adjust chunk processing concurrency
- Set appropriate timeout values for long-running streams

## Troubleshooting

### Service Won't Start
- Check if required ports are available
- Verify NATS and Redis are running
- Check configuration files

### Connection Issues
- Verify network connectivity between services
- Check firewall rules
- Review service logs for connection errors

### Performance Issues
- Monitor Prometheus metrics
- Check Grafana dashboards
- Review goroutine profiles
- Analyze memory usage patterns

## Development

### Running Tests
```bash
make test
```

### Building Binaries
```bash
make build
```

### Cleaning Build Artifacts
```bash
make clean
```

## License

Part of Universal AI Tools - See main repository for license information.
# 🔧 Fixed Distributed Tracing Stack for Universal AI Tools

Complete observability solution with Grafana, Jaeger, Tempo, OpenTelemetry Collector, and Qdrant vector database.

## ✅ What's Fixed

### 1. **Docker Compose Configuration**
- Proper service dependencies and health checks
- Fixed port conflicts (Tempo on 4320 for OTLP)
- Added Qdrant vector database integration
- Optimized resource limits and reservations
- Profile-based app deployment (`--with-apps` flag)

### 2. **OpenTelemetry Collector**
- Enhanced pipeline configuration with tail sampling
- Span metrics processor for RED metrics
- Proper batching and memory limits
- Multiple export targets (Jaeger, Tempo, Prometheus)
- Security filtering (removes passwords/tokens)

### 3. **LLM Router Tracing (Rust)**
- Full OpenTelemetry integration with context propagation
- W3C Trace Context support
- Environment-based sampling (10% prod, 100% dev)
- Qdrant vector operations tracing
- Comprehensive span attributes and metrics

### 4. **Tempo Configuration**
- Proper trace storage backend
- Metrics generation from traces
- Remote write to Prometheus
- Optimized retention and compression

### 5. **Qdrant Integration**
- Local vector database for embeddings
- Health monitoring and metrics
- Proper volume persistence
- gRPC and HTTP API endpoints

## 🚀 Quick Start

```bash
# Start core tracing services only
./start-tracing-fixed.sh

# Start with application services (LLM Router, WebSocket)
./start-tracing-fixed.sh --with-apps

# Clean start (remove all data)
./start-tracing-fixed.sh --clean

# Stop everything
docker-compose -f docker-compose-fixed.yml down
```

## 📊 Service Endpoints

| Service | Purpose | URL | Credentials |
|---------|---------|-----|-------------|
| **Grafana** | Dashboards & Visualization | http://localhost:3000 | admin/tracing123 |
| **Jaeger UI** | Trace Analysis | http://localhost:16686 | - |
| **Prometheus** | Metrics Storage | http://localhost:9090 | - |
| **Qdrant** | Vector Database | http://localhost:6333 | - |
| **OTel Collector** | Telemetry Collection | http://localhost:13133/health | - |

## 🔌 Integration Points

### For Rust Services (LLM Router)
```rust
// Environment variables
OTEL_SERVICE_NAME=llm-router
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
QDRANT_URL=http://qdrant:6333
```

### For Go Services (WebSocket)
```go
// Environment variables
OTEL_SERVICE_NAME=websocket-service
OTEL_EXPORTER_OTLP_ENDPOINT=otel-collector:4317
OTEL_EXPORTER_OTLP_INSECURE=true
```

### For TypeScript Services (Legacy)
```typescript
// Environment variables
OTEL_SERVICE_NAME=typescript-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

## 🧪 Testing the Pipeline

### Automated Test Suite
```bash
# Install test dependencies
pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp requests

# Run comprehensive tests
python test-tracing-pipeline.py

# Test with custom endpoint
python test-tracing-pipeline.py otel-collector:4317
```

### Manual Testing

1. **Generate Test Traces**
```bash
# Test LLM Router
curl -X POST http://localhost:8001/v1/completions \
  -H "Content-Type: application/json" \
  -H "traceparent: 00-$(openssl rand -hex 16)-$(openssl rand -hex 8)-01" \
  -d '{"prompt": "Hello world", "max_tokens": 50}'

# Test WebSocket health
curl http://localhost:8080/health \
  -H "traceparent: 00-$(openssl rand -hex 16)-$(openssl rand -hex 8)-01"
```

2. **Query Traces in Jaeger**
- Open http://localhost:16686
- Select service: `llm-router` or `websocket-service`
- Click "Find Traces"

3. **View Metrics in Grafana**
- Open http://localhost:3000 (admin/tracing123)
- Go to Explore
- Select Prometheus datasource
- Query: `rate(http_requests_total[5m])`

4. **Check Qdrant Collections**
```bash
# List collections
curl http://localhost:6333/collections

# Create test collection
curl -X PUT http://localhost:6333/collections/test \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 384, "distance": "Cosine"}}'
```

## 📈 Key Metrics to Monitor

### Service Health
- `up{job="SERVICE_NAME"}` - Service availability
- `process_uptime_seconds` - Service uptime
- `http_requests_total` - Request count
- `http_request_duration_seconds` - Request latency

### Tracing Metrics
- `traces_received_total` - Total traces received
- `traces_exported_total` - Total traces exported
- `otelcol_processor_accepted_spans` - Accepted spans
- `otelcol_processor_dropped_spans` - Dropped spans

### Vector Database
- `qdrant_collections_total` - Number of collections
- `qdrant_points_total` - Total vectors stored
- `qdrant_search_latency_seconds` - Search performance

## 🛠️ Troubleshooting

### Issue: Services Not Starting
```bash
# Check service status
docker-compose -f docker-compose-fixed.yml ps

# View logs
docker-compose -f docker-compose-fixed.yml logs [service-name]

# Check port availability
lsof -i :4317  # OTLP gRPC
lsof -i :3000  # Grafana
lsof -i :16686 # Jaeger
```

### Issue: No Traces in Jaeger
```bash
# Check OTel Collector is receiving data
curl http://localhost:8888/metrics | grep receiver

# Verify service is sending traces
docker-compose -f docker-compose-fixed.yml logs llm-router | grep "tracing initialized"

# Check collector export metrics
curl http://localhost:8888/metrics | grep exporter
```

### Issue: Grafana Datasources Missing
```bash
# Manually add datasources
curl -X POST http://localhost:3000/api/datasources \
  -H "Content-Type: application/json" \
  -u admin:tracing123 \
  -d '{
    "name": "Prometheus",
    "type": "prometheus",
    "url": "http://prometheus:9090",
    "access": "proxy"
  }'
```

### Issue: High Memory Usage
```yaml
# Adjust in docker-compose-fixed.yml
services:
  otel-collector:
    deploy:
      resources:
        limits:
          memory: 256M  # Reduce from 512M
```

## 📝 Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose-fixed.yml` | Main service orchestration |
| `otel-collector-fixed.yml` | OpenTelemetry Collector pipelines |
| `tempo-fixed.yaml` | Tempo trace storage config |
| `prometheus-fixed.yml` | Prometheus scraping config |
| `tracing_setup_fixed.rs` | Rust tracing implementation |
| `start-tracing-fixed.sh` | Startup script |
| `test-tracing-pipeline.py` | Integration test suite |

## 🔒 Production Considerations

1. **Enable TLS/SSL**
   - Configure HTTPS for all endpoints
   - Use proper certificates for OTLP

2. **Authentication**
   - Change default Grafana password
   - Enable auth for Prometheus/Jaeger

3. **Sampling Strategy**
   - Adjust sampling rates based on traffic
   - Use tail sampling for errors/slow requests

4. **Resource Limits**
   - Monitor memory usage
   - Set appropriate CPU/memory limits

5. **Data Retention**
   - Configure trace retention in Tempo
   - Set Prometheus retention policy
   - Implement data archival strategy

## 📚 Additional Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Grafana Tracing](https://grafana.com/docs/grafana/latest/datasources/tempo/)

## 🎯 Next Steps

1. **Import Grafana Dashboards**
   - Service Overview Dashboard
   - Distributed Tracing Dashboard
   - Vector Database Metrics

2. **Configure Alerting**
   - High error rates
   - Service downtime
   - Performance degradation

3. **Implement Custom Instrumentation**
   - Add business metrics
   - Track user journeys
   - Monitor critical paths

4. **Scale for Production**
   - Deploy to Kubernetes
   - Use managed services
   - Implement HA configuration
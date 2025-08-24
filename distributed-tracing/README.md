# Universal AI Tools - Distributed Tracing Infrastructure

Complete observability stack for Go/Rust microservices with OpenTelemetry, Jaeger, Tempo, Prometheus, and Grafana.

## 🚀 Quick Start

```bash
# Start the complete tracing infrastructure
./start-tracing.sh

# Start with application services
START_APPS=true ./start-tracing.sh

# Stop everything
docker-compose down
```

## 📊 Services Overview

| Service | Purpose | Port | Health Check |
|---------|---------|------|--------------|
| **OpenTelemetry Collector** | Telemetry data collection | 4317/4318 | http://localhost:13133 |
| **Jaeger** | Distributed tracing UI | 16686 | http://localhost:16686 |
| **Tempo** | High-scale tracing storage | 3200 | http://localhost:3200/ready |
| **Prometheus** | Metrics collection | 9090 | http://localhost:9090/-/healthy |
| **Grafana** | Visualization dashboards | 3001 | http://localhost:3001 |
| **Redis** | Distributed state | 6380 | Redis ping |
| **Alertmanager** | Alert routing | 9093 | http://localhost:9093/-/healthy |

## 🔌 Tracing Endpoints

### OTLP (OpenTelemetry Protocol)
- **gRPC**: `localhost:4317`
- **HTTP**: `localhost:4318`

### Jaeger Native
- **gRPC**: `localhost:14250`
- **HTTP**: `localhost:14268`
- **UDP Compact**: `localhost:6831`
- **UDP Binary**: `localhost:6832`

### Zipkin
- **HTTP**: `localhost:9411`

## 🔧 Configuration Files

- `otel-collector-config.yml` - OpenTelemetry Collector configuration
- `prometheus-tracing.yml` - Prometheus scraping configuration
- `tempo.yaml` - Tempo tracing backend configuration
- `alert_rules.yml` - Prometheus alerting rules
- `alertmanager.yml` - Alertmanager configuration
- `grafana/provisioning/` - Grafana datasources and dashboards

## 📈 Integration Examples

### Go Service (WebSocket)
```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/trace"
)

tracer := otel.Tracer("websocket-service")
ctx, span := tracer.Start(ctx, "websocket_operation")
defer span.End()

span.SetAttributes(
    attribute.String("user.id", userID),
    attribute.Int("connection.count", clientCount),
)
```

### Rust Service (LLM Router)
```rust
use tracing::{info, instrument, Span};

#[instrument(skip(state), fields(model = %request.model))]
async fn llm_completion(request: CompletionRequest) -> Result<Response> {
    let span = Span::current();
    span.record("llm.provider", &provider_name);
    span.record("llm.tokens", token_count);
    
    info!(
        model = %request.model,
        provider = %provider_name,
        "Processing LLM request"
    );
    
    // Your logic here
}
```

## 🎯 Metrics Collection

### Automatic Metrics
- **HTTP requests**: Request count, duration, status codes
- **gRPC calls**: Call count, duration, status
- **Database operations**: Query count, duration, errors
- **Custom business metrics**: Through Prometheus client libraries

### Key Metrics
- `websocket_connected_clients` - Active WebSocket connections
- `llm_requests_total` - LLM request count by provider
- `request_duration_seconds` - Request latency distribution
- `error_rate` - Error rate by service and operation

## 🚨 Alerting

### Critical Alerts
- Service down (>30s)
- No healthy LLM providers
- Redis unavailable
- High error rates (>10%)

### Warning Alerts
- High memory usage (>80%)
- High CPU usage (>80%)
- High connection count (>800)
- Elevated latency (>10s)

## 🔍 Monitoring Dashboards

### Available Dashboards
1. **Service Overview** - System health and performance
2. **WebSocket Metrics** - Real-time connection monitoring
3. **LLM Router Performance** - Provider health and routing metrics
4. **Infrastructure** - CPU, memory, disk, network
5. **Distributed Tracing** - Request flow visualization

### Grafana Access
- **URL**: http://localhost:3001
- **Username**: admin
- **Password**: tracing123

## 🛠️ Troubleshooting

### Common Issues

#### OTEL Collector Not Receiving Data
```bash
# Check collector logs
docker-compose logs otel-collector

# Verify endpoint connectivity
curl http://localhost:13133/

# Check configuration
docker-compose exec otel-collector cat /etc/otel-collector-config.yml
```

#### Jaeger UI Empty
```bash
# Verify Jaeger is receiving traces
docker-compose logs jaeger

# Check if applications are sending traces
curl http://localhost:14269/metrics | grep jaeger_traces
```

#### Missing Metrics in Prometheus
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify service metrics endpoints
curl http://localhost:8001/metrics  # LLM Router
curl http://localhost:8080/metrics  # WebSocket Service
```

### Performance Tuning

#### High Trace Volume
```yaml
# Reduce sampling in otel-collector-config.yml
probabilistic_sampler:
  sampling_percentage: 10  # Sample 10% instead of 100%
```

#### Memory Optimization
```yaml
# Increase batch sizes
batch:
  send_batch_size: 2048
  send_batch_max_size: 4096
```

## 📚 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Go Services   │    │  Rust Services  │    │ Legacy Services │
│  (WebSocket,    │    │  (LLM Router,   │    │   (TypeScript)  │
│   API Gateway)  │    │   Vector DB)    │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
          ┌─────────────────────────────────────────────┐
          │          OpenTelemetry Collector            │
          │     (Traces, Metrics, Logs Collection)      │
          └─────────────────┬───────────────────────────┘
                           │
     ┌────────────────────────────────────────────────┐
     │                                                │
     ▼                    ▼                          ▼
┌─────────┐         ┌─────────┐              ┌─────────┐
│ Jaeger  │         │  Tempo  │              │Prometheus│
│   UI    │         │(Storage)│              │(Metrics)│
└─────────┘         └─────────┘              └─────────┘
     │                    │                          │
     └────────────────────┼──────────────────────────┘
                         │
                    ┌─────────┐
                    │ Grafana │
                    │(Dashboards)│
                    └─────────┘
```

## 🔒 Security Considerations

### Production Deployment
- Enable TLS for all endpoints
- Configure proper authentication for Grafana
- Set up proper network policies
- Use secrets management for sensitive data
- Enable audit logging

### Environment Variables
```bash
# Security settings
GRAFANA_SECURITY_ADMIN_PASSWORD=secure_password
OTEL_EXPORTER_OTLP_HEADERS="authorization=Bearer your_token"
PROMETHEUS_WEB_EXTERNAL_URL=https://your-domain.com
```

## 📋 Maintenance

### Regular Tasks
- Monitor disk usage for trace storage
- Rotate logs and clean old traces
- Update service configurations
- Review and update alert thresholds
- Backup Grafana dashboards and datasources

### Capacity Planning
- Plan for 10-15% overhead for tracing
- Monitor OTEL Collector memory usage
- Scale trace storage based on retention needs
- Consider trace sampling for high-volume services
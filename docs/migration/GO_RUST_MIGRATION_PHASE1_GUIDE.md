# Go/Rust Migration Phase 1 Developer Guide

## Overview

This guide provides comprehensive documentation for Phase 1 of the Go/Rust migration for Universal AI Tools. Phase 1 establishes the foundation with Go API Gateway and Rust AI Core services running alongside the existing TypeScript backend in compatibility mode.

## Quick Start

### Prerequisites

- **Docker** >= 20.10.0
- **Docker Compose** >= 2.0.0
- **Go** >= 1.21
- **Rust** >= 1.75
- **Node.js** >= 20.0

### One-Command Setup

```bash
# Start the complete migration development environment
./scripts/start-migration-dev.sh

# Check status
./scripts/start-migration-dev.sh status

# View logs
./scripts/start-migration-dev.sh logs

# Stop environment
./scripts/start-migration-dev.sh stop
```

## Architecture Overview

### Service Structure

```
┌─────────────────────────────────────────────────────────────┐
│                 Load Balancer / Proxy                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
    ┌─────▼─────┐ ┌──▼──────┐ ┌──▼──────────┐
    │ Go API    │ │ Rust AI │ │ TypeScript  │
    │ Gateway   │ │ Core    │ │ Compat      │
    │ :8080     │ │ :8082   │ │ :9999       │
    └───────────┘ └─────────┘ └─────────────┘
```

### Component Responsibilities

#### Go API Gateway (Port 8080)
- **Primary Role**: HTTP routing, authentication, rate limiting
- **Health Checks**: Port 8081
- **Metrics**: Port 9090
- **Features**:
  - JWT authentication
  - Request routing
  - Database connection pooling
  - Middleware stack
  - gRPC client for Rust services

#### Rust AI Core (Port 8082)
- **Primary Role**: AI inference, model management, memory optimization
- **Health Checks**: `/health` endpoint
- **Metrics**: Port 9091
- **Features**:
  - Ollama integration
  - Model caching
  - Performance optimization
  - gRPC server
  - Async processing

#### TypeScript Server (Port 9999)
- **Primary Role**: Compatibility mode during migration
- **Status**: Legacy support, will be phased out
- **Purpose**: Fallback and comparison testing

## Development Environment

### File Structure

```
universal-ai-tools/
├── go-api-gateway/           # Go API Gateway service
│   ├── cmd/main.go          # Application entry point
│   ├── internal/
│   │   ├── api/             # HTTP handlers
│   │   ├── config/          # Configuration management
│   │   ├── database/        # Database connections
│   │   ├── middleware/      # HTTP middleware
│   │   └── services/        # Business logic
│   ├── Dockerfile           # Multi-stage Go build
│   └── go.mod               # Go dependencies
│
├── rust-ai-core/            # Rust AI Core service
│   ├── ai-engine/           # Core AI processing
│   ├── graphrag-core/       # Knowledge graph processing
│   ├── memory-optimizer/    # Memory management
│   ├── grpc-server/         # gRPC service definitions
│   ├── shared/              # Shared types and utilities
│   ├── Dockerfile           # Multi-stage Rust build
│   └── Cargo.toml           # Workspace configuration
│
├── migration-testing/       # Automated testing framework
│   ├── src/
│   │   ├── compatibility-tester.js
│   │   ├── performance-tester.js
│   │   └── api-tester.js
│   └── package.json
│
├── monitoring/              # Monitoring and alerting
│   ├── prometheus/
│   │   ├── prometheus-migration.yml
│   │   └── migration-alert-rules.yml
│   └── grafana/
│
├── docker-compose.migration.yml  # Development environment
├── .github/workflows/            # CI/CD pipelines
└── scripts/
    └── start-migration-dev.sh    # Development setup script
```

### Environment Configuration

The migration environment is configured via `.env.migration`:

```bash
# Service endpoints
TYPESCRIPT_ENDPOINT=http://localhost:9999
GO_ENDPOINT=http://localhost:8080
RUST_ENDPOINT=http://localhost:8082

# Database connections
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=universal_ai_tools_migration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Migration settings
MIGRATION_PHASE=1
MIGRATION_COMPATIBILITY_MODE=true
MIGRATION_ENABLE_TESTING=true
```

## Development Workflows

### 1. Code Changes

#### Go API Gateway Development

```bash
cd go-api-gateway

# Install dependencies
go mod download

# Run tests
go test ./...

# Run with hot reload (using air)
air

# Build binary
go build -o bin/go-api-gateway ./cmd/main.go

# Run locally
./bin/go-api-gateway
```

#### Rust AI Core Development

```bash
cd rust-ai-core

# Install dependencies and check formatting
cargo fmt --all -- --check

# Run clippy for linting
cargo clippy --all-targets -- -D warnings

# Run tests
cargo test --workspace

# Run with hot reload (using cargo-watch)
cargo watch -x "run --bin ai-engine"

# Build release
cargo build --release --workspace
```

### 2. Testing

#### Unit Tests

```bash
# Go tests
cd go-api-gateway && go test ./...

# Rust tests
cd rust-ai-core && cargo test --workspace

# Migration tests
cd migration-testing && npm test
```

#### Integration Tests

```bash
# Start services
./scripts/start-migration-dev.sh

# Run compatibility tests
cd migration-testing
npm run test:compatibility

# Run performance comparison
npm run test:performance

# Run API validation
npm run test:api
```

#### Manual Testing

```bash
# Health checks
curl http://localhost:8080/health     # Go API Gateway
curl http://localhost:8082/health     # Rust AI Core
curl http://localhost:9999/health     # TypeScript (compat)

# API endpoints
curl -X POST http://localhost:8080/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, migration test!"}'

curl http://localhost:8082/api/v1/models
```

### 3. Monitoring and Debugging

#### Access Monitoring

- **Prometheus**: http://localhost:9092
- **Grafana**: http://localhost:3000 (admin/admin)
- **Migration Test Dashboard**: Available in Grafana

#### Log Access

```bash
# View all service logs
docker-compose -f docker-compose.migration.yml logs -f

# View specific service logs
docker-compose -f docker-compose.migration.yml logs -f go-api-gateway
docker-compose -f docker-compose.migration.yml logs -f rust-ai-core

# View migration test logs
docker-compose -f docker-compose.migration.yml logs -f migration-test
```

#### Debugging

```bash
# Debug Go service
dlv attach $(pgrep go-api-gateway)

# Debug Rust service (with rust-gdb)
rust-gdb target/debug/ai-engine

# Enable verbose logging
export LOG_LEVEL=debug
export RUST_LOG=debug
```

## API Compatibility

### Endpoint Mapping

During Phase 1, APIs are mapped as follows:

| Endpoint | TypeScript | Go | Rust | Status |
|----------|------------|----|----- |--------|
| `/health` | ✅ | ✅ | ✅ | Compatible |
| `/api/v1/chat` | ✅ | ✅ | ⏳ | Go proxies to Rust |
| `/api/v1/models` | ✅ | ✅ | ✅ | Compatible |
| `/api/v1/agents` | ✅ | ✅ | ⏳ | In progress |

### Migration Strategy

1. **Week 1-2**: Basic HTTP routing (Go)
2. **Week 3-4**: AI processing (Rust)
3. **Week 5-6**: Database integration
4. **Week 7-8**: Advanced features

## Performance Targets

### Response Time Goals

| Service | Current (TS) | Phase 1 Target | Improvement |
|---------|--------------|----------------|-------------|
| Health Check | 45ms | 15ms | 67% |
| Chat API | 180ms | 90ms | 50% |
| Models API | 120ms | 40ms | 67% |

### Memory Usage Goals

| Component | Current | Target | Improvement |
|-----------|---------|--------|-------------|
| API Gateway | 150MB | 75MB | 50% |
| AI Processing | 400MB | 120MB | 70% |
| Total System | 1GB | 400MB | 60% |

## Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check Docker status
docker ps

# Check logs for errors
docker-compose -f docker-compose.migration.yml logs

# Restart specific service
docker-compose -f docker-compose.migration.yml restart go-api-gateway

# Full environment reset
docker-compose -f docker-compose.migration.yml down -v
./scripts/start-migration-dev.sh
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose -f docker-compose.migration.yml exec postgres pg_isready -U postgres

# Reset database
docker-compose -f docker-compose.migration.yml restart postgres

# Check database logs
docker-compose -f docker-compose.migration.yml logs postgres
```

#### gRPC Communication Issues

```bash
# Check Rust service health
curl http://localhost:8082/health

# Test gRPC endpoint
grpcurl -plaintext localhost:50051 list

# Check Go->Rust communication
curl http://localhost:8080/api/v1/ai/models
```

### Performance Issues

#### High Memory Usage

```bash
# Check memory usage
docker stats

# View memory metrics in Grafana
# Navigate to: http://localhost:3000/d/migration/migration-overview

# Trigger garbage collection (Go)
curl -X POST http://localhost:8080/debug/gc
```

#### Slow Response Times

```bash
# Check service health
curl http://localhost:8080/health/detailed
curl http://localhost:8082/health

# View performance metrics
curl http://localhost:9092/api/v1/query?query=migration:response_time_p95_5m

# Check database connections
curl http://localhost:8080/debug/connections
```

## Contributing

### Code Standards

#### Go
- Use `gofmt` for formatting
- Run `go vet` before committing
- Maintain test coverage > 80%
- Follow effective Go guidelines

#### Rust
- Use `cargo fmt` for formatting
- Run `cargo clippy` before committing
- Use `#[instrument]` for tracing
- Follow Rust API guidelines

#### Testing
- All new features must include tests
- Integration tests for API changes
- Performance tests for critical paths
- Migration compatibility tests

### Pull Request Process

1. **Create feature branch**: `feature/description`
2. **Run tests locally**: `./scripts/test-migration.sh`
3. **Update documentation** if needed
4. **Submit PR** with clear description
5. **CI/CD pipeline** must pass
6. **Code review** by team members
7. **Merge** after approval

### Migration Testing

Every PR must include:
- Compatibility tests passing
- Performance benchmarks
- Memory usage validation
- Error handling verification

## Deployment

### Development Deployment

```bash
# Start development environment
./scripts/start-migration-dev.sh

# Deploy changes
docker-compose -f docker-compose.migration.yml up -d --build

# Validate deployment
./scripts/start-migration-dev.sh test
```

### Staging Deployment

```bash
# Build production images
docker build -t go-api-gateway:staging ./go-api-gateway
docker build -t rust-ai-core:staging ./rust-ai-core

# Deploy to staging
docker-compose -f docker-compose.staging.yml up -d

# Run staging tests
npm run test:staging
```

### Production Deployment

Production deployment is handled by the CI/CD pipeline:

1. **Merge to main** triggers production build
2. **Automated tests** must pass
3. **Security scanning** must clear
4. **Blue-green deployment** with rollback capability
5. **Post-deployment validation**

## Monitoring and Alerting

### Key Metrics

- **Service Availability**: Target 99.9%
- **Response Time**: P95 < 100ms
- **Error Rate**: < 0.1%
- **Memory Usage**: < 500MB total
- **Compatibility Score**: > 95%

### Alerts

Critical alerts are configured for:
- Service downtime > 1 minute
- Error rate > 5%
- Memory usage > 1GB
- Response time P95 > 200ms
- Compatibility test failures

### Dashboards

Access monitoring dashboards at:
- **Migration Overview**: http://localhost:3000/d/migration/migration-overview
- **Performance Comparison**: http://localhost:3000/d/perf/performance-comparison
- **System Health**: http://localhost:3000/d/health/system-health

## Next Steps

### Phase 2 Planning (Weeks 4-7)

1. **Complete AI Core Migration**
   - Full Ollama integration
   - Model management
   - Memory optimization

2. **Advanced Features**
   - Real-time communication
   - WebSocket support
   - Event streaming

3. **Performance Optimization**
   - Database query optimization
   - Connection pooling
   - Caching strategies

### Long-term Roadmap

- **Phase 3**: Complete TypeScript removal
- **Phase 4**: Production hardening
- **Phase 5**: Advanced AI features

## Support

### Getting Help

- **Documentation**: This guide and inline code comments
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **Team Chat**: Internal development channels

### Resources

- [Go Documentation](https://golang.org/doc/)
- [Rust Documentation](https://doc.rust-lang.org/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Migration Strategy Document](./GO_RUST_MIGRATION_STRATEGY.md)

---

**Happy Migration Development! 🚀**
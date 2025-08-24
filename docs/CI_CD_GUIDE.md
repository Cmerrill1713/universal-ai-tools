# CI/CD Pipeline Guide

## 🚀 Universal AI Tools CI/CD Architecture

Our CI/CD pipeline provides comprehensive automated testing, security scanning, performance monitoring, and deployment for our hybrid Go/Rust/TypeScript/Swift architecture.

## 📋 Pipeline Overview

### Core Workflows

1. **`ci-cd.yml`** - Main CI/CD pipeline with multi-language testing and deployment
2. **`security-audit.yml`** - Daily security scans and automated dependency updates  
3. **`performance-monitoring.yml`** - Performance benchmarking and regression detection

## 🔧 Workflow Details

### Main CI/CD Pipeline (`ci-cd.yml`)

**Triggers:**
- Push to `master`, `develop`, or `feature/*` branches
- Pull requests to `master` or `develop`
- Release publications

**Jobs:**
1. **Code Quality & Security**
   - Multi-language linting (Go, Rust, TypeScript)
   - Security scanning with Trivy
   - SARIF uploads for GitHub Security tab

2. **Multi-Language Testing**
   - **Go Tests**: API Gateway and WebSocket service
   - **Rust Tests**: LLM Router, AI Core, GraphRAG, Memory Optimizer, Vector DB
   - **TypeScript Tests**: Legacy compatibility layer
   - **Swift Tests**: macOS application with Xcode

3. **Integration Testing**
   - Full service stack deployment
   - PostgreSQL, Redis, Qdrant test services
   - Comprehensive API testing with health checks
   - WebSocket real-time communication testing
   - Performance benchmarking

4. **Docker Build & Registry**
   - Multi-architecture builds (linux/amd64, linux/arm64)
   - Automated tagging and versioning
   - GitHub Container Registry (ghcr.io) publishing
   - Layer caching for fast builds

5. **Environment Deployments**
   - **Staging**: Auto-deploy from `develop` branch
   - **Production**: Auto-deploy from `master` branch
   - Environment-specific configurations
   - Health checks and rollback capabilities

6. **Release Automation**
   - Automated release notes generation
   - Binary and artifact publishing
   - Production deployment validation

### Security Audit Pipeline (`security-audit.yml`)

**Triggers:**
- Daily scheduled runs (2 AM UTC)
- Dependency file changes
- Manual workflow dispatch

**Features:**
- **Dependency Vulnerability Scanning**: Go, Rust, Node.js security audits
- **Docker Image Scanning**: Trivy security analysis
- **Automated Dependency Updates**: Creates PRs with security patches
- **License Compliance**: Ensures all dependencies use approved licenses

### Performance Monitoring (`performance-monitoring.yml`)

**Triggers:**
- Every 4 hours (scheduled)
- Service code changes
- Manual with configurable parameters

**Capabilities:**
- **Service Benchmarking**: Apache Bench and wrk performance testing
- **Memory & CPU Profiling**: Resource usage monitoring
- **Load Testing**: Configurable concurrent users and duration
- **Regression Detection**: Automated performance threshold checking
- **PR Comments**: Performance analysis results

## 🎯 Performance Targets

| Service | Target RPS | Max Response Time | Memory Limit |
|---------|------------|-------------------|---------------|
| API Gateway | >2,500 | <50ms | 512MB |
| WebSocket Service | >5,000 connections | <10ms latency | 256MB |
| LLM Router | >1,000 | <100ms | 1GB |
| GraphRAG Service | >500 | <200ms | 2GB |

## 🔐 Security Standards

### Automated Security Checks
- **Code Scanning**: Trivy, gosec, cargo-audit
- **Dependency Updates**: Automated PRs for security patches
- **License Compliance**: MIT/BSD/Apache-2.0 approved licenses only
- **Container Security**: Base image vulnerability scanning

### Manual Security Reviews
- Production deployments require 2 reviewers
- Security team approval for sensitive changes
- CODEOWNERS enforcement for critical files

## 🌍 Environment Configuration

### Staging Environment
- **URL**: `https://api-staging.universal-ai-tools.com`
- **Purpose**: Pre-production testing and validation
- **Auto-deployment**: From `develop` branch
- **Resource Limits**: Reduced for cost efficiency
- **Features**: Debug logging, experimental features enabled

### Production Environment
- **URL**: `https://api.universal-ai-tools.com` 
- **Purpose**: Live production service
- **Auto-deployment**: From `master` branch (with approval)
- **Resource Limits**: Full production capacity
- **Features**: Conservative settings, comprehensive monitoring

## 📊 Monitoring & Observability

### Metrics Collection
- **Prometheus**: Service metrics and performance data
- **Grafana**: Real-time dashboards and visualization
- **Jaeger**: Distributed tracing across microservices
- **OpenTelemetry**: Unified observability framework

### Performance Tracking
- Response time percentiles (p50, p95, p99)
- Throughput and error rates
- Memory and CPU utilization
- Database query performance
- Cache hit rates

### Alerting
- Production performance degradation
- Service health failures  
- Security vulnerability discoveries
- Resource usage thresholds

## 🚀 Deployment Process

### Automated Deployment Flow
1. **Code Push** → Triggers CI/CD pipeline
2. **Quality Checks** → Linting, testing, security scans
3. **Build & Test** → Multi-language compilation and integration tests
4. **Container Build** → Docker image creation and registry push
5. **Environment Deploy** → Automated deployment with health checks
6. **Validation** → Post-deployment testing and monitoring

### Manual Deployment (Emergency)
```bash
# Production deployment script
./scripts/production-deployment.sh deploy

# Health check validation
./scripts/production-deployment.sh health

# Rollback if needed
./scripts/production-deployment.sh rollback
```

## 📈 Performance Results

### Latest Benchmark Results (Example)
- **API Gateway**: 4,892 req/sec, 4.6ms avg response time
- **WebSocket Service**: 10,000+ concurrent connections
- **LLM Router**: 2,100 req/sec, 87ms avg response time
- **Integration Tests**: 86.67% pass rate, 0% error rate in load testing

## 🛠️ Development Workflow

### Feature Development
1. Create feature branch from `develop`
2. Implement changes with comprehensive tests
3. Push triggers automated CI checks
4. Create PR → triggers full CI/CD validation  
5. Code review and approval
6. Merge to `develop` → auto-deploy to staging
7. Validation in staging environment
8. Merge to `master` → auto-deploy to production

### Hotfix Process
1. Create hotfix branch from `master`
2. Implement critical fix
3. Emergency PR with expedited review
4. Direct merge to `master` and `develop`
5. Immediate production deployment
6. Post-deployment validation

## 🔍 Troubleshooting

### Common CI/CD Issues

**Build Failures:**
- Check service-specific logs in GitHub Actions
- Verify dependency compatibility
- Review resource limits and timeouts

**Test Failures:**  
- Review integration test logs
- Check service startup dependencies
- Validate database connections and migrations

**Deployment Issues:**
- Check environment-specific configurations
- Verify secrets and environment variables
- Review health check endpoints

### Debug Commands
```bash
# Local CI/CD simulation
docker-compose -f docker-compose.production.yml up -d

# Integration test execution
node tests/integration-test-suite.cjs

# Service health validation
./scripts/production-deployment.sh status
```

## 📚 Additional Resources

- [API Documentation](./API_REFERENCE.md)
- [OpenAPI Specification](./openapi.yaml)  
- [Production Deployment Guide](../scripts/production-deployment.sh)
- [Integration Test Suite](../tests/integration-test-suite.cjs)
- [Performance Monitoring Dashboard](https://monitoring.universal-ai-tools.com)

---

**CI/CD Pipeline Status:** ✅ Fully Operational  
**Last Updated:** August 2025  
**Maintained By:** Universal AI Tools DevOps Team
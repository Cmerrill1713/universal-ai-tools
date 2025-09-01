# Universal AI Tools - Production Makefile
.PHONY: help build test deploy clean start stop status logs

# Default target
help:
	@echo "Universal AI Tools - Production Deployment"
	@echo ""
	@echo "Available commands:"
	@echo "  build          Build all Docker images"
	@echo "  test           Run integration tests"
	@echo "  deploy         Deploy to Kubernetes"
	@echo "  start          Start with Docker Compose"
	@echo "  stop           Stop all services"
	@echo "  status         Check service status"
	@echo "  logs           Follow service logs"
	@echo "  clean          Clean up resources"
	@echo ""
	@echo "Development:"
	@echo "  dev            Start development environment"
	@echo "  test-go        Run Go service tests"
	@echo "  test-rust      Run Rust service tests"
	@echo "  test-node      Run Node.js tests"
	@echo ""

# Variables
DOCKER_REGISTRY ?= universal-ai
VERSION ?= latest
NAMESPACE ?= universal-ai

# Build all images
build: build-go build-rust build-node

build-go:
	@echo "🔨 Building Go services..."
	@cd go-services/message-broker && docker build -t $(DOCKER_REGISTRY)/message-broker:$(VERSION) .
	@cd go-services/load-balancer && docker build -t $(DOCKER_REGISTRY)/load-balancer:$(VERSION) .
	@cd go-services/cache-coordinator && docker build -t $(DOCKER_REGISTRY)/cache-coordinator:$(VERSION) .
	@cd go-services/stream-processor && docker build -t $(DOCKER_REGISTRY)/stream-processor:$(VERSION) .
	@cd go-services/ml-stream-processor && docker build -t $(DOCKER_REGISTRY)/ml-stream-processor:$(VERSION) .
	@cd go-services/shared-memory && docker build -t $(DOCKER_REGISTRY)/shared-memory:$(VERSION) .
	@cd go-services/tracing && docker build -t $(DOCKER_REGISTRY)/tracing-service:$(VERSION) .
	@cd go-services/metrics-aggregator && docker build -t $(DOCKER_REGISTRY)/metrics-aggregator:$(VERSION) .
	@cd go-services/ml-inference && docker build -t $(DOCKER_REGISTRY)/go-ml-inference:$(VERSION) .
	@cd go-services/service-discovery && docker build -t $(DOCKER_REGISTRY)/service-discovery:$(VERSION) .

build-rust:
	@echo "🦀 Building Rust services..."
	@cd rust-services/ml-inference-service && docker build -t $(DOCKER_REGISTRY)/rust-ml-inference:$(VERSION) .
	@cd rust-services/parameter-analytics-service && docker build -t $(DOCKER_REGISTRY)/rust-parameter-analytics:$(VERSION) .
	@cd rust-services/ab-mcts-service && docker build -t $(DOCKER_REGISTRY)/rust-ab-mcts:$(VERSION) .
	@cd rust-services/ffi-bridge && docker build -t $(DOCKER_REGISTRY)/rust-ffi-bridge:$(VERSION) .

build-node:
	@echo "⚡ Building Node.js backend..."
	@docker build -t $(DOCKER_REGISTRY)/node-backend:$(VERSION) .

# Testing
test: test-integration test-go test-rust test-node

test-integration:
	@echo "🧪 Running integration tests..."
	@npm run test:integration

test-go:
	@echo "🔧 Testing Go services..."
	@cd go-services && find . -name "*.go" -path "*/main.go" -execdir go test -v . \;

test-rust:
	@echo "🦀 Testing Rust services..."
	@cd rust-services && find . -name "Cargo.toml" -execdir cargo test \;

test-node:
	@echo "⚡ Testing Node.js backend..."
	@npm test

# Development environment
dev:
	@echo "🚀 Starting development environment..."
	@docker network create universal-ai-network 2>/dev/null || true
	@docker-compose -f docker-compose.full.yml up --build

# Production deployment
start:
	@echo "🚀 Starting production environment..."
	@docker network create universal-ai-network 2>/dev/null || true
	@docker-compose -f docker-compose.full.yml up -d

stop:
	@echo "🛑 Stopping all services..."
	@docker-compose -f docker-compose.full.yml down

status:
	@echo "📊 Service status:"
	@docker-compose -f docker-compose.full.yml ps

logs:
	@docker-compose -f docker-compose.full.yml logs -f

# Kubernetes deployment
deploy: build
	@echo "🚀 Deploying to Kubernetes..."
	@kubectl apply -f k8s/namespace.yaml
	@kubectl apply -f k8s/infrastructure.yaml
	@kubectl apply -f k8s/go-services.yaml
	@kubectl wait --for=condition=ready pod -l app=postgres -n $(NAMESPACE) --timeout=300s
	@kubectl wait --for=condition=ready pod -l app=redis -n $(NAMESPACE) --timeout=300s
	@kubectl wait --for=condition=ready pod -l app=consul -n $(NAMESPACE) --timeout=300s
	@echo "✅ Deployment complete!"

k8s-status:
	@echo "📊 Kubernetes deployment status:"
	@kubectl get pods -n $(NAMESPACE)
	@kubectl get services -n $(NAMESPACE)

k8s-logs:
	@echo "📝 Following Kubernetes logs..."
	@kubectl logs -f -l app=node-backend -n $(NAMESPACE)

# Cleanup
clean:
	@echo "🧹 Cleaning up..."
	@docker-compose -f docker-compose.full.yml down -v
	@docker system prune -f
	@docker volume prune -f
	@docker network prune -f

k8s-clean:
	@echo "🧹 Cleaning up Kubernetes..."
	@kubectl delete namespace $(NAMESPACE) --ignore-not-found=true

# Health checks
health-check:
	@echo "🏥 Running health checks..."
	@scripts/health-check.sh

# Database operations
db-migrate:
	@echo "💾 Running database migrations..."
	@npm run migrate

db-seed:
	@echo "🌱 Seeding database..."
	@npm run seed

# Monitoring
metrics:
	@echo "📊 Opening metrics dashboard..."
	@open http://localhost:3000  # Grafana
	@open http://localhost:9090  # Prometheus

traces:
	@echo "🔍 Opening tracing dashboard..."
	@open http://localhost:16686  # Jaeger

# Security
security-scan:
	@echo "🔒 Running security scan..."
	@docker run --rm -v $(PWD):/app clair-scanner --config /app/.clair-scanner.yml

# Performance
load-test:
	@echo "⚡ Running load tests..."
	@docker run --rm --network=universal-ai-network -v $(PWD)/tests:/tests k6:latest run /tests/load-test.js

# API Gateway
start-kong:
	@echo "🚪 Starting Kong API Gateway..."
	@docker-compose -f docker-compose.kong.yml up -d
	@echo "⏳ Waiting for Kong to be ready..."
	@sleep 10
	@make gateway-config

stop-kong:
	@echo "🛑 Stopping Kong API Gateway..."
	@docker-compose -f docker-compose.kong.yml down

gateway-config:
	@echo "🚪 Configuring API gateway..."
	@scripts/configure-kong.sh

gateway-status:
	@echo "📊 Kong Gateway status:"
	@docker-compose -f docker-compose.kong.yml ps
	@echo ""
	@echo "🔍 Testing Kong endpoints:"
	@curl -s http://localhost:8001/status | jq . || echo "Kong Admin API not available"

# Full stack with Kong
start-with-kong: start start-kong
	@echo "🎉 Full stack with Kong Gateway started!"
	@echo ""
	@echo "🔗 Access URLs:"
	@echo "  - Kong Gateway: http://localhost:8000"
	@echo "  - Kong Admin: http://localhost:8001"
	@echo "  - Kong GUI: http://localhost:8002"
	@echo "  - Konga: http://localhost:1337"
	@echo ""
	@echo "🚀 Services through Kong:"
	@echo "  - Main API: http://localhost:8000/api/"
	@echo "  - ML Services: http://localhost:8000/ml/"
	@echo "  - Analytics: http://localhost:8000/analytics/"

# Service mesh
mesh-install:
	@echo "🕸️  Installing service mesh..."
	@istioctl install --set values.defaultRevision=default

# Backup
backup:
	@echo "💾 Creating backup..."
	@scripts/backup.sh

restore:
	@echo "♻️  Restoring from backup..."
	@scripts/restore.sh

# Development helpers
gen-grpc:
	@echo "🔧 Generating gRPC code..."
	@./scripts/generate-grpc.sh

build-rust-ffi:
	@echo "🔗 Building Rust FFI bridge..."
	@cd rust-services/ffi-bridge && cargo build --release

install-deps:
	@echo "📦 Installing dependencies..."
	@npm install
	@cd rust-services && find . -name "Cargo.toml" -execdir cargo build \;

# Quick start
quickstart: install-deps build start
	@echo "🎉 Quick start complete!"
	@echo ""
	@echo "Services available at:"
	@echo "  - API Gateway: http://localhost:8000"
	@echo "  - Node.js API: http://localhost:9999"
	@echo "  - Grafana: http://localhost:3000 (admin/admin)"
	@echo "  - Prometheus: http://localhost:9090"
	@echo "  - Jaeger: http://localhost:16686"
	@echo "  - Consul: http://localhost:8500"
	@echo ""
	@echo "Run 'make health-check' to verify all services are running."

# Production checklist
production-ready:
	@echo "✅ Production readiness checklist:"
	@echo "   🔒 Security scan: make security-scan"
	@echo "   🧪 Integration tests: make test"
	@echo "   ⚡ Load tests: make load-test"  
	@echo "   📊 Metrics: make metrics"
	@echo "   💾 Backup system: make backup"
	@echo ""
	@echo "Run these commands before deploying to production!"

# Documentation
docs:
	@echo "📚 Generating documentation..."
	@npm run docs:generate
	@echo "Documentation available at: docs/index.html"
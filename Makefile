# Universal AI Tools - Docker Development Makefile

.PHONY: help build up down logs clean dev prod test

# Default target
help: ## Show this help message
	@echo "Universal AI Tools - Docker Development Commands"
	@echo ""
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development commands
dev: ## Start development environment with hot reload
	docker-compose -f docker-compose.prod.yml -f docker-compose.override.yml up --build

dev-detached: ## Start development environment in background
	docker-compose -f docker-compose.prod.yml -f docker-compose.override.yml up -d --build

# Production commands
prod: ## Start production environment
	docker-compose -f docker-compose.prod.yml up --build -d

prod-logs: ## Show production logs
	docker-compose -f docker-compose.prod.yml logs -f

# Basic Docker commands
build: ## Build all services
	docker-compose -f docker-compose.prod.yml build

up: ## Start all services
	docker-compose -f docker-compose.prod.yml up -d

down: ## Stop all services
	docker-compose -f docker-compose.prod.yml down

logs: ## Show logs from all services
	docker-compose -f docker-compose.prod.yml logs -f

# Service-specific commands
api-gateway-logs: ## Show API Gateway logs
	docker-compose -f docker-compose.prod.yml logs -f api-gateway

cache-coordinator-logs: ## Show Cache Coordinator logs
	docker-compose -f docker-compose.prod.yml logs -f cache-coordinator

redis-cli: ## Connect to Redis CLI
	docker-compose -f docker-compose.prod.yml exec redis redis-cli

# Cleanup commands
clean: ## Remove all containers, volumes, and images
	docker-compose -f docker-compose.prod.yml down -v --rmi all

clean-volumes: ## Remove all volumes
	docker volume prune -f

clean-images: ## Remove all images
	docker image prune -f

# Testing commands
test: ## Run tests in containers
	docker-compose -f docker-compose.test.yml up --abort-on-container-exit

health-check: ## Check health of all services
	@echo "Checking service health..."
	@docker-compose -f docker-compose.prod.yml ps
	@echo ""
	@echo "API Gateway: http://localhost:8080/health"
	@echo "Cache Coordinator: http://localhost:8012/health"
	@echo "Load Balancer: http://localhost:8011/health"
	@echo "Metrics Aggregator: http://localhost:8013/health"

# Development tools
install-dev-tools: ## Install development dependencies (reflex for hot reload)
	@echo "Installing development tools..."
	go install github.com/cespare/reflex@latest

# Database commands
redis-backup: ## Backup Redis data
	docker-compose -f docker-compose.prod.yml exec redis redis-cli SAVE
	@echo "Redis backup created"

redis-restore: ## Restore Redis from backup
	@echo "Restoring Redis from backup..."
	docker-compose -f docker-compose.prod.yml exec redis redis-cli BGSAVE

# Monitoring commands
monitor: ## Show real-time resource usage
	docker stats

# Deployment commands
deploy: ## Deploy to production (customize for your environment)
	@echo "Deploying to production..."
	@echo "Customize this command for your deployment pipeline"
	# Add your deployment commands here

# Utility commands
ps: ## Show running containers
	docker-compose -f docker-compose.prod.yml ps

restart: ## Restart all services
	docker-compose -f docker-compose.prod.yml restart

scale: ## Scale a service (usage: make scale SERVICE=name COUNT=3)
	docker-compose -f docker-compose.prod.yml up -d --scale $(SERVICE)=$(COUNT)

# Postgres utilities (Rust db-cli)
db.validate: ## Validate DB schema and functions via db-cli
	cargo run -p db-cli -- validate

db.seed: ## Seed minimal data via db-cli
	cargo run -p db-cli -- seed

db.cleanup: ## Cleanup test data via db-cli
	cargo run -p db-cli -- cleanup

# Rust dev helpers
fmt: ## Format Rust workspace (rustfmt)
	cargo fmt --all

clippy: ## Run clippy on workspace (deny warnings)
	cargo clippy --workspace -- -D warnings

check: ## Cargo check workspace
	cargo check --workspace

rust-core-start: ## Start llm-router and assistantd in background
	bash scripts/start-rust-core.sh

rust-core-stop: ## Stop llm-router and assistantd
	bash scripts/stop-rust-core.sh

rust-core-status: ## Show status of llm-router and assistantd
	bash scripts/status-rust-core.sh

# Environment setup
setup: ## Initial setup for development
	@echo "Setting up development environment..."
	@make install-dev-tools
	@echo "Creating necessary directories..."
	mkdir -p redis/data
	mkdir -p logs
	@echo "Setup complete! Run 'make dev' to start development environment."

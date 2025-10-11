.PHONY: all build run test clean docker-build docker-up docker-down

# Build all services
all: build

build:
	@echo "Building Go services..."
	@go build -o bin/message-broker ./message-broker
	@go build -o bin/load-balancer ./load-balancer
	@go build -o bin/cache-coordinator ./cache-coordinator
	@go build -o bin/stream-processor ./stream-processor
	@echo "Build complete!"

# Run services locally
run-message-broker:
	@go run ./message-broker/main.go

run-load-balancer:
	@go run ./load-balancer/main.go

run-cache-coordinator:
	@go run ./cache-coordinator/main.go

run-stream-processor:
	@go run ./stream-processor/main.go

# Run all services (requires multiple terminals or tmux)
run-all:
	@echo "Starting all services..."
	@docker-compose up -d nats redis
	@sleep 2
	@go run ./message-broker/main.go &
	@go run ./load-balancer/main.go &
	@go run ./cache-coordinator/main.go &
	@go run ./stream-processor/main.go &
	@echo "All services started!"

# Test
test:
	@go test -v ./...

# Docker commands
docker-build:
	@docker-compose build

docker-up:
	@docker-compose up -d
	@echo "Go services are running!"
	@echo "Message Broker: http://localhost:8081"
	@echo "Load Balancer: http://localhost:8082"
	@echo "Cache Coordinator: http://localhost:8083"
	@echo "Stream Processor: http://localhost:8084"
	@echo "Prometheus: http://localhost:9090"
	@echo "Grafana: http://localhost:3001 (admin/admin)"

docker-down:
	@docker-compose down

docker-logs:
	@docker-compose logs -f

# Clean
clean:
	@rm -rf bin/
	@echo "Cleaned build artifacts"

# Development setup
setup:
	@go mod download
	@go mod tidy
	@echo "Dependencies installed!"

# Health check all services
health-check:
	@echo "Checking service health..."
	@curl -s http://localhost:8081/health | jq '.' || echo "Message Broker: Not running"
	@curl -s http://localhost:8082/health | jq '.' || echo "Load Balancer: Not running"
	@curl -s http://localhost:8083/health | jq '.' || echo "Cache Coordinator: Not running"
	@curl -s http://localhost:8084/health | jq '.' || echo "Stream Processor: Not running"
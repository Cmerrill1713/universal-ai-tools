#!/bin/bash
# Kong API Gateway Configuration Script
# Sets up Kong with Universal AI Tools services

set -e

echo "🚪 Configuring Kong API Gateway for Universal AI Tools..."

KONG_ADMIN_URL=${KONG_ADMIN_URL:-"http://localhost:8001"}
KONG_CONFIG_DIR="kong"
RETRY_COUNT=0
MAX_RETRIES=30

# Wait for Kong to be ready
wait_for_kong() {
    echo "⏳ Waiting for Kong to be ready..."
    while ! curl -f -s "$KONG_ADMIN_URL/status" > /dev/null; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            echo "❌ Kong is not ready after $MAX_RETRIES attempts"
            exit 1
        fi
        echo "Attempt $RETRY_COUNT/$MAX_RETRIES - Kong not ready, waiting 5 seconds..."
        sleep 5
    done
    echo "✅ Kong is ready!"
}

# Apply Kong configuration from declarative file
apply_kong_config() {
    echo "📋 Applying Kong configuration..."
    
    if [ -f "$KONG_CONFIG_DIR/kong.yaml" ]; then
        # Use deck to apply configuration
        if command -v deck &> /dev/null; then
            echo "Using deck to apply configuration..."
            deck sync --kong-addr "$KONG_ADMIN_URL" --state "$KONG_CONFIG_DIR/kong.yaml"
        else
            echo "⚠️  deck not found, applying configuration via Admin API..."
            apply_config_via_api
        fi
    else
        echo "❌ Kong configuration file not found at $KONG_CONFIG_DIR/kong.yaml"
        exit 1
    fi
}

# Apply configuration via Kong Admin API (fallback method)
apply_config_via_api() {
    echo "🔧 Applying configuration via Kong Admin API..."
    
    # Create services
    create_service "node-backend" "http://node-backend:9999"
    create_service "message-broker" "http://message-broker:8080"
    create_service "load-balancer" "http://load-balancer:8081"
    create_service "cache-coordinator" "http://cache-coordinator:8083"
    create_service "stream-processor" "http://stream-processor:8084"
    create_service "ml-stream-processor" "http://ml-stream-processor:8088"
    create_service "shared-memory" "http://shared-memory:8089"
    create_service "tracing-service" "http://tracing-service:8090"
    create_service "metrics-aggregator" "http://metrics-aggregator:8091"
    create_service "go-ml-inference" "http://go-ml-inference:8086"
    create_service "rust-ml-inference" "http://rust-ml-inference:8087"
    create_service "rust-parameter-analytics" "http://rust-parameter-analytics:8092"
    create_service "rust-ab-mcts" "http://rust-ab-mcts:8093"
    create_service "service-discovery" "http://service-discovery:8094"
    
    # Create routes
    create_route "api-routes" "node-backend" "/api"
    create_route "message-broker-routes" "message-broker" "/broker"
    create_route "load-balancer-routes" "load-balancer" "/load-balancer"
    create_route "cache-routes" "cache-coordinator" "/cache"
    create_route "stream-routes" "stream-processor" "/stream"
    create_route "ml-stream-routes" "ml-stream-processor" "/ml-stream"
    create_route "shared-memory-routes" "shared-memory" "/shared-memory"
    create_route "tracing-routes" "tracing-service" "/tracing"
    create_route "metrics-routes" "metrics-aggregator" "/metrics"
    create_route "go-ml-routes" "go-ml-inference" "/ml/go"
    create_route "rust-ml-routes" "rust-ml-inference" "/ml/rust"
    create_route "rust-analytics-routes" "rust-parameter-analytics" "/analytics"
    create_route "rust-mcts-routes" "rust-ab-mcts" "/mcts"
    create_route "discovery-routes" "service-discovery" "/discovery"
    
    # Apply global plugins
    apply_global_plugins
    
    echo "✅ Configuration applied successfully!"
}

# Create a Kong service
create_service() {
    local name=$1
    local url=$2
    
    echo "Creating service: $name -> $url"
    curl -X POST "$KONG_ADMIN_URL/services" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$name\",
            \"url\": \"$url\",
            \"connect_timeout\": 60000,
            \"write_timeout\": 60000,
            \"read_timeout\": 60000
        }" 2>/dev/null || echo "Service $name might already exist"
}

# Create a Kong route
create_route() {
    local name=$1
    local service=$2
    local path=$3
    
    echo "Creating route: $name for service $service on path $path"
    curl -X POST "$KONG_ADMIN_URL/routes" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$name\",
            \"service\": {\"name\": \"$service\"},
            \"paths\": [\"$path\"],
            \"strip_path\": false,
            \"preserve_host\": true
        }" 2>/dev/null || echo "Route $name might already exist"
}

# Apply global plugins
apply_global_plugins() {
    echo "🔌 Applying global plugins..."
    
    # Prometheus plugin
    curl -X POST "$KONG_ADMIN_URL/plugins" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "prometheus",
            "config": {
                "per_consumer": false,
                "status_code_metrics": true,
                "latency_metrics": true,
                "bandwidth_metrics": true,
                "upstream_health_metrics": true
            }
        }' 2>/dev/null || echo "Prometheus plugin might already exist"
    
    # Request ID plugin
    curl -X POST "$KONG_ADMIN_URL/plugins" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "request-id",
            "config": {
                "header_name": "X-Kong-Request-ID",
                "generator": "uuid#counter"
            }
        }' 2>/dev/null || echo "Request ID plugin might already exist"
    
    # CORS plugin for API routes
    curl -X POST "$KONG_ADMIN_URL/services/node-backend/plugins" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "cors",
            "config": {
                "origins": ["*"],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "headers": ["Accept", "Accept-Version", "Content-Length", "Content-MD5", "Content-Type", "Date", "X-Auth-Token", "Authorization"],
                "exposed_headers": ["X-Auth-Token"],
                "credentials": true,
                "max_age": 3600
            }
        }' 2>/dev/null || echo "CORS plugin might already exist"
}

# Verify Kong configuration
verify_configuration() {
    echo "🔍 Verifying Kong configuration..."
    
    # Check services
    echo "📋 Services:"
    curl -s "$KONG_ADMIN_URL/services" | jq -r '.data[] | "- \(.name): \(.url)"' 2>/dev/null || echo "Could not list services"
    
    # Check routes
    echo "🛣️  Routes:"
    curl -s "$KONG_ADMIN_URL/routes" | jq -r '.data[] | "- \(.name): \(.paths[])"' 2>/dev/null || echo "Could not list routes"
    
    # Check plugins
    echo "🔌 Global Plugins:"
    curl -s "$KONG_ADMIN_URL/plugins" | jq -r '.data[] | select(.service == null and .route == null) | "- \(.name)"' 2>/dev/null || echo "Could not list plugins"
    
    echo "✅ Configuration verification complete!"
}

# Test Kong routing
test_kong_routing() {
    echo "🧪 Testing Kong routing..."
    
    # Test health endpoint through Kong
    if curl -f -s "http://localhost:8000/api/health" > /dev/null; then
        echo "✅ API routing test passed"
    else
        echo "⚠️  API routing test failed - check service connectivity"
    fi
    
    # Test metrics endpoint
    if curl -f -s "http://localhost:8000/metrics/health" > /dev/null; then
        echo "✅ Metrics routing test passed"
    else
        echo "⚠️  Metrics routing test failed"
    fi
    
    echo "🧪 Routing tests complete!"
}

# Main execution
main() {
    echo "🚀 Starting Kong configuration for Universal AI Tools"
    echo "Kong Admin URL: $KONG_ADMIN_URL"
    
    wait_for_kong
    apply_kong_config
    verify_configuration
    test_kong_routing
    
    echo "🎉 Kong API Gateway configured successfully!"
    echo ""
    echo "📊 Kong Dashboard: http://localhost:8002"
    echo "🔌 Kong Admin API: http://localhost:8001"
    echo "🚪 Kong Gateway: http://localhost:8000"
    echo ""
    echo "🔗 Service URLs through Kong:"
    echo "  - Main API: http://localhost:8000/api/"
    echo "  - Message Broker: http://localhost:8000/broker/"
    echo "  - ML Services: http://localhost:8000/ml/go/, http://localhost:8000/ml/rust/"
    echo "  - Analytics: http://localhost:8000/analytics/"
    echo "  - Metrics: http://localhost:8000/metrics/"
}

# Run main function
main "$@"
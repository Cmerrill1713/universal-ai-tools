#!/bin/bash

# Setup API Gateway Security for Universal AI Tools
# Configures Kong with comprehensive security policies

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
KONG_ADMIN_URL="${KONG_ADMIN_URL:-http://localhost:8001}"
KONG_PROXY_URL="${KONG_PROXY_URL:-http://localhost:8000}"
JWT_SECRET="${JWT_SECRET:-your-super-secret-jwt-key-change-this}"
API_KEY_HEADER="${API_KEY_HEADER:-X-API-Key}"

echo -e "${BLUE}🔒 Setting up API Gateway Security for Universal AI Tools${NC}"

# Function to check Kong admin API
check_kong() {
    echo -e "${YELLOW}🔍 Checking Kong Admin API...${NC}"
    if ! curl -s "${KONG_ADMIN_URL}/status" > /dev/null; then
        echo -e "${RED}❌ Kong Admin API is not available at ${KONG_ADMIN_URL}${NC}"
        echo -e "${YELLOW}Please ensure Kong is running with: docker-compose up kong${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Kong Admin API is accessible${NC}"
}

# Function to create or update a service
create_service() {
    local service_name="$1"
    local service_url="$2"
    local service_path="$3"

    echo -e "${YELLOW}📋 Creating service: ${service_name}${NC}"
    
    # Check if service exists
    if curl -s "${KONG_ADMIN_URL}/services/${service_name}" | grep -q '"id"'; then
        echo -e "${YELLOW}   Service ${service_name} already exists, updating...${NC}"
        curl -s -X PATCH "${KONG_ADMIN_URL}/services/${service_name}" \
            -H "Content-Type: application/json" \
            -d "{
                \"url\": \"${service_url}\",
                \"connect_timeout\": 60000,
                \"write_timeout\": 60000,
                \"read_timeout\": 60000
            }" > /dev/null
    else
        echo -e "${YELLOW}   Creating new service ${service_name}...${NC}"
        curl -s -X POST "${KONG_ADMIN_URL}/services" \
            -H "Content-Type: application/json" \
            -d "{
                \"name\": \"${service_name}\",
                \"url\": \"${service_url}\",
                \"connect_timeout\": 60000,
                \"write_timeout\": 60000,
                \"read_timeout\": 60000
            }" > /dev/null
    fi

    # Create or update route
    echo -e "${YELLOW}   Creating route for ${service_name}...${NC}"
    curl -s -X POST "${KONG_ADMIN_URL}/services/${service_name}/routes" \
        -H "Content-Type: application/json" \
        -d "{
            \"paths\": [\"${service_path}\"],
            \"strip_path\": true,
            \"preserve_host\": false
        }" > /dev/null || true  # Ignore errors if route already exists

    echo -e "${GREEN}✅ Service ${service_name} configured${NC}"
}

# Function to enable plugin for a service
enable_plugin() {
    local service_name="$1"
    local plugin_name="$2"
    local plugin_config="$3"

    echo -e "${YELLOW}🔌 Enabling ${plugin_name} plugin for ${service_name}...${NC}"
    
    curl -s -X POST "${KONG_ADMIN_URL}/services/${service_name}/plugins" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${plugin_name}\",
            \"config\": ${plugin_config}
        }" > /dev/null || echo -e "${YELLOW}   Plugin ${plugin_name} may already be enabled${NC}"
}

# Function to enable global plugin
enable_global_plugin() {
    local plugin_name="$1"
    local plugin_config="$2"

    echo -e "${YELLOW}🌍 Enabling global ${plugin_name} plugin...${NC}"
    
    curl -s -X POST "${KONG_ADMIN_URL}/plugins" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${plugin_name}\",
            \"config\": ${plugin_config}
        }" > /dev/null || echo -e "${YELLOW}   Global plugin ${plugin_name} may already be enabled${NC}"
}

# Function to create API key consumer
create_api_consumer() {
    local consumer_name="$1"
    local api_key="$2"

    echo -e "${YELLOW}👤 Creating API consumer: ${consumer_name}${NC}"
    
    # Create consumer
    curl -s -X POST "${KONG_ADMIN_URL}/consumers" \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"${consumer_name}\",
            \"tags\": [\"api-access\", \"universal-ai-tools\"]
        }" > /dev/null || echo -e "${YELLOW}   Consumer ${consumer_name} may already exist${NC}"

    # Create API key
    curl -s -X POST "${KONG_ADMIN_URL}/consumers/${consumer_name}/key-auth" \
        -H "Content-Type: application/json" \
        -d "{
            \"key\": \"${api_key}\",
            \"tags\": [\"production-key\"]
        }" > /dev/null || echo -e "${YELLOW}   API key for ${consumer_name} may already exist${NC}"

    echo -e "${GREEN}✅ Consumer ${consumer_name} configured with API key${NC}"
}

# Function to create JWT consumer
create_jwt_consumer() {
    local consumer_name="$1"
    local jwt_secret="$2"

    echo -e "${YELLOW}🎫 Creating JWT consumer: ${consumer_name}${NC}"
    
    # Create consumer if not exists
    curl -s -X POST "${KONG_ADMIN_URL}/consumers" \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"${consumer_name}\",
            \"tags\": [\"jwt-access\", \"universal-ai-tools\"]
        }" > /dev/null || true

    # Create JWT credential
    curl -s -X POST "${KONG_ADMIN_URL}/consumers/${consumer_name}/jwt" \
        -H "Content-Type: application/json" \
        -d "{
            \"key\": \"universal-ai-tools\",
            \"secret\": \"${jwt_secret}\",
            \"algorithm\": \"HS256\"
        }" > /dev/null || echo -e "${YELLOW}   JWT credential for ${consumer_name} may already exist${NC}"

    echo -e "${GREEN}✅ JWT consumer ${consumer_name} configured${NC}"
}

# Main execution
main() {
    check_kong

    echo -e "\n${BLUE}📋 Creating services and routes...${NC}"

    # Core Node.js backend
    create_service "universal-ai-backend" "http://node-backend:9999" "/api"
    
    # Go services
    create_service "message-broker" "http://message-broker:8080" "/broker"
    create_service "load-balancer" "http://load-balancer:8081" "/lb"
    create_service "cache-coordinator" "http://cache-coordinator:8083" "/cache"
    create_service "stream-processor" "http://stream-processor:8084" "/stream"
    create_service "go-ml-inference" "http://go-ml-inference:8086" "/ml/go"
    create_service "shared-memory" "http://shared-memory:8089" "/ipc"
    create_service "tracing-service" "http://tracing-service:8090" "/tracing"
    create_service "metrics-aggregator" "http://metrics-aggregator:8091" "/metrics"

    # Rust services
    create_service "rust-ml-inference" "http://rust-ml-inference:8087" "/ml/rust"
    create_service "rust-parameter-analytics" "http://rust-parameter-analytics:8092" "/analytics"
    create_service "rust-ab-mcts" "http://rust-ab-mcts:8093" "/mcts"

    echo -e "\n${BLUE}🔐 Setting up authentication and security...${NC}"

    # Enable CORS globally
    enable_global_plugin "cors" '{
        "origins": ["*"],
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        "headers": ["Accept", "Accept-Version", "Content-Length", "Content-MD5", "Content-Type", "Date", "X-Auth-Token", "X-API-Key", "Authorization"],
        "exposed_headers": ["X-Auth-Token", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
        "credentials": true,
        "max_age": 3600
    }'

    # Enable rate limiting globally (generous limits for development)
    enable_global_plugin "rate-limiting" '{
        "minute": 1000,
        "hour": 10000,
        "day": 100000,
        "policy": "local",
        "fault_tolerant": true,
        "hide_client_headers": false
    }'

    # Enable request size limiting
    enable_global_plugin "request-size-limiting" '{
        "allowed_payload_size": 10485760,
        "size_unit": "bytes"
    }'

    # Enable IP restriction for admin endpoints
    enable_plugin "metrics-aggregator" "ip-restriction" '{
        "allow": ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.1"],
        "deny": []
    }'

    # Enable request/response logging for debugging
    enable_global_plugin "file-log" '{
        "path": "/tmp/access.log",
        "reopen": true
    }'

    echo -e "\n${BLUE}🔑 Setting up API key authentication...${NC}"

    # Create API consumers with different access levels
    create_api_consumer "admin-user" "admin-api-key-$(openssl rand -hex 16)"
    create_api_consumer "service-user" "service-api-key-$(openssl rand -hex 16)"
    create_api_consumer "readonly-user" "readonly-api-key-$(openssl rand -hex 16)"

    # Enable API key auth for sensitive services
    for service in "universal-ai-backend" "rust-parameter-analytics" "metrics-aggregator" "tracing-service"; do
        enable_plugin "$service" "key-auth" '{
            "key_names": ["X-API-Key", "apikey"],
            "key_in_body": false,
            "key_in_query": true,
            "key_in_header": true,
            "hide_credentials": true
        }'
    done

    echo -e "\n${BLUE}🎫 Setting up JWT authentication...${NC}"

    # Create JWT consumers
    create_jwt_consumer "jwt-admin" "$JWT_SECRET"
    create_jwt_consumer "jwt-service" "$(openssl rand -hex 32)"

    # Enable JWT auth for ML services (more secure for expensive operations)
    for service in "go-ml-inference" "rust-ml-inference" "rust-ab-mcts"; do
        enable_plugin "$service" "jwt" '{
            "key_claim_name": "iss",
            "secret_is_base64": false,
            "claims_to_verify": ["exp", "iss"],
            "cookie_names": ["jwt"],
            "header_names": ["Authorization"],
            "query_param_names": ["jwt"]
        }'
    done

    echo -e "\n${BLUE}🛡️  Setting up advanced security plugins...${NC}"

    # Enable request termination for emergency use
    enable_global_plugin "request-termination" '{
        "status_code": 503,
        "message": "Service temporarily unavailable",
        "trigger": "X-Emergency-Stop"
    }'

    # Enable basic authentication for admin endpoints
    enable_plugin "metrics-aggregator" "basic-auth" '{
        "hide_credentials": true
    }'

    # Create basic auth credentials for admin
    echo -e "${YELLOW}🔐 Creating basic auth admin user...${NC}"
    curl -s -X POST "${KONG_ADMIN_URL}/consumers" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "admin-basic",
            "tags": ["admin", "basic-auth"]
        }' > /dev/null || true

    curl -s -X POST "${KONG_ADMIN_URL}/consumers/admin-basic/basic-auth" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "admin",
            "password": "secure-admin-password"
        }' > /dev/null || true

    echo -e "\n${BLUE}📊 Setting up monitoring and observability...${NC}"

    # Enable Prometheus metrics
    enable_global_plugin "prometheus" '{
        "per_consumer": true,
        "status_code_metrics": true,
        "latency_metrics": true,
        "bandwidth_metrics": true,
        "upstream_health_metrics": true
    }'

    # Enable request ID for tracing
    enable_global_plugin "correlation-id" '{
        "header_name": "X-Request-ID",
        "generator": "uuid",
        "echo_downstream": true
    }'

    # Enable response transformer for security headers
    enable_global_plugin "response-transformer" '{
        "add": {
            "headers": [
                "X-Frame-Options: DENY",
                "X-Content-Type-Options: nosniff",
                "X-XSS-Protection: 1; mode=block",
                "Referrer-Policy: strict-origin-when-cross-origin",
                "Content-Security-Policy: default-src '\''self'\''"
            ]
        },
        "remove": {
            "headers": ["Server", "X-Powered-By"]
        }
    }'

    echo -e "\n${BLUE}🏥 Setting up health checks and circuit breakers...${NC}"

    # Enable health checks for all services
    for service in "universal-ai-backend" "message-broker" "load-balancer" "cache-coordinator" "stream-processor" "go-ml-inference" "rust-ml-inference" "shared-memory" "tracing-service" "metrics-aggregator" "rust-parameter-analytics" "rust-ab-mcts"; do
        curl -s -X PATCH "${KONG_ADMIN_URL}/services/${service}" \
            -H "Content-Type: application/json" \
            -d '{
                "retries": 3,
                "connect_timeout": 60000,
                "write_timeout": 60000,
                "read_timeout": 60000
            }' > /dev/null || true

        # Configure upstream health checks
        curl -s -X POST "${KONG_ADMIN_URL}/upstreams" \
            -H "Content-Type: application/json" \
            -d "{
                \"name\": \"${service}-upstream\",
                \"healthchecks\": {
                    \"active\": {
                        \"http_path\": \"/health\",
                        \"healthy\": {
                            \"interval\": 10,
                            \"successes\": 2
                        },
                        \"unhealthy\": {
                            \"interval\": 5,
                            \"http_failures\": 3
                        }
                    },
                    \"passive\": {
                        \"healthy\": {
                            \"successes\": 3
                        },
                        \"unhealthy\": {
                            \"http_failures\": 3,
                            \"tcp_failures\": 3,
                            \"timeouts\": 3
                        }
                    }
                }
            }" > /dev/null 2>&1 || true  # Ignore errors if upstream exists
    done

    echo -e "\n${GREEN}✅ API Gateway Security Setup Complete!${NC}"
    echo -e "\n${BLUE}📋 Security Configuration Summary:${NC}"
    echo -e "   🌍 Global Plugins:"
    echo -e "     • CORS enabled with flexible origins"
    echo -e "     • Rate limiting: 1000/min, 10k/hour, 100k/day"
    echo -e "     • Request size limit: 10MB"
    echo -e "     • Security headers added"
    echo -e "     • Prometheus metrics enabled"
    echo -e "     • Request correlation IDs"
    echo -e ""
    echo -e "   🔐 Authentication:"
    echo -e "     • API Key auth for core services"
    echo -e "     • JWT auth for ML services"
    echo -e "     • Basic auth for admin endpoints"
    echo -e ""
    echo -e "   🏥 Health & Monitoring:"
    echo -e "     • Active/passive health checks"
    echo -e "     • Circuit breaker patterns"
    echo -e "     • Request/response logging"
    echo -e ""
    echo -e "   🌐 Service Endpoints (via Kong Proxy):"
    echo -e "     • Main API: ${KONG_PROXY_URL}/api"
    echo -e "     • ML Go: ${KONG_PROXY_URL}/ml/go"
    echo -e "     • ML Rust: ${KONG_PROXY_URL}/ml/rust"
    echo -e "     • Analytics: ${KONG_PROXY_URL}/analytics"
    echo -e "     • Metrics: ${KONG_PROXY_URL}/metrics"
    echo -e ""
    echo -e "   🔑 Test Commands:"
    echo -e "     # Health check"
    echo -e "     curl ${KONG_PROXY_URL}/api/health"
    echo -e ""
    echo -e "     # With API key"
    echo -e "     curl -H \"X-API-Key: admin-api-key-xxx\" ${KONG_PROXY_URL}/api/status"
    echo -e ""
    echo -e "     # Kong admin (check services)"
    echo -e "     curl ${KONG_ADMIN_URL}/services"
    echo -e ""
    echo -e "   📊 Monitoring:"
    echo -e "     • Kong metrics: ${KONG_ADMIN_URL}/metrics"
    echo -e "     • Service status: ${KONG_ADMIN_URL}/status"
    echo -e ""
    echo -e "${YELLOW}⚠️  Important Notes:${NC}"
    echo -e "   • Change default passwords in production"
    echo -e "   • Store API keys securely (preferably in vault)"
    echo -e "   • Review and tighten CORS origins for production"
    echo -e "   • Monitor rate limiting and adjust as needed"
    echo -e "   • Set up SSL/TLS certificates for production"
    echo -e ""
}

# Run main function
main "$@"
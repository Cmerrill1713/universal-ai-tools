#!/bin/bash

# TypeScript Service Deprecation Plan
# Phase out remaining TypeScript services and migrate critical functionality to Go/Rust

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/typescript-deprecation.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() { log "${BLUE}[INFO]${NC} $1"; }
log_success() { log "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { log "${YELLOW}[WARNING]${NC} $1"; }
log_error() { log "${RED}[ERROR]${NC} $1"; }

# Critical services that should be migrated (not just removed)
CRITICAL_SERVICES=(
    "src/routers/auth.ts"
    "src/routers/chat.ts"
    "src/routers/agents.ts"
    "src/routers/monitoring.ts"
    "src/routers/models.ts"
    "src/services/core/llm-router/unified-router-service.ts"
)

# Services that can be deprecated/removed
DEPRECATED_SERVICES=(
    "src/routers/vision-debug.ts"
    "src/routers/vision-debug-simple.ts"
    "src/routers/mlx-fine-tuning.ts" 
    "src/routers/autocodebench-reasonrank-router.ts"
    "src/routers/codebase-optimizer.ts"
    "src/routers/feature-discovery.ts"
    "src/routers/knowledge-scraper.ts"
    "src/routers/swift-docs.ts"
    "src/routers/training.ts"
    "src/routers/huggingface.ts"
    "src/routers/athena.ts"
    "src/routers/speculative-decoding.ts"
    "src/routers/flash-attention.ts"
    "src/routers/self-optimization.ts"
    "src/routers/mobile-orchestration.ts"
    "src/routers/autonomous-actions.ts"
)

# Check current service status
check_service_usage() {
    local service_file="$1"
    log_info "Analyzing usage of $service_file"
    
    # Check if service is imported/used in other files
    local service_name=$(basename "$service_file" .ts)
    local import_count=$(grep -r "import.*$service_name" "$PROJECT_ROOT/src" 2>/dev/null | wc -l || echo 0)
    local usage_count=$(grep -r "$service_name" "$PROJECT_ROOT/src" 2>/dev/null | wc -l || echo 0)
    
    echo "  - Imports: $import_count"
    echo "  - Usage references: $usage_count"
    
    if [ "$import_count" -eq 0 ] && [ "$usage_count" -le 2 ]; then
        echo "  - Status: SAFE TO REMOVE"
        return 0
    else
        echo "  - Status: HAS DEPENDENCIES"
        return 1
    fi
}

# Create Go/Rust migration stubs for critical services
create_migration_stubs() {
    log_info "Creating migration stubs for critical services"
    
    # Create Go router stubs
    mkdir -p "$PROJECT_ROOT/go-api-gateway/internal/api"
    
    cat > "$PROJECT_ROOT/go-api-gateway/internal/api/chat.go" << 'EOF'
package api

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

// ChatRouter handles chat-related endpoints
// Migrated from TypeScript src/routers/chat.ts
func ChatRouter() *gin.Engine {
    router := gin.Default()
    
    // POST /api/chat
    router.POST("/api/chat", handleChatCompletion)
    
    // GET /api/chat/history
    router.GET("/api/chat/history", getChatHistory)
    
    return router
}

func handleChatCompletion(c *gin.Context) {
    // TODO: Implement chat completion logic
    // This should proxy to Rust LLM Router service
    c.JSON(http.StatusNotImplemented, gin.H{
        "error": "Chat completion migration in progress",
        "migrated_from": "TypeScript",
        "target_service": "rust-llm-router",
    })
}

func getChatHistory(c *gin.Context) {
    // TODO: Implement chat history retrieval
    c.JSON(http.StatusNotImplemented, gin.H{
        "error": "Chat history migration in progress",
        "migrated_from": "TypeScript",
    })
}
EOF

    cat > "$PROJECT_ROOT/go-api-gateway/internal/api/agents.go" << 'EOF'
package api

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

// AgentsRouter handles agent management endpoints
// Migrated from TypeScript src/routers/agents.ts
func AgentsRouter() *gin.Engine {
    router := gin.Default()
    
    // GET /api/agents
    router.GET("/api/agents", listAgents)
    
    // POST /api/agents/:id/execute
    router.POST("/api/agents/:id/execute", executeAgent)
    
    return router
}

func listAgents(c *gin.Context) {
    // TODO: Implement agent listing
    c.JSON(http.StatusNotImplemented, gin.H{
        "error": "Agent management migration in progress",
        "migrated_from": "TypeScript",
    })
}

func executeAgent(c *gin.Context) {
    // TODO: Implement agent execution
    c.JSON(http.StatusNotImplemented, gin.H{
        "error": "Agent execution migration in progress", 
        "migrated_from": "TypeScript",
    })
}
EOF

    log_success "Migration stubs created"
}

# Mark TypeScript services as deprecated
mark_deprecated() {
    local service_file="$1"
    log_info "Marking $service_file as deprecated"
    
    # Add deprecation notice to the top of the file
    local temp_file=$(mktemp)
    cat > "$temp_file" << EOF
/**
 * @deprecated This TypeScript service is being phased out as part of the Go/Rust migration.
 * New functionality should be implemented in Go (API Gateway) or Rust (AI Core).
 * This service will be removed in a future release.
 * 
 * Migration target: Go API Gateway
 * Migration date: $(date +%Y-%m-%d)
 */

EOF
    
    if [ -f "$PROJECT_ROOT/$service_file" ]; then
        cat "$PROJECT_ROOT/$service_file" >> "$temp_file"
        mv "$temp_file" "$PROJECT_ROOT/$service_file"
        log_success "Marked $service_file as deprecated"
    else
        rm "$temp_file"
        log_warning "File $service_file not found"
    fi
}

# Remove unused TypeScript services
remove_deprecated_service() {
    local service_file="$1"
    log_info "Removing deprecated service: $service_file"
    
    if [ -f "$PROJECT_ROOT/$service_file" ]; then
        # Create backup
        local backup_dir="$PROJECT_ROOT/deprecated-services-backup"
        mkdir -p "$backup_dir"
        cp "$PROJECT_ROOT/$service_file" "$backup_dir/$(basename "$service_file")"
        
        # Remove the service
        rm "$PROJECT_ROOT/$service_file"
        log_success "Removed $service_file (backup created)"
    else
        log_warning "File $service_file not found"
    fi
}

# Update main server to disable TypeScript routes
update_server_config() {
    log_info "Updating server configuration to disable TypeScript routes"
    
    # Create a migration configuration file
    cat > "$PROJECT_ROOT/migration-config.json" << EOF
{
    "migration": {
        "phase": "typescript-deprecation",
        "typescript_routes_enabled": false,
        "go_routes_enabled": true,
        "rust_services_enabled": true,
        "deprecation_warnings": true
    },
    "deprecated_services": [
$(printf '        "%s",' "${DEPRECATED_SERVICES[@]}" | sed '$ s/,$//')
    ],
    "critical_migrations": [
$(printf '        "%s",' "${CRITICAL_SERVICES[@]}" | sed '$ s/,$//')
    ]
}
EOF

    log_success "Migration configuration updated"
}

# Main deprecation process
main() {
    log_info "Starting TypeScript service deprecation process"
    
    # Phase 1: Analyze current usage
    log_info "=== Phase 1: Service Usage Analysis ==="
    for service in "${DEPRECATED_SERVICES[@]}"; do
        if check_service_usage "$service"; then
            log_success "$service can be safely removed"
        else
            log_warning "$service has dependencies - manual review needed"
        fi
    done
    
    # Phase 2: Create migration stubs for critical services
    log_info "=== Phase 2: Creating Migration Stubs ==="
    create_migration_stubs
    
    # Phase 3: Mark critical services as deprecated (but don't remove yet)
    log_info "=== Phase 3: Marking Critical Services as Deprecated ==="
    for service in "${CRITICAL_SERVICES[@]}"; do
        mark_deprecated "$service"
    done
    
    # Phase 4: Remove unused services
    log_info "=== Phase 4: Removing Unused Services ==="
    for service in "${DEPRECATED_SERVICES[@]}"; do
        if check_service_usage "$service" >/dev/null 2>&1; then
            remove_deprecated_service "$service"
        else
            log_warning "Skipping $service - still has dependencies"
        fi
    done
    
    # Phase 5: Update configuration
    log_info "=== Phase 5: Updating Configuration ==="
    update_server_config
    
    # Summary
    log_success "TypeScript deprecation process completed"
    echo ""
    echo "Summary:"
    echo "- Critical services marked as deprecated with migration stubs"
    echo "- Unused services removed (backups created)"
    echo "- Migration configuration updated"
    echo ""
    echo "Next steps:"
    echo "1. Implement Go/Rust replacements for critical services"
    echo "2. Update client applications to use new endpoints"
    echo "3. Complete migration and remove deprecated TypeScript files"
    echo ""
    echo "Logs: $LOG_FILE"
}

# Command line interface
case "${1:-start}" in
    "start")
        main
        ;;
    "analyze")
        log_info "Analyzing TypeScript service usage..."
        for service in "${CRITICAL_SERVICES[@]}" "${DEPRECATED_SERVICES[@]}"; do
            check_service_usage "$service"
            echo ""
        done
        ;;
    "stubs")
        create_migration_stubs
        ;;
    "mark-deprecated")
        for service in "${CRITICAL_SERVICES[@]}"; do
            mark_deprecated "$service"
        done
        ;;
    "help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start         Run complete deprecation process (default)"
        echo "  analyze       Analyze service usage without making changes"
        echo "  stubs         Create Go/Rust migration stubs only"
        echo "  mark-deprecated  Mark critical services as deprecated"
        echo "  help          Show this help message"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
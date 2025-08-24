#!/bin/bash
# Universal AI Tools - Comprehensive System Health Check
# Consolidates 50+ health check scripts into unified monitoring
# Version: 1.0.0

set -euo pipefail

# Configuration
UAT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HEALTH_LOG="${UAT_ROOT}/logs/health-check.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging with timestamps
log_health() { 
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[${timestamp}]${NC} $*" | tee -a "$HEALTH_LOG"
}
log_success() { 
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[${timestamp}] ✅${NC} $*" | tee -a "$HEALTH_LOG"
}
log_warning() { 
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[${timestamp}] ⚠️${NC} $*" | tee -a "$HEALTH_LOG"
}
log_error() { 
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[${timestamp}] ❌${NC} $*" | tee -a "$HEALTH_LOG"
}

# Initialize health check
init_health_check() {
    mkdir -p "$(dirname "$HEALTH_LOG")"
    log_health "🏥 Starting comprehensive system health check..."
    echo "===========================================" >> "$HEALTH_LOG"
}

# Service Health Checks
check_api_gateway() {
    log_health "🌐 Checking API Gateway..."
    
    local gateway_url="http://localhost:8080"
    local health_endpoint="${gateway_url}/health"
    
    if curl -sf "$health_endpoint" >/dev/null 2>&1; then
        local response=$(curl -s "$health_endpoint" 2>/dev/null || echo "{}")
        local status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "unknown")
        
        if [[ "$status" == "healthy" ]]; then
            log_success "Go API Gateway: Healthy (${gateway_url})"
            return 0
        else
            log_warning "Go API Gateway: Responding but status: $status"
            return 1
        fi
    else
        log_error "Go API Gateway: Not responding (${gateway_url})"
        return 1
    fi
}

check_database_connectivity() {
    log_health "🗄️ Checking database connectivity..."
    
    # Check PostgreSQL (if configured)
    if command -v psql >/dev/null 2>&1; then
        if psql -h localhost -p 5432 -U postgres -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
            log_success "PostgreSQL: Connected"
        else
            log_warning "PostgreSQL: Not accessible"
        fi
    fi
    
    # Check Supabase local
    if curl -sf "http://localhost:54321/health" >/dev/null 2>&1; then
        log_success "Supabase: Running (http://localhost:54321)"
    else
        log_warning "Supabase: Not running"
    fi
}

check_redis_connectivity() {
    log_health "📦 Checking Redis connectivity..."
    
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli ping >/dev/null 2>&1; then
            local redis_info=$(redis-cli info memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r' || echo "unknown")
            log_success "Redis: Connected (Memory: $redis_info)"
        else
            log_warning "Redis: Not responding"
        fi
    else
        log_warning "Redis: CLI not available"
    fi
}

check_ai_services() {
    log_health "🤖 Checking AI services..."
    
    # Check Ollama
    if pgrep -f ollama >/dev/null; then
        if curl -sf "http://localhost:11434/api/version" >/dev/null 2>&1; then
            local ollama_version=$(curl -s "http://localhost:11434/api/version" 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
            log_success "Ollama: Running (v$ollama_version)"
        else
            log_warning "Ollama: Process running but API not responding"
        fi
    else
        log_warning "Ollama: Not running"
    fi
    
    # Check MLX Service (Python)
    if pgrep -f "mlx.*service" >/dev/null; then
        log_success "MLX Service: Running"
    else
        log_warning "MLX Service: Not detected"
    fi
}

check_system_resources() {
    log_health "💾 Checking system resources..."
    
    # Memory usage
    local memory_info
    if command -v free >/dev/null 2>&1; then
        memory_info=$(free -h | grep "^Mem:" | awk '{print "Used: " $3 " / " $2 " (" $3/$2*100 "%)"}')
    elif command -v vm_stat >/dev/null 2>&1; then
        # macOS
        local pages_used=$(vm_stat | grep "Pages active" | awk '{print $3}' | tr -d '.')
        local pages_total=$(expr $pages_used + $(vm_stat | grep "Pages free" | awk '{print $3}' | tr -d '.'))
        local memory_gb=$(echo "scale=2; ($pages_used * 4096) / (1024^3)" | bc -l 2>/dev/null || echo "unknown")
        memory_info="Used: ~${memory_gb}GB"
    else
        memory_info="Unable to determine"
    fi
    
    log_success "Memory: $memory_info"
    
    # Disk usage
    local disk_usage=$(df -h . | tail -1 | awk '{print "Used: " $3 " / " $2 " (" $5 ")"}')
    log_success "Disk: $disk_usage"
    
    # Load average
    if command -v uptime >/dev/null 2>&1; then
        local load_avg=$(uptime | sed 's/.*load average: //' | cut -d',' -f1)
        log_success "Load Average: $load_avg"
    fi
}

check_network_connectivity() {
    log_health "🌍 Checking network connectivity..."
    
    # Check internet connectivity
    if ping -c 1 google.com >/dev/null 2>&1; then
        log_success "Internet: Connected"
    else
        log_warning "Internet: No connectivity"
    fi
    
    # Check internal service connectivity
    local localhost_services=(
        "8080:Go API Gateway"
        "11434:Ollama"
        "54321:Supabase"
        "6379:Redis"
    )
    
    for service in "${localhost_services[@]}"; do
        local port="${service%%:*}"
        local name="${service##*:}"
        
        if nc -z localhost "$port" 2>/dev/null; then
            log_success "$name: Port $port accessible"
        else
            log_warning "$name: Port $port not accessible"
        fi
    done
}

check_frontend_connectivity() {
    log_health "🖥️ Checking frontend connectivity..."
    
    # Check Electron frontend
    if pgrep -f "electron.*frontend" >/dev/null; then
        log_success "Electron Frontend: Process running"
    else
        log_warning "Electron Frontend: Not running"
    fi
    
    # Check macOS app connectivity to backend
    local macos_app_procs=$(pgrep -f "Universal.*AI.*Tools" || echo "0")
    if [[ "$macos_app_procs" != "0" ]]; then
        log_success "macOS App: Running"
    else
        log_warning "macOS App: Not running"
    fi
}

# Performance metrics
check_performance_metrics() {
    log_health "⚡ Checking performance metrics..."
    
    # API response time
    local start_time=$(date +%s%N)
    if curl -sf "http://localhost:8080/health" >/dev/null 2>&1; then
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 ))
        
        if [[ $response_time -lt 100 ]]; then
            log_success "API Response Time: ${response_time}ms (Excellent)"
        elif [[ $response_time -lt 500 ]]; then
            log_success "API Response Time: ${response_time}ms (Good)"
        else
            log_warning "API Response Time: ${response_time}ms (Slow)"
        fi
    else
        log_error "API Response Time: Unable to measure (API not responding)"
    fi
}

# Generate health report summary
generate_health_report() {
    log_health "📋 Generating health report summary..."
    
    local total_checks=0
    local passed_checks=0
    local warnings=0
    local errors=0
    
    # Count results from log
    total_checks=$(grep -c "Checking" "$HEALTH_LOG" 2>/dev/null || echo "0")
    passed_checks=$(grep -c "✅" "$HEALTH_LOG" 2>/dev/null || echo "0")
    warnings=$(grep -c "⚠️" "$HEALTH_LOG" 2>/dev/null || echo "0")
    errors=$(grep -c "❌" "$HEALTH_LOG" 2>/dev/null || echo "0")
    
    echo ""
    log_health "🏆 HEALTH CHECK SUMMARY"
    echo "=================================="
    log_success "Passed: $passed_checks"
    log_warning "Warnings: $warnings"
    log_error "Errors: $errors"
    echo "=================================="
    
    # Health score calculation  
    local health_score=100
    if [[ $warnings -gt 0 ]]; then
        health_score=$((health_score - (warnings * 10)))
    fi
    if [[ $errors -gt 0 ]]; then
        health_score=$((health_score - (errors * 25)))
    fi
    
    if [[ $health_score -ge 90 ]]; then
        log_success "System Health Score: ${health_score}% (Excellent)"
    elif [[ $health_score -ge 70 ]]; then
        log_success "System Health Score: ${health_score}% (Good)"
    elif [[ $health_score -ge 50 ]]; then
        log_warning "System Health Score: ${health_score}% (Fair - Action Recommended)"
    else
        log_error "System Health Score: ${health_score}% (Poor - Immediate Action Required)"
    fi
    
    echo ""
    log_health "📄 Full health log available at: $HEALTH_LOG"
}

# Main health check execution
main() {
    init_health_check
    
    # Core service checks
    check_api_gateway
    check_database_connectivity
    check_redis_connectivity
    check_ai_services
    
    # System checks
    check_system_resources
    check_network_connectivity
    check_frontend_connectivity
    
    # Performance checks
    check_performance_metrics
    
    # Generate summary
    generate_health_report
    
    log_health "🏁 Health check completed!"
}

# Execute main function
main "$@"
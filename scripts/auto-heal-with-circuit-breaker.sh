#!/bin/bash

# Auto-healing with circuit breaker to prevent infinite loops

declare -A RESTART_COUNT
declare -A LAST_RESTART
MAX_RESTARTS=3
COOLDOWN_PERIOD=300  # 5 minutes

check_and_heal() {
    local service=$1
    local port=$2
    local health_url=$3
    
    # Check if service needs healing
    if ! curl -sf --max-time 2 "$health_url" >/dev/null 2>&1; then
        
        # Check circuit breaker
        local count=${RESTART_COUNT[$service]:-0}
        local last=${LAST_RESTART[$service]:-0}
        local now=$(date +%s)
        
        # Reset counter if cooldown period has passed
        if [ $((now - last)) -gt $COOLDOWN_PERIOD ]; then
            RESTART_COUNT[$service]=0
            count=0
        fi
        
        # Check if we've hit the limit
        if [ $count -ge $MAX_RESTARTS ]; then
            echo "[$(date)] ⚠️ CIRCUIT BREAKER OPEN for $service - Manual intervention required!"
            echo "[$(date)] Tried $count times. Waiting for cooldown period."
            
            # Send alert (in production, this would page someone)
            echo "ALERT: $service has failed $count times and requires manual intervention" >> /tmp/uat-autoheal/alerts.log
            
            return 1
        fi
        
        # Attempt restart
        echo "[$(date)] Restarting $service (attempt $((count + 1))/$MAX_RESTARTS)"
        
        # Kill existing process
        pkill -f "$service" 2>/dev/null || true
        sleep 1
        
        # Start service based on type
        case $service in
            "go-api-gateway")
                cd /Users/christianmerrill/Desktop/universal-ai-tools/go-api-gateway
                nohup go run cmd/main.go > /tmp/uat-autoheal/go-api.log 2>&1 &
                ;;
            "rust-llm-router")
                cd /Users/christianmerrill/Desktop/universal-ai-tools/rust-services/llm-router
                nohup cargo run --release > /tmp/uat-autoheal/llm-router.log 2>&1 &
                ;;
            "rust-ai-core")
                cd /Users/christianmerrill/Desktop/universal-ai-tools/rust-services/ai-core
                nohup cargo run --release > /tmp/uat-autoheal/ai-core.log 2>&1 &
                ;;
        esac
        
        # Update counters
        RESTART_COUNT[$service]=$((count + 1))
        LAST_RESTART[$service]=$now
        
        # Wait and verify
        sleep 5
        if curl -sf --max-time 2 "$health_url" >/dev/null 2>&1; then
            echo "[$(date)] ✅ $service recovered successfully"
            RESTART_COUNT[$service]=0  # Reset on success
        else
            echo "[$(date)] ❌ $service still unhealthy after restart"
        fi
    else
        # Service is healthy, reset counter
        if [ ${RESTART_COUNT[$service]:-0} -gt 0 ]; then
            echo "[$(date)] ✅ $service is now healthy, resetting failure counter"
            RESTART_COUNT[$service]=0
        fi
    fi
}

# Main monitoring loop
echo "[$(date)] Starting auto-healing with circuit breaker protection"

while true; do
    check_and_heal "go-api-gateway" 8080 "http://localhost:8080/api/health"
    check_and_heal "rust-llm-router" 8082 "http://localhost:8082/health"
    check_and_heal "rust-ai-core" 8083 "http://localhost:8083/health"
    
    # Check for alerts
    if [ -f /tmp/uat-autoheal/alerts.log ]; then
        alerts=$(tail -n 5 /tmp/uat-autoheal/alerts.log)
        if [ -n "$alerts" ]; then
            echo "⚠️ RECENT ALERTS:"
            echo "$alerts"
        fi
    fi
    
    sleep 30
done
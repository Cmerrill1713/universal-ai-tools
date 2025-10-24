#!/bin/bash
# Athena Auto-scaling Script

MIN_INSTANCES=2
MAX_INSTANCES=10
SCALE_UP_THRESHOLD=80
SCALE_DOWN_THRESHOLD=20
CHECK_INTERVAL=30

get_cpu_usage() {
    # Get average CPU usage across all Athena instances
    ps aux | grep "src.api.api_server" | awk '{sum+=$3} END {print sum/NR}'
}

get_memory_usage() {
    # Get average memory usage across all Athena instances
    ps aux | grep "src.api.api_server" | awk '{sum+=$4} END {print sum/NR}'
}

get_active_instances() {
    ps aux | grep "src.api.api_server" | grep -v grep | wc -l
}

scale_up() {
    local current_instances=$(get_active_instances)
    if [ $current_instances -lt $MAX_INSTANCES ]; then
        echo "Scaling up from $current_instances instances..."
        cd /workspace
        PORT=$((8004 + current_instances)) python3 -m src.api.api_server &
        echo "Started instance on port $((8004 + current_instances))"
    fi
}

scale_down() {
    local current_instances=$(get_active_instances)
    if [ $current_instances -gt $MIN_INSTANCES ]; then
        echo "Scaling down from $current_instances instances..."
        # Kill the last started instance
        pkill -f "src.api.api_server" | tail -1
        echo "Removed one instance"
    fi
}

# Main scaling loop
while true; do
    cpu_usage=$(get_cpu_usage)
    memory_usage=$(get_memory_usage)
    current_instances=$(get_active_instances)
    
    echo "CPU: ${cpu_usage}%, Memory: ${memory_usage}%, Instances: $current_instances"
    
    if (( $(echo "$cpu_usage > $SCALE_UP_THRESHOLD" | bc -l) )) || (( $(echo "$memory_usage > $SCALE_UP_THRESHOLD" | bc -l) )); then
        scale_up
    elif (( $(echo "$cpu_usage < $SCALE_DOWN_THRESHOLD" | bc -l) )) && (( $(echo "$memory_usage < $SCALE_DOWN_THRESHOLD" | bc -l) )); then
        scale_down
    fi
    
    sleep $CHECK_INTERVAL
done

#!/bin/bash
while true; do
    clear
    echo "🔍 Universal AI Tools Memory Monitor"
    echo "===================================="
    echo "Time: $(date)"
    echo ""
    echo "Top Memory Consumers:"
    ps aux | grep -E 'node|python' | grep -v grep | sort -k4 -nr | head -10 | \
        awk '{printf "%-30s %5s %8s\n", substr($11,1,30), $4"%", $5/1024"MB"}'
    echo ""
    echo "Total Node.js processes: $(pgrep -f node | wc -l)"
    echo "Total Python processes: $(pgrep -f python | wc -l)"
    sleep 5
done

#!/bin/bash

# Simple but effective chaos test for API Gateway
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"

echo "🌪️  API Gateway Chaos Test"
echo "=========================="

# Test 1: Thundering Herd (1000 concurrent requests)
echo "Test 1: Sending 1000 concurrent requests..."
success=0
for i in {1..1000}; do
    curl -s -o /dev/null -f --max-time 5 "$GATEWAY_URL/health" && ((success++)) &
done
wait
echo "  Result: $success/1000 requests succeeded"

# Test 2: Rapid Fire (100 requests as fast as possible)
echo "Test 2: Rapid fire test..."
start=$(date +%s)
for i in {1..100}; do
    curl -s -o /dev/null "$GATEWAY_URL/health" &
done
wait
end=$(date +%s)
duration=$((end - start))
echo "  Result: 100 requests completed in ${duration}s"

# Test 3: Gateway health check during load
echo "Test 3: Health check during sustained load..."
# Generate background load
for i in {1..500}; do
    curl -s -o /dev/null "$GATEWAY_URL/health" &
done

# Check if gateway still responds
if curl -s -o /dev/null -f --max-time 2 "$GATEWAY_URL/health"; then
    echo "  Result: Gateway responsive during load ✅"
else
    echo "  Result: Gateway unresponsive during load ❌"
fi

wait

# Test 4: Service routing under stress
echo "Test 4: Service routing stress test..."
routing_success=0
for service in documentation ml; do
    for i in {1..50}; do
        curl -s -o /dev/null -f "$GATEWAY_URL/api/$service/health" && ((routing_success++)) &
    done
done
wait
echo "  Result: $routing_success/100 routing requests succeeded"

# Final health check
echo "Final: Gateway health after chaos..."
if curl -s -o /dev/null -f "$GATEWAY_URL/health"; then
    echo "  Result: Gateway survived chaos testing ✅"
else
    echo "  Result: Gateway failed chaos testing ❌"
fi

echo ""
echo "🎯 Chaos Test Complete"
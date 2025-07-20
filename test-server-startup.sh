#!/bin/bash

echo "Testing server startup..."
echo "Starting at: $(date)"

# Start the server in the background
npx tsx src/server.ts &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"

# Wait for server to start (checking for success message)
COUNTER=0
while [ $COUNTER -lt 30 ]; do
  if curl -s http://localhost:9999/health > /dev/null 2>&1; then
    echo "✅ Server started successfully!"
    echo "Health check response:"
    curl -s http://localhost:9999/health | jq .
    
    # Kill the server
    kill $SERVER_PID
    exit 0
  fi
  
  echo "Waiting for server to start... ($COUNTER/30)"
  sleep 1
  COUNTER=$((COUNTER+1))
done

echo "❌ Server failed to start within 30 seconds"
kill $SERVER_PID 2>/dev/null
exit 1
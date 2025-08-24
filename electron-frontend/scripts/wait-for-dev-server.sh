#!/bin/bash

# Wait for Vite dev server to start on any available port
echo "Waiting for Vite dev server to start..."

# Check ports in order of preference
PORTS=(3007 3008 3009 3010 3011 3012)
DEV_PORT=""

# Wait up to 30 seconds for server to start
for i in {1..60}; do
  for PORT in "${PORTS[@]}"; do
    # Check if it's actually a Vite dev server by looking for @vite/client
    if curl -s "http://localhost:$PORT" | grep -q "@vite/client" 2>/dev/null; then
      echo "Found Vite dev server on port $PORT"
      DEV_PORT=$PORT
      break 2
    fi
  done
  
  if [ ! -z "$DEV_PORT" ]; then
    break
  fi
  
  echo "Checking for Vite dev server... ($i/60)"
  sleep 0.5
done

if [ -z "$DEV_PORT" ]; then
  echo "❌ Vite dev server not found on any expected port"
  exit 1
fi

echo "✅ Vite dev server ready on port $DEV_PORT"
export VITE_DEV_PORT=$DEV_PORT
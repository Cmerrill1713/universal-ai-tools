#!/bin/bash

echo "=== Running Development Server ==="
echo

# Kill any existing processes
echo "1. Killing any existing node/nodemon processes..."
pkill -f "nodemon.*server.ts" 2>/dev/null || true
pkill -f "ts-node.*server.ts" 2>/dev/null || true
pkill -f "tsx.*server.ts" 2>/dev/null || true
sleep 1

echo "2. Current package.json dev script:"
grep '"dev"' package.json
echo

echo "3. Starting server with tsx directly:"
echo "Running: npx tsx watch src/server.ts"
echo
npx tsx watch src/server.ts
#!/bin/bash

echo "🌸 Starting Sweet Athena Backend Services..."
echo "=========================================="

# Export environment variables
export NODE_ENV=development
export PORT=9999
export ENABLE_SWEET_ATHENA=true
export PIXEL_STREAMING_URL=ws://localhost:8888
export SWEET_ATHENA_WEBSOCKET_PORT=8765

# Check if Supabase is running
echo "Checking Supabase status..."
if ! curl -s http://localhost:54321/rest/v1/ > /dev/null; then
    echo "Starting Supabase..."
    cd ~/Desktop/universal-ai-tools
    npx supabase start
    sleep 5
fi

# Start the backend server
echo "Starting Universal AI Tools backend with Sweet Athena..."
cd ~/Desktop/universal-ai-tools

# Use npm script that works
npm run start:minimal
#!/bin/bash

echo "🚀 Starting Universal AI Tools with Memory Optimizations"
echo "======================================================="

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "tsx watch"
pkill -f "lfm2-server.py"
pkill -f "kokoro_server.py"
pkill -f "mlx-bridge.py"
sleep 2

# Set memory limits
echo "⚙️  Setting memory limits..."
export NODE_OPTIONS="--max-old-space-size=768"  # 768MB for Node.js
export PYTHONDONTWRITEBYTECODE=1  # Don't create .pyc files
export PYTHONUNBUFFERED=1  # Unbuffered output
export MALLOC_TRIM_THRESHOLD_=100000  # Aggressive memory trimming

# Set MLX environment variables for memory efficiency
export MLX_METAL_MEMORY_LIMIT=2147483648  # 2GB limit for Metal
export MLX_DISABLE_COMPILE_CACHE=0  # Keep compile cache for performance

# Start the main server with optimizations
echo "🔄 Starting server with optimizations..."
npm run dev &

echo ""
echo "✅ Server starting with memory optimizations:"
echo "   • Node.js memory limited to 768MB"
echo "   • LFM2 using lazy loading and cache clearing"
echo "   • MLX Metal memory limited to 2GB"
echo "   • Automatic idle cleanup after 5 minutes"
echo "   • Maximum sequence length: 512 tokens"
echo ""
echo "📊 Monitor memory usage with: ./monitor-memory.sh"
echo "🛑 Stop all services with: pkill -f 'tsx|python'"
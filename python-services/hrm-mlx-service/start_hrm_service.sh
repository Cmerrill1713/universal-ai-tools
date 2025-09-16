#!/bin/bash
# HRM MLX Fine-tuning Service Startup Script

echo "🚀 Starting HRM MLX Fine-tuning Service..."

# Set environment variables
export HRM_HOST=0.0.0.0
export HRM_PORT=8002
export MLX_MODELS_PATH=/Users/christianmerrill/Desktop/universal-ai-tools/models
export HRM_ENABLE_ACT=true

# Change to service directory
cd /Users/christianmerrill/Desktop/universal-ai-tools/python-services/hrm-mlx-service

# Start the service
echo "🌐 Starting HRM service on http://$HRM_HOST:$HRM_PORT"
python3 server.py

echo "✅ HRM service stopped"

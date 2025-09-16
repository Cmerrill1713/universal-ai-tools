#!/bin/bash

echo "🚀 Starting HRM MLX Service"
cd /Users/christianmerrill/Desktop/universal-ai-tools/python-services/hrm-mlx-service
export HRM_PORT=8003
python3 server.py

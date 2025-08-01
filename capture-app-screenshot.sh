#!/bin/bash

# Script to capture screenshot of Universal AI Tools app

echo "Capturing screenshot of Universal AI Tools macOS application..."

# Create screenshots directory
mkdir -p ./screenshots

# Get current timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Capture full screen
screencapture -x "./screenshots/universal-ai-tools-full-${TIMESTAMP}.png"

# Try to capture specific window (if visible)
# First, list all windows
echo "Active windows:"
osascript -e 'tell application "System Events" to get name of every window of every process whose visible is true' 2>/dev/null

# If the app has a menu bar icon, capture the menu bar area
screencapture -x -R 0,0,1920,50 "./screenshots/universal-ai-tools-menubar-${TIMESTAMP}.png" 2>/dev/null

echo "Screenshots saved to ./screenshots/"
ls -la ./screenshots/

# Also capture process info
echo -e "\nUniversal AI Tools process info:"
ps aux | grep -i "universalaitools" | grep -v grep

echo -e "\nServer processes:"
lsof -i :9999 | head -5
lsof -i :8080 | head -5
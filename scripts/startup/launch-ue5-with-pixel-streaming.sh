#!/bin/bash

echo "🚀 Launching UE5 with Pixel Streaming Enabled"
echo "============================================"

UE5="/Users/Shared/Epic Games/UE_5.6/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor"
PROJECT="$HOME/UE5-SweetAthena/SweetAthenaUE5Project.uproject"

"$UE5" "$PROJECT" \
  -game \
  -messaging \
  -dc=PixelStreaming.AllowPixelStreamingCommands=true \
  -PixelStreamingIP=localhost \
  -PixelStreamingPort=8888 \
  -ForceLoadPlugin=PixelStreaming \
  -stdout \
  -FullStdOutLogOutput
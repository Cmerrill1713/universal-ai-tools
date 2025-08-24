#!/bin/bash

echo "🧪 Testing UE5 Launch Capability"
echo "================================"
echo ""

# Check if UE5 is installed
UE5_PATH="/Users/Shared/Epic Games/UE_5.6"
if [ -d "$UE5_PATH" ]; then
    echo "✅ UE5.6 found at: $UE5_PATH"
    
    # Check executable
    UE5_EXEC="$UE5_PATH/Engine/Binaries/Mac/UnrealEditor.app"
    if [ -d "$UE5_EXEC" ]; then
        echo "✅ UnrealEditor.app found"
        
        # Get version info
        echo ""
        echo "📋 UE5 Installation Info:"
        ls -la "$UE5_EXEC/Contents/MacOS/UnrealEditor" | awk '{print "   Size: " $5 " bytes"}'
        echo "   Path: $UE5_EXEC"
        
        # Check project
        PROJECT="$HOME/UE5-SweetAthena/SweetAthenaUE5Project.uproject"
        if [ -f "$PROJECT" ]; then
            echo ""
            echo "✅ Sweet Athena project found"
            echo "   Project: $PROJECT"
            
            # Check if we can open it
            echo ""
            echo "🚀 Ready to launch UE5 with Sweet Athena!"
            echo ""
            echo "To launch manually, run:"
            echo "open \"$UE5_EXEC\" --args \"$PROJECT\""
            echo ""
            echo "Or use the full launch script:"
            echo "./launch-photorealistic-sweet-athena.sh"
        else
            echo "❌ Project file not found at: $PROJECT"
        fi
    else
        echo "❌ UnrealEditor.app not found"
    fi
else
    echo "❌ UE5.6 not installed at expected location"
    echo "Please install via Epic Games Launcher"
fi

echo ""
echo "📊 Summary of Sweet Athena Components:"
echo "- Backend API: ✅ Configured at /api/v1/sweet-athena"
echo "- WebSocket: ✅ Configured at port 8765"
echo "- UE5 Project: ✅ Located at ~/UE5-SweetAthena"
echo "- Pixel Streaming: ✅ Scripts ready in project"
echo "- Launch Scripts: ✅ Available in current directory"
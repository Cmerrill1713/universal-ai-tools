# UE5.6 Pixel Streaming Plugin Setup Guide

## 🔌 Required Plugins

### Step 1: Open Plugin Manager
In UE5: **Edit → Plugins**

### Step 2: Enable These Plugins

#### Core Pixel Streaming:
1. **Search: "Pixel Streaming"**
   - ✅ **Pixel Streaming** (under Media Streaming)
   - ✅ **Pixel Streaming Infrastructure**
   - ✅ **Pixel Streaming Player**

#### Dependencies:
2. **Search: "WebRTC"**
   - ✅ **WebRTC** (under Networking)

3. **Search: "Video"**
   - ✅ **Video I/O Framework** (under Media)

4. **Search: "Web"**
   - ✅ **Web Browser** (if not already enabled)

### Step 3: Restart UE5
- Click **"Restart Now"** when prompted
- This is REQUIRED for plugins to load

## 🔧 After Restart

### 1. Project Settings
**Edit → Project Settings**
- Search: "Pixel Streaming"
- Set **Signaling Server URL**: `ws://localhost:8080`
- Check **Auto Start Streaming**

### 2. Editor Preferences (Optional)
**Edit → Editor Preferences**
- Level Editor → Play
- Additional Launch Parameters: `-PixelStreamingIP=localhost -PixelStreamingPort=8888`

### 3. Verify Plugins Loaded
Open console (~) and type:
```
PixelStreaming.WebRTC.DumpStats
```

If this works, plugins are loaded! If not, they didn't enable properly.

## 🚀 Start Streaming

In Play mode, console commands:
```
PixelStreaming.WebRTC.SignallingServerUrl ws://localhost:8080
PixelStreaming.WebRTC.StartStreaming
```

## ⚠️ Common Issues

### "Command not recognized"
- Plugins aren't enabled
- Need to restart UE5
- Check Output Log for plugin load errors

### Plugins are grayed out
- Close any open projects first
- Restart UE5 and try again

### Still no video after enabling
- Make sure you're in Play mode
- Check Windows → Developer Tools → Output Log
- Look for "LogPixelStreaming" messages

## 🔍 Verification

In Output Log, you should see:
```
LogPixelStreaming: Display: PixelStreaming plugin loaded successfully
LogPixelStreaming: Display: WebRTC initialization succeeded
```

## 💡 Alternative: Command Line Launch

If plugins won't enable, launch UE5 with:
```bash
"/Users/Shared/Epic Games/UE_5.6/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor" \
  "~/UE5-SweetAthena/SweetAthenaUE5Project.uproject" \
  -game \
  -messaging \
  -dc=PixelStreaming.AllowPixelStreamingCommands=true \
  -PixelStreamingIP=localhost \
  -PixelStreamingPort=8888
```
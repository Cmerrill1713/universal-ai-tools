#!/bin/bash
# Proper Swift app rebuild following best practices

echo "🔧 Rebuilding NeuroForge App - PROPER METHOD"
echo "════════════════════════════════════════════════════════════"

cd NeuroForgeApp

# 1. Clean build
echo "1. Cleaning previous build..."
rm -rf .build build 2>/dev/null
swift package clean 2>/dev/null

# 2. Resolve dependencies
echo "2. Resolving dependencies..."
swift package resolve

# 3. Build for release
echo "3. Building for release..."
swift build -c release --arch arm64

# 4. Create proper .app bundle
echo "4. Creating .app bundle..."
rm -rf /tmp/NeuroForge.app
mkdir -p /tmp/NeuroForge.app/Contents/MacOS
cp .build/release/NeuroForgeApp /tmp/NeuroForge.app/Contents/MacOS/NeuroForge
chmod +x /tmp/NeuroForge.app/Contents/MacOS/NeuroForge

# 5. Add Info.plist with ATS
cat > /tmp/NeuroForge.app/Contents/Info.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>NeuroForge</string>
    <key>CFBundleIdentifier</key>
    <string>com.neuroforge.ai</string>
    <key>CFBundleName</key>
    <string>NeuroForge AI</string>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsLocalNetworking</key>
        <true/>
    </dict>
</dict>
</plist>
PLIST

echo "✅ Build complete!"
echo ""
echo "Launch with: open /tmp/NeuroForge.app"

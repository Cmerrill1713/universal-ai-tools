#!/bin/bash
# Create proper Xcode project structure

mkdir -p NeuroForge.xcodeproj
mkdir -p NeuroForge

# Create Info.plist
cat > NeuroForge/Info.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>NeuroForge</string>
    <key>CFBundleIdentifier</key>
    <string>com.neuroforge.ai</string>
    <key>CFBundleName</key>
    <string>NeuroForge AI</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
PLIST

echo "✅ Xcode project structure created"

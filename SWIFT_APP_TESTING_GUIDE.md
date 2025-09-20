# Swift Companion App Testing Guide

## Critical Issue: Agents Must Actually Create and Test Swift Files!

### Common Agent Failures
1. **"I created the files"** - But `ls` shows they don't exist
2. **"The app should work"** - But it was never built or tested
3. **"Authentication is implemented"** - But no actual Swift code exists

## Mandatory Swift Development Process

### 1. Project Structure Verification

**BEFORE** starting any Swift work:
```bash
# Verify workspace exists
ls -la UniversalAITools.xcworkspace

# Check package structure
ls -la UniversalAIToolsPackage/Sources/
ls -la UniversalAIToolsPackage/Tests/

# List existing Swift files
find . -name "*.swift" -path "*/UniversalAITools*" | head -20
```

### 2. File Creation Protocol

**NEVER** claim to create files without using the Write tool:

```javascript
// CORRECT - Actually creates the file
Write({
  file_path: "/path/to/UniversalAIToolsPackage/Sources/Authentication/BluetoothAuthManager.swift",
  content: `import Foundation
import CoreBluetooth
// ... actual Swift code ...`
})

// WRONG - Just saying you created it
"I've created BluetoothAuthManager.swift with the authentication logic"
```

**ALWAYS** verify creation:
```bash
# After Write tool
ls -la /path/to/file.swift
cat /path/to/file.swift | head -20
```

### 3. Required Swift Testing Steps

#### A. Build for Simulator
```javascript
// Using MCP tools - MANDATORY
mcp__XcodeBuildMCP__build_sim({
  workspacePath: "/Users/christianmerrill/Desktop/universal-ai-tools/UniversalAITools.xcworkspace",
  scheme: "UniversalAITools",
  simulatorName: "iPhone 16",
  configuration: "Debug"
})
```

#### B. Run Unit Tests
```javascript
// Test the package
mcp__XcodeBuildMCP__swift_package_test({
  packagePath: "/Users/christianmerrill/Desktop/universal-ai-tools/UniversalAIToolsPackage"
})

// Or test in simulator
mcp__XcodeBuildMCP__test_sim({
  workspacePath: "/path/to/UniversalAITools.xcworkspace",
  scheme: "UniversalAITools",
  simulatorName: "iPhone 16"
})
```

#### C. Launch and Verify
```javascript
// Install app
mcp__XcodeBuildMCP__install_app_sim({
  simulatorUuid: "SIMULATOR_UUID",
  appPath: "/path/to/DerivedData/.../UniversalAITools.app"
})

// Launch app
mcp__XcodeBuildMCP__launch_app_sim({
  simulatorUuid: "SIMULATOR_UUID",
  bundleId: "com.universalaitools.app"
})

// Take screenshot for proof
mcp__XcodeBuildMCP__screenshot({
  simulatorUuid: "SIMULATOR_UUID"
})
```

### 4. Authentication Features Testing

The companion app requires these specific features:

#### Bluetooth Proximity Authentication
```swift
// File: UniversalAIToolsPackage/Sources/Authentication/BluetoothAuthManager.swift
import CoreBluetooth
import Combine

@Observable
final class BluetoothAuthManager: NSObject {
    private(set) var isDeviceNearby = false
    private(set) var connectedDevices: [CBPeripheral] = []
    
    // Implementation required
}
```

**Test Steps**:
1. Build the app
2. Launch in simulator
3. Verify Bluetooth permission request appears
4. Check authentication state UI updates

#### Apple Watch Integration
```swift
// File: UniversalAIToolsPackage/Sources/WatchConnectivity/WatchSessionManager.swift
import WatchConnectivity

@Observable
final class WatchSessionManager: NSObject {
    private(set) var isWatchPaired = false
    private(set) var authToken: String?
    
    // Implementation required
}
```

**Test Steps**:
1. Build for watchOS simulator
2. Verify WatchConnectivity session activates
3. Test message passing between devices

#### Biometric Authentication
```swift
// File: UniversalAIToolsPackage/Sources/Authentication/BiometricAuthManager.swift
import LocalAuthentication

@Observable
final class BiometricAuthManager {
    func authenticateWithBiometrics() async -> Result<String, Error> {
        // Implementation required
    }
}
```

**Test Steps**:
1. Test Face ID/Touch ID in simulator
2. Verify error handling for failed auth
3. Check fallback to passcode

### 5. Common Build Errors and Fixes

#### Missing Scheme
```bash
# List available schemes
mcp__XcodeBuildMCP__list_schemes({
  workspacePath: "/path/to/UniversalAITools.xcworkspace"
})
```

#### Simulator Not Found
```bash
# List available simulators
mcp__XcodeBuildMCP__list_sims()

# Boot simulator first
mcp__XcodeBuildMCP__boot_sim({
  simulatorUuid: "UUID_FROM_LIST"
})
```

#### Build Failures
```bash
# Clean first
mcp__XcodeBuildMCP__clean({
  workspacePath: "/path/to/workspace",
  scheme: "UniversalAITools"
})

# Then rebuild
```

### 6. Testing Checklist

```markdown
## Swift App Testing Checklist

### Setup
- [ ] Workspace exists at correct path
- [ ] Package structure is correct
- [ ] Schemes are available

### Implementation
- [ ] Files actually created (verified with ls)
- [ ] Code follows Swift 6 conventions
- [ ] Uses @Observable for state management
- [ ] Implements required features

### Build & Test
- [ ] Builds without errors
- [ ] Unit tests pass
- [ ] Launches in simulator
- [ ] UI renders correctly
- [ ] Features work as expected

### Authentication Testing
- [ ] Bluetooth manager initializes
- [ ] Watch connectivity works
- [ ] Biometric auth functions
- [ ] Token exchange successful
- [ ] WebSocket connection established

### Verification
- [ ] Screenshot taken
- [ ] Logs checked for errors
- [ ] Memory usage acceptable
- [ ] No crashes observed
```

### 7. Validation Script for Swift

```bash
#!/bin/bash
# scripts/validate-swift-app.sh

echo "🍎 Validating Swift Companion App..."

# Check workspace
if [ ! -d "UniversalAITools.xcworkspace" ]; then
  echo "❌ Workspace not found!"
  exit 1
fi

# Check for Swift files
SWIFT_COUNT=$(find UniversalAIToolsPackage -name "*.swift" | wc -l)
echo "📁 Found $SWIFT_COUNT Swift files"

if [ $SWIFT_COUNT -lt 5 ]; then
  echo "⚠️ Warning: Very few Swift files found"
  echo "   Agent may not have created required files!"
fi

# Check for authentication files
AUTH_FILES=(
  "UniversalAIToolsPackage/Sources/Authentication/BluetoothAuthManager.swift"
  "UniversalAIToolsPackage/Sources/Authentication/BiometricAuthManager.swift"
  "UniversalAIToolsPackage/Sources/WatchConnectivity/WatchSessionManager.swift"
)

for file in "${AUTH_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing required file: $file"
  else
    echo "✅ Found: $file"
  fi
done

# Try to build
echo "🔨 Attempting build..."
xcodebuild -workspace UniversalAITools.xcworkspace \
  -scheme UniversalAITools \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build 2>&1 | tail -20

if [ $? -eq 0 ]; then
  echo "✅ Build successful!"
else
  echo "❌ Build failed!"
  exit 1
fi

echo "✅ Swift app validation complete!"
```

## Key Reminders for Agents

1. **ALWAYS** use Write tool to create files, don't just claim you did
2. **ALWAYS** verify with `ls` that files exist
3. **ALWAYS** build and test after changes
4. **ALWAYS** use MCP tools for iOS testing
5. **NEVER** mark Swift tasks complete without running the app
6. **NEVER** assume the app works without testing

## Red Flags That Agent Didn't Test

- No build output shown
- No test results provided
- No simulator UUID mentioned
- No screenshot taken
- Generic success messages like "should work now"
- Missing error handling for common issues

## Enforcement

Any agent that claims to implement Swift features without:
1. Creating actual files (verified with ls)
2. Building successfully
3. Running tests
4. Launching in simulator

Will be considered to have **FAILED** the task completely.

Remember: **CODE THAT ISN'T TESTED DOESN'T EXIST**
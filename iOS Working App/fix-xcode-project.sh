#!/bin/bash

# Universal AI Tools iOS Companion - Xcode Project Fixer
# This script recreates the Xcode project with proper test target configuration

echo "🔧 Universal AI Tools iOS Companion - Xcode Project Fixer"
echo "========================================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Navigate to project directory
cd "$(dirname "$0")"

echo -e "\n${YELLOW}📋 Current Project Analysis${NC}"
echo "============================"

# Check current project structure
if [ -d "UniversalAICompanion.xcodeproj" ]; then
    echo -e "${BLUE}✅ Xcode project exists${NC}"
    echo "Project contents:"
    ls -la UniversalAICompanion.xcodeproj/
else
    echo -e "${RED}❌ Xcode project not found${NC}"
    exit 1
fi

# Check for test files
echo -e "\n${YELLOW}📝 Test Files Check${NC}"
echo "=================="

if [ -d "UniversalAICompanionTests" ]; then
    echo -e "${GREEN}✅ Unit test directory exists${NC}"
    ls -la UniversalAICompanionTests/
else
    echo -e "${RED}❌ Unit test directory missing${NC}"
fi

if [ -d "UniversalAICompanionUITests" ]; then
    echo -e "${GREEN}✅ UI test directory exists${NC}"
    ls -la UniversalAICompanionUITests/
else
    echo -e "${RED}❌ UI test directory missing${NC}"
fi

# Backup current project
echo -e "\n${YELLOW}💾 Creating Backup${NC}"
echo "=================="

BACKUP_NAME="UniversalAICompanion.xcodeproj.backup.$(date +%Y%m%d_%H%M%S)"
cp -R "UniversalAICompanion.xcodeproj" "$BACKUP_NAME"
echo -e "${GREEN}✅ Backup created: $BACKUP_NAME${NC}"

# Check if we can use xcodegen (preferred method)
if command -v xcodegen &> /dev/null; then
    echo -e "\n${YELLOW}🛠️ Using XcodeGen to recreate project${NC}"
    echo "===================================="
    
    # Create project.yml for xcodegen
    cat > project.yml << 'EOF'
name: UniversalAICompanion
options:
  bundleIdPrefix: com.universalaitools
  deploymentTarget:
    iOS: "17.0"
  
targets:
  UniversalAICompanion:
    type: application
    platform: iOS
    sources:
      - path: UniversalAICompanion
    resources:
      - path: UniversalAICompanion/Assets.xcassets
      - path: UniversalAICompanion/Preview Content
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.universalaitools.companion
      CODE_SIGN_STYLE: Automatic
      DEVELOPMENT_TEAM: ""
      ENABLE_PREVIEWS: YES
      GENERATE_INFOPLIST_FILE: YES
      INFOPLIST_KEY_UIApplicationSceneManifest_Generation: YES
      INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents: YES
      INFOPLIST_KEY_UILaunchScreen_Generation: YES
      INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad: "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"
      INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone: "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"
      SWIFT_VERSION: "5.0"
      TARGETED_DEVICE_FAMILY: "1,2"
      
  UniversalAICompanionTests:
    type: bundle.unit-test
    platform: iOS
    sources:
      - path: UniversalAICompanionTests
    dependencies:
      - target: UniversalAICompanion
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.universalaitools.companion.tests
      
  UniversalAICompanionUITests:
    type: bundle.ui-testing
    platform: iOS
    sources:
      - path: UniversalAICompanionUITests
    dependencies:
      - target: UniversalAICompanion
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.universalaitools.companion.uitests

schemes:
  UniversalAICompanion:
    build:
      targets:
        UniversalAICompanion: all
        UniversalAICompanionTests: [test]
        UniversalAICompanionUITests: [test]
    test:
      targets:
        - UniversalAICompanionTests
        - UniversalAICompanionUITests
      gatherCoverageData: true
    run:
      config: Debug
    archive:
      config: Release
EOF

    echo -e "${BLUE}Generated project.yml configuration${NC}"
    
    # Remove old project
    rm -rf UniversalAICompanion.xcodeproj
    
    # Generate new project
    xcodegen generate
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Project regenerated successfully with XcodeGen${NC}"
    else
        echo -e "${RED}❌ XcodeGen failed, restoring backup${NC}"
        cp -R "$BACKUP_NAME" "UniversalAICompanion.xcodeproj"
        exit 1
    fi
    
else
    echo -e "\n${YELLOW}⚠️ XcodeGen not available, using manual project fix${NC}"
    echo "=============================================="
    
    # Create a simple test-enabled project manually using xcodebuild
    echo -e "${BLUE}Creating new project with test targets...${NC}"
    
    # This approach creates a fresh project and copies files
    TEMP_PROJECT="TempUniversalAICompanion"
    
    # Create new project in temp location
    mkdir -p "../$TEMP_PROJECT"
    cd "../$TEMP_PROJECT"
    
    # Create minimal project structure
    mkdir -p "$TEMP_PROJECT"
    mkdir -p "${TEMP_PROJECT}Tests"
    mkdir -p "${TEMP_PROJECT}UITests"
    
    # Create basic app file
    cat > "$TEMP_PROJECT/${TEMP_PROJECT}App.swift" << 'EOF'
import SwiftUI

@main
struct TempUniversalAICompanionApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
EOF

    # Create basic content view
    cat > "$TEMP_PROJECT/ContentView.swift" << 'EOF'
import SwiftUI

struct ContentView: View {
    var body: some View {
        Text("Temp Project")
    }
}
EOF

    # Create basic test files
    cat > "${TEMP_PROJECT}Tests/${TEMP_PROJECT}Tests.swift" << 'EOF'
import XCTest

final class TempUniversalAICompanionTests: XCTestCase {
    func testExample() throws {
        XCTAssertTrue(true)
    }
}
EOF

    cat > "${TEMP_PROJECT}UITests/${TEMP_PROJECT}UITests.swift" << 'EOF'
import XCTest

final class TempUniversalAICompanionUITests: XCTestCase {
    func testExample() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(true)
    }
}
EOF

    # Go back to original directory
    cd "../iOS Working App"
    
    echo -e "${RED}❌ Manual project creation requires Xcode GUI${NC}"
    echo -e "${YELLOW}Please use Xcode to create a new iOS project with tests, then copy your source files${NC}"
fi

# Verify the new project
echo -e "\n${YELLOW}🔍 Verifying New Project${NC}"
echo "========================"

if [ -f "UniversalAICompanion.xcodeproj/project.pbxproj" ]; then
    echo -e "${GREEN}✅ Project file exists${NC}"
    
    # Check for test targets in project file
    if grep -q "UniversalAICompanionTests" UniversalAICompanion.xcodeproj/project.pbxproj; then
        echo -e "${GREEN}✅ Unit test target found in project${NC}"
    else
        echo -e "${RED}❌ Unit test target missing${NC}"
    fi
    
    if grep -q "UniversalAICompanionUITests" UniversalAICompanion.xcodeproj/project.pbxproj; then
        echo -e "${GREEN}✅ UI test target found in project${NC}"
    else
        echo -e "${RED}❌ UI test target missing${NC}"
    fi
    
else
    echo -e "${RED}❌ Project file not found${NC}"
fi

# Test the project
echo -e "\n${YELLOW}🧪 Testing Project Configuration${NC}"
echo "================================"

# Try to list targets
echo -e "${BLUE}Available targets:${NC}"
xcodebuild -list -project UniversalAICompanion.xcodeproj

# Try a quick build test
echo -e "\n${BLUE}Testing build configuration:${NC}"
BUILD_TEST=$(xcodebuild -project UniversalAICompanion.xcodeproj -scheme UniversalAICompanion -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=latest' -dry-run build 2>&1)

if echo "$BUILD_TEST" | grep -q "Build succeeded"; then
    echo -e "${GREEN}✅ Build configuration looks good${NC}"
elif echo "$BUILD_TEST" | grep -q "scheme.*not currently configured"; then
    echo -e "${RED}❌ Scheme configuration issue detected${NC}"
    echo "Build test output:"
    echo "$BUILD_TEST" | head -20
else
    echo -e "${YELLOW}⚠️ Build test completed with warnings${NC}"
    echo "Build test output:"
    echo "$BUILD_TEST" | head -10
fi

echo -e "\n${BLUE}📋 Next Steps${NC}"
echo "=============="
echo "1. Open UniversalAICompanion.xcodeproj in Xcode"
echo "2. Verify all source files are included in targets"
echo "3. Check test target dependencies"
echo "4. Run tests from Xcode or command line"
echo "5. If issues persist, restore backup: $BACKUP_NAME"

echo -e "\n${GREEN}🎉 Project fix attempt completed!${NC}"
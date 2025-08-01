#!/bin/bash

echo "🔧 Fixing Xcode Build Errors"
echo "==========================="
echo ""

cd "/Users/christianmerrill/Desktop/universal-ai-tools/iOS Working App"

# 1. Clean all build artifacts
echo "1. Cleaning build artifacts..."
rm -rf ~/Library/Developer/Xcode/DerivedData/UniversalAICompanion-*
rm -rf build/
rm -rf .build/

# 2. Reset the project
echo "2. Resetting project state..."
xcodebuild -project UniversalAICompanion.xcodeproj -scheme UniversalAICompanion -destination 'platform=iOS Simulator,name=iPhone 16' clean

# 3. Fix module imports by creating a proper module map
echo "3. Creating module map..."
mkdir -p UniversalAICompanion/Modules

cat > UniversalAICompanion/Modules/module.modulemap << 'EOF'
framework module UniversalAICompanion {
    umbrella header "UniversalAICompanion.h"
    
    export *
    module * { export * }
}
EOF

# 4. Create umbrella header
cat > UniversalAICompanion/UniversalAICompanion.h << 'EOF'
//
//  UniversalAICompanion.h
//  UniversalAICompanion
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

//! Project version number for UniversalAICompanion.
FOUNDATION_EXPORT double UniversalAICompanionVersionNumber;

//! Project version string for UniversalAICompanion.
FOUNDATION_EXPORT const unsigned char UniversalAICompanionVersionString[];
EOF

# 5. Fix Swift version
echo "4. Setting Swift version..."
cat > .swift-version << 'EOF'
5.9
EOF

# 6. Create xcconfig to ensure proper settings
echo "5. Creating build configuration..."
cat > UniversalAICompanion/Config.xcconfig << 'EOF'
// Swift Settings
SWIFT_VERSION = 5.0
ENABLE_MODULES = YES
DEFINES_MODULE = YES
ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES

// Framework Search Paths
FRAMEWORK_SEARCH_PATHS = $(inherited) $(PLATFORM_DIR)/Developer/Library/Frameworks

// Deployment Target
IPHONEOS_DEPLOYMENT_TARGET = 15.0

// Signing
CODE_SIGN_STYLE = Automatic
DEVELOPMENT_TEAM = ZUJ8AVW4ZS
EOF

echo ""
echo "✅ Fix script complete!"
echo ""
echo "Now in Xcode:"
echo "1. Close Xcode completely"
echo "2. Open Xcode again"
echo "3. Select 'UniversalAICompanion.xcodeproj'"
echo "4. Wait for indexing to complete"
echo "5. Product → Clean Build Folder (⇧⌘K)"
echo "6. Product → Build (⌘B)"
echo ""
echo "If errors persist:"
echo "- Go to Build Settings → Swift Compiler - Language"
echo "- Set 'Swift Language Version' to 'Swift 5'"
echo "- Ensure 'Build Active Architecture Only' is YES for Debug"
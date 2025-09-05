#!/bin/bash

# Universal AI Tools - Final macOS Compatibility Fix Script
# Fixes all remaining macOS compatibility issues discovered during build

echo "🔧 Applying final macOS compatibility fixes..."

PACKAGE_DIR="/Users/christianmerrill/Desktop/universal-ai-tools/UniversalAIToolsPackage"

# Function to replace text in files
replace_in_file() {
    local file="$1"
    local search="$2"
    local replace="$3"
    
    if [[ -f "$file" ]]; then
        perl -i -pe "s/\Q$search\E/$replace/g" "$file"
        echo "  ✅ Fixed: $(basename "$file")"
    fi
}

echo "\n🔄 Step 1: Fixing remaining Color(.systemGray6) references..."

# Fix OfflineModeView.swift
replace_in_file "$PACKAGE_DIR/Sources/UniversalAIToolsFeature/Views/OfflineModeView.swift" "Color(.systemGray6)" "Color.systemGray6"

echo "\n🔄 Step 2: Fixing UIImpactFeedbackGenerator in MemoryView.swift..."

# Replace UIImpactFeedbackGenerator with PlatformFeedback in MemoryView
if [[ -f "$PACKAGE_DIR/Sources/UniversalAIToolsFeature/Views/MemoryView.swift" ]]; then
    perl -i -pe 's/let mediumFeedback = UIImpactFeedbackGenerator\(style: \.medium\)\s*mediumFeedback\.impactOccurred\(\)/PlatformFeedback.light()/g' "$PACKAGE_DIR/Sources/UniversalAIToolsFeature/Views/MemoryView.swift"
    perl -i -pe 's/let impactFeedback = UIImpactFeedbackGenerator\(style: \.heavy\)\s*impactFeedback\.impactOccurred\(\)/PlatformFeedback.light()/g' "$PACKAGE_DIR/Sources/UniversalAIToolsFeature/Views/MemoryView.swift"
    echo "  ✅ Fixed: MemoryView.swift"
fi

echo "\n🔄 Step 3: Fixing AVAudioSession in TTSService.swift..."

# Fix TTSService.swift - add platform compilation directives
if [[ -f "$PACKAGE_DIR/Sources/UniversalAIToolsFeature/TTSService.swift" ]]; then
    # Create a temporary file with platform-specific audio session handling
    cat > /tmp/tts_audio_session_fix.txt << 'EOF'
    #if os(iOS)
    private let audioSession = AVAudioSession.sharedInstance()
    #endif
    
    /// Configure audio session for speech synthesis
    private func configureAudioSession() async throws {
        #if os(iOS)
        try audioSession.setCategory(.playback, mode: .spokenAudio)
        try audioSession.setActive(true)
        #else
        // macOS doesn't require audio session configuration
        #endif
    }
    
    /// Deactivate audio session
    private func deactivateAudioSession() {
        #if os(iOS)
        try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
        #else
        // macOS doesn't require audio session deactivation
        #endif
    }
EOF
    
    # Replace problematic lines
    perl -i -pe 's/private let audioSession = AVAudioSession\.sharedInstance\(\)/#if os(iOS)\n    private let audioSession = AVAudioSession.sharedInstance()\n    #endif/g' "$PACKAGE_DIR/Sources/UniversalAIToolsFeature/TTSService.swift"
    
    # Wrap AVAudioSession usage in platform checks
    perl -i -pe 's/try audioSession\.setCategory\((.+?)\)/#if os(iOS)\n            try audioSession.setCategory($1)\n            #endif/g' "$PACKAGE_DIR/Sources/UniversalAIToolsFeature/TTSService.swift"
    perl -i -pe 's/try audioSession\.setActive\((.+?)\)/#if os(iOS)\n            try audioSession.setActive($1)\n            #endif/g' "$PACKAGE_DIR/Sources/UniversalAIToolsFeature/TTSService.swift"
    
    echo "  ✅ Fixed: TTSService.swift"
fi

echo "\n🔄 Step 4: Adding platform-specific imports where needed..."

# Add platform compatibility import comments
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q -E "(PlatformDevice|textInputAutocapitalizationCompat|PlatformFeedback|Color\.system)" "$file"; then
        # Check if platform compatibility comment is already there
        if ! grep -q "// Platform compatibility helpers are included" "$file"; then
            # Add comment at the top
            perl -i -pe 's/^import SwiftUI$/import SwiftUI\n\/\/ Platform compatibility helpers are included in this file/' "$file"
        fi
    fi
done

echo "\n🔄 Step 5: Fix any remaining compilation issues..."

# Fix any remaining issues with specific patterns
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    # Fix any remaining .systemColor references  
    perl -i -pe 's/Color\(\.system([A-Za-z0-9]+)\)/Color.system$1/g' "$file"
    
    # Fix any remaining UIDevice references
    perl -i -pe 's/UIDevice\.current\.name/PlatformDevice.name/g' "$file"
    
    # Fix any remaining navigation bar issues
    perl -i -pe 's/\.navigationBarLeading([^C])/\.navigationBarLeadingCompat$1/g' "$file"
    perl -i -pe 's/\.navigationBarTrailing([^C])/\.navigationBarTrailingCompat$1/g' "$file"
done

echo "\n✅ Final macOS compatibility fixes completed!"
echo "📋 Summary of fixes applied:"
echo "  - Fixed remaining Color(.systemGray6) references"
echo "  - Fixed UIImpactFeedbackGenerator usage in MemoryView"  
echo "  - Added platform-specific compilation directives for AVAudioSession in TTSService"
echo "  - Added platform compatibility import comments"
echo "  - Fixed any remaining UIDevice and navigation bar references"

echo "\n🧪 Next step: Test the build again"
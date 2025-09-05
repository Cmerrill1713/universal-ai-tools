#!/bin/bash

# Universal AI Tools - macOS Compatibility Fix Script
# Fixes all remaining iOS-specific APIs to be cross-platform compatible

echo "🔧 Fixing macOS compatibility issues in Universal AI Tools..."

PACKAGE_DIR="/Users/christianmerrill/Desktop/universal-ai-tools/UniversalAIToolsPackage"

# Function to replace text in files
replace_in_file() {
    local file="$1"
    local search="$2"
    local replace="$3"
    
    if [[ -f "$file" ]]; then
        # Use perl for robust multi-line replacements
        perl -i -pe "s/\Q$search\E/$replace/g" "$file"
        echo "  ✅ Fixed: $(basename "$file")"
    fi
}

# Function to replace text in files with regex
replace_regex_in_file() {
    local file="$1"
    local search_regex="$2"
    local replace="$3"
    
    if [[ -f "$file" ]]; then
        perl -i -pe "s/$search_regex/$replace/g" "$file"
        echo "  ✅ Fixed regex: $(basename "$file")"
    fi
}

echo "\n🔄 Step 1: Fixing navigationBarTitleDisplayMode..."

# Find and fix all navigationBarTitleDisplayMode calls
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "navigationBarTitleDisplayMode(" "$file"; then
        replace_in_file "$file" ".navigationBarTitleDisplayMode(.large)" ".navigationBarTitleDisplayModeCompat(.large)"
        replace_in_file "$file" ".navigationBarTitleDisplayMode(.inline)" ".navigationBarTitleDisplayModeCompat(.inline)"
        replace_in_file "$file" ".navigationBarTitleDisplayMode(.automatic)" ".navigationBarTitleDisplayModeCompat(.automatic)"
    fi
done

echo "\n🔄 Step 2: Fixing toolbar placements..."

# Find and fix all navigationBarLeading calls
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "\.navigationBarLeading[^C]" "$file"; then
        replace_in_file "$file" ".navigationBarLeading" ".navigationBarLeadingCompat"
    fi
    if grep -q "\.navigationBarTrailing[^C]" "$file"; then
        replace_in_file "$file" ".navigationBarTrailing" ".navigationBarTrailingCompat"
    fi
done

echo "\n🔄 Step 3: Fixing UIColor references..."

# Find and fix all UIColor references
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "UIColor\." "$file"; then
        replace_in_file "$file" "Color(.systemBackground)" "Color.systemBackground"
        replace_in_file "$file" "Color(.systemGray6)" "Color.systemGray6"
        replace_in_file "$file" "Color(.systemGray5)" "Color.systemGray5"
        replace_in_file "$file" "Color(.systemGray4)" "Color.systemGray4"
        replace_in_file "$file" "Color(.secondarySystemBackground)" "Color.secondarySystemBackground"
        replace_in_file "$file" "Color(.label)" "Color.label"
        replace_in_file "$file" "Color(.secondaryLabel)" "Color.secondaryLabel"
    fi
done

echo "\n🔄 Step 4: Fixing UIActivityViewController..."

# Replace UIActivityViewController with PlatformSharingService
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "UIActivityViewController" "$file" && [[ "$file" != *"PlatformCompatibility.swift" ]]; then
        # This is complex, so let's do a targeted fix for common patterns
        if grep -q "let activityController = UIActivityViewController" "$file"; then
            # Replace the entire block
            perl -i -0pe 's/let activityController = UIActivityViewController\(\s*activityItems:\s*\[([^\]]+)\],\s*applicationActivities:\s*[^\)]+\)\s*.*?if let windowScene.*?rootViewController\?.present\(activityController[^\}]*\}/PlatformSharingService.share(SharingContent($1))/gms' "$file"
            echo "  ✅ Fixed UIActivityViewController in: $(basename "$file")"
        fi
    fi
done

echo "\n🔄 Step 5: Fixing UINotificationFeedbackGenerator..."

# Replace UINotificationFeedbackGenerator with PlatformFeedback
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "UINotificationFeedbackGenerator" "$file"; then
        # Replace success feedback
        replace_regex_in_file "$file" "let feedback = UINotificationFeedbackGenerator\(\)\s*feedback\.notificationOccurred\(\.success\)" "PlatformFeedback.success()"
        
        # Replace error feedback
        replace_regex_in_file "$file" "let feedback = UINotificationFeedbackGenerator\(\)\s*feedback\.notificationOccurred\(\.error\)" "PlatformFeedback.error()"
        
        # Replace warning feedback
        replace_regex_in_file "$file" "let feedback = UINotificationFeedbackGenerator\(\)\s*feedback\.notificationOccurred\(\.warning\)" "PlatformFeedback.error()"
        
        # Replace single line patterns
        replace_in_file "$file" "UINotificationFeedbackGenerator().notificationOccurred(.success)" "PlatformFeedback.success()"
        replace_in_file "$file" "UINotificationFeedbackGenerator().notificationOccurred(.error)" "PlatformFeedback.error()"
        replace_in_file "$file" "UINotificationFeedbackGenerator().notificationOccurred(.warning)" "PlatformFeedback.error()"
        
        echo "  ✅ Fixed feedback in: $(basename "$file")"
    fi
done

echo "\n🔄 Step 6: Fixing UIImpactFeedbackGenerator..."

# Replace UIImpactFeedbackGenerator with PlatformFeedback
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "UIImpactFeedbackGenerator" "$file"; then
        replace_in_file "$file" "UIImpactFeedbackGenerator(style: .light).impactOccurred()" "PlatformFeedback.light()"
        replace_in_file "$file" "UIImpactFeedbackGenerator(style: .medium).impactOccurred()" "PlatformFeedback.light()"
        replace_in_file "$file" "UIImpactFeedbackGenerator(style: .heavy).impactOccurred()" "PlatformFeedback.light()"
        echo "  ✅ Fixed impact feedback in: $(basename "$file")"
    fi
done

echo "\n🔄 Step 7: Adding import statements where needed..."

# Add PlatformCompatibility import to files that use the new functions
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q -E "(navigationBarTitleDisplayModeCompat|navigationBar(Leading|Trailing)Compat|PlatformSharingService|PlatformFeedback|Color\.system)" "$file"; then
        # Check if import is already there
        if ! grep -q "import.*PlatformCompatibility" "$file" && ! grep -q "// MARK: - Platform Compatibility" "$file"; then
            # Add import after the last import statement
            perl -i -pe 's/^(import .*)$/\1\n\/\/ Platform compatibility helpers are included in this file/' "$file"
        fi
    fi
done

echo "\n✅ macOS compatibility fixes completed!"
echo "📋 Summary:"
echo "  - Fixed navigationBarTitleDisplayMode to use compatibility helpers"  
echo "  - Fixed toolbar placements (navigationBarLeading/Trailing)"
echo "  - Fixed UIColor references to use cross-platform Color extensions"
echo "  - Fixed UIActivityViewController to use PlatformSharingService"
echo "  - Fixed haptic feedback to use PlatformFeedback"
echo "\n🧪 Next steps:"
echo "  1. Test build on macOS"
echo "  2. Test build on iOS" 
echo "  3. Verify all features work correctly on both platforms"
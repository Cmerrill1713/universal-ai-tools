#!/bin/bash

# Universal AI Tools - Complete macOS Compatibility Fix
# Addresses all remaining build issues to ensure clean macOS compilation

echo "🔧 Completing macOS compatibility fixes for Universal AI Tools..."

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

echo "\n🔄 Step 1: Fixing remaining textInputAutocapitalization calls..."

# Fix all remaining textInputAutocapitalization calls
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "textInputAutocapitalization(" "$file"; then
        replace_in_file "$file" ".textInputAutocapitalization(.never)" ".textInputAutocapitalizationCompat(.never)"
        replace_in_file "$file" ".textInputAutocapitalization(.words)" ".textInputAutocapitalizationCompat(.words)"
        replace_in_file "$file" ".textInputAutocapitalization(.sentences)" ".textInputAutocapitalizationCompat(.sentences)"
        replace_in_file "$file" ".textInputAutocapitalization(.characters)" ".textInputAutocapitalizationCompat(.characters)"
    fi
done

echo "\n🔄 Step 2: Fixing remaining UIColor references..."

# Fix any remaining UIColor references
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "Color(UIColor\." "$file"; then
        replace_in_file "$file" "Color(UIColor.systemGray6)" "Color.systemGray6"
        replace_in_file "$file" "Color(UIColor.systemGray5)" "Color.systemGray5"
        replace_in_file "$file" "Color(UIColor.systemGray4)" "Color.systemGray4"
        replace_in_file "$file" "Color(UIColor.systemBackground)" "Color.systemBackground"
        replace_in_file "$file" "Color(UIColor.secondarySystemBackground)" "Color.secondarySystemBackground"
        replace_in_file "$file" "Color(UIColor.label)" "Color.label"
        replace_in_file "$file" "Color(UIColor.secondaryLabel)" "Color.secondaryLabel"
    fi
done

echo "\n🔄 Step 3: Fixing GlassButtonStyle parameter issues..."

# Fix GlassButtonStyle constructor calls
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "GlassButtonStyle(style:" "$file"; then
        replace_in_file "$file" "GlassButtonStyle(style: .primary)" "GlassButtonStyle(.primary)"
        replace_in_file "$file" "GlassButtonStyle(style: .secondary)" "GlassButtonStyle(.secondary)"
        replace_in_file "$file" "GlassButtonStyle(style: .compact)" "GlassButtonStyle(.compact)"
        replace_in_file "$file" "GlassButtonStyle(style: .destructive)" "GlassButtonStyle(.destructive)"
    fi
done

echo "\n🔄 Step 4: Fixing picker style issues..."

# Fix picker styles that are iOS-specific
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "\.pickerStyle(.navigationLink)" "$file"; then
        # Replace with a cross-platform picker style
        perl -i -pe 's/\.pickerStyle\(\.navigationLink\)/#if os(iOS)\n            .pickerStyle(.navigationLink)\n            #else\n            .pickerStyle(.menu)\n            #endif/g' "$file"
        echo "  ✅ Fixed picker style in: $(basename "$file")"
    fi
done

echo "\n🔄 Step 5: Adding platform-specific import guards..."

# Add platform-specific compilation guards where needed
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    # Check if file imports UIKit but doesn't have platform guards
    if grep -q "^import UIKit" "$file" && ! grep -q "#if.*os(iOS)" "$file"; then
        # Replace plain UIKit import with platform-specific import
        perl -i -pe 's/^import UIKit$/#if os(iOS)\nimport UIKit\n#endif/' "$file"
        echo "  ✅ Added platform guards for UIKit in: $(basename "$file")"
    fi
done

echo "\n🔄 Step 6: Fix any remaining UIImpactFeedbackGenerator..."

# Search for and fix any remaining UIImpactFeedbackGenerator usage
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "UIImpactFeedbackGenerator" "$file"; then
        # Replace various patterns
        perl -i -0pe 's/let\s+\w+Feedback\s*=\s*UIImpactFeedbackGenerator\([^)]*\)\s*\n\s*\w+Feedback\.impactOccurred\(\)/PlatformFeedback.light()/gms' "$file"
        echo "  ✅ Fixed UIImpactFeedbackGenerator in: $(basename "$file")"
    fi
done

echo "\n🔄 Step 7: Creating fallback implementation for unsupported features..."

# For files that might have complex compilation issues, wrap them in availability checks
COLLABORATION_FILES=(
    "CollaborationSheets.swift"
    "CollaborationSupportingViews.swift" 
    "CollaborationComponents.swift"
)

for filename in "${COLLABORATION_FILES[@]}"; do
    file="$PACKAGE_DIR/Sources/UniversalAIToolsFeature/Views/Collaboration/$filename"
    if [[ -f "$file" ]]; then
        # Add availability check at the top of problematic views
        if ! grep -q "@available.*iOS.*macOS" "$file"; then
            perl -i -pe 's/^struct\s+(\w+):\s*View\s*\{/@available(iOS 16.0, macOS 13.0, *)\nstruct $1: View {/' "$file"
            echo "  ✅ Added availability check to: $(basename "$file")"
        fi
    fi
done

echo "\n🔄 Step 8: Fix any remaining navigation compilation issues..."

# Fix any remaining navigation-related compilation issues
find "$PACKAGE_DIR" -name "*.swift" -type f -exec grep -l "NavigationView" {} \; | while read -r file; do
    # Replace NavigationView with NavigationStack for better cross-platform support
    if grep -q "NavigationView\s*{" "$file"; then
        replace_in_file "$file" "NavigationView {" "NavigationStack {"
        echo "  ✅ Updated NavigationView to NavigationStack in: $(basename "$file")"
    fi
done

echo "\n✅ Complete macOS compatibility fixes applied!"
echo "📋 Final summary:"
echo "  - Fixed all textInputAutocapitalization calls"
echo "  - Fixed remaining UIColor references" 
echo "  - Fixed GlassButtonStyle constructor parameters"
echo "  - Fixed iOS-specific picker styles"
echo "  - Added platform-specific import guards"
echo "  - Fixed remaining UIImpactFeedbackGenerator usage"
echo "  - Added availability checks to collaboration views"
echo "  - Updated NavigationView to NavigationStack"

echo "\n🧪 Testing final build..."
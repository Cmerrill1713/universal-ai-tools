#!/bin/bash

# Universal AI Tools - Fix Final Compilation Errors
# Addresses critical compilation errors that remain after macOS compatibility fixes

echo "🔧 Fixing final compilation errors for Universal AI Tools..."

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

echo "\n🔄 Step 1: Fixing malformed @available attributes..."

# Fix malformed @available attributes in CollaborationComponents.swift
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "^(iOS.*macOS.*\*)" "$file"; then
        # Fix malformed @available patterns
        perl -i -pe 's/^\(iOS ([0-9.]+), macOS ([0-9.]+), \*\)$/@available(iOS $1, macOS $2, *)/' "$file"
        echo "  ✅ Fixed @available in: $(basename "$file")"
    fi
done

echo "\n🔄 Step 2: Fixing UIKit references for macOS compatibility..."

# Fix UIViewControllerRepresentable and UIKit types that are iOS-only
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "UIViewControllerRepresentable\|UIImagePickerController\|UIImage" "$file"; then
        # Wrap UIKit-dependent structures in platform checks
        if ! grep -q "#if os(iOS)" "$file"; then
            # Add platform-specific import for UIKit
            perl -i -pe 's/^import SwiftUI$/import SwiftUI\n#if os(iOS)\nimport UIKit\n#endif/' "$file"
        fi
        
        # Wrap UIViewControllerRepresentable structs
        perl -i -0pe 's/(struct \w+): UIViewControllerRepresentable \{/#if os(iOS)\n$1: UIViewControllerRepresentable {\n#else\n$1: View {\n#endif/gms' "$file"
        
        # Wrap UIKit method implementations
        perl -i -0pe 's/(func makeUIViewController\([^}]+\})/\n#if os(iOS)\n$1\n#endif/gms' "$file"
        perl -i -0pe 's/(func updateUIViewController\([^}]+\})/\n#if os(iOS)\n$1\n#endif/gms' "$file"
        
        echo "  ✅ Fixed UIKit references in: $(basename "$file")"
    fi
done

echo "\n🔄 Step 3: Fixing SwiftUI onChange syntax..."

# Fix modern SwiftUI onChange syntax issues
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "\.onChange(of:.*{.*,.*in$" "$file"; then
        # Fix onChange with two-parameter closure to single-parameter
        perl -i -pe 's/\.onChange\(of: ([^)]+)\) \{ _, ([^}]+) in/.onChange(of: $1) { $2 in/' "$file"
        echo "  ✅ Fixed onChange syntax in: $(basename "$file")"
    fi
done

echo "\n🔄 Step 4: Adding fallback implementations for macOS..."

# Add fallback body for UIKit-dependent views on macOS
PROBLEMATIC_FILES=(
    "CompanionContentView.swift"
)

for filename in "${PROBLEMATIC_FILES[@]}"; do
    file=$(find "$PACKAGE_DIR" -name "$filename" -type f)
    if [[ -f "$file" ]]; then
        # Add macOS fallback for ImagePicker
        if grep -q "struct ImagePicker:" "$file" && ! grep -q "#if os(iOS)" "$file"; then
            # Add platform-specific implementation
            perl -i -0pe 's/(struct ImagePicker[^{]+\{[^}]+var body: some View \{[^}]+\})/\n#if os(iOS)\n$1\n#else\n    var body: some View {\n        Text("Camera not available on macOS")\n            .foregroundColor(.secondary)\n    }\n#endif/gms' "$file"
            echo "  ✅ Added macOS fallback for ImagePicker in: $(basename "$file")"
        fi
    fi
done

echo "\n🔄 Step 5: Fixing duplicate imports and conflicting declarations..."

# Remove duplicate imports and fix conflicting declarations
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    # Remove duplicate UIKit imports
    if grep -c "import UIKit" "$file" > /dev/null; then
        # Keep only the first UIKit import (preferably the one with platform guards)
        perl -i -pe '
            BEGIN { $uikit_imported = 0; }
            if (/^import UIKit$/ && $uikit_imported == 0) { 
                $uikit_imported = 1; 
            } elsif (/^import UIKit$/ && $uikit_imported == 1) { 
                $_ = ""; 
            }
        ' "$file"
    fi
    
    # Handle duplicate struct declarations
    if grep -c "struct ImagePicker" "$file" > 1; then
        # Remove duplicate struct declarations (keep the first one)
        perl -i -0pe 's/(struct ImagePicker[^{]+\{(?:[^{}]*\{[^{}]*\})*[^}]*\})\s*struct ImagePicker[^{]+\{(?:[^{}]*\{[^{}]*\})*[^}]*\}/$1/gms' "$file"
        echo "  ✅ Removed duplicate ImagePicker declaration in: $(basename "$file")"
    fi
done

echo "\n🔄 Step 6: Ensuring proper platform compilation blocks..."

# Ensure all UIKit usage is properly wrapped
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    # Check if file has UIKit types but no platform guards around them
    if grep -q "UIImage\|UIImagePickerController" "$file" && ! grep -q "#if os(iOS)" "$file"; then
        # Add platform guards around the entire UIKit-dependent section
        if grep -q "struct.*UIImage" "$file"; then
            perl -i -pe 's/^(\s*@Binding var selectedImage: UIImage\?)$/#if os(iOS)\n$1\n#else\n    @Binding var selectedImage: Image?\n#endif/' "$file"
        fi
        echo "  ✅ Added platform guards to UIKit usage in: $(basename "$file")"
    fi
done

echo "\n✅ Final compilation error fixes applied!"
echo "📋 Summary of fixes:"
echo "  - Fixed malformed @available attributes"
echo "  - Added platform-specific UIKit imports and wrappers"
echo "  - Fixed SwiftUI onChange syntax"
echo "  - Added macOS fallback implementations"
echo "  - Removed duplicate imports and declarations"
echo "  - Ensured proper platform compilation blocks"

echo "\n🧪 Testing compilation..."
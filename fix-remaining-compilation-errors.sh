#!/bin/bash

# Universal AI Tools - Fix Remaining Compilation Errors
# Final fixes for structural and import issues

echo "🔧 Fixing remaining compilation errors..."

PACKAGE_DIR="/Users/christianmerrill/Desktop/universal-ai-tools/UniversalAIToolsPackage"

echo "\n🔄 Step 1: Fix all remaining malformed @available attributes..."

# Fix all remaining @available attribute issues
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "^(iOS.*macOS.*\*)" "$file"; then
        perl -i -pe 's/^\(iOS ([0-9.]+), macOS ([0-9.]+), \*\)$/@available(iOS $1, macOS $2, *)/' "$file"
        echo "  ✅ Fixed @available in: $(basename "$file")"
    fi
done

echo "\n🔄 Step 2: Fix UIViewControllerRepresentable structural issues..."

# Fix AnalyticsDashboardView.swift UIViewControllerRepresentable structure
ANALYTICS_FILE="$PACKAGE_DIR/Sources/UniversalAIToolsFeature/Views/AnalyticsDashboardView.swift"
if [[ -f "$ANALYTICS_FILE" ]]; then
    # Replace broken UIViewControllerRepresentable structure
    perl -i -0pe 's/#if os\(iOS\)\nstruct ActivityViewController: UIViewControllerRepresentable \{\n#else\nstruct ActivityViewController: View \{\n#endif\s+let activityItems:/#if os(iOS)\nstruct ActivityViewController: UIViewControllerRepresentable {\n    let activityItems:/gms' "$ANALYTICS_FILE"
    
    # Add proper closing for iOS version and start macOS version
    perl -i -pe 's/func updateUIViewController\(_ uiViewController: UIActivityViewController, context: Context\) \{\}\n#endif/func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}\n}\n#else\nstruct ActivityViewController: View {\n    let activityItems: [Any]\n    \n    var body: some View {\n        Text("Sharing not available on macOS")\n    }\n}\n#endif/' "$ANALYTICS_FILE"
    
    echo "  ✅ Fixed ActivityViewController structure in: $(basename "$ANALYTICS_FILE")"
fi

# Fix VisionAnalysisView.swift UIViewControllerRepresentable structure
VISION_FILE="$PACKAGE_DIR/Sources/UniversalAIToolsFeature/Views/VisionAnalysisView.swift"
if [[ -f "$VISION_FILE" ]]; then
    # Similar fixes for VisionImagePicker
    perl -i -0pe 's/#if canImport\(UIKit\)\n#if os\(iOS\)\nstruct VisionImagePicker: UIViewControllerRepresentable \{\n#else\nstruct VisionImagePicker: View \{\n#endif\s+@Binding var selectedImage:/#if os(iOS)\nstruct VisionImagePicker: UIViewControllerRepresentable {\n    @Binding var selectedImage:/gms' "$VISION_FILE"
    
    echo "  ✅ Fixed VisionImagePicker structure in: $(basename "$VISION_FILE")"
fi

echo "\n🔄 Step 3: Add missing UIKit imports with platform guards..."

# Add UIKit imports where needed
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "UIApplication\|UIColor\|UIImage\|UIView" "$file" && ! grep -q "import UIKit" "$file" && ! grep -q "#if os(iOS)" "$file"; then
        # Add UIKit import with platform guard at the top
        perl -i -pe 's/^import SwiftUI$/import SwiftUI\n#if os(iOS)\nimport UIKit\n#endif/' "$file"
        echo "  ✅ Added UIKit import to: $(basename "$file")"
    fi
done

echo "\n🔄 Step 4: Fix UIApplication references..."

# Fix UIApplication references with platform guards
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "UIApplication\." "$file"; then
        # Wrap UIApplication usage in platform guards
        perl -i -pe 's/UIApplication\./#if os(iOS)\n        UIApplication./' "$file"
        perl -i -pe 's/(UIApplication\.[^,\n]+,)/        $1\n        #endif/' "$file"
        echo "  ✅ Fixed UIApplication references in: $(basename "$file")"
    fi
done

echo "\n🔄 Step 5: Fix UIColor references..."

# Fix remaining UIColor references
find "$PACKAGE_DIR" -name "*.swift" -type f | while read -r file; do
    if grep -q "Color(UIColor\." "$file"; then
        # Replace with cross-platform Color extensions
        perl -i -pe 's/Color\(UIColor\.systemFill\)/Color.systemFill/g' "$file"
        perl -i -pe 's/Color\(UIColor\.systemGray6\)/Color.systemGray6/g' "$file"
        perl -i -pe 's/Color\(UIColor\.systemBackground\)/Color.systemBackground/g' "$file"
        echo "  ✅ Fixed UIColor references in: $(basename "$file")"
    fi
done

echo "\n✅ Remaining compilation error fixes applied!"
echo "📋 Summary:"
echo "  - Fixed all malformed @available attributes"
echo "  - Fixed UIViewControllerRepresentable structural issues"
echo "  - Added missing UIKit imports with platform guards"
echo "  - Fixed UIApplication references"
echo "  - Fixed UIColor references"

echo "\n🧪 Testing compilation..."
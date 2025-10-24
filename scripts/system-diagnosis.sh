#!/bin/bash

echo "🔍 SYSTEM DIAGNOSIS - Let's Figure Out What's Really Wrong"
echo "=========================================================="
echo

echo "📋 DIAGNOSTIC CHECKLIST:"
echo "========================"
echo "1. macOS Version:"
sw_vers
echo

echo "2. Xcode Version:"
xcodebuild -version
echo

echo "3. Swift Version:"
swift --version
echo

echo "4. Check if ANY text input works in system:"
echo "   • Try typing in Terminal"
echo "   • Try typing in TextEdit"
echo "   • Try typing in any other app"
echo

echo "5. Check Accessibility permissions:"
echo "   • System Preferences > Security & Privacy > Privacy > Accessibility"
echo "   • Make sure Xcode and Terminal are allowed"
echo

echo "6. Check Input Sources:"
echo "   • System Preferences > Keyboard > Input Sources"
echo "   • Make sure you have a keyboard input source selected"
echo

echo "7. Test with a completely different approach:"
echo "   • Try creating a new Xcode project from scratch"
echo "   • Use a different SwiftUI template"
echo "   • Test on a different Mac if possible"
echo

echo "🎯 POSSIBLE ROOT CAUSES:"
echo "========================"
echo "• System-level keyboard/input issue"
echo "• Xcode configuration problem"
echo "• macOS permissions/security issue"
echo "• Hardware keyboard problem"
echo "• Input method/accessibility issue"
echo "• Corrupted Xcode installation"
echo

echo "💡 NEXT STEPS:"
echo "=============="
echo "1. Test basic system text input (Terminal, TextEdit)"
echo "2. Check if it's Xcode-specific or system-wide"
echo "3. Try a completely fresh Xcode project"
echo "4. Check system permissions and accessibility"
echo "5. Consider if this is a hardware issue"
echo

echo "😤 I know this is frustrating - let's get to the bottom of it!"

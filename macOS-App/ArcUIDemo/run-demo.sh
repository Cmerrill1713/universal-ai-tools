#!/bin/bash

# Arc UI Demo Runner
echo "🚀 Running Arc UI Demo..."

# Change to the demo directory
cd "$(dirname "$0")"

# Check if we can compile and run directly
if command -v swift >/dev/null 2>&1; then
    echo "📱 Compiling and running with Swift..."
    swift -frontend -emit-executable -o ArcUIDemo ArcUIDemo.swift -target x86_64-apple-macosx14.0 -import-objc-header /dev/null 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Compilation successful!"
        echo "🎉 Launching Arc UI Demo..."
        ./ArcUIDemo
    else
        echo "⚠️  Direct compilation failed. Please use Xcode instead."
        echo "   Run: open ArcUIDemo.xcodeproj"
    fi
else
    echo "❌ Swift compiler not found. Please install Xcode Command Line Tools."
    echo "   Run: xcode-select --install"
fi
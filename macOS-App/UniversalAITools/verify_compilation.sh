#!/bin/bash

echo "=== Universal AI Tools - Compilation Verification ==="
echo "Checking key files for compilation issues..."
echo

# Check if the project builds by attempting a quick syntax validation
echo "1. Attempting to build the project..."
xcodebuild -scheme UniversalAITools -destination 'platform=macOS' clean build > /tmp/build_output.log 2>&1 &
BUILD_PID=$!

# Wait for 60 seconds
sleep 60

# Kill the build process if it's still running
if kill -0 $BUILD_PID 2>/dev/null; then
    echo "   Build process taking longer than expected, checking for errors..."
    kill $BUILD_PID 2>/dev/null
    wait $BUILD_PID 2>/dev/null
else
    echo "   Build completed within 60 seconds"
fi

# Check for specific compilation errors
echo "2. Checking for compilation errors..."
if [ -f /tmp/build_output.log ]; then
    ERROR_COUNT=$(grep -c "error:" /tmp/build_output.log)
    WARNING_COUNT=$(grep -c "warning:" /tmp/build_output.log)
    
    echo "   Errors found: $ERROR_COUNT"
    echo "   Warnings found: $WARNING_COUNT"
    
    if [ $ERROR_COUNT -gt 0 ]; then
        echo "   First 10 errors:"
        grep "error:" /tmp/build_output.log | head -10
    else
        echo "   ✅ No compilation errors detected!"
    fi
    
    if [ $WARNING_COUNT -gt 0 ] && [ $WARNING_COUNT -lt 10 ]; then
        echo "   Warnings (showing all):"
        grep "warning:" /tmp/build_output.log
    elif [ $WARNING_COUNT -ge 10 ]; then
        echo "   First 5 warnings:"
        grep "warning:" /tmp/build_output.log | head -5
    fi
else
    echo "   ❌ Could not find build output log"
fi

echo
echo "3. Key files status:"

# Check if key files exist and are accessible
files=(
    "Models/LoggingTypes.swift"
    "Models/TrendDirection.swift"  
    "Services/MonitoringService.swift"
    "Services/BackendMonitoringIntegration.swift"
    "Services/LoggingService.swift"
    "Services/ChangeTracker.swift"
    "Services/FailurePreventionService.swift"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file - exists"
    else
        echo "   ❌ $file - missing"
    fi
done

echo
echo "4. Type definition verification:"

# Check for key type definitions
if grep -q "enum HealthStatus" Models/LoggingTypes.swift; then
    echo "   ✅ HealthStatus defined in LoggingTypes.swift"
else
    echo "   ❌ HealthStatus missing from LoggingTypes.swift"
fi

if grep -q "enum SyncStatus" Models/LoggingTypes.swift; then
    echo "   ✅ SyncStatus defined in LoggingTypes.swift"
else
    echo "   ❌ SyncStatus missing from LoggingTypes.swift"
fi

if grep -q "struct EndpointHealth" Models/LoggingTypes.swift; then
    echo "   ✅ EndpointHealth defined in LoggingTypes.swift"
else
    echo "   ❌ EndpointHealth missing from LoggingTypes.swift"
fi

echo
echo "=== Verification Complete ==="

# Clean up
rm -f /tmp/build_output.log
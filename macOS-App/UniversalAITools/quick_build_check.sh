#!/bin/bash

# Quick build check script
echo "Starting quick build check..."

# Try to build just the specific files we've been working on
echo "Checking BackendMonitoringIntegration.swift..."
swiftc -typecheck Services/BackendMonitoringIntegration.swift \
    -I . \
    -sdk $(xcrun --show-sdk-path) \
    2>&1 | head -10

echo "Checking MonitoringService.swift..."
swiftc -typecheck Services/MonitoringService.swift \
    -I . \
    -sdk $(xcrun --show-sdk-path) \
    2>&1 | head -10

echo "Checking LoggingTypes.swift..."
swiftc -typecheck Models/LoggingTypes.swift \
    -I . \
    -sdk $(xcrun --show-sdk-path) \
    2>&1 | head -10

echo "Build check completed."
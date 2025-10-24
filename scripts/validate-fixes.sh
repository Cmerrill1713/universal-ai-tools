#!/bin/bash

# Validation Script for TypeScript Fixes
# Provides real-time progress tracking and validation

set -e

echo "=========================================="
echo "🔍 TypeScript Fix Validation System"
echo "=========================================="

# Function to count errors in specific files
count_file_errors() {
    local pattern=$1
    npm run build 2>&1 | grep "$pattern" | wc -l | tr -d ' '
}

# Function to get total error count
total_errors() {
    npm run build 2>&1 | grep -c "error TS" || echo "0"
}

# Function to analyze error types
analyze_error_types() {
    echo "📊 Error type analysis:"
    npm run build 2>&1 | grep "error TS" | sed 's/.*error TS\([0-9]*\).*/\1/' | sort | uniq -c | sort -nr | head -10
}

# Function to show most affected files
most_affected_files() {
    echo "📁 Most affected files:"
    npm run build 2>&1 | grep "error TS" | sed 's/\([^(]*\)(.*$/\1/' | sort | uniq -c | sort -nr | head -10
}

# Initial state
echo "🏁 Initial validation state:"
initial_errors=$(total_errors)
echo "Total errors: $initial_errors"
echo ""

# Show current state
analyze_error_types
echo ""
most_affected_files
echo ""

# Progress tracking function
track_progress() {
    local phase=$1
    local current_errors=$(total_errors)
    local improvement=$((initial_errors - current_errors))
    local percentage=$(( (improvement * 100) / initial_errors ))
    
    echo "📈 Progress after $phase:"
    echo "   Current errors: $current_errors"
    echo "   Errors fixed: $improvement"
    echo "   Progress: $percentage%"
    echo ""
}

# Test specific critical files
echo "🎯 Critical file error counts:"
critical_files=(
    "src/mcp/integrated-supabase-mcp-server.ts"
    "src/services/llm-router-service.ts"
    "src/agents/agent-registry.ts"
    "src/agents/base-agent.ts"
    "src/server.ts"
)

for file in "${critical_files[@]}"; do
    errors=$(count_file_errors "$file")
    echo "   $file: $errors errors"
done
echo ""

# Incremental build test
echo "🧪 Testing incremental compilation..."
if timeout 30 npm run build > /tmp/build_test.log 2>&1; then
    echo "✅ Full build completed successfully!"
else
    echo "⚠️  Build timed out or failed. Checking partial results..."
    tail -20 /tmp/build_test.log
fi

echo ""
echo "=========================================="
echo "🎉 Validation complete!"
echo "Current error count: $(total_errors)"
echo "=========================================="
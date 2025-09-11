#!/bin/bash

# Gitleaks scanning script for universal-ai-tools

echo "Running Gitleaks scan..."

# Create baseline file if it doesn't exist
if [ ! -f ".gitleaks-baseline.json" ]; then
    echo "Creating initial baseline..."
    gitleaks detect --config .gitleaks.toml --baseline-path .gitleaks-baseline.json --report-format json --exit-code 0
fi

# Run scan against baseline
echo "Scanning for new secrets..."
gitleaks detect --config .gitleaks.toml --baseline-path .gitleaks-baseline.json --exit-code 1

# Check exit code
if [ $? -eq 0 ]; then
    echo "✅ No new secrets detected!"
else
    echo "⚠️  New secrets detected! Please review the output above."
    echo "If these are false positives, update .gitleaks.toml or add to .gitleaks-baseline.json"
fi
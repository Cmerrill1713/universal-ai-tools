#!/bin/bash

echo "=== Diagnostic Script for Dev Server Issues ==="
echo

echo "1. Current directory:"
pwd
echo

echo "2. Package.json dev script:"
grep -A1 -B1 '"dev"' package.json
echo

echo "3. Checking for tsx:"
which tsx || echo "tsx not found in PATH"
echo

echo "4. Node and npm versions:"
node --version
npm --version
echo

echo "5. Running dev script with full output:"
echo "Command: npm run dev"
npm run dev 2>&1 | head -n 10
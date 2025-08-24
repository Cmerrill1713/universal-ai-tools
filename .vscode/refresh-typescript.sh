#!/bin/bash

echo "🔄 Refreshing TypeScript Language Server for Cursor/VS Code..."

# Kill any existing TypeScript servers
echo "Stopping existing TypeScript servers..."
pkill -f "tsserver" 2>/dev/null || true

# Clear TypeScript cache
echo "Clearing TypeScript cache..."
rm -rf node_modules/.cache/typescript 2>/dev/null || true
rm -rf .tsbuildinfo 2>/dev/null || true

# Reinstall TypeScript if needed
echo "Checking TypeScript installation..."
if ! npx tsc --version >/dev/null 2>&1; then
    echo "Installing TypeScript..."
    npm install typescript@latest --save-dev
fi

# Run type check to warm up
echo "Running type check to warm up TypeScript..."
npx tsc --noEmit --skipLibCheck >/dev/null 2>&1 || true

echo "✅ TypeScript refresh complete!"
echo ""
echo "In Cursor/VS Code, now run:"
echo "  1. Cmd+Shift+P → 'TypeScript: Restart TS Server'"
echo "  2. Cmd+Shift+P → 'Developer: Reload Window'"
echo ""
echo "If you still see errors in knowledge-monitoring.ts:"
echo "  1. Close and reopen the file"
echo "  2. Check that Cursor is using workspace TypeScript version"
echo "  3. Verify Cursor is using the correct tsconfig.json"
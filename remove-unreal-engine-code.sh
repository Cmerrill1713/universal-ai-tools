#!/bin/bash

echo "🧹 Removing all Unreal Engine related code from Universal AI Tools..."
echo ""

# Core service files
echo "Removing UE5/Sweet Athena service files..."
rm -f src/services/pixel-streaming-bridge.ts
rm -f src/services/sweet-athena-state-manager.ts
rm -f src/services/sweet-athena-integration.ts
rm -f src/services/sweet-athena-websocket.ts
rm -f src/services/sweet-athena-personality.ts

# Router files
echo "Removing router files..."
rm -f src/routers/sweet-athena.ts

# Test files
echo "Removing test files..."
rm -f tests/services/pixel-streaming-bridge.test.ts
rm -f tests/services/sweet-athena-state-manager.test.ts
rm -f tests/routers/sweet-athena.test.ts
rm -f tests/sweet-athena-engineering-tests.ts
rm -f ui/src/__tests__/components/SweetAthena.test.tsx
rm -f ui/tests/e2e/03-sweet-athena.spec.ts

# Database migrations
echo "Removing database migrations..."
rm -f supabase/migrations/100_sweet_athena_tables.sql

# Scripts and directories
echo "Removing UE5 related scripts and directories..."
rm -rf scripts/ue5/
rm -rf scripts/pixel-streaming/
rm -rf scripts/sweet-athena/
rm -f setup-sweet-athena-metahuman.py
rm -f install-ue5-sweet-athena.sh

# Documentation
echo "Removing UE5 related documentation..."
rm -f UE5_SWEET_ATHENA_SETUP.md
rm -f SWEET_ATHENA_SETUP_COMPLETE.md
rm -f SWEET_ATHENA_UE5_INTEGRATION.md
rm -f PIXEL_STREAMING_SOLUTION.md
rm -f PIXEL_STREAMING_EXACT_LOCATION.md
rm -f UE5_PIXEL_STREAMING_CHECKLIST.md
rm -f START-PIXEL-STREAMING-NOW.md
rm -rf docs/ue5/
rm -rf docs/sweet-athena/

# Docker files
echo "Removing Docker configuration files..."
rm -f docker-compose.sweet-athena.yml
rm -f Dockerfile.sweet-athena

# HTML files
echo "Removing HTML test/demo files..."
rm -rf docs/html/

# Other files
echo "Removing other UE5 related files..."
rm -f examples/sweet-athena-voice-integration.ts
rm -f check-ue5-streaming.txt
rm -f fix-signaling-url.sh
rm -f sweet-athena-quickstart.md

# Backup directories (optional - uncomment if you want to remove backups too)
# echo "Removing backup directories..."
# rm -rf src.backup.20250723_082258/
# rm -rf src.backup.20250723_092358/
# rm -rf src.backup.20250723_094509/

echo ""
echo "✅ Removed all UE5/Sweet Athena related files"
echo ""
echo "Next steps:"
echo "1. Fix import references in other files"
echo "2. Update server.ts to remove any UE5 route registrations"
echo "3. Update package.json to remove any UE5 related scripts"
echo "4. Test that the server starts without errors"
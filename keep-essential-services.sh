#!/bin/bash

# Create a temp directory for essential services
mkdir -p src/services-essential

# Keep only essential bridge/integration services
ESSENTIAL_SERVICES=(
  "browser-scraping-bridge.ts"
  "supabase-client.ts"
  "error-handling-service.ts"
  "file-management-service.ts"
  "go-integration-service.ts"
  "rust-integration-service.ts"
  "server-minimal.ts"
  "router.ts"
  "index.ts"
)

# Copy essential services
for service in "${ESSENTIAL_SERVICES[@]}"; do
  if [ -f "src/services/$service" ]; then
    cp "src/services/$service" "src/services-essential/"
    echo "Kept: $service"
  fi
done

# Remove all services
rm -rf src/services/*.ts

# Move essential services back
mv src/services-essential/* src/services/ 2>/dev/null
rmdir src/services-essential

echo ""
echo "Final count of TypeScript services:"
ls src/services/*.ts 2>/dev/null | wc -l
echo ""
echo "Services kept:"
ls src/services/*.ts 2>/dev/null

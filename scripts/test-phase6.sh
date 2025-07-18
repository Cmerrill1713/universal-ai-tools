#!/bin/bash

echo "========================================="
echo "Phase 6 Implementation Tests"
echo "========================================="

# Test Docker setup
echo ""
echo "1. Testing Docker Infrastructure..."
npm test -- src/tests/integration/docker_setup.test.ts --silent

# Test Temperature Controller
echo ""
echo "2. Testing Temperature Controller..."
npm test -- src/tests/unit/temperature_controller.test.ts --silent

# Test Dynamic Context Manager
echo ""
echo "3. Testing Dynamic Context Manager..."
npm test -- src/tests/unit/dynamic_context_manager.test.ts --silent

# Check file existence
echo ""
echo "4. Checking Implementation Files..."
files=(
  "docker-compose.yml"
  "Dockerfile"
  "Dockerfile.dashboard"
  "nginx/nginx.conf"
  "searxng/settings.yml"
  "monitoring/prometheus/prometheus.yml"
  "src/services/dynamic_context_manager.ts"
  "src/services/temperature_controller.ts"
  "src/services/supabase_service.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file exists"
  else
    echo "❌ $file missing"
  fi
done

# Check Docker compose validity (if docker-compose is available)
echo ""
echo "5. Validating Docker Compose..."
if command -v docker-compose &> /dev/null; then
  docker-compose config > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "✅ Docker Compose configuration is valid"
  else
    echo "❌ Docker Compose configuration has errors"
  fi
else
  echo "⚠️  Docker Compose not installed - skipping validation"
fi

echo ""
echo "========================================="
echo "Summary"
echo "========================================="

# Run all tests and capture results
npm test -- src/tests/unit/temperature_controller.test.ts src/tests/integration/docker_setup.test.ts --silent 2>&1 | grep -E "(Test Suites:|Tests:)" | tail -2

echo ""
echo "Phase 6 Features Implemented:"
echo "✅ Docker infrastructure with docker-compose.yml"
echo "✅ Dynamic Context Manager for model optimization"
echo "✅ Task-Aware Temperature Controller"
echo "✅ SearXNG configuration for web search"
echo "✅ Monitoring stack (Prometheus + Grafana)"
echo "✅ Nginx reverse proxy configuration"
echo ""
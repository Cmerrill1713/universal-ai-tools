#!/bin/bash

# Cleanup Manual Workflows Script
# This script removes redundant manual scripts that are now automated via GitHub Actions and GitLab CI

echo "🧹 Starting cleanup of manual workflows..."

# Create backup directory
BACKUP_DIR="scripts/manual-workflows-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backup in $BACKUP_DIR"

# Function to backup and remove file
backup_and_remove() {
    local file="$1"
    if [ -f "$file" ]; then
        echo "📋 Backing up and removing: $file"
        cp "$file" "$BACKUP_DIR/"
        rm "$file"
    fi
}

# Function to backup and remove directory
backup_and_remove_dir() {
    local dir="$1"
    if [ -d "$dir" ]; then
        echo "📁 Backing up and removing directory: $dir"
        cp -r "$dir" "$BACKUP_DIR/"
        rm -rf "$dir"
    fi
}

# Remove redundant testing scripts (now handled by CI/CD)
echo "🧪 Cleaning up redundant testing scripts..."
backup_and_remove "scripts/test-missing-components-integration.ts"
backup_and_remove "scripts/test-real-ai-integration.ts"
backup_and_remove "scripts/validate-athena-system.ts"
backup_and_remove "scripts/run-comprehensive-tests.js"
backup_and_remove "scripts/testing/test-sweet-athena-integration.cjs"
backup_and_remove "scripts/testing/test-sweet-athena-integration.js"
backup_and_remove "scripts/testing/test-real-world-integration.js"
backup_and_remove "scripts/testing/test-production-readiness.mjs"
backup_and_remove "scripts/testing/test-dspy-orchestration.py"
backup_and_remove "scripts/testing/test-full-system-startup.js"
backup_and_remove "scripts/testing/test-final-verification.mjs"
backup_and_remove "scripts/testing/test-comprehensive-e2e.js"
backup_and_remove "scripts/testing/test-final-verification.js"
backup_and_remove "scripts/run-phase1-tests.js"
backup_and_remove "scripts/run-sweet-athena-tests.ts"
backup_and_remove "scripts/run-validation-suite.ts"
backup_and_remove "scripts/run-migration-tests.ts"
backup_and_remove "scripts/run-project-manager-integration-test.sh"

# Remove redundant deployment scripts (now handled by CI/CD)
echo "🚀 Cleaning up redundant deployment scripts..."
backup_and_remove "scripts/deploy-sweet-athena.sh"
backup_and_remove "scripts/deploy-production.sh"
backup_and_remove "scripts/deploy-rust-production.sh"
backup_and_remove "scripts/deploy-improvements.sh"
backup_and_remove "scripts/deploy_supabase_ai.sh"
backup_and_remove "scripts/post-deployment-checks.sh"

# Remove redundant build scripts (now handled by CI/CD)
echo "🔨 Cleaning up redundant build scripts..."
backup_and_remove "scripts/create_production_build.sh"
backup_and_remove "scripts/build-performance-test.ts"
backup_and_remove "scripts/enterprise-dev-workflow.mjs"
backup_and_remove "scripts/dev-workflow-optimizer.ts"

# Remove redundant monitoring scripts (now handled by CI/CD)
echo "📊 Cleaning up redundant monitoring scripts..."
backup_and_remove "scripts/setup-monitoring.sh"
backup_and_remove "scripts/start-production-monitoring.sh"
backup_and_remove "scripts/continuous-monitoring.ts"
backup_and_remove "scripts/validate-telemetry.js"
backup_and_remove "scripts/validate-monitoring.sh"

# Remove redundant validation scripts (now handled by CI/CD)
echo "✅ Cleaning up redundant validation scripts..."
backup_and_remove "scripts/validate-production-readiness.sh"
backup_and_remove "scripts/validate-production-config.sh"
backup_and_remove "scripts/validate-rust-services.ts"
backup_and_remove "scripts/validate-codebase-integrity.js"
backup_and_remove "scripts/validate-codebase-integrity.ts"
backup_and_remove "scripts/comprehensive-validation-suite.ts"
backup_and_remove "scripts/production-readiness-validator.ts"

# Remove redundant syntax fixing scripts (now handled by CI/CD)
echo "🔧 Cleaning up redundant syntax fixing scripts..."
backup_and_remove "scripts/auto-fix-code.ts"
backup_and_remove "scripts/auto-fix-syntax.ts"
backup_and_remove "scripts/auto-syntax-fixer.ts"
backup_and_remove "scripts/aggressive-syntax-fix.sh"
backup_and_remove "scripts/comprehensive-syntax-fix.sh"
backup_and_remove "scripts/comprehensive-syntax-fixer.ts"
backup_and_remove "scripts/fix-all-syntax-errors.sh"
backup_and_remove "scripts/fix-all-syntax-comprehensive.sh"
backup_and_remove "scripts/fix-critical-syntax-errors.sh"
backup_and_remove "scripts/fix-final-syntax-errors.sh"
backup_and_remove "scripts/fix-parsing-errors.sh"
backup_and_remove "scripts/fix-common-parsing-errors.sh"
backup_and_remove "scripts/fix-all-parsing-errors.sh"
backup_and_remove "scripts/fix-all-remaining-errors.sh"
backup_and_remove "scripts/final-comprehensive-fix.sh"
backup_and_remove "scripts/comprehensive-corruption-fix.sh"

# Remove redundant file organization scripts (now handled by CI/CD)
echo "📁 Cleaning up redundant file organization scripts..."
backup_and_remove "scripts/auto-organize-files.ts"
backup_and_remove "scripts/cleanup-unused.ts"
backup_and_remove "scripts/cleanup-test-files.sh"
backup_and_remove "scripts/cleanup-mcp-orphans.ts"

# Remove redundant MCP scripts (now handled by CI/CD)
echo "🔌 Cleaning up redundant MCP scripts..."
backup_and_remove "scripts/deploy-mcp-clean.ts"
backup_and_remove "scripts/deploy-mcp-direct.ts"
backup_and_remove "scripts/deploy-mcp-migration.ts"
backup_and_remove "scripts/deploy-mcp-postgres.ts"
backup_and_remove "scripts/check-mcp-status.ts"
backup_and_remove "scripts/verify-mcp-integration.ts"
backup_and_remove "scripts/validate-mcp-complete.sh"
backup_and_remove "scripts/validate-mcp-setup.sh"

# Remove redundant demo scripts (keep only essential ones)
echo "🎭 Cleaning up redundant demo scripts..."
backup_and_remove "scripts/demo_agents.js"
backup_and_remove "scripts/demo_personal_ai.js"
backup_and_remove "scripts/demo-autofix.cjs"
backup_and_remove "scripts/demo-autofix.js"
backup_and_remove "scripts/demo-complete-system.js"
backup_and_remove "scripts/demo-test-report.js"
backup_and_remove "scripts/demo.js"

# Remove redundant backup scripts (keep only essential ones)
echo "💾 Cleaning up redundant backup scripts..."
backup_and_remove "scripts/backup-data.sh"
backup_and_remove "scripts/backup-to-desktop.sh"
backup_and_remove "scripts/backup-weaviate.sh"

# Remove redundant Docker scripts (now handled by CI/CD)
echo "🐳 Cleaning up redundant Docker scripts..."
backup_and_remove "scripts/docker-manager.sh"

# Remove redundant setup scripts (keep only essential ones)
echo "⚙️ Cleaning up redundant setup scripts..."
backup_and_remove "scripts/auto-start-llm-services.sh"
backup_and_remove "scripts/enable-all-ai-features.sh"
backup_and_remove "scripts/setup-local_llms.sh"
backup_and_remove "scripts/setup-ollama-nginx.mjs"
backup_and_remove "scripts/setup-supabase-memory.mjs"
backup_and_remove "scripts/setup-context7-mcp.sh"
backup_and_remove "scripts/setup-metal.sh"

# Remove redundant archive directory
echo "📦 Cleaning up archive directory..."
backup_and_remove_dir "scripts/archive"

# Remove redundant debug directory (keep only essential debug tools)
echo "🐛 Cleaning up redundant debug scripts..."
backup_and_remove_dir "scripts/debug"

# Remove redundant checks directory (now handled by CI/CD)
echo "✅ Cleaning up redundant checks directory..."
backup_and_remove_dir "scripts/checks"

# Remove redundant dev-tools directory (now handled by CI/CD)
echo "🛠️ Cleaning up redundant dev-tools directory..."
backup_and_remove_dir "scripts/dev-tools"

# Remove redundant build-monitoring directory (now handled by CI/CD)
echo "📊 Cleaning up redundant build-monitoring directory..."
backup_and_remove_dir "scripts/build-monitoring"

# Remove redundant health-dashboard directory (now handled by CI/CD)
echo "🏥 Cleaning up redundant health-dashboard directory..."
backup_and_remove_dir "scripts/health-dashboard"

# Remove redundant db directory (now handled by migrations)
echo "🗄️ Cleaning up redundant db directory..."
backup_and_remove_dir "scripts/db"

# Create a summary of what was cleaned up
echo "📋 Creating cleanup summary..."
cat > "$BACKUP_DIR/CLEANUP_SUMMARY.md" << EOF
# Manual Workflows Cleanup Summary

## Date: $(date)

## What was cleaned up:
- Redundant testing scripts (now handled by GitHub Actions and GitLab CI)
- Redundant deployment scripts (now automated via CI/CD)
- Redundant build scripts (now automated via CI/CD)
- Redundant monitoring scripts (now automated via CI/CD)
- Redundant validation scripts (now automated via CI/CD)
- Redundant syntax fixing scripts (now automated via CI/CD)
- Redundant file organization scripts (now automated via CI/CD)
- Redundant MCP scripts (now automated via CI/CD)
- Redundant demo scripts (kept only essential ones)
- Redundant backup scripts (kept only essential ones)
- Redundant Docker scripts (now automated via CI/CD)
- Redundant setup scripts (kept only essential ones)
- Redundant archive, debug, checks, dev-tools, build-monitoring, health-dashboard, and db directories

## What was kept:
- Essential setup scripts
- Core functionality scripts
- Important demo scripts
- Critical backup scripts
- Essential debug tools

## New automated workflows:
- GitHub Actions: CI, CD, AI Services Testing
- GitLab CI/CD: Build, Test, Security, Deploy
- Automated testing, building, deployment, and monitoring

## Next steps:
1. Test the new CI/CD pipelines
2. Verify all functionality still works
3. Update documentation to reflect new workflows
4. Train team on new automated processes
EOF

echo "✅ Cleanup completed!"
echo "📦 Backup created in: $BACKUP_DIR"
echo "📋 Summary available in: $BACKUP_DIR/CLEANUP_SUMMARY.md"
echo ""
echo "🚀 New automated workflows are now available:"
echo "   - GitHub Actions: .github/workflows/"
echo "   - GitLab CI/CD: .gitlab-ci.yml"
echo ""
echo "🧪 To test the new workflows:"
echo "   - Push to main/develop branch to trigger GitHub Actions"
echo "   - Push to GitLab to trigger GitLab CI/CD"
echo "   - Check the Actions/CI tabs in your repositories"
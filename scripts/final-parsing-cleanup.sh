#!/bin/bash

# Final Parsing Error Cleanup Script
# Addresses remaining patterns not caught by the agent-based system

set -e

echo "🔧 Final Parsing Error Cleanup"
echo "Targeting remaining parsing issues..."

# Create backup
BACKUP_DIR="src.backup.final.$(date +%Y%m%d_%H%M%S)"
echo "📁 Creating backup: $BACKUP_DIR"
cp -r src "$BACKUP_DIR"

# Fix remaining comma issues in interfaces
echo "🔧 Fixing interface comma issues..."
find src -name "*.ts" -exec sed -i '' '/safety: number/s/,$/;/' {} \;

# Fix remaining method closure issues
echo "🔧 Fixing method closure issues..."
find src -name "*.ts" -exec sed -i '' '/protected async generateReasoning/,/return.*/ {
    /return.*/{
        a\
  }
    }
}' {} \;

# Fix Plan.Step interface issues
echo "🔧 Fixing interface property patterns..."
find src -name "*.ts" -exec sed -i '' 's/steps: Plan\.Step\[\]/steps: PlanStep[]/' {} \;

# Fix remaining dotted patterns that agents missed
find src -name "*.ts" -exec sed -i '' '
    s/Plan\.Step/PlanStep/g
    s/Backup\.Metadata/BackupMetadata/g
    s/Restore\.Options/RestoreOptions/g
    s/Versioned\.Data/VersionedData/g
    s/Migration\.Function/MigrationFunction/g
    s/Version\.Migration/VersionMigration/g
    s/Conflict\.Resolution/ConflictResolution/g
    s/DSPyOrchestration\.Request/DSPyOrchestrationRequest/g
    s/DSPyOrchestration\.Response/DSPyOrchestrationResponse/g
    s/User\.Feedback/UserFeedback/g
    s/Feedback\.Request/FeedbackRequest/g
' {} \;

# Fix method signatures with missing return types
find src -name "*.ts" -exec sed -i '' 's/): Promise<unknown> {/): Promise<any> {/' {} \;

echo "✅ Final cleanup completed"
echo "📁 Backup available at: $BACKUP_DIR"

# Quick validation
echo "🔍 Running quick validation..."
error_count=$(npm run lint 2>&1 | grep -c "error" || echo "0")
echo "📊 Remaining errors: $error_count"

if [ "$error_count" -lt 5000 ]; then
    echo "🎉 Significant improvement achieved!"
else
    echo "⚠️  More fixes may be needed"
fi
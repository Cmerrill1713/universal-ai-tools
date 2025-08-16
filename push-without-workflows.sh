#!/bin/bash

# Script to push changes without workflow files
# This avoids OAuth scope issues

set -e

echo "🔄 Preparing to push without workflow files..."

# Create a temporary branch
TEMP_BRANCH="temp-push-$(date +%s)"
CURRENT_BRANCH=$(git branch --show-current)

echo "📋 Current branch: $CURRENT_BRANCH"
echo "🔧 Creating temporary branch: $TEMP_BRANCH"

# Create temp branch from current
git checkout -b $TEMP_BRANCH

# Remove workflow files from the index for this push
echo "📦 Temporarily removing workflow files from commit..."
git rm --cached -r .github/workflows/ 2>/dev/null || true
git rm --cached -r agents/.github/workflows/ 2>/dev/null || true

# Commit the removal (temporary)
git commit -m "temp: remove workflows for push" || true

# Push the branch
echo "🚀 Pushing to remote..."
git push origin $TEMP_BRANCH

# Switch back to original branch
git checkout $CURRENT_BRANCH

# Delete temp branch locally
git branch -D $TEMP_BRANCH

echo "✅ Push complete!"
echo ""
echo "📝 Next steps:"
echo "1. Go to: https://github.com/Cmerrill1713/universal-ai-tools"
echo "2. You'll see the temp branch - create a PR from it"
echo "3. Or, authenticate with proper GitHub token that has workflow scope"
echo ""
echo "To get proper authentication:"
echo "gh auth login --scopes workflow"
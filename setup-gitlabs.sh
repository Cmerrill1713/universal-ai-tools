#!/bin/bash
# GitLabs Integration Script for Universal AI Tools

set -e

echo "🚀 Setting up GitLabs integration..."

# Add GitLabs remote
echo "📡 Adding GitLabs remote..."
git remote add gitlabs https://gitlab.com/your-username/universal-ai-tools.git || echo "GitLabs remote already exists"

# Configure GitLabs settings
echo "⚙️ Configuring GitLabs settings..."
git config --local gitlabs.ci_cd_enabled true
git config --local gitlabs.container_registry_enabled true
git config --local gitlabs.packages_enabled true
git config --local gitlabs.wiki_enabled true
git config --local gitlabs.issues_enabled true
git config --local gitlabs.merge_requests_enabled true

# Set up GitLabs CI/CD variables (manual step)
echo "🔐 GitLabs CI/CD Variables to set:"
echo "  - POSTGRES_DB: universal_ai_tools"
echo "  - REDIS_URL: redis://redis:6379"
echo "  - API_KEYS: (your API keys)"
echo "  - DEPLOY_TOKEN: (your deploy token)"

# Push to GitLabs
echo "📤 Pushing to GitLabs..."
git push gitlabs cursor/evaluate-gutlabs-integration-for-codebase-context-ada6

echo "✅ GitLabs integration setup complete!"
echo "🌐 GitLabs URL: https://gitlab.com/your-username/universal-ai-tools"
echo "🔧 CI/CD Pipeline: https://gitlab.com/your-username/universal-ai-tools/-/pipelines"
echo "📊 Issues: https://gitlab.com/your-username/universal-ai-tools/-/issues"
echo "📚 Wiki: https://gitlab.com/your-username/universal-ai-tools/-/wikis"

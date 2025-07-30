#!/bin/bash

# Install VS Code Extensions for Universal AI Tools
# This script installs all recommended extensions for the project

echo "🚀 Installing VS Code extensions for Universal AI Tools..."
echo ""

# Array of extensions to install
extensions=(
  # TypeScript & JavaScript Core
  "dbaeumer.vscode-eslint"
  "esbenp.prettier-vscode"
  "ms-vscode.vscode-typescript-next"
  "orta.vscode-jest"
  "firsttris.vscode-jest-runner"
  "andys8.jest-snippets"
  
  # Python (for DSPy orchestrator)
  "ms-python.python"
  "ms-python.vscode-pylance"
  "ms-python.black-formatter"
  "charliermarsh.ruff"
  
  # API Development
  "humao.rest-client"
  "rangav.vscode-thunder-client"
  "redhat.vscode-yaml"
  "42crunch.vscode-openapi"
  
  # Database
  "cweijan.vscode-postgresql-client2"
  "redis.redis-for-vscode"
  "supabase.supabase-vscode"
  
  # Docker & DevOps
  "ms-azuretools.vscode-docker"
  "ms-vscode-remote.remote-containers"
  
  # AI & Copilot
  "github.copilot"
  "github.copilot-chat"
  "continue.continue"
  
  # Git
  "eamodio.gitlens"
  "mhutchie.git-graph"
  "donjayamanne.githistory"
  
  # Productivity
  "gruntfuggly.todo-tree"
  "wayou.vscode-todo-highlight"
  "alefragnani.bookmarks"
  "streetsidesoftware.code-spell-checker"
  "aaron-bond.better-comments"
  
  # Debugging
  "msjsdiag.debugger-for-chrome"
  "firefox-devtools.vscode-firefox-debug"
  
  # Code Quality
  "sonarsource.sonarlint-vscode"
  "usernamehw.errorlens"
  "snyk-security.snyk-vulnerability-scanner"
  
  # Markdown
  "yzhang.markdown-all-in-one"
  "bierner.markdown-preview-github-styles"
  "davidanson.vscode-markdownlint"
  
  # Environment
  "mikestead.dotenv"
  "irongeek.vscode-env"
  
  # GraphQL
  "graphql.vscode-graphql"
  "graphql.vscode-graphql-syntax"
  
  # Testing
  "hbenl.vscode-test-explorer"
  "kavod-io.vscode-jest-test-adapter"
  
  # Formatting & Linting
  "editorconfig.editorconfig"
  "shardulm94.trailing-spaces"
  "oderwat.indent-rainbow"
  
  # Performance & Import Management
  "christian-kohler.path-intellisense"
  "wix.vscode-import-cost"
  "pmneo.tsimporter"
  "rbbit.typescript-hero"
  
  # Utilities
  "sleistner.vscode-fileutils"
  "chakrounanas.turbo-console-log"
  "quicktype.quicktype"
  "ibm.output-colorizer"
  
  # WebSockets
  "jingkaizhao.vscode-ws-client"
)

# Counter for installed extensions
installed=0
failed=0

# Install each extension
for extension in "${extensions[@]}"; do
  echo -n "Installing $extension... "
  if code --install-extension "$extension" --force >/dev/null 2>&1; then
    echo "✅"
    ((installed++))
  else
    echo "❌ Failed"
    ((failed++))
  fi
done

echo ""
echo "✨ Installation complete!"
echo "   Installed: $installed extensions"
if [ $failed -gt 0 ]; then
  echo "   Failed: $failed extensions"
fi

echo ""
echo "📝 Note: Some extensions may require VS Code restart to activate."
echo "🎯 Next steps:"
echo "   1. Restart VS Code"
echo "   2. Open the project folder"
echo "   3. Check for any extension configuration prompts"
echo ""
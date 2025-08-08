#!/bin/bash

# Cursor Extensions Validator and Installer for Universal AI Tools
# This script validates and installs extensions for Cursor IDE
# It also provides feedback on which extensions are critical vs optional

echo "🚀 Cursor Extensions Validator for Universal AI Tools"
echo "====================================================="
echo ""

# Detect if running in Cursor or VS Code
if command -v cursor &> /dev/null; then
    IDE_CMD="cursor"
    IDE_NAME="Cursor"
elif command -v code &> /dev/null; then
    IDE_CMD="code"
    IDE_NAME="VS Code"
else
    echo "❌ Neither Cursor nor VS Code CLI found in PATH"
    echo "   Please ensure Cursor or VS Code command line tools are installed"
    echo "   For Cursor: Open Cursor → View → Command Palette → Install 'cursor' command"
    echo "   For VS Code: Open VS Code → View → Command Palette → Install 'code' command"
    exit 1
fi

echo "✅ Detected IDE: $IDE_NAME"
echo ""

# Critical extensions for Universal AI Tools (parallel arrays)
critical_ext_ids=(
    "dbaeumer.vscode-eslint"
    "esbenp.prettier-vscode"
    "ms-vscode.vscode-typescript-next"
    "ms-python.python"
    "charliermarsh.ruff"
    "redis.redis-for-vscode"
    "mikestead.dotenv"
    "usernamehw.errorlens"
)

critical_ext_descs=(
    "ESLint - Critical for TypeScript validation"
    "Prettier - Code formatting"
    "TypeScript Language Features"
    "Python - Required for DSPy orchestrator"
    "Ruff - Python linting for DSPy"
    "Redis - Cache management"
    "DotENV - Environment configuration"
    "Error Lens - Inline error display"
)

# Recommended extensions for enhanced experience
recommended_ext_ids=(
    "orta.vscode-jest"
    "gruntfuggly.todo-tree"
    "eamodio.gitlens"
    "aaron-bond.better-comments"
    "streetsidesoftware.code-spell-checker"
    "christian-kohler.path-intellisense"
    "wix.vscode-import-cost"
)

recommended_ext_descs=(
    "Jest - Testing framework support"
    "TODO Tree - Task tracking"
    "GitLens - Git supercharged"
    "Better Comments - Enhanced commenting"
    "Spell Checker"
    "Path Intellisense"
    "Import Cost - Bundle size display"
)

# Optional extensions for specific workflows
optional_ext_ids=(
    "github.copilot"
    "github.copilot-chat"
    "continue.continue"
    "ms-azuretools.vscode-docker"
    "humao.rest-client"
    "rangav.vscode-thunder-client"
    "supabase.supabase-vscode"
)

optional_ext_descs=(
    "GitHub Copilot - AI assistance (requires subscription)"
    "Copilot Chat - AI chat (requires subscription)"
    "Continue - Open source AI assistant"
    "Docker - Container management"
    "REST Client - API testing"
    "Thunder Client - API testing GUI"
    "Supabase - Database management"
)

# Function to check if extension is installed
check_extension() {
    local ext_id=$1
    if $IDE_CMD --list-extensions 2>/dev/null | grep -qi "^$ext_id$"; then
        return 0
    else
        return 1
    fi
}

# Function to install extension
install_extension() {
    local ext_id=$1
    local ext_desc=$2
    local category=$3
    
    echo -n "  [$category] $ext_id - $ext_desc... "
    
    if check_extension "$ext_id"; then
        echo "✅ Already installed"
        return 0
    else
        if $IDE_CMD --install-extension "$ext_id" --force >/dev/null 2>&1; then
            echo "✅ Installed"
            return 0
        else
            echo "❌ Failed to install"
            return 1
        fi
    fi
}

# Validation Phase
echo "📋 Validating Extensions Status"
echo "-------------------------------"
echo ""

total_critical=${#critical_ext_ids[@]}
installed_critical=0
total_recommended=${#recommended_ext_ids[@]}
installed_recommended=0
total_optional=${#optional_ext_ids[@]}
installed_optional=0

# Check critical extensions
echo "🔴 Critical Extensions:"
for i in "${!critical_ext_ids[@]}"; do
    ext_id="${critical_ext_ids[$i]}"
    ext_desc="${critical_ext_descs[$i]}"
    if check_extension "$ext_id"; then
        echo "  ✅ $ext_id - $ext_desc"
        ((installed_critical++))
    else
        echo "  ❌ $ext_id - $ext_desc (MISSING)"
    fi
done
echo ""

# Check recommended extensions
echo "🟡 Recommended Extensions:"
for i in "${!recommended_ext_ids[@]}"; do
    ext_id="${recommended_ext_ids[$i]}"
    ext_desc="${recommended_ext_descs[$i]}"
    if check_extension "$ext_id"; then
        echo "  ✅ $ext_id - $ext_desc"
        ((installed_recommended++))
    else
        echo "  ⚠️  $ext_id - $ext_desc (Not installed)"
    fi
done
echo ""

# Check optional extensions
echo "🟢 Optional Extensions:"
for i in "${!optional_ext_ids[@]}"; do
    ext_id="${optional_ext_ids[$i]}"
    ext_desc="${optional_ext_descs[$i]}"
    if check_extension "$ext_id"; then
        echo "  ✅ $ext_id - $ext_desc"
        ((installed_optional++))
    else
        echo "  ℹ️  $ext_id - $ext_desc (Not installed)"
    fi
done
echo ""

# Summary
echo "📊 Summary"
echo "----------"
echo "Critical:    $installed_critical/$total_critical installed"
echo "Recommended: $installed_recommended/$total_recommended installed"
echo "Optional:    $installed_optional/$total_optional installed"
echo ""

# Installation prompt
if [ $installed_critical -lt $total_critical ]; then
    echo "⚠️  Missing critical extensions detected!"
    read -p "Would you like to install all missing CRITICAL extensions? (y/n): " install_critical
    if [[ $install_critical == "y" || $install_critical == "Y" ]]; then
        echo ""
        echo "Installing critical extensions..."
        for i in "${!critical_ext_ids[@]}"; do
            ext_id="${critical_ext_ids[$i]}"
            ext_desc="${critical_ext_descs[$i]}"
            if ! check_extension "$ext_id"; then
                install_extension "$ext_id" "$ext_desc" "CRITICAL"
            fi
        done
    fi
    echo ""
fi

if [ $installed_recommended -lt $total_recommended ]; then
    read -p "Would you like to install all missing RECOMMENDED extensions? (y/n): " install_recommended
    if [[ $install_recommended == "y" || $install_recommended == "Y" ]]; then
        echo ""
        echo "Installing recommended extensions..."
        for i in "${!recommended_ext_ids[@]}"; do
            ext_id="${recommended_ext_ids[$i]}"
            ext_desc="${recommended_ext_descs[$i]}"
            if ! check_extension "$ext_id"; then
                install_extension "$ext_id" "$ext_desc" "RECOMMENDED"
            fi
        done
    fi
    echo ""
fi

# Cursor-specific features check
if [[ "$IDE_NAME" == "Cursor" ]]; then
    echo "🎯 Cursor-Specific Features"
    echo "---------------------------"
    echo "✅ Native AI assistance built-in (no Copilot needed)"
    echo "✅ Context-aware completions enabled by default"
    echo "✅ Chat interface available (Cmd+K)"
    echo ""
    echo "💡 Cursor Tips:"
    echo "  • Use Cmd+K for AI chat"
    echo "  • Use Cmd+L to reference files in chat"
    echo "  • Tab to accept AI suggestions"
    echo "  • Cmd+Shift+K for inline edits"
    echo ""
fi

# Project-specific configuration
echo "📝 Project Configuration"
echo "------------------------"
echo "Checking project-specific settings..."

# Check if .vscode/settings.json exists
if [ -f ".vscode/settings.json" ]; then
    echo "✅ Project settings found (.vscode/settings.json)"
else
    echo "⚠️  Project settings not found"
fi

# Check if TypeScript is configured
if [ -f "tsconfig.json" ]; then
    echo "✅ TypeScript configuration found"
else
    echo "❌ TypeScript configuration missing!"
fi

# Check if ESLint is configured
if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ] || [ -f ".eslintrc.cjs" ]; then
    echo "✅ ESLint configuration found"
else
    echo "⚠️  ESLint configuration not found"
fi

# Check if Prettier is configured
if [ -f ".prettierrc" ] || [ -f ".prettierrc.json" ] || [ -f ".prettierrc.js" ]; then
    echo "✅ Prettier configuration found"
else
    echo "⚠️  Prettier configuration not found"
fi

echo ""
echo "✨ Validation Complete!"
echo ""
echo "Next steps:"
echo "1. Restart $IDE_NAME to activate new extensions"
echo "2. Check for any extension configuration prompts"
echo "3. Run 'npm run dev' to start the development server"
echo ""

# Create a report file
report_file="cursor-extensions-report.txt"
{
    echo "Cursor Extensions Report - $(date)"
    echo "=================================="
    echo ""
    echo "IDE: $IDE_NAME"
    echo ""
    echo "Critical Extensions: $installed_critical/$total_critical"
    echo "Recommended Extensions: $installed_recommended/$total_recommended"
    echo "Optional Extensions: $installed_optional/$total_optional"
    echo ""
    echo "Missing Critical Extensions:"
    for i in "${!critical_ext_ids[@]}"; do
        ext_id="${critical_ext_ids[$i]}"
        if ! check_extension "$ext_id"; then
            echo "  - $ext_id"
        fi
    done
} > "$report_file"

echo "📄 Report saved to: $report_file"
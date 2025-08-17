# Swift Development Configuration for Cursor IDE

## Overview

This document outlines the comprehensive Swift/iOS development setup configured for Universal AI Tools in Cursor IDE. The configuration includes language support, debugging, formatting, and build integration.

## ✅ Installed Extensions

### Core Swift Extensions
- **`sswg.swift-lang`** - Official Swift Language Support
- **`vknabel.vscode-apple-swift-format`** - Apple Swift Format integration
- **`swift-server.swift-syntax-language-server`** - Swift syntax language server
- **`vadimcn.vscode-lldb`** - LLDB debugger for Swift
- **`jebbs.markdown-extended`** - Enhanced markdown support

## ⚙️ Configuration Settings

### Swift Language Settings
```json
{
  "[swift]": {
    "editor.defaultFormatter": "vknabel.vscode-apple-swift-format",
    "editor.formatOnSave": true,
    "editor.tabSize": 2,
    "editor.insertSpaces": true,
    "editor.wordWrapColumn": 100,
    "editor.codeActionsOnSave": {
      "source.fixAll": "explicit",
      "source.organizeImports": "explicit"
    }
  }
}
```

### Swift Language Server
- **SourceKit-LSP**: Enabled with full project integration
- **Diagnostics**: Real-time error checking and warnings
- **Code completion**: Advanced Swift-aware completions
- **Symbol navigation**: Jump to definitions and references

### File Associations
- `*.swift` → Swift syntax highlighting
- `*.xcodeproj` → XML handling for project files
- `*.xcworkspace` → Workspace file support
- `*.plist` → Property list handling
- `*.pbxproj` → Project build file support

## 🐛 Debugging Configuration

### Debug Configurations
1. **Debug Universal AI Tools (macOS)** - Full app debugging
2. **Attach to Universal AI Tools** - Attach to running process
3. **Swift Package Debug** - Debug Swift Package Manager projects

### LLDB Integration
- Native LLDB debugger support
- Breakpoint management
- Variable inspection
- Stack trace navigation
- Memory debugging

## 🔨 Build Tasks

### Available Swift Tasks
- **`swift: Build Debug`** - Build debug configuration
- **`swift: Build Release`** - Build release configuration
- **`swift: Clean`** - Clean build artifacts
- **`swift: Run Tests`** - Execute Swift tests
- **`swift: Format Code`** - Format Swift code
- **`swift: Run App`** - Build and launch app

### Build Integration
- Xcodebuild integration for macOS app
- Problem matcher for build errors
- Automatic dependency resolution
- Derived data management

## 📁 Project Structure Recognition

### File Exclusions
- `**/DerivedData` - Xcode build artifacts
- `**/.build` - Swift Package Manager build
- `**/xcuserdata` - User-specific Xcode data

### Workspace Integration
- Multi-root workspace support
- Cross-platform development (TypeScript + Swift)
- Shared debugging sessions

## 🎨 Code Formatting

### Swift Format Configuration
Located in `.swift-format` file:
- Line length: 100 characters
- Indentation: 2 spaces
- Maximum blank lines: 1
- Automatic import organization
- Consistent code style enforcement

### Format Rules
- Always use lower camel case
- No semicolons
- Group numeric literals
- Use early exits where appropriate
- Synthesized initializers preferred

## 🔧 Development Workflow

### 1. Code Editing
- Real-time syntax highlighting
- Auto-completion with context
- Live error checking
- Symbol navigation
- Quick fixes and refactoring

### 2. Building
```bash
# Quick build
Cmd+Shift+P → "swift: Build Debug"

# Or use terminal
xcodebuild -project macOS-App/UniversalAITools/UniversalAITools.xcodeproj -scheme UniversalAITools build
```

### 3. Debugging
- Set breakpoints in Swift code
- Launch debug configuration
- Inspect variables and memory
- Step through code execution
- View console output

### 4. Testing
```bash
# Run Swift tests
Cmd+Shift+P → "swift: Run Tests"

# Or use Xcode test runner
xcodebuild test -project UniversalAITools.xcodeproj -scheme UniversalAITools
```

## 📱 macOS App Integration

### Project Structure
```
macOS-App/UniversalAITools/
├── UniversalAITools.xcodeproj/
├── Sources/
│   ├── Views/
│   ├── Controllers/
│   ├── Services/
│   └── Models/
├── Tests/
└── Resources/
```

### Build Configurations
- **Debug**: Development builds with debug symbols
- **Release**: Optimized production builds
- **Testing**: Test-specific configurations

## 🚀 Advanced Features

### Language Server Protocol (LSP)
- Fast symbol indexing
- Cross-file references
- Intelligent code completion
- Real-time diagnostics
- Refactoring support

### SwiftUI Support
- SwiftUI preview integration
- Live preview updates
- Component hierarchy navigation
- State management debugging

### Package Manager Integration
- Swift Package Manager support
- Dependency management
- Package resolution
- Version control integration

## 🛠️ Troubleshooting

### Common Issues

#### 1. Language Server Not Starting
```bash
# Check Swift installation
swift --version

# Verify SourceKit-LSP
xcrun sourcekit-lsp --help
```

#### 2. Build Errors
```bash
# Clean derived data
rm -rf ~/Library/Developer/Xcode/DerivedData

# Clean build folder
xcodebuild clean
```

#### 3. Debugger Issues
- Verify LLDB is installed: `lldb --version`
- Check code signing certificates
- Ensure debug symbols are enabled

### Performance Optimization
- Exclude large directories from search
- Configure appropriate file watchers
- Limit symbol indexing scope
- Use incremental builds

## 📋 Keyboard Shortcuts

### Swift-Specific Shortcuts
- **Cmd+Shift+B** - Build project
- **Cmd+R** - Run application
- **Cmd+U** - Run tests
- **Cmd+Shift+K** - Clean build folder
- **Cmd+Shift+O** - Quick open file/symbol

### Debugging Shortcuts
- **F9** - Toggle breakpoint
- **F5** - Start debugging
- **F10** - Step over
- **F11** - Step into
- **Shift+F5** - Stop debugging

## 🔄 Git Integration

### Swift-Specific Git Configuration
- Ignore DerivedData in `.gitignore`
- Track shared Xcode schemes
- Version control package dependencies
- Handle merge conflicts in project files

## 📚 Resources

### Documentation
- [Swift Language Guide](https://docs.swift.org/swift-book/)
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
- [Xcode Build Settings](https://xcodebuildsettings.com/)

### Tools
- [Swift Format](https://github.com/apple/swift-format)
- [SwiftLint](https://github.com/realm/SwiftLint)
- [SourceKit-LSP](https://github.com/apple/sourcekit-lsp)

## ✅ Verification Checklist

### Setup Verification
- [ ] Swift extensions installed and enabled
- [ ] Language server responding
- [ ] File associations working
- [ ] Syntax highlighting active
- [ ] Auto-completion functional
- [ ] Debugging configuration tested
- [ ] Build tasks executable
- [ ] Code formatting working
- [ ] Problem matcher detecting errors
- [ ] Cross-platform debugging setup

### Project Integration
- [ ] Xcode project recognized
- [ ] Build configurations available
- [ ] Test runner functional
- [ ] Package dependencies resolved
- [ ] Derived data excluded from search
- [ ] Git integration configured

---

**Last Updated**: Swift Cursor Configuration v1.0  
**Maintainer**: Universal AI Tools Development Team
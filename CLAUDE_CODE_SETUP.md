# 🚀 Claude Code Setup for Swift/SwiftUI Development

This repository is configured with a comprehensive Claude Code setup optimized for Swift/SwiftUI development on macOS.

## ✅ What's Been Set Up

### 1. **Project Context Files (CLAUDE.md)**
Strategic markdown files that provide Claude with deep understanding of your project:

- **`/macOS-App/UniversalAITools/CLAUDE.md`** - Main project configuration
  - Swift 6.0+ guidelines
  - SwiftUI best practices
  - Architecture patterns
  - Code style guide
  
- **`/macOS-App/UniversalAITools/Views/CLAUDE.md`** - View layer specifics
- **`/macOS-App/UniversalAITools/Services/CLAUDE.md`** - Service layer patterns

### 2. **Custom Slash Commands (/.claude/commands/)**
Type `/` in Claude Code to access these Swift-specific commands:

| Command | Purpose |
|---------|---------|
| `/swift-view` | Create new SwiftUI views with proper structure |
| `/swift-test` | Generate comprehensive XCTest unit tests |
| `/swift-refactor` | Refactor complex views for better performance |
| `/swift-preview` | Create SwiftUI preview providers |
| `/swift-accessibility` | Add VoiceOver and accessibility support |
| `/swift-performance` | Optimize view performance |
| `/swift-debug` | Debug SwiftUI layout issues |
| `/xcode-build` | Run Xcode build and test commands |

### 3. **Code Templates (/.claude/templates/)**
Ready-to-use Swift templates:
- `swiftui-view.swift` - Complete SwiftUI view with all sections
- `observable-model.swift` - Modern @Observable view model
- `service-actor.swift` - Thread-safe service using actors

### 4. **Development Workflows (/.claude/workflows/)**
- `feature-implementation.md` - Step-by-step feature development guide

### 5. **Swift Steering Rules (/.claude/steering/)**
- `swift-rules.md` - Compiler error handling, best practices, common pitfalls

### 6. **Agent Configurations (/.claude/agents/)**
- `swift-ui-agent.md` - Specialized SwiftUI development agent

## 🎯 How to Use This Setup

### Quick Start Commands

```bash
# When creating a new view
/swift-view MyNewView

# When you need tests
/swift-test Services/APIService.swift

# When compiler complains about type-checking
/swift-refactor Views/ComplexView.swift

# When adding accessibility
/swift-accessibility Views/MainView.swift
```

### Working with Claude Code

1. **Starting a New Feature**
   ```
   Claude: Implement a new dashboard view that shows real-time metrics
   ```
   Claude will automatically:
   - Read the CLAUDE.md files for context
   - Follow the feature-implementation workflow
   - Use appropriate templates
   - Apply Swift best practices

2. **Fixing Compiler Errors**
   ```
   Claude: The compiler says it can't type-check ContentView in time
   ```
   Claude knows to immediately refactor the view into smaller components.

3. **Adding Tests**
   ```
   Claude: /swift-test Services/WebSocketManager.swift
   ```
   Claude will generate comprehensive tests with mocks and async handling.

### Best Practices

#### 1. Let Claude Read First
Always ask Claude to read relevant files before making changes:
```
Claude: Read Views/ChatView.swift and then add message editing functionality
```

#### 2. Use Slash Commands
Instead of explaining what you want, use commands:
```
Claude: /swift-refactor Views/DashboardView.swift
```

#### 3. Provide Context with Screenshots
Drag and drop screenshots directly into Claude Code for UI fixes:
```
Claude: [paste screenshot] Fix this layout issue in the sidebar
```

#### 4. Leverage the Workflow
For complex features, reference the workflow:
```
Claude: Follow the feature-implementation workflow to add user authentication
```

## 📁 Project Structure Reference

```
UniversalAITools/
├── Views/              # SwiftUI views (70+ components)
│   ├── Components/     # Reusable UI components
│   └── CLAUDE.md      # View-specific guidelines
├── Models/            # Data models
├── Services/          # Business logic, API clients
│   └── CLAUDE.md     # Service patterns
├── Managers/          # App-wide state management
└── Tests/            # Unit and UI tests
```

## 🔥 Power User Tips

### 1. **Parallel Agent Execution**
Claude can work with multiple agents simultaneously:
```
Claude: Use the swift-ui-agent to create the view while the test agent writes tests
```

### 2. **Memory Management**
Add quick memories with `#`:
```
Claude: #The app uses port 9999 for the backend API
```

### 3. **Clear Context**
Use `/clear` when switching between unrelated tasks to avoid token waste.

### 4. **Version Control Commands**
Check your custom commands into git so your team can use them:
```bash
git add .claude/
git commit -m "Add Claude Code Swift development setup"
```

## 🎨 UI/UX Specific Features

### Advanced Visualizations
The app includes sophisticated UI components:
- 3D Knowledge Graphs (SceneKit)
- Real-time analytics dashboards
- Interactive flow diagrams
- Particle effects and animations

### Accessibility First
Every component includes:
- VoiceOver support
- Keyboard navigation
- Dynamic Type support
- WCAG 2.1 Level AA compliance

### Performance Optimized
- Lazy loading for large datasets
- Efficient state management
- Optimized for Apple Silicon
- Smooth 60fps animations

## 🚨 Common Issues Claude Can Fix

1. **"Compiler unable to type-check"** → Automatic view extraction
2. **Memory leaks** → Identifies retain cycles and fixes them
3. **Poor scrolling performance** → Optimizes lists and grids
4. **Missing accessibility** → Adds comprehensive VoiceOver support
5. **Complex animations** → Refactors for smooth performance

## 📚 Resources

- [Apple SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)

## 🤝 Contributing

When adding new features:
1. Update relevant CLAUDE.md files
2. Add custom commands if needed
3. Create templates for common patterns
4. Document in this file

---

**Remember**: Claude Code is most effective when it has context. The more specific your CLAUDE.md files and commands, the better Claude can help you build amazing Swift applications! 🎉
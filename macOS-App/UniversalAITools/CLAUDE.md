# Universal AI Tools - SwiftUI macOS Application

## Project Overview
This is a sophisticated SwiftUI-based macOS application that serves as the primary frontend for the Universal AI Tools platform. The app features 70+ advanced UI components, real-time data visualization, and comprehensive AI orchestration capabilities.

## 🛠️ MCP Xcode Build Tools Available

Claude Code has access to powerful MCP (Model Context Protocol) Xcode build tools for this project. These tools provide comprehensive Swift/Xcode development capabilities:

### Build & Run Tools
- **mcp__XcodeBuildMCP__build_mac_proj** - Build macOS app from project file
- **mcp__XcodeBuildMCP__build_run_mac_proj** - Build and run macOS app in one step
- **mcp__XcodeBuildMCP__build_sim_name_proj** - Build for specific simulator by name
- **mcp__XcodeBuildMCP__clean_proj** - Clean build artifacts

### Project Management
- **mcp__XcodeBuildMCP__discover_projs** - Find all Xcode projects in workspace
- **mcp__XcodeBuildMCP__list_schems_proj** - List available schemes
- **mcp__XcodeBuildMCP__show_build_set_proj** - Show build settings

### Testing Tools
- **mcp__XcodeBuildMCP__test_macos_proj** - Run macOS tests
- **mcp__XcodeBuildMCP__test_sim_name_proj** - Run tests on simulator

### Simulator Management
- **mcp__XcodeBuildMCP__list_sims** - List available simulators
- **mcp__XcodeBuildMCP__boot_sim** - Boot a simulator
- **mcp__XcodeBuildMCP__install_app_sim** - Install app on simulator
- **mcp__XcodeBuildMCP__launch_app_sim** - Launch app on simulator
- **mcp__XcodeBuildMCP__screenshot** - Take simulator screenshot

### UI Automation
- **mcp__XcodeBuildMCP__describe_ui** - Get UI element hierarchy with coordinates
- **mcp__XcodeBuildMCP__tap** - Tap at specific coordinates
- **mcp__XcodeBuildMCP__type_text** - Type text into fields
- **mcp__XcodeBuildMCP__swipe** - Perform swipe gestures

### Device Management
- **mcp__XcodeBuildMCP__list_devices** - List connected physical devices
- **mcp__XcodeBuildMCP__install_app_device** - Install on physical device
- **mcp__XcodeBuildMCP__launch_app_device** - Launch on physical device

### Swift Package Management
- **mcp__XcodeBuildMCP__swift_package_build** - Build Swift packages
- **mcp__XcodeBuildMCP__swift_package_test** - Test Swift packages
- **mcp__XcodeBuildMCP__swift_package_run** - Run Swift package executables

### Diagnostic Tools
- **mcp__XcodeBuildMCP__diagnostic** - Get MCP server environment info
- **mcp__XcodeBuildMCP__discover_tools** - Enable relevant development workflows

**Usage Example:**
```bash
# Discover and build the project
mcp__XcodeBuildMCP__discover_projs workspaceRoot="/Users/christianmerrill/Desktop/universal-ai-tools"
mcp__XcodeBuildMCP__build_mac_proj projectPath="macOS-App/UniversalAITools/UniversalAITools.xcodeproj" scheme="UniversalAITools"

# Run tests
mcp__XcodeBuildMCP__test_macos_proj projectPath="macOS-App/UniversalAITools/UniversalAITools.xcodeproj" scheme="UniversalAITools"
```

## Architecture Guidelines

### Technology Stack
- **Language**: Swift 6.0+
- **UI Framework**: SwiftUI (primary), AppKit (only when necessary), Arc UI Components
- **Minimum Target**: macOS 14.0 (Sonoma)
- **Architecture Pattern**: MVVM with @Observable
- **Concurrency**: Swift Concurrency (async/await, actors, Task)
- **Testing**: XCTest with SwiftUI ViewInspector
- **Arc UI Integration**: Custom Arc browser-inspired UI components for modern interface design

### Core Principles
1. **SwiftUI First**: Build all functionality using SwiftUI unless there's a feature only supported in AppKit
2. **Modern APIs**: Always use the latest macOS APIs and Swift language features
3. **Apple HIG**: Follow Apple Human Interface Guidelines strictly
4. **SF Symbols**: Use SF Symbols for all iconography
5. **Accessibility**: Ensure WCAG 2.1 Level AA compliance with full VoiceOver support
6. **Performance**: Optimize for Apple Silicon (M1/M2/M3)

## Project Structure

```
UniversalAITools/
├── Arc/                # Arc UI-inspired components
│   ├── Components/     # Arc-style UI elements
│   ├── Themes/        # Arc theming system
│   └── Animations/    # Arc-style animations
├── Views/              # SwiftUI Views and UI components
│   ├── Components/     # Reusable UI components
│   ├── Chat/          # Chat interface views
│   └── Settings/      # Settings and preferences
├── Models/            # Data models and types
├── Services/          # Business logic and API services
├── Managers/          # App-wide managers (state, navigation)
├── Utils/             # Helper functions and extensions
└── Tests/             # Unit and UI tests
```

### Arc UI Components
The app includes Arc browser-inspired UI components located in the `Arc/` directory:
- **Arc Sidebar**: Collapsible sidebar with smooth animations
- **Arc Tab Bar**: Space-efficient tab management
- **Arc Command Palette**: Quick action launcher (⌘K)
- **Arc Boost Controls**: Custom UI enhancement controls
- **Arc Theme System**: Dynamic color theming inspired by Arc
- **Arc Gestures**: Fluid gesture controls and animations

## Code Style Guidelines

### SwiftUI Views
```swift
struct ExampleView: View {
    // MARK: - Properties
    @State private var localState = ""
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var appState: AppState
    
    // MARK: - Body
    var body: some View {
        content
            .navigationTitle("Title")
            .toolbar { toolbarContent }
    }
    
    // MARK: - Subviews
    @ViewBuilder
    private var content: some View {
        // Break complex views into computed properties
    }
}
```

### Observable Models
```swift
@Observable
final class ExampleViewModel {
    // Use @Observable for iOS 17+ / macOS 14+
    var items: [Item] = []
    var isLoading = false
    
    func loadData() async throws {
        // Use async/await for all async operations
    }
}
```

### Service Layer
```swift
actor ExampleService {
    // Use actors for thread-safe services
    static let shared = ExampleService()
    
    func performAction() async throws -> Result {
        // Implementation
    }
}
```

## Common Patterns

### Error Handling
- Use Swift's Result type for operations that can fail
- Implement proper error recovery UI
- Show user-friendly error messages with recovery suggestions

### State Management
- Use @State for local view state
- Use @Observable for view models
- Use @EnvironmentObject for app-wide state
- Minimize state lifting - keep state as local as possible

### Performance Optimization
- Extract complex view bodies into smaller computed properties
- Use .task for async operations in views
- Implement lazy loading for lists with many items
- Use @MainActor only when necessary

### Accessibility
- Add .accessibilityLabel() to all interactive elements
- Implement .accessibilityHint() for complex interactions
- Test with VoiceOver enabled
- Support keyboard navigation

## API Integration

### Backend URL
- Development: `http://localhost:9999`
- Production: Configure in Settings

### WebSocket Connections
- Use `WebSocketConnectionManager` for real-time data
- Implement automatic reconnection with exponential backoff
- Handle connection state changes gracefully

## Testing Guidelines

### Unit Tests
- Test all ViewModels and Services
- Mock network calls and external dependencies
- Aim for >80% code coverage

### UI Tests
- Test critical user flows
- Use XCUITest for integration testing
- Implement screenshot tests for complex views

## Build & Run

### Prerequisites
- Xcode 15.0+
- macOS 14.0+
- Swift 6.0+

### Build Commands
```bash
# Generate Xcode project (if using xcodegen)
xcodegen generate

# Build
xcodebuild -scheme UniversalAITools -configuration Debug build

# Test
xcodebuild -scheme UniversalAITools test

# Run
open UniversalAITools.xcodeproj
```

## Key Features

### Already Implemented
- 3D Knowledge Graph Visualization (SceneKit)
- Agent Orchestration Dashboard
- Flash Attention Analytics
- Context Flow Visualization
- Real-time WebSocket data streaming
- Voice interaction with STT/TTS
- Touch Bar support
- Keyboard shortcuts
- Multi-window support

### Component Library
- Advanced gesture controls
- Particle effects
- Interactive charts
- Sankey diagrams
- Heatmap visualizations
- Network topology views
- Memory timeline
- Performance monitoring

## Debugging Tips

### Common Issues
1. **"Compiler unable to type-check expression"**: Extract view body into smaller computed properties
2. **Preview crashes**: Check for force unwrapped optionals or missing environment objects
3. **Performance issues**: Profile with Instruments, look for unnecessary redraws

### Useful Commands
- `po print(Mirror(reflecting: object).subjectType)` - Debug view types
- `defaults write com.apple.dt.Xcode ShowBuildOperationDuration YES` - Show build times
- `xcrun simctl list devices` - List available simulators

## Resources

### Documentation
- [Apple SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [SF Symbols](https://developer.apple.com/sf-symbols/)

### Project-Specific
- Backend API: `src/routers/` in main project
- Design System: `Utils/AppTheme.swift`
- Component Examples: `Views/Components/`

## Contact & Support

For questions about the architecture or implementation details, refer to:
- Technical documentation in `/docs/`
- Backend integration guide: `BACKEND_INTEGRATION_GUIDE.md`
- UI enhancement summary: `UI_ENHANCEMENT_COMPLETE.md`
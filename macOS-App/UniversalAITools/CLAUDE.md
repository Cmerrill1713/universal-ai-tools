# Universal AI Tools - SwiftUI macOS Application

## Project Overview
This is a sophisticated SwiftUI-based macOS application that serves as the primary frontend for the Universal AI Tools platform. The app features 70+ advanced UI components, real-time data visualization, and comprehensive AI orchestration capabilities.

## Architecture Guidelines

### Technology Stack
- **Language**: Swift 6.0+
- **UI Framework**: SwiftUI (primary), AppKit (only when necessary)
- **Minimum Target**: macOS 14.0 (Sonoma)
- **Architecture Pattern**: MVVM with @Observable
- **Concurrency**: Swift Concurrency (async/await, actors, Task)
- **Testing**: XCTest with SwiftUI ViewInspector

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
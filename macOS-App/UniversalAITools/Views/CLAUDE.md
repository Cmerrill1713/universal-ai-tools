# Views Directory - SwiftUI Components

## Overview
This directory contains all SwiftUI views and UI components for the Universal AI Tools macOS application.

## Structure

### Main Views
- `ContentView.swift` - Main app container with navigation
- `SidebarView.swift` - Left sidebar navigation
- `ChatView.swift` - Main chat interface
- `SettingsView.swift` - Application settings
- `DashboardView.swift` - Analytics dashboard

### Components/
Reusable UI components used across the app:
- `KnowledgeGraphView3D.swift` - 3D graph visualization using SceneKit
- `AgentOrchestrationDashboard.swift` - Agent management UI
- `FlashAttentionAnalytics.swift` - Performance analytics
- `ContextFlowDashboard.swift` - Context visualization

## View Patterns

### Standard View Structure
```swift
struct ExampleView: View {
    // MARK: - Properties
    @State private var localState
    @EnvironmentObject var appState
    
    // MARK: - Body
    var body: some View {
        content
    }
    
    // MARK: - Subviews
    @ViewBuilder
    private var content: some View { }
}
```

### Complex View Optimization
When views become complex:
1. Extract body into computed properties
2. Create separate view structs for large sections
3. Use `@ViewBuilder` for conditional content
4. Implement `.equatable()` for expensive views

## Component Guidelines

### Creating New Components
1. Place in `Components/` if reusable
2. Use descriptive names ending with `View`
3. Include comprehensive previews
4. Add accessibility from the start
5. Document public APIs

### Animation Standards
- Use `.animation(.easeInOut(duration: 0.3), value:)` for standard animations
- Implement `.transition()` for view appearance/disappearance
- Use `withAnimation` for state changes
- Avoid implicit animations

### Color and Styling
- Use `AppTheme` for consistent colors
- Prefer semantic colors (`.primary`, `.secondary`)
- Use SF Symbols for icons
- Follow Apple HIG for spacing and sizing

## State Management

### View-Local State
```swift
@State private var isExpanded = false
@State private var searchText = ""
```

### Shared State
```swift
@EnvironmentObject var appState: AppState
@EnvironmentObject var chatState: ChatState
```

### Async Operations
```swift
.task {
    await viewModel.load()
}
.refreshable {
    await viewModel.refresh()
}
```

## Accessibility Requirements

Every view must:
1. Have `.accessibilityLabel()` on interactive elements
2. Include `.accessibilityHint()` for complex interactions
3. Support keyboard navigation
4. Work with VoiceOver
5. Support Dynamic Type

## Performance Considerations

### Lists and Grids
- Use `LazyVStack`/`LazyHStack` for long lists
- Implement `.id()` for list items
- Use `List` with sections for structured data
- Avoid `ForEach` with indices when possible

### Images and Graphics
- Cache images using `ImageCacheManager`
- Use `.resizable().aspectRatio()` correctly
- Implement `.drawingGroup()` for complex graphics
- Lazy load heavy content

## Testing

### Preview Providers
Every view should have previews showing:
- Default state
- Loading state
- Error state
- Empty state
- Dark mode variant

### UI Testing
- Add `.accessibilityIdentifier()` for UI tests
- Test critical user flows
- Verify responsive layout
- Check keyboard navigation

## Common Issues and Solutions

### Compiler Timeout
**Problem**: "Unable to type-check expression"
**Solution**: Extract view body into smaller parts

### Layout Issues
**Problem**: Views not sizing correctly
**Solution**: Use `.frame()` with proper constraints

### Performance
**Problem**: Slow scrolling or animations
**Solution**: Profile with Instruments, optimize redraws
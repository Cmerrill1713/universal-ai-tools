# Enhanced Navigation System

The Enhanced Navigation System provides a comprehensive solution for feature discoverability, smart navigation, and user-friendly guided experiences in the Universal AI Tools macOS app.

## Overview

This system replaces the basic sidebar navigation with a sophisticated, progressive disclosure interface that includes:

- **Feature Discovery**: Smart suggestions and guided tours
- **Command Palette**: Global search and quick actions
- **Contextual Navigation**: Breadcrumbs and workflow helpers
- **Progressive Disclosure**: Organized feature categories with badges
- **Smart Suggestions**: AI-powered recommendations based on usage patterns

## Architecture

### Core Components

#### 1. Navigation Models (`NavigationModels.swift`)
- `NavigationFeature`: Represents discoverable features with metadata
- `FeatureCategory`: Groups features by functionality
- `NavigationAction`: Defines actions that can be triggered
- `SmartSuggestion`: Context-aware feature recommendations
- `GuidedTour`: Step-by-step feature introductions

#### 2. Navigation Service (`EnhancedNavigationService.swift`)
- Manages navigation state and feature discovery
- Tracks usage patterns for smart suggestions
- Handles tour management and completion
- Provides search functionality across features

#### 3. Enhanced Sidebar (`EnhancedNavigationSidebar.swift`)
- Progressive disclosure of features by category
- Search functionality with real-time filtering
- Smart suggestions display
- Recently used features section

#### 4. Command Palette (`CommandPaletteView.swift`)
- Global search and command execution
- Fuzzy search with category filtering
- Keyboard-driven navigation (⌘K)
- Recent commands tracking

#### 5. Feature Discovery (`FeatureDiscoveryPanel.swift`)
- Feature exploration with rich descriptions
- Guided tour management
- Tips and productivity suggestions
- Progress tracking

#### 6. Contextual Helpers (`ContextualNavigationHelpers.swift`)
- Breadcrumb navigation
- Workflow progress indicators
- Feature relationship mapping
- Quick access toolbar

## Integration

### Basic Integration

Replace your existing sidebar with the enhanced navigation:

```swift
// Replace ModernSidebar with NavigationSidebarWrapper
NavigationSidebarWrapper(selection: $sidebarSelection)
    .environmentObject(appState)
    .environmentObject(apiService)
```

### Full Integration with Enhanced ContentView

For complete feature integration, use the enhanced content view:

```swift
EnhancedContentView()
    .environmentObject(appState)
    .environmentObject(apiService)
```

### Compatibility Mode

The system provides backward compatibility through `NavigationSidebarWrapper`:

```swift
// Automatically switches between enhanced and classic navigation
NavigationSidebarWrapper(selection: $selection)
```

## Features

### 1. Progressive Disclosure
- **Core Features**: Always visible, essential functionality
- **Advanced Features**: Collapsible sections with "PRO" badges
- **Experimental Features**: Clearly marked with "BETA" badges
- **New Features**: Highlighted with "NEW" badges

### 2. Smart Suggestions
Features are suggested based on:
- **Frequently Used**: Your most-used features
- **Context-Related**: Features related to your current view
- **Time-Based**: Features useful at specific times
- **Workflow Optimization**: Features that improve your workflow

### 3. Feature Discovery
- **Guided Tours**: Step-by-step introductions to complex features
- **Feature Cards**: Rich descriptions with explore buttons
- **Tips & Tricks**: Productivity improvements and hidden features
- **Progress Tracking**: Tour completion and discovery statistics

### 4. Command Palette
Access via ⌘K to:
- Search all features and commands
- Execute actions quickly
- Navigate between views
- Access recent commands

### 5. Contextual Navigation
- **Breadcrumbs**: Show current location in the app hierarchy
- **Related Features**: Discover connected functionality
- **Workflow Progress**: Track multi-step processes
- **Quick Actions**: Fast access to common tasks

## Configuration

### Navigation Preferences
```swift
struct NavigationPreferences {
    var compactMode: Bool = false
    var showDescriptions: Bool = true
    var showShortcuts: Bool = true
    var enableSmartSuggestions: Bool = true
    var enableTours: Bool = true
    // ... more options
}
```

### Feature Flags
Control rollout and testing:
```swift
struct FeatureFlags {
    static let enhancedNavigationEnabled = true
    static let smartSuggestionsEnabled = true
    static let guidedToursEnabled = true
    static let commandPaletteEnabled = true
}
```

## Usage Analytics

The system tracks usage patterns for:
- Feature usage frequency
- Navigation patterns
- Tour completion rates
- Search queries
- Command palette usage

This data powers smart suggestions and helps improve the user experience.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K | Open command palette |
| ⌘F | Global search |
| ⌘N | New chat |
| ⌘⌥S | Toggle sidebar |
| ⌘D | Dashboard |
| ⌘⇧V | Voice interface |
| ⌘⌥1 | Agent activity |
| ⌘⌥2 | MLX fine-tuning |
| ⌘⌥3 | Vision processing |

## Customization

### Adding New Features
```swift
NavigationFeature(
    id: "new_feature",
    title: "New Feature",
    description: "Description of the new feature",
    icon: "icon.name",
    category: .tools,
    level: .core,
    keywords: ["search", "terms"],
    shortcutKey: "⌘X",
    action: .showView("new_feature")
)
```

### Creating Guided Tours
```swift
GuidedTour(
    id: "feature_tour",
    title: "Feature Tour",
    description: "Learn how to use this feature",
    category: .core,
    estimatedDuration: 300, // 5 minutes
    steps: [
        TourStep(
            id: "step1",
            title: "First Step",
            description: "Description of what to do",
            targetElement: "element-id",
            position: .bottom,
            actions: [.highlight, .click]
        )
        // ... more steps
    ]
)
```

## Migration

### Existing Users
The system automatically migrates existing user data:
- Sidebar visibility preferences
- Chat history to feature usage stats
- Existing feature discovery progress

### Backward Compatibility
- Existing `ModernSidebar` calls continue to work
- Toggle between enhanced and classic navigation
- Gradual feature rollout capabilities

## Performance

The enhanced navigation system is optimized for:
- **Lazy Loading**: Features load on demand
- **Efficient Search**: Debounced search with caching
- **Smooth Animations**: Hardware-accelerated transitions
- **Memory Management**: Automatic cleanup of unused resources

## Future Enhancements

Planned features include:
- **AI Navigation Assistant**: Natural language navigation
- **Workflow Recording**: Capture and replay workflows
- **Collaborative Tours**: Share tours between team members
- **Advanced Analytics**: Detailed usage insights
- **Voice Navigation**: Speech-driven feature access

## Troubleshooting

### Common Issues

1. **Features not appearing**: Check feature flags and user permissions
2. **Tours not starting**: Verify tour prerequisites are met
3. **Search not working**: Clear search cache and restart
4. **Suggestions not updating**: Check usage tracking is enabled

### Debug Mode
Enable debug logging for navigation events:
```swift
NavigationIntegration.trackNavigationEvent(
    event: .featureSelected,
    feature: feature,
    context: ["debug": true]
)
```

## Contributing

When adding new features to the navigation system:

1. Add feature definition to `NavigationModels.swift`
2. Update the service in `EnhancedNavigationService.swift`
3. Create appropriate UI components
4. Add keyboard shortcuts if applicable
5. Update documentation and tours
6. Test with various user scenarios

## Examples

See `EnhancedContentView.swift` for a complete implementation example that demonstrates all features of the enhanced navigation system.
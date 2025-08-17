# Arc UI Demo

A minimal standalone macOS SwiftUI app that demonstrates the Arc UI components without any legacy code dependencies.

## Features

This demo showcases the key Arc UI design elements:

- **Arc-inspired Sidebar**: Modern sidebar with smooth animations and grouping
- **Chat Interface**: Clean message bubbles and input area
- **New Chat Templates**: Popover menu for starting different types of conversations
- **Modern Theme**: Dark theme inspired by Arc browser
- **Conversation Management**: Rename, duplicate, and delete conversations
- **Search**: Search through conversations and messages
- **Navigation**: Split view navigation between sidebar and content

## Components Demonstrated

### Core UI Components
- `ArcSidebar` - Main navigation sidebar
- `ConversationRow` - Individual chat items with hover states
- `MessageBubble` - Chat message display
- `NewChatMenu` - Template selection popover
- `TemplateRow` - Template selection items

### Design System
- `AppTheme` - Centralized theming system
- Arc-inspired color palette
- Consistent spacing and typography
- Smooth animations and transitions

## How to Run

### Option 1: Using the Build Script
```bash
cd macOS-App/ArcUIDemo
./build-arc-demo.sh
```

### Option 2: Direct Compilation
```bash
cd macOS-App/ArcUIDemo
swift run ArcUIDemo.swift
```

### Option 3: Xcode
1. Create a new macOS app project in Xcode
2. Replace the default ContentView with the content from `ArcUIDemo.swift`
3. Build and run

## File Structure

```
ArcUIDemo/
├── ArcUIDemo.swift          # Complete standalone app
├── build-arc-demo.sh        # Build script
└── README.md               # This file
```

## Key Features

### Mock Data
- Pre-populated with sample conversations
- Demonstrates different conversation states
- Shows grouping by date (Today, Yesterday, This Week)

### Interactive Elements
- Hover effects on conversation items
- Context menus for actions
- Search functionality
- Template selection
- Real-time message sending simulation

### Modern macOS Integration
- Uses NavigationSplitView for proper sidebar
- Follows macOS Human Interface Guidelines
- Proper window sizing and behavior
- Native macOS controls and interactions

## Customization

The demo is designed to be easily customizable:

- **Colors**: Modify `AppTheme` for different color schemes
- **Templates**: Add new chat templates in `ChatTemplate.defaultTemplates`
- **Layout**: Adjust spacing and sizing constants in `AppTheme`
- **Features**: Add new sidebar items in the `SidebarItem` enum

## Requirements

- macOS 14.0+
- Xcode 15.0+
- Swift 5.9+

## Architecture

The demo follows modern SwiftUI patterns:

- **@MainActor**: Proper concurrency handling
- **@StateObject**: State management for app-wide data
- **@EnvironmentObject**: Dependency injection
- **@State**: Local component state
- **Combine**: Reactive programming where needed

## Design Inspiration

This demo takes inspiration from:
- Arc browser's clean, modern interface
- ChatGPT's conversation management
- macOS native app conventions
- Modern design system principles
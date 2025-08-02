#!/usr/bin/env tsx

/**
 * Add SwiftUI Knowledge Manually
 * Adds comprehensive SwiftUI documentation and patterns to the knowledge base
 */

import 'dotenv/config';';';';
import { createClient    } from '@supabase/supabase-js';';';';
import { LogContext, log    } from '../utils/logger.js';';';';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');'''
  process.exit(1);
}

// TODO: Complete implementation

const supabase = createClient(supabaseUrl, supabaseKey);

// SwiftUI Knowledge Base
const SWIFTUI_KNOWLEDGE = [;
  {
    title: 'SwiftUI Fundamentals','''
    category: 'swiftui_basics','''
    content: `
SwiftUI is Apple's modern declarative framework for building user interfaces across all Apple platforms.'''

Key Concepts: 1. Declarative Syntax - Describe what the UI should look like, not how to create it
2. State Management - @State, @Binding, @ObservedObject, @StateObject, @EnvironmentObject
3. View Modifiers - Chain methods to customize views
4. Layout System - VStack, HStack, ZStack for arranging views
5. Property Wrappers - Special attributes that add functionality to properties

Basic View Structure: struct, ContentView: View {
    var body: some View {
        Text("Hello, SwiftUI!")"""
            .font(.title)
            .foregroundColor(.blue)
    }
}
`,
    code_examples: [
      {
        title: 'Basic SwiftUI View','''
        code: `import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack {
            Text("Welcome to SwiftUI")"""
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundColor(.blue)
            
            Text("Build amazing apps")"""
                .font(.subheadline)
                .foregroundColor(.gray)
        }
        .padding()
    }
}`
      },
      {
        title: 'State Management','''
        code: `struct, CounterView: View {
    @State private var count = 0
    
    var body: some View {
        VStack {
            Text("Count: (count)")"""
                .font(.title)
            
            HStack {
                Button("Increment") {"""
                    count += 1
                }
                .buttonStyle(.borderedProminent)
                
                Button("Decrement") {"""
                    count -= 1
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
    }
}`
      }
    ]
  },
  {
    title: 'SwiftUI Layout System','''
    category: 'swiftui_layout','''
    content: `
SwiftUI provides a powerful and flexible layout system using stacks and other container views.

Layout Containers: 1. VStack - Vertical stack
2. HStack - Horizontal stack
3. ZStack - Depth stack (overlapping views)
4. Grid - Two-dimensional layout (iOS 16+)
5. GeometryReader - Access to size and position

Alignment and Spacing: - alignment parameter for stacks
- spacing parameter for consistent gaps
- Spacer() for flexible space
- padding() modifier for margins

Frame Modifiers: - frame(width:height:) for fixed sizes
- frame(minWidth: maxWidth:) for flexible sizing
- aspectRatio() for maintaining proportions
`,
    code_examples: [
      {
        title: 'Complex Layout Example','''
        code: `struct, ProfileView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header
            HStack {
                Image(systemName: "person.circle.fill")"""
                    .resizable()
                    .frame(width: 60, height: 60)
                    .foregroundColor(.blue)
                
                VStack(alignment: .leading) {
                    Text("John Doe")"""
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text("iOS Developer")"""
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Button(action: {}) {
                    Image(systemName: "ellipsis")"""
                }
            }
            
            // Stats
            HStack {
                StatView(label: "Posts", value: "120")"""
                Spacer()
                StatView(label: "Followers", value: "5.2K")"""
                Spacer()
                StatView(label: "Following", value: "180")"""
            }
            
            // Bio
            Text("Passionate about SwiftUI and creating beautiful iOS apps. Always learning and sharing knowledge with the community.")"""
                .font(.body)
                .multilineTextAlignment(.leading)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 5)
    }
}

struct StatView: View {
    let label: String;
    let value: String;
    
    var body: some View {
        VStack {
            Text(value)
                .font(.title3)
                .fontWeight(.semibold)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}`
      }
    ]
  },
  {
    title: 'SwiftUI Navigation','''
    category: 'swiftui_navigation','''
    content: `
Navigation in SwiftUI has evolved significantly. Here are the main approaches: NavigationStack (iOS 16+):
- Modern navigation API
- Programmatic navigation
- Type-safe navigation paths

NavigationView (deprecated but still used):
- Simple push/pop navigation
- NavigationLink for navigation

TabView: - Tab-based navigation
- Bottom tab bar on iOS
- Sidebar on macOS

NavigationSplitView: - Multi-column navigation
- Ideal for iPad and Mac
`,
    code_examples: [
      {
        title: 'NavigationStack Example','''
        code: `struct, NavigationExample: View {
    @State private var path = NavigationPath()
    
    var body: some View {
        NavigationStack(path: $path) {
            List {
                ForEach(1...10, id: .self) { number in
                    NavigationLink("Item \(number)", value: number)"""
                }
            }
            .navigationTitle("Items")"""
            .navigationDestination(for: Int.self) { number in
                DetailView(number: number, path: $path)
            }
        }
    }
}

struct DetailView: View {
    let number: Int;
    @Binding var path: NavigationPath
    
    var body: some View {
        VStack {
            Text("Detail for Item \\(number)")"""
                .font(.largeTitle)
            
            Button("Go to Root") {"""
                path = NavigationPath()
            }
            .buttonStyle(.borderedProminent)
        }
        .navigationTitle("Detail")"""
        .navigationBarTitleDisplayMode(.inline)
    }
}`
      }
    ]
  },
  {
    title: 'SwiftUI Lists and Collections','''
    category: 'swiftui_lists','''
    content: `
SwiftUI provides powerful APIs for displaying collections of data.

List: - Scrollable single-column list
- Built-in selection support
- Swipe actions
- Pull-to-refresh

LazyVStack/LazyHStack: - Performance-optimized for large datasets
- Only renders visible items

ForEach: - Iterate over collections
- Requires identifiable items

Grid: - Two-dimensional layouts
- LazyVGrid and LazyHGrid for performance
`,
    code_examples: [
      {
        title: 'Advanced List with Actions','''
        code: `struct, TaskListView: View {
    @State private var tasks = [
        Task(title: "Complete SwiftUI tutorial", isCompleted: false),"""
        Task(title: "Build sample app", isCompleted: false),"""
        Task(title: "Submit to App Store", isCompleted: false)"""
    ]
    
    var body: some View {
        List {
            ForEach($tasks) { $task in
                HStack {
                    Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")"""
                        .foregroundColor(task.isCompleted ? .green: .gray)
                        .onTapGesture {
                            task.isCompleted.toggle()
                        }
                    
                    Text(task.title)
                        .strikethrough(task.isCompleted)
                        .foregroundColor(task.isCompleted ? .gray: .primary)
                    
                    Spacer()
                }
                .padding(.vertical, 4)
            }
            .onDelete(perform: deleteTasks)
            .onMove(perform: moveTasks)
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Tasks")"""
        .navigationBarItems(trailing: EditButton())
    }
    
    func deleteTasks(at offsets: IndexSet) {
        tasks.remove(atOffsets: offsets)
    }
    
    func moveTasks(from source: IndexSet, to destination: Int) {
        tasks.move(fromOffsets: source, toOffset: destination)
    }
}

struct Task: Identifiable {
    let id = UUID();
    var title: String;
    var isCompleted: Bool;
}`
      }
    ]
  },
  {
    title: 'SwiftUI Animations','''
    category: 'swiftui_animation','''
    content: `
SwiftUI makes animations easy with implicit and explicit animation APIs.

Animation Types: 1. Implicit Animations - .animation() modifier
2. Explicit Animations - withAnimation { }
3. Transitions - how views appear/disappear
4. Gesture-driven animations

Common Animations: - Scale, rotation, opacity
- Position and offset
- Color and gradient transitions
- Custom timing curves

Animation Modifiers: - .easeIn, .easeOut, .easeInOut
- .linear
- .spring()
- .interpolatingSpring()
`,
    code_examples: [
      {
        title: 'Complex Animation Example','''
        code: `struct, AnimatedCard: View {
    @State private var isExpanded = false
    @State private var isRotated = false
    @State private var showDetails = false
    
    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 20)
                .fill()
                    LinearGradient()
                        colors: [.blue, .purple],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(height: isExpanded ? 300 : 150)
                .overlay()
                    VStack {
                        Image(systemName: "swift")"""
                            .font(.system(size: 50))
                            .foregroundColor(.white)
                            .rotationEffect(.degrees(isRotated ? 360: 0))
                        
                        if showDetails {
                            Text("SwiftUI Animations")"""
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .transition(.scale.combined(with: .opacity))
                        }
                    }
                )
                .scaleEffect(isExpanded ? 1.05: 1.0)
                .shadow(radius: isExpanded ? 20 : 10)
                .onTapGesture {
                    withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                        isExpanded.toggle()
                        isRotated.toggle()
                    }
                    
                    withAnimation(.easeInOut(duration: 0.4).delay(0.1)) {
                        showDetails.toggle()
                    }
                }
            
            HStack(spacing: 20) {
                Button("Bounce") {"""
                    withAnimation(.interpolatingSpring(stiffness: 300, damping: 10)) {
                        isExpanded.toggle()
                    }
                }
                .buttonStyle(.bordered)
                
                Button("Smooth") {"""
                    withAnimation(.easeInOut(duration: 0.8)) {
                        isExpanded.toggle()
                        isRotated.toggle()
                    }
                }
                .buttonStyle(.bordered)
            }
            .padding(.top)
        }
        .padding()
    }
}`
      }
    ]
  },
  {
    title: 'SwiftUI Data Flow','''
    category: 'swiftui_data','''
    content: `
Understanding data flow is crucial for building SwiftUI apps.

Property Wrappers: @State - Local view state
@Binding - Two-way connection to state
@StateObject - Own reference type
@ObservedObject - Observe external object
@EnvironmentObject - Shared across view hierarchy
@Environment - System values
@AppStorage - UserDefaults
@FocusState - Focus management

ObservableObject Protocol: - For custom model types
- @Published for observable properties
- Automatic UI updates
`,
    code_examples: [
      {
        title: 'MVVM Pattern with ObservableObject','''
        code: `// Model
struct User: Identifiable, Codable {
    let id: UUID;
    var name: String;
    var email: String;
    var isActive: Bool;
}

// ViewModel
class UserViewModel: ObservableObject {
    @Published var users: [User] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    func loadUsers() {
        isLoading = true
        errorMessage = nil
        
        // Simulate API call
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            self.users = [
                User(id: UUID(), name: "Alice", email: "alice@example.com", isActive: true),"""
                User(id: UUID(), name: "Bob", email: "bob@example.com", isActive: false),"""
                User(id: UUID(), name: "Charlie", email: "charlie@example.com", isActive: true)"""
            ]
            self.isLoading = false
        }
    }
    
    func toggleUserStatus(_ user: User) {
        if let index = users.firstIndex(where: { $0.id == user.id }) {
            users[index].isActive.toggle()
        }
    }
}

// View
struct UserListView: View {
    @StateObject private var viewModel = UserViewModel()
    
    var body: some View {
        NavigationView {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading users...")"""
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = viewModel.errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                        .padding()
                } else {
                    List(viewModel.users) { user in
                        UserRow(user: user) {
                            viewModel.toggleUserStatus(user)
                        }
                    }
                }
            }
            .navigationTitle("Users")"""
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Refresh") {"""
                        viewModel.loadUsers()
                    }
                }
            }
        }
        .onAppear {
            viewModel.loadUsers()
        }
    }
}

struct UserRow: View {
    let user: User;
    let onToggle: () -> Void;
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(user.name)
                    .font(.headline)
                Text(user.email)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Toggle("", isOn: .constant(user.isActive))"""
                .labelsHidden()
                .allowsHitTesting(false)
                .onTapGesture {
                    onToggle()
                }
        }
        .padding(.vertical, 4)
    }
}`
      }
    ]
  },
  {
    title: 'SwiftUI for macOS','''
    category: 'swiftui_macos','''
    content: `
SwiftUI on macOS has specific considerations and capabilities.

macOS-Specific Features: - Menu bar apps
- Window management
- Sidebar navigation
- Toolbar customization
- Keyboard shortcuts
- Context menus
- Preferences windows

Key Differences: - No navigation bars (use toolbars)
- Different control styles
- Mouse hover states
- Keyboard navigation
- Multiple windows
`,
    code_examples: [
      {
        title: 'macOS Window with Sidebar','''
        code: `struct, ContentView: View {
    @State private var selection: String? = "home""""
    
    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Label("Home", systemImage: "house")"""
                    .tag("home")"""
                
                Label("Settings", systemImage: "gear")"""
                    .tag("settings")"""
                
                Label("Profile", systemImage: "person.circle")"""
                    .tag("profile")"""
            }
            .navigationSplitViewColumnWidth(min: 200, ideal: 250)
            .listStyle(.sidebar)
        } detail: {
            switch selection {
            case "home":"""
                HomeView()
            case "settings":"""
                SettingsView()
            case "profile":"""
                ProfileView()
            default: Text("Select an item")"""
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(NSColor.windowBackgroundColor))
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Button(action: toggleSidebar) {
                    Image(systemName: "sidebar.left")"""
                }
            }
        }
        .frame(minWidth: 800, minHeight: 600)
    }
    
    func toggleSidebar() {
        NSApp.keyWindow?.firstResponder?
            .tryToPerform(#selector(NSSplitViewController.toggleSidebar(_: )), with: nil)
    }
}`
      },
      {
        title: 'macOS Menu Bar App','''
        code: `@main
struct MenuBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!;
    var popover = NSPopover();
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "swift", accessibilityDescription: nil)"""
            button.action = #selector(togglePopover)
        }
        
        popover.contentViewController = NSHostingController(rootView: MenuBarView())
        popover.behavior = .transient
    }
    
    @objc func togglePopover() {
        if let button = statusItem.button {
            if popover.isShown {
                popover.performClose(nil)
            } else {
                popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            }
        }
    }
}

struct MenuBarView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("SwiftUI Menu Bar App")"""
                .font(.headline)
            
            Divider()
            
            Button("Action 1") {"""
                print("Action 1 triggered")"""
            }
            
            Button("Action 2") {"""
                print("Action 2 triggered")"""
            }
            
            Divider()
            
            Button("Quit") {"""
                NSApplication.shared.terminate(nil)
            }
        }
        .padding()
        .frame(width: 250)
    }
}`
      }
    ]
  }
];

async function addSwiftUIKnowledge() {
  log.info('Adding SwiftUI knowledge to database...', LogContext.SYSTEM);'''
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const knowledge of SWIFTUI_KNOWLEDGE) {
    try {
      // Store main content in mcp_context
      const { error: contextError } = await supabase;
        .from('mcp_context')'''
        .insert({)
          content: JSON.stringify({,)
            title: knowledge.title,
            category: knowledge.category,
            content: knowledge.content,
            example_count: knowledge.code_examples.length
          }),
          category: 'code_patterns','''
          metadata: {,
            doc_type: 'swiftui','''
            knowledge_category: knowledge.category,
            has_examples: knowledge.code_examples.length > 0
          },
          created_at: new Date().toISOString()
        });
      
      if (contextError) {
        log.error(`Failed to store ${knowledge.title}`, LogContext.SYSTEM, { error: contextError });
        errorCount++;
        continue;
      }
      
      // Store code examples
      for (const example of knowledge.code_examples) {
        const { error: exampleError } = await supabase;
          .from('code_examples')'''
          .insert({)
            source_url: `manual_${knowledge.category}`,
            title: example.title,
            code: example.code,
            language: 'swift','''
            category: knowledge.category,
            tags: ['swiftui', knowledge.category, 'manual'],'''
            metadata: {,
              parent_knowledge: knowledge.title,
              manually_added: true
            },
            created_at: new Date().toISOString()
          });
        
        if (exampleError) {
          log.warn(`Failed to store example: ${example.title}`, LogContext.SYSTEM, { error: exampleError });
        }
      }
      
      successCount++;
      log.info(`Added: ${knowledge.title} with ${knowledge.code_examples.length} examples`, LogContext.SYSTEM);
      
    } catch (error) {
      log.error(`Error processing ${knowledge.title}`, LogContext.SYSTEM, {)
        error: error instanceof Error ? error.message : String(error) 
      });
      errorCount++;
    }
  }
  
  // Add summary
  const { error: summaryError } = await supabase;
    .from('mcp_context')'''
    .insert({)
      content: JSON.stringify({,)
        summary: 'SwiftUI knowledge base added','''
        total_topics: SWIFTUI_KNOWLEDGE.length,
        success_count: successCount,
        error_count: errorCount,
        timestamp: new Date().toISOString()
      }),
      category: 'project_overview','''
      metadata: {,
        doc_type: 'swiftui','''
        manual_addition: true
      },
      created_at: new Date().toISOString()
    });
  
  if (summaryError) {
    log.error('Failed to store summary', LogContext.SYSTEM, { error: summaryError });'''
  }
  
  log.info(`SwiftUI knowledge addition completed! Success: ${successCount}, Errors: ${errorCount}`, LogContext.SYSTEM);
}

// Run the script
addSwiftUIKnowledge()
  .then(() => {
    log.info('SwiftUI knowledge base setup completed', LogContext.SYSTEM);'''
    process.exit(0);
  })
  .catch((error) => {
    log.error('Failed to add SwiftUI knowledge', LogContext.SYSTEM, { ')''
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  });
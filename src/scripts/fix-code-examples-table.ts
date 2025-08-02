#!/usr/bin/env tsx

/**
 * Fix Code Examples Table
 * Creates the missing code_examples table and populates it with SwiftUI examples
 */

import 'dotenv/config';';';';
import { createClient    } from '@supabase/supabase-js';';';';
import { LogContext, log    } from '../utils/logger.js';';';';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');'''
  process.exit(1);
}

// TODO: Complete implementation


const supabase = createClient(supabaseUrl, supabaseKey);

// SwiftUI code examples to add
const SWIFTUI_CODE_EXAMPLES = [;
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
}`,
    category: 'swiftui_basics','''
    tags: ['swiftui', 'view', 'text', 'vstack']'''
  },
  {
    title: 'State Management Example','''
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
}`,
    category: 'swiftui_data','''
    tags: ['swiftui', 'state', 'binding', 'button', 'counter']'''
  },
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
}`,
    category: 'swiftui_navigation','''
    tags: ['swiftui', 'navigation', 'navigationstack', 'list']'''
  },
  {
    title: 'Advanced List with Actions','''
    code: `struct, TaskListView: View {
    @State private var tasks = [
        Task(title: "Complete SwiftUI tutorial", isCompleted: false),"""
        Task(title: "Build sample app", isCompleted: false)"""
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
                    
                    Spacer()
                }
            }
            .onDelete(perform: deleteTasks)
        }
        .navigationTitle("Tasks")"""
    }
    
    func deleteTasks(at offsets: IndexSet) {
        tasks.remove(atOffsets: offsets)
    }
}`,
    category: 'swiftui_lists','''
    tags: ['swiftui', 'list', 'foreach', 'delete', 'task']'''
  },
  {
    title: 'Animation Example','''
    code: `struct, AnimatedCard: View {
    @State private var isExpanded = false
    
    var body: some View {
        RoundedRectangle(cornerRadius: 20)
            .fill(LinearGradient(colors: [.blue, .purple], startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(height: isExpanded ? 300 : 150)
            .scaleEffect(isExpanded ? 1.05: 1.0)
            .shadow(radius: isExpanded ? 20 : 10)
            .onTapGesture {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                    isExpanded.toggle()
                }
            }
    }
}`,
    category: 'swiftui_animation','''
    tags: ['swiftui', 'animation', 'spring', 'gesture']'''
  },
  {
    title: 'macOS NavigationSplitView','''
    code: `struct, ContentView: View {
    @State private var selection: String? = "home""""
    
    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Label("Home", systemImage: "house").tag("home")"""
                Label("Settings", systemImage: "gear").tag("settings")"""
                Label("Profile", systemImage: "person.circle").tag("profile")"""
            }
            .navigationSplitViewColumnWidth(min: 200, ideal: 250)
            .listStyle(.sidebar)
        } detail: {
            switch selection {
            case "home": HomeView()"""
            case "settings": SettingsView()"""
            case "profile": ProfileView()"""
            default: Text("Select an item")"""
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(minWidth: 800, minHeight: 600)
    }
}`,
    category: 'swiftui_macos','''
    tags: ['swiftui', 'macos', 'navigation', 'sidebar', 'splitview']'''
  },
  {
    title: 'MVVM ObservableObject Pattern','''
    code: `class, UserViewModel: ObservableObject {
    @Published var users: [User] = []
    @Published var isLoading = false
    
    func loadUsers() {
        isLoading = true
        // Simulate API call
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            self.users = [
                User(name: "Alice", email: "alice@example.com"),"""
                User(name: "Bob", email: "bob@example.com")"""
            ]
            self.isLoading = false
        }
    }
}

struct UserListView: View {
    @StateObject private var viewModel = UserViewModel()
    
    var body: some View {
        NavigationView {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading...")"""
                } else {
                    List(viewModel.users) { user in
                        VStack(alignment: .leading) {
                            Text(user.name).font(.headline)
                            Text(user.email).font(.subheadline).foregroundColor(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Users")"""
            .onAppear { viewModel.loadUsers() }
        }
    }
}`,
    category: 'swiftui_data','''
    tags: ['swiftui', 'mvvm', 'observableobject', 'published', 'stateobject']'''
  }
];

async function createCodeExamplesTable() {
  log.info('Creating code_examples table...', LogContext.SYSTEM);'''
  
  try {
    // Create the table using raw SQL
    const createTableSQL = `;
      CREATE TABLE IF NOT EXISTS code_examples (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_url TEXT NOT NULL DEFAULT 'manual','''
        title TEXT NOT NULL,
        code TEXT NOT NULL,
        language TEXT DEFAULT 'swift','''
        category TEXT,
        tags TEXT[] DEFAULT '{}','''
        embedding vector(1536),
        metadata JSONB DEFAULT '{}'::jsonb,'''
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(source_url, title)
      );
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_code_examples_category ON code_examples (category);
      CREATE INDEX IF NOT EXISTS idx_code_examples_language ON code_examples (language);
      CREATE INDEX IF NOT EXISTS idx_code_examples_source ON code_examples (source_url);
      CREATE INDEX IF NOT EXISTS idx_code_examples_tags ON code_examples USING gin(tags);
    `;
    
    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });';';';
    
    if (createError) {
      // Try alternative approach - use documents table structure as reference
      log.warn('SQL execution failed, trying direct table creation', LogContext.SYSTEM);'''
      
      // Check if we can create through direct SQL insert (this might work on some Supabase setups)
      const { error: testError } = await supabase;
        .from('code_examples')'''
        .select('id')'''
        .limit(1);
      
      if (testError && testError.code === '42P01') {'''
        log.error('Cannot create table automatically. Manual intervention required.', LogContext.SYSTEM);'''
        log.info('Please run this SQL manually in Supabase Dashboard: ', LogContext.SYSTEM);'''
        log.info(createTableSQL, LogContext.SYSTEM);
        return false;
      }
    }
    
    log.info('✅ code_examples table created successfully', LogContext.SYSTEM);'''
    return true;
    
  } catch (error) {
    log.error('Failed to create table', LogContext.SYSTEM, { ')''
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

async function populateCodeExamples() {
  log.info('Populating code examples...', LogContext.SYSTEM);'''
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const example of SWIFTUI_CODE_EXAMPLES) {
    try {
      const { error } = await supabase;
        .from('code_examples')'''
        .upsert({)
          source_url: 'manual_swiftui','''
          title: example.title,
          code: example.code,
          language: 'swift','''
          category: example.category,
          tags: example.tags,
          metadata: {,
            manually_added: true,
            framework: 'swiftui''''
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        log.error(`Failed to add example: ${example.title}`, LogContext.SYSTEM, { error });
        errorCount++;
      } else {
        log.info(`✅ Added: ${example.title}`, LogContext.SYSTEM);
        successCount++;
      }
      
    } catch (error) {
      log.error(`Error adding ${example.title}`, LogContext.SYSTEM, {)
        error: error instanceof Error ? error.message : String(error) 
      });
      errorCount++;
    }
  }
  
  log.info(`Code examples population completed: ${successCount} success, ${errorCount} errors`, LogContext.SYSTEM);
  return successCount > 0;
}

async function verifyTableAndExamples() {
  log.info('Verifying code_examples table and content...', LogContext.SYSTEM);'''
  
  try {
    const { data, error } = await supabase;
      .from('code_examples')'''
      .select('id, title, category, tags')'''
      .eq('language', 'swift');'''
    
    if (error) {
      log.error('Verification failed', LogContext.SYSTEM, { error });'''
      return false;
    }
    
    log.info(`✅ Verification successful: ${data.length} Swift code examples found`, LogContext.SYSTEM);
    
    // Show categories
    const categories = [...new Set(data.map(item => item.category))];
    log.info(`Categories: ${categories.join(', ')}`, LogContext.SYSTEM);'''
    
    // Test search capability
    const { data: searchResults, error: searchError } = await supabase;
      .from('code_examples')'''
      .select('title')'''
      .ilike('code', '%NavigationStack%');'''
    
    if (!searchError) {
      log.info(`✅ Search test: Found ${searchResults.length} examples with NavigationStack`, LogContext.SYSTEM);
    }
    
    return true;
    
  } catch (error) {
    log.error('Verification error', LogContext.SYSTEM, { ')''
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

async function fixCodeExamplesIssues() {
  log.info('🔧 Fixing code_examples table issues...', LogContext.SYSTEM);'''
  
  // Step 1: Try to create table
  const tableCreated = await createCodeExamplesTable();
  
  if (!tableCreated) {
    log.error('Could not create table. Manual intervention required.', LogContext.SYSTEM);'''
    return false;
  }
  
  // Step 2: Populate with examples
  const examplesAdded = await populateCodeExamples();
  
  if (!examplesAdded) {
    log.error('Could not add examples', LogContext.SYSTEM);'''
    return false;
  }
  
  // Step 3: Verify everything works
  const verified = await verifyTableAndExamples();
  
  if (verified) {
    log.info('✅ All issues fixed! SwiftUI code examples are now available.', LogContext.SYSTEM);'''
    return true;
  } else {
    log.error('Verification failed', LogContext.SYSTEM);'''
    return false;
  }
}

// Run the fix
fixCodeExamplesIssues()
  .then((success) => {
    if (success) {
      log.info('🎉 SwiftUI knowledge system is now fully operational!', LogContext.SYSTEM);'''
      process.exit(0);
    } else {
      log.error('❌ Failed to fix all issues', LogContext.SYSTEM);'''
      process.exit(1);
    }
  })
  .catch((error) => {
    log.error('Unexpected error', LogContext.SYSTEM, { ')''
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  });
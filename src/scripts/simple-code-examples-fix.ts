#!/usr/bin/env tsx

/**
 * Simple Code Examples Fix
 * Store SwiftUI examples in documents table as fallback since code_examples table has issues
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '../utils/logger.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

return undefined;


const supabase = createClient(supabaseUrl, supabaseKey);

async function storeExamplesInDocuments() {
  log.info('Storing SwiftUI examples in documents table...', LogContext.SYSTEM);
  
  const examples = [
    {
      name: 'SwiftUI NavigationStack Example',
      content: `struct NavigationExample: View {
    @State private var path = NavigationPath()
    
    var body: some View {
        NavigationStack(path: $path) {
            List {
                ForEach(1...10, id: \\.self) { number in
                    NavigationLink("Item \\(number)", value: number)
                }
            }
            .navigationTitle("Items")
            .navigationDestination(for: Int.self) { number in
                DetailView(number: number, path: $path)
            }
        }
    }
}`,
      tags: ['swiftui', 'navigation', 'example']
    },
    {
      name: 'SwiftUI macOS Sidebar Example',
      content: `struct ContentView: View {
    @State private var selection: String? = "home"
    
    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Label("Home", systemImage: "house").tag("home")
                Label("Settings", systemImage: "gear").tag("settings")
            }
            .listStyle(.sidebar)
        } detail: {
            switch selection {
            case "home": HomeView()
            case "settings": SettingsView()
            default: Text("Select an item")
            }
        }
    }
}`,
      tags: ['swiftui', 'macos', 'sidebar', 'example']
    }
  ];
  
  for (const example of examples) {
    const { error } = await supabase
      .from('documents')
      .upsert({
        name: example.name,
        path: `swiftui_examples/${example.name.toLowerCase().replace(/\s+/g, '_')}`,
        content: example.content,
        content_type: 'text/swift',
        tags: example.tags,
        metadata: {
          doc_type: 'swiftui_example',
          language: 'swift'
        }
      });
    
    if (error) {
      log.error(`Failed to store ${example.name}`, LogContext.SYSTEM, { error });
    } else {
      log.info(`✅ Stored: ${example.name}`, LogContext.SYSTEM);
    }
  }
}

storeExamplesInDocuments()
  .then(() => {
    log.info('SwiftUI examples stored successfully', LogContext.SYSTEM);
    process.exit(0);
  })
  .catch((error) => {
    log.error('Failed to store examples', LogContext.SYSTEM, { error: error.message });
    process.exit(1);
  });
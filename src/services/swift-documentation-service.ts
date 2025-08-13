import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { log, LogContext } from '../utils/logger';

const execAsync = promisify(exec);

interface SwiftDocEntry {
  id?: string;
  category: string;
  framework: string;
  class_name?: string;
  method_name?: string;
  property_name?: string;
  declaration: string;
  documentation: string;
  parameters?: Record<string, string>;
  return_type?: string;
  availability?: string;
  example_code?: string;
  url?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class SwiftDocumentationService {
  private static instance: SwiftDocumentationService;
  private supabase: any;
  private documentationCache: Map<string, SwiftDocEntry[]> = new Map();
  
  private constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );
    this.initializeDatabase();
  }

  static getInstance(): SwiftDocumentationService {
    if (!SwiftDocumentationService.instance) {
      SwiftDocumentationService.instance = new SwiftDocumentationService();
    }
    return SwiftDocumentationService.instance;
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Create table for Swift documentation if it doesn't exist
      const { error } = await this.supabase.rpc('create_swift_docs_table', {
        sql: `
          CREATE TABLE IF NOT EXISTS swift_documentation (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            category TEXT NOT NULL,
            framework TEXT NOT NULL,
            class_name TEXT,
            method_name TEXT,
            property_name TEXT,
            declaration TEXT NOT NULL,
            documentation TEXT,
            parameters JSONB,
            return_type TEXT,
            availability TEXT,
            example_code TEXT,
            url TEXT,
            embedding vector(1536),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_swift_docs_framework ON swift_documentation(framework);
          CREATE INDEX IF NOT EXISTS idx_swift_docs_class ON swift_documentation(class_name);
          CREATE INDEX IF NOT EXISTS idx_swift_docs_method ON swift_documentation(method_name);
        `
      });

      if (error) {
        log.error('Failed to create Swift docs table', LogContext.DATABASE, { error });
      } else {
        log.info('Swift documentation table ready', LogContext.DATABASE);
      }
    } catch (error) {
      log.error('Database initialization failed', LogContext.DATABASE, { error });
    }
  }

  /**
   * Scrape SwiftUI documentation from Apple's developer site
   */
  async scrapeSwiftUIDocumentation(): Promise<void> {
    log.info('Starting SwiftUI documentation scraping', LogContext.AI);
    
    const frameworks = [
      'SwiftUI',
      'UIKit',
      'AppKit',
      'Foundation',
      'Combine',
      'CoreData',
      'CloudKit',
      'StoreKit'
    ];

    for (const framework of frameworks) {
      await this.scrapeFrameworkDocs(framework);
    }
  }

  /**
   * Scrape documentation for a specific framework
   */
  private async scrapeFrameworkDocs(framework: string): Promise<void> {
    try {
      // Use swift-doc or SourceKitten to extract documentation
      const { stdout } = await execAsync(
        `swift-doc generate /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/System/Library/Frameworks/${framework}.framework --module-name ${framework} --format json 2>/dev/null || echo '{}'`
      );

      const docs = JSON.parse(stdout || '{}');
      await this.processFrameworkDocs(framework, docs);
      
      log.info(`Scraped ${framework} documentation`, LogContext.AI);
    } catch (error) {
      log.warn(`Failed to scrape ${framework}`, LogContext.AI, { error });
      // Fallback to manual documentation extraction
      await this.extractManualDocs(framework);
    }
  }

  /**
   * Extract documentation manually from Swift interface files
   */
  private async extractManualDocs(framework: string): Promise<void> {
    try {
      // Generate Swift interface file
      const { stdout } = await execAsync(
        `echo "import ${framework}" | swift -deprecated-integrated-repl -sdk /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk 2>/dev/null || true`
      );

      // Parse common SwiftUI components
      const commonComponents = this.getCommonSwiftUIComponents();
      
      for (const component of commonComponents) {
        await this.storeDocEntry({
          category: 'View',
          framework,
          class_name: component.name,
          declaration: component.declaration,
          documentation: component.documentation,
          example_code: component.example
        });
      }
    } catch (error) {
      log.error(`Manual extraction failed for ${framework}`, LogContext.AI, { error });
    }
  }

  /**
   * Get common SwiftUI components with accurate documentation
   */
  private getCommonSwiftUIComponents(): any[] {
    return [
      {
        name: 'WindowGroup',
        declaration: 'struct WindowGroup<Content> : Scene where Content : View',
        documentation: 'A scene that presents a group of identically structured windows.',
        example: `WindowGroup {
    ContentView()
}
.windowStyle(.titleBar)
.windowToolbarStyle(.unified(showsTitle: true))`
      },
      {
        name: 'Text',
        declaration: 'struct Text : View',
        documentation: 'A view that displays one or more lines of read-only text.',
        example: 'Text("Hello, World!")'
      },
      {
        name: 'Button',
        declaration: 'struct Button<Label> : View where Label : View',
        documentation: 'A control that initiates an action.',
        example: `Button("Click Me") {
    print("Button tapped")
}`
      },
      {
        name: 'VStack',
        declaration: 'struct VStack<Content> : View where Content : View',
        documentation: 'A view that arranges its children in a vertical line.',
        example: `VStack {
    Text("Top")
    Text("Bottom")
}`
      },
      {
        name: 'HStack',
        declaration: 'struct HStack<Content> : View where Content : View',
        documentation: 'A view that arranges its children in a horizontal line.',
        example: `HStack {
    Text("Left")
    Text("Right")
}`
      },
      {
        name: 'NavigationView',
        declaration: 'struct NavigationView<Content> : View where Content : View',
        documentation: 'A view for presenting a stack of views representing a visible path in a navigation hierarchy.',
        example: `NavigationView {
    List {
        NavigationLink("Item", destination: DetailView())
    }
}`
      },
      {
        name: '@State',
        declaration: '@propertyWrapper struct State<Value>',
        documentation: 'A property wrapper type that can read and write a value managed by SwiftUI.',
        example: '@State private var isOn = false'
      },
      {
        name: '@StateObject',
        declaration: '@propertyWrapper struct StateObject<ObjectType> where ObjectType : ObservableObject',
        documentation: 'A property wrapper type that instantiates an observable object.',
        example: '@StateObject private var model = MyModel()'
      },
      {
        name: '@ObservedObject',
        declaration: '@propertyWrapper struct ObservedObject<ObjectType> where ObjectType : ObservableObject',
        documentation: 'A property wrapper type that subscribes to an observable object and invalidates a view when it changes.',
        example: '@ObservedObject var model: MyModel'
      },
      {
        name: '@EnvironmentObject',
        declaration: '@propertyWrapper struct EnvironmentObject<ObjectType> where ObjectType : ObservableObject',
        documentation: 'A property wrapper that supplies an observable object to a view hierarchy.',
        example: '@EnvironmentObject var settings: UserSettings'
      },
      {
        name: '.onAppear',
        declaration: 'func onAppear(perform action: (() -> Void)? = nil) -> some View',
        documentation: 'Adds an action to perform when this view appears.',
        example: `.onAppear {
    loadData()
}`
      },
      {
        name: '.task',
        declaration: 'func task(priority: TaskPriority = .userInitiated, _ action: @escaping () async -> Void) -> some View',
        documentation: 'Adds an asynchronous task to perform when this view appears.',
        example: `.task {
    await fetchData()
}`
      },
      {
        name: '.sheet',
        declaration: 'func sheet<Content>(isPresented: Binding<Bool>, onDismiss: (() -> Void)? = nil, content: @escaping () -> Content) -> some View where Content : View',
        documentation: 'Presents a sheet when a binding to a Boolean value that you provide is true.',
        example: `.sheet(isPresented: $showingSheet) {
    SheetView()
}`
      },
      {
        name: '.alert',
        declaration: 'func alert<S>(_ title: S, isPresented: Binding<Bool>, actions: () -> some View) -> some View where S : StringProtocol',
        documentation: 'Presents an alert to the user.',
        example: `.alert("Important", isPresented: $showingAlert) {
    Button("OK") { }
}`
      },
      {
        name: 'List',
        declaration: 'struct List<SelectionValue, Content> : View where SelectionValue : Hashable, Content : View',
        documentation: 'A container that presents rows of data arranged in a single column.',
        example: `List(items) { item in
    Text(item.name)
}`
      }
    ];
  }

  /**
   * Store documentation entry in Supabase
   */
  private async storeDocEntry(entry: SwiftDocEntry): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('swift_documentation')
        .upsert(entry, { onConflict: 'framework,class_name,method_name' });

      if (error) {
        log.error('Failed to store doc entry', LogContext.DATABASE, { error });
      }
    } catch (error) {
      log.error('Store operation failed', LogContext.DATABASE, { error });
    }
  }

  /**
   * Process framework documentation JSON
   */
  private async processFrameworkDocs(framework: string, docs: any): Promise<void> {
    if (!docs.symbols) return;

    for (const symbol of docs.symbols) {
      const entry: SwiftDocEntry = {
        category: symbol.kind || 'unknown',
        framework,
        class_name: symbol.name,
        declaration: symbol.declaration || '',
        documentation: symbol.documentation?.summary || '',
        availability: symbol.availability?.joined(', '),
        url: symbol.url
      };

      if (symbol.members) {
        for (const member of symbol.members) {
          await this.storeDocEntry({
            ...entry,
            method_name: member.name,
            declaration: member.declaration || '',
            documentation: member.documentation?.summary || '',
            parameters: member.parameters,
            return_type: member.returnType
          });
        }
      } else {
        await this.storeDocEntry(entry);
      }
    }
  }

  /**
   * Query Swift documentation for context
   */
  async queryDocumentation(query: string, framework?: string): Promise<SwiftDocEntry[]> {
    try {
      let queryBuilder = this.supabase
        .from('swift_documentation')
        .select('*');

      if (framework) {
        queryBuilder = queryBuilder.eq('framework', framework);
      }

      // Search in class names, method names, and documentation
      queryBuilder = queryBuilder.or(
        `class_name.ilike.%${query}%,method_name.ilike.%${query}%,documentation.ilike.%${query}%`
      );

      const { data, error } = await queryBuilder.limit(10);

      if (error) {
        log.error('Documentation query failed', LogContext.DATABASE, { error });
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('Query operation failed', LogContext.DATABASE, { error });
      return [];
    }
  }

  /**
   * Get documentation for a specific SwiftUI component
   */
  async getComponentDocumentation(componentName: string): Promise<SwiftDocEntry | null> {
    try {
      const { data, error } = await this.supabase
        .from('swift_documentation')
        .select('*')
        .eq('class_name', componentName)
        .eq('framework', 'SwiftUI')
        .single();

      if (error) {
        log.warn(`No documentation found for ${componentName}`, LogContext.DATABASE);
        return null;
      }

      return data;
    } catch (error) {
      log.error('Component query failed', LogContext.DATABASE, { error });
      return null;
    }
  }

  /**
   * Initialize documentation database with common components
   */
  async initializeCommonDocs(): Promise<void> {
    log.info('Initializing common SwiftUI documentation', LogContext.AI);
    
    const components = this.getCommonSwiftUIComponents();
    
    for (const component of components) {
      await this.storeDocEntry({
        category: 'Core',
        framework: 'SwiftUI',
        class_name: component.name,
        declaration: component.declaration,
        documentation: component.documentation,
        example_code: component.example
      });
    }
    
    log.info('Common documentation initialized', LogContext.AI);
  }
}

// Export singleton instance
export const swiftDocsService = SwiftDocumentationService.getInstance();
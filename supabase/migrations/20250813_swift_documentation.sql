-- Create Swift documentation table
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

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_swift_docs_framework ON swift_documentation(framework);
CREATE INDEX IF NOT EXISTS idx_swift_docs_class ON swift_documentation(class_name);
CREATE INDEX IF NOT EXISTS idx_swift_docs_method ON swift_documentation(method_name);
CREATE INDEX IF NOT EXISTS idx_swift_docs_search ON swift_documentation USING gin(to_tsvector('english', 
    COALESCE(class_name, '') || ' ' || 
    COALESCE(method_name, '') || ' ' || 
    COALESCE(documentation, '')
));

-- Create function to search Swift documentation
CREATE OR REPLACE FUNCTION search_swift_docs(
    search_query TEXT,
    search_framework TEXT DEFAULT NULL,
    max_results INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    category TEXT,
    framework TEXT,
    class_name TEXT,
    method_name TEXT,
    declaration TEXT,
    documentation TEXT,
    example_code TEXT,
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sd.id,
        sd.category,
        sd.framework,
        sd.class_name,
        sd.method_name,
        sd.declaration,
        sd.documentation,
        sd.example_code,
        ts_rank(
            to_tsvector('english', 
                COALESCE(sd.class_name, '') || ' ' || 
                COALESCE(sd.method_name, '') || ' ' || 
                COALESCE(sd.documentation, '')
            ),
            plainto_tsquery('english', search_query)
        ) AS relevance
    FROM swift_documentation sd
    WHERE 
        (search_framework IS NULL OR sd.framework = search_framework)
        AND to_tsvector('english', 
            COALESCE(sd.class_name, '') || ' ' || 
            COALESCE(sd.method_name, '') || ' ' || 
            COALESCE(sd.documentation, '')
        ) @@ plainto_tsquery('english', search_query)
    ORDER BY relevance DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Insert common SwiftUI documentation
INSERT INTO swift_documentation (category, framework, class_name, declaration, documentation, example_code)
VALUES 
    ('Scene', 'SwiftUI', 'WindowGroup', 
     'struct WindowGroup<Content> : Scene where Content : View',
     'A scene that presents a group of identically structured windows.',
     'WindowGroup {\n    ContentView()\n}\n.windowStyle(.titleBar)\n.windowToolbarStyle(.unified(showsTitle: true))'),
    
    ('View', 'SwiftUI', 'Text',
     'struct Text : View',
     'A view that displays one or more lines of read-only text.',
     'Text("Hello, World!")'),
    
    ('View', 'SwiftUI', 'Button',
     'struct Button<Label> : View where Label : View',
     'A control that initiates an action.',
     'Button("Click Me") {\n    print("Button tapped")\n}'),
    
    ('Container', 'SwiftUI', 'VStack',
     'struct VStack<Content> : View where Content : View',
     'A view that arranges its children in a vertical line.',
     'VStack {\n    Text("Top")\n    Text("Bottom")\n}'),
    
    ('Container', 'SwiftUI', 'HStack',
     'struct HStack<Content> : View where Content : View',
     'A view that arranges its children in a horizontal line.',
     'HStack {\n    Text("Left")\n    Text("Right")\n}'),
    
    ('PropertyWrapper', 'SwiftUI', '@State',
     '@propertyWrapper struct State<Value>',
     'A property wrapper type that can read and write a value managed by SwiftUI.',
     '@State private var isOn = false'),
    
    ('PropertyWrapper', 'SwiftUI', '@StateObject',
     '@propertyWrapper struct StateObject<ObjectType> where ObjectType : ObservableObject',
     'A property wrapper type that instantiates an observable object.',
     '@StateObject private var model = MyModel()'),
    
    ('PropertyWrapper', 'SwiftUI', '@ObservedObject',
     '@propertyWrapper struct ObservedObject<ObjectType> where ObjectType : ObservableObject',
     'A property wrapper type that subscribes to an observable object and invalidates a view when it changes.',
     '@ObservedObject var model: MyModel'),
    
    ('PropertyWrapper', 'SwiftUI', '@EnvironmentObject',
     '@propertyWrapper struct EnvironmentObject<ObjectType> where ObjectType : ObservableObject',
     'A property wrapper that supplies an observable object to a view''s hierarchy.',
     '@EnvironmentObject var settings: UserSettings'),
    
    ('ViewModifier', 'SwiftUI', 'onAppear',
     'func onAppear(perform action: (() -> Void)? = nil) -> some View',
     'Adds an action to perform when this view appears.',
     '.onAppear {\n    loadData()\n}'),
    
    ('ViewModifier', 'SwiftUI', 'task',
     'func task(priority: TaskPriority = .userInitiated, _ action: @escaping () async -> Void) -> some View',
     'Adds an asynchronous task to perform when this view appears.',
     '.task {\n    await fetchData()\n}'),
    
    ('ViewModifier', 'SwiftUI', 'sheet',
     'func sheet<Content>(isPresented: Binding<Bool>, onDismiss: (() -> Void)? = nil, content: @escaping () -> Content) -> some View where Content : View',
     'Presents a sheet when a binding to a Boolean value that you provide is true.',
     '.sheet(isPresented: $showingSheet) {\n    SheetView()\n}'),
    
    ('Container', 'SwiftUI', 'List',
     'struct List<SelectionValue, Content> : View where SelectionValue : Hashable, Content : View',
     'A container that presents rows of data arranged in a single column.',
     'List(items) { item in\n    Text(item.name)\n}')
ON CONFLICT DO NOTHING;

-- Grant access to authenticated users
GRANT SELECT ON swift_documentation TO authenticated;
GRANT SELECT ON swift_documentation TO anon;
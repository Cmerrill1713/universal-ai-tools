-- Create AI Library Documentation Storage Tables
-- This migration creates tables for storing scraped documentation from AI libraries and frameworks

-- Create enum for documentation types
DO $$ BEGIN
  CREATE TYPE doc_type AS ENUM (
    'readme',
    'getting_started',
    'api_reference',
    'tutorial',
    'example',
    'changelog',
    'migration_guide',
    'configuration',
    'troubleshooting',
    'best_practices'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for library categories
DO $$ BEGIN
  CREATE TYPE library_category AS ENUM (
    'llm',
    'computer_vision',
    'nlp',
    'ml_framework',
    'automation',
    'research',
    'data_processing',
    'deployment',
    'monitoring',
    'ui_framework'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main table for AI libraries and frameworks
CREATE TABLE IF NOT EXISTS ai_libraries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  category library_category NOT NULL,
  language VARCHAR(50) NOT NULL,
  description TEXT,
  homepage VARCHAR(500),
  repository VARCHAR(500),
  documentation_url VARCHAR(500),
  stars INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0.0,
  last_updated TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Installation methods
  installation JSONB DEFAULT '{}',
  
  -- Features and tags
  features TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Documentation content table
CREATE TABLE IF NOT EXISTS library_documentation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  library_id UUID NOT NULL REFERENCES ai_libraries(id) ON DELETE CASCADE,
  doc_type doc_type NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  markdown_content TEXT,
  html_content TEXT,
  url VARCHAR(1000),
  version VARCHAR(50),
  language VARCHAR(10) DEFAULT 'en',
  
  -- Search optimization
  search_vector tsvector,
  
  -- Timestamps
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique documentation per library, type, and version
  UNIQUE(library_id, doc_type, version, language)
);

-- Code examples table
CREATE TABLE IF NOT EXISTS library_code_examples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  library_id UUID NOT NULL REFERENCES ai_libraries(id) ON DELETE CASCADE,
  documentation_id UUID REFERENCES library_documentation(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  language VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API endpoints table for framework documentation
CREATE TABLE IF NOT EXISTS library_api_endpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  library_id UUID NOT NULL REFERENCES ai_libraries(id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10),
  description TEXT,
  parameters JSONB DEFAULT '{}',
  response_schema JSONB DEFAULT '{}',
  example_request TEXT,
  example_response TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scraping metadata table
CREATE TABLE IF NOT EXISTS documentation_scraping_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  library_id UUID REFERENCES ai_libraries(id) ON DELETE CASCADE,
  url VARCHAR(1000) NOT NULL,
  status VARCHAR(50) NOT NULL,
  pages_scraped INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_libraries_category ON ai_libraries(category);
CREATE INDEX IF NOT EXISTS idx_ai_libraries_language ON ai_libraries(language);
CREATE INDEX IF NOT EXISTS idx_ai_libraries_name ON ai_libraries(name);

CREATE INDEX IF NOT EXISTS idx_library_documentation_library_id ON library_documentation(library_id);
CREATE INDEX IF NOT EXISTS idx_library_documentation_doc_type ON library_documentation(doc_type);
CREATE INDEX IF NOT EXISTS idx_library_documentation_search_vector ON library_documentation USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_library_code_examples_library_id ON library_code_examples(library_id);
CREATE INDEX IF NOT EXISTS idx_library_code_examples_language ON library_code_examples(language);

CREATE INDEX IF NOT EXISTS idx_library_api_endpoints_library_id ON library_api_endpoints(library_id);

-- Create full-text search trigger
CREATE OR REPLACE FUNCTION update_documentation_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documentation_search_vector_trigger
BEFORE INSERT OR UPDATE ON library_documentation
FOR EACH ROW
EXECUTE FUNCTION update_documentation_search_vector();

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_libraries_updated_at
BEFORE UPDATE ON ai_libraries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_documentation_updated_at
BEFORE UPDATE ON library_documentation
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_code_examples_updated_at
BEFORE UPDATE ON library_code_examples
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_api_endpoints_updated_at
BEFORE UPDATE ON library_api_endpoints
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert initial Swift libraries data
INSERT INTO ai_libraries (name, display_name, category, language, description, homepage, repository, documentation_url, stars, rating, features, tags, installation)
VALUES 
  ('swiftanthropic', 'SwiftAnthropic', 'llm', 'Swift', 'Native Swift SDK for Claude AI integration with async/await support', 
   'https://github.com/jcalderita/swiftanthropic', 'https://github.com/jcalderita/swiftanthropic', 
   'https://github.com/jcalderita/swiftanthropic/blob/main/README.md', 850, 4.8,
   ARRAY['Native Swift implementation', 'Async/await support', 'Type-safe API', 'SwiftUI integration'],
   ARRAY['ai', 'claude', 'anthropic', 'llm', 'swift'],
   '{"spm": ".package(url: \"https://github.com/jcalderita/swiftanthropic.git\", from: \"1.0.0\")"}'::jsonb),
   
  ('pow', 'Pow', 'ui_framework', 'Swift', 'Delightful SwiftUI effects and animations for iOS/macOS apps', 
   'https://github.com/EmergeTools/Pow', 'https://github.com/EmergeTools/Pow', 
   'https://movingparts.io/pow', 5200, 4.9,
   ARRAY['50+ built-in effects', 'Particle systems', 'Sound effects', 'Haptic feedback', 'Change effects'],
   ARRAY['animation', 'effects', 'swiftui', 'particles', 'ui'],
   '{"spm": ".package(url: \"https://github.com/EmergeTools/Pow\", from: \"1.0.0\")"}'::jsonb),
   
  ('vortex', 'Vortex', 'ui_framework', 'Swift', 'High-performance particle effects for SwiftUI', 
   'https://github.com/twostraws/Vortex', 'https://github.com/twostraws/Vortex', 
   'https://github.com/twostraws/Vortex/blob/main/README.md', 1200, 4.7,
   ARRAY['GPU-accelerated rendering', 'Customizable particle systems', 'SwiftUI native', 'Low memory footprint'],
   ARRAY['particles', 'effects', 'swiftui', 'animation', 'performance'],
   '{"spm": ".package(url: \"https://github.com/twostraws/Vortex\", from: \"1.0.0\")"}'::jsonb),
   
  ('createml', 'CreateML', 'ml_framework', 'Swift', 'Apple''s framework for training custom machine learning models', 
   'https://developer.apple.com/documentation/createml', 'https://github.com/apple/coremltools', 
   'https://developer.apple.com/documentation/createml', 3800, 4.6,
   ARRAY['On-device training', 'Core ML integration', 'Transfer learning', 'No code model training'],
   ARRAY['ml', 'training', 'coreml', 'apple', 'on-device'],
   '{"spm": "import CreateML // Built into Xcode"}'::jsonb),
   
  ('swiftui-navigation', 'SwiftUI Navigation', 'ui_framework', 'Swift', 'Tools for making SwiftUI navigation simpler, more ergonomic and more precise', 
   'https://github.com/pointfreeco/swiftui-navigation', 'https://github.com/pointfreeco/swiftui-navigation', 
   'https://pointfreeco.github.io/swiftui-navigation', 2100, 4.5,
   ARRAY['Type-safe navigation', 'Deep linking support', 'Navigation state management', 'Testing utilities'],
   ARRAY['navigation', 'swiftui', 'routing', 'architecture'],
   '{"spm": ".package(url: \"https://github.com/pointfreeco/swiftui-navigation\", from: \"1.0.0\")"}'::jsonb);

-- Insert initial AI frameworks data
INSERT INTO ai_libraries (name, display_name, category, language, description, homepage, repository, documentation_url, stars, rating, features, tags, installation)
VALUES 
  ('langchain', 'LangChain', 'llm', 'Python', 'Building applications with LLMs through composability', 
   'https://langchain.com', 'https://github.com/langchain-ai/langchain', 
   'https://python.langchain.com/docs', 95000, 4.7,
   ARRAY['LLM chains', 'Agents', 'Memory management', 'Vector stores', 'Document loaders'],
   ARRAY['llm', 'chains', 'agents', 'rag', 'python'],
   '{"pip": "pip install langchain", "npm": "npm install langchain"}'::jsonb),
   
  ('huggingface-transformers', 'Transformers', 'ml_framework', 'Python', 'State-of-the-art Machine Learning for PyTorch, TensorFlow, and JAX', 
   'https://huggingface.co/transformers', 'https://github.com/huggingface/transformers', 
   'https://huggingface.co/docs/transformers', 134000, 4.9,
   ARRAY['Pre-trained models', 'Fine-tuning', 'Multi-modal support', 'Model hub integration'],
   ARRAY['transformers', 'nlp', 'cv', 'multimodal', 'python'],
   '{"pip": "pip install transformers", "npm": "npm install @xenova/transformers"}'::jsonb),
   
  ('autogen', 'AutoGen', 'automation', 'Python', 'Multi-agent conversational framework by Microsoft', 
   'https://microsoft.github.io/autogen', 'https://github.com/microsoft/autogen', 
   'https://microsoft.github.io/autogen/docs', 32000, 4.6,
   ARRAY['Multi-agent orchestration', 'Code execution', 'Human-in-the-loop', 'Customizable agents'],
   ARRAY['agents', 'automation', 'microsoft', 'llm', 'python'],
   '{"pip": "pip install pyautogen"}'::jsonb),
   
  ('dspy', 'DSPy', 'research', 'Python', 'Framework for algorithmically optimizing LM prompts and weights', 
   'https://dspy-docs.vercel.app', 'https://github.com/stanfordnlp/dspy', 
   'https://dspy-docs.vercel.app', 18500, 4.8,
   ARRAY['Prompt optimization', 'Automatic few-shot learning', 'Modular LM programs', 'Optimizers'],
   ARRAY['prompting', 'optimization', 'research', 'stanford', 'python'],
   '{"pip": "pip install dspy-ai"}'::jsonb);

-- Create RLS policies
ALTER TABLE ai_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_code_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_api_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentation_scraping_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to libraries" ON ai_libraries
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to documentation" ON library_documentation
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to code examples" ON library_code_examples
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to api endpoints" ON library_api_endpoints
  FOR SELECT USING (true);

-- Allow authenticated users to manage documentation
CREATE POLICY "Allow authenticated users to insert libraries" ON ai_libraries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update libraries" ON ai_libraries
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert documentation" ON library_documentation
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update documentation" ON library_documentation
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert code examples" ON library_code_examples
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert api endpoints" ON library_api_endpoints
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert scraping logs" ON documentation_scraping_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
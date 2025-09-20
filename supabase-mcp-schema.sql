-- Supabase MCP Server Database Schema
-- Created for Universal AI Tools Supabase MCP Integration

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Context Data Table
CREATE TABLE IF NOT EXISTS public.mcp_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    category VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    embedding VECTOR(1536), -- OpenAI embedding dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Code Patterns Table
CREATE TABLE IF NOT EXISTS public.mcp_code_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_type VARCHAR(255) NOT NULL,
    before_code TEXT NOT NULL,
    after_code TEXT NOT NULL,
    description TEXT NOT NULL,
    success_rate DECIMAL(5,2) DEFAULT 0.0,
    error_types TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Task Progress Table
CREATE TABLE IF NOT EXISTS public.mcp_task_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Error Analysis Table
CREATE TABLE IF NOT EXISTS public.mcp_error_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    error_type VARCHAR(255) NOT NULL,
    error_message TEXT NOT NULL,
    file_path VARCHAR(500),
    line_number INTEGER,
    solution_pattern TEXT,
    frequency INTEGER DEFAULT 1,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mcp_context_category ON public.mcp_context(category);
CREATE INDEX IF NOT EXISTS idx_mcp_context_timestamp ON public.mcp_context(timestamp);
CREATE INDEX IF NOT EXISTS idx_mcp_context_embedding ON public.mcp_context USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_mcp_code_patterns_type ON public.mcp_code_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_mcp_code_patterns_error_types ON public.mcp_code_patterns USING gin(error_types);

CREATE INDEX IF NOT EXISTS idx_mcp_task_progress_task_id ON public.mcp_task_progress(task_id);
CREATE INDEX IF NOT EXISTS idx_mcp_task_progress_status ON public.mcp_task_progress(status);

CREATE INDEX IF NOT EXISTS idx_mcp_error_analysis_type ON public.mcp_error_analysis(error_type);
CREATE INDEX IF NOT EXISTS idx_mcp_error_analysis_file_path ON public.mcp_error_analysis(file_path);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_mcp_context_updated_at BEFORE UPDATE ON public.mcp_context FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mcp_code_patterns_updated_at BEFORE UPDATE ON public.mcp_code_patterns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mcp_task_progress_updated_at BEFORE UPDATE ON public.mcp_task_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mcp_error_analysis_updated_at BEFORE UPDATE ON public.mcp_error_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.mcp_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_code_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_error_analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now, can be restricted later)
CREATE POLICY "Allow all operations on mcp_context" ON public.mcp_context FOR ALL USING (true);
CREATE POLICY "Allow all operations on mcp_code_patterns" ON public.mcp_code_patterns FOR ALL USING (true);
CREATE POLICY "Allow all operations on mcp_task_progress" ON public.mcp_task_progress FOR ALL USING (true);
CREATE POLICY "Allow all operations on mcp_error_analysis" ON public.mcp_error_analysis FOR ALL USING (true);

-- Insert some sample data for testing
INSERT INTO public.mcp_context (content, category, metadata) VALUES 
('MCP integration test data', 'test', '{"source": "mcp_test", "status": "success"}'),
('Supabase MCP server configuration', 'config', '{"version": "2.0.0", "status": "active"}')
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT ALL ON public.mcp_context TO postgres;
GRANT ALL ON public.mcp_code_patterns TO postgres;
GRANT ALL ON public.mcp_task_progress TO postgres;
GRANT ALL ON public.mcp_error_analysis TO postgres;

-- Grant permissions to authenticated users
GRANT ALL ON public.mcp_context TO authenticated;
GRANT ALL ON public.mcp_code_patterns TO authenticated;
GRANT ALL ON public.mcp_task_progress TO authenticated;
GRANT ALL ON public.mcp_error_analysis TO authenticated;

-- Grant permissions to anon users (for local development)
GRANT ALL ON public.mcp_context TO anon;
GRANT ALL ON public.mcp_code_patterns TO anon;
GRANT ALL ON public.mcp_task_progress TO anon;
GRANT ALL ON public.mcp_error_analysis TO anon;


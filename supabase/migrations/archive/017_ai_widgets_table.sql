-- Create table for storing AI-generated widgets
CREATE TABLE IF NOT EXISTS ai_widgets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    component_code TEXT NOT NULL,
    styles TEXT,
    tests TEXT,
    documentation TEXT NOT NULL,
    dependencies JSONB DEFAULT '[]'::JSONB,
    prop_interface TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_ai_widgets_created_by ON ai_widgets(created_by);
CREATE INDEX idx_ai_widgets_created_at ON ai_widgets(created_at DESC);
CREATE INDEX idx_ai_widgets_name ON ai_widgets(name);

-- Add RLS policies
ALTER TABLE ai_widgets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own widgets
CREATE POLICY "Users can view own widgets" ON ai_widgets
    FOR SELECT
    USING (created_by = auth.uid()::text);

-- Policy: Users can create widgets
CREATE POLICY "Users can create widgets" ON ai_widgets
    FOR INSERT
    WITH CHECK (created_by = auth.uid()::text);

-- Policy: Users can update their own widgets
CREATE POLICY "Users can update own widgets" ON ai_widgets
    FOR UPDATE
    USING (created_by = auth.uid()::text)
    WITH CHECK (created_by = auth.uid()::text);

-- Policy: Users can delete their own widgets
CREATE POLICY "Users can delete own widgets" ON ai_widgets
    FOR DELETE
    USING (created_by = auth.uid()::text);

-- Add comments
COMMENT ON TABLE ai_widgets IS 'Stores AI-generated React components created through Sweet Athena widget creator';
COMMENT ON COLUMN ai_widgets.component_code IS 'The complete React component code with TypeScript';
COMMENT ON COLUMN ai_widgets.styles IS 'CSS or styled-components styles for the widget';
COMMENT ON COLUMN ai_widgets.tests IS 'Jest/React Testing Library test code';
COMMENT ON COLUMN ai_widgets.dependencies IS 'NPM package dependencies required by the widget';
COMMENT ON COLUMN ai_widgets.prop_interface IS 'TypeScript interface definition for component props';
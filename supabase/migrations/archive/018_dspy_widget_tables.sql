-- DSPy Widget Orchestration Tables
-- Tables for tracking AI-generated widgets created through DSPy orchestration

-- Create table for storing DSPy-generated widgets
CREATE TABLE IF NOT EXISTS ai_generated_widgets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    code TEXT NOT NULL,
    tests TEXT,
    design JSONB NOT NULL,
    requirements JSONB NOT NULL,
    metadata JSONB NOT NULL,
    service_id TEXT NOT NULL,
    parent_widget_id UUID REFERENCES ai_generated_widgets(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for tracking widget generation requests
CREATE TABLE IF NOT EXISTS ai_widget_generations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    service_id TEXT NOT NULL,
    description TEXT NOT NULL,
    functionality TEXT[],
    constraints TEXT[],
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    widget_data JSONB,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create table for tracking widget improvement history
CREATE TABLE IF NOT EXISTS ai_widget_improvements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    original_widget_id UUID NOT NULL REFERENCES ai_generated_widgets(id),
    improved_widget_id UUID NOT NULL REFERENCES ai_generated_widgets(id),
    improvement_request TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for widget usage analytics
CREATE TABLE IF NOT EXISTS ai_widget_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    widget_id UUID NOT NULL REFERENCES ai_generated_widgets(id),
    service_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('view', 'copy', 'download', 'implement', 'modify')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_ai_generated_widgets_service_id ON ai_generated_widgets(service_id);
CREATE INDEX idx_ai_generated_widgets_created_at ON ai_generated_widgets(created_at DESC);
CREATE INDEX idx_ai_generated_widgets_name ON ai_generated_widgets(name);
CREATE INDEX idx_ai_generated_widgets_parent ON ai_generated_widgets(parent_widget_id);

CREATE INDEX idx_ai_widget_generations_service_id ON ai_widget_generations(service_id);
CREATE INDEX idx_ai_widget_generations_status ON ai_widget_generations(status);
CREATE INDEX idx_ai_widget_generations_created_at ON ai_widget_generations(created_at DESC);

CREATE INDEX idx_ai_widget_improvements_original ON ai_widget_improvements(original_widget_id);
CREATE INDEX idx_ai_widget_improvements_improved ON ai_widget_improvements(improved_widget_id);

CREATE INDEX idx_ai_widget_usage_widget_id ON ai_widget_usage(widget_id);
CREATE INDEX idx_ai_widget_usage_service_id ON ai_widget_usage(service_id);
CREATE INDEX idx_ai_widget_usage_action ON ai_widget_usage(action);

-- Add full-text search
ALTER TABLE ai_generated_widgets ADD COLUMN search_vector tsvector;

CREATE OR REPLACE FUNCTION update_widget_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.code, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_widget_search_vector_trigger
    BEFORE INSERT OR UPDATE ON ai_generated_widgets
    FOR EACH ROW
    EXECUTE FUNCTION update_widget_search_vector();

CREATE INDEX idx_ai_generated_widgets_search ON ai_generated_widgets USING gin(search_vector);

-- Add RLS policies
ALTER TABLE ai_generated_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_widget_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_widget_improvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_widget_usage ENABLE ROW LEVEL SECURITY;

-- Policies for ai_generated_widgets
CREATE POLICY "Services can view their own widgets" ON ai_generated_widgets
    FOR SELECT
    USING (service_id = current_setting('app.service_id', true));

CREATE POLICY "Services can create widgets" ON ai_generated_widgets
    FOR INSERT
    WITH CHECK (service_id = current_setting('app.service_id', true));

CREATE POLICY "Services can update their own widgets" ON ai_generated_widgets
    FOR UPDATE
    USING (service_id = current_setting('app.service_id', true));

CREATE POLICY "Services can delete their own widgets" ON ai_generated_widgets
    FOR DELETE
    USING (service_id = current_setting('app.service_id', true));

-- Policies for ai_widget_generations
CREATE POLICY "Services can view their own generations" ON ai_widget_generations
    FOR SELECT
    USING (service_id = current_setting('app.service_id', true));

CREATE POLICY "Services can create generations" ON ai_widget_generations
    FOR INSERT
    WITH CHECK (service_id = current_setting('app.service_id', true));

CREATE POLICY "Services can update their own generations" ON ai_widget_generations
    FOR UPDATE
    USING (service_id = current_setting('app.service_id', true));

-- Policies for ai_widget_improvements
CREATE POLICY "Services can view improvements for their widgets" ON ai_widget_improvements
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM ai_generated_widgets w 
        WHERE w.id = ai_widget_improvements.original_widget_id 
        AND w.service_id = current_setting('app.service_id', true)
    ));

CREATE POLICY "Services can create improvements" ON ai_widget_improvements
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM ai_generated_widgets w 
        WHERE w.id = original_widget_id 
        AND w.service_id = current_setting('app.service_id', true)
    ));

-- Policies for ai_widget_usage
CREATE POLICY "Services can track their own usage" ON ai_widget_usage
    FOR ALL
    USING (service_id = current_setting('app.service_id', true));

-- Add comments
COMMENT ON TABLE ai_generated_widgets IS 'Stores widgets generated through DSPy orchestration';
COMMENT ON TABLE ai_widget_generations IS 'Tracks widget generation requests and their status';
COMMENT ON TABLE ai_widget_improvements IS 'Tracks the history of widget improvements';
COMMENT ON TABLE ai_widget_usage IS 'Analytics for widget usage patterns';

COMMENT ON COLUMN ai_generated_widgets.design IS 'Widget design structure including props, state, methods';
COMMENT ON COLUMN ai_generated_widgets.requirements IS 'Analyzed requirements for the widget';
COMMENT ON COLUMN ai_generated_widgets.metadata IS 'Generation metadata including agents, confidence, complexity';
COMMENT ON COLUMN ai_widget_generations.widget_data IS 'The complete generated widget data on completion';
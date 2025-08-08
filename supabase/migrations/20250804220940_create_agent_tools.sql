CREATE TABLE IF NOT EXISTS public.agent_tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parameters JSONB,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read and write access to all users" ON public.agent_tools FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agent_tools_name ON public.agent_tools(name);
CREATE INDEX IF NOT EXISTS idx_agent_tools_enabled ON public.agent_tools(enabled);
CREATE INDEX IF NOT EXISTS idx_agent_tools_created_at ON public.agent_tools(created_at);

-- Sample data
INSERT INTO agent_tools (tool_name, tool_description, tool_type)
VALUES ('Chatbot Interface', 'A graphical interface to interact with users through chat.', 'Visual'),
       ('Knowledge Graph Database', 'An in-memory database for efficient knowledge retrieval and updates.', 'Database'),
       ('Sentiment Analysis Module', 'A module that analyzes user sentiment from text inputs.', 'Text Processing'),
       ('Process Mining Tool', 'A tool used to analyze and visualize process data.', 'Data Analysis'),
       ('Dialogue Management System', 'A system that manages and generates human-like conversations.', 'Conversational AI');

INSERT INTO agent_tools (tool_name, tool_description, tool_type)
VALUES ('Natural Language Processing Library', 'A library for natural language processing tasks such as text classification and sentiment analysis.', 'Library'),
       ('Machine Learning Framework', 'A framework for building machine learning models and deploying them in the field.', 'ML Framework'),
       ('Cognitive Architect', 'An architect that provides a framework for integrating multiple AI components into a single system.', 'AI Framework');

INSERT INTO agent_tools (tool_name, tool_description, tool_type)
VALUES ('Rule-Based Expert System', 'A system that uses expert rules to make decisions in areas such as healthcare and finance.', 'Expert System'),
       ('User Interface Generator', 'A tool that generates user interfaces for AI applications based on a set of predefined templates.', 'UI Generation');
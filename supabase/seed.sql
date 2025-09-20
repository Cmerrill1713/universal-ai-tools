-- Simple seed data for Universal AI Tools
INSERT INTO agents (name, display_name, description) VALUES 
('chat_agent', 'Chat Agent', 'Handles chat interactions'),
('memory_agent', 'Memory Agent', 'Manages user memories'),
('rag_agent', 'RAG Agent', 'Retrieval Augmented Generation')
ON CONFLICT (name) DO NOTHING;

INSERT INTO memories (user_id, content) VALUES 
('00000000-0000-0000-0000-000000000000', 'Welcome to Universal AI Tools!'),
('00000000-0000-0000-0000-000000000000', 'This is a sample memory for testing.')
ON CONFLICT DO NOTHING;

-- Create test service if not exists
INSERT INTO ai_services (id, name, type, endpoint, configuration, is_active)
VALUES ('test-service', 'Test Service', 'test', 'http://localhost:9999', '{}', true)
ON CONFLICT (id) DO NOTHING;

-- Create test API key if not exists
INSERT INTO ai_service_keys (service_id, encrypted_key, name, is_active)
VALUES ('test-service', 'universal-ai-tools-production-key-2025', 'Test API Key', true)
ON CONFLICT (encrypted_key) DO NOTHING;

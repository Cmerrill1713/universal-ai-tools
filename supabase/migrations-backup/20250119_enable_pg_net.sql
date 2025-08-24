
-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to roles
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;

-- Test pg_net
SELECT net.http_get('http://ollama-proxy:8080/api/version');

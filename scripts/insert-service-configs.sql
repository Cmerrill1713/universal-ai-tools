-- Insert remaining service configurations that were missing
-- This completes the API secrets management setup

-- First, let's check what services already exist
SELECT service_name FROM service_configurations ORDER BY service_name;

-- Insert any missing service configurations
-- Using INSERT ... ON CONFLICT to avoid duplicates
INSERT INTO service_configurations (service_name, base_url, auth_type, auth_prefix, required_env_vars, optional_env_vars, metadata) VALUES
-- Core LLM Services
('openai', 'https://api.openai.com/v1', 'bearer', 'Bearer ', '{"OPENAI_API_KEY"}', '{}', '{"models": ["gpt-4", "gpt-3.5-turbo"], "supports_streaming": true}'),
('anthropic', 'https://api.anthropic.com/v1', 'api_key', 'x-api-key: ', '{"ANTHROPIC_API_KEY"}', '{}', '{"models": ["claude-3-opus", "claude-3-sonnet"], "supports_streaming": true}'),
('google_ai', 'https://generativelanguage.googleapis.com/v1', 'api_key', '?key=', '{"GOOGLE_AI_API_KEY"}', '{}', '{"models": ["gemini-pro"], "supports_streaming": true}'),

-- Local LLM Services
('lm_studio', 'http://localhost:1234/v1', 'none', '', '{}', '{"LM_STUDIO_URL"}', '{"models": ["local"], "supports_streaming": true}'),
('ollama', 'http://localhost:11434', 'none', '', '{}', '{"OLLAMA_URL"}', '{"models": ["local"], "supports_streaming": true}'),

-- Search Services
('serper', 'https://google.serper.dev', 'api_key', 'X-API-KEY: ', '{"SERPER_API_KEY"}', '{}', '{"service": "search", "type": "google_search"}'),
('serpapi', 'https://serpapi.com/search', 'api_key', '&api_key=', '{"SERPAPI_API_KEY"}', '{}', '{"service": "search", "type": "google_search"}'),
('searxng', 'http://localhost:8888', 'none', '', '{}', '{"SEARXNG_URL"}', '{"service": "search", "type": "meta_search", "privacy_focused": true}'),

-- Browser Services
('browserless', 'https://chrome.browserless.io', 'api_key', '?token=', '{"BROWSERLESS_API_KEY"}', '{}', '{"service": "browser", "type": "headless_chrome"}'),
('brightdata', 'https://api.brightdata.com', 'bearer', 'Bearer ', '{"BRIGHTDATA_API_KEY"}', '{}', '{"service": "browser", "type": "web_scraping"}'),

-- Voice & Audio Services
('elevenlabs', 'https://api.elevenlabs.io/v1', 'api_key', 'xi-api-key: ', '{"ELEVENLABS_API_KEY"}', '{}', '{"service": "tts", "type": "text_to_speech"}'),
('deepgram', 'https://api.deepgram.com/v1', 'bearer', 'Bearer ', '{"DEEPGRAM_API_KEY"}', '{}', '{"service": "stt", "type": "speech_to_text"}'),
('whisper', 'https://api.openai.com/v1/audio', 'bearer', 'Bearer ', '{"OPENAI_API_KEY"}', '{}', '{"service": "stt", "type": "speech_to_text"}'),

-- Model Hosting & ML Services
('replicate', 'https://api.replicate.com/v1', 'bearer', 'Bearer ', '{"REPLICATE_API_TOKEN"}', '{}', '{"service": "ml", "type": "model_hosting"}'),
('huggingface', 'https://api-inference.huggingface.co', 'bearer', 'Bearer ', '{"HUGGINGFACE_API_KEY"}', '{}', '{"models": ["various"], "supports_streaming": false}'),
('runpod', 'https://api.runpod.ai/v2', 'bearer', 'Bearer ', '{"RUNPOD_API_KEY"}', '{}', '{"service": "ml", "type": "gpu_compute"}'),

-- Vector Databases
('pinecone', 'https://api.pinecone.io', 'api_key', 'Api-Key: ', '{"PINECONE_API_KEY"}', '{"PINECONE_ENVIRONMENT"}', '{"service": "vector_db", "type": "vector_database"}'),
('weaviate', 'http://localhost:8080', 'api_key', 'X-Weaviate-Api-Key: ', '{"WEAVIATE_API_KEY"}', '{"WEAVIATE_URL"}', '{"service": "vector_db", "type": "vector_database"}'),
('qdrant', 'http://localhost:6333', 'api_key', 'api-key: ', '{"QDRANT_API_KEY"}', '{"QDRANT_URL"}', '{"service": "vector_db", "type": "vector_database"}'),

-- Infrastructure Services
('redis', 'redis://localhost:6379', 'none', '', '{}', '{"REDIS_URL", "REDIS_PASSWORD"}', '{"service": "cache", "type": "key_value_store"}'),
('supabase', 'http://localhost:54321', 'bearer', 'Bearer ', '{"SUPABASE_SERVICE_KEY"}', '{"SUPABASE_URL", "SUPABASE_ANON_KEY"}', '{"service": "database", "type": "postgres"}'),
('prometheus', 'http://localhost:9090', 'none', '', '{}', '{"PROMETHEUS_URL"}', '{"service": "monitoring", "type": "metrics"}'),
('grafana', 'http://localhost:3001', 'api_key', 'Bearer ', '{"GRAFANA_API_KEY"}', '{"GRAFANA_URL"}', '{"service": "monitoring", "type": "visualization"}'),

-- Communication Services
('sendgrid', 'https://api.sendgrid.com/v3', 'bearer', 'Bearer ', '{"SENDGRID_API_KEY"}', '{}', '{"service": "email", "type": "transactional_email"}'),
('twilio', 'https://api.twilio.com', 'basic', '', '{"TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"}', '{"TWILIO_PHONE_NUMBER"}', '{"service": "sms", "type": "messaging"}'),
('slack', 'https://slack.com/api', 'bearer', 'Bearer ', '{"SLACK_BOT_TOKEN"}', '{"SLACK_APP_TOKEN"}', '{"service": "chat", "type": "team_communication"}'),

-- Analytics Services
('mixpanel', 'https://api.mixpanel.com', 'basic', '', '{"MIXPANEL_TOKEN"}', '{"MIXPANEL_API_SECRET"}', '{"service": "analytics", "type": "product_analytics"}'),
('amplitude', 'https://api2.amplitude.com', 'api_key', 'Api-Key: ', '{"AMPLITUDE_API_KEY"}', '{}', '{"service": "analytics", "type": "product_analytics"}'),

-- Payment Services
('stripe', 'https://api.stripe.com/v1', 'bearer', 'Bearer ', '{"STRIPE_SECRET_KEY"}', '{"STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"}', '{"service": "payment", "type": "payment_processing"}'),

-- Image Processing Services
('stability', 'https://api.stability.ai/v1', 'bearer', 'Bearer ', '{"STABILITY_API_KEY"}', '{}', '{"service": "image", "type": "image_generation", "models": ["stable-diffusion"]}'),
('midjourney', 'https://api.midjourney.com', 'bearer', 'Bearer ', '{"MIDJOURNEY_API_KEY"}', '{}', '{"service": "image", "type": "image_generation"}'),
('dalle', 'https://api.openai.com/v1/images', 'bearer', 'Bearer ', '{"OPENAI_API_KEY"}', '{}', '{"service": "image", "type": "image_generation", "models": ["dall-e-3", "dall-e-2"]}')
ON CONFLICT (service_name) DO UPDATE SET
    base_url = EXCLUDED.base_url,
    auth_type = EXCLUDED.auth_type,
    auth_prefix = EXCLUDED.auth_prefix,
    required_env_vars = EXCLUDED.required_env_vars,
    optional_env_vars = EXCLUDED.optional_env_vars,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Verify all services were inserted
SELECT COUNT(*) as total_services FROM service_configurations;

-- Show services that need API keys
SELECT 
    sc.service_name,
    sc.auth_type,
    CASE 
        WHEN s.api_key IS NOT NULL THEN 'Configured'
        ELSE 'Missing API Key'
    END as status
FROM service_configurations sc
LEFT JOIN api_secrets s ON sc.service_name = s.service_name AND s.is_active = TRUE
WHERE sc.is_active = TRUE
ORDER BY 
    CASE WHEN s.api_key IS NULL THEN 0 ELSE 1 END,
    sc.service_name;
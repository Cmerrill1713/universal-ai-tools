-- Setup Vault secrets for Universal AI Tools
-- Run this in Supabase SQL Editor

-- Enable Vault extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vault;

-- Store JWT secret (generated securely)
SELECT vault.create_secret(
    'jwt_secret',
    'J5f51LnpS9KYctUJIu21cZbXMtDjuhlYpT/ACupjjjx3k/ji4+WzxGCbgsYHbyF0QoCyJ2005iy25Oium2z1jA==',
    'JWT secret for authentication'
);

-- Store API keys (replace with your actual keys)
SELECT vault.create_secret(
    'openai_api_key',
    'YOUR_OPENAI_API_KEY',
    'OpenAI API key'
);

SELECT vault.create_secret(
    'anthropic_api_key',
    'YOUR_ANTHROPIC_API_KEY',
    'Anthropic API key'
);

-- Store encryption key for sensitive data
SELECT vault.create_secret(
    'encryption_key',
    encode(gen_random_bytes(32), 'hex'),
    'Encryption key for sensitive data'
);

-- Verify secrets are stored
SELECT name, description, created_at 
FROM vault.secrets 
WHERE name IN ('jwt_secret', 'openai_api_key', 'anthropic_api_key', 'encryption_key');

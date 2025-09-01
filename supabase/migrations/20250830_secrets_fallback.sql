-- Migration: Create secrets fallback table and functions
-- Date: 2025-08-30
-- Description: Creates a fallback secrets storage system for development

-- Create secrets table if Vault extension is not available
CREATE TABLE IF NOT EXISTS public.secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  encrypted_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "secrets_authenticated_access" ON public.secrets
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_secrets_name ON public.secrets(name);

-- Function to encrypt/decrypt secrets (simple base64 encoding for development)
CREATE OR REPLACE FUNCTION encode_secret(secret_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(secret_text::bytea, 'base64');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decode_secret(encoded_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN convert_from(decode(encoded_text, 'base64'), 'UTF8');
END;
$$ LANGUAGE plpgsql;

-- Function to insert a secret
CREATE OR REPLACE FUNCTION insert_secret(
  name TEXT,
  secret TEXT,
  description TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.secrets (name, encrypted_value, description)
  VALUES (name, encode_secret(secret), description)
  ON CONFLICT (name)
  DO UPDATE SET
    encrypted_value = encode_secret(secret),
    description = COALESCE(EXCLUDED.description, secrets.description),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to read a secret
CREATE OR REPLACE FUNCTION read_secret(secret_name TEXT) 
RETURNS TEXT AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decode_secret(encrypted_value) INTO secret_value
  FROM public.secrets
  WHERE name = secret_name
  LIMIT 1;
  
  RETURN secret_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update a secret
CREATE OR REPLACE FUNCTION update_secret(
  secret_name TEXT,
  new_secret TEXT,
  new_description TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE public.secrets
  SET 
    encrypted_value = encode_secret(new_secret),
    description = COALESCE(new_description, description),
    updated_at = NOW()
  WHERE name = secret_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get service credentials (returns structured data)
CREATE OR REPLACE FUNCTION get_service_credentials(p_service_name TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  api_key_value TEXT;
BEGIN
  -- Try to get the API key for this service
  SELECT decode_secret(encrypted_value) INTO api_key_value
  FROM public.secrets
  WHERE name = p_service_name || '_api_key'
  LIMIT 1;
  
  SELECT json_build_object(
    'api_key', api_key_value,
    'service_name', p_service_name
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all service credentials
CREATE OR REPLACE FUNCTION get_all_service_credentials()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Return all decrypted secrets as a JSON object
  SELECT json_object_agg(name, decode_secret(encrypted_value)) INTO result
  FROM public.secrets
  WHERE name NOT LIKE 'master_%'; -- Exclude master keys
  
  RETURN COALESCE(result, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if service has valid credentials
CREATE OR REPLACE FUNCTION has_valid_credentials(p_service_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  secret_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.secrets 
    WHERE name = p_service_name || '_api_key'
    AND encrypted_value IS NOT NULL
    AND length(encrypted_value) > 0
  ) INTO secret_exists;
  
  RETURN secret_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get missing credentials
CREATE OR REPLACE FUNCTION get_missing_credentials()
RETURNS TEXT[] AS $$
DECLARE
  required_services TEXT[] := ARRAY['openai', 'anthropic', 'google_ai', 'huggingface'];
  missing_services TEXT[] := ARRAY[]::TEXT[];
  service TEXT;
BEGIN
  FOREACH service IN ARRAY required_services
  LOOP
    IF NOT has_valid_credentials(service) THEN
      missing_services := array_append(missing_services, service);
    END IF;
  END LOOP;
  
  RETURN missing_services;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_secrets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_secrets_updated_at_trigger
  BEFORE UPDATE ON public.secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_secrets_updated_at();

-- Grant permissions
GRANT ALL ON public.secrets TO authenticated;
GRANT EXECUTE ON FUNCTION insert_secret(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION read_secret(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_secret(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_service_credentials(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_service_credentials() TO authenticated;
GRANT EXECUTE ON FUNCTION has_valid_credentials(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_missing_credentials() TO authenticated;

COMMENT ON TABLE public.secrets IS 'Fallback secrets storage for development (use Vault in production)';
COMMENT ON FUNCTION insert_secret IS 'Insert/update a secret in the secrets table';
COMMENT ON FUNCTION read_secret IS 'Read a secret from the secrets table';
COMMENT ON FUNCTION update_secret IS 'Update an existing secret';
COMMENT ON FUNCTION get_service_credentials IS 'Get credentials for a specific service';
COMMENT ON FUNCTION get_all_service_credentials IS 'Get all service credentials';
COMMENT ON FUNCTION has_valid_credentials IS 'Check if a service has valid credentials';
COMMENT ON FUNCTION get_missing_credentials IS 'Get list of services missing credentials';
-- Migration: Create Vault RPC functions for secrets management
-- Date: 2025-08-30
-- Description: Creates RPC functions to manage secrets in Supabase Vault

-- Enable Vault extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vault;

-- Function to insert a secret
CREATE OR REPLACE FUNCTION insert_secret(
  name TEXT,
  secret TEXT,
  description TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  PERFORM vault.create_secret(name, secret, description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to read a secret
CREATE OR REPLACE FUNCTION read_secret(secret_name TEXT) 
RETURNS TEXT AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
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
  -- Delete the old secret
  PERFORM vault.delete_secret(secret_name);
  
  -- Create the new secret
  PERFORM vault.create_secret(secret_name, new_secret, new_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get service credentials (returns structured data)
CREATE OR REPLACE FUNCTION get_service_credentials(p_service_name TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- For now, return a simple structure
  -- This can be expanded based on your service credential schema
  SELECT json_build_object(
    'api_key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_service_name || '_api_key' LIMIT 1),
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
  SELECT json_object_agg(name, decrypted_secret) INTO result
  FROM vault.decrypted_secrets
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
    SELECT 1 FROM vault.decrypted_secrets 
    WHERE name = p_service_name || '_api_key'
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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION insert_secret(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION read_secret(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_secret(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_service_credentials(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_service_credentials() TO authenticated;
GRANT EXECUTE ON FUNCTION has_valid_credentials(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_missing_credentials() TO authenticated;

-- Grant select on vault views to authenticated users
GRANT SELECT ON vault.decrypted_secrets TO authenticated;

COMMENT ON FUNCTION insert_secret IS 'Insert a new secret into the vault';
COMMENT ON FUNCTION read_secret IS 'Read a secret from the vault';
COMMENT ON FUNCTION update_secret IS 'Update an existing secret in the vault';
COMMENT ON FUNCTION get_service_credentials IS 'Get credentials for a specific service';
COMMENT ON FUNCTION get_all_service_credentials IS 'Get all service credentials';
COMMENT ON FUNCTION has_valid_credentials IS 'Check if a service has valid credentials';
COMMENT ON FUNCTION get_missing_credentials IS 'Get list of services missing credentials';
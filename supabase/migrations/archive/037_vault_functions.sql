-- Supabase Vault Functions
-- SQL functions to manage secrets in Vault

-- Vault extension is already enabled in Supabase by default
-- Just verify it exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
    RAISE EXCEPTION 'Supabase Vault extension is not installed';
  END IF;
END $$;

-- Function to insert a secret into Vault
CREATE OR REPLACE FUNCTION insert_secret(name text, secret text, description text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_id uuid;
BEGIN
  -- Only allow service role to insert secrets
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Only service role can insert secrets';
  END IF;
  
  -- Create the secret
  SELECT vault.create_secret(secret, name, description) INTO secret_id;
  
  RETURN secret_id;
END;
$$;

-- Function to read a secret from Vault
CREATE OR REPLACE FUNCTION read_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_value text;
BEGIN
  -- Only allow service role to read secrets
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Only service role can read secrets';
  END IF;
  
  -- Get the decrypted secret
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;
  
  RETURN secret_value;
END;
$$;

-- Function to update a secret
CREATE OR REPLACE FUNCTION update_secret(
  secret_name text, 
  new_secret text, 
  new_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_uuid uuid;
BEGIN
  -- Only allow service role to update secrets
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Only service role can update secrets';
  END IF;
  
  -- Get the secret UUID
  SELECT id INTO secret_uuid
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;
  
  IF secret_uuid IS NULL THEN
    RAISE EXCEPTION 'Secret not found: %', secret_name;
  END IF;
  
  -- Update the secret
  PERFORM vault.update_secret(
    secret_uuid,
    new_secret,
    secret_name,
    new_description
  );
END;
$$;

-- Function to delete a secret
CREATE OR REPLACE FUNCTION delete_secret(secret_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow service role to delete secrets
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Only service role can delete secrets';
  END IF;
  
  -- Delete the secret
  DELETE FROM vault.decrypted_secrets 
  WHERE name = secret_name;
END;
$$;

-- Function to list all secret names (without values)
CREATE OR REPLACE FUNCTION list_secret_names()
RETURNS TABLE(name text, description text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow service role to list secrets
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Only service role can list secrets';
  END IF;
  
  RETURN QUERY
  SELECT s.name, s.description, s.created_at
  FROM vault.decrypted_secrets s
  ORDER BY s.created_at DESC;
END;
$$;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION insert_secret TO service_role;
GRANT EXECUTE ON FUNCTION read_secret TO service_role;
GRANT EXECUTE ON FUNCTION update_secret TO service_role;
GRANT EXECUTE ON FUNCTION delete_secret TO service_role;
GRANT EXECUTE ON FUNCTION list_secret_names TO service_role;

-- Comments
COMMENT ON FUNCTION insert_secret IS 'Insert a new secret into Vault';
COMMENT ON FUNCTION read_secret IS 'Read a decrypted secret value from Vault';
COMMENT ON FUNCTION update_secret IS 'Update an existing secret in Vault';
COMMENT ON FUNCTION delete_secret IS 'Delete a secret from Vault';
COMMENT ON FUNCTION list_secret_names IS 'List all secret names without revealing values';
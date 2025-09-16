-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create vault schema
CREATE SCHEMA IF NOT EXISTS vault;

-- Create secrets table in vault schema
CREATE TABLE IF NOT EXISTS vault.secrets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    secret text NOT NULL,
    description text,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    expires_at timestamptz,
    is_active boolean DEFAULT true
);

-- Enable RLS
ALTER TABLE vault.secrets ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access only
CREATE POLICY "Service role can manage secrets" ON vault.secrets
    FOR ALL USING (auth.role() = 'service_role');

-- Create vault functions
CREATE OR REPLACE FUNCTION public.vault_read_secret(secret_name text)
RETURNS json
SECURITY DEFINER
SET search_path = vault, public
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    -- Check if user has service role or is authenticated
    IF NOT (auth.role() = 'service_role' OR auth.uid() IS NOT NULL) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT to_json(t)
    INTO result
    FROM (
        SELECT 
            name,
            secret as decrypted_secret,
            description,
            created_at,
            updated_at,
            expires_at
        FROM vault.secrets
        WHERE name = secret_name
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
    ) t;

    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_create_secret(secret_name text, secret text, description text DEFAULT NULL)
RETURNS json
SECURITY DEFINER
SET search_path = vault, public
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    -- Check if user has service role
    IF NOT auth.role() = 'service_role' THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Insert or update secret
    INSERT INTO vault.secrets (name, secret, description)
    VALUES (secret_name, secret, description)
    ON CONFLICT (name) 
    DO UPDATE SET 
        secret = EXCLUDED.secret,
        description = COALESCE(EXCLUDED.description, vault.secrets.description),
        updated_at = NOW(),
        is_active = true;

    SELECT to_json(t)
    INTO result
    FROM (
        SELECT 
            name,
            'Secret stored successfully' as message,
            updated_at
        FROM vault.secrets
        WHERE name = secret_name
        LIMIT 1
    ) t;

    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_delete_secret(secret_name text)
RETURNS json
SECURITY DEFINER
SET search_path = vault, public
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    -- Check if user has service role
    IF NOT auth.role() = 'service_role' THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Soft delete by setting is_active to false
    UPDATE vault.secrets 
    SET is_active = false, updated_at = NOW()
    WHERE name = secret_name;

    SELECT to_json(t)
    INTO result
    FROM (
        SELECT 
            secret_name as name,
            'Secret deleted successfully' as message,
            NOW() as deleted_at
    ) t;

    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_list_secrets()
RETURNS json
SECURITY DEFINER
SET search_path = vault, public
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    -- Check if user has service role or is authenticated
    IF NOT (auth.role() = 'service_role' OR auth.uid() IS NOT NULL) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT json_agg(t)
    INTO result
    FROM (
        SELECT 
            name,
            description,
            created_at,
            updated_at,
            expires_at,
            (expires_at IS NULL OR expires_at > NOW()) as is_valid
        FROM vault.secrets
        WHERE is_active = true
        ORDER BY name
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Create function to list secret names only (for health checks)
CREATE OR REPLACE FUNCTION public.list_secret_names()
RETURNS json
SECURITY DEFINER
SET search_path = vault, public
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    -- Check if user has service role or is authenticated
    IF NOT (auth.role() = 'service_role' OR auth.uid() IS NOT NULL) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT json_agg(name)
    INTO result
    FROM vault.secrets
    WHERE is_active = true
    ORDER BY name;

    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA vault TO service_role;
GRANT ALL ON TABLE vault.secrets TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_read_secret(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_delete_secret(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_list_secrets() TO service_role;
GRANT EXECUTE ON FUNCTION public.list_secret_names() TO service_role;

-- Grant permissions to authenticated users for read operations only
GRANT EXECUTE ON FUNCTION public.vault_read_secret(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_list_secrets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_secret_names() TO authenticated;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION vault.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vault_secrets_updated_at
    BEFORE UPDATE ON vault.secrets
    FOR EACH ROW
    EXECUTE FUNCTION vault.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vault_secrets_name ON vault.secrets(name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vault_secrets_expires_at ON vault.secrets(expires_at) WHERE expires_at IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_vault_secrets_active ON vault.secrets(is_active);
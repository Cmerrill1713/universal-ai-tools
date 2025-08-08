BEGIN;

CREATE SCHEMA IF NOT EXISTS vault;

-- Minimal shim; replace with real secrets backend or Supabase Vault
DO $$
DECLARE has_usage boolean;
BEGIN
  SELECT has_schema_privilege('vault', 'USAGE') INTO has_usage;

  IF has_usage THEN
    EXECUTE $$
      CREATE OR REPLACE FUNCTION vault.read_secret(secret_name text)
      RETURNS TABLE(secret text)
      LANGUAGE plpgsql
      SECURITY INVOKER
      AS $$$$
      BEGIN
        IF auth.role() = 'service_role' THEN
          RETURN QUERY SELECT NULL::text;
        ELSE
          RETURN QUERY SELECT NULL::text;
        END IF;
      END;
      $$$$;
    $$;

    EXECUTE $$
      CREATE OR REPLACE FUNCTION vault.create_secret(secret text, name text)
      RETURNS uuid
      LANGUAGE plpgsql
      SECURITY INVOKER
      AS $$$$
      BEGIN
        RETURN gen_random_uuid();
      END;
      $$$$;
    $$;
  ELSE
    EXECUTE $$
      CREATE OR REPLACE FUNCTION public.vault_shim_read_secret(secret_name text)
      RETURNS TABLE(secret text)
      LANGUAGE plpgsql
      SECURITY INVOKER
      AS $$$$
      BEGIN
        IF auth.role() = 'service_role' THEN
          RETURN QUERY SELECT NULL::text;
        ELSE
          RETURN QUERY SELECT NULL::text;
        END IF;
      END;
      $$$$;
    $$;

    EXECUTE $$
      CREATE OR REPLACE FUNCTION public.vault_shim_create_secret(secret text, name text)
      RETURNS uuid
      LANGUAGE plpgsql
      SECURITY INVOKER
      AS $$$$
      BEGIN
        RETURN gen_random_uuid();
      END;
      $$$$;
    $$;
  END IF;
END$$;

REVOKE ALL ON SCHEMA vault FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA vault TO service_role;

COMMIT;


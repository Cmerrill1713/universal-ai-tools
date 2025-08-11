BEGIN;

-- Fix the trigger function to properly read user_id from session claims
-- This ensures that when tests set request.jwt.claims, the trigger can read it
CREATE OR REPLACE FUNCTION public.set_ai_memories_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Try to get user_id from various sources in order of precedence
  -- 1. If user_id is already set, use it
  IF NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- 2. Try auth.uid() first (standard Supabase way)
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NOT NULL THEN
      NEW.user_id := v_user_id;
      RETURN NEW;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- auth.uid() might not work in test environment
    NULL;
  END;
  
  -- 3. Try to get from request.jwt.claims (test environment)
  BEGIN
    v_user_id := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
    IF v_user_id IS NOT NULL THEN
      NEW.user_id := v_user_id;
      RETURN NEW;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- 4. If still no user_id and we're in a test/service context, allow NULL
  -- (service_role operations might not have a user context)
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists and uses the updated function
DROP TRIGGER IF EXISTS trg_set_ai_memories_user_id ON public.ai_memories;
CREATE TRIGGER trg_set_ai_memories_user_id
BEFORE INSERT ON public.ai_memories
FOR EACH ROW
EXECUTE FUNCTION public.set_ai_memories_user_id();

-- Create a helper function that returns the current user ID for RLS policies
-- This will work in both production and test environments
CREATE OR REPLACE FUNCTION public.get_auth_uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Try auth.uid() first (standard Supabase way)
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NOT NULL THEN
      RETURN v_user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Fall back to request.jwt.claims (test environment)
  BEGIN
    v_user_id := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
    IF v_user_id IS NOT NULL THEN
      RETURN v_user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN NULL;
END;
$$;

-- Verify RLS is enabled and policies exist
ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to use the helper function that works in test environment
DROP POLICY IF EXISTS ai_memories_select_own ON public.ai_memories;
DROP POLICY IF EXISTS ai_memories_insert_own ON public.ai_memories;
DROP POLICY IF EXISTS ai_memories_update_own ON public.ai_memories;
DROP POLICY IF EXISTS ai_memories_delete_own ON public.ai_memories;
DROP POLICY IF EXISTS ai_memories_service_all ON public.ai_memories;

-- Recreate policies using the helper function
CREATE POLICY ai_memories_select_own ON public.ai_memories
  FOR SELECT 
  TO authenticated
  USING (user_id = public.get_auth_uid());

CREATE POLICY ai_memories_insert_own ON public.ai_memories
  FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = public.get_auth_uid() OR user_id IS NULL);

CREATE POLICY ai_memories_update_own ON public.ai_memories
  FOR UPDATE 
  TO authenticated
  USING (user_id = public.get_auth_uid())
  WITH CHECK (user_id = public.get_auth_uid());

CREATE POLICY ai_memories_delete_own ON public.ai_memories
  FOR DELETE 
  TO authenticated
  USING (user_id = public.get_auth_uid());

CREATE POLICY ai_memories_service_all ON public.ai_memories
  FOR ALL 
  TO service_role
  USING (true) 
  WITH CHECK (true);

COMMIT;
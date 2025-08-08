BEGIN;

-- Ensure vision_embeddings table exists (created in prior migrations)
-- Enable RLS and secure access to only owners via ai_memories.user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vision_embeddings'
  ) THEN
    ALTER TABLE public.vision_embeddings ENABLE ROW LEVEL SECURITY;

    -- Drop any permissive policies if present
    DROP POLICY IF EXISTS vision_embeddings_public ON public.vision_embeddings;
    DROP POLICY IF EXISTS vision_embeddings_all ON public.vision_embeddings;

    -- Users can select only embeddings for their own memories
    CREATE POLICY vision_embeddings_select_own ON public.vision_embeddings
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.ai_memories m
          WHERE m.id = vision_embeddings.memory_id
            AND m.user_id = auth.uid()
        )
        OR auth.role() = 'service_role'
      );

    -- Service role can insert/update/delete for system jobs
    CREATE POLICY vision_embeddings_service_all ON public.vision_embeddings
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

-- Recreate search_similar_images to use vision_embeddings (faster and normalized)
-- Falls back to ai_memories.visual_embedding only if vision_embeddings not present
DO $$
BEGIN
  -- Prefer function backed by vision_embeddings
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vision_embeddings'
  ) THEN
    CREATE OR REPLACE FUNCTION public.search_similar_images(
      query_embedding vector(512),
      limit_count INTEGER DEFAULT 10,
      threshold FLOAT DEFAULT 0.8
    )
    RETURNS TABLE (
      memory_id UUID,
      similarity FLOAT,
      metadata JSONB
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        ve.memory_id,
        1 - (ve.embedding <=> query_embedding) AS similarity,
        m.metadata
      FROM public.vision_embeddings ve
      JOIN public.ai_memories m ON m.id = ve.memory_id
      WHERE 1 - (ve.embedding <=> query_embedding) > threshold
      ORDER BY ve.embedding <=> query_embedding
      LIMIT limit_count;
    END;
    $$;
  ELSE
    -- Fallback implementation using ai_memories.visual_embedding if vision_embeddings not available
    CREATE OR REPLACE FUNCTION public.search_similar_images(
      query_embedding vector(512),
      limit_count INTEGER DEFAULT 10,
      threshold FLOAT DEFAULT 0.8
    )
    RETURNS TABLE (
      memory_id UUID,
      similarity FLOAT,
      metadata JSONB
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        m.id AS memory_id,
        1 - (m.visual_embedding <=> query_embedding) AS similarity,
        m.metadata
      FROM public.ai_memories m
      WHERE m.visual_embedding IS NOT NULL
        AND 1 - (m.visual_embedding <=> query_embedding) > threshold
      ORDER BY m.visual_embedding <=> query_embedding
      LIMIT limit_count;
    END;
    $$;
  END IF;
END$$;

COMMIT;



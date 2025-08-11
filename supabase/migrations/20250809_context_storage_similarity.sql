-- Search function for context_storage using pgvector
CREATE OR REPLACE FUNCTION public.search_context_storage_by_embedding(
  query_embedding vector(384),
  in_user_id text,
  in_category text DEFAULT NULL,
  in_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  user_id text,
  content text,
  category text,
  source text,
  project_path text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  similarity double precision
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.user_id,
    cs.content,
    cs.category,
    cs.source,
    cs.project_path,
    cs.metadata,
    cs.created_at,
    cs.updated_at,
    (1 - (cs.embedding <=> query_embedding)) AS similarity
  FROM public.context_storage cs
  WHERE cs.embedding IS NOT NULL
    AND cs.user_id = in_user_id
    AND (in_category IS NULL OR cs.category = in_category)
  ORDER BY cs.embedding <=> query_embedding
  LIMIT in_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.search_context_storage_by_embedding(vector, text, text, integer) TO anon, authenticated, service_role;

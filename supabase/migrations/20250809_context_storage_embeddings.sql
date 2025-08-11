-- Add embedding column for semantic search (384 dims to match MiniLM)
ALTER TABLE IF EXISTS public.context_storage
  ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Create IVFFLAT index for approximate nearest neighbors (lists tuned conservatively)
CREATE INDEX IF NOT EXISTS idx_context_storage_embedding
  ON public.context_storage USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

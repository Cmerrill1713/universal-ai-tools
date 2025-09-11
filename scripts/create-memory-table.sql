-- Create memories table for autofix system
CREATE TABLE IF NOT EXISTS public.memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(1536),
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Create policy for autofix systems
DROP POLICY IF EXISTS "Allow autofix systems" ON public.memories;
CREATE POLICY "Allow autofix systems" ON public.memories
  FOR ALL 
  USING (
    user_id IN ('claude-autofix', 'claude-advanced-autofix', 'claude-training-system', 'github-actions')
    OR user_id LIKE 'claude-%'
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS memories_user_id_idx ON public.memories (user_id);
CREATE INDEX IF NOT EXISTS memories_created_at_idx ON public.memories (created_at DESC);
CREATE INDEX IF NOT EXISTS memories_metadata_idx ON public.memories USING gin (metadata);
CREATE INDEX IF NOT EXISTS memories_metadata_type_idx ON public.memories ((metadata->>'memory_type'));

-- Create a simple embedding generation function (placeholder)
CREATE OR REPLACE FUNCTION public.ai_generate_embedding(content text)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT jsonb_build_array(
    random(), random(), random(), random(), random()
  );
$$;

-- Create memory search function
CREATE OR REPLACE FUNCTION public.search_memories(
  query_text text DEFAULT '',
  memory_type text DEFAULT '',
  user_filter text DEFAULT '',
  limit_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  created_at timestamptz,
  relevance_score float
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    m.id,
    m.content,
    m.metadata,
    m.created_at,
    CASE 
      WHEN query_text = '' THEN 1.0
      ELSE similarity(m.content, query_text)
    END as relevance_score
  FROM public.memories m
  WHERE 
    (memory_type = '' OR m.metadata->>'memory_type' = memory_type)
    AND (user_filter = '' OR m.user_id = user_filter)
    AND (query_text = '' OR m.content ILIKE '%' || query_text || '%')
  ORDER BY 
    CASE 
      WHEN query_text = '' THEN m.created_at
      ELSE similarity(m.content, query_text)
    END DESC
  LIMIT limit_count;
$$;

-- Insert sample autofix memories
INSERT INTO public.memories (content, metadata, user_id) VALUES
(
  'Fixed TypeScript any types in base_agent.ts - replaced 12 any types with proper types',
  '{
    "memory_type": "autofix",
    "fix_type": "type_improvement", 
    "file_path": "src/agents/base_agent.ts",
    "success": true,
    "confidence": 0.85,
    "errors_fixed": 0,
    "warnings_fixed": 12,
    "session_id": "demo_session_1",
    "tags": ["autofix", "typescript", "any-types"]
  }',
  'claude-autofix'
),
(
  'Sorted imports in devils_advocate_agent.ts - alphabetical ordering applied',
  '{
    "memory_type": "autofix",
    "fix_type": "import_sorting",
    "file_path": "src/agents/cognitive/devils_advocate_agent.ts", 
    "success": true,
    "confidence": 0.9,
    "errors_fixed": 2,
    "warnings_fixed": 1,
    "session_id": "demo_session_1",
    "tags": ["autofix", "imports", "sorting"]
  }',
  'claude-autofix'
),
(
  'Extracted magic numbers to constants in multiple files',
  '{
    "memory_type": "autofix",
    "fix_type": "magic_numbers",
    "file_path": "src/services/adaptive-autofix.ts",
    "success": true,
    "confidence": 0.75,
    "errors_fixed": 0,
    "warnings_fixed": 8,
    "session_id": "demo_session_1", 
    "tags": ["autofix", "magic-numbers", "constants"]
  }',
  'claude-autofix'
),
(
  'Advanced autofix session completed: 42 errors fixed, 18 warnings fixed across 6 files',
  '{
    "memory_type": "advanced_session_summary",
    "total_errors_fixed": 42,
    "total_warnings_fixed": 18,
    "files_modified": 6,
    "patterns_used": ["type_improvement", "import_sorting", "magic_numbers", "unused_variables"],
    "session_id": "demo_session_1",
    "success_rate": 0.95,
    "tags": ["autofix", "session", "summary", "advanced"]
  }',
  'claude-advanced-autofix'
),
(
  'Adaptive learning session: confidence levels adjusted based on fix outcomes', 
  '{
    "memory_type": "adaptive_learning",
    "fix_type": "confidence_adjustment",
    "patterns_learned": {
      "type_improvement": {"old_confidence": 0.8, "new_confidence": 0.85},
      "import_sorting": {"old_confidence": 0.9, "new_confidence": 0.95}
    },
    "session_id": "demo_session_1",
    "learning_events": 24,
    "tags": ["autofix", "adaptive", "learning", "confidence"]
  }',
  'claude-training-system'
);

-- Test the setup
SELECT 
  'Setup complete!' as status,
  count(*) as sample_memories_created
FROM public.memories 
WHERE user_id LIKE 'claude-%';
-- Universal AI Tools - Data Migration Script
-- Migrates data from legacy tables to unified schema
-- Run this AFTER 003_unified_production_schema.sql

-- =====================================================
-- MIGRATION SAFETY CHECKS
-- =====================================================

DO $$
BEGIN
  -- Check if new schema exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memories') THEN
    RAISE EXCEPTION 'Unified schema not found. Run 003_unified_production_schema.sql first';
  END IF;
END $$;

-- =====================================================
-- 1. MIGRATE MEMORY DATA
-- =====================================================

-- Migrate from ai_memories if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_memories') THEN
    INSERT INTO memories (
      user_id, agent_id, type, content, embedding, importance, 
      metadata, created_at, updated_at
    )
    SELECT 
      service_id AS user_id,
      NULL AS agent_id,
      'conversation'::memory_type AS type,
      content,
      embedding,
      CASE 
        WHEN importance::text = 'high' THEN 'high'::memory_importance
        WHEN importance::text = 'low' THEN 'low'::memory_importance
        ELSE 'medium'::memory_importance
      END,
      metadata,
      created_at,
      updated_at
    FROM ai_memories
    WHERE NOT EXISTS (
      SELECT 1 FROM memories m 
      WHERE m.content = ai_memories.content 
      AND m.user_id = ai_memories.service_id
    );
    
    RAISE NOTICE 'Migrated % records from ai_memories', (SELECT COUNT(*) FROM ai_memories);
  END IF;
END $$;

-- Migrate from memory_embeddings if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_embeddings') THEN
    INSERT INTO memories (
      user_id, type, content, embedding, metadata, created_at
    )
    SELECT 
      user_id,
      'fact'::memory_type AS type,
      content,
      embedding,
      metadata,
      created_at
    FROM memory_embeddings
    WHERE NOT EXISTS (
      SELECT 1 FROM memories m 
      WHERE m.content = memory_embeddings.content 
      AND m.user_id = memory_embeddings.user_id
    );
    
    RAISE NOTICE 'Migrated % records from memory_embeddings', (SELECT COUNT(*) FROM memory_embeddings);
  END IF;
END $$;

-- =====================================================
-- 2. MIGRATE WIDGET DATA
-- =====================================================

-- Migrate from ai_widgets if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_widgets') THEN
    INSERT INTO widgets (
      id, creator_id, name, description, category, type,
      configuration, code, tags, version, status, is_public,
      created_at, updated_at
    )
    SELECT 
      id,
      created_by AS creator_id,
      name,
      description,
      COALESCE(category::widget_category, 'utility'::widget_category),
      widget_type AS type,
      configuration,
      code_template AS code,
      tags,
      version,
      CASE 
        WHEN status = 'active' THEN 'published'::widget_status
        WHEN status = 'archived' THEN 'archived'::widget_status
        ELSE 'draft'::widget_status
      END,
      is_public,
      created_at,
      updated_at
    FROM ai_widgets
    WHERE NOT EXISTS (
      SELECT 1 FROM widgets w WHERE w.id = ai_widgets.id
    );
    
    RAISE NOTICE 'Migrated % records from ai_widgets', (SELECT COUNT(*) FROM ai_widgets);
  END IF;
END $$;

-- Migrate widget likes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_widget_likes') THEN
    INSERT INTO widget_likes (widget_id, user_id, created_at)
    SELECT widget_id, user_id, created_at
    FROM ai_widget_likes
    WHERE NOT EXISTS (
      SELECT 1 FROM widget_likes wl 
      WHERE wl.widget_id = ai_widget_likes.widget_id 
      AND wl.user_id = ai_widget_likes.user_id
    );
    
    RAISE NOTICE 'Migrated % widget likes', (SELECT COUNT(*) FROM ai_widget_likes);
  END IF;
END $$;

-- =====================================================
-- 3. MIGRATE AGENT DATA
-- =====================================================

-- Migrate from ai_agents if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_agents') THEN
    INSERT INTO agents (
      id, name, description, type, capabilities, configuration,
      version, status, created_by, created_at, updated_at
    )
    SELECT 
      id,
      name,
      description,
      agent_type AS type,
      COALESCE(capabilities::agent_capability[], ARRAY[]::agent_capability[]),
      configuration,
      version,
      CASE 
        WHEN is_active THEN 'active'::agent_status
        ELSE 'inactive'::agent_status
      END,
      created_by,
      created_at,
      updated_at
    FROM ai_agents
    WHERE NOT EXISTS (
      SELECT 1 FROM agents a WHERE a.id = ai_agents.id
    )
    ON CONFLICT (name) DO UPDATE
    SET 
      description = EXCLUDED.description,
      configuration = EXCLUDED.configuration,
      updated_at = NOW();
    
    RAISE NOTICE 'Migrated % records from ai_agents', (SELECT COUNT(*) FROM ai_agents);
  END IF;
END $$;

-- =====================================================
-- 4. MIGRATE TASK DATA
-- =====================================================

-- Migrate from ai_tasks if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_tasks') THEN
    INSERT INTO tasks (
      id, name, description, agent_id, user_id, type,
      priority, status, configuration, result,
      created_at, updated_at
    )
    SELECT 
      id,
      task_type AS name,
      parameters->>'description' AS description,
      assigned_agent_id AS agent_id,
      created_by AS user_id,
      task_type AS type,
      COALESCE(priority::task_priority, 'medium'::task_priority),
      COALESCE(status::task_status, 'pending'::task_status),
      parameters AS configuration,
      result,
      created_at,
      updated_at
    FROM ai_tasks
    WHERE NOT EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = ai_tasks.id
    );
    
    RAISE NOTICE 'Migrated % records from ai_tasks', (SELECT COUNT(*) FROM ai_tasks);
  END IF;
END $$;

-- =====================================================
-- 5. MIGRATE KNOWLEDGE DATA
-- =====================================================

-- Migrate from ai_knowledge_base if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_knowledge_base') THEN
    INSERT INTO knowledge_base (
      title, content, type, category, tags, embedding,
      metadata, source_url, status, created_by,
      created_at, updated_at
    )
    SELECT 
      title,
      content,
      COALESCE(content_type::knowledge_type, 'documentation'::knowledge_type),
      category,
      tags,
      embedding,
      metadata,
      source_url,
      CASE 
        WHEN is_active THEN 'active'::knowledge_status
        ELSE 'archived'::knowledge_status
      END,
      created_by,
      created_at,
      updated_at
    FROM ai_knowledge_base;
    
    RAISE NOTICE 'Migrated % records from ai_knowledge_base', (SELECT COUNT(*) FROM ai_knowledge_base);
  END IF;
END $$;

-- =====================================================
-- 6. UPDATE SEQUENCES
-- =====================================================

-- Update sequences to avoid ID conflicts
DO $$
DECLARE
  max_id UUID;
BEGIN
  -- This is handled automatically by UUID generation
  RAISE NOTICE 'UUID-based tables do not require sequence updates';
END $$;

-- =====================================================
-- 7. VERIFY MIGRATION
-- =====================================================

DO $$
DECLARE
  v_memories_count INTEGER;
  v_widgets_count INTEGER;
  v_agents_count INTEGER;
  v_tasks_count INTEGER;
  v_knowledge_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_memories_count FROM memories;
  SELECT COUNT(*) INTO v_widgets_count FROM widgets;
  SELECT COUNT(*) INTO v_agents_count FROM agents;
  SELECT COUNT(*) INTO v_tasks_count FROM tasks;
  SELECT COUNT(*) INTO v_knowledge_count FROM knowledge_base;
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Memories: % records', v_memories_count;
  RAISE NOTICE '  Widgets: % records', v_widgets_count;
  RAISE NOTICE '  Agents: % records', v_agents_count;
  RAISE NOTICE '  Tasks: % records', v_tasks_count;
  RAISE NOTICE '  Knowledge: % records', v_knowledge_count;
END $$;

-- =====================================================
-- 8. CLEANUP OLD TABLES (OPTIONAL - COMMENTED OUT)
-- =====================================================

-- Uncomment these lines after verifying successful migration
-- and backing up your data

/*
DROP TABLE IF EXISTS ai_memories CASCADE;
DROP TABLE IF EXISTS memory_embeddings CASCADE;
DROP TABLE IF EXISTS ai_widgets CASCADE;
DROP TABLE IF EXISTS ai_widget_likes CASCADE;
DROP TABLE IF EXISTS ai_widget_comments CASCADE;
DROP TABLE IF EXISTS ai_agents CASCADE;
DROP TABLE IF EXISTS ai_tasks CASCADE;
DROP TABLE IF EXISTS ai_knowledge_base CASCADE;
DROP TABLE IF EXISTS dspy_widgets CASCADE;
DROP TABLE IF EXISTS dspy_widget_versions CASCADE;
*/

-- =====================================================
-- 9. MIGRATION COMPLETION
-- =====================================================

-- Mark migration as complete
INSERT INTO schema_migrations (version, name, executed_at) VALUES
  ('004', 'data_migration', NOW())
ON CONFLICT DO NOTHING;
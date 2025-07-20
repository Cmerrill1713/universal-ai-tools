-- Project Archive Schema
-- Comprehensive file archival and restoration system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Main file archive table
CREATE TABLE project_archive (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_content TEXT,
    file_type TEXT,
    file_size INTEGER,
    file_hash TEXT,
    last_modified TIMESTAMP,
    is_binary BOOLEAN DEFAULT FALSE,
    is_duplicate BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    archived_at TIMESTAMP DEFAULT NOW(),
    project_name TEXT DEFAULT 'Last attempt',
    
    -- Add indexes for faster queries
    CONSTRAINT unique_file_path_project UNIQUE (file_path, project_name)
);

-- File dependencies and relationships
CREATE TABLE file_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES project_archive(id) ON DELETE CASCADE,
    imports TEXT[] DEFAULT '{}',
    exports TEXT[] DEFAULT '{}',
    imported_by UUID[] DEFAULT '{}',
    imports_external TEXT[] DEFAULT '{}', -- External package imports
    is_entry_point BOOLEAN DEFAULT FALSE,
    cyclic_dependencies UUID[] DEFAULT '{}',
    dependency_depth INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- File categories and classifications
CREATE TABLE file_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES project_archive(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'source', 'test', 'config', 'docs', 'script', 'log', 'asset'
    subcategory TEXT, -- 'agent', 'router', 'service', 'utility', etc.
    importance_score INTEGER DEFAULT 0, -- 0-100, higher = more important
    is_active BOOLEAN DEFAULT TRUE,
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Duplicate file analysis
CREATE TABLE duplicate_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_file_id UUID REFERENCES project_archive(id) ON DELETE CASCADE,
    duplicate_file_id UUID REFERENCES project_archive(id) ON DELETE CASCADE,
    similarity_score FLOAT DEFAULT 0.0, -- 0.0 to 1.0
    similarity_type TEXT, -- 'exact', 'content', 'name', 'function'
    recommended_action TEXT, -- 'keep_primary', 'keep_duplicate', 'merge', 'review'
    analysis_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT no_self_duplicate CHECK (primary_file_id != duplicate_file_id)
);

-- Restoration tracking
CREATE TABLE restoration_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES project_archive(id) ON DELETE CASCADE,
    restored_to TEXT NOT NULL,
    restore_reason TEXT,
    restore_method TEXT, -- 'automatic', 'manual', 'dependency'
    restored_by TEXT DEFAULT 'system',
    import_updates JSONB DEFAULT '{}', -- Track import path changes
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    restored_at TIMESTAMP DEFAULT NOW()
);

-- Archive statistics and metadata
CREATE TABLE archive_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL,
    total_files INTEGER DEFAULT 0,
    total_size BIGINT DEFAULT 0,
    files_by_type JSONB DEFAULT '{}',
    duplicate_count INTEGER DEFAULT 0,
    archive_started_at TIMESTAMP DEFAULT NOW(),
    archive_completed_at TIMESTAMP,
    archive_status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
    archive_notes TEXT,
    
    CONSTRAINT unique_project_archive UNIQUE (project_name, archive_started_at)
);

-- Restoration sessions
CREATE TABLE restoration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_name TEXT NOT NULL,
    target_directory TEXT NOT NULL,
    restoration_strategy TEXT DEFAULT 'selective', -- 'minimal', 'selective', 'full'
    files_restored INTEGER DEFAULT 0,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'failed', 'cancelled'
    notes TEXT
);

-- Create indexes for performance
CREATE INDEX idx_project_archive_file_path ON project_archive USING btree (file_path);
CREATE INDEX idx_project_archive_file_type ON project_archive USING btree (file_type);
CREATE INDEX idx_project_archive_file_hash ON project_archive USING btree (file_hash);
CREATE INDEX idx_project_archive_archived_at ON project_archive USING btree (archived_at);
CREATE INDEX idx_project_archive_file_name_gin ON project_archive USING gin (file_name gin_trgm_ops);
CREATE INDEX idx_project_archive_content_gin ON project_archive USING gin (to_tsvector('english', file_content));

CREATE INDEX idx_file_dependencies_file_id ON file_dependencies USING btree (file_id);
CREATE INDEX idx_file_dependencies_imports ON file_dependencies USING gin (imports);
CREATE INDEX idx_file_dependencies_entry_points ON file_dependencies USING btree (is_entry_point) WHERE is_entry_point = TRUE;

CREATE INDEX idx_file_categories_category ON file_categories USING btree (category);
CREATE INDEX idx_file_categories_importance ON file_categories USING btree (importance_score);
CREATE INDEX idx_file_categories_tags ON file_categories USING gin (tags);

CREATE INDEX idx_duplicate_files_primary ON duplicate_files USING btree (primary_file_id);
CREATE INDEX idx_duplicate_files_similarity ON duplicate_files USING btree (similarity_score);

CREATE INDEX idx_restoration_log_restored_at ON restoration_log USING btree (restored_at);
CREATE INDEX idx_restoration_log_success ON restoration_log USING btree (success);

-- Utility functions

-- Function to find files by content
CREATE OR REPLACE FUNCTION search_archived_files(search_term TEXT)
RETURNS TABLE (
    file_id UUID,
    file_path TEXT,
    file_name TEXT,
    rank REAL
)
LANGUAGE sql
AS $$
    SELECT 
        pa.id,
        pa.file_path,
        pa.file_name,
        ts_rank(to_tsvector('english', pa.file_content), plainto_tsquery('english', search_term)) as rank
    FROM project_archive pa
    WHERE to_tsvector('english', pa.file_content) @@ plainto_tsquery('english', search_term)
    ORDER BY rank DESC;
$$;

-- Function to get file dependency tree
CREATE OR REPLACE FUNCTION get_dependency_tree(file_path_param TEXT)
RETURNS TABLE (
    depth INTEGER,
    file_id UUID,
    file_path TEXT,
    dependency_type TEXT
)
LANGUAGE sql
AS $$
    WITH RECURSIVE deps AS (
        -- Base case: the file itself
        SELECT 
            0 as depth,
            pa.id as file_id,
            pa.file_path,
            'root' as dependency_type
        FROM project_archive pa
        WHERE pa.file_path = file_path_param
        
        UNION ALL
        
        -- Recursive case: files that this file imports
        SELECT 
            d.depth + 1,
            pa2.id,
            pa2.file_path,
            'import' as dependency_type
        FROM deps d
        JOIN file_dependencies fd ON fd.file_id = d.file_id
        JOIN project_archive pa2 ON pa2.file_path = ANY(fd.imports)
        WHERE d.depth < 10 -- Prevent infinite recursion
    )
    SELECT * FROM deps;
$$;

-- Function to calculate file importance
CREATE OR REPLACE FUNCTION calculate_file_importance(file_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    importance INTEGER := 0;
    import_count INTEGER;
    is_entry BOOLEAN;
    file_size_kb INTEGER;
BEGIN
    -- Get basic file info
    SELECT 
        COALESCE(array_length(fd.imported_by, 1), 0),
        fd.is_entry_point,
        COALESCE(pa.file_size / 1024, 0)
    INTO import_count, is_entry, file_size_kb
    FROM project_archive pa
    LEFT JOIN file_dependencies fd ON fd.file_id = pa.id
    WHERE pa.id = file_id_param;
    
    -- Calculate importance score
    importance := 0;
    
    -- Entry points are very important
    IF is_entry THEN
        importance := importance + 50;
    END IF;
    
    -- Files imported by many others are important
    importance := importance + LEAST(import_count * 5, 30);
    
    -- Larger files (within reason) may be more important
    importance := importance + LEAST(file_size_kb / 10, 10);
    
    -- Cap at 100
    importance := LEAST(importance, 100);
    
    RETURN importance;
END;
$$;

-- Trigger to automatically calculate importance when files are categorized
CREATE OR REPLACE FUNCTION auto_calculate_importance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.importance_score := calculate_file_importance(NEW.file_id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_importance
    BEFORE INSERT OR UPDATE ON file_categories
    FOR EACH ROW
    EXECUTE FUNCTION auto_calculate_importance();

-- Create a view for easy file analysis
CREATE VIEW file_analysis AS
SELECT 
    pa.id,
    pa.file_path,
    pa.file_name,
    pa.file_type,
    pa.file_size,
    pa.archived_at,
    fc.category,
    fc.subcategory,
    fc.importance_score,
    fc.is_active,
    COALESCE(array_length(fd.imports, 1), 0) as import_count,
    COALESCE(array_length(fd.imported_by, 1), 0) as imported_by_count,
    fd.is_entry_point,
    CASE 
        WHEN EXISTS (SELECT 1 FROM duplicate_files df WHERE df.duplicate_file_id = pa.id) 
        THEN TRUE 
        ELSE FALSE 
    END as is_duplicate
FROM project_archive pa
LEFT JOIN file_categories fc ON fc.file_id = pa.id
LEFT JOIN file_dependencies fd ON fd.file_id = pa.id;

-- Grant necessary permissions (adjust as needed)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE project_archive IS 'Main table storing all archived project files with content and metadata';
COMMENT ON TABLE file_dependencies IS 'Tracks import/export relationships between files';
COMMENT ON TABLE file_categories IS 'Classification and importance scoring for archived files';
COMMENT ON TABLE duplicate_files IS 'Analysis of duplicate files with recommendations';
COMMENT ON TABLE restoration_log IS 'Audit trail of file restoration activities';
COMMENT ON TABLE archive_metadata IS 'High-level statistics and metadata about archive operations';
COMMENT ON FUNCTION search_archived_files IS 'Full-text search through archived file content';
COMMENT ON FUNCTION get_dependency_tree IS 'Recursively find all dependencies of a given file';
COMMENT ON FUNCTION calculate_file_importance IS 'Calculate importance score based on usage and characteristics';
-- Routing outcomes table for TRM training data
-- Stores every routing decision with outcome for continuous learning

CREATE TABLE IF NOT EXISTS routing_outcomes (
    id SERIAL PRIMARY KEY,
    prompt TEXT NOT NULL,
    policy JSONB NOT NULL,
    selected_model VARCHAR(255),
    latency_ms INTEGER,
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    user_feedback INTEGER CHECK (user_feedback BETWEEN 1 AND 5),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (see routing_outcomes_indexes.sql)

-- Retention policy: archive old data
-- Run this monthly or set up pg_cron
COMMENT ON TABLE routing_outcomes IS 
'Training data for TRM routing. Archive records >90 days to routing_outcomes_archive.';

-- Optional: Auto-archival (requires pg_cron extension)
-- CREATE TABLE routing_outcomes_archive (LIKE routing_outcomes INCLUDING ALL);
-- 
-- -- Move old data monthly
-- INSERT INTO routing_outcomes_archive 
-- SELECT * FROM routing_outcomes 
-- WHERE created_at < NOW() - INTERVAL '90 days';
-- 
-- DELETE FROM routing_outcomes 
-- WHERE created_at < NOW() - INTERVAL '90 days';


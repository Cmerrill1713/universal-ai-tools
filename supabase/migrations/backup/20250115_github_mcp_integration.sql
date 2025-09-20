-- GitHub MCP Integration Database Schema
-- Comprehensive tables for storing GitHub data and analysis

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- GitHub Repositories Table
CREATE TABLE IF NOT EXISTS github_repositories (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(500) NOT NULL UNIQUE,
    description TEXT,
    html_url TEXT,
    clone_url TEXT,
    language VARCHAR(100),
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    open_issues INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    pushed_at TIMESTAMP WITH TIME ZONE,
    owner_login VARCHAR(255) NOT NULL,
    owner_id BIGINT,
    data JSONB,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at_db TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitHub Issues Table
CREATE TABLE IF NOT EXISTS github_issues (
    id BIGINT PRIMARY KEY,
    number INTEGER NOT NULL,
    repository VARCHAR(500) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state VARCHAR(20) NOT NULL CHECK (state IN ('open', 'closed')),
    labels TEXT[],
    assignees TEXT[],
    author VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    html_url TEXT,
    comments INTEGER DEFAULT 0,
    data JSONB,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at_db TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(repository, number)
);

-- GitHub Pull Requests Table
CREATE TABLE IF NOT EXISTS github_pull_requests (
    id BIGINT PRIMARY KEY,
    number INTEGER NOT NULL,
    repository VARCHAR(500) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state VARCHAR(20) NOT NULL CHECK (state IN ('open', 'closed', 'merged')),
    head_ref VARCHAR(255) NOT NULL,
    base_ref VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    merged_at TIMESTAMP WITH TIME ZONE,
    html_url TEXT,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    changed_files INTEGER DEFAULT 0,
    data JSONB,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at_db TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(repository, number)
);

-- GitHub Commits Table
CREATE TABLE IF NOT EXISTS github_commits (
    sha VARCHAR(40) PRIMARY KEY,
    repository VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    author_name VARCHAR(255),
    author_email VARCHAR(255),
    author_login VARCHAR(255),
    committer_name VARCHAR(255),
    committer_email VARCHAR(255),
    date TIMESTAMP WITH TIME ZONE,
    html_url TEXT,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    data JSONB,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at_db TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitHub Data Storage Table (for general data)
CREATE TABLE IF NOT EXISTS github_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_type VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    repository_id VARCHAR(500),
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitHub Analysis Results Table
CREATE TABLE IF NOT EXISTS github_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository VARCHAR(500) NOT NULL,
    analysis_type VARCHAR(100) NOT NULL,
    analysis_data JSONB NOT NULL,
    health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(repository, analysis_type, DATE(created_at))
);

-- GitHub Webhooks Table (for tracking webhook events)
CREATE TABLE IF NOT EXISTS github_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository VARCHAR(500) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitHub Users Table (for contributor tracking)
CREATE TABLE IF NOT EXISTS github_users (
    id BIGINT PRIMARY KEY,
    login VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    email VARCHAR(255),
    avatar_url TEXT,
    html_url TEXT,
    company VARCHAR(255),
    blog TEXT,
    location VARCHAR(255),
    bio TEXT,
    public_repos INTEGER DEFAULT 0,
    public_gists INTEGER DEFAULT 0,
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    data JSONB,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at_db TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitHub Repository Contributors Table
CREATE TABLE IF NOT EXISTS github_contributors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository VARCHAR(500) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES github_users(id),
    contributions INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(repository, user_id)
);

-- GitHub Repository Languages Table
CREATE TABLE IF NOT EXISTS github_languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository VARCHAR(500) NOT NULL,
    language VARCHAR(100) NOT NULL,
    bytes BIGINT NOT NULL,
    percentage DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(repository, language)
);

-- GitHub Repository Topics Table
CREATE TABLE IF NOT EXISTS github_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository VARCHAR(500) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(repository, topic)
);

-- GitHub Repository Releases Table
CREATE TABLE IF NOT EXISTS github_releases (
    id BIGINT PRIMARY KEY,
    repository VARCHAR(500) NOT NULL,
    tag_name VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    body TEXT,
    draft BOOLEAN DEFAULT FALSE,
    prerelease BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    author VARCHAR(255),
    html_url TEXT,
    download_count INTEGER DEFAULT 0,
    data JSONB,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at_db TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(repository, tag_name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_github_repositories_full_name ON github_repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_github_repositories_owner ON github_repositories(owner_login);
CREATE INDEX IF NOT EXISTS idx_github_repositories_language ON github_repositories(language);
CREATE INDEX IF NOT EXISTS idx_github_repositories_stars ON github_repositories(stars DESC);
CREATE INDEX IF NOT EXISTS idx_github_repositories_updated ON github_repositories(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_github_issues_repository ON github_issues(repository);
CREATE INDEX IF NOT EXISTS idx_github_issues_state ON github_issues(state);
CREATE INDEX IF NOT EXISTS idx_github_issues_author ON github_issues(author);
CREATE INDEX IF NOT EXISTS idx_github_issues_created ON github_issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_github_issues_labels ON github_issues USING GIN(labels);

CREATE INDEX IF NOT EXISTS idx_github_pull_requests_repository ON github_pull_requests(repository);
CREATE INDEX IF NOT EXISTS idx_github_pull_requests_state ON github_pull_requests(state);
CREATE INDEX IF NOT EXISTS idx_github_pull_requests_author ON github_pull_requests(author);
CREATE INDEX IF NOT EXISTS idx_github_pull_requests_created ON github_pull_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_github_commits_repository ON github_commits(repository);
CREATE INDEX IF NOT EXISTS idx_github_commits_author ON github_commits(author_login);
CREATE INDEX IF NOT EXISTS idx_github_commits_date ON github_commits(date DESC);

CREATE INDEX IF NOT EXISTS idx_github_data_type ON github_data(data_type);
CREATE INDEX IF NOT EXISTS idx_github_data_repository ON github_data(repository_id);
CREATE INDEX IF NOT EXISTS idx_github_data_tags ON github_data USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_github_data_created ON github_data(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_github_analysis_repository ON github_analysis(repository);
CREATE INDEX IF NOT EXISTS idx_github_analysis_type ON github_analysis(analysis_type);
CREATE INDEX IF NOT EXISTS idx_github_analysis_health ON github_analysis(health_score DESC);

CREATE INDEX IF NOT EXISTS idx_github_webhooks_repository ON github_webhooks(repository);
CREATE INDEX IF NOT EXISTS idx_github_webhooks_event ON github_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_github_webhooks_processed ON github_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_github_webhooks_created ON github_webhooks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_github_users_login ON github_users(login);
CREATE INDEX IF NOT EXISTS idx_github_users_followers ON github_users(followers DESC);

CREATE INDEX IF NOT EXISTS idx_github_contributors_repository ON github_contributors(repository);
CREATE INDEX IF NOT EXISTS idx_github_contributors_user ON github_contributors(user_id);
CREATE INDEX IF NOT EXISTS idx_github_contributors_contributions ON github_contributors(contributions DESC);

CREATE INDEX IF NOT EXISTS idx_github_languages_repository ON github_languages(repository);
CREATE INDEX IF NOT EXISTS idx_github_languages_language ON github_languages(language);
CREATE INDEX IF NOT EXISTS idx_github_languages_bytes ON github_languages(bytes DESC);

CREATE INDEX IF NOT EXISTS idx_github_topics_repository ON github_topics(repository);
CREATE INDEX IF NOT EXISTS idx_github_topics_topic ON github_topics(topic);

CREATE INDEX IF NOT EXISTS idx_github_releases_repository ON github_releases(repository);
CREATE INDEX IF NOT EXISTS idx_github_releases_published ON github_releases(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_github_releases_downloads ON github_releases(download_count DESC);

-- Create full-text search indexes
CREATE INDEX IF NOT EXISTS idx_github_repositories_search ON github_repositories USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_github_issues_search ON github_issues USING GIN(to_tsvector('english', title || ' ' || COALESCE(body, '')));
CREATE INDEX IF NOT EXISTS idx_github_pull_requests_search ON github_pull_requests USING GIN(to_tsvector('english', title || ' ' || COALESCE(body, '')));

-- Create RLS policies
ALTER TABLE github_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_releases ENABLE ROW LEVEL SECURITY;

-- Allow public read access (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access" ON github_repositories FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON github_issues FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON github_pull_requests FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON github_commits FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON github_data FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON github_analysis FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON github_users FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON github_contributors FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON github_languages FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON github_topics FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON github_releases FOR SELECT USING (true);

-- Allow service role to insert/update/delete
CREATE POLICY "Allow service role full access" ON github_repositories FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON github_issues FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON github_pull_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON github_commits FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON github_data FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON github_analysis FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON github_webhooks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON github_users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON github_contributors FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON github_languages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON github_topics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON github_releases FOR ALL USING (auth.role() = 'service_role');

-- Create functions for data cleanup and maintenance
CREATE OR REPLACE FUNCTION cleanup_old_github_data()
RETURNS void AS $$
BEGIN
    -- Delete webhook events older than 30 days
    DELETE FROM github_webhooks 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete old analysis data (keep only last 7 days)
    DELETE FROM github_analysis 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Update last_synced for repositories that haven't been synced in 24 hours
    UPDATE github_repositories 
    SET last_synced = NOW() 
    WHERE last_synced < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create function to get repository health score
CREATE OR REPLACE FUNCTION get_repository_health_score(repo_full_name VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    health_score INTEGER := 0;
    repo_record RECORD;
    issue_stats RECORD;
    pr_stats RECORD;
BEGIN
    -- Get repository data
    SELECT * INTO repo_record FROM github_repositories WHERE full_name = repo_full_name;
    
    IF repo_record IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calculate health score based on various factors
    -- Stars factor (0-30 points)
    health_score := health_score + LEAST(30, FLOOR(LN(repo_record.stars + 1) * 10));
    
    -- Recent activity (0-25 points)
    IF repo_record.updated_at IS NOT NULL THEN
        health_score := health_score + GREATEST(0, 25 - EXTRACT(DAYS FROM NOW() - repo_record.updated_at));
    END IF;
    
    -- Issue health (0-25 points)
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'open') as open_count
    INTO issue_stats
    FROM github_issues 
    WHERE repository = repo_full_name;
    
    IF issue_stats.total > 0 THEN
        health_score := health_score + FLOOR(25 * (1 - issue_stats.open_count::FLOAT / issue_stats.total));
    END IF;
    
    -- PR health (0-20 points)
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'open') as open_count
    INTO pr_stats
    FROM github_pull_requests 
    WHERE repository = repo_full_name;
    
    IF pr_stats.total > 0 THEN
        health_score := health_score + FLOOR(20 * (1 - pr_stats.open_count::FLOAT / pr_stats.total));
    END IF;
    
    RETURN LEAST(100, health_score);
END;
$$ LANGUAGE plpgsql;

-- Create function to search repositories
CREATE OR REPLACE FUNCTION search_github_repositories(
    search_query TEXT,
    language_filter VARCHAR DEFAULT NULL,
    min_stars INTEGER DEFAULT 0,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
    full_name VARCHAR,
    name VARCHAR,
    description TEXT,
    language VARCHAR,
    stars INTEGER,
    forks INTEGER,
    open_issues INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE,
    health_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.full_name,
        r.name,
        r.description,
        r.language,
        r.stars,
        r.forks,
        r.open_issues,
        r.updated_at,
        get_repository_health_score(r.full_name) as health_score
    FROM github_repositories r
    WHERE 
        (search_query IS NULL OR to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')) @@ plainto_tsquery('english', search_query))
        AND (language_filter IS NULL OR r.language = language_filter)
        AND r.stars >= min_stars
    ORDER BY r.stars DESC, r.updated_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get repository statistics
CREATE OR REPLACE FUNCTION get_repository_stats(repo_full_name VARCHAR)
RETURNS TABLE(
    total_issues INTEGER,
    open_issues INTEGER,
    closed_issues INTEGER,
    total_prs INTEGER,
    open_prs INTEGER,
    merged_prs INTEGER,
    closed_prs INTEGER,
    total_commits BIGINT,
    contributors_count BIGINT,
    languages_count BIGINT,
    releases_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM github_issues WHERE repository = repo_full_name)::INTEGER as total_issues,
        (SELECT COUNT(*) FROM github_issues WHERE repository = repo_full_name AND state = 'open')::INTEGER as open_issues,
        (SELECT COUNT(*) FROM github_issues WHERE repository = repo_full_name AND state = 'closed')::INTEGER as closed_issues,
        (SELECT COUNT(*) FROM github_pull_requests WHERE repository = repo_full_name)::INTEGER as total_prs,
        (SELECT COUNT(*) FROM github_pull_requests WHERE repository = repo_full_name AND state = 'open')::INTEGER as open_prs,
        (SELECT COUNT(*) FROM github_pull_requests WHERE repository = repo_full_name AND state = 'merged')::INTEGER as merged_prs,
        (SELECT COUNT(*) FROM github_pull_requests WHERE repository = repo_full_name AND state = 'closed')::INTEGER as closed_prs,
        (SELECT COUNT(*) FROM github_commits WHERE repository = repo_full_name) as total_commits,
        (SELECT COUNT(*) FROM github_contributors WHERE repository = repo_full_name) as contributors_count,
        (SELECT COUNT(*) FROM github_languages WHERE repository = repo_full_name) as languages_count,
        (SELECT COUNT(*) FROM github_releases WHERE repository = repo_full_name) as releases_count;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job for cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-github-data', '0 2 * * *', 'SELECT cleanup_old_github_data();');

-- Insert sample data for testing
INSERT INTO github_repositories (
    id, name, full_name, description, html_url, clone_url, language, 
    stars, forks, open_issues, created_at, updated_at, pushed_at, 
    owner_login, owner_id, data
) VALUES (
    123456789, 'universal-ai-tools', 'Cmerrill1713/universal-ai-tools', 
    'Universal AI Tools - Comprehensive AI platform with multi-language support',
    'https://github.com/Cmerrill1713/universal-ai-tools',
    'https://github.com/Cmerrill1713/universal-ai-tools.git',
    'TypeScript', 100, 25, 5, NOW() - INTERVAL '1 year', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 hour',
    'Cmerrill1713', 987654321, '{"sample": "data"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW github_repository_summary AS
SELECT 
    r.full_name,
    r.name,
    r.description,
    r.language,
    r.stars,
    r.forks,
    r.open_issues,
    r.updated_at,
    get_repository_health_score(r.full_name) as health_score,
    COALESCE(stats.total_issues, 0) as total_issues,
    COALESCE(stats.open_issues, 0) as open_issues_count,
    COALESCE(stats.total_prs, 0) as total_prs,
    COALESCE(stats.open_prs, 0) as open_prs_count,
    COALESCE(stats.total_commits, 0) as total_commits,
    COALESCE(stats.contributors_count, 0) as contributors_count
FROM github_repositories r
LEFT JOIN LATERAL get_repository_stats(r.full_name) stats ON true;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Grant service role full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

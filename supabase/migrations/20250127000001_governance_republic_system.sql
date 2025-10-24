-- Governance and Republic System for Universal AI Tools
-- Integrates with chat, neuroforge, and UAT-prompt for democratic decision-making

-- Governance Proposals Table
CREATE TABLE IF NOT EXISTS governance_proposals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('platform', 'feature', 'policy', 'resource', 'governance')),
    proposer TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'voting', 'passed', 'rejected', 'expired')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    neural_analysis JSONB DEFAULT '{}',
    uat_prompt_analysis JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    voting_deadline TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Governance Votes Table
CREATE TABLE IF NOT EXISTS governance_votes (
    id TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL REFERENCES governance_proposals(id) ON DELETE CASCADE,
    voter TEXT NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    reasoning TEXT NOT NULL,
    neural_insights JSONB DEFAULT '{}',
    uat_prompt_insights JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Governance Consensus Table
CREATE TABLE IF NOT EXISTS governance_consensus (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id TEXT NOT NULL REFERENCES governance_proposals(id) ON DELETE CASCADE,
    consensus TEXT NOT NULL CHECK (consensus IN ('achieved', 'failed', 'partial')),
    agreement DECIMAL(3,2) NOT NULL CHECK (agreement >= 0 AND agreement <= 1),
    neural_consensus DECIMAL(3,2) NOT NULL CHECK (neural_consensus >= 0 AND neural_consensus <= 1),
    uat_prompt_consensus DECIMAL(3,2) NOT NULL CHECK (uat_prompt_consensus >= 0 AND uat_prompt_consensus <= 1),
    recommendations TEXT[] DEFAULT '{}',
    next_steps TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Republic Citizens Table
CREATE TABLE IF NOT EXISTS republic_citizens (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'senator', 'consul', 'dictator')),
    voting_power INTEGER NOT NULL DEFAULT 10,
    reputation INTEGER NOT NULL DEFAULT 100 CHECK (reputation >= 0 AND reputation <= 1000),
    neural_contribution INTEGER NOT NULL DEFAULT 0,
    uat_prompt_contribution INTEGER NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Republic Contributions Table
CREATE TABLE IF NOT EXISTS republic_contributions (
    id TEXT PRIMARY KEY,
    citizen_id TEXT NOT NULL REFERENCES republic_citizens(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('proposal', 'vote', 'discussion', 'implementation', 'review')),
    description TEXT NOT NULL,
    impact INTEGER NOT NULL DEFAULT 0,
    neural_value INTEGER NOT NULL DEFAULT 0,
    uat_prompt_value INTEGER NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    recognized BOOLEAN DEFAULT false
);

-- Republic Achievements Table
CREATE TABLE IF NOT EXISTS republic_achievements (
    id TEXT PRIMARY KEY,
    citizen_id TEXT NOT NULL REFERENCES republic_citizens(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('governance', 'technical', 'community', 'innovation')),
    points INTEGER NOT NULL DEFAULT 0,
    neural_points INTEGER NOT NULL DEFAULT 0,
    uat_prompt_points INTEGER NOT NULL DEFAULT 0,
    earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Republic Members Table (alias for citizens with additional metadata)
CREATE TABLE IF NOT EXISTS republic_members (
    id TEXT PRIMARY KEY,
    citizen_id TEXT NOT NULL REFERENCES republic_citizens(id) ON DELETE CASCADE,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    social_links JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Governance Settings Table
CREATE TABLE IF NOT EXISTS governance_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_governance_proposals_status ON governance_proposals(status);
CREATE INDEX IF NOT EXISTS idx_governance_proposals_category ON governance_proposals(category);
CREATE INDEX IF NOT EXISTS idx_governance_proposals_proposer ON governance_proposals(proposer);
CREATE INDEX IF NOT EXISTS idx_governance_proposals_created_at ON governance_proposals(created_at);

CREATE INDEX IF NOT EXISTS idx_governance_votes_proposal_id ON governance_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_governance_votes_voter ON governance_votes(voter);
CREATE INDEX IF NOT EXISTS idx_governance_votes_timestamp ON governance_votes(timestamp);

CREATE INDEX IF NOT EXISTS idx_governance_consensus_proposal_id ON governance_consensus(proposal_id);
CREATE INDEX IF NOT EXISTS idx_governance_consensus_consensus ON governance_consensus(consensus);

CREATE INDEX IF NOT EXISTS idx_republic_citizens_role ON republic_citizens(role);
CREATE INDEX IF NOT EXISTS idx_republic_citizens_reputation ON republic_citizens(reputation);
CREATE INDEX IF NOT EXISTS idx_republic_citizens_is_active ON republic_citizens(is_active);
CREATE INDEX IF NOT EXISTS idx_republic_citizens_last_active ON republic_citizens(last_active);

CREATE INDEX IF NOT EXISTS idx_republic_contributions_citizen_id ON republic_contributions(citizen_id);
CREATE INDEX IF NOT EXISTS idx_republic_contributions_type ON republic_contributions(type);
CREATE INDEX IF NOT EXISTS idx_republic_contributions_timestamp ON republic_contributions(timestamp);

CREATE INDEX IF NOT EXISTS idx_republic_achievements_citizen_id ON republic_achievements(citizen_id);
CREATE INDEX IF NOT EXISTS idx_republic_achievements_category ON republic_achievements(category);
CREATE INDEX IF NOT EXISTS idx_republic_achievements_earned_at ON republic_achievements(earned_at);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_governance_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_republic_citizens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_republic_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_governance_proposals_updated_at
    BEFORE UPDATE ON governance_proposals
    FOR EACH ROW
    EXECUTE FUNCTION update_governance_proposals_updated_at();

CREATE TRIGGER trigger_update_republic_citizens_updated_at
    BEFORE UPDATE ON republic_citizens
    FOR EACH ROW
    EXECUTE FUNCTION update_republic_citizens_updated_at();

CREATE TRIGGER trigger_update_republic_members_updated_at
    BEFORE UPDATE ON republic_members
    FOR EACH ROW
    EXECUTE FUNCTION update_republic_members_updated_at();

-- Create utility functions
CREATE OR REPLACE FUNCTION get_governance_stats()
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'total_proposals', (SELECT COUNT(*) FROM governance_proposals),
        'active_proposals', (SELECT COUNT(*) FROM governance_proposals WHERE status IN ('active', 'voting')),
        'total_votes', (SELECT COUNT(*) FROM governance_votes),
        'total_citizens', (SELECT COUNT(*) FROM republic_citizens),
        'active_citizens', (SELECT COUNT(*) FROM republic_citizens WHERE is_active = true),
        'consensus_rate', (
            SELECT CASE 
                WHEN COUNT(*) = 0 THEN 0
                ELSE COUNT(*) FILTER (WHERE status = 'passed')::DECIMAL / COUNT(*)::DECIMAL
            END
            FROM governance_proposals 
            WHERE status IN ('passed', 'rejected')
        )
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_republic_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    citizen_id TEXT,
    username TEXT,
    role TEXT,
    reputation INTEGER,
    neural_contribution INTEGER,
    uat_prompt_contribution INTEGER,
    total_contributions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.username,
        c.role,
        c.reputation,
        c.neural_contribution,
        c.uat_prompt_contribution,
        COUNT(contrib.id) as total_contributions
    FROM republic_citizens c
    LEFT JOIN republic_contributions contrib ON c.id = contrib.citizen_id
    WHERE c.is_active = true
    GROUP BY c.id, c.username, c.role, c.reputation, c.neural_contribution, c.uat_prompt_contribution
    ORDER BY c.reputation DESC, total_contributions DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_democratic_health()
RETURNS DECIMAL AS $$
DECLARE
    participation_rate DECIMAL;
    reputation_health DECIMAL;
    activity_health DECIMAL;
    total_citizens INTEGER;
    active_citizens INTEGER;
    avg_reputation DECIMAL;
    recent_contributions INTEGER;
BEGIN
    -- Calculate participation rate
    SELECT COUNT(*) INTO total_citizens FROM republic_citizens;
    SELECT COUNT(*) INTO active_citizens FROM republic_citizens WHERE is_active = true;
    
    participation_rate := CASE 
        WHEN total_citizens = 0 THEN 0
        ELSE active_citizens::DECIMAL / total_citizens::DECIMAL
    END;
    
    -- Calculate reputation health
    SELECT AVG(reputation) INTO avg_reputation FROM republic_citizens WHERE is_active = true;
    reputation_health := LEAST(1.0, COALESCE(avg_reputation, 0) / 500.0);
    
    -- Calculate activity health (contributions in last 7 days)
    SELECT COUNT(*) INTO recent_contributions 
    FROM republic_contributions 
    WHERE timestamp > NOW() - INTERVAL '7 days';
    
    activity_health := LEAST(1.0, recent_contributions::DECIMAL / GREATEST(total_citizens * 0.1, 1));
    
    -- Return democratic health score
    RETURN (participation_rate + reputation_health + activity_health) / 3.0;
END;
$$ LANGUAGE plpgsql;

-- Insert default governance settings
INSERT INTO governance_settings (setting_key, setting_value, description) VALUES
('voting_threshold', '0.5', 'Minimum agreement threshold for proposal approval'),
('consensus_threshold', '0.7', 'Consensus threshold for democratic decisions'),
('proposal_timeout', '604800', 'Proposal timeout in seconds (7 days)'),
('enable_neural_voting', 'true', 'Enable neural network analysis for voting'),
('enable_uat_prompt_analysis', 'true', 'Enable UAT-prompt analysis for proposals'),
('reputation_decay_rate', '0.01', 'Daily reputation decay rate'),
('voting_power_multiplier', '1.0', 'Multiplier for voting power calculations')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert sample data for testing
INSERT INTO republic_citizens (id, username, email, role, voting_power, reputation, neural_contribution, uat_prompt_contribution) VALUES
('citizen_demo_1', 'alex_governor', 'alex@example.com', 'consul', 100, 750, 150, 200),
('citizen_demo_2', 'neural_net', 'neural@example.com', 'senator', 50, 400, 300, 50),
('citizen_demo_3', 'prompt_master', 'prompt@example.com', 'senator', 50, 350, 25, 275),
('citizen_demo_4', 'democracy_builder', 'demo@example.com', 'citizen', 10, 150, 75, 100)
ON CONFLICT (id) DO NOTHING;

INSERT INTO governance_proposals (id, title, description, category, proposer, status, priority, expires_at, voting_deadline) VALUES
('prop_demo_1', 'Implement Neural Voting System', 'Add neural network analysis to all voting processes for better decision making', 'feature', 'citizen_demo_1', 'voting', 'high', NOW() + INTERVAL '5 days', NOW() + INTERVAL '3 days'),
('prop_demo_2', 'UAT-Prompt Integration', 'Integrate UAT-prompt engineering with governance proposals for better analysis', 'platform', 'citizen_demo_3', 'active', 'medium', NOW() + INTERVAL '7 days', NOW() + INTERVAL '5 days'),
('prop_demo_3', 'Republic Expansion', 'Expand the republic system to include more democratic features', 'governance', 'citizen_demo_2', 'draft', 'low', NOW() + INTERVAL '10 days', NOW() + INTERVAL '7 days')
ON CONFLICT (id) DO NOTHING;

-- Add comments
COMMENT ON TABLE governance_proposals IS 'Stores governance proposals with neural and UAT-prompt analysis';
COMMENT ON TABLE governance_votes IS 'Stores individual votes with AI-enhanced analysis';
COMMENT ON TABLE governance_consensus IS 'Stores consensus results from democratic decision-making';
COMMENT ON TABLE republic_citizens IS 'Stores republic citizens with roles, reputation, and contributions';
COMMENT ON TABLE republic_contributions IS 'Tracks citizen contributions to the republic';
COMMENT ON TABLE republic_achievements IS 'Stores citizen achievements and recognition';
COMMENT ON TABLE republic_members IS 'Extended citizen profiles with additional metadata';
COMMENT ON TABLE governance_settings IS 'Configuration settings for the governance system';

COMMENT ON COLUMN governance_proposals.neural_analysis IS 'Neuroforge neural network analysis results';
COMMENT ON COLUMN governance_proposals.uat_prompt_analysis IS 'UAT-prompt engineering analysis results';
COMMENT ON COLUMN governance_votes.neural_insights IS 'Neural network insights for the vote';
COMMENT ON COLUMN governance_votes.uat_prompt_insights IS 'UAT-prompt insights for the vote';
COMMENT ON COLUMN republic_citizens.neural_contribution IS 'Contribution score from neural network activities';
COMMENT ON COLUMN republic_citizens.uat_prompt_contribution IS 'Contribution score from UAT-prompt activities';
/**
 * Governance Router - Democratic Decision Making API
 * Integrates with chat, neuroforge, and UAT-prompt for collective intelligence
 */

import express from 'express';
import { GovernanceService, GovernanceConfig } from '../services/governance-service';
import { RepublicService, RepublicConfig } from '../services/republic-service';

const router = express.Router();

// Initialize services
const governanceConfig: GovernanceConfig = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_ANON_KEY || '',
  votingThreshold: parseFloat(process.env.GOVERNANCE_VOTING_THRESHOLD || '0.5'),
  consensusThreshold: parseFloat(process.env.GOVERNANCE_CONSENSUS_THRESHOLD || '0.7'),
  proposalTimeout: parseInt(process.env.GOVERNANCE_PROPOSAL_TIMEOUT || '604800'), // 7 days
  enableNeuralVoting: process.env.ENABLE_NEURAL_VOTING !== 'false',
  enableUATPromptAnalysis: process.env.ENABLE_UAT_PROMPT_ANALYSIS !== 'false'
};

const republicConfig: RepublicConfig = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_ANON_KEY || '',
  enableNeuralCitizenship: process.env.ENABLE_NEURAL_CITIZENSHIP !== 'false',
  enableUATPromptCitizenship: process.env.ENABLE_UAT_PROMPT_CITIZENSHIP !== 'false',
  reputationDecayRate: parseFloat(process.env.REPUTATION_DECAY_RATE || '0.01'),
  votingPowerMultiplier: parseFloat(process.env.VOTING_POWER_MULTIPLIER || '1.0')
};

const governanceService = new GovernanceService(governanceConfig);
const republicService = new RepublicService(republicConfig);

// Governance Proposals Routes

/**
 * Create a new governance proposal
 * POST /api/governance/proposals
 */
router.post('/proposals', async (req, res) => {
  try {
    const proposal = await governanceService.createProposal(req.body);
    res.status(201).json({
      success: true,
      data: proposal,
      message: 'Proposal created successfully'
    });
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to create proposal'
    });
  }
});

/**
 * Get all governance proposals
 * GET /api/governance/proposals
 */
router.get('/proposals', async (req, res) => {
  try {
    const { data: proposals, error } = await governanceService.supabase
      .from('governance_proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch proposals: ${error.message}`);
    }

    res.json({
      success: true,
      data: proposals || [],
      message: 'Proposals retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch proposals'
    });
  }
});

/**
 * Get a specific proposal
 * GET /api/governance/proposals/:id
 */
router.get('/proposals/:id', async (req, res) => {
  try {
    const { data: proposal, error } = await governanceService.supabase
      .from('governance_proposals')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch proposal: ${error.message}`);
    }

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    res.json({
      success: true,
      data: proposal,
      message: 'Proposal retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch proposal'
    });
  }
});

// Voting Routes

/**
 * Submit a vote
 * POST /api/governance/votes
 */
router.post('/votes', async (req, res) => {
  try {
    const vote = await governanceService.submitVote(req.body);
    res.status(201).json({
      success: true,
      data: vote,
      message: 'Vote submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to submit vote'
    });
  }
});

/**
 * Get votes for a proposal
 * GET /api/governance/proposals/:id/votes
 */
router.get('/proposals/:id/votes', async (req, res) => {
  try {
    const { data: votes, error } = await governanceService.supabase
      .from('governance_votes')
      .select('*')
      .eq('proposal_id', req.params.id)
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch votes: ${error.message}`);
    }

    res.json({
      success: true,
      data: votes || [],
      message: 'Votes retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch votes'
    });
  }
});

// Consensus Routes

/**
 * Build consensus for a proposal
 * POST /api/governance/proposals/:id/consensus
 */
router.post('/proposals/:id/consensus', async (req, res) => {
  try {
    const consensus = await governanceService.buildConsensus(req.params.id);
    res.json({
      success: true,
      data: consensus,
      message: 'Consensus built successfully'
    });
  } catch (error) {
    console.error('Error building consensus:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to build consensus'
    });
  }
});

// Republic Citizens Routes

/**
 * Register a new citizen
 * POST /api/governance/citizens
 */
router.post('/citizens', async (req, res) => {
  try {
    const citizen = await republicService.registerCitizen(req.body);
    res.status(201).json({
      success: true,
      data: citizen,
      message: 'Citizen registered successfully'
    });
  } catch (error) {
    console.error('Error registering citizen:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to register citizen'
    });
  }
});

/**
 * Get all citizens
 * GET /api/governance/citizens
 */
router.get('/citizens', async (req, res) => {
  try {
    const { data: citizens, error } = await republicService.supabase
      .from('republic_citizens')
      .select('*')
      .order('reputation', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch citizens: ${error.message}`);
    }

    res.json({
      success: true,
      data: citizens || [],
      message: 'Citizens retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching citizens:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch citizens'
    });
  }
});

/**
 * Get citizen leaderboard
 * GET /api/governance/citizens/leaderboard
 */
router.get('/citizens/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await republicService.getCitizenLeaderboard(limit);
    
    res.json({
      success: true,
      data: leaderboard,
      message: 'Leaderboard retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch leaderboard'
    });
  }
});

/**
 * Record a contribution
 * POST /api/governance/contributions
 */
router.post('/contributions', async (req, res) => {
  try {
    const contribution = await republicService.recordContribution(req.body);
    res.status(201).json({
      success: true,
      data: contribution,
      message: 'Contribution recorded successfully'
    });
  } catch (error) {
    console.error('Error recording contribution:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to record contribution'
    });
  }
});

// Statistics Routes

/**
 * Get governance statistics
 * GET /api/governance/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await governanceService.getGovernanceStats();
    res.json({
      success: true,
      data: stats,
      message: 'Governance statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching governance stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch governance statistics'
    });
  }
});

/**
 * Get republic statistics
 * GET /api/governance/republic/stats
 */
router.get('/republic/stats', async (req, res) => {
  try {
    const stats = await republicService.getRepublicStats();
    res.json({
      success: true,
      data: stats,
      message: 'Republic statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching republic stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch republic statistics'
    });
  }
});

// Health Check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        governance: 'available',
        republic: 'available',
        neuralVoting: governanceConfig.enableNeuralVoting,
        uatPromptAnalysis: governanceConfig.enableUATPromptAnalysis
      }
    },
    message: 'Governance system is healthy'
  });
});

export default router;
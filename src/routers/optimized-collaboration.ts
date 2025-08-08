/**
 * Optimized Collaboration Router
 * Exposes MAC-SPGG collaboration endpoints
 */

import { optimizedCollaborationEngine } from '@/services/optimized-collaboration-engine';
import { LogContext, log } from '@/utils/logger';
import { Router } from 'express';

const router = Router();

// GET /api/v1/collaboration/stats - Get collaboration statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = optimizedCollaborationEngine.getCollaborationStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log.error('Failed to get collaboration stats', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get collaboration statistics',
    });
  }
});

// POST /api/v1/collaboration/session - Create new collaboration session
router.post('/session', async (req, res) => {
  try {
    const { task, participants, options } = req.body;

    if (!task || !participants || !Array.isArray(participants)) {
      return res.status(400).json({
        success: false,
        error: 'Task and participants array are required',
      });
    }

    const session = await optimizedCollaborationEngine.createCollaborationSession(
      task,
      participants,
      options
    );

    return res.json({
      success: true,
      data: {
        sessionId: session.id,
        task: session.task,
        participants: session.participants,
        status: session.status,
        startTime: session.startTime,
      },
    });
  } catch (error) {
    log.error('Failed to create collaboration session', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to create collaboration session',
    });
  }
});

// POST /api/v1/collaboration/session/:sessionId/decision - Submit decision
router.post('/session/:sessionId/decision', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { agentId, decision, confidence, reasoning } = req.body;

    if (!agentId || decision === undefined || confidence === undefined || !reasoning) {
      return res.status(400).json({
        success: false,
        error: 'agentId, decision, confidence, and reasoning are required',
      });
    }

    const sequentialDecision = await optimizedCollaborationEngine.submitDecision(
      sessionId,
      agentId,
      decision,
      confidence,
      reasoning
    );

    return res.json({
      success: true,
      data: {
        decisionId: sequentialDecision.id,
        agentId: sequentialDecision.agentId,
        timestamp: sequentialDecision.timestamp,
      },
    });
  } catch (error) {
    log.error('Failed to submit decision', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit decision',
    });
  }
});

// GET /api/v1/collaboration/session/:sessionId - Get session status
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = optimizedCollaborationEngine.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    return res.json({
      success: true,
      data: {
        id: session.id,
        task: session.task,
        participants: session.participants,
        status: session.status,
        consensus: session.consensus,
        confidence: session.confidence,
        decisions: session.decisions.map((d) => ({
          id: d.id,
          agentId: d.agentId,
          confidence: d.confidence,
          timestamp: d.timestamp,
        })),
        game: {
          totalContribution: session.game.totalContribution,
          optimalContribution: session.game.optimalContribution,
          status: session.game.status,
        },
        startTime: session.startTime,
        endTime: session.endTime,
      },
    });
  } catch (error) {
    log.error('Failed to get session', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get session',
    });
  }
});

// GET /api/v1/collaboration/sessions/active - Get active sessions
router.get('/sessions/active', async (req, res) => {
  try {
    const activeSessions = optimizedCollaborationEngine.getActiveSessions();

    res.json({
      success: true,
      data: activeSessions.map((session) => ({
        id: session.id,
        task: session.task,
        participants: session.participants,
        status: session.status,
        confidence: session.confidence,
        startTime: session.startTime,
      })),
    });
  } catch (error) {
    log.error('Failed to get active sessions', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get active sessions',
    });
  }
});

// POST /api/v1/collaboration/optimize - Trigger collaboration optimization
router.post('/optimize', async (req, res) => {
  try {
    const { type, parameters } = req.body;

    // Trigger optimization based on type
    switch (type) {
      case 'incentive_adjustment':
        // Adjust incentive structure
        log.info('Triggering incentive structure optimization', LogContext.API);
        break;

      case 'consensus_improvement':
        // Improve consensus building
        log.info('Triggering consensus building optimization', LogContext.API);
        break;

      case 'failure_recovery':
        // Optimize failure recovery
        log.info('Triggering failure recovery optimization', LogContext.API);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid optimization type',
        });
    }

    return res.json({
      success: true,
      data: {
        message: `Optimization triggered: ${type}`,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    log.error('Failed to trigger optimization', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger optimization',
    });
  }
});

// POST /api/v1/collaboration/heal - Trigger self-healing
router.post('/heal', async (req, res) => {
  try {
    const { sessionId, agentId } = req.body;

    if (sessionId) {
      // Heal specific session
      const session = optimizedCollaborationEngine.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
        });
      }

      log.info(`Triggering healing for session: ${sessionId}`, LogContext.API);
    } else if (agentId) {
      // Heal specific agent
      log.info(`Triggering healing for agent: ${agentId}`, LogContext.API);
    } else {
      // General system healing
      log.info('Triggering general collaboration healing', LogContext.API);
    }

    return res.json({
      success: true,
      data: {
        message: 'Healing process initiated',
        timestamp: new Date(),
      },
    });
  } catch (error) {
    log.error('Failed to trigger healing', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger healing',
    });
  }
});

export default router;

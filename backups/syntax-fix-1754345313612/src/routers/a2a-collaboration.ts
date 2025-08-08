/**
 * A2A Collaboration Router - Agent-to-Agent Communication API;
 * Enables direct collaboration between AI agents;
 * Competitive advantage: Distributed agent collective intelligence;
 */

import { Router } from 'express';
import { AgentRegistry } from '@/agents/agent-registry';
import { a2aMesh } from '@/services/a2a-communication-mesh';
import { LogContext, log } from '@/utils/logger';

// Create singleton instance;
const agentRegistry = new AgentRegistry();

const router = Router();

/**
 * @route POST /api/v1/a2a/collaboration/request;
 * @desc Request collaboration between multiple agents;
 */
router?.post('/collaboration/request', async (req, res) => {
  try {
    const { task, requiredCapabilities, teamSize = 3, initiator = 'api' } = req?.body;

    if (!task || !requiredCapabilities) {
      res?.status(400).json({
        success: false,
        error: 'Task and required capabilities are required',
      });
      return;
    }

    log?.info('🤝 A2A collaboration request received', LogContext?.API, {
      task: task?.substring(0, 100),
      capabilities: requiredCapabilities?.length,
      teamSize,
    });

    const sessionId = await agentRegistry?.requestCollaboration(
      task,
      requiredCapabilities,
      teamSize,
      initiator;
    );

    // Get collaboration details;
    const meshStatus = agentRegistry?.getMeshStatus();
    const selectedTeam = a2aMesh?.findAgentTeam(requiredCapabilities, teamSize);

    res?.json({
      success: true,
      data: {
        sessionId,
        team: selectedTeam,
        task,
        estimatedDuration: '30 seconds',
        meshStatus,
      },
      message: `Collaboration session ${sessionId} started with ${selectedTeam?.length} agents`,
    });
  } catch (error) {
    log?.error('❌ A2A collaboration request failed', LogContext?.API, { error });
    res?.status(500).json({
      success: false,
      error: error instanceof Error ? error?.message : 'Collaboration request failed',
    });
  }
});

/**
 * @route POST /api/v1/a2a/knowledge/share;
 * @desc Share knowledge between agents;
 */
router?.post('/knowledge/share', async (req, res) => {
  try {
    const { fromAgent, knowledgeType, data, relevantCapabilities, confidence = 0?.8 } = req?.body;

    if (!fromAgent || !knowledgeType || !data) {
      res?.status(400).json({
        success: false,
        error: 'fromAgent, knowledgeType, and data are required',
      });
      return;
    }

    log?.info('🧠 Knowledge sharing request', LogContext?.API, {
      from: fromAgent,
      type: knowledgeType,
      confidence,
    });

    await agentRegistry?.shareKnowledge(
      fromAgent,
      knowledgeType,
      data,
      relevantCapabilities || [],
      confidence,
    );

    // Get recipient info;
    const recipients = a2aMesh;
      .getAgentConnections()
      .filter(
        (conn) =>
          relevantCapabilities?.some((cap: string) =>
            conn?.capabilities?.some((agentCap) => agentCap?.toLowerCase().includes(cap?.toLowerCase()))
          ) || relevantCapabilities?.length === 0,
      );

    res?.json({
      success: true,
      data: {
        sharedWith: recipients?.length,
        recipients: recipients?.map((r) => r?.agentName),
        knowledgeType,
        confidence,
      },
      message: `Knowledge shared with ${recipients?.length} relevant agents`,
    });
  } catch (error) {
    log?.error('❌ Knowledge sharing failed', LogContext?.API, { error });
    res?.status(500).json({
      success: false,
      error: error instanceof Error ? error?.message : 'Knowledge sharing failed',
    });
  }
});

/**
 * @route GET /api/v1/a2a/agents/optimal;
 * @desc Find optimal agent for specific capabilities;
 */
router?.get('/agents/optimal', async (req, res) => {
  try {
    const { capabilities } = req?.query;

    if (!capabilities) {
      res?.status(400).json({
        success: false,
        error: 'Capabilities parameter is required',
      });
      return;
    }

    const       capabilityList = Array?.isArray(capabilities)
        ? (capabilities as string[])
        : (capabilities as string).split(',').map((c) => c?.trim());

    const optimalAgent = agentRegistry?.findOptimalAgent(capabilityList);

    if (!optimalAgent) {
      res?.json({
        success: true,
        data: {
          optimalAgent: null,
          reason: 'No agents match the required capabilities',
        },
      });
      return;
    }

    // Get agent details;
    const agentConnections = a2aMesh?.getAgentConnections();
    const agentInfo = agentConnections?.find((conn) => conn?.agentName === optimalAgent);

    res?.json({
      success: true,
      data: {
        optimalAgent,
        agentInfo: agentInfo;
          ? {
              capabilities: agentInfo?.capabilities,
              status: agentInfo?.status,
              trustLevel: agentInfo?.trustLevel,
              collaborationScore: agentInfo?.collaborationScore,
            }
          : null,
        requestedCapabilities: capabilityList,
      },
      message: `Found optimal agent: ${optimalAgent}`,
    });
  } catch (error) {
    log?.error('❌ Optimal agent search failed', LogContext?.API, { error });
    res?.status(500).json({
      success: false,
      error: error instanceof Error ? error?.message : 'Agent search failed',
    });
  }
});

/**
 * @route GET /api/v1/a2a/agents/team;
 * @desc Find optimal team of agents for collaboration;
 */
router?.get('/agents/team', async (req, res) => {
  try {
    const {
      capabilities,       size = 3,
    } = req?.query;

    if (!capabilities) {
      res?.status(400).json({
        success: false,
        error: 'Capabilities parameter is required',
      });
      return;
    }

    const capabilityList = Array?.isArray(capabilities)
      ? (capabilities as string[])
      : (capabilities as string).split(',').map((c) => c?.trim());

    const teamSize = parseInt(size as string, 10);
    const team = a2aMesh?.findAgentTeam(capabilityList, teamSize);

    // Get detailed team information;
    const agentConnections = a2aMesh?.getAgentConnections();
    const teamDetails = team?.map((agentName) => {
      const conn = agentConnections?.find((c) => c?.agentName === agentName);
      return {
        agentName,
        capabilities: conn?.capabilities || [],
        status: conn?.status || 'unknown',
        trustLevel: conn?.trustLevel || 0,
        collaborationScore: conn?.collaborationScore || 0,
      };
    });

    res?.json({
      success: true,
      data: {
        team,
        teamDetails,
        requestedCapabilities: capabilityList,
        requestedSize: teamSize,
        actualSize: team?.length,
      },
      message: `Found team of ${team?.length} agents for collaboration`,
    });
  } catch (error) {
    log?.error('❌ Team formation failed', LogContext?.API, { error });
    res?.status(500).json({
      success: false,
      error: error instanceof Error ? error?.message : 'Team formation failed',
    });
  }
});

/**
 * @route GET /api/v1/a2a/mesh/status;
 * @desc Get current mesh status and statistics;
 */
router?.get('/mesh/status', async (req, res) => {
  try {
    const meshStatus = agentRegistry?.getMeshStatus();
    const agentConnections = a2aMesh?.getAgentConnections();
    const collaborationHistory = a2aMesh?.getCollaborationHistory();

    // Calculate additional statistics;
    const onlineAgents = agentConnections?.filter((conn) => conn?.status === 'online');
    const busyAgents = agentConnections?.filter((conn) => conn?.status === 'busy');
    const offlineAgents = agentConnections?.filter((conn) => conn?.status === 'offline');

    const totalCapabilities = new Set(agentConnections?.flatMap((conn) => conn?.capabilities)).size;

    const averageTrustLevel = agentConnections?.length > 0,
      ? agentConnections?.reduce((sum, conn) => sum + conn?.trustLevel, 0) / agentConnections?.length;
      : 0,

    res?.json({
      success: true,
      data: {
        mesh: meshStatus,
        agents: {
          total: agentConnections?.length,
          online: onlineAgents?.length,
          busy: busyAgents?.length,
          offline: offlineAgents?.length,
          connections: agentConnections?.map((conn) => ({
            name: conn?.agentName,
            status: conn?.status,
            capabilities: conn?.capabilities?.length,
            trustLevel: conn?.trustLevel,
            collaborationScore: conn?.collaborationScore,
            lastSeen: conn?.lastSeen,
          })),
        },
        collaboration: {
          activeSessions: collaborationHistory?.length,
          totalCapabilities,
          averageTrustLevel: Math?.round(averageTrustLevel * 100) / 100,
        },
        timestamp: new Date().toISOString(),
      },
      message: 'A2A mesh status retrieved successfully',
    });
  } catch (error) {
    log?.error('❌ Mesh status retrieval failed', LogContext?.API, { error });
    res?.status(500).json({
      success: false,
      error: error instanceof Error ? error?.message : 'Status retrieval failed',
    });
  }
});

/**
 * @route POST /api/v1/a2a/message/send;
 * @desc Send direct message between agents;
 */
router?.post('/message/send', async (req, res) => {
  try {
    const {
      from,
      to,
      type = 'request',
      payload,
      priority = 'medium',
      requiresResponse = false,
    } = req?.body;

    if (!from || !to || !payload) {
      res?.status(400).json({
        success: false,
        error: 'from, to, and payload are required',
      });
      return;
    }

    const messageId = await a2aMesh?.sendMessage({
      from,
      to,
      type,
      payload,
      priority,
      requiresResponse,
    });

    res?.json({
      success: true,
      data: {
        messageId,
        from,
        to,
        type,
        priority,
        sentAt: new Date().toISOString(),
      },
      message: `Message sent from ${from} to ${to}`,
    });
  } catch (error) {
    log?.error('❌ Message sending failed', LogContext?.API, { error });
    res?.status(500).json({
      success: false,
      error: error instanceof Error ? error?.message : 'Message sending failed',
    });
  }
});

/**
 * @route POST /api/v1/a2a/demo/collaborative-task;
 * @desc Demonstrate collaborative agent execution;
 */
router?.post('/demo/collaborative-task', async (req, res) => {
  try {
    const { task = 'Plan and execute a complex software development project' } = req?.body;

    log?.info('🚀 Starting A2A collaborative task demo', LogContext?.API, { task });

    // Step 1: Find optimal team;
    const requiredCapabilities = ['planning', 'analysis', 'code', 'testing'];
    const team = a2aMesh?.findAgentTeam(requiredCapabilities, 4);

    if (team?.length === 0) {
      res?.status(503).json({
        success: false,
        error: 'No agents available for demonstration',
      });
      return;
    }

    // Step 2: Start collaboration;
    const sessionId = await agentRegistry?.requestCollaboration(
      task,
      requiredCapabilities,
      team?.length,
      'demo'
    );

    // Step 3: Share knowledge between agents;
    for (let i = 0; i < team?.length; i++) {
      const agent = team[i];
      if (!agent) {
        continue; // Skip undefined agents;
      }
      await agentRegistry?.shareKnowledge(
        agent,
        'project_context',
        {
          task,
          teamRole: i === 0 ? 'lead' : 'contributor',
          specialization: requiredCapabilities[i % requiredCapabilities?.length],
        },
        requiredCapabilities,
        0?.9;
      );
    }

    // Step 4: Get final status;
    const meshStatus = agentRegistry?.getMeshStatus();

    res?.json({
      success: true,
      data: {
        demo: 'A2A Collaborative Task Execution',
        task,
        sessionId,
        team,
        steps: [
          'Team formation based on capabilities',
          'Collaboration session initiated',
          'Knowledge sharing between agents',
          'Distributed task execution',
        ],
        meshStatus,
        completedAt: new Date().toISOString(),
      },
      message: `A2A collaboration demo completed with ${team?.length} agents`,
    });
  } catch (error) {
    log?.error('❌ A2A demo failed', LogContext?.API, { error });
    res?.status(500).json({
      success: false,
      error: error instanceof Error ? error?.message : 'Demo execution failed',
    });
  }
});

export default router;

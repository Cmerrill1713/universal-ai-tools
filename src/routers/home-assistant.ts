/**
 * Home Assistant Router
 * API endpoints for Home Assistant integration
 */

import { Router, Request, Response } from 'express';
import { homeAssistantService } from '../services/home-assistant-service';
import { homeAssistantVoiceMapper } from '../services/home-assistant-voice-mapper';
import { logger } from '../utils/logger';
import WebSocket from 'ws';
import { WebSocketServer } from 'ws';

const router = Router();

// WebSocket server for real-time updates
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server for Home Assistant updates
 */
export function initHomeAssistantWebSocket(server: any): void {
  wss = new WebSocketServer({ 
    server,
    path: '/ws/home-assistant'
  });

  wss.on('connection', (ws: WebSocket) => {
    logger.info('🔌 Home Assistant WebSocket client connected', { context: 'home-assistant' });

    // Subscribe to Home Assistant events
    homeAssistantService.on('deviceStateChanged', (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'state_changed',
          ...data
        }));
      }
    });

    ws.on('close', () => {
      logger.info('Home Assistant WebSocket client disconnected', { context: 'home-assistant' });
    });

    ws.on('error', (error) => {
      logger.error('Home Assistant WebSocket error', {
        error: error.message,
        context: 'home-assistant'
      });
    });
  });
}

/**
 * Connect to Home Assistant
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { url, accessToken } = req.body;

    if (!url || !accessToken) {
      return res.status(400).json({
        success: false,
        error: 'URL and access token are required'
      });
    }

    const connected = await homeAssistantService.initialize({
      url,
      accessToken,
      enableWebSocket: true
    });

    if (connected) {
      return res.json({
        success: true,
        message: 'Connected to Home Assistant'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to connect to Home Assistant'
      });
    }
  } catch (error) {
    logger.error('Home Assistant connection error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context: 'home-assistant-router'
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get all devices
 */
router.get('/devices', async (req: Request, res: Response) => {
  try {
    if (!homeAssistantService.isActive()) {
      return res.status(503).json({
        success: false,
        error: 'Home Assistant not connected'
      });
    }

    const devicesByDomain = homeAssistantService.getDevicesByDomain();
    const devices: any[] = [];

    for (const [domain, domainDevices] of devicesByDomain) {
      devices.push(...domainDevices);
    }

    return res.json({
      success: true,
      devices,
      count: devices.length,
      domains: Array.from(devicesByDomain.keys())
    });
  } catch (error) {
    logger.error('Failed to get devices', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context: 'home-assistant-router'
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get devices by domain
 */
router.get('/devices/:domain', async (req: Request, res: Response) => {
  try {
    if (!homeAssistantService.isActive()) {
      return res.status(503).json({
        success: false,
        error: 'Home Assistant not connected'
      });
    }

    const { domain } = req.params;
    const devices = homeAssistantService.getDevicesByType(domain ?? '');

    return res.json({
      success: true,
      domain,
      devices,
      count: devices.length
    });
  } catch (error) {
    logger.error('Failed to get devices by domain', {
      error: error instanceof Error ? error.message : 'Unknown error',
      domain: req.params.domain,
      context: 'home-assistant-router'
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get specific device
 */
router.get('/device/:entityId', async (req: Request, res: Response) => {
  try {
    if (!homeAssistantService.isActive()) {
      return res.status(503).json({
        success: false,
        error: 'Home Assistant not connected'
      });
    }

    const { entityId } = req.params;
    const device = homeAssistantService.getDevice(entityId ?? '');

    if (device) {
      return res.json({
        success: true,
        device
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
  } catch (error) {
    logger.error('Failed to get device', {
      error: error instanceof Error ? error.message : 'Unknown error',
      entityId: req.params.entityId,
      context: 'home-assistant-router'
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Control device
 */
router.post('/control', async (req: Request, res: Response) => {
  try {
    if (!homeAssistantService.isActive()) {
      return res.status(503).json({
        success: false,
        error: 'Home Assistant not connected'
      });
    }

    const { entity, action, value, attributes } = req.body;

    if (!entity || !action) {
      return res.status(400).json({
        success: false,
        error: 'Entity and action are required'
      });
    }

    const result = await homeAssistantService.executeCommand({
      action,
      entity,
      value,
      attributes
    });

    return res.json({
      success: true,
      message: `Successfully executed ${action} on ${entity}`,
      result
    });
  } catch (error) {
    logger.error('Failed to control device', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
      context: 'home-assistant-router'
    });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Control command failed'
    });
  }
});

/**
 * Call Home Assistant service directly
 */
router.post('/service/:domain/:service', async (req: Request, res: Response) => {
  try {
    if (!homeAssistantService.isActive()) {
      return res.status(503).json({
        success: false,
        error: 'Home Assistant not connected'
      });
    }

    const { domain, service } = req.params;
    const data = req.body;

    const result = await homeAssistantService.callService(domain ?? '', service ?? '', data);

    return res.json({
      success: true,
      message: `Successfully called ${domain}.${service}`,
      result
    });
  } catch (error) {
    logger.error('Failed to call service', {
      error: error instanceof Error ? error.message : 'Unknown error',
      domain: req.params.domain,
      service: req.params.service,
      context: 'home-assistant-router'
    });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Service call failed'
    });
  }
});

/**
 * Process voice command
 */
router.post('/voice-command', async (req: Request, res: Response) => {
  try {
    if (!homeAssistantService.isActive()) {
      return res.status(503).json({
        success: false,
        error: 'Home Assistant not connected'
      });
    }

    const { command } = req.body;

    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Voice command is required'
      });
    }

    const result = await homeAssistantVoiceMapper.executeVoiceCommand(command);

    return res.json({
      success: result.success,
      message: result.message,
      data: {
        command,
        action: result.action,
        result: result.result
      }
    });
  } catch (error) {
    logger.error('Failed to process voice command', {
      error: error instanceof Error ? error.message : 'Unknown error',
      command: req.body.command,
      context: 'home-assistant-router'
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to process voice command'
    });
  }
});

/**
 * Get voice command suggestions
 */
router.get('/voice-suggestions', async (req: Request, res: Response) => {
  try {
    if (!homeAssistantService.isActive()) {
      return res.status(503).json({
        success: false,
        error: 'Home Assistant not connected'
      });
    }

    const suggestions = homeAssistantVoiceMapper.getCommandSuggestions();

    return res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    logger.error('Failed to get voice suggestions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context: 'home-assistant-router'
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Disconnect from Home Assistant
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    homeAssistantService.disconnect();
    
    res.json({
      success: true,
      message: 'Disconnected from Home Assistant'
    });
  } catch (error) {
    logger.error('Failed to disconnect', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context: 'home-assistant-router'
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const isConnected = homeAssistantService.isActive();
    const deviceCount = isConnected ? homeAssistantService.getDevicesByDomain().size : 0;

    res.json({
      success: true,
      connected: isConnected,
      deviceCount
    });
  } catch (error) {
    logger.error('Failed to get status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context: 'home-assistant-router'
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
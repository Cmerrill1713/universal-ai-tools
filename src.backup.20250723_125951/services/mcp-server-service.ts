import type { SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import { LogContext, logger } from '../utils/enhanced-logger';

interface MCPAgentConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  capabilities: string[];
  requiredKeys: {
    name: string;
    description: string;
    type: 'api_key' | 'oauth' | 'password' | 'token';
    encrypted?: boolean;
  }[];
  endpoint: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastHeartbeat?: Date;
}

interface MCPConnection {
  agentId: string;
  ws: WebSocket;
  authenticated: boolean;
  heartbeatInterval?: NodeJS.Timeout;
}

export class MCPServerService extends EventEmitter {
  private supabase: SupabaseClient;
  private wss: WebSocketServer | null = null;
  private connections: Map<string, MCPConnection> = new Map();
  private agents: Map<string, MCPAgentConfig> = new Map();
  private encryptionKey: string;

  constructor(supabase: SupabaseClient) {
    super();
    this.supabase = supabase;
    this.encryptionKey = process.env.MCP_ENCRYPTION_KEY || this.generateEncryptionKey();
  }

  private generateEncryptionKey(): string {
    const key = crypto.randomBytes(32).toString('base64');
    logger.warn(
      'Generated temporary MCP encryption key. Set MCP_ENCRYPTION_KEY env var for production.',
      LogContext.SECURITY
    );
    return key;
  }

  async initialize(server: any)): Promise<void> {
    logger.info('Initializing MCP server...', LogContext.SYSTEM);

    // Create WebSocket server for MCP connections
    this.wss = new WebSocketServer({
      server,
      path: '/api/mcp/ws',
      verifyClient: (info) => {
        // Verify authentication header
        const auth = info.req.headers.authorization;
        return !!auth && auth.startsWith('Bearer ');
      },
    });

    this.wss.on('connection', (ws, req => {
      this.handleConnection(ws, req;
    });

    // Load existing agent configurations from database
    await this.loadAgentConfigurations();

    logger.info('MCP server initialized successfully', LogContext.SYSTEM);
  }

  private async handleConnection(ws: WebSocket, req: any)): Promise<void> {
    const connectionId = crypto.randomUUID();
    logger.info(`New MCP connection: ${connectionId}`, LogContext.SYSTEM);`

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(connectionId, ws, message;
      } catch (error) {
        logger.error('Failed to handle MCP mes, LogContext.SYSTEM, { error });
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'Invalid message format',
          })
        );
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    ws.on('error', (error) => {
      logger.error('MCP WebSocket error', { connectionId, error });
    });

    // Send initial handshake
    ws.send(
      JSON.stringify({
        type: 'handshake',
        version: '1.0',
        connectionId,
        requiredAuth: true,
      })
    );
  }

  private async handleMessage(connectionId: string, ws: WebSocket, message: any)): Promise<void> {
    switch (message.type) {
      case 'register':
        await this.handleAgentRegistration(connectionId, ws, message;
        break;

      case 'authenticate':
        await this.handleAuthentication(connectionId, ws, message;
        break;

      case 'heartbeat':
        this.handleHeartbeat(connectionId);
        break;

      case 'capability_update':
        await this.handleCapabilityUpdate(connectionId, message;
        break;

      case 'execute':
        await this.handleExecuteRequest(connectionId, message;
        break;

      default:
        ws.send(
          JSON.stringify({
            type: 'error',
            error: `Unknown message type: ${message.type}`,
          })
        );
    }
  }

  private async handleAgentRegistration(
    connectionId: string,
    ws: WebSocket,
    message: any
  ))): Promise<void> {
    const { agent } = message;

    if (!agent || !agent.name || !agent.id) {
      ws.send(
        JSON.stringify({
          type: 'error',
          error: 'Invalid agent registration data',
        })
      );
      return;
    }

    // Create agent configuration
    const agentConfig: MCPAgentConfig = {
      id: agent.id,
      name: agent.name,
      icon: agent.icon || '🤖',
      description: agent.description || '',
      capabilities: agent.capabilities || [],
      requiredKeys: agent.requiredKeys || [],
      endpoint: agent.endpoint || `/api/mcp/agents/${agent.id}`,
      status: 'pending',
      lastHeartbeat: new Date(),
    };

    // Store in database
    const { error } = await this.supabase.from('mcp_agents').upsert({
      id: agentConfig.id,
      name: agentConfig.name,
      icon: agentConfig.icon,
      description: agentConfig.description,
      capabilities: agentConfig.capabilities,
      required_keys: agentConfig.requiredKeys,
      endpoint: agentConfig.endpoint,
      status: agentConfig.status,
      last_heartbeat: agentConfig.lastHeartbeat,
    });

    if (error) {
      logger.error('Failed to regi, LogContext.SYSTEM, { error });
      ws.send(
        JSON.stringify({
          type: 'error',
          error: 'Failed to register agent',
        })
      );
      return;
    }

    // Store in memory
    this.agents.set(agent.id, agentConfig;

    // Create connection
    const connection: MCPConnection = {
      agentId: agent.id,
      ws,
      authenticated: false,
    };

    this.connections.set(connectionId, connection;

    // Start heartbeat monitoring
    connection.heartbeatInterval = setInterval(() => {
      if (this.isConnectionAlive(connectionId)) {
        ws.ping();
      } else {
        this.handleDisconnection(connectionId);
      }
    }, 30000); // 30 seconds

    ws.send(
      JSON.stringify({
        type: 'registered',
        agentId: agent.id,
        requiresAuth: agentConfig.requiredKeys.length > 0,
      })
    );

    // Emit event for UI updates
    this.emit('agent:registered', agentConfig);

    logger.info(`MCP agent registered: ${agent.name}`, LogContext.SYSTEM);`
  }

  private async handleAuthentication(
    connectionId: string,
    ws: WebSocket,
    message: any
  ))): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      ws.send(
        JSON.stringify({
          type: 'error',
          error: 'Connection not found',
        })
      );
      return;
    }

    const agent = this.agents.get(connection.agentId);
    if (!agent) {
      ws.send(
        JSON.stringify({
          type: 'error',
          error: 'Agent not found',
        })
      );
      return;
    }

    // Verify provided keys match required keys
    const { keys } = message;
    const missingKeys = agent.requiredKeys.filter((reqKey) => !keys || !keys[reqKey.name]);

    if (missingKeys.length > 0) {
      ws.send(
        JSON.stringify({
          type: 'error',
          error: 'Missing required keys',
          missingKeys: missingKeys.map((k) => k.name),
        })
      );
      return;
    }

    // Store encrypted keys in vault
    await this.storeKeysInVault(connection.agentId, keys;

    // Mark as authenticated
    connection.authenticated = true;
    agent.status = 'connected';

    // Update database
    await this.supabase
      .from('mcp_agents')
      .update({ status: 'connected' })
      .eq('id', connection.agentId);

    ws.send(
      JSON.stringify({
        type: 'authenticated',
        agentId: connection.agentId,
      })
    );

    // Emit event for UI updates
    this.emit('agent:connected', agent);

    logger.info(`MCP agent authenticated: ${agent.name}`, LogContext.SECURITY);`
  }

  private async storeKeysInVault(agentId: string, keys: Record<string, string>))): Promise<void> {
    for (const [keyName, keyValue] of Object.entries(keys)) {
      const encryptedValue = this.encryptKey(keyValue);

      await this.supabase.from('mcp_key_vault').upsert({
        agent_id: agentId,
        key_name: keyName,
        encrypted_value: encryptedValue,
        updated_at: new Date().toISOString(),
      });
    }
  }

  private encryptKey(value: string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey, 'base64'),
      iv
    );

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decryptKey(encryptedValue: string {
    const [ivHex, encrypted] = encryptedValue.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey, 'base64'),
      iv
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private handleHeartbeat(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const agent = this.agents.get(connection.agentId);
    if (!agent) return;

    agent.lastHeartbeat = new Date();

    // Update database asynchronously
    this.supabase
      .from('mcp_agents')
      .update({ last_heartbeat: agent.lastHeartbeat })
      .eq('id', connection.agentId)
      .then();
  }

  private async handleCapabilityUpdate(connectionId: string, message: any)): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.authenticated) return;

    const agent = this.agents.get(connection.agentId);
    if (!agent) return;

    agent.capabilities = message.capabilities || [];

    await this.supabase
      .from('mcp_agents')
      .update({ capabilities: agent.capabilities })
      .eq('id', connection.agentId);

    this.emit('agent:updated', agent);
  }

  private async handleExecuteRequest(connectionId: string, message: any)): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.authenticated) {
      connection?.ws.send(
        JSON.stringify({
          type: 'error',
          error: 'Not authenticated',
        })
      );
      return;
    }

    // Forward execution request to the appropriate handler
    this.emit('execute:request', {
      agentId: connection.agentId,
      request: message.request,
      connectionId,
    });
  }

  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Clear heartbeat interval
    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
    }

    // Update agent status
    const agent = this.agents.get(connection.agentId);
    if (agent) {
      agent.status = 'disconnected';

      this.supabase
        .from('mcp_agents')
        .update({ status: 'disconnected' })
        .eq('id', connection.agentId)
        .then();

      this.emit('agent:disconnected', agent);
    }

    // Remove connection
    this.connections.delete(connectionId);

    logger.info(`MCP connection closed: ${connectionId}`, LogContext.SYSTEM);`
  }

  private isConnectionAlive(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    const agent = this.agents.get(connection.agentId);
    if (!agent || !agent.lastHeartbeat) return false;

    // Consider connection dead if no heartbeat for 60 seconds
    const timeSinceLastHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
    return timeSinceLastHeartbeat < 60000;
  }

  private async loadAgentConfigurations())): Promise<void> {
    const { data: agents, error } = await this.supabase.from('mcp_agents').select('*');

    if (error) {
      logger.error('Failed to load MCP agent, LogContext.SYSTEM, { error });
      return;
    }

    for (const agent of agents || []) {
      const agentConfig: MCPAgentConfig = {
        id: agent.id,
        name: agent.name,
        icon: agent.icon,
        description: agent.description,
        capabilities: agent.capabilities,
        requiredKeys: agent.required_keys,
        endpoint: agent.endpoint,
        status: 'disconnected', // All agents start as disconnected
        lastHeartbeat: agent.last_heartbeat ? new Date(agent.last_heartbeat) : undefined,
      };

      this.agents.set(agent.id, agentConfig;
    }

    logger.info(`Loaded ${this.agents.size} MCP agent configurations`, LogContext.SYSTEM);`
  }

  async getAgents(): Promise<MCPAgentConfig[]> {
    return Array.from(this.agents.values());
  }

  async getAgent(agentId: string: Promise<MCPAgentConfig | undefined> {
    return this.agents.get(agentId);
  }

  async getAgentKeys(agentId: string: Promise<Record<string, string>> {
    const { data: keys, error } = await this.supabase
      .from('mcp_key_vault')
      .select('key_name, encrypted_value')
      .eq('agent_id', agentId);

    if (error || !keys) {
      logger.error('Failed to retrieve agent key, LogContext.SECURITY, { error });
      return {};
    }

    const decryptedKeys: Record<string, string> = {};
    for (const key of keys) {
      try {
        decryptedKeys[key.key_name] = this.decryptKey(key.encrypted_value);
      } catch (error) {
        logger.error('Failed to decrypt key', {
          agentId,
          keyName: key.key_name,
          error
        });
      }
    }

    return decryptedKeys;
  }

  async executeAgentAction(agentId: string, action: string, params: any): Promise<unknown> {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== 'connected') {
      throw new Error('Agent not available');
    }

    // Find connection for this agent
    let connection: MCPConnection | undefined;
    for (const [_, conn] of this.connections) {
      if (conn.agentId === agentId && conn.authenticated) {
        connection = conn;
        break;
      }
    }

    if (!connection) {
      throw new Error('No active connection for agent');
    }

    // Send execution request
    return new Promise((resolve, reject => {
      const requestId = crypto.randomUUID();

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000); // 30 second timeout

      const handler = (response: any => {
        if (response.requestId === requestId) {
          clearTimeout(timeout);
          connection!.ws.off('message', handler);

          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.result);
          }
        }
      };

      connection.ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          handler(response);
        } catch (error) {
          // Ignore parse errors
        }
      });

      connection.ws.send(
        JSON.stringify({
          type: 'execute',
          requestId,
          action,
          params,
        })
      );
    });
  }

  async shutdown())): Promise<void> {
    logger.info('Shutting down MCP server...', LogContext.SYSTEM);

    // Close all connections
    for (const [connectionId, connection] of this.connections) {
      connection.ws.close();
      if (connection.heartbeatInterval) {
        clearInterval(connection.heartbeatInterval);
      }
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Update all agents to disconnected
    await this.supabase
      .from('mcp_agents')
      .update({ status: 'disconnected' })
      .in('id', Array.from(this.agents.keys()));

    this.connections.clear();
    this.agents.clear();

    logger.info('MCP server shut down successfully', LogContext.SYSTEM);
  }
}

export const createMCPServerService = (supabase: SupabaseClient => {
  return new MCPServerService(supabase);
};

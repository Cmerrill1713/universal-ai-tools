import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import { Logger } from '../utils/logger';
import { redisService } from './redis-service-rust';
import { supabase } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  currentWorkspace?: string;
  cursor?: {
    x: number;
    y: number;
    selection?: string;
  };
}

export interface CollaborationWorkspace {
  id: string;
  name: string;
  type: 'chat' | 'code' | 'document' | 'agent-session';
  ownerId: string;
  participants: CollaborationUser[];
  settings: {
    maxParticipants: number;
    allowAnonymous: boolean;
    requireApproval: boolean;
    persistence: boolean;
  };
  state: Record<string, any>;
  history: CollaborationEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CollaborationEvent {
  id: string;
  type: 'join' | 'leave' | 'edit' | 'cursor' | 'chat' | 'agent-result' | 'sync';
  workspaceId: string;
  userId: string;
  data: any;
  timestamp: Date;
  version: number;
}

interface WebSocketConnection {
  ws: WebSocket;
  userId: string;
  workspaceId: string;
  user: CollaborationUser;
  lastPing: Date;
  subscriptions: Set<string>;
}

export class CollaborationService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, WebSocketConnection>();
  private workspaces = new Map<string, CollaborationWorkspace>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    super();
  }

  async initialize(server?: any): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize WebSocket server
      this.wss = new WebSocketServer({ 
        port: server ? undefined : 8081,
        server: server,
        path: '/collaboration'
      });

      this.setupWebSocketHandlers();
      await this.loadWorkspacesFromDatabase();
      this.startHeartbeat();

      this.isInitialized = true;
      Logger.info('Collaboration Service initialized');
    } catch (error) {
      Logger.error('Failed to initialize Collaboration Service:', error);
      throw error;
    }
  }

  /**
   * Create a new collaboration workspace
   */
  async createWorkspace(
    name: string,
    type: 'chat' | 'code' | 'document' | 'agent-session',
    ownerId: string,
    options: {
      maxParticipants?: number;
      allowAnonymous?: boolean;
      requireApproval?: boolean;
      persistence?: boolean;
      initialState?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const workspaceId = uuidv4();
    
    const workspace: CollaborationWorkspace = {
      id: workspaceId,
      name,
      type,
      ownerId,
      participants: [],
      settings: {
        maxParticipants: options.maxParticipants || 50,
        allowAnonymous: options.allowAnonymous || false,
        requireApproval: options.requireApproval || false,
        persistence: options.persistence !== false
      },
      state: options.initialState || {},
      history: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.workspaces.set(workspaceId, workspace);

    // Persist to database if enabled
    if (workspace.settings.persistence) {
      await this.saveWorkspaceToDatabase(workspace);
    }

    // Cache in Redis for quick access
    await redisService.set(`workspace:${workspaceId}`, workspace, 3600);

    Logger.info(`Created collaboration workspace: ${name}`, { 
      workspaceId, 
      type, 
      ownerId 
    });

    this.emit('workspaceCreated', { workspace });

    return workspaceId;
  }

  /**
   * Join a workspace
   */
  async joinWorkspace(
    workspaceId: string, 
    user: CollaborationUser,
    connectionId: string
  ): Promise<boolean> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Check permissions
    if (!this.canUserJoinWorkspace(user, workspace)) {
      throw new Error('Permission denied to join workspace');
    }

    // Check participant limit
    if (workspace.participants.length >= workspace.settings.maxParticipants) {
      throw new Error('Workspace is full');
    }

    // Add user to workspace if not already present
    const existingParticipant = workspace.participants.find(p => p.id === user.id);
    if (!existingParticipant) {
      workspace.participants.push({
        ...user,
        status: 'online',
        lastSeen: new Date(),
        currentWorkspace: workspaceId
      });
    } else {
      existingParticipant.status = 'online';
      existingParticipant.lastSeen = new Date();
      existingParticipant.currentWorkspace = workspaceId;
    }

    workspace.updatedAt = new Date();

    // Update connection
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.workspaceId = workspaceId;
      connection.user = user;
    }

    // Broadcast join event
    const joinEvent: CollaborationEvent = {
      id: uuidv4(),
      type: 'join',
      workspaceId,
      userId: user.id,
      data: { user },
      timestamp: new Date(),
      version: workspace.history.length + 1
    };

    workspace.history.push(joinEvent);
    await this.broadcastToWorkspace(workspaceId, joinEvent, user.id);

    // Update caches
    await this.updateWorkspaceCache(workspace);

    Logger.info(`User joined workspace: ${user.name}`, { 
      workspaceId, 
      userId: user.id,
      participantCount: workspace.participants.length 
    });

    this.emit('userJoined', { workspace, user, event: joinEvent });

    return true;
  }

  /**
   * Leave a workspace
   */
  async leaveWorkspace(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) return;

    // Remove user from participants
    const userIndex = workspace.participants.findIndex(p => p.id === userId);
    if (userIndex === -1) return;

    const user = workspace.participants[userIndex];
    workspace.participants.splice(userIndex, 1);
    workspace.updatedAt = new Date();

    // Broadcast leave event
    const leaveEvent: CollaborationEvent = {
      id: uuidv4(),
      type: 'leave',
      workspaceId,
      userId,
      data: { user },
      timestamp: new Date(),
      version: workspace.history.length + 1
    };

    workspace.history.push(leaveEvent);
    await this.broadcastToWorkspace(workspaceId, leaveEvent);

    // Remove connection
    const connections = Array.from(this.connections.entries());
    for (const [connectionId, connection] of connections) {
      if (connection.userId === userId && connection.workspaceId === workspaceId) {
        this.connections.delete(connectionId);
      }
    }

    // Update caches
    await this.updateWorkspaceCache(workspace);

    Logger.info(`User left workspace: ${user.name}`, { 
      workspaceId, 
      userId,
      remainingParticipants: workspace.participants.length 
    });

    this.emit('userLeft', { workspace, user, event: leaveEvent });
  }

  /**
   * Send a real-time edit event
   */
  async sendEdit(
    workspaceId: string,
    userId: string,
    editData: {
      operation: 'insert' | 'delete' | 'replace' | 'format';
      position: number | { line: number; column: number };
      content?: string;
      length?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const user = workspace.participants.find(p => p.id === userId);
    if (!user) {
      throw new Error('User not in workspace');
    }

    // Apply edit to workspace state
    this.applyEditToWorkspace(workspace, editData);

    // Create edit event
    const editEvent: CollaborationEvent = {
      id: uuidv4(),
      type: 'edit',
      workspaceId,
      userId,
      data: editData,
      timestamp: new Date(),
      version: workspace.history.length + 1
    };

    workspace.history.push(editEvent);
    workspace.updatedAt = new Date();

    // Broadcast to other users (exclude sender)
    await this.broadcastToWorkspace(workspaceId, editEvent, userId);

    // Update caches
    await this.updateWorkspaceCache(workspace);

    this.emit('editReceived', { workspace, user, event: editEvent });
  }

  /**
   * Send cursor position update
   */
  async updateCursor(
    workspaceId: string,
    userId: string,
    cursor: { x: number; y: number; selection?: string }
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) return;

    const user = workspace.participants.find(p => p.id === userId);
    if (!user) return;

    // Update user cursor
    user.cursor = cursor;
    workspace.updatedAt = new Date();

    // Create cursor event
    const cursorEvent: CollaborationEvent = {
      id: uuidv4(),
      type: 'cursor',
      workspaceId,
      userId,
      data: { cursor },
      timestamp: new Date(),
      version: workspace.history.length + 1
    };

    // Broadcast cursor position (don't store in history for performance)
    await this.broadcastToWorkspace(workspaceId, cursorEvent, userId);

    // Update cache (lightweight update)
    await redisService.set(`workspace:${workspaceId}:cursors`, 
      workspace.participants.reduce((cursors, p) => {
        if (p.cursor) cursors[p.id] = p.cursor;
        return cursors;
      }, {} as Record<string, any>), 
      30
    );
  }

  /**
   * Send chat message
   */
  async sendChatMessage(
    workspaceId: string,
    userId: string,
    message: {
      content: string;
      type?: 'text' | 'code' | 'image' | 'file';
      metadata?: Record<string, any>;
      replyTo?: string;
    }
  ): Promise<string> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const user = workspace.participants.find(p => p.id === userId);
    if (!user) {
      throw new Error('User not in workspace');
    }

    const messageId = uuidv4();

    // Create chat event
    const chatEvent: CollaborationEvent = {
      id: messageId,
      type: 'chat',
      workspaceId,
      userId,
      data: {
        ...message,
        id: messageId,
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar
        }
      },
      timestamp: new Date(),
      version: workspace.history.length + 1
    };

    workspace.history.push(chatEvent);
    workspace.updatedAt = new Date();

    // Broadcast chat message
    await this.broadcastToWorkspace(workspaceId, chatEvent);

    // Update caches
    await this.updateWorkspaceCache(workspace);

    Logger.info(`Chat message sent in workspace`, { 
      workspaceId, 
      userId, 
      messageId,
      content: message.content.substring(0, 100) 
    });

    this.emit('chatMessage', { workspace, user, event: chatEvent });

    return messageId;
  }

  /**
   * Share agent execution results
   */
  async shareAgentResult(
    workspaceId: string,
    userId: string,
    agentResult: {
      executionId: string;
      agentType: string;
      task: string;
      result: any;
      confidence: number;
      duration: number;
      model: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const user = workspace.participants.find(p => p.id === userId);
    if (!user) {
      throw new Error('User not in workspace');
    }

    // Create agent result event
    const agentEvent: CollaborationEvent = {
      id: uuidv4(),
      type: 'agent-result',
      workspaceId,
      userId,
      data: {
        ...agentResult,
        user: {
          id: user.id,
          name: user.name
        }
      },
      timestamp: new Date(),
      version: workspace.history.length + 1
    };

    workspace.history.push(agentEvent);
    workspace.updatedAt = new Date();

    // Broadcast agent result
    await this.broadcastToWorkspace(workspaceId, agentEvent);

    // Update caches
    await this.updateWorkspaceCache(workspace);

    Logger.info(`Agent result shared in workspace`, { 
      workspaceId, 
      userId, 
      executionId: agentResult.executionId,
      agentType: agentResult.agentType 
    });

    this.emit('agentResultShared', { workspace, user, event: agentEvent });
  }

  /**
   * Get workspace information
   */
  async getWorkspace(workspaceId: string): Promise<CollaborationWorkspace | null> {
    // Try memory cache first
    let workspace = this.workspaces.get(workspaceId);
    if (workspace) return workspace;

    // Try Redis cache
    const cached = await redisService.get(`workspace:${workspaceId}`);
    if (cached) {
      workspace = {
        ...cached,
        createdAt: new Date(cached.createdAt),
        updatedAt: new Date(cached.updatedAt),
        history: cached.history.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp)
        }))
      };
      this.workspaces.set(workspaceId, workspace);
      return workspace;
    }

    // Load from database
    try {
      const { data, error } = await supabase
        .from('collaboration_workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error || !data) return null;

      workspace = {
        id: data.id,
        name: data.name,
        type: data.type,
        ownerId: data.owner_id,
        participants: data.participants || [],
        settings: data.settings,
        state: data.state || {},
        history: data.history || [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      this.workspaces.set(workspaceId, workspace);
      await redisService.set(`workspace:${workspaceId}`, workspace, 3600);

      return workspace;
    } catch (error) {
      Logger.error('Failed to load workspace from database:', error);
      return null;
    }
  }

  /**
   * Get workspace participants and their status
   */
  async getWorkspaceParticipants(workspaceId: string): Promise<CollaborationUser[]> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) return [];

    // Update online status based on active connections
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.workspaceId === workspaceId);

    workspace.participants.forEach(participant => {
      const hasActiveConnection = activeConnections.some(conn => conn.userId === participant.id);
      participant.status = hasActiveConnection ? 'online' : 
        (Date.now() - participant.lastSeen.getTime() < 300000) ? 'away' : 'offline';
    });

    return workspace.participants;
  }

  /**
   * Get workspace history with pagination
   */
  async getWorkspaceHistory(
    workspaceId: string,
    options: {
      limit?: number;
      offset?: number;
      types?: string[];
      fromVersion?: number;
    } = {}
  ): Promise<{
    events: CollaborationEvent[];
    total: number;
    hasMore: boolean;
  }> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return { events: [], total: 0, hasMore: false };
    }

    let events = workspace.history;

    // Filter by types
    if (options.types && options.types.length > 0) {
      events = events.filter(event => options.types!.includes(event.type));
    }

    // Filter by version
    if (options.fromVersion) {
      events = events.filter(event => event.version >= options.fromVersion!);
    }

    const total = events.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;

    // Apply pagination
    events = events.slice(offset, offset + limit);

    return {
      events,
      total,
      hasMore: offset + limit < total
    };
  }

  private setupWebSocketHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, request) => {
      const connectionId = uuidv4();
      
      const connection: WebSocketConnection = {
        ws,
        userId: '',
        workspaceId: '',
        user: {} as CollaborationUser,
        lastPing: new Date(),
        subscriptions: new Set()
      };

      this.connections.set(connectionId, connection);

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleWebSocketMessage(connectionId, message);
        } catch (error) {
          Logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        this.handleWebSocketDisconnect(connectionId);
      });

      ws.on('error', (error) => {
        Logger.error('WebSocket error:', error);
        this.handleWebSocketDisconnect(connectionId);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        connectionId,
        timestamp: new Date().toISOString()
      }));
    });
  }

  private async handleWebSocketMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      switch (message.type) {
        case 'auth':
          await this.handleAuthMessage(connectionId, message);
          break;
        case 'join-workspace':
          await this.handleJoinWorkspace(connectionId, message);
          break;
        case 'leave-workspace':
          await this.handleLeaveWorkspace(connectionId, message);
          break;
        case 'edit':
          await this.handleEditMessage(connectionId, message);
          break;
        case 'cursor':
          await this.handleCursorMessage(connectionId, message);
          break;
        case 'chat':
          await this.handleChatMessage(connectionId, message);
          break;
        case 'ping':
          connection.lastPing = new Date();
          connection.ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          Logger.warning(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      Logger.error('WebSocket message handling error:', error);
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: (error as Error).message
      }));
    }
  }

  private async handleAuthMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Validate user token/credentials here
    const user: CollaborationUser = {
      id: message.userId,
      name: message.userName,
      email: message.userEmail,
      avatar: message.userAvatar,
      role: message.userRole || 'editor',
      status: 'online',
      lastSeen: new Date()
    };

    connection.userId = user.id;
    connection.user = user;

    connection.ws.send(JSON.stringify({
      type: 'authenticated',
      user
    }));
  }

  private async handleJoinWorkspace(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.userId) return;

    await this.joinWorkspace(message.workspaceId, connection.user, connectionId);

    connection.ws.send(JSON.stringify({
      type: 'joined-workspace',
      workspaceId: message.workspaceId
    }));
  }

  private async handleLeaveWorkspace(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    await this.leaveWorkspace(message.workspaceId, connection.userId);
  }

  private async handleEditMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    await this.sendEdit(connection.workspaceId, connection.userId, message.data);
  }

  private async handleCursorMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    await this.updateCursor(connection.workspaceId, connection.userId, message.data);
  }

  private async handleChatMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    await this.sendChatMessage(connection.workspaceId, connection.userId, message.data);
  }

  private handleWebSocketDisconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.workspaceId && connection.userId) {
      this.leaveWorkspace(connection.workspaceId, connection.userId);
    }
    this.connections.delete(connectionId);
  }

  private async broadcastToWorkspace(
    workspaceId: string, 
    event: CollaborationEvent, 
    excludeUserId?: string
  ): Promise<void> {
    const connections = Array.from(this.connections.values())
      .filter(conn => 
        conn.workspaceId === workspaceId && 
        (!excludeUserId || conn.userId !== excludeUserId)
      );

    const message = JSON.stringify({
      type: 'workspace-event',
      event
    });

    connections.forEach(connection => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(message);
      }
    });
  }

  private canUserJoinWorkspace(user: CollaborationUser, workspace: CollaborationWorkspace): boolean {
    // Check if user is owner
    if (user.id === workspace.ownerId) return true;

    // Check anonymous access
    if (!workspace.settings.allowAnonymous && !user.email) return false;

    // Additional permission checks can be added here

    return true;
  }

  private applyEditToWorkspace(workspace: CollaborationWorkspace, editData: any): void {
    // Apply edit operations to workspace state
    // This is a simplified implementation - real-world would need operational transforms
    if (!workspace.state.content) workspace.state.content = '';

    switch (editData.operation) {
      case 'insert':
        if (typeof editData.position === 'number') {
          workspace.state.content = 
            workspace.state.content.substring(0, editData.position) +
            editData.content +
            workspace.state.content.substring(editData.position);
        }
        break;
      case 'delete':
        if (typeof editData.position === 'number' && editData.length) {
          workspace.state.content = 
            workspace.state.content.substring(0, editData.position) +
            workspace.state.content.substring(editData.position + editData.length);
        }
        break;
      case 'replace':
        if (typeof editData.position === 'number' && editData.length) {
          workspace.state.content = 
            workspace.state.content.substring(0, editData.position) +
            editData.content +
            workspace.state.content.substring(editData.position + editData.length);
        }
        break;
    }

    workspace.state.lastEdit = {
      ...editData,
      timestamp: new Date()
    };
  }

  private async updateWorkspaceCache(workspace: CollaborationWorkspace): Promise<void> {
    await redisService.set(`workspace:${workspace.id}`, workspace, 3600);
    
    // Update database if persistence is enabled
    if (workspace.settings.persistence) {
      await this.saveWorkspaceToDatabase(workspace);
    }
  }

  private async saveWorkspaceToDatabase(workspace: CollaborationWorkspace): Promise<void> {
    try {
      const { error } = await supabase
        .from('collaboration_workspaces')
        .upsert({
          id: workspace.id,
          name: workspace.name,
          type: workspace.type,
          owner_id: workspace.ownerId,
          participants: workspace.participants,
          settings: workspace.settings,
          state: workspace.state,
          history: workspace.history.slice(-100), // Keep only recent history in DB
          created_at: workspace.createdAt.toISOString(),
          updated_at: workspace.updatedAt.toISOString()
        });

      if (error) {
        Logger.error('Failed to save workspace to database:', error);
      }
    } catch (error) {
      Logger.error('Database save error:', error);
    }
  }

  private async loadWorkspacesFromDatabase(): Promise<void> {
    try {
      const { data: workspaces, error } = await supabase
        .from('collaboration_workspaces')
        .select('*')
        .eq('is_active', true);

      if (error) {
        Logger.error('Failed to load workspaces:', error);
        return;
      }

      workspaces?.forEach(data => {
        const workspace: CollaborationWorkspace = {
          id: data.id,
          name: data.name,
          type: data.type,
          ownerId: data.owner_id,
          participants: data.participants || [],
          settings: data.settings,
          state: data.state || {},
          history: data.history || [],
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        };

        this.workspaces.set(workspace.id, workspace);
      });

      Logger.info(`Loaded ${workspaces?.length || 0} workspaces from database`);
    } catch (error) {
      Logger.error('Failed to load workspaces from database:', error);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const staleConnections: string[] = [];

      // Check for stale connections
      this.connections.forEach((connection, connectionId) => {
        if (now.getTime() - connection.lastPing.getTime() > 60000) { // 1 minute
          staleConnections.push(connectionId);
        }
      });

      // Clean up stale connections
      staleConnections.forEach(connectionId => {
        this.handleWebSocketDisconnect(connectionId);
      });

    }, 30000); // Every 30 seconds
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all WebSocket connections
    this.connections.forEach(connection => {
      connection.ws.close();
    });
    this.connections.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    this.workspaces.clear();
    this.isInitialized = false;

    Logger.info('Collaboration Service shut down');
  }
}

export const collaborationService = new CollaborationService();
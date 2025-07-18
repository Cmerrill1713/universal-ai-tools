import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

export interface Message {
  id: string;
  sessionId: string;
  fromAgent: string;
  toAgent?: string; // undefined for broadcasts
  type: 'coordination' | 'task' | 'status' | 'error' | 'artifact' | 'heartbeat' | 'discovery';
  content: any;
  timestamp: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  ttl?: number; // Time to live in milliseconds
  retryCount?: number;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface MessageQueue {
  id: string;
  agentId: string;
  messages: Message[];
  lastProcessed: number;
  isProcessing: boolean;
  maxSize: number;
  processingRate: number; // messages per second
}

export interface MessageRoute {
  fromAgent: string;
  toAgent: string;
  messageType: string;
  handler: (message: Message) => Promise<void>;
}

export interface BroadcastGroup {
  id: string;
  name: string;
  description: string;
  members: Set<string>;
  messageTypes: string[];
  filters?: MessageFilter[];
}

export interface MessageFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'regex';
  value: any;
}

export interface MessageStats {
  totalSent: number;
  totalReceived: number;
  totalDelivered: number;
  totalFailed: number;
  averageDeliveryTime: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export class MessageBroker extends EventEmitter {
  private queues: Map<string, MessageQueue> = new Map();
  private routes: Map<string, MessageRoute> = new Map();
  private broadcastGroups: Map<string, BroadcastGroup> = new Map();
  private messageHistory: Message[] = [];
  private maxHistorySize: number = 1000;
  private messageStats: MessageStats = {
    totalSent: 0,
    totalReceived: 0,
    totalDelivered: 0,
    totalFailed: 0,
    averageDeliveryTime: 0,
    byType: {},
    byPriority: {}
  };
  private deliveryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHeartbeat();
    this.startCleanupProcess();
  }

  async registerAgent(agentId: string, options: {
    maxQueueSize?: number;
    processingRate?: number;
  } = {}): Promise<void> {
    const queue: MessageQueue = {
      id: `queue-${agentId}`,
      agentId,
      messages: [],
      lastProcessed: Date.now(),
      isProcessing: false,
      maxSize: options.maxQueueSize || 100,
      processingRate: options.processingRate || 10 // 10 messages per second
    };

    this.queues.set(agentId, queue);
    logger.info(`📬 Message queue registered for agent: ${agentId}`);
    this.emit('agent_registered', { agentId, queue });
  }

  async unregisterAgent(agentId: string): Promise<void> {
    const queue = this.queues.get(agentId);
    if (queue) {
      // Process remaining messages or move to dead letter queue
      if (queue.messages.length > 0) {
        logger.warn(`📬 Agent ${agentId} unregistered with ${queue.messages.length} pending messages`);
        
        // Move messages to dead letter queue or handle appropriately
        for (const message of queue.messages) {
          await this.handleUndeliveredMessage(message);
        }
      }
      
      this.queues.delete(agentId);
      
      // Remove from broadcast groups
      this.broadcastGroups.forEach(group => {
        group.members.delete(agentId);
      });
      
      logger.info(`📬 Agent unregistered: ${agentId}`);
      this.emit('agent_unregistered', { agentId });
    }
  }

  async sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<string> {
    const fullMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      priority: 'medium',
      retryCount: 0,
      ...message
    };

    // Validate message
    if (!this.validateMessage(fullMessage)) {
      throw new Error('Invalid message format');
    }

    // Add to history
    this.addToHistory(fullMessage);

    // Update stats
    this.updateStats('sent', fullMessage);

    // Route message
    if (fullMessage.toAgent) {
      // Direct message
      await this.routeDirectMessage(fullMessage);
    } else {
      // Broadcast message
      await this.routeBroadcastMessage(fullMessage);
    }

    // Set up delivery timeout if specified
    if (fullMessage.ttl) {
      this.setDeliveryTimeout(fullMessage);
    }

    logger.info(`📤 Message sent: ${fullMessage.id} (${fullMessage.type})`);
    this.emit('message_sent', fullMessage);

    return fullMessage.id;
  }

  private async routeDirectMessage(message: Message): Promise<void> {
    const targetQueue = this.queues.get(message.toAgent!);
    if (!targetQueue) {
      await this.handleUndeliveredMessage(message);
      return;
    }

    // Check queue capacity
    if (targetQueue.messages.length >= targetQueue.maxSize) {
      logger.warn(`📬 Queue full for agent ${message.toAgent}, dropping message ${message.id}`);
      await this.handleUndeliveredMessage(message);
      return;
    }

    // Add to queue in priority order
    this.addToQueue(targetQueue, message);
    
    // Process queue if not already processing
    if (!targetQueue.isProcessing) {
      setImmediate(() => this.processQueue(targetQueue));
    }
  }

  private async routeBroadcastMessage(message: Message): Promise<void> {
    const targetAgents = this.getBroadcastTargets(message);
    
    for (const agentId of targetAgents) {
      const targetMessage = {
        ...message,
        toAgent: agentId,
        id: `${message.id}-${agentId}`
      };
      
      await this.routeDirectMessage(targetMessage);
    }
  }

  private getBroadcastTargets(message: Message): string[] {
    // Find all agents that should receive this broadcast
    const targets = new Set<string>();
    
    // Check session participants
    if (message.sessionId) {
      // Add all agents in the session (this would be managed by the coordinator)
      // For now, we'll broadcast to all registered agents
      this.queues.forEach((_, agentId) => {
        if (agentId !== message.fromAgent) {
          targets.add(agentId);
        }
      });
    }
    
    // Check broadcast groups
    this.broadcastGroups.forEach(group => {
      if (group.messageTypes.includes(message.type) || group.messageTypes.includes('*')) {
        // Apply filters if any
        if (!group.filters || this.passesFilters(message, group.filters)) {
          group.members.forEach(agentId => {
            if (agentId !== message.fromAgent) {
              targets.add(agentId);
            }
          });
        }
      }
    });
    
    return Array.from(targets);
  }

  private passesFilters(message: Message, filters: MessageFilter[]): boolean {
    return filters.every(filter => {
      const fieldValue = this.getFieldValue(message, filter.field);
      
      switch (filter.operator) {
        case 'eq':
          return fieldValue === filter.value;
        case 'ne':
          return fieldValue !== filter.value;
        case 'gt':
          return fieldValue > filter.value;
        case 'lt':
          return fieldValue < filter.value;
        case 'contains':
          return String(fieldValue).includes(String(filter.value));
        case 'regex':
          return new RegExp(filter.value).test(String(fieldValue));
        default:
          return true;
      }
    });
  }

  private getFieldValue(message: Message, field: string): any {
    const parts = field.split('.');
    let value: any = message;
    
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }
    
    return value;
  }

  private addToQueue(queue: MessageQueue, message: Message): void {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const messagePriority = priorityOrder[message.priority];
    
    let insertIndex = queue.messages.length;
    for (let i = 0; i < queue.messages.length; i++) {
      const queuedMessagePriority = priorityOrder[queue.messages[i].priority];
      if (messagePriority > queuedMessagePriority) {
        insertIndex = i;
        break;
      }
    }
    
    queue.messages.splice(insertIndex, 0, message);
    this.updateStats('received', message);
  }

  private async processQueue(queue: MessageQueue): Promise<void> {
    if (queue.isProcessing || queue.messages.length === 0) {
      return;
    }

    queue.isProcessing = true;
    const processingInterval = 1000 / queue.processingRate; // ms between messages
    
    try {
      while (queue.messages.length > 0) {
        const message = queue.messages.shift()!;
        
        try {
          await this.deliverMessage(message);
          queue.lastProcessed = Date.now();
          
          // Rate limiting
          if (queue.messages.length > 0) {
            await new Promise(resolve => setTimeout(resolve, processingInterval));
          }
        } catch (error) {
          logger.error(`📬 Failed to deliver message ${message.id}:`, error);
          await this.handleDeliveryFailure(message, error);
        }
      }
    } finally {
      queue.isProcessing = false;
    }
  }

  private async deliverMessage(message: Message): Promise<void> {
    const startTime = Date.now();
    
    // Clean up delivery timeout
    const timeoutId = this.deliveryTimeouts.get(message.id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.deliveryTimeouts.delete(message.id);
    }

    // Emit message for handling
    this.emit('message', message);
    
    // Update delivery stats
    const deliveryTime = Date.now() - startTime;
    this.updateDeliveryStats(deliveryTime);
    this.updateStats('delivered', message);
    
    logger.info(`📥 Message delivered: ${message.id} to ${message.toAgent} (${deliveryTime}ms)`);
  }

  private async handleDeliveryFailure(message: Message, error: any): Promise<void> {
    message.retryCount = (message.retryCount || 0) + 1;
    const maxRetries = 3;
    
    if (message.retryCount < maxRetries) {
      // Retry with exponential backoff
      const delay = Math.pow(2, message.retryCount) * 1000;
      setTimeout(() => {
        const queue = this.queues.get(message.toAgent!);
        if (queue) {
          this.addToQueue(queue, message);
          if (!queue.isProcessing) {
            setImmediate(() => this.processQueue(queue));
          }
        }
      }, delay);
      
      logger.warn(`📬 Retrying message ${message.id} (attempt ${message.retryCount}/${maxRetries})`);
    } else {
      await this.handleUndeliveredMessage(message);
    }
  }

  private async handleUndeliveredMessage(message: Message): Promise<void> {
    this.updateStats('failed', message);
    
    logger.error(`📬 Message failed permanently: ${message.id}`);
    this.emit('message_failed', { message, reason: 'Max retries exceeded' });
    
    // Could implement dead letter queue here
    // For now, we'll just log and emit an event
  }

  private setDeliveryTimeout(message: Message): void {
    const timeoutId = setTimeout(() => {
      logger.warn(`📬 Message timeout: ${message.id}`);
      this.handleUndeliveredMessage(message);
    }, message.ttl!);
    
    this.deliveryTimeouts.set(message.id, timeoutId);
  }

  async createBroadcastGroup(group: Omit<BroadcastGroup, 'members'>): Promise<string> {
    const fullGroup: BroadcastGroup = {
      ...group,
      members: new Set()
    };
    
    this.broadcastGroups.set(group.id, fullGroup);
    
    logger.info(`📢 Broadcast group created: ${group.id}`);
    this.emit('broadcast_group_created', fullGroup);
    
    return group.id;
  }

  async addToBroadcastGroup(groupId: string, agentId: string): Promise<void> {
    const group = this.broadcastGroups.get(groupId);
    if (!group) {
      throw new Error(`Broadcast group not found: ${groupId}`);
    }
    
    group.members.add(agentId);
    this.emit('agent_added_to_group', { groupId, agentId });
  }

  async removeFromBroadcastGroup(groupId: string, agentId: string): Promise<void> {
    const group = this.broadcastGroups.get(groupId);
    if (!group) {
      throw new Error(`Broadcast group not found: ${groupId}`);
    }
    
    group.members.delete(agentId);
    this.emit('agent_removed_from_group', { groupId, agentId });
  }

  private validateMessage(message: Message): boolean {
    return !!(
      message.id &&
      message.sessionId &&
      message.fromAgent &&
      message.type &&
      message.content &&
      message.timestamp
    );
  }

  private addToHistory(message: Message): void {
    this.messageHistory.push(message);
    
    // Maintain history size
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }
  }

  private updateStats(operation: 'sent' | 'received' | 'delivered' | 'failed', message: Message): void {
    this.messageStats[`total${operation.charAt(0).toUpperCase() + operation.slice(1)}`]++;
    
    if (!this.messageStats.byType[message.type]) {
      this.messageStats.byType[message.type] = 0;
    }
    this.messageStats.byType[message.type]++;
    
    if (!this.messageStats.byPriority[message.priority]) {
      this.messageStats.byPriority[message.priority] = 0;
    }
    this.messageStats.byPriority[message.priority]++;
  }

  private updateDeliveryStats(deliveryTime: number): void {
    const currentAvg = this.messageStats.averageDeliveryTime;
    const totalDelivered = this.messageStats.totalDelivered;
    
    this.messageStats.averageDeliveryTime = totalDelivered === 1 
      ? deliveryTime 
      : (currentAvg * (totalDelivered - 1) + deliveryTime) / totalDelivered;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.queues.forEach(async (queue, agentId) => {
        const heartbeatMessage: Message = {
          id: `heartbeat-${Date.now()}`,
          sessionId: 'system',
          fromAgent: 'broker',
          toAgent: agentId,
          type: 'heartbeat',
          content: { timestamp: Date.now() },
          timestamp: Date.now(),
          priority: 'low',
          ttl: 30000 // 30 seconds
        };
        
        await this.sendMessage(heartbeatMessage);
      });
    }, 30000); // Every 30 seconds
  }

  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  private cleanup(): void {
    // Clean up old messages from history
    const cutoff = Date.now() - 3600000; // 1 hour
    this.messageHistory = this.messageHistory.filter(msg => msg.timestamp > cutoff);
    
    // Clean up expired delivery timeouts
    this.deliveryTimeouts.forEach((timeout, messageId) => {
      // Timeouts are automatically cleaned up when they fire
    });
    
    // Clean up empty broadcast groups
    this.broadcastGroups.forEach((group, groupId) => {
      if (group.members.size === 0) {
        this.broadcastGroups.delete(groupId);
      }
    });
  }

  async getMessageHistory(sessionId?: string, agentId?: string): Promise<Message[]> {
    let history = [...this.messageHistory];
    
    if (sessionId) {
      history = history.filter(msg => msg.sessionId === sessionId);
    }
    
    if (agentId) {
      history = history.filter(msg => msg.fromAgent === agentId || msg.toAgent === agentId);
    }
    
    return history.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getStats(): Promise<MessageStats> {
    return { ...this.messageStats };
  }

  async getQueueStats(): Promise<Record<string, {
    agentId: string;
    queueSize: number;
    lastProcessed: number;
    isProcessing: boolean;
    processingRate: number;
  }>> {
    const stats: Record<string, any> = {};
    
    this.queues.forEach((queue, agentId) => {
      stats[agentId] = {
        agentId: queue.agentId,
        queueSize: queue.messages.length,
        lastProcessed: queue.lastProcessed,
        isProcessing: queue.isProcessing,
        processingRate: queue.processingRate
      };
    });
    
    return stats;
  }

  async shutdown(): Promise<void> {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Stop cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Clear delivery timeouts
    this.deliveryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.deliveryTimeouts.clear();
    
    // Process remaining messages quickly
    const processingPromises = Array.from(this.queues.values()).map(queue => 
      this.processQueue(queue)
    );
    
    await Promise.all(processingPromises);
    
    logger.info('📬 Message broker shut down');
  }
}
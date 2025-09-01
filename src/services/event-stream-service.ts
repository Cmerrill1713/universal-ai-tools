/**
 * Event Stream Service (UI-TARS inspired)
 * Implements real-time event streaming and interaction patterns
 * Enables continuous communication between UI agents and backend services
 */

import { EventEmitter } from 'events';
import { log, LogContext } from '../utils/logger.js';
import type { WebSocket } from 'ws';

export interface StreamEvent {
  id: string;
  type: EventType;
  source: string;
  target?: string;
  payload: any;
  timestamp: Date;
  sequence: number;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl?: number; // Time to live in milliseconds
  requiresAck?: boolean;
  retryCount?: number;
  correlationId?: string;
  causationId?: string;
}

export type EventType = 
  | 'ui_action'
  | 'agent_response'
  | 'state_change'
  | 'system_notification'
  | 'data_update'
  | 'error'
  | 'progress'
  | 'completion'
  | 'heartbeat'
  | 'multimodal_fusion'
  | 'knowledge_update'
  | 'learning_insight';

export interface EventSubscription {
  id: string;
  eventTypes: EventType[];
  filter?: (event: StreamEvent) => boolean;
  handler: (event: StreamEvent) => void | Promise<void>;
  priority: number;
}

export interface StreamChannel {
  id: string;
  name: string;
  subscribers: Set<string>;
  eventBuffer: StreamEvent[];
  maxBufferSize: number;
  created: Date;
}

class EventStreamService extends EventEmitter {
  private static instance: EventStreamService;
  
  // Event management
  private eventSequence: number = 0;
  private eventHistory: Map<string, StreamEvent> = new Map();
  private eventBuffer: StreamEvent[] = [];
  private maxHistorySize: number = 1000;
  
  // Subscription management
  private subscriptions: Map<string, EventSubscription> = new Map();
  private typeSubscriptions: Map<EventType, Set<string>> = new Map();
  
  // Channel management
  private channels: Map<string, StreamChannel> = new Map();
  private defaultChannel: StreamChannel;
  
  // WebSocket connections for real-time streaming
  private wsConnections: Map<string, WebSocket> = new Map();
  
  // Event processing
  private processingQueue: StreamEvent[] = [];
  private isProcessing: boolean = false;
  private batchSize: number = 10;
  private processingInterval: number = 100; // milliseconds
  
  // Metrics
  private metrics = {
    totalEvents: 0,
    eventsPerSecond: 0,
    averageProcessingTime: 0,
    droppedEvents: 0,
    activeSubscriptions: 0
  };

  private constructor() {
    super();
    this.defaultChannel = this.createChannel('default', 100);
    this.initializeEventStream();
  }

  public static getInstance(): EventStreamService {
    if (!EventStreamService.instance) {
      EventStreamService.instance = new EventStreamService();
    }
    return EventStreamService.instance;
  }

  private initializeEventStream(): void {
    log.info('🌊 Initializing Event Stream Service', LogContext.SERVICE);
    
    // Start event processing loop
    this.startEventProcessing();
    
    // Set up metrics collection
    this.startMetricsCollection();
    
    // Initialize event type subscriptions
    this.initializeEventTypes();
    
    log.info('✅ Event Stream Service initialized - Real-time communication ready', LogContext.SERVICE);
  }

  /**
   * Publish an event to the stream
   */
  public async publish(
    type: EventType,
    source: string,
    payload: any,
    metadata?: Partial<EventMetadata>
  ): Promise<StreamEvent> {
    const event: StreamEvent = {
      id: this.generateEventId(),
      type,
      source,
      payload,
      timestamp: new Date(),
      sequence: ++this.eventSequence,
      metadata: {
        priority: metadata?.priority || 'normal',
        ...metadata
      }
    };
    
    // Add to history
    this.eventHistory.set(event.id, event);
    this.pruneHistory();
    
    // Add to processing queue based on priority
    if (event.metadata?.priority === 'critical') {
      this.processingQueue.unshift(event);
    } else {
      this.processingQueue.push(event);
    }
    
    // Update metrics
    this.metrics.totalEvents++;
    
    // Emit for immediate listeners
    this.emit('event', event);
    
    // Process immediately if critical
    if (event.metadata?.priority === 'critical') {
      await this.processEvent(event);
    }
    
    return event;
  }

  /**
   * Subscribe to events
   */
  public subscribe(
    eventTypes: EventType | EventType[],
    handler: (event: StreamEvent) => void | Promise<void>,
    options?: {
      filter?: (event: StreamEvent) => boolean;
      priority?: number;
    }
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventTypes: types,
      handler,
      filter: options?.filter,
      priority: options?.priority || 0
    };
    
    // Register subscription
    this.subscriptions.set(subscriptionId, subscription);
    
    // Update type subscriptions
    types.forEach(type => {
      if (!this.typeSubscriptions.has(type)) {
        this.typeSubscriptions.set(type, new Set());
      }
      this.typeSubscriptions.get(type)!.add(subscriptionId);
    });
    
    // Update metrics
    this.metrics.activeSubscriptions = this.subscriptions.size;
    
    log.info(`📡 New subscription registered: ${subscriptionId} for ${types.join(', ')}`, LogContext.SERVICE);
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  public unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;
    
    // Remove from type subscriptions
    subscription.eventTypes.forEach(type => {
      this.typeSubscriptions.get(type)?.delete(subscriptionId);
    });
    
    // Remove subscription
    this.subscriptions.delete(subscriptionId);
    
    // Update metrics
    this.metrics.activeSubscriptions = this.subscriptions.size;
    
    return true;
  }

  /**
   * Create a named channel for event streaming
   */
  public createChannel(name: string, maxBufferSize: number = 50): StreamChannel {
    const channelId = this.generateChannelId();
    
    const channel: StreamChannel = {
      id: channelId,
      name,
      subscribers: new Set(),
      eventBuffer: [],
      maxBufferSize,
      created: new Date()
    };
    
    this.channels.set(channelId, channel);
    
    log.info(`📺 Created channel: ${name} (${channelId})`, LogContext.SERVICE);
    
    return channel;
  }

  /**
   * Publish to a specific channel
   */
  public async publishToChannel(
    channelId: string,
    event: StreamEvent
  ): Promise<void> {
    const channel = this.channels.get(channelId) || this.defaultChannel;
    
    // Add to channel buffer
    channel.eventBuffer.push(event);
    if (channel.eventBuffer.length > channel.maxBufferSize) {
      channel.eventBuffer.shift();
    }
    
    // Notify channel subscribers
    channel.subscribers.forEach(subscriberId => {
      const subscription = this.subscriptions.get(subscriberId);
      if (subscription) {
        this.deliverEvent(event, subscription);
      }
    });
  }

  /**
   * Subscribe to a channel
   */
  public subscribeToChannel(channelId: string, subscriptionId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.subscribers.add(subscriptionId);
    }
  }

  /**
   * Start event processing loop
   */
  private startEventProcessing(): void {
    setInterval(async () => {
      if (this.isProcessing || this.processingQueue.length === 0) return;
      
      this.isProcessing = true;
      const startTime = Date.now();
      
      // Process batch of events
      const batch = this.processingQueue.splice(0, this.batchSize);
      
      for (const event of batch) {
        await this.processEvent(event);
      }
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime + processingTime) / 2;
      
      this.isProcessing = false;
    }, this.processingInterval);
  }

  /**
   * Process a single event
   */
  private async processEvent(event: StreamEvent): Promise<void> {
    try {
      // Get relevant subscriptions
      const typeSubscribers = this.typeSubscriptions.get(event.type) || new Set();
      
      // Sort by priority and deliver
      const sortedSubscriptions = Array.from(typeSubscribers)
        .map(id => this.subscriptions.get(id))
        .filter(sub => sub !== undefined)
        .sort((a, b) => (b?.priority || 0) - (a?.priority || 0));
      
      for (const subscription of sortedSubscriptions) {
        if (subscription) {
          await this.deliverEvent(event, subscription);
        }
      }
      
      // Broadcast to WebSocket connections
      this.broadcastToWebSockets(event);
      
    } catch (error) {
      log.error(`Failed to process event ${event.id}:`, LogContext.SERVICE, { error });
      this.metrics.droppedEvents++;
    }
  }

  /**
   * Deliver event to a subscription
   */
  private async deliverEvent(
    event: StreamEvent,
    subscription: EventSubscription
  ): Promise<void> {
    try {
      // Apply filter if present
      if (subscription.filter && !subscription.filter(event)) {
        return;
      }
      
      // Call handler
      await subscription.handler(event);
      
      // Handle acknowledgment if required
      if (event.metadata?.requiresAck) {
        this.acknowledgeEvent(event.id);
      }
      
    } catch (error) {
      log.error(`Subscription ${subscription.id} failed to handle event:`, LogContext.SERVICE, { error });
      
      // Retry if configured
      if (event.metadata?.retryCount && event.metadata.retryCount > 0) {
        event.metadata.retryCount--;
        this.processingQueue.push(event);
      }
    }
  }

  /**
   * Broadcast event to WebSocket connections
   */
  private broadcastToWebSockets(event: StreamEvent): void {
    const message = JSON.stringify({
      type: 'event',
      data: event
    });
    
    this.wsConnections.forEach((ws, connectionId) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          ws.send(message);
        } catch (error) {
          log.error(`Failed to send to WebSocket ${connectionId}:`, LogContext.SERVICE, { error });
        }
      }
    });
  }

  /**
   * Register a WebSocket connection
   */
  public registerWebSocket(connectionId: string, ws: WebSocket): void {
    this.wsConnections.set(connectionId, ws);
    
    // Set up heartbeat
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === 1) {
        this.publish('heartbeat', 'system', { connectionId });
      } else {
        clearInterval(heartbeatInterval);
        this.wsConnections.delete(connectionId);
      }
    }, 30000); // 30 seconds
    
    log.info(`🔌 WebSocket registered: ${connectionId}`, LogContext.SERVICE);
  }

  /**
   * Query event history
   */
  public queryHistory(
    filter: {
      types?: EventType[];
      source?: string;
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    }
  ): StreamEvent[] {
    let events = Array.from(this.eventHistory.values());
    
    // Apply filters
    if (filter.types) {
      events = events.filter(e => filter.types!.includes(e.type));
    }
    if (filter.source) {
      events = events.filter(e => e.source === filter.source);
    }
    if (filter.startTime) {
      events = events.filter(e => e.timestamp >= filter.startTime!);
    }
    if (filter.endTime) {
      events = events.filter(e => e.timestamp <= filter.endTime!);
    }
    
    // Sort by sequence
    events.sort((a, b) => b.sequence - a.sequence);
    
    // Apply limit
    if (filter.limit) {
      events = events.slice(0, filter.limit);
    }
    
    return events;
  }

  /**
   * Get stream metrics
   */
  public getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Acknowledge event receipt
   */
  private acknowledgeEvent(eventId: string): void {
    const event = this.eventHistory.get(eventId);
    if (event) {
      this.publish('system_notification', 'system', {
        type: 'ack',
        eventId,
        timestamp: new Date()
      });
    }
  }

  /**
   * Prune event history to maintain size limit
   */
  private pruneHistory(): void {
    if (this.eventHistory.size > this.maxHistorySize) {
      const sortedEvents = Array.from(this.eventHistory.values())
        .sort((a, b) => a.sequence - b.sequence);
      
      const toDelete = sortedEvents.slice(0, sortedEvents.length - this.maxHistorySize);
      toDelete.forEach(event => this.eventHistory.delete(event.id));
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    let lastEventCount = 0;
    
    setInterval(() => {
      const currentCount = this.metrics.totalEvents;
      this.metrics.eventsPerSecond = (currentCount - lastEventCount) / 5;
      lastEventCount = currentCount;
    }, 5000); // Every 5 seconds
  }

  /**
   * Initialize event types
   */
  private initializeEventTypes(): void {
    const eventTypes: EventType[] = [
      'ui_action', 'agent_response', 'state_change', 'system_notification',
      'data_update', 'error', 'progress', 'completion', 'heartbeat',
      'multimodal_fusion', 'knowledge_update', 'learning_insight'
    ];
    
    eventTypes.forEach(type => {
      if (!this.typeSubscriptions.has(type)) {
        this.typeSubscriptions.set(type, new Set());
      }
    });
  }

  // ID generation helpers
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  
  private generateChannelId(): string {
    return `ch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Create event stream for specific context
   */
  public createContextStream(context: string): AsyncIterator<StreamEvent> {
    const buffer: StreamEvent[] = [];
    let resolve: ((value: IteratorResult<StreamEvent>) => void) | null = null;
    
    const subscriptionId = this.subscribe(
      ['ui_action', 'agent_response', 'state_change', 'data_update'],
      (event) => {
        if (event.metadata?.correlationId === context) {
          if (resolve) {
            resolve({ value: event, done: false });
            resolve = null;
          } else {
            buffer.push(event);
          }
        }
      }
    );
    
    return {
      next: async () => {
        if (buffer.length > 0) {
          return { value: buffer.shift()!, done: false };
        }
        
        return new Promise<IteratorResult<StreamEvent>>((res) => {
          resolve = res;
        });
      },
      return: async () => {
        this.unsubscribe(subscriptionId);
        return { value: undefined, done: true };
      },
      throw: async (error) => {
        this.unsubscribe(subscriptionId);
        throw error;
      }
    };
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    // Close WebSocket connections
    this.wsConnections.forEach(ws => ws.close());
    this.wsConnections.clear();
    
    // Clear subscriptions
    this.subscriptions.clear();
    this.typeSubscriptions.clear();
    
    // Clear channels
    this.channels.clear();
    
    log.info('🌊 Event Stream Service stopped', LogContext.SERVICE);
  }
}

export default EventStreamService;
export { EventStreamService };
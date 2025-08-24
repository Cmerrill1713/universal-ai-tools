import WebSocket from 'ws';
import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';

// Service registration interface
interface ServiceRegistration {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  health_check: string;
  capabilities: string[];
  config?: Record<string, any>;
}

// Automation event interface
interface AutomationEvent {
  id?: string;
  type: string;
  source: string;
  target?: string;
  payload: Record<string, any>;
  timestamp?: Date;
  status?: string;
}

// Service status interface
interface ServiceStatus {
  status: 'online' | 'offline' | 'error';
  last_seen: Date;
  health_check_url: string;
  error?: string;
}

/**
 * ServiceConnector - TypeScript integration library for Orchestration Hub
 * Provides service registration, event handling, and WebSocket communication
 */
export class ServiceConnector extends EventEmitter {
  private hubUrl: string;
  private wsUrl: string;
  private service: ServiceRegistration;
  private ws?: WebSocket;
  private httpClient: AxiosInstance;
  private reconnectInterval: number = 5000;
  private reconnectTimer?: NodeJS.Timeout;
  private healthCheckInterval: number = 30000;
  private healthCheckTimer?: NodeJS.Timeout;
  private isConnected: boolean = false;

  constructor(
    hubUrl: string = 'http://localhost:8100',
    service: ServiceRegistration
  ) {
    super();
    this.hubUrl = hubUrl;
    this.wsUrl = hubUrl.replace('http', 'ws') + '/ws/events';
    this.service = service;
    
    // Initialize HTTP client
    this.httpClient = axios.create({
      baseURL: hubUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Connect to the orchestration hub
   */
  async connect(): Promise<void> {
    try {
      // Register service first
      await this.registerService();
      
      // Connect WebSocket for real-time events
      await this.connectWebSocket();
      
      // Start health check reporting
      this.startHealthCheck();
      
      this.emit('connected', this.service);
      console.log(`✅ Service ${this.service.name} connected to orchestration hub`);
    } catch (error) {
      console.error(`❌ Failed to connect service ${this.service.name}:`, error);
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Register service with the orchestration hub
   */
  private async registerService(): Promise<void> {
    try {
      const response = await this.httpClient.post('/api/services/register', this.service);
      
      if (response.data.status === 'registered') {
        console.log(`📝 Service ${this.service.name} registered successfully`);
      } else {
        throw new Error(`Registration failed: ${response.data.error}`);
      }
    } catch (error: any) {
      console.error(`Failed to register service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect to WebSocket for real-time event streaming
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.on('open', () => {
        this.isConnected = true;
        console.log(`🔌 WebSocket connected for ${this.service.name}`);
        
        // Send service identification
        this.ws?.send(JSON.stringify({
          type: 'identify',
          service_id: this.service.id,
          service_type: this.service.type
        }));
        
        resolve();
      });
      
      this.ws.on('message', (data: string) => {
        try {
          const event = JSON.parse(data) as AutomationEvent;
          this.handleIncomingEvent(event);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });
      
      this.ws.on('error', (error) => {
        console.error(`WebSocket error for ${this.service.name}:`, error);
        this.emit('error', error);
      });
      
      this.ws.on('close', () => {
        this.isConnected = false;
        console.log(`WebSocket disconnected for ${this.service.name}`);
        this.emit('disconnected');
        this.scheduleReconnect();
      });
      
      // Timeout connection attempt
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Handle incoming automation events
   */
  private handleIncomingEvent(event: AutomationEvent): void {
    console.log(`📨 Received event: ${event.type} from ${event.source}`);
    
    // Check if this event is targeted to this service
    if (event.target === this.service.id || event.target === this.service.type) {
      this.emit('automation_event', event);
      
      // Emit specific event types
      this.emit(event.type, event);
    }
    
    // Always emit raw events for monitoring
    this.emit('raw_event', event);
  }

  /**
   * Send an automation event to the hub
   */
  async triggerAutomation(event: Omit<AutomationEvent, 'source'>): Promise<string> {
    const fullEvent: AutomationEvent = {
      ...event,
      source: this.service.id,
      timestamp: new Date()
    };
    
    try {
      const response = await this.httpClient.post('/api/automation/trigger', fullEvent);
      
      if (response.data.status === 'queued') {
        console.log(`🚀 Automation triggered: ${event.type} (ID: ${response.data.event_id})`);
        return response.data.event_id;
      } else {
        throw new Error(`Failed to trigger automation: ${response.data.error}`);
      }
    } catch (error: any) {
      console.error(`Failed to trigger automation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Discover other registered services
   */
  async discoverServices(): Promise<ServiceRegistration[]> {
    try {
      const response = await this.httpClient.get('/api/services/discover');
      return response.data as ServiceRegistration[];
    } catch (error: any) {
      console.error(`Failed to discover services: ${error.message}`);
      throw error;
    }
  }

  /**
   * Report problem for auto-healing
   */
  async reportProblem(
    problem: string,
    service: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: Record<string, any>
  ): Promise<string> {
    return this.triggerAutomation({
      type: 'problem.detected',
      payload: {
        problem,
        service,
        severity,
        details,
        reported_by: this.service.id,
        timestamp: new Date()
      }
    });
  }

  /**
   * Request security vulnerability scan
   */
  async requestSecurityScan(
    target: string,
    scanType: 'dependency' | 'code' | 'infrastructure'
  ): Promise<string> {
    return this.triggerAutomation({
      type: 'security.scan_request',
      payload: {
        target,
        scan_type: scanType,
        requested_by: this.service.id
      }
    });
  }

  /**
   * Report performance degradation
   */
  async reportPerformanceIssue(
    metric: string,
    currentValue: number,
    expectedValue: number,
    service: string
  ): Promise<string> {
    return this.triggerAutomation({
      type: 'performance.degradation',
      payload: {
        metric,
        current_value: currentValue,
        expected_value: expectedValue,
        degradation_percentage: ((currentValue - expectedValue) / expectedValue) * 100,
        service,
        reported_by: this.service.id
      }
    });
  }

  /**
   * Request chaos injection for testing
   */
  async requestChaosTest(
    scenario: string,
    target: string,
    duration: number,
    intensity: 'low' | 'medium' | 'high'
  ): Promise<string> {
    return this.triggerAutomation({
      type: 'chaos.inject',
      payload: {
        scenario,
        target,
        duration,
        intensity,
        requested_by: this.service.id,
        safety_mode: true
      }
    });
  }

  /**
   * Start health check reporting
   */
  private startHealthCheck(): void {
    // Clear existing timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    // Report health immediately
    this.reportHealth();
    
    // Set up periodic health reporting
    this.healthCheckTimer = setInterval(() => {
      this.reportHealth();
    }, this.healthCheckInterval);
  }

  /**
   * Report service health to hub
   */
  private async reportHealth(): Promise<void> {
    if (!this.isConnected) return;
    
    try {
      // Perform self-health check if handler is registered
      const healthStatus = await this.performSelfHealthCheck();
      
      // Send health status via WebSocket
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'health.report',
          service_id: this.service.id,
          status: healthStatus.status,
          timestamp: new Date()
        }));
      }
    } catch (error) {
      console.error(`Failed to report health for ${this.service.name}:`, error);
    }
  }

  /**
   * Perform self health check
   */
  private async performSelfHealthCheck(): Promise<ServiceStatus> {
    // This can be overridden by services
    return {
      status: 'online',
      last_seen: new Date(),
      health_check_url: this.service.health_check
    };
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      console.log(`🔄 Attempting to reconnect ${this.service.name}...`);
      this.connect().catch(error => {
        console.error(`Reconnection failed: ${error.message}`);
      });
    }, this.reconnectInterval);
  }

  /**
   * Disconnect from the orchestration hub
   */
  async disconnect(): Promise<void> {
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    
    this.isConnected = false;
    this.emit('disconnected');
    console.log(`👋 Service ${this.service.name} disconnected from orchestration hub`);
  }

  /**
   * Register custom event handler
   */
  onAutomationEvent(
    eventType: string,
    handler: (event: AutomationEvent) => void | Promise<void>
  ): void {
    this.on(eventType, handler);
  }

  /**
   * Check if connected to hub
   */
  isConnectedToHub(): boolean {
    return this.isConnected;
  }

  /**
   * Get service registration details
   */
  getServiceInfo(): ServiceRegistration {
    return this.service;
  }
}

// Helper function to create service connector
export function createServiceConnector(
  serviceConfig: ServiceRegistration,
  hubUrl?: string
): ServiceConnector {
  return new ServiceConnector(hubUrl, serviceConfig);
}

// Export types for external use
export type {
  ServiceRegistration,
  AutomationEvent,
  ServiceStatus
};
/**
 * Home Assistant Integration Service
 * Connects to Home Assistant API to control smart home devices through voice commands
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

export interface HomeAssistantConfig {
  url: string;
  accessToken: string;
  enableWebSocket?: boolean;
}

export interface HADevice {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    device_class?: string;
    supported_features?: number;
    [key: string]: any;
  };
  last_changed: string;
  last_updated: string;
}

export interface HAService {
  domain: string;
  service: string;
  description?: string;
  fields?: Record<string, any>;
}

export interface HACommand {
  action: 'turn_on' | 'turn_off' | 'toggle' | 'set' | 'increase' | 'decrease' | 'scene' | 'automation';
  entity?: string;
  value?: any;
  attributes?: Record<string, any>;
}

class HomeAssistantService extends EventEmitter {
  private api: AxiosInstance | null = null;
  private ws: WebSocket | null = null;
  private config: HomeAssistantConfig | null = null;
  private devices: Map<string, HADevice> = new Map();
  private services: Map<string, HAService[]> = new Map();
  private messageId = 1;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;

  /**
   * Initialize Home Assistant connection
   */
  async initialize(config: HomeAssistantConfig): Promise<boolean> {
    try {
      this.config = config;
      
      // Setup REST API client
      this.api = axios.create({
        baseURL: `${config.url}/api`,
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      // Test connection
      const response = await this.api.get('/');
      logger.info('🏠 Connected to Home Assistant', {
        version: response.data.message,
        context: 'home-assistant'
      });

      // Load initial state
      await this.loadDevices();
      await this.loadServices();

      // Setup WebSocket for real-time updates
      if (config.enableWebSocket) {
        await this.connectWebSocket();
      }

      this.isConnected = true;
      this.emit('connected');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Home Assistant', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'home-assistant'
      });
      return false;
    }
  }

  /**
   * Connect to Home Assistant WebSocket API
   */
  private async connectWebSocket(): Promise<void> {
    if (!this.config) return;

    const wsUrl = this.config.url.replace('http', 'ws') + '/api/websocket';
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        logger.info('🔌 WebSocket connected to Home Assistant', { context: 'home-assistant' });
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleWebSocketMessage(data.toString());
      });

      this.ws.on('close', () => {
        logger.warn('WebSocket disconnected from Home Assistant', { context: 'home-assistant' });
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error', {
          error: error.message,
          context: 'home-assistant'
        });
      });
    } catch (error) {
      logger.error('Failed to connect WebSocket', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'home-assistant'
      });
    }
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: string): void {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'auth_required':
          this.authenticateWebSocket();
          break;
        case 'auth_ok':
          this.subscribeToEvents();
          break;
        case 'event':
          this.handleStateChange(data.event);
          break;
      }
    } catch (error) {
      logger.error('Failed to handle WebSocket message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'home-assistant'
      });
    }
  }

  /**
   * Authenticate WebSocket connection
   */
  private authenticateWebSocket(): void {
    if (!this.ws || !this.config) return;

    this.ws.send(JSON.stringify({
      type: 'auth',
      access_token: this.config.accessToken
    }));
  }

  /**
   * Subscribe to state change events
   */
  private subscribeToEvents(): void {
    if (!this.ws) return;

    this.ws.send(JSON.stringify({
      id: this.messageId++,
      type: 'subscribe_events',
      event_type: 'state_changed'
    }));
  }

  /**
   * Handle state change events
   */
  private handleStateChange(event: any): void {
    if (event.event_type === 'state_changed' && event.data) {
      const entityId = event.data.entity_id;
      const newState = event.data.new_state;
      
      if (newState) {
        this.devices.set(entityId, newState);
        this.emit('deviceStateChanged', {
          entityId,
          oldState: event.data.old_state,
          newState
        });
      }
    }
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      logger.info('Attempting to reconnect WebSocket...', { context: 'home-assistant' });
      this.connectWebSocket();
    }, 5000);
  }

  /**
   * Load all devices from Home Assistant
   */
  async loadDevices(): Promise<void> {
    if (!this.api) return;

    try {
      const response = await this.api.get('/states');
      const states: HADevice[] = response.data;

      this.devices.clear();
      states.forEach(device => {
        this.devices.set(device.entity_id, device);
      });

      logger.info(`📱 Loaded ${this.devices.size} devices from Home Assistant`, {
        context: 'home-assistant'
      });
    } catch (error) {
      logger.error('Failed to load devices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'home-assistant'
      });
    }
  }

  /**
   * Load available services from Home Assistant
   */
  async loadServices(): Promise<void> {
    if (!this.api) return;

    try {
      const response = await this.api.get('/services');
      const services = response.data;

      this.services.clear();
      for (const domain of services) {
        if (domain.services) {
          this.services.set(domain.domain, Object.values(domain.services));
        }
      }

      logger.info(`🔧 Loaded services from ${this.services.size} domains`, {
        context: 'home-assistant'
      });
    } catch (error) {
      logger.error('Failed to load services', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'home-assistant'
      });
    }
  }

  /**
   * Get device by entity ID or friendly name
   */
  getDevice(identifier: string): HADevice | undefined {
    // Try direct entity_id lookup
    let device = this.devices.get(identifier);
    if (device) return device;

    // Try friendly name lookup
    const lowerIdentifier = identifier.toLowerCase();
    for (const [entityId, dev] of this.devices) {
      const friendlyName = dev.attributes.friendly_name?.toLowerCase();
      if (friendlyName && friendlyName.includes(lowerIdentifier)) {
        return dev;
      }
    }

    return undefined;
  }

  /**
   * Get devices by type
   */
  getDevicesByType(deviceClass: string): HADevice[] {
    const devices: HADevice[] = [];
    
    for (const device of this.devices.values()) {
      if (device.attributes.device_class === deviceClass || 
          device.entity_id.startsWith(deviceClass)) {
        devices.push(device);
      }
    }

    return devices;
  }

  /**
   * Get all devices grouped by domain
   */
  getDevicesByDomain(): Map<string, HADevice[]> {
    const grouped = new Map<string, HADevice[]>();

    for (const device of this.devices.values()) {
      const domain = device.entity_id?.split('.')[0] || 'unknown';
      if (!grouped.has(domain)) {
        grouped.set(domain, []);
      }
      grouped.get(domain)!.push(device);
    }

    return grouped;
  }

  /**
   * Call a Home Assistant service
   */
  async callService(
    domain: string,
    service: string,
    data?: Record<string, any>
  ): Promise<any> {
    if (!this.api) {
      throw new Error('Home Assistant not connected');
    }

    try {
      const response = await this.api.post(`/services/${domain}/${service}`, data || {});
      
      logger.info('🎮 Called Home Assistant service', {
        domain,
        service,
        data,
        context: 'home-assistant'
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to call service', {
        domain,
        service,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'home-assistant'
      });
      throw error;
    }
  }

  /**
   * Execute a command based on natural language
   */
  async executeCommand(command: HACommand): Promise<any> {
    try {
      switch (command.action) {
        case 'turn_on':
        case 'turn_off':
          if (!command.entity) {
            throw new Error('Entity required for turn on/off commands');
          }
          const domain = command.entity?.split('.')[0] || 'unknown';
          return await this.callService(domain, command.action, {
            entity_id: command.entity,
            ...command.attributes
          });

        case 'toggle':
          if (!command.entity) {
            throw new Error('Entity required for toggle command');
          }
          const toggleDomain = command.entity?.split('.')[0] || 'unknown';
          return await this.callService(toggleDomain, 'toggle', {
            entity_id: command.entity
          });

        case 'set':
          if (!command.entity || command.value === undefined) {
            throw new Error('Entity and value required for set command');
          }
          return await this.setEntityValue(command.entity, command.value, command.attributes);

        case 'increase':
        case 'decrease':
          if (!command.entity) {
            throw new Error('Entity required for increase/decrease command');
          }
          return await this.adjustEntityValue(command.entity, command.action, command.value || 10);

        case 'scene':
          if (!command.entity) {
            throw new Error('Scene name required');
          }
          return await this.callService('scene', 'turn_on', {
            entity_id: `scene.${command.entity}`
          });

        case 'automation':
          if (!command.entity) {
            throw new Error('Automation name required');
          }
          return await this.callService('automation', 'trigger', {
            entity_id: `automation.${command.entity}`
          });

        default:
          throw new Error(`Unknown command action: ${command.action}`);
      }
    } catch (error) {
      logger.error('Failed to execute command', {
        command,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'home-assistant'
      });
      throw error;
    }
  }

  /**
   * Set entity value (for lights, covers, climate, etc.)
   */
  private async setEntityValue(
    entityId: string,
    value: any,
    attributes?: Record<string, any>
  ): Promise<any> {
    const domain = entityId.split('.')[0];

    switch (domain) {
      case 'light':
        return await this.callService('light', 'turn_on', {
          entity_id: entityId,
          brightness: typeof value === 'number' ? Math.round(value * 2.55) : undefined,
          ...attributes
        });

      case 'climate':
        return await this.callService('climate', 'set_temperature', {
          entity_id: entityId,
          temperature: value,
          ...attributes
        });

      case 'cover':
        return await this.callService('cover', 'set_cover_position', {
          entity_id: entityId,
          position: value,
          ...attributes
        });

      case 'fan':
        return await this.callService('fan', 'set_percentage', {
          entity_id: entityId,
          percentage: value,
          ...attributes
        });

      default:
        throw new Error(`Cannot set value for domain: ${domain}`);
    }
  }

  /**
   * Adjust entity value up or down
   */
  private async adjustEntityValue(
    entityId: string,
    direction: 'increase' | 'decrease',
    amount: number
  ): Promise<any> {
    const device = this.getDevice(entityId);
    if (!device) {
      throw new Error(`Device not found: ${entityId}`);
    }

    const domain = entityId.split('.')[0];
    const multiplier = direction === 'increase' ? 1 : -1;

    switch (domain) {
      case 'light':
        const currentBrightness = device.attributes.brightness || 0;
        const newBrightness = Math.max(0, Math.min(255, currentBrightness + (amount * 2.55 * multiplier)));
        return await this.callService('light', 'turn_on', {
          entity_id: entityId,
          brightness: Math.round(newBrightness)
        });

      case 'climate':
        const currentTemp = parseFloat(device.attributes.temperature || device.state);
        const newTemp = currentTemp + (amount * multiplier);
        return await this.callService('climate', 'set_temperature', {
          entity_id: entityId,
          temperature: newTemp
        });

      case 'cover':
        const currentPosition = device.attributes.current_position || 0;
        const newPosition = Math.max(0, Math.min(100, currentPosition + (amount * multiplier)));
        return await this.callService('cover', 'set_cover_position', {
          entity_id: entityId,
          position: newPosition
        });

      case 'fan':
        const currentSpeed = device.attributes.percentage || 0;
        const newSpeed = Math.max(0, Math.min(100, currentSpeed + (amount * multiplier)));
        return await this.callService('fan', 'set_percentage', {
          entity_id: entityId,
          percentage: newSpeed
        });

      default:
        throw new Error(`Cannot adjust value for domain: ${domain}`);
    }
  }

  /**
   * Get current connection status
   */
  isActive(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from Home Assistant
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isConnected = false;
    this.devices.clear();
    this.services.clear();
    this.emit('disconnected');
  }
}

// Export singleton instance
export const homeAssistantService = new HomeAssistantService();
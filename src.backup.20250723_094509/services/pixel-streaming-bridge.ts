/**
 * Pixel Streaming Bridge Service
 *
 * Handles WebRTC communication between UE5 Pixel Streaming and React frontend
 * Manages bidirectional data flow for avatar control and video streaming
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/enhanced-logger';

export interface PixelStreamingConfig {
  signallingServerUrl: string;
  autoConnect: boolean;
  autoPlayVideo: boolean;
  startVideoMuted: boolean;
  startAudioMuted: boolean;
  useHovering: boolean;
  suppressBrowserKeys: boolean;
  fakeMouseWithTouches: boolean;
}

export interface AvatarCommand {
  type: 'personality' | 'clothing' | 'animation' | 'voice' | 'interaction';
  action: string;
  parameters: Record<string, unknown>;
  timestamp: number;
}

export interface AvatarState {
  personality: 'sweet' | 'shy' | 'confident' | 'caring' | 'playful';
  clothing: {
    level: 'conservative' | 'moderate' | 'revealing' | 'very_revealing';
    customization: Record<string, unknown>;
  };
  animation: {
    current: string;
    mood: string;
    intensity: number;
  };
  voice: {
    speaking: boolean;
    listening: boolean;
    processing: boolean;
  };
  quality: {
    fps: number;
    latency: number;
    bandwidth: number;
  };
}

export class PixelStreamingBridge extends EventEmitter {
  private webRtcPlayer: any = null;
  private signallingServer: any = null;
  private isConnected = false;
  private isStreaming = false;
  private config: PixelStreamingConfig;
  private currentState: AvatarState;
  private commandQueue: AvatarCommand[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(config: Partial<PixelStreamingConfig> = {}) {
    super();

    // Get default URL from environment or use fallback
    const defaultSignallingUrl = process.env.PIXEL_STREAMING_URL || 'ws://127.0.0.1:8888';

    this.config = {
      signallingServerUrl: config.signallingServerUrl || defaultSignallingUrl,
      autoConnect: config.autoConnect ?? true,
      autoPlayVideo: config.autoPlayVideo ?? true,
      startVideoMuted: config.startVideoMuted ?? false,
      startAudioMuted: config.startAudioMuted ?? false,
      useHovering: config.useHovering ?? true,
      suppressBrowserKeys: config.suppressBrowserKeys ?? true,
      fakeMouseWithTouches: config.fakeMouseWithTouches ?? true,
    };

    // Validate and fix URL format
    this.validateAndFixSignallingUrl();

    this.currentState = {
      personality: 'sweet',
      clothing: {
        level: 'moderate',
        customization: {},
      },
      animation: {
        current: 'idle',
        mood: 'neutral',
        intensity: 0.5,
      },
      voice: {
        speaking: false,
        listening: false,
        processing: false,
      },
      quality: {
        fps: 0,
        latency: 0,
        bandwidth: 0,
      },
    };

    this.setupEventHandlers();
  }

  /**
   * Validate and fix the signalling server URL format
   */
  private validateAndFixSignallingUrl(): void {
    const url = this.config.signallingServerUrl;

    // Check if URL is properly formatted
    if (!url || url === 'ws:' || url === 'wss:' || !url.match(/^wss?:\/\/[^/]+/)) {
      logger.error('Invalid SignallingServerUrl format:', undefined, { url });
      logger.info('Expected format: ws://host:port or wss://host:port');

      // Fallback to a valid default
      this.config.signallingServerUrl = 'ws://127.0.0.1:8888';
      logger.info('Using fallback SignallingServerUrl:', undefined, {
        url: this.config.signallingServerUrl,
      });
    } else {
      logger.info('SignallingServerUrl validated:', undefined, {
        url: this.config.signallingServerUrl,
      });
    }
  }

  /**
   * Initialize the Pixel Streaming connection
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Pixel Streaming Bridge', undefined, {
        signallingServerUrl: this.config.signallingServerUrl,
      });

      // Import UE5 Pixel Streaming frontend library
      await this.loadPixelStreamingLibrary();

      // Create WebRTC player instance
      this.createWebRtcPlayer();

      // Setup signalling server connection
      this.setupSignallingServer();

      if (this.config.autoConnect) {
        await this.connect();
      }

      this.emit('initialized');
      logger.info('Pixel Streaming Bridge initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Pixel Streaming Bridge:', undefined, error);
      this.emit('_error, error);
      throw error;
    }
  }

  /**
   * Connect to UE5 Pixel Streaming server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('Already connected to Pixel Streaming server');
      return;
    }

    try {
      logger.info('Connecting to Pixel Streaming server...');

      await this.signallingServer.connect();
      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.emit('connected');
      logger.info('Connected to Pixel Streaming server');

      // Start processing command queue
      this.processCommandQueue();
    } catch (error) {
      logger.error('Failed to connect to Pixel Streaming server:', undefined, error);
      this.handleConnectionError(_error);
      throw error;
    }
  }

  /**
   * Disconnect from Pixel Streaming server
   */
  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting from Pixel Streaming server...');

      if (this.signallingServer) {
        await this.signallingServer.disconnect();
      }

      if (this.webRtcPlayer) {
        this.webRtcPlayer.close();
      }

      this.isConnected = false;
      this.isStreaming = false;

      this.emit('disconnected');
      logger.info('Disconnected from Pixel Streaming server');
    } catch (error) {
      logger.error('Error during disconnect:', undefined, error);
      this.emit('_error, error);
    }
  }

  /**
   * Send command to UE5 avatar
   */
  async sendAvatarCommand(command: Omit<AvatarCommand, 'timestamp'>): Promise<void> {
    const fullCommand: AvatarCommand = {
      ...command,
      timestamp: Date.now(),
    };

    if (!this.isConnected) {
      logger.warn('Not connected - queueing command', undefined, fullCommand);
      this.commandQueue.push(fullCommand);
      return;
    }

    try {
      logger.debug('Sending avatar command', undefined, fullCommand);

      // Send command via WebRTC data channel
      const commandData = JSON.stringify({
        type: 'avatar_command',
        data: fullCommand,
      });

      if (this.webRtcPlayer && this.webRtcPlayer.sendMessage) {
        this.webRtcPlayer.sendMessage(commandData);
        this.emit('commandSent', fullCommand);
      } else {
        throw new Error('WebRTC player not ready for sending messages');
      }
    } catch (error) {
      logger.error('Failed to send avatar command:', undefined, error);
      this.emit('commandError', { command: fullCommand, error});
      throw error;
    }
  }

  /**
   * Update avatar personality
   */
  async setPersonality(personality: AvatarState['personality']): Promise<void> {
    await this.sendAvatarCommand({
      type: 'personality',
      action: 'change',
      parameters: { personality },
    });

    this.currentState.personality = personality;
    this.emit('stateChanged', { personality });
  }

  /**
   * Update avatar clothing
   */
  async setClothing(clothing: Partial<AvatarState['clothing']>): Promise<void> {
    await this.sendAvatarCommand({
      type: 'clothing',
      action: 'update',
      parameters: clothing,
    });

    this.currentState.clothing = { ...this.currentState.clothing, ...clothing };
    this.emit('stateChanged', { clothing: this.currentState.clothing });
  }

  /**
   * Trigger avatar animation
   */
  async triggerAnimation(animation: string, parameters: Record<string, unknown> = {}): Promise<void> {
    await this.sendAvatarCommand({
      type: 'animation',
      action: 'trigger',
      parameters: { animation, ...parameters },
    });
  }

  /**
   * Send voice _inputto avatar
   */
  async sendVoiceInput(audioData: Blob, transcript?: string): Promise<void> {
    // Convert audio blob to base64 for transmission
    const base64Audio = await this.blobToBase64(audioData);

    await this.sendAvatarCommand({
      type: 'voice',
      action: '_input,
      parameters: {
        audio: base64Audio,
        transcript,
        format: 'webm',
      },
    });

    this.currentState.voice.processing = true;
    this.emit('stateChanged', { voice: this.currentState.voice });
  }

  /**
   * Send text _inputto avatar for TTS
   */
  async sendTextInput(text: string, personality?: AvatarState['personality']): Promise<void> {
    await this.sendAvatarCommand({
      type: 'voice',
      action: 'speak',
      parameters: {
        text,
        personality: personality || this.currentState.personality,
      },
    });
  }

  /**
   * Get current avatar state
   */
  getAvatarState(): AvatarState {
    return { ...this.currentState };
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    streaming: boolean;
    quality: AvatarState['quality'];
  } {
    return {
      connected: this.isConnected,
      streaming: this.isStreaming,
      quality: this.currentState.quality,
    };
  }

  /**
   * Setup event handlers for the bridge
   */
  private setupEventHandlers(): void {
    this.on('messageReceived', this.handleUE5Message.bind(this));
    this.on('connectionLost', this.handleConnectionLost.bind(this));
    this.on('qualityChanged', this.handleQualityChange.bind(this));
  }

  /**
   * Load UE5 Pixel Streaming frontend library
   */
  private async loadPixelStreamingLibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if library is already loaded
      if (typeof (window as: any).PixelStreaming !== 'undefined') {
        resolve();
        return;
      }

      // Dynamically load the UE5 Pixel Streaming library
      const script = document.createElement('script');
      script.src = '/static/ue5-pixel-streaming.js'; // Path to UE5 frontend JS
      script.onload = () => resolve();
      script.on_error= () => reject(new Error('Failed to load Pixel Streaming library'));
      document.head.appendChild(script);
    });
  }

  /**
   * Create WebRTC player instance
   */
  private createWebRtcPlayer(): void {
    const { PixelStreaming } = window as: any;

    this.webRtcPlayer = new PixelStreaming.WebRtcPlayer({
      initialSettings: {
        AutoPlayVideo: this.config.autoPlayVideo,
        StartVideoMuted: this.config.startVideoMuted,
        StartAudioMuted: this.config.startAudioMuted,
        UseHovering: this.config.useHovering,
        SuppressBrowserKeys: this.config.suppressBrowserKeys,
        FakeMouseWithTouches: this.config.fakeMouseWithTouches,
      },
    });

    // Setup WebRTC player event handlers
    this.webRtcPlayer.addEventListener('message', (event: any) => {
      this.emit('messageReceived', event.data);
    });

    this.webRtcPlayer.addEventListener('videoInitialized', () => {
      this.isStreaming = true;
      this.emit('streamingStarted');
    });

    this.webRtcPlayer.addEventListener('connectionStateChanged', (event: any) => {
      if (event.connectionState === 'disconnected') {
        this.emit('connectionLost');
      }
    });

    this.webRtcPlayer.addEventListener('statsReceived', (event: any) => {
      this.updateQualityMetrics(event.stats);
    });
  }

  /**
   * Setup signalling server connection
   */
  private setupSignallingServer(): void {
    const { PixelStreaming } = window as: any;

    this.signallingServer = new PixelStreaming.SignallingWebSocket({
      url: this.config.signallingServerUrl,
      webRtcPlayer: this.webRtcPlayer,
    });

    this.signallingServer.addEventListener('open', () => {
      logger.info('Signalling server connection opened');
    });

    this.signallingServer.addEventListener('close', () => {
      logger.info('Signalling server connection closed');
      this.emit('connectionLost');
    });

    this.signallingServer.addEventListener('_error, (_error any) => {
      logger.error('Signalling server error', undefined, error);
      this.emit('_error, error);
    });
  }

  /**
   * Process queued commands when connection is established
   */
  private async processCommandQueue(): Promise<void> {
    while (this.commandQueue.length > 0 && this.isConnected) {
      const command = this.commandQueue.shift();
      if (command) {
        try {
          await this.sendAvatarCommand(command);
        } catch (error) {
          logger.error('Failed to process queued command:', undefined, { command, error});
        }
      }
    }
  }

  /**
   * Handle messages received from UE5
   */
  private handleUE5Message(data: any): void {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;

      switch (message.type) {
        case 'avatar_state_update':
          this.updateAvatarState(message.data);
          break;
        case 'voice_response':
          this.handleVoiceResponse(message.data);
          break;
        case 'animation_complete':
          this.handleAnimationComplete(message.data);
          break;
        case 'error':
          this.emit('ue5Error', message.data);
          break;
        default:
          logger.debug('Unknown message type from UE5:', undefined, message);
      }
    } catch (error) {
      logger.error('Failed to process UE5 message:', undefined, { data, error});
    }
  }

  /**
   * Update local avatar state from UE5
   */
  private updateAvatarState(stateUpdate: Partial<AvatarState>): void {
    this.currentState = { ...this.currentState, ...stateUpdate };
    this.emit('stateChanged', stateUpdate);
  }

  /**
   * Handle voice response from avatar
   */
  private handleVoiceResponse(data: any): void {
    this.currentState.voice.speaking = data.speaking || false;
    this.currentState.voice.processing = false;
    this.emit('voiceResponse', data);
    this.emit('stateChanged', { voice: this.currentState.voice });
  }

  /**
   * Handle animation completion
   */
  private handleAnimationComplete(data: any): void {
    this.emit('animationComplete', data);
  }

  /**
   * Handle connection loss
   */
  private handleConnectionLost(): void {
    this.isConnected = false;
    this.isStreaming = false;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        logger.info(
          `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
        );
        this.connect().catch((err) => {
          logger.error('Reconnection failed:', undefined, err);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      logger.error('Max reconnection attempts reached');
      this.emit('reconnectionFailed');
    }
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(_error any): void {
    this.emit('connectionError', error);
    this.handleConnectionLost();
  }

  /**
   * Handle quality changes
   */
  private handleQualityChange(qualityData: any): void {
    this.updateQualityMetrics(qualityData);
  }

  /**
   * Update quality metrics
   */
  private updateQualityMetrics(stats: any): void {
    this.currentState.quality = {
      fps: stats.frameRate || 0,
      latency: stats.roundTripTime || 0,
      bandwidth: stats.bandwidth || 0,
    };

    this.emit('qualityUpdate', this.currentState.quality);
  }

  /**
   * Convert blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]); // Remove data:... prefix
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.on_error= reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.disconnect();
    this.removeAllListeners();
    this.webRtcPlayer = null;
    this.signallingServer = null;
  }
}

export default PixelStreamingBridge;

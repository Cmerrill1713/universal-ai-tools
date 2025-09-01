import { createLogger, LogContext } from '../utils/logger.js';
import type { 
  VoiceProcessor, 
  VoiceProcessingConfig,
  AudioChunk,
  SpeechResult,
  SynthesisResult
} from '../../crates/voice-processing/index.js';

const log = createLogger('RustVoiceService');

interface RustVoiceServiceConfig {
  whisperModel: string;
  ttsModel: string;
  sampleRate: number;
  channels: number;
  chunkSize: number;
  enableVad: boolean;
  enableNoiseReduction: boolean;
  maxConcurrentSessions: number;
}

interface VoiceSession {
  id: string;
  userId: string;
  processor: VoiceProcessor;
  createdAt: number;
  lastActivity: number;
}

interface ProcessingMetrics {
  totalSessions: number;
  activeSessions: number;
  totalRecognitionRequests: number;
  totalSynthesisRequests: number;
  averageRecognitionTime: number;
  averageSynthesisTime: number;
  realTimeFactor: number;
}

export class RustVoiceService {
  private config: RustVoiceServiceConfig;
  private sessions: Map<string, VoiceSession> = new Map();
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private nativeModule: any = null;
  private metrics: ProcessingMetrics;
  private processingTimes: { recognition: number[], synthesis: number[] } = {
    recognition: [],
    synthesis: []
  };

  constructor(config: Partial<RustVoiceServiceConfig> = {}) {
    this.config = {
      whisperModel: 'base',
      ttsModel: 'nari-dia-1.6b',
      sampleRate: 16000,
      channels: 1,
      chunkSize: 1024,
      enableVad: true,
      enableNoiseReduction: true,
      maxConcurrentSessions: 10,
      ...config
    };

    this.metrics = {
      totalSessions: 0,
      activeSessions: 0,
      totalRecognitionRequests: 0,
      totalSynthesisRequests: 0,
      averageRecognitionTime: 0,
      averageSynthesisTime: 0,
      realTimeFactor: 0
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      log.info('🦀 Initializing Rust voice processing service...', LogContext.AI);

      // Import the native module
      try {
        this.nativeModule = await import('../../crates/voice-processing/index.js');
        log.info('✅ Rust native module loaded successfully', LogContext.AI);
      } catch (error) {
        log.error('❌ Failed to load Rust native module:', error, LogContext.AI);
        throw new Error(`Failed to load Rust voice processing module: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Validate the native module has required exports
      if (!this.nativeModule.VoiceProcessor) {
        throw new Error('VoiceProcessor class not found in native module');
      }

      // Test creating a processor to ensure everything works
      const testConfig: VoiceProcessingConfig = {
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        chunkSize: this.config.chunkSize,
        whisperModel: this.config.whisperModel,
        ttsModel: this.config.ttsModel,
        enableVad: this.config.enableVad,
        enableNoiseReduction: this.config.enableNoiseReduction
      };

      const testProcessor = new this.nativeModule.VoiceProcessor(testConfig);
      await testProcessor.initialize();
      
      log.info('✅ Test processor initialized successfully', LogContext.AI);
      log.info(`🔧 Configuration: ${JSON.stringify(testConfig, null, 2)}`, LogContext.AI);

      this.isInitialized = true;
      log.info('🦀 Rust voice processing service ready', LogContext.AI);

    } catch (error) {
      log.error('❌ Failed to initialize Rust voice service:', error, LogContext.AI);
      throw error;
    }
  }

  public async createSession(sessionId: string, userId: string = 'anonymous'): Promise<string> {
    await this.initialize();

    if (this.sessions.size >= this.config.maxConcurrentSessions) {
      // Clean up old sessions
      await this.cleanupExpiredSessions();
      
      if (this.sessions.size >= this.config.maxConcurrentSessions) {
        throw new Error('Maximum concurrent sessions reached');
      }
    }

    try {
      const processorConfig: VoiceProcessingConfig = {
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        chunkSize: this.config.chunkSize,
        whisperModel: this.config.whisperModel,
        ttsModel: this.config.ttsModel,
        enableVad: this.config.enableVad,
        enableNoiseReduction: this.config.enableNoiseReduction
      };

      const processor = new this.nativeModule.VoiceProcessor(processorConfig);
      await processor.initialize();

      // Create session in the processor
      await processor.createSession(sessionId, userId);

      const session: VoiceSession = {
        id: sessionId,
        userId,
        processor,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      this.sessions.set(sessionId, session);
      this.metrics.totalSessions++;
      this.metrics.activeSessions++;

      log.info(`🎤 Created voice session: ${sessionId} for user: ${userId}`, LogContext.AI);
      return sessionId;

    } catch (error) {
      log.error(`❌ Failed to create voice session ${sessionId}:`, error, LogContext.AI);
      throw error;
    }
  }

  public async processAudioChunk(
    sessionId: string, 
    audioData: Buffer, 
    timestamp?: number
  ): Promise<SpeechResult | null> {
    await this.initialize();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Voice session not found: ${sessionId}`);
    }

    const startTime = Date.now();

    try {
      const audioChunk: AudioChunk = {
        data: audioData,
        timestamp: (timestamp || Date.now()) / 1000.0,
        duration: audioData.length / (this.config.sampleRate * this.config.channels * 2), // Assuming 16-bit audio
        sampleRate: this.config.sampleRate,
        channels: this.config.channels
      };

      const result = await session.processor.processAudioChunk(sessionId, audioChunk);
      
      session.lastActivity = Date.now();
      
      if (result) {
        this.metrics.totalRecognitionRequests++;
        
        const processingTime = Date.now() - startTime;
        this.processingTimes.recognition.push(processingTime);
        
        // Keep only last 100 times for average calculation
        if (this.processingTimes.recognition.length > 100) {
          this.processingTimes.recognition.shift();
        }
        
        this.metrics.averageRecognitionTime = 
          this.processingTimes.recognition.reduce((a, b) => a + b, 0) / 
          this.processingTimes.recognition.length;

        // Calculate real-time factor
        const audioLength = audioChunk.duration * 1000; // ms
        this.metrics.realTimeFactor = audioLength / processingTime;

        log.debug(
          `🎙️ Recognized speech in ${processingTime}ms (${this.metrics.realTimeFactor.toFixed(2)}x real-time): "${result.text}"`, 
          LogContext.AI
        );
      }

      return result;

    } catch (error) {
      log.error(`❌ Audio processing failed for session ${sessionId}:`, error, LogContext.AI);
      throw error;
    }
  }

  public async synthesizeSpeech(
    sessionId: string, 
    text: string, 
    voice?: string
  ): Promise<SynthesisResult> {
    await this.initialize();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Voice session not found: ${sessionId}`);
    }

    const startTime = Date.now();

    try {
      const result = await session.processor.synthesizeSpeech(sessionId, text, voice);
      
      session.lastActivity = Date.now();
      this.metrics.totalSynthesisRequests++;
      
      const processingTime = Date.now() - startTime;
      this.processingTimes.synthesis.push(processingTime);
      
      // Keep only last 100 times for average calculation
      if (this.processingTimes.synthesis.length > 100) {
        this.processingTimes.synthesis.shift();
      }
      
      this.metrics.averageSynthesisTime = 
        this.processingTimes.synthesis.reduce((a, b) => a + b, 0) / 
        this.processingTimes.synthesis.length;

      log.debug(
        `🔊 Synthesized speech in ${processingTime}ms (${result.duration.toFixed(2)}s audio): "${text.substring(0, 50)}..."`, 
        LogContext.AI
      );

      return result;

    } catch (error) {
      log.error(`❌ Speech synthesis failed for session ${sessionId}:`, error, LogContext.AI);
      throw error;
    }
  }

  public async getSessionStats(sessionId: string): Promise<any | null> {
    await this.initialize();

    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    try {
      return await session.processor.getSessionStats(sessionId);
    } catch (error) {
      log.error(`❌ Failed to get session stats for ${sessionId}:`, error, LogContext.AI);
      return null;
    }
  }

  public async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      await session.processor.cleanupSession(sessionId);
      this.sessions.delete(sessionId);
      this.metrics.activeSessions--;
      
      log.info(`🧹 Cleaned up voice session: ${sessionId}`, LogContext.AI);
    } catch (error) {
      log.error(`❌ Failed to cleanup session ${sessionId}:`, error, LogContext.AI);
    }
  }

  public async cleanupExpiredSessions(maxAgeMs: number = 30 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > maxAgeMs) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.cleanupSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      log.info(`🧹 Cleaned up ${expiredSessions.length} expired voice sessions`, LogContext.AI);
    }
  }

  public getMetrics(): ProcessingMetrics {
    return { ...this.metrics, activeSessions: this.sessions.size };
  }

  public getPerformanceMetrics(): any {
    if (!this.isInitialized || this.sessions.size === 0) {
      return null;
    }

    // Get metrics from any session processor (they should be similar)
    const firstSession = Array.from(this.sessions.values())[0];
    try {
      return firstSession.processor.getPerformanceMetrics();
    } catch (error) {
      log.error('❌ Failed to get performance metrics:', error, LogContext.AI);
      return null;
    }
  }

  public isSessionActive(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  public getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  public getUserSessions(userId: string): string[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .map(session => session.id);
  }

  // File processing utilities
  public async processAudioFile(filePath: string): Promise<SpeechResult> {
    await this.initialize();

    try {
      const config: VoiceProcessingConfig = {
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        chunkSize: this.config.chunkSize,
        whisperModel: this.config.whisperModel,
        ttsModel: this.config.ttsModel,
        enableVad: this.config.enableVad,
        enableNoiseReduction: this.config.enableNoiseReduction
      };

      const result = await this.nativeModule.processAudioFile(filePath, config);
      
      log.info(`📄 Processed audio file: ${filePath} -> "${result.text}"`, LogContext.AI);
      return result;

    } catch (error) {
      log.error(`❌ Failed to process audio file ${filePath}:`, error, LogContext.AI);
      throw error;
    }
  }

  public async synthesizeToFile(
    text: string, 
    outputPath: string, 
    voice?: string
  ): Promise<void> {
    await this.initialize();

    try {
      await this.nativeModule.synthesizeToFile(text, outputPath, voice, this.config.ttsModel);
      
      log.info(`💾 Synthesized to file: ${outputPath} <- "${text.substring(0, 50)}..."`, LogContext.AI);

    } catch (error) {
      log.error(`❌ Failed to synthesize to file ${outputPath}:`, error, LogContext.AI);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    log.info('🛑 Shutting down Rust voice service...', LogContext.AI);

    // Cleanup all active sessions
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.cleanupSession(sessionId);
    }

    this.isInitialized = false;
    this.initializationPromise = null;

    log.info('✅ Rust voice service shutdown complete', LogContext.AI);
  }

  // Health check
  public async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy', details: any }> {
    try {
      await this.initialize();

      const details = {
        initialized: this.isInitialized,
        activeSessions: this.sessions.size,
        maxSessions: this.config.maxConcurrentSessions,
        metrics: this.getMetrics(),
        performanceMetrics: this.getPerformanceMetrics(),
        config: this.config
      };

      const sessionUtilization = this.sessions.size / this.config.maxConcurrentSessions;
      const status = sessionUtilization > 0.9 ? 'degraded' : 'healthy';

      return { status, details };

    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          initialized: this.isInitialized,
          activeSessions: this.sessions.size
        }
      };
    }
  }
}
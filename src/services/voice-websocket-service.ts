/**
 * Voice WebSocket Service - Real-time Voice Streaming
 * Handles live audio communication with speech recognition and TTS synthesis
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { LogContext, log } from '@/utils/logger';
import { WhisperSpeechService } from './whisper-speech-service';
import { NariDiaTTSService } from './nari-dia-tts-service';
import AgentRegistry from '@/agents/agent-registry';
// import { intentClassifier } from './intent-classifier';

// Mock intent classifier for now
const mockIntentClassifier = {
  async classifyIntent(text: string): Promise<{
    intent: string;
    confidence: number;
    suggestedAgent: string;
  }> {
    // Simple intent classification based on keywords
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('weather') || lowerText.includes('temperature')) {
      return { intent: 'weather', confidence: 0.8, suggestedAgent: 'enhanced-personal-assistant-agent' };
    } else if (lowerText.includes('time') || lowerText.includes('date')) {
      return { intent: 'time', confidence: 0.9, suggestedAgent: 'enhanced-personal-assistant-agent' };
    } else if (lowerText.includes('code') || lowerText.includes('program')) {
      return { intent: 'coding', confidence: 0.8, suggestedAgent: 'enhanced-code-assistant-agent' };
    } else if (lowerText.includes('plan') || lowerText.includes('schedule')) {
      return { intent: 'planning', confidence: 0.8, suggestedAgent: 'enhanced-planner-agent' };
    } else {
      return { intent: 'general', confidence: 0.6, suggestedAgent: 'enhanced-personal-assistant-agent' };
    }
  }
};
import { voiceSessionPersistence, VoiceSession, VoiceInteraction } from './voice-session-persistence';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface ActiveVoiceSession {
  sessionId: string;
  userId: string;
  websocket: WebSocket;
  isRecording: boolean;
  audioChunks: Buffer[];
  lastActivity: Date;
  preferences: {
    language: string;
    voice: string;
    wakewordEnabled: boolean;
  };
  // Persistence tracking
  databaseSessionId?: string;
  interactionSequence: number;
  sessionStartTime: Date;
  totalInteractions: number;
  totalSpeechTime: number;
  totalProcessingTime: number;
}

interface VoiceMessage {
  type: 'start_recording' | 'audio_chunk' | 'stop_recording' | 'text_input' | 'settings' | 'ping';
  sessionId?: string;
  data?: any;
  settings?: any;
  text?: string;
}

export class VoiceWebSocketService {
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, ActiveVoiceSession> = new Map();
  private speechService: WhisperSpeechService;
  private ttsService: NariDiaTTSService;
  private agentRegistry: AgentRegistry | null = null;
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor() {
    this.speechService = new WhisperSpeechService();
    this.ttsService = new NariDiaTTSService();
    
    // Initialize cleanup interval for inactive sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Clean up every minute
  }

  public initialize(server: Server, agentRegistry?: AgentRegistry): void {
    this.agentRegistry = agentRegistry || null;

    this.wss = new WebSocketServer({
      server,
      path: '/ws/voice',
      perMessageDeflate: false, // Disable compression for real-time audio
    });

    this.wss.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws, request);
    });

    log.info('✅ Voice WebSocket service initialized', LogContext.WEBSOCKET, {
      path: '/ws/voice',
      speechService: 'Whisper',
      ttsService: 'Nari Dia',
    });
  }

  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const sessionId = uuidv4();
    const userId = request.headers['user-id'] || 'anonymous';
    const sessionStartTime = new Date();
    
    const session: ActiveVoiceSession = {
      sessionId,
      userId,
      websocket: ws,
      isRecording: false,
      audioChunks: [],
      lastActivity: sessionStartTime,
      preferences: {
        language: 'en',
        voice: 'nari_natural',
        wakewordEnabled: true,
      },
      // Persistence tracking
      interactionSequence: 0,
      sessionStartTime,
      totalInteractions: 0,
      totalSpeechTime: 0,
      totalProcessingTime: 0,
    };

    // Create session in database
    if (voiceSessionPersistence.isAvailable()) {
      try {
        const databaseSessionId = await voiceSessionPersistence.createSession({
          session_id: sessionId,
          user_id: userId,
          started_at: sessionStartTime.toISOString(),
          preferences: {
            language: session.preferences.language,
            voice: session.preferences.voice,
            wakeword_enabled: session.preferences.wakewordEnabled,
            auto_speak_responses: true,
          },
          client_info: {
            user_agent: request.headers['user-agent'],
            ip_address: request.socket.remoteAddress,
            device_type: this.detectDeviceType(request.headers['user-agent']),
          },
        });
        
        session.databaseSessionId = databaseSessionId || undefined;
        
        log.info('📊 Voice session persisted to database', LogContext.DATABASE, {
          sessionId,
          databaseSessionId,
          userId,
        });
      } catch (error) {
        log.warn('⚠️ Failed to persist voice session to database', LogContext.DATABASE, {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.sessions.set(sessionId, session);

    log.info('🎙️ Voice WebSocket client connected', LogContext.WEBSOCKET, {
      sessionId,
      userId,
      totalSessions: this.sessions.size,
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'connected',
      sessionId,
      data: {
        message: 'Voice WebSocket connected',
        capabilities: [
          'real-time-speech-recognition',
          'text-to-speech',
          'agent-integration',
          'wake-word-detection',
        ],
        preferences: session.preferences,
      },
    });

    ws.on('message', (data: Buffer) => {
      this.handleMessage(sessionId, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(sessionId);
    });

    ws.on('error', (error) => {
      log.error('Voice WebSocket error', LogContext.WEBSOCKET, {
        sessionId,
        error: error.message,
      });
    });

    // Send periodic heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, {
          type: 'heartbeat',
          data: { timestamp: new Date().toISOString() },
        });
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);
  }

  private async handleMessage(sessionId: string, data: Buffer): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date();

    try {
      // Try to parse as JSON first (for control messages)
      let message: VoiceMessage;
      try {
        const jsonData = data.toString('utf8');
        message = JSON.parse(jsonData);
      } catch {
        // If not JSON, treat as raw audio data
        if (session.isRecording) {
          session.audioChunks.push(data);
          
          // Send acknowledgment for audio chunk
          this.sendMessage(session.websocket, {
            type: 'audio_received',
            data: { 
              chunkSize: data.length,
              totalChunks: session.audioChunks.length,
            },
          });
        }
        return;
      }

      // Handle control messages
      switch (message.type) {
        case 'start_recording':
          await this.startRecording(session);
          break;

        case 'stop_recording':
          await this.stopRecording(session);
          break;

        case 'text_input':
          if (message.text) {
            await this.processTextInput(session, message.text);
          }
          break;

        case 'settings':
          if (message.settings) {
            this.updateSessionSettings(session, message.settings);
          }
          break;

        case 'ping':
          this.sendMessage(session.websocket, {
            type: 'pong',
            data: { timestamp: new Date().toISOString() },
          });
          break;

        default:
          log.warn('Unknown voice message type', LogContext.WEBSOCKET, {
            sessionId,
            messageType: message.type,
          });
      }
    } catch (error) {
      log.error('Error handling voice message', LogContext.WEBSOCKET, {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      this.sendMessage(session.websocket, {
        type: 'error',
        data: {
          message: 'Failed to process voice message',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private async startRecording(session: ActiveVoiceSession): Promise<void> {
    session.isRecording = true;
    session.audioChunks = [];

    log.info('🔴 Started voice recording', LogContext.WEBSOCKET, {
      sessionId: session.sessionId,
      userId: session.userId,
    });

    this.sendMessage(session.websocket, {
      type: 'recording_started',
      data: {
        message: 'Voice recording started',
        timestamp: new Date().toISOString(),
      },
    });
  }

  private async stopRecording(session: ActiveVoiceSession): Promise<void> {
    if (!session.isRecording || session.audioChunks.length === 0) {
      return;
    }

    session.isRecording = false;

    log.info('🔵 Stopped voice recording', LogContext.WEBSOCKET, {
      sessionId: session.sessionId,
      audioChunks: session.audioChunks.length,
      totalSize: session.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0),
    });

    this.sendMessage(session.websocket, {
      type: 'recording_stopped',
      data: {
        message: 'Voice recording stopped, processing...',
        chunksReceived: session.audioChunks.length,
      },
    });

    try {
      // Combine audio chunks
      const audioBuffer = Buffer.concat(session.audioChunks);
      session.audioChunks = []; // Clear chunks

      // Process speech recognition
      const startTime = Date.now();
      
      this.sendMessage(session.websocket, {
        type: 'processing_speech',
        data: { message: 'Converting speech to text...' },
      });

      const speechResult = await this.speechService.recognizeSpeech({
        audioData: audioBuffer,
        format: 'webm', // Common WebRTC format
        language: session.preferences.language,
      });

      const speechTime = Date.now() - startTime;

      if (speechResult && speechResult.text) {
        log.info('✅ Speech recognition completed', LogContext.WEBSOCKET, {
          sessionId: session.sessionId,
          transcript: speechResult.text.substring(0, 100),
          confidence: speechResult.confidence || 0,
          processingTime: speechTime,
        });

        this.sendMessage(session.websocket, {
          type: 'speech_recognized',
          data: {
            transcript: speechResult.text,
            confidence: speechResult.confidence || 0,
            processingTime: speechTime,
          },
        });

        // Process the recognized text with voice context
        await this.processVoiceInput(session, speechResult.text, {
          confidence: speechResult.confidence || 0,
          speechRecognitionTime: speechTime,
          audioSize: audioBuffer.length,
        });
      } else {
        log.warn('Speech recognition failed', LogContext.WEBSOCKET, {
          sessionId: session.sessionId,
          error: 'No transcript returned',
        });

        this.sendMessage(session.websocket, {
          type: 'speech_error',
          data: {
            message: 'Failed to recognize speech',
            error: 'No transcript returned',
          },
        });
      }
    } catch (error) {
      log.error('Error processing voice recording', LogContext.WEBSOCKET, {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      this.sendMessage(session.websocket, {
        type: 'processing_error',
        data: {
          message: 'Failed to process voice recording',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private detectDeviceType(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  private async processVoiceInput(session: ActiveVoiceSession, text: string, voiceData: {
    confidence: number;
    speechRecognitionTime: number;
    audioSize: number;
  }): Promise<void> {
    try {
      log.info('🎙️ Processing voice input', LogContext.WEBSOCKET, {
        sessionId: session.sessionId,
        text: text.substring(0, 100),
        confidence: voiceData.confidence,
        speechRecognitionTime: voiceData.speechRecognitionTime,
      });

      this.sendMessage(session.websocket, {
        type: 'processing_text',
        data: { message: 'Processing your request...', text },
      });

      // Classify intent and route to appropriate agent
      const startTime = Date.now();
      const intent = await mockIntentClassifier.classifyIntent(text);

      log.info('🎯 Intent classified', LogContext.WEBSOCKET, {
        sessionId: session.sessionId,
        intent: intent.intent,
        confidence: intent.confidence,
        agent: intent.suggestedAgent,
      });

      // Process with agent if available
      let response = 'I understand your request, but the agent system is currently unavailable.';
      
      if (this.agentRegistry && intent.suggestedAgent) {
        try {
          const agentContext = {
            userRequest: text,
            requestId: `voice_${session.sessionId}_${Date.now()}`,
            workingDirectory: process.cwd(),
            userId: session.userId,
            voiceSession: true,
            intent: intent.intent,
            confidence: intent.confidence,
            voiceData: {
              transcriptConfidence: voiceData.confidence,
              speechRecognitionTime: voiceData.speechRecognitionTime,
              audioSize: voiceData.audioSize,
            },
          };

          const agentResult = await this.agentRegistry.processRequest(
            intent.suggestedAgent,
            agentContext
          ) as any;

          response = agentResult?.response || agentResult?.result || 
            'I processed your request successfully.';
        } catch (agentError) {
          log.error('Agent processing failed', LogContext.WEBSOCKET, {
            sessionId: session.sessionId,
            agent: intent.suggestedAgent,
            error: agentError instanceof Error ? agentError.message : String(agentError),
          });

          response = 'I encountered an issue processing your request, but I understand what you asked.';
        }
      }

      const processingTime = Date.now() - startTime;

      this.sendMessage(session.websocket, {
        type: 'text_processed',
        data: {
          response,
          intent: intent.intent,
          confidence: intent.confidence,
          processingTime,
          agent: intent.suggestedAgent,
        },
      });

      // Update session statistics
      session.interactionSequence += 1;
      session.totalInteractions += 1;
      session.totalProcessingTime += processingTime;
      session.totalSpeechTime += voiceData.speechRecognitionTime;
      session.lastActivity = new Date();

      // Save voice interaction to database
      if (voiceSessionPersistence.isAvailable()) {
        try {
          const interaction: VoiceInteraction = {
            session_id: session.sessionId,
            interaction_sequence: session.interactionSequence,
            transcript: text,
            transcript_confidence: voiceData.confidence,
            user_intent: intent.intent,
            intent_confidence: intent.confidence,
            agent_used: intent.suggestedAgent || 'unknown',
            agent_response: response,
            speech_recognition_time_ms: voiceData.speechRecognitionTime,
            agent_processing_time_ms: processingTime - voiceData.speechRecognitionTime,
            tts_generation_time_ms: 0, // Will be updated if TTS is generated
            total_response_time_ms: processingTime,
            audio_duration_ms: Math.round(voiceData.audioSize / 16000), // Rough estimate based on 16kHz
            interaction_type: 'voice',
            error_occurred: false,
          };

          await voiceSessionPersistence.saveInteraction(interaction);
          
          log.debug('📊 Voice interaction saved to database', LogContext.DATABASE, {
            sessionId: session.sessionId,
            sequence: session.interactionSequence,
            intent: intent.intent,
            confidence: voiceData.confidence,
          });
        } catch (error) {
          log.warn('⚠️ Failed to save voice interaction to database', LogContext.DATABASE, {
            sessionId: session.sessionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Generate speech response if enabled
      if (session.preferences.voice && response) {
        await this.generateSpeechResponse(session, response);
      }

    } catch (error) {
      log.error('Error processing voice input', LogContext.WEBSOCKET, {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      this.sendMessage(session.websocket, {
        type: 'text_error',
        data: {
          message: 'Failed to process voice input',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private async processTextInput(session: ActiveVoiceSession, text: string): Promise<void> {
    try {
      log.info('💭 Processing text input', LogContext.WEBSOCKET, {
        sessionId: session.sessionId,
        text: text.substring(0, 100),
      });

      this.sendMessage(session.websocket, {
        type: 'processing_text',
        data: { message: 'Processing your request...', text },
      });

      // Classify intent and route to appropriate agent
      const startTime = Date.now();
      const intent = await mockIntentClassifier.classifyIntent(text);

      log.info('🎯 Intent classified', LogContext.WEBSOCKET, {
        sessionId: session.sessionId,
        intent: intent.intent,
        confidence: intent.confidence,
        agent: intent.suggestedAgent,
      });

      // Process with agent if available
      let response = 'I understand your request, but the agent system is currently unavailable.';
      
      if (this.agentRegistry && intent.suggestedAgent) {
        try {
          const agentContext = {
            userRequest: text,
            requestId: `voice_${session.sessionId}_${Date.now()}`,
            workingDirectory: process.cwd(),
            userId: session.userId,
            voiceSession: true,
            intent: intent.intent,
            confidence: intent.confidence,
          };

          const agentResult = await this.agentRegistry.processRequest(
            intent.suggestedAgent,
            agentContext
          ) as any;

          response = agentResult?.response || agentResult?.result || 
            'I processed your request successfully.';
        } catch (agentError) {
          log.error('Agent processing failed', LogContext.WEBSOCKET, {
            sessionId: session.sessionId,
            agent: intent.suggestedAgent,
            error: agentError instanceof Error ? agentError.message : String(agentError),
          });

          response = 'I encountered an issue processing your request, but I understand what you asked.';
        }
      }

      const processingTime = Date.now() - startTime;

      this.sendMessage(session.websocket, {
        type: 'text_processed',
        data: {
          response,
          intent: intent.intent,
          confidence: intent.confidence,
          processingTime,
          agent: intent.suggestedAgent,
        },
      });

      // Update session statistics
      session.interactionSequence += 1;
      session.totalInteractions += 1;
      session.totalProcessingTime += processingTime;
      session.lastActivity = new Date();

      // Save interaction to database
      if (voiceSessionPersistence.isAvailable()) {
        try {
          const interaction: VoiceInteraction = {
            session_id: session.sessionId,
            interaction_sequence: session.interactionSequence,
            transcript: text,
            transcript_confidence: 1.0, // Perfect for text input
            user_intent: intent.intent,
            intent_confidence: intent.confidence,
            agent_used: intent.suggestedAgent || 'unknown',
            agent_response: response,
            speech_recognition_time_ms: 0, // No speech recognition for text input
            agent_processing_time_ms: processingTime,
            tts_generation_time_ms: 0, // Will be updated if TTS is generated
            total_response_time_ms: processingTime,
            interaction_type: 'text',
            error_occurred: false,
          };

          await voiceSessionPersistence.saveInteraction(interaction);
          
          log.debug('📊 Interaction saved to database', LogContext.DATABASE, {
            sessionId: session.sessionId,
            sequence: session.interactionSequence,
            intent: intent.intent,
          });
        } catch (error) {
          log.warn('⚠️ Failed to save interaction to database', LogContext.DATABASE, {
            sessionId: session.sessionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Generate speech response if enabled
      if (session.preferences.voice && response) {
        await this.generateSpeechResponse(session, response);
      }

    } catch (error) {
      log.error('Error processing text input', LogContext.WEBSOCKET, {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      this.sendMessage(session.websocket, {
        type: 'text_error',
        data: {
          message: 'Failed to process text input',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private async generateSpeechResponse(session: ActiveVoiceSession, text: string): Promise<void> {
    try {
      log.info('🔊 Generating speech response', LogContext.WEBSOCKET, {
        sessionId: session.sessionId,
        textLength: text.length,
        voice: session.preferences.voice,
      });

      this.sendMessage(session.websocket, {
        type: 'generating_speech',
        data: { message: 'Generating voice response...' },
      });

      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const outputPath = path.join(tempDir, `voice_${session.sessionId}_${Date.now()}.wav`);
      const startTime = Date.now();

      const ttsResult = await this.ttsService.generateSpeech(text, outputPath);

      const generationTime = Date.now() - startTime;

      if (ttsResult && ttsResult.audioPath && fs.existsSync(ttsResult.audioPath)) {
        // Read the audio file and send it to the client
        const audioBuffer = fs.readFileSync(ttsResult.audioPath);
        
        log.info('✅ Speech generation completed', LogContext.WEBSOCKET, {
          sessionId: session.sessionId,
          audioSize: audioBuffer.length,
          generationTime: ttsResult.executionTime,
          voice: ttsResult.voice,
        });

        this.sendMessage(session.websocket, {
          type: 'speech_generated',
          data: {
            message: 'Voice response ready',
            audioSize: audioBuffer.length,
            generationTime: ttsResult.executionTime,
            voice: ttsResult.voice,
          },
        });

        // Send audio data in chunks for real-time playback
        const chunkSize = 8192; // 8KB chunks
        let offset = 0;

        while (offset < audioBuffer.length) {
          const chunk = audioBuffer.subarray(offset, offset + chunkSize);
          
          this.sendMessage(session.websocket, {
            type: 'audio_chunk',
            data: {
              chunk: chunk.toString('base64'),
              isLast: offset + chunkSize >= audioBuffer.length,
              totalSize: audioBuffer.length,
              offset,
            },
          });

          offset += chunkSize;
          
          // Small delay between chunks to prevent overwhelming the client
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Clean up temporary file
        fs.unlinkSync(ttsResult.audioPath);

        this.sendMessage(session.websocket, {
          type: 'speech_complete',
          data: {
            message: 'Voice response sent successfully',
            totalChunks: Math.ceil(audioBuffer.length / chunkSize),
          },
        });

      } else {
        const errorMsg = ttsResult ? 'Audio file not found' : 'TTS generation failed';
        log.warn('Speech generation failed', LogContext.WEBSOCKET, {
          sessionId: session.sessionId,
          error: errorMsg,
        });

        this.sendMessage(session.websocket, {
          type: 'speech_error',
          data: {
            message: 'Failed to generate voice response',
            error: errorMsg,
          },
        });
      }

    } catch (error) {
      log.error('Error generating speech response', LogContext.WEBSOCKET, {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      this.sendMessage(session.websocket, {
        type: 'speech_error',
        data: {
          message: 'Failed to generate speech response',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private updateSessionSettings(session: ActiveVoiceSession, settings: any): void {
    if (settings.language) {
      session.preferences.language = settings.language;
    }
    if (settings.voice) {
      session.preferences.voice = settings.voice;
    }
    if (typeof settings.wakewordEnabled === 'boolean') {
      session.preferences.wakewordEnabled = settings.wakewordEnabled;
    }

    log.info('⚙️ Updated session settings', LogContext.WEBSOCKET, {
      sessionId: session.sessionId,
      preferences: session.preferences,
    });

    this.sendMessage(session.websocket, {
      type: 'settings_updated',
      data: {
        message: 'Settings updated successfully',
        preferences: session.preferences,
      },
    });
  }

  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        log.error('Error sending WebSocket message', LogContext.WEBSOCKET, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async handleDisconnection(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      // End session in database
      if (voiceSessionPersistence.isAvailable()) {
        try {
          await voiceSessionPersistence.endSession(sessionId, {
            totalInteractions: session.totalInteractions,
            totalSpeechTime: session.totalSpeechTime,
            totalProcessingTime: session.totalProcessingTime,
          });

          // Update session with final statistics
          await voiceSessionPersistence.updateSession(sessionId, {
            total_interactions: session.totalInteractions,
            total_speech_time_ms: session.totalSpeechTime,
            total_processing_time_ms: session.totalProcessingTime,
            status: 'completed',
          });

          log.info('📊 Voice session ended and persisted', LogContext.DATABASE, {
            sessionId,
            totalInteractions: session.totalInteractions,
            duration: Date.now() - session.sessionStartTime.getTime(),
          });
        } catch (error) {
          log.warn('⚠️ Failed to end session in database', LogContext.DATABASE, {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      log.info('👋 Voice WebSocket client disconnected', LogContext.WEBSOCKET, {
        sessionId,
        userId: session.userId,
        totalInteractions: session.totalInteractions,
        sessionDuration: Date.now() - session.sessionStartTime.getTime(),
        remainingSessions: this.sessions.size - 1,
      });

      this.sessions.delete(sessionId);
    }
  }

  private cleanupInactiveSessions(): void {
    const now = new Date();
    const inactiveTimeout = 30 * 60 * 1000; // 30 minutes

    let cleanedUp = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      
      if (inactiveTime > inactiveTimeout) {
        if (session.websocket.readyState === WebSocket.OPEN) {
          session.websocket.close(1000, 'Session inactive');
        }
        this.sessions.delete(sessionId);
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      log.info('🧹 Cleaned up inactive voice sessions', LogContext.WEBSOCKET, {
        cleanedUp,
        remaining: this.sessions.size,
      });
    }
  }

  public getActiveSessions(): number {
    return this.sessions.size;
  }

  public getSessionInfo(sessionId: string): ActiveVoiceSession | undefined {
    return this.sessions.get(sessionId);
  }

  public async getSessionHistory(sessionId: string): Promise<VoiceInteraction[]> {
    if (!voiceSessionPersistence.isAvailable()) {
      return [];
    }

    try {
      return await voiceSessionPersistence.getSessionHistory(sessionId);
    } catch (error) {
      log.error('Failed to get session history', LogContext.DATABASE, {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  public async getUserSessions(userId: string, limit: number = 20): Promise<VoiceSession[]> {
    if (!voiceSessionPersistence.isAvailable()) {
      return [];
    }

    try {
      return await voiceSessionPersistence.getUserSessions(userId, limit);
    } catch (error) {
      log.error('Failed to get user sessions', LogContext.DATABASE, {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  public async getVoiceAnalytics(userId?: string): Promise<any> {
    if (!voiceSessionPersistence.isAvailable()) {
      return {
        total_sessions: this.sessions.size,
        total_interactions: 0,
        active_sessions: this.sessions.size,
        persistence_available: false,
      };
    }

    try {
      const analytics = await voiceSessionPersistence.getAnalytics(userId);
      return {
        ...analytics,
        active_sessions: this.sessions.size,
        persistence_available: true,
      };
    } catch (error) {
      log.error('Failed to get voice analytics', LogContext.DATABASE, {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        total_sessions: this.sessions.size,
        active_sessions: this.sessions.size,
        persistence_available: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public shutdown(): void {
    log.info('🔄 Shutting down Voice WebSocket service', LogContext.WEBSOCKET);

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval as any);
    }

    // Close all active sessions
    for (const session of this.sessions.values()) {
      if (session.websocket.readyState === WebSocket.OPEN) {
        session.websocket.close(1000, 'Service shutting down');
      }
    }

    this.sessions.clear();

    if (this.wss) {
      this.wss.close();
    }

    log.info('✅ Voice WebSocket service shutdown completed', LogContext.WEBSOCKET);
  }
}

// Export singleton instance
export const voiceWebSocketService = new VoiceWebSocketService();
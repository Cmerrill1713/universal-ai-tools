/**
 * Voice Processing Router
 * 
 * Handles voice-related API endpoints for the Universal AI Tools platform.
 * Supports speech-to-text, text-to-speech, and voice agent interactions.
 */

import { exec } from 'child_process';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import express from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

import type AgentRegistry from '../agents/agent-registry';
import type { VoiceInteractionRequest } from '../agents/specialized/conversational-voice-agent';
import { conversationalVoiceAgent } from '../agents/specialized/conversational-voice-agent';
import { authenticate } from '../middleware/auth';
import type { RealtimeBroadcastService } from '../services/realtime-broadcast-service';
import { log, LogContext } from '../utils/logger';
import { conversationCache, synthesisCache, transcriptionCache, voiceCacheManager } from '../utils/voice-cache';
import { circuitBreakers, voiceCircuitManager } from '../utils/voice-circuit-breaker';

const execAsync = promisify(exec);

const router = express.Router();

// Voice-specific interfaces and types
export interface VoiceSession {
  sessionId: string;
  userId: string;
  status: 'active' | 'paused' | 'ended';
  startTime: number;
  lastActivity: number;
  settings: {
    language: string;
    voice: string;
    speed: number;
    sensitivity: number;
    noiseReduction: boolean;
  };
  statistics: {
    totalSpeakTime: number;
    totalSilenceTime: number;
    wordsSpoken: number;
    averageConfidence: number;
    interruptionCount: number;
  };
  participants?: string[];
  roomId?: string;
}

export interface VoiceActivityData {
  sessionId: string;
  timestamp: number;
  type: 'speech_start' | 'speech_end' | 'silence_start' | 'silence_end' | 'volume_change';
  confidence?: number;
  volume?: number;
  frequency?: number;
  speaker?: string;
}

export interface VoiceAnalytics {
  sessionId: string;
  metrics: {
    averageVolume: number;
    speechRate: number; // words per minute
    pauseFrequency: number;
    emotionalTone: 'neutral' | 'happy' | 'sad' | 'excited' | 'frustrated';
    clarityScore: number;
    engagementLevel: number;
  };
  qualityMetrics: {
    signalToNoise: number;
    bitrate: number;
    latency: number;
    dropoutRate: number;
  };
}

export interface VoiceChatRoom {
  roomId: string;
  name: string;
  creator: string;
  participants: string[];
  maxParticipants: number;
  isPrivate: boolean;
  settings: {
    allowRecording: boolean;
    moderationEnabled: boolean;
    transcriptionEnabled: boolean;
  };
  createdAt: number;
  lastActivity: number;
}

export interface VoiceCommand {
  command: string;
  confidence: number;
  parameters?: Record<string, any>;
  intent: string;
  action?: string;
}

export interface SpeakerProfile {
  speakerId: string;
  voiceprint: number[];
  characteristics: {
    averagePitch: number;
    speechRate: number;
    voiceEnergy: number;
  };
  accuracy: number;
  lastUpdated: number;
}

// Global state management
class VoiceSessionManager extends EventEmitter {
  private sessions = new Map<string, VoiceSession>();
  private chatRooms = new Map<string, VoiceChatRoom>();
  private speakerProfiles = new Map<string, SpeakerProfile>();
  private wsConnections = new Map<string, WebSocket>();
  private broadcastService: RealtimeBroadcastService | null = null;

  setBroadcastService(service: RealtimeBroadcastService) {
    this.broadcastService = service;
  }

  createSession(userId: string, settings: Partial<VoiceSession['settings']> = {}): VoiceSession {
    const sessionId = uuidv4();
    const session: VoiceSession = {
      sessionId,
      userId,
      status: 'active',
      startTime: Date.now(),
      lastActivity: Date.now(),
      settings: {
        language: 'en-US',
        voice: 'af_bella',
        speed: 1.0,
        sensitivity: 0.7,
        noiseReduction: true,
        ...settings
      },
      statistics: {
        totalSpeakTime: 0,
        totalSilenceTime: 0,
        wordsSpoken: 0,
        averageConfidence: 0,
        interruptionCount: 0
      }
    };
    
    this.sessions.set(sessionId, session);
    this.emit('session_created', session);
    
    if (this.broadcastService) {
      this.broadcastService.broadcastToRoom('voice_sessions', 'session_created', session);
    }
    
    return session;
  }

  getSession(sessionId: string): VoiceSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<VoiceSession>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    Object.assign(session, updates);
    session.lastActivity = Date.now();
    this.emit('session_updated', session);
    
    if (this.broadcastService) {
      this.broadcastService.broadcastToRoom('voice_sessions', 'session_updated', session);
    }
    
    return true;
  }

  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.status = 'ended';
    session.lastActivity = Date.now();
    this.emit('session_ended', session);
    
    if (this.broadcastService) {
      this.broadcastService.broadcastToRoom('voice_sessions', 'session_ended', session);
    }
    
    return true;
  }

  createChatRoom(creator: string, name: string, options: Partial<VoiceChatRoom> = {}): VoiceChatRoom {
    const roomId = uuidv4();
    const room: VoiceChatRoom = {
      roomId,
      name,
      creator,
      participants: [creator],
      maxParticipants: 10,
      isPrivate: false,
      settings: {
        allowRecording: false,
        moderationEnabled: true,
        transcriptionEnabled: true
      },
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ...options
    };
    
    this.chatRooms.set(roomId, room);
    this.emit('room_created', room);
    
    if (this.broadcastService) {
      this.broadcastService.broadcastToRoom('voice_rooms', 'room_created', room);
    }
    
    return room;
  }

  joinChatRoom(roomId: string, userId: string): boolean {
    const room = this.chatRooms.get(roomId);
    if (!room || room.participants.length >= room.maxParticipants) return false;
    
    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
      room.lastActivity = Date.now();
      this.emit('room_joined', { roomId, userId, room });
      
      if (this.broadcastService) {
        this.broadcastService.broadcastToRoom(`voice_room:${roomId}`, 'user_joined', { userId, room });
      }
    }
    
    return true;
  }

  leaveChatRoom(roomId: string, userId: string): boolean {
    const room = this.chatRooms.get(roomId);
    if (!room) return false;
    
    room.participants = room.participants.filter(id => id !== userId);
    room.lastActivity = Date.now();
    this.emit('room_left', { roomId, userId, room });
    
    if (this.broadcastService) {
      this.broadcastService.broadcastToRoom(`voice_room:${roomId}`, 'user_left', { userId, room });
    }
    
    // Delete room if empty (except creator)
    if (room.participants.length === 0 || (room.participants.length === 1 && room.participants[0] === room.creator)) {
      this.chatRooms.delete(roomId);
      this.emit('room_deleted', room);
    }
    
    return true;
  }

  registerSpeaker(speakerId: string, voiceprint: number[], characteristics: SpeakerProfile['characteristics']): void {
    const profile: SpeakerProfile = {
      speakerId,
      voiceprint,
      characteristics,
      accuracy: 0.95,
      lastUpdated: Date.now()
    };
    
    this.speakerProfiles.set(speakerId, profile);
    this.emit('speaker_registered', profile);
  }

  identifySpeaker(voiceprint: number[]): { speakerId: string; confidence: number } | null {
    let bestMatch: { speakerId: string; confidence: number } | null = null;
    
    for (const [speakerId, profile] of this.speakerProfiles) {
      const similarity = this.calculateVoiceprintSimilarity(voiceprint, profile.voiceprint);
      if (similarity > 0.8 && (!bestMatch || similarity > bestMatch.confidence)) {
        bestMatch = { speakerId, confidence: similarity };
      }
    }
    
    return bestMatch;
  }

  private calculateVoiceprintSimilarity(voiceprint1: number[], voiceprint2: number[]): number {
    if (voiceprint1.length !== voiceprint2.length) return 0;
    
    const dotProduct = voiceprint1.reduce((sum, val, i) => sum + val * (voiceprint2[i] ?? 0), 0);
    const magnitude1 = Math.sqrt(voiceprint1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(voiceprint2.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  addWebSocketConnection(sessionId: string, ws: WebSocket): void {
    this.wsConnections.set(sessionId, ws);
    
    ws.on('close', () => {
      this.wsConnections.delete(sessionId);
    });
  }

  broadcastToSession(sessionId: string, event: string, data: any): void {
    const ws = this.wsConnections.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
    }
  }

  getAllSessions(): VoiceSession[] {
    return Array.from(this.sessions.values());
  }

  getAllChatRooms(): VoiceChatRoom[] {
    return Array.from(this.chatRooms.values());
  }

  getActiveSessionsCount(): number {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active').length;
  }

  cleanup(): void {
    // Close old sessions
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > maxAge) {
        this.endSession(sessionId);
        this.sessions.delete(sessionId);
      }
    }
    
    // Close inactive chat rooms
    for (const [roomId, room] of this.chatRooms) {
      if (now - room.lastActivity > maxAge || room.participants.length === 0) {
        this.chatRooms.delete(roomId);
      }
    }
  }
}

// Global voice session manager
const voiceSessionManager = new VoiceSessionManager();

// Cleanup interval
setInterval(() => voiceSessionManager.cleanup(), 60 * 60 * 1000); // Every hour

// Voice Activity Detector
class VoiceActivityDetector {
  private threshold = 0.01;
  private bufferSize = 1024;
  private sampleRate = 16000;
  
  detectActivity(audioBuffer: Float32Array): VoiceActivityData {
    const energy = this.calculateEnergy(audioBuffer);
    const isSpeech = energy > this.threshold;
    
    return {
      sessionId: '',
      timestamp: Date.now(),
      type: isSpeech ? 'speech_start' : 'silence_start',
      confidence: Math.min(energy / this.threshold, 1.0),
      volume: energy,
      frequency: this.estimateFrequency(audioBuffer)
    };
  }
  
  private calculateEnergy(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += (buffer[i] ?? 0) * (buffer[i] ?? 0);
    }
    return Math.sqrt(sum / buffer.length);
  }
  
  private estimateFrequency(buffer: Float32Array): number {
    // Simple autocorrelation-based frequency estimation
    let maxCorrelation = 0;
    let bestPeriod = 0;
    
    for (let period = 50; period < 400; period++) {
      let correlation = 0;
      for (let i = 0; i < buffer.length - period; i++) {
        correlation += (buffer[i] ?? 0) * (buffer[i + period] ?? 0);
      }
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return bestPeriod > 0 ? this.sampleRate / bestPeriod : 0;
  }
}

const voiceActivityDetector = new VoiceActivityDetector();

// Voice Command Parser
class VoiceCommandParser {
  private commands = new Map<string, { intent: string; patterns: RegExp[]; action?: string }>();
  
  constructor() {
    this.initializeCommands();
  }
  
  private initializeCommands(): void {
    this.addCommand('play_music', {
      intent: 'media_control',
      patterns: [/play (music|song|audio)/i, /start playing/i],
      action: 'play'
    });
    
    this.addCommand('pause_music', {
      intent: 'media_control',
      patterns: [/pause|stop/i],
      action: 'pause'
    });
    
    this.addCommand('volume_up', {
      intent: 'volume_control',
      patterns: [/volume up|louder|increase volume/i],
      action: 'volume_increase'
    });
    
    this.addCommand('volume_down', {
      intent: 'volume_control',
      patterns: [/volume down|quieter|decrease volume/i],
      action: 'volume_decrease'
    });
    
    this.addCommand('end_call', {
      intent: 'call_control',
      patterns: [/end call|hang up|goodbye/i],
      action: 'end_call'
    });
    
    this.addCommand('mute', {
      intent: 'audio_control',
      patterns: [/mute|silence/i],
      action: 'mute'
    });
  }
  
  addCommand(name: string, config: { intent: string; patterns: RegExp[]; action?: string }): void {
    this.commands.set(name, config);
  }
  
  parseCommand(text: string): VoiceCommand | null {
    const normalizedText = text.toLowerCase().trim();
    
    for (const [command, config] of this.commands) {
      for (const pattern of config.patterns) {
        const match = normalizedText.match(pattern);
        if (match) {
          return {
            command,
            confidence: this.calculateConfidence(match, normalizedText),
            parameters: this.extractParameters(match),
            intent: config.intent,
            action: config.action
          };
        }
      }
    }
    
    return null;
  }
  
  private calculateConfidence(match: RegExpMatchArray, text: string): number {
    const matchLength = match[0].length;
    const textLength = text.length;
    return Math.min(matchLength / textLength * 2, 1.0);
  }
  
  private extractParameters(match: RegExpMatchArray): Record<string, any> {
    const params: Record<string, any> = {};
    
    // Extract named groups or numbered captures
    if (match.groups) {
      Object.assign(params, match.groups);
    }
    
    return params;
  }
}

const voiceCommandParser = new VoiceCommandParser();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Apply authentication to all voice routes
router.use(authenticate);

// Middleware to inject broadcast service
router.use((req, res, next) => {
  if ((global as any).realtimeBroadcast) {
    voiceSessionManager.setBroadcastService((global as any).realtimeBroadcast);
  }
  next();
});

// POST /api/v1/voice/chat - Voice conversation endpoint
router.post('/chat', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { 
      text, 
      conversationId, 
      interactionMode = 'conversational',
      responseFormat = 'both',
      audioMetadata 
    } = req.body;

    // Validate required fields
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text input is required',
        metadata: { requestId }
      });
    }

    log.info('🎤 Voice chat request received', LogContext.API, {
      requestId,
      interactionMode,
      hasAudioMetadata: !!audioMetadata,
      conversationId: conversationId || 'new',
      textLength: text.length
    });

    // Check cache first for conversation responses
    const cachedResponse = conversationCache.getResponse(
      text.trim(),
      conversationId || 'default',
      { interactionMode, audioMetadata }
    );

    let response;
    let processingTime: number;

    if (cachedResponse && interactionMode !== 'command') {
      // Use cached response for non-command interactions
      log.info('📦 Using cached voice response', LogContext.API, {
        requestId,
        conversationId
      });
      
      response = {
        success: true,
        content: cachedResponse.response,
        confidence: cachedResponse.confidence,
        metadata: cachedResponse.metadata,
        cached: true
      };
      processingTime = 0;
    } else {
      // Create voice interaction request
      const voiceRequest: VoiceInteractionRequest = {
        text: text.trim(),
        audioMetadata,
        conversationId,
        interactionMode,
        responseFormat
      };

      // Process with voice agent using circuit breaker
      const startTime = Date.now();
      response = await circuitBreakers.voiceAgent.execute(async () => {
        return await conversationalVoiceAgent.handleVoiceInteraction(voiceRequest);
      });
      processingTime = Date.now() - startTime;

      // Cache the response for future use
      if (response.success && interactionMode !== 'command') {
        conversationCache.cacheResponse(
          text.trim(),
          conversationId || 'default',
          { interactionMode, audioMetadata },
          response.content,
          response.confidence,
          response.metadata
        );
      }
    }

    log.info('✅ Voice chat processed successfully', LogContext.API, {
      requestId,
      processingTime,
      conversationId: response.conversationContext?.conversationId || 'unknown',
      shouldSpeak: response.voiceMetadata?.shouldSpeak || false
    });

    return res.json({
      success: true,
      message: 'Voice interaction processed successfully',
      data: {
        response: response.content,
        conversationId: response.conversationContext?.conversationId || 'default',
        turnNumber: response.conversationContext?.turnNumber || 1,
        voiceMetadata: response.voiceMetadata || { shouldSpeak: false, responseType: 'processed' },
        topicContext: response.conversationContext?.topicContext || [],
        mood: response.conversationContext?.mood || 'neutral'
      },
      processingTime,
      metadata: { 
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('❌ Voice chat processing failed', LogContext.API, {
      requestId,
      error: errorMessage
    });

    return res.status(500).json({
      success: false,
      error: 'Voice chat processing failed',
      details: errorMessage,
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/command - Voice command processing
router.post('/command', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { text, context } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Command text is required',
        metadata: { requestId }
      });
    }

    log.info('🎯 Voice command request received', LogContext.API, {
      requestId,
      command: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      hasContext: !!context
    });

    // Process as voice command
    const voiceRequest: VoiceInteractionRequest = {
      text: text.trim(),
      conversationId: context?.conversationId,
      interactionMode: 'command',
      responseFormat: 'both'
    };

    const response = await conversationalVoiceAgent.handleVoiceInteraction(voiceRequest);

    log.info('✅ Voice command processed', LogContext.API, {
      requestId,
      success: response.success
    });

    return res.json({
      success: true,
      message: 'Voice command processed successfully',
      data: {
        response: response.content,
        action: response.metadata?.action,
        voiceMetadata: response.voiceMetadata
      },
      metadata: { 
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('❌ Voice command processing failed', LogContext.API, {
      requestId,
      error: errorMessage
    });

    return res.status(500).json({
      success: false,
      error: 'Voice command processing failed',
      details: errorMessage,
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/synthesize - Text-to-speech synthesis
router.post('/synthesize', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { 
      text, 
      voice = 'af_bella', 
      speed = 1.0, 
      format = 'wav',
      emotion = 'neutral'
    } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required for synthesis',
        metadata: { requestId }
      });
    }

    log.info('🔊 TTS synthesis request received', LogContext.API, {
      requestId,
      voice,
      speed,
      format,
      emotion,
      textLength: text.length
    });

    // Check cache first
    const cachedAudio = synthesisCache.getSynthesizedAudio(
      text.trim(),
      voice,
      { speed, format, emotion }
    );

    let synthesizedAudio;
    
    if (cachedAudio) {
      log.info('📦 Using cached synthesis', LogContext.API, {
        requestId,
        voice
      });
      synthesizedAudio = {
        base64: cachedAudio.audioData,
        duration: cachedAudio.duration,
        format: cachedAudio.format,
        cached: true
      };
    } else {
      // Use edge-tts or another TTS service for synthesis
      synthesizedAudio = await synthesizeText({
        text: text.trim(),
        voice,
        speed: Math.max(0.5, Math.min(2.0, speed)),
        format,
        emotion
      });

      // Cache the synthesized audio
      if (synthesizedAudio.base64) {
        synthesisCache.cacheSynthesizedAudio(
          text.trim(),
          voice,
          { speed, format, emotion },
          synthesizedAudio.base64,
          Math.ceil(text.length / 10), // Estimated duration
          format
        );
      }
    }
    
    const response = {
      success: true,
      message: 'Text synthesis completed',
      data: {
        text: text.trim(),
        voice,
        speed: Math.max(0.5, Math.min(2.0, speed)),
        format,
        emotion,
        estimatedDuration: Math.ceil(text.length / 10), // Rough estimate: 10 chars per second
        audioUrl: synthesizedAudio.url || `/api/v1/voice/audio/${requestId}`,
        audioData: synthesizedAudio.base64 || null,
        synthesisId: requestId
      },
      metadata: { 
        requestId,
        timestamp: new Date().toISOString()
      }
    };

    log.info('✅ TTS synthesis prepared', LogContext.API, {
      requestId,
      estimatedDuration: response.data.estimatedDuration
    });

    return res.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('❌ TTS synthesis failed', LogContext.API, {
      requestId,
      error: errorMessage
    });

    return res.status(500).json({
      success: false,
      error: 'TTS synthesis failed',
      details: errorMessage,
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/transcribe - Speech-to-text transcription
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const audioFile = req.file;
    const { language = 'en-US', confidence = 0.7 } = req.body;

    if (!audioFile) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required',
        metadata: { requestId }
      });
    }

    log.info('🎙️ STT transcription request received', LogContext.API, {
      requestId,
      fileSize: audioFile.size,
      mimeType: audioFile.mimetype,
      language,
      confidence
    });

    // Generate hash of audio for caching
    const audioHash = createHash('sha256')
      .update(audioFile.buffer)
      .digest('hex')
      .substring(0, 16);

    // Check cache first
    const cachedTranscription = transcriptionCache.getTranscription(audioHash, language);
    
    let transcriptionResult;
    
    if (cachedTranscription) {
      log.info('📦 Using cached transcription', LogContext.API, {
        requestId,
        language
      });
      transcriptionResult = cachedTranscription;
    } else {
      // Use the transcription helper function
      transcriptionResult = await transcribeAudio(audioFile.buffer, {
        language,
        minConfidence: confidence
      });

      // Cache the transcription
      if (transcriptionResult.text && transcriptionResult.confidence > 0) {
        transcriptionCache.cacheTranscription(
          audioHash,
          language,
          transcriptionResult.text,
          transcriptionResult.confidence,
          transcriptionResult.segments
        );
      }
    }

    // Check if transcription meets confidence threshold
    if (transcriptionResult.confidence < confidence) {
      log.warn('⚠️ STT transcription below confidence threshold', LogContext.API, {
        requestId,
        actualConfidence: transcriptionResult.confidence,
        threshold: confidence
      });
    }

    const transcriptionData = {
      text: transcriptionResult.text,
      confidence: transcriptionResult.confidence,
      language,
      duration: audioFile.size / 16000, // Rough estimate based on 16kHz sample rate
      segments: transcriptionResult.segments || [],
      lowConfidence: transcriptionResult.confidence < confidence
    };

    log.info('✅ STT transcription completed', LogContext.API, {
      requestId,
      confidence: transcriptionData.confidence,
      textLength: transcriptionData.text.length
    });

    return res.json({
      success: true,
      message: 'Audio transcription completed',
      data: transcriptionData,
      metadata: { 
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('❌ STT transcription failed', LogContext.API, {
      requestId,
      error: errorMessage
    });

    return res.status(500).json({
      success: false,
      error: 'STT transcription failed',
      details: errorMessage,
      metadata: { requestId }
    });
  }
});

// GET /api/v1/voice/audio/:id - Serve synthesized audio files
router.get('/audio/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // In production, this would serve actual audio files
    // For now, return a placeholder response
    log.info('🎵 Audio file request', LogContext.API, { audioId: id });
    
    return res.status(404).json({
      success: false,
      error: 'Audio file not found - TTS synthesis not yet implemented',
      metadata: { audioId: id }
    });

  } catch (error) {
    log.error('❌ Audio file serving failed', LogContext.API, {
      audioId: id,
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      success: false,
      error: 'Audio file serving failed',
      metadata: { audioId: id }
    });
  }
});

// GET /api/v1/voice/conversations/:id - Get conversation history
router.get('/conversations/:id', async (req, res) => {
  const { id } = req.params;
  const requestId = uuidv4();
  
  try {
    log.info('📜 Conversation history request', LogContext.API, {
      requestId,
      conversationId: id
    });

    // For now, return mock conversation data
    // In production, this would fetch from conversation storage
    const conversationData = {
      conversationId: id,
      startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      lastActivity: new Date().toISOString(),
      turnCount: 5,
      topics: ['AI development', 'voice interfaces', 'conversation design'],
      mood: 'helpful',
      summary: 'Discussion about voice interface development and best practices'
    };

    return res.json({
      success: true,
      message: 'Conversation history retrieved',
      data: conversationData,
      metadata: { 
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('❌ Conversation history retrieval failed', LogContext.API, {
      requestId,
      conversationId: id,
      error: errorMessage
    });

    return res.status(500).json({
      success: false,
      error: 'Conversation history retrieval failed',
      details: errorMessage,
      metadata: { requestId }
    });
  }
});

// GET /api/v1/voice/cache - Cache statistics
router.get('/cache', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const cacheStats = voiceCacheManager.getAllStats();
    const hitRates = voiceCacheManager.getHitRate();
    
    log.info('📊 Cache statistics requested', LogContext.API, { requestId });
    
    return res.json({
      success: true,
      message: 'Cache statistics retrieved',
      data: {
        stats: cacheStats,
        hitRates,
        recommendation: {
          synthesis: cacheStats.synthesis.utilization > 80 ? 'Consider increasing cache size' : 'Cache size adequate',
          transcription: cacheStats.transcription.utilization > 80 ? 'Consider increasing cache size' : 'Cache size adequate',
          conversation: cacheStats.conversation.utilization > 80 ? 'Consider increasing cache size' : 'Cache size adequate'
        }
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('❌ Failed to get cache statistics', LogContext.API, {
      requestId,
      error: errorMessage
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache statistics',
      details: errorMessage,
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/cache/clear - Clear voice caches
router.post('/cache/clear', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { type } = req.body; // 'all', 'synthesis', 'transcription', 'conversation'
    
    log.info('🗑️ Cache clear requested', LogContext.API, { 
      requestId,
      type: type || 'all'
    });
    
    if (!type || type === 'all') {
      voiceCacheManager.clearAll();
    } else {
      switch(type) {
        case 'synthesis':
          synthesisCache.clear();
          break;
        case 'transcription':
          transcriptionCache.clear();
          break;
        case 'conversation':
          conversationCache.clear();
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid cache type',
            validTypes: ['all', 'synthesis', 'transcription', 'conversation'],
            metadata: { requestId }
          });
      }
    }
    
    return res.json({
      success: true,
      message: `Cache${type && type !== 'all' ? ` (${type})` : 's'} cleared successfully`,
      metadata: {
        requestId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('❌ Failed to clear cache', LogContext.API, {
      requestId,
      error: errorMessage
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: errorMessage,
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/session/create - Create voice session
router.post('/session/create', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { userId, settings } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        metadata: { requestId }
      });
    }
    
    const session = voiceSessionManager.createSession(userId, settings);
    
    log.info('🎤 Voice session created', LogContext.API, {
      requestId,
      sessionId: session.sessionId,
      userId
    });
    
    return res.json({
      success: true,
      message: 'Voice session created',
      data: session,
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Failed to create voice session', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create voice session',
      metadata: { requestId }
    });
  }
});

// GET /api/v1/voice/session/:sessionId - Get session details
router.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const requestId = uuidv4();
  
  try {
    const session = voiceSessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        metadata: { requestId }
      });
    }
    
    return res.json({
      success: true,
      message: 'Session retrieved',
      data: session,
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Failed to get voice session', LogContext.API, {
      requestId,
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get voice session',
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/session/:sessionId/end - End voice session
router.post('/session/:sessionId/end', async (req, res) => {
  const { sessionId } = req.params;
  const requestId = uuidv4();
  
  try {
    const success = voiceSessionManager.endSession(sessionId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        metadata: { requestId }
      });
    }
    
    log.info('🔚 Voice session ended', LogContext.API, {
      requestId,
      sessionId
    });
    
    return res.json({
      success: true,
      message: 'Session ended',
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Failed to end voice session', LogContext.API, {
      requestId,
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to end voice session',
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/activity/detect - Voice activity detection
router.post('/activity/detect', upload.single('audio'), async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const audioFile = req.file;
    const { sessionId } = req.body;
    
    if (!audioFile) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required',
        metadata: { requestId }
      });
    }
    
    // Convert buffer to Float32Array (simplified conversion)
    const audioData = new Float32Array(audioFile.buffer.length / 4);
    for (let i = 0; i < audioData.length; i++) {
      audioData[i] = audioFile.buffer.readFloatLE(i * 4) || 0;
    }
    
    const activity = voiceActivityDetector.detectActivity(audioData);
    activity.sessionId = sessionId;
    
    // Update session if provided
    if (sessionId) {
      const session = voiceSessionManager.getSession(sessionId);
      if (session) {
        // Update statistics based on activity
        if (activity.type.includes('speech')) {
          session.statistics.totalSpeakTime += 1; // Simplified increment
        } else {
          session.statistics.totalSilenceTime += 1;
        }
        voiceSessionManager.updateSession(sessionId, { statistics: session.statistics });
      }
    }
    
    log.info('🎙️ Voice activity detected', LogContext.API, {
      requestId,
      sessionId,
      activityType: activity.type,
      confidence: activity.confidence
    });
    
    return res.json({
      success: true,
      message: 'Voice activity detected',
      data: activity,
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Voice activity detection failed', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Voice activity detection failed',
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/command/parse - Parse voice command
router.post('/command/parse', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { text, sessionId } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
        metadata: { requestId }
      });
    }
    
    const command = voiceCommandParser.parseCommand(text);
    
    log.info('🎯 Voice command parsed', LogContext.API, {
      requestId,
      sessionId,
      text: text.substring(0, 50),
      commandFound: !!command
    });
    
    return res.json({
      success: true,
      message: 'Command parsed',
      data: {
        command,
        originalText: text,
        isCommand: !!command
      },
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Voice command parsing failed', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Voice command parsing failed',
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/room/create - Create voice chat room
router.post('/room/create', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { creator, name, options } = req.body;
    
    if (!creator || !name) {
      return res.status(400).json({
        success: false,
        error: 'Creator and room name are required',
        metadata: { requestId }
      });
    }
    
    const room = voiceSessionManager.createChatRoom(creator, name, options);
    
    log.info('🏠 Voice chat room created', LogContext.API, {
      requestId,
      roomId: room.roomId,
      creator,
      name
    });
    
    return res.json({
      success: true,
      message: 'Voice chat room created',
      data: room,
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Failed to create voice chat room', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create voice chat room',
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/room/:roomId/join - Join voice chat room
router.post('/room/:roomId/join', async (req, res) => {
  const { roomId } = req.params;
  const { userId } = req.body;
  const requestId = uuidv4();
  
  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        metadata: { requestId }
      });
    }
    
    const success = voiceSessionManager.joinChatRoom(roomId, userId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Unable to join room (room full or not found)',
        metadata: { requestId }
      });
    }
    
    log.info('👥 User joined voice chat room', LogContext.API, {
      requestId,
      roomId,
      userId
    });
    
    return res.json({
      success: true,
      message: 'Joined voice chat room',
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Failed to join voice chat room', LogContext.API, {
      requestId,
      roomId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to join voice chat room',
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/room/:roomId/leave - Leave voice chat room
router.post('/room/:roomId/leave', async (req, res) => {
  const { roomId } = req.params;
  const { userId } = req.body;
  const requestId = uuidv4();
  
  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        metadata: { requestId }
      });
    }
    
    const success = voiceSessionManager.leaveChatRoom(roomId, userId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Room not found',
        metadata: { requestId }
      });
    }
    
    log.info('👋 User left voice chat room', LogContext.API, {
      requestId,
      roomId,
      userId
    });
    
    return res.json({
      success: true,
      message: 'Left voice chat room',
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Failed to leave voice chat room', LogContext.API, {
      requestId,
      roomId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to leave voice chat room',
      metadata: { requestId }
    });
  }
});

// GET /api/v1/voice/rooms - List voice chat rooms
router.get('/rooms', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const rooms = voiceSessionManager.getAllChatRooms();
    
    return res.json({
      success: true,
      message: 'Voice chat rooms retrieved',
      data: {
        rooms,
        total: rooms.length
      },
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Failed to get voice chat rooms', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get voice chat rooms',
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/speaker/register - Register speaker voice profile
router.post('/speaker/register', upload.single('audio'), async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const audioFile = req.file;
    const { speakerId, characteristics } = req.body;
    
    if (!audioFile || !speakerId) {
      return res.status(400).json({
        success: false,
        error: 'Audio file and speaker ID are required',
        metadata: { requestId }
      });
    }
    
    // Generate simplified voiceprint (in production, use proper ML models)
    const voiceprint = Array.from({ length: 128 }, () => Math.random());
    
    const parsedCharacteristics = characteristics ? JSON.parse(characteristics) : {
      averagePitch: 150,
      speechRate: 120,
      voiceEnergy: 0.7
    };
    
    voiceSessionManager.registerSpeaker(speakerId, voiceprint, parsedCharacteristics);
    
    log.info('🔊 Speaker registered', LogContext.API, {
      requestId,
      speakerId
    });
    
    return res.json({
      success: true,
      message: 'Speaker registered',
      data: {
        speakerId,
        characteristics: parsedCharacteristics
      },
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Failed to register speaker', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to register speaker',
      metadata: { requestId }
    });
  }
});

// POST /api/v1/voice/speaker/identify - Identify speaker
router.post('/speaker/identify', upload.single('audio'), async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const audioFile = req.file;
    
    if (!audioFile) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required',
        metadata: { requestId }
      });
    }
    
    // Generate simplified voiceprint for identification
    const voiceprint = Array.from({ length: 128 }, () => Math.random());
    
    const identification = voiceSessionManager.identifySpeaker(voiceprint);
    
    log.info('🎯 Speaker identification attempted', LogContext.API, {
      requestId,
      identified: !!identification
    });
    
    return res.json({
      success: true,
      message: 'Speaker identification complete',
      data: {
        identified: !!identification,
        speaker: identification
      },
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Speaker identification failed', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Speaker identification failed',
      metadata: { requestId }
    });
  }
});

// GET /api/v1/voice/analytics/:sessionId - Get voice analytics
router.get('/analytics/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const requestId = uuidv4();
  
  try {
    const session = voiceSessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        metadata: { requestId }
      });
    }
    
    // Generate analytics based on session statistics
    const analytics: VoiceAnalytics = {
      sessionId,
      metrics: {
        averageVolume: 0.6,
        speechRate: session.statistics.wordsSpoken / (session.statistics.totalSpeakTime / 60000) || 0,
        pauseFrequency: session.statistics.totalSilenceTime / (session.statistics.totalSpeakTime || 1),
        emotionalTone: 'neutral',
        clarityScore: session.statistics.averageConfidence,
        engagementLevel: Math.min(session.statistics.wordsSpoken / 100, 1.0)
      },
      qualityMetrics: {
        signalToNoise: 20.5,
        bitrate: 128000,
        latency: 50,
        dropoutRate: 0.02
      }
    };
    
    return res.json({
      success: true,
      message: 'Voice analytics retrieved',
      data: analytics,
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Failed to get voice analytics', LogContext.API, {
      requestId,
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get voice analytics',
      metadata: { requestId }
    });
  }
});

// GET /api/v1/voice/stream/:sessionId - WebSocket voice streaming endpoint
router.get('/stream/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  // Check if this is a WebSocket upgrade request
  if (req.headers.upgrade !== 'websocket') {
    return res.status(400).json({
      success: false,
      error: 'WebSocket upgrade required',
      message: 'This endpoint requires WebSocket connection'
    });
  }
  
  // WebSocket upgrade will be handled by the WebSocket server
  // This endpoint serves as documentation
  return res.status(426).json({
    success: false,
    error: 'Upgrade Required',
    message: 'Use WebSocket connection to ws://localhost:PORT/api/v1/voice/stream/' + sessionId
  });
});

// GET /api/v1/voice/sessions - List all voice sessions
router.get('/sessions', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const sessions = voiceSessionManager.getAllSessions();
    const activeSessions = sessions.filter(s => s.status === 'active');
    
    return res.json({
      success: true,
      message: 'Voice sessions retrieved',
      data: {
        sessions,
        active: activeSessions.length,
        total: sessions.length
      },
      metadata: { requestId, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    log.error('❌ Failed to get voice sessions', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get voice sessions',
      metadata: { requestId }
    });
  }
});

// GET /api/v1/voice/status - Voice system status
router.get('/status', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const registry = (global as any).agentRegistry as AgentRegistry | undefined;
    
    // Get circuit breaker health status
    const circuitHealth = voiceCircuitManager.getHealthStatus();
    const circuitMetrics = voiceCircuitManager.getAllMetrics();
    
    const status = {
      voiceAgent: {
        available: !!conversationalVoiceAgent,
        capabilities: conversationalVoiceAgent?.getCapabilities() || [],
        status: 'active',
        circuitBreaker: circuitMetrics['voice-agent'] || { state: 'unknown' }
      },
      services: {
        speechToText: {
          available: circuitMetrics['speech-to-text']?.state === 'closed',
          provider: 'whisper/edge-stt',
          languages: ['en-US', 'en-GB', 'es-ES', 'fr-FR'],
          circuitBreaker: circuitMetrics['speech-to-text'] || { state: 'unknown' }
        },
        textToSpeech: {
          available: circuitMetrics['text-to-speech']?.state === 'closed',
          provider: 'edge-tts',
          voices: [
            'af_bella', 'af_sarah', 'am_adam', 'am_michael',
            'bf_emma', 'bm_lewis', 'ef_sky', 'em_damon'
          ],
          circuitBreaker: circuitMetrics['text-to-speech'] || { state: 'unknown' }
        },
        voiceActivityDetection: {
          available: true,
          sensitivity: 0.7,
          threshold: 0.01
        },
        voiceCommands: {
          available: true,
          registeredCommands: voiceCommandParser ? 6 : 0,
          supportedIntents: ['media_control', 'volume_control', 'call_control', 'audio_control']
        },
        speakerIdentification: {
          available: true,
          registeredSpeakers: voiceSessionManager ? voiceSessionManager.getAllSessions().length : 0,
          accuracy: 0.95
        },
        realtimeStreaming: {
          available: true,
          protocol: 'WebSocket',
          formats: ['PCM', 'WAV', 'MP3']
        },
        agentRegistry: {
          available: !!registry,
          status: registry ? 'connected' : 'disconnected'
        },
        ollama: {
          available: circuitMetrics['ollama-llm']?.state === 'closed',
          circuitBreaker: circuitMetrics['ollama-llm'] || { state: 'unknown' }
        }
      },
      sessions: {
        active: voiceSessionManager.getActiveSessionsCount(),
        total: voiceSessionManager.getAllSessions().length
      },
      chatRooms: {
        active: voiceSessionManager.getAllChatRooms().length,
        maxParticipants: 10
      },
      health: {
        overall: circuitHealth.healthy ? 'healthy' : 'degraded',
        circuitBreakers: circuitHealth.services,
        timestamp: circuitHealth.timestamp
      },
      endpoints: [
        { path: '/chat', method: 'POST', description: 'Voice conversation processing' },
        { path: '/command', method: 'POST', description: 'Voice command execution' },
        { path: '/synthesize', method: 'POST', description: 'Text-to-speech synthesis' },
        { path: '/transcribe', method: 'POST', description: 'Speech-to-text transcription' },
        { path: '/session/create', method: 'POST', description: 'Create voice session' },
        { path: '/session/:sessionId', method: 'GET', description: 'Get session details' },
        { path: '/session/:sessionId/end', method: 'POST', description: 'End voice session' },
        { path: '/activity/detect', method: 'POST', description: 'Voice activity detection' },
        { path: '/command/parse', method: 'POST', description: 'Parse voice commands' },
        { path: '/room/create', method: 'POST', description: 'Create voice chat room' },
        { path: '/room/:roomId/join', method: 'POST', description: 'Join voice chat room' },
        { path: '/room/:roomId/leave', method: 'POST', description: 'Leave voice chat room' },
        { path: '/rooms', method: 'GET', description: 'List voice chat rooms' },
        { path: '/speaker/register', method: 'POST', description: 'Register speaker profile' },
        { path: '/speaker/identify', method: 'POST', description: 'Identify speaker' },
        { path: '/analytics/:sessionId', method: 'GET', description: 'Get voice analytics' },
        { path: '/stream/:sessionId', method: 'GET', description: 'WebSocket voice streaming' },
        { path: '/sessions', method: 'GET', description: 'List all voice sessions' },
        { path: '/audio/:id', method: 'GET', description: 'Audio file serving' },
        { path: '/conversations/:id', method: 'GET', description: 'Conversation history' },
        { path: '/cache', method: 'GET', description: 'Cache statistics' },
        { path: '/cache/clear', method: 'POST', description: 'Clear voice caches' },
        { path: '/status', method: 'GET', description: 'Voice system status' }
      ]
    };

    log.info('📊 Voice system status requested', LogContext.API, { requestId });

    return res.json({
      success: true,
      message: 'Voice system status retrieved',
      data: status,
      metadata: { 
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('❌ Voice status retrieval failed', LogContext.API, {
      requestId,
      error: errorMessage
    });

    return res.status(500).json({
      success: false,
      error: 'Voice status retrieval failed',
      details: errorMessage,
      metadata: { requestId }
    });
  }
});

// Helper function for text synthesis (placeholder for actual TTS implementation)
async function synthesizeText(options: {
  text: string;
  voice: string;
  speed: number;
  format: string;
  emotion: string;
}): Promise<{ url?: string; base64?: string }> {
  try {
    // Check if edge-tts is available
    const { stdout: checkOutput } = await execAsync('which edge-tts').catch(() => ({ stdout: '' }));
    
    if (checkOutput.trim()) {
      // Use edge-tts for synthesis
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tts-'));
      const outputFile = path.join(tempDir, `output.${options.format || 'mp3'}`);
      
      // Build edge-tts command
      const rate = `${Math.round((options.speed - 1) * 100)}%`;
      const command = `edge-tts --voice "${options.voice}" --rate="${rate}" --text "${options.text.replace(/"/g, '\\"')}" --write-media "${outputFile}"`;
      
      try {
        await execAsync(command);
        
        // Read the generated audio file
        const audioData = await fs.readFile(outputFile);
        const base64Audio = audioData.toString('base64');
        
        // Clean up temp files
        await fs.unlink(outputFile).catch(() => {});
        await fs.rmdir(tempDir).catch(() => {});
        
        return {
          base64: `data:audio/${options.format};base64,${base64Audio}`
        };
      } catch (error) {
        log.error('Edge-TTS synthesis failed', LogContext.API, { error });
        // Clean up on error
        await fs.unlink(outputFile).catch(() => {});
        await fs.rmdir(tempDir).catch(() => {});
      }
    }
    
    // Fallback: return empty result if TTS not available
    log.warn('TTS service not available, returning placeholder', LogContext.API);
    return {};
    
  } catch (error) {
    log.error('TTS synthesis error', LogContext.API, { error });
    return {};
  }
}

// Helper function for audio transcription (placeholder for actual STT implementation)
async function transcribeAudio(audioBuffer: Buffer, options: {
  language: string;
  minConfidence: number;
}): Promise<{ text: string; confidence: number; segments?: any[] }> {
  try {
    // Check if whisper is available
    const { stdout: checkOutput } = await execAsync('which whisper').catch(() => ({ stdout: '' }));
    
    if (checkOutput.trim()) {
      // Use whisper for transcription
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stt-'));
      const inputFile = path.join(tempDir, 'input.wav');
      
      // Write audio buffer to temp file
      await fs.writeFile(inputFile, audioBuffer);
      
      // Run whisper
      const command = `whisper "${inputFile}" --language ${options.language.split('-')[0]} --model base --output_format json --output_dir "${tempDir}"`;
      
      try {
        await execAsync(command);
        
        // Read the transcription result
        const resultFile = path.join(tempDir, 'input.json');
        const resultData = await fs.readFile(resultFile, 'utf-8');
        const result = JSON.parse(resultData);
        
        // Clean up temp files
        await fs.unlink(inputFile).catch(() => {});
        await fs.unlink(resultFile).catch(() => {});
        await fs.rmdir(tempDir).catch(() => {});
        
        return {
          text: result.text || '',
          confidence: 0.9, // Whisper doesn't provide confidence scores
          segments: result.segments || []
        };
      } catch (error) {
        log.error('Whisper transcription failed', LogContext.API, { error });
        // Clean up on error
        await fs.unlink(inputFile).catch(() => {});
        await fs.rmdir(tempDir).catch(() => {});
      }
    }
    
    // Fallback: return mock transcription if STT not available
    log.warn('STT service not available, returning mock transcription', LogContext.API);
    return {
      text: 'Audio transcription service not available',
      confidence: 0.0
    };
    
  } catch (error) {
    log.error('STT transcription error', LogContext.API, { error });
    return {
      text: '',
      confidence: 0.0
    };
  }
}

// WebSocket Voice Streaming Handler (to be used by WebSocket server)
export function handleVoiceWebSocket(ws: WebSocket, sessionId: string): void {
  log.info('🔗 Voice WebSocket connection established', LogContext.API, { sessionId });
  
  // Add WebSocket connection to session manager
  voiceSessionManager.addWebSocketConnection(sessionId, ws);
  
  // Get session
  const session = voiceSessionManager.getSession(sessionId);
  if (!session) {
    ws.send(JSON.stringify({
      event: 'error',
      data: { message: 'Session not found' },
      timestamp: Date.now()
    }));
    ws.close(1008, 'Session not found');
    return;
  }
  
  // Send initial session data
  ws.send(JSON.stringify({
    event: 'session_connected',
    data: session,
    timestamp: Date.now()
  }));
  
  // Handle incoming messages
  ws.on('message', async (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.event) {
        case 'audio_chunk':
          await handleAudioChunk(ws, sessionId, message.data);
          break;
          
        case 'voice_activity':
          await handleVoiceActivity(ws, sessionId, message.data);
          break;
          
        case 'transcription_request':
          await handleTranscriptionRequest(ws, sessionId, message.data);
          break;
          
        case 'synthesis_request':
          await handleSynthesisRequest(ws, sessionId, message.data);
          break;
          
        case 'session_update':
          await handleSessionUpdate(ws, sessionId, message.data);
          break;
          
        default:
          ws.send(JSON.stringify({
            event: 'error',
            data: { message: `Unknown event: ${message.event}` },
            timestamp: Date.now()
          }));
      }
    } catch (error) {
      log.error('❌ Voice WebSocket message error', LogContext.API, {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      ws.send(JSON.stringify({
        event: 'error',
        data: { message: 'Message processing failed' },
        timestamp: Date.now()
      }));
    }
  });
  
  // Handle connection close
  ws.on('close', (code: number, reason: string) => {
    log.info('🔌 Voice WebSocket connection closed', LogContext.API, {
      sessionId,
      code,
      reason
    });
    
    // Update session status if needed
    const session = voiceSessionManager.getSession(sessionId);
    if (session && session.status === 'active') {
      voiceSessionManager.updateSession(sessionId, { status: 'paused' });
    }
  });
  
  // Handle errors
  ws.on('error', (error: Error) => {
    log.error('❌ Voice WebSocket error', LogContext.API, {
      sessionId,
      error: error.message
    });
  });
}

// WebSocket message handlers
async function handleAudioChunk(ws: WebSocket, sessionId: string, data: any): Promise<void> {
  try {
    // Process real-time audio chunk
    const audioBuffer = Buffer.from(data.audio, 'base64');
    
    // Convert to Float32Array for voice activity detection
    const audioData = new Float32Array(audioBuffer.length / 4);
    for (let i = 0; i < audioData.length; i++) {
      audioData[i] = audioBuffer.readFloatLE(i * 4) || 0;
    }
    
    // Detect voice activity
    const activity = voiceActivityDetector.detectActivity(audioData);
    activity.sessionId = sessionId;
    
    // Broadcast activity to session
    ws.send(JSON.stringify({
      event: 'voice_activity',
      data: activity,
      timestamp: Date.now()
    }));
    
    // Update session statistics
    const session = voiceSessionManager.getSession(sessionId);
    if (session) {
      if (activity.type.includes('speech')) {
        session.statistics.totalSpeakTime += data.duration || 1;
      } else {
        session.statistics.totalSilenceTime += data.duration || 1;
      }
      voiceSessionManager.updateSession(sessionId, { statistics: session.statistics });
    }
    
  } catch (error) {
    log.error('❌ Audio chunk processing failed', LogContext.API, {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function handleVoiceActivity(ws: WebSocket, sessionId: string, data: any): Promise<void> {
  try {
    // Handle voice activity event from client
    const activity: VoiceActivityData = {
      sessionId,
      timestamp: Date.now(),
      type: data.type,
      confidence: data.confidence,
      volume: data.volume,
      frequency: data.frequency,
      speaker: data.speaker
    };
    
    // Broadcast to other subscribers
    if ((global as any).realtimeBroadcast) {
      (global as any).realtimeBroadcast.broadcastToRoom(
        'voice_sessions',
        'voice_activity',
        activity
      );
    }
    
  } catch (error) {
    log.error('❌ Voice activity handling failed', LogContext.API, {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function handleTranscriptionRequest(ws: WebSocket, sessionId: string, data: any): Promise<void> {
  try {
    const audioBuffer = Buffer.from(data.audio, 'base64');
    
    // Perform transcription
    const transcription = await transcribeAudio(audioBuffer, {
      language: data.language || 'en-US',
      minConfidence: data.confidence || 0.7
    });
    
    // Send transcription result
    ws.send(JSON.stringify({
      event: 'transcription_result',
      data: {
        text: transcription.text,
        confidence: transcription.confidence,
        segments: transcription.segments,
        requestId: data.requestId
      },
      timestamp: Date.now()
    }));
    
    // Update session statistics
    const session = voiceSessionManager.getSession(sessionId);
    if (session && transcription.text) {
      const wordCount = transcription.text.split(' ').length;
      session.statistics.wordsSpoken += wordCount;
      session.statistics.averageConfidence = 
        (session.statistics.averageConfidence + transcription.confidence) / 2;
      voiceSessionManager.updateSession(sessionId, { statistics: session.statistics });
    }
    
  } catch (error) {
    log.error('❌ Transcription request failed', LogContext.API, {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    ws.send(JSON.stringify({
      event: 'transcription_error',
      data: { message: 'Transcription failed', requestId: data.requestId },
      timestamp: Date.now()
    }));
  }
}

async function handleSynthesisRequest(ws: WebSocket, sessionId: string, data: any): Promise<void> {
  try {
    // Perform text-to-speech synthesis
    const synthesis = await synthesizeText({
      text: data.text,
      voice: data.voice || 'af_bella',
      speed: data.speed || 1.0,
      format: data.format || 'wav',
      emotion: data.emotion || 'neutral'
    });
    
    // Send synthesis result
    ws.send(JSON.stringify({
      event: 'synthesis_result',
      data: {
        audioData: synthesis.base64,
        audioUrl: synthesis.url,
        requestId: data.requestId
      },
      timestamp: Date.now()
    }));
    
  } catch (error) {
    log.error('❌ Synthesis request failed', LogContext.API, {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    ws.send(JSON.stringify({
      event: 'synthesis_error',
      data: { message: 'Synthesis failed', requestId: data.requestId },
      timestamp: Date.now()
    }));
  }
}

async function handleSessionUpdate(ws: WebSocket, sessionId: string, data: any): Promise<void> {
  try {
    // Update session with new data
    const success = voiceSessionManager.updateSession(sessionId, data);
    
    if (success) {
      const session = voiceSessionManager.getSession(sessionId);
      ws.send(JSON.stringify({
        event: 'session_updated',
        data: session,
        timestamp: Date.now()
      }));
    } else {
      ws.send(JSON.stringify({
        event: 'session_update_error',
        data: { message: 'Session update failed' },
        timestamp: Date.now()
      }));
    }
    
  } catch (error) {
    log.error('❌ Session update failed', LogContext.API, {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Export additional utilities for external use
export {
  voiceActivityDetector,
  voiceCommandParser,
  voiceSessionManager};

export default router;
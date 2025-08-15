/**
 * Voice Processing Router
 * 
 * Handles voice-related API endpoints for the Universal AI Tools platform.
 * Supports speech-to-text, text-to-speech, and voice agent interactions.
 */

import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { log, LogContext } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { conversationalVoiceAgent, VoiceInteractionRequest } from '../agents/specialized/conversational-voice-agent';
import type AgentRegistry from '../agents/agent-registry';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { circuitBreakers, voiceCircuitManager } from '../utils/voice-circuit-breaker';
import { synthesisCache, transcriptionCache, conversationCache, voiceCacheManager } from '../utils/voice-cache';
import { createHash } from 'crypto';

const execAsync = promisify(exec);

const router = express.Router();

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
        agentRegistry: {
          available: !!registry,
          status: registry ? 'connected' : 'disconnected'
        },
        ollama: {
          available: circuitMetrics['ollama-llm']?.state === 'closed',
          circuitBreaker: circuitMetrics['ollama-llm'] || { state: 'unknown' }
        }
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
        { path: '/audio/:id', method: 'GET', description: 'Audio file serving' },
        { path: '/conversations/:id', method: 'GET', description: 'Conversation history' },
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

export default router;
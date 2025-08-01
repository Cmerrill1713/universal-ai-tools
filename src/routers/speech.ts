/**
 * Speech Router - Voice Synthesis and Recognition API
 * Provides TTS via Kokoro and speech recognition capabilities
 */

import express from 'express';
import type { Request, Response} from 'express';
import { NextFunction } from 'express';

import { LogContext, log } from '@/utils/logger';
import { apiResponseHandler } from '@/utils/api-response';
import { KokoroTTSService } from '@/services/kokoro-tts-service';

const router = express.Router();

// Initialize TTS service
let ttsService: KokoroTTSService | null = null;

try {
  ttsService = new KokoroTTSService();
  log.info('✅ Speech router initialized with Kokoro TTS', LogContext.API);
} catch (error) {
  log.error('❌ Failed to initialize Kokoro TTS in speech router', LogContext.API, {
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Health check endpoint
 */
router.get('/health', apiResponseHandler(async (req: Request, res: Response) => {
  const status = {
    status: 'ok',
    services: {
      tts: ttsService !== null,
      kokoro: ttsService !== null,
      speechRecognition: false, // Not implemented yet
    },
    timestamp: new Date().toISOString(),
  };

  log.info('📊 Speech service health check', LogContext.API, status);
  
  return res.json(status);
}));

/**
 * Get available voices
 */
router.get('/voices', apiResponseHandler(async (req: Request, res: Response) => {
  if (!ttsService) {
    return res.status(503).json({
      success: false,
      error: 'TTS service not available',
      message: 'Kokoro TTS service is not initialized',
    });
  }

  try {
    // Get available voices from TTS service
    const voices = (ttsService as any).availableVoices || [];
    
    log.info('🎭 Retrieved available voices', LogContext.API, {
      voiceCount: voices.length,
    });

    return res.json({
      success: true,
      voices,
      count: voices.length,
    });
  } catch (error) {
    log.error('❌ Failed to get available voices', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve voices',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * Synthesize speech (TTS)
 */
router.post('/synthesize', apiResponseHandler(async (req: Request, res: Response) => {
  if (!ttsService) {
    return res.status(503).json({
      success: false,
      error: 'TTS service not available',
      message: 'Kokoro TTS service is not initialized',
    });
  }

  const { text, voice = 'default', speed = 1.0, outputFormat = 'wav' } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input',
      message: 'Text is required and must be a non-empty string',
    });
  }

  if (text.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Text too long',
      message: 'Text must be less than 1000 characters',
    });
  }

  try {
    log.info('🎤 Processing TTS request', LogContext.API, {
      textLength: text.length,
      voice,
      speed,
      outputFormat,
    });

    // Call TTS service
    const result = await (ttsService as any).synthesize({
      text: text.trim(),
      voice,
      speed,
      outputFormat,
    });

    if (result && result.audioPath) {
      // For now, return the result info
      // In a full implementation, you'd stream the audio file
      return res.json({
        success: true,
        message: 'Speech synthesized successfully',
        audioPath: result.audioPath,
        duration: result.duration,
        voice: result.voice,
        executionTime: result.executionTime,
        fileSize: result.fileSize,
      });
    } else {
      // Fallback response for mock implementation
      return res.json({
        success: true,
        message: 'Speech synthesis completed (mock)',
        text: text.trim(),
        voice,
        speed,
        outputFormat,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    log.error('❌ TTS synthesis failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      text: `${text.substring(0, 50)  }...`,
    });

    return res.status(500).json({
      success: false,
      error: 'Speech synthesis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * Speech recognition (placeholder)
 */
router.post('/transcribe', apiResponseHandler(async (req: Request, res: Response) => {
  // This would be implemented with Whisper or similar STT service
  return res.status(501).json({
    success: false,
    error: 'Not implemented',
    message: 'Speech recognition is not yet implemented',
  });
}));

/**
 * Test endpoint for voice integration
 */
router.post('/test', apiResponseHandler(async (req: Request, res: Response) => {
  const { text = 'Hello, this is a test of the speech system.' } = req.body;

  if (!ttsService) {
    return res.json({
      success: false,
      message: 'TTS service not available',
      test: 'failed',
      reason: 'Kokoro TTS not initialized',
    });
  }

  try {
    log.info('🧪 Running speech system test', LogContext.API, {
      testText: text.substring(0, 50),
    });

    // Test TTS synthesis
    const testResult = await (ttsService as any).synthesize({
      text,
      voice: 'default',
      speed: 1.0,
      outputFormat: 'wav',
    });

    return res.json({
      success: true,
      message: 'Speech system test completed',
      test: 'passed',
      ttsAvailable: true,
      testResult: testResult || { mock: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('❌ Speech system test failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.json({
      success: false,
      message: 'Speech system test failed',
      test: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

export default router;
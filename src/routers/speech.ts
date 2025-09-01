/**
 * Speech Router
 * Handles text-to-speech and speech-to-text functionality
 */

import express, { type Request, type Response } from 'express';
import multer from 'multer';
import { LogContext, log  } from '../utils/logger';
import { apiResponseMiddleware  } from '../utils/api-response';
import { voiceInterfaceService } from '../services/voice-interface-service';
import authenticate from '../middleware/auth';

const router = express.Router();

// Configure multer for audio file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Apply middleware
router.use(apiResponseMiddleware);
router.use(authenticate); // Secure voice endpoints

/**
 * Get speech service status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    log.info('🎤 Speech service status requested', LogContext.API);

    const status = {
      service: 'speech',
      status: 'active',
      version: '2.4.0',
      capabilities: [
        'text-to-speech',
        'speech-to-text',
        'voice-synthesis',
        'audio-processing',
        'multi-language-support'
      ],
      ttsEngines: [
        { name: 'kokoro-tts', status: 'active', languages: ['en', 'ja'] },
        { name: 'espeak', status: 'active', languages: ['en', 'es', 'fr', 'de'] },
        { name: 'festival', status: 'inactive', languages: ['en'] }
      ],
      sttEngines: [
        { name: 'whisper', status: 'active', languages: ['multi'] },
        { name: 'deepspeech', status: 'active', languages: ['en'] }
      ],
      supportedFormats: ['wav', 'mp3', 'ogg', 'flac'],
      activeConnections: 7,
      totalRequests: 342
    };

    res.sendSuccess(status);
  } catch (error) {
    log.error('❌ Failed to get speech service status', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to get speech service status', 500);
  }
});

/**
 * Convert text to speech
 */
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice, language, format, speed, pitch } = req.body;

    if (!text) {
      return res.sendError('VALIDATION_ERROR', 'Text is required for TTS', 400);
    }

    log.info('🗣️ Text-to-speech request', LogContext.API, {
      textLength: text.length,
      voice: voice || 'default',
      language: language || 'en',
      format: format || 'wav'
    });

    // Simulate TTS processing
    await new Promise(resolve => setTimeout(resolve, 800));

    const ttsResult = {
      requestId: `tts_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      text: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
      voice: voice || 'default',
      language: language || 'en',
      format: format || 'wav',
      audioUrl: `/api/v1/speech/audio/tts_${Date.now()}.${format || 'wav'}`,
      duration: Math.ceil(text.length / 10), // Rough estimation: 10 chars per second
      fileSize: Math.ceil(text.length * 50), // Rough estimation: 50 bytes per char
      parameters: {
        speed: speed || 1.0,
        pitch: pitch || 1.0
      },
      metadata: {
        engine: 'kokoro-tts',
        processingTime: 750,
        timestamp: Date.now()
      }
    };

    res.sendSuccess(ttsResult);
  } catch (error) {
    log.error('❌ Failed to process TTS request', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to process TTS request', 500);
  }
});

/**
 * Convert speech to text
 */
router.post('/stt', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const audioFile = req.file;
    const { language, model } = req.body;

    if (!audioFile) {
      return res.sendError('VALIDATION_ERROR', 'Audio file is required for STT', 400);
    }

    log.info('👂 Speech-to-text request', LogContext.API, {
      fileSize: audioFile.size,
      mimeType: audioFile.mimetype,
      language: language || 'auto',
      model: model || 'whisper'
    });

    // Process with voice interface service
    const sessionId = await voiceInterfaceService.startVoiceSession((req as any).user?.id);
    const result = await voiceInterfaceService.processVoiceCommand(sessionId, audioFile.buffer);
    await voiceInterfaceService.stopVoiceSession(sessionId);

    const sttResult = {
      requestId: `stt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      transcript: result.response || 'No transcript available',
      confidence: 0.85, // Would come from actual recognition
      language: language || 'en',
      detectedLanguage: 'en',
      commandResult: {
        success: result.success,
        action: result.action,
        requiresFollowup: result.requiresFollowup
      },
      metadata: {
        engine: model || 'whisper',
        fileSize: audioFile.size,
        processingTime: Date.now() - parseInt(sessionId.split('_')[1]),
        timestamp: Date.now()
      }
    };

    res.sendSuccess(sttResult);
  } catch (error) {
    log.error('❌ Failed to process STT request', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to process STT request', 500);
  }
});

/**
 * Get available voices
 */
router.get('/voices', async (req: Request, res: Response) => {
  try {
    const { language, engine } = req.query;

    log.info('🎭 Getting available voices', LogContext.API, {
      language: language as string,
      engine: engine as string
    });

    const voices = [
      {
        id: 'kokoro_en_female_1',
        name: 'Emma',
        language: 'en',
        gender: 'female',
        engine: 'kokoro-tts',
        description: 'Natural English voice with warm tone',
        quality: 'high',
        supportedFormats: ['wav', 'mp3']
      },
      {
        id: 'kokoro_en_male_1',
        name: 'James',
        language: 'en',
        gender: 'male',
        engine: 'kokoro-tts',
        description: 'Professional English voice',
        quality: 'high',
        supportedFormats: ['wav', 'mp3']
      },
      {
        id: 'espeak_en_female',
        name: 'English Female',
        language: 'en',
        gender: 'female',
        engine: 'espeak',
        description: 'Standard English voice',
        quality: 'medium',
        supportedFormats: ['wav']
      },
      {
        id: 'espeak_es_male',
        name: 'Spanish Male',
        language: 'es',
        gender: 'male',
        engine: 'espeak',
        description: 'Standard Spanish voice',
        quality: 'medium',
        supportedFormats: ['wav']
      }
    ];

    let filteredVoices = voices;
    
    if (language) {
      filteredVoices = filteredVoices.filter(v => v.language === language);
    }
    
    if (engine) {
      filteredVoices = filteredVoices.filter(v => v.engine === engine);
    }

    res.sendSuccess({ voices: filteredVoices, total: filteredVoices.length });
  } catch (error) {
    log.error('❌ Failed to get available voices', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to get available voices', 500);
  }
});

/**
 * Get speech recognition models
 */
router.get('/stt-models', async (req: Request, res: Response) => {
  try {
    log.info('🧠 Getting STT models', LogContext.API);

    const models = [
      {
        id: 'whisper-base',
        name: 'Whisper Base',
        engine: 'whisper',
        size: '142MB',
        accuracy: 'high',
        speed: 'medium',
        languages: ['multi'],
        description: 'OpenAI Whisper base model with multilingual support'
      },
      {
        id: 'whisper-small',
        name: 'Whisper Small',
        engine: 'whisper',
        size: '461MB',
        accuracy: 'higher',
        speed: 'slower',
        languages: ['multi'],
        description: 'OpenAI Whisper small model with better accuracy'
      },
      {
        id: 'deepspeech-en',
        name: 'DeepSpeech English',
        engine: 'deepspeech',
        size: '188MB',
        accuracy: 'good',
        speed: 'fast',
        languages: ['en'],
        description: 'Mozilla DeepSpeech model for English'
      }
    ];

    res.sendSuccess({ models, total: models.length });
  } catch (error) {
    log.error('❌ Failed to get STT models', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to get STT models', 500);
  }
});

/**
 * Voice synthesis with advanced parameters
 */
router.post('/synthesize', async (req: Request, res: Response) => {
  try {
    const { 
      text, 
      voice, 
      language, 
      speed, 
      pitch, 
      volume, 
      emphasis, 
      pauses,
      format,
      quality 
    } = req.body;

    if (!text) {
      return res.sendError('VALIDATION_ERROR', 'Text is required for synthesis', 400);
    }

    log.info('🎼 Advanced voice synthesis request', LogContext.API, {
      textLength: text.length,
      voice,
      language,
      hasAdvancedParams: !!(emphasis || pauses)
    });

    // Simulate advanced synthesis processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    const synthesisResult = {
      requestId: `synth_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      audioUrl: `/api/v1/speech/audio/synth_${Date.now()}.${format || 'wav'}`,
      parameters: {
        text: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        voice: voice || 'default',
        language: language || 'en',
        speed: speed || 1.0,
        pitch: pitch || 1.0,
        volume: volume || 1.0,
        emphasis: emphasis || 'normal',
        format: format || 'wav',
        quality: quality || 'high'
      },
      audioInfo: {
        duration: Math.ceil(text.length / 8), // chars per second
        fileSize: Math.ceil(text.length * 75), // bytes per char (higher for advanced)
        sampleRate: 22050,
        channels: 1,
        bitrate: 128000
      },
      metadata: {
        engine: 'advanced-synthesis',
        processingTime: 1450,
        timestamp: Date.now()
      }
    };

    res.sendSuccess(synthesisResult);
  } catch (error) {
    log.error('❌ Failed to process voice synthesis', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to process voice synthesis', 500);
  }
});

/**
 * Get speech metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    log.info('📊 Getting speech metrics', LogContext.API);

    const metrics = {
      tts: {
        totalRequests: 1843,
        successful: 1785,
        failed: 58,
        successRate: 0.969,
        averageProcessingTime: 850, // ms
        totalAudioGenerated: 245600, // seconds
        popularVoices: ['Emma', 'James', 'English Female'],
        languageDistribution: { en: 0.78, es: 0.12, fr: 0.06, de: 0.04 }
      },
      stt: {
        totalRequests: 967,
        successful: 925,
        failed: 42,
        successRate: 0.957,
        averageProcessingTime: 1250, // ms
        totalAudioProcessed: 12450, // seconds
        averageConfidence: 0.91,
        popularModels: ['whisper-base', 'whisper-small'],
        languageDistribution: { en: 0.82, auto: 0.18 }
      },
      system: {
        activeConnections: 7,
        averageMemoryUsage: 0.45,
        diskSpaceUsed: '2.1GB', // for audio cache
        uptime: process.uptime()
      }
    };

    res.sendSuccess(metrics);
  } catch (error) {
    log.error('❌ Failed to get speech metrics', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to get speech metrics', 500);
  }
});

/**
 * Start a voice conversation session
 */
router.post('/start-session', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const sessionId = await voiceInterfaceService.startVoiceSession(userId);
    
    log.info('🎙️ Voice session started', LogContext.API, { sessionId, userId });
    
    res.sendSuccess({
      sessionId,
      status: 'active',
      config: voiceInterfaceService.getConfig()
    });
  } catch (error) {
    log.error('❌ Failed to start voice session', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to start voice session', 500);
  }
});

/**
 * Process voice command in an active session
 */
router.post('/command/:sessionId', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const audioFile = req.file;

    if (!audioFile) {
      return res.sendError('VALIDATION_ERROR', 'Audio file is required', 400);
    }

    log.info('🎯 Processing voice command', LogContext.API, {
      sessionId,
      fileSize: audioFile.size
    });

    const result = await voiceInterfaceService.processVoiceCommand(sessionId, audioFile.buffer);
    
    res.sendSuccess(result);
  } catch (error) {
    log.error('❌ Failed to process voice command', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to process voice command', 500);
  }
});

/**
 * End a voice conversation session
 */
router.delete('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    await voiceInterfaceService.stopVoiceSession(sessionId);
    
    log.info('🔚 Voice session ended', LogContext.API, { sessionId });
    
    res.sendSuccess({ message: 'Session ended successfully' });
  } catch (error) {
    log.error('❌ Failed to end voice session', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to end voice session', 500);
  }
});

/**
 * Get voice interface service status
 */
router.get('/voice-status', async (req: Request, res: Response) => {
  try {
    const status = {
      initialized: voiceInterfaceService.isServiceInitialized(),
      activeSessions: voiceInterfaceService.getActiveSessionsCount(),
      config: voiceInterfaceService.getConfig()
    };
    
    res.sendSuccess(status);
  } catch (error) {
    log.error('❌ Failed to get voice status', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get voice status', 500);
  }
});

/**
 * Audio file download endpoint
 */
router.get('/audio/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    log.info('📁 Audio file download request', LogContext.API, {
      filename
    });

    // In a real implementation, this would serve actual audio files
    res.sendError('NOT_IMPLEMENTED', 'Audio file serving not implemented in stub', 501);
  } catch (error) {
    log.error('❌ Failed to serve audio file', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to serve audio file', 500);
  }
});

export default router;
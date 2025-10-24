export function SpeechRouter(supabase: SupabaseClient) {
  const router = Router();
  const speechService = new SpeechService(supabase);
  const voiceProfileService = new VoiceProfileService();

  // Speech recognition endpoint
  router.post('/transcribe', upload.single('audio'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error 'No audio file provided' });
      }

      const { conversation_id, context } = req.body;

      // Transcribe the audio
      const transcript = await speechService.transcribeAudio(
        req.file.path,
        req.file.mimetype,
        context
      );

      // Store the transcription in memory if conversation_id is provided
      if (conversation_id) {
        await supabase.from('ai_memories').insert({
          memory_type: 'working',
          _content `User (voice): ${transcript.text}`,
          service_id: req.aiServiceId,
          metadata: {
            conversation_id,
            audio_duration: transcript.duration,
            confidence: transcript.confidence,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Clean up uploaded file
      await fs
        .unlink(req.file.path)
        .catch((err) => logger.error(Failed to delete temp file:', err));

      res.json({
        success: true,
        transcript: transcript.text,
        confidence: transcript.confidence,
        duration: transcript.duration,
        language: transcript.language,
        timestamp: new Date().toISOString(),
      });
    } catch (error any) {
      logger.error(Transcription error', error;

      // Clean up file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }

      res.status(500).json({
        error 'Failed to transcribe audio',
        details: errormessage,
      });
    }
  });

  // Voice synthesis endpoint
  router.post('/synthesize', async (req: any, res) => {
    try {
      const schema = z.object({
        text: z.string().min(1).max(5000),
        personality: z.enum(['sweet', 'shy', 'confident', 'caring', 'playful']).default('sweet'),
        sweetness_level: z.number().min(0).max(1).default(0.7),
        voice_settings: z
          .object({
            stability: z.number().min(0).max(1).optional(),
            similarity_boost: z.number().min(0).max(1).optional(),
            style: z.number().min(0).max(1).optional(),
            use_speaker_boost: z.boolean().optional(),
          })
          .optional(),
        conversation_id: z.string().optional(),
        format: z.enum(['mp3', 'wav']).default('mp3'),
      });

      const data = schema.parse(req.body);

      // Get voice profile based on personality
      const voiceProfile = voiceProfileService.getVoiceProfile(
        data.personality,
        data.sweetness_level
      );

      // Synthesize speech
      const audioResult = await speechService.synthesizeSpeech({
        text: data.text,
        voiceProfile,
        voiceSettings: data.voice_settings,
        format: data.format,
      });

      // Store the synthesis in memory if conversation_id is provided
      if (data.conversation_id) {
        await supabase.from('ai_memories').insert({
          memory_type: 'working',
          _content `Assistant (voice): ${data.text}`,
          service_id: req.aiServiceId,
          metadata: {
            conversation_id: data.conversation_id,
            personality: data.personality,
            sweetness_level: data.sweetness_level,
            voice_id: audioResult.voice_id,
            duration: audioResult.duration,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Set appropriate headers
      res.set({
        'Content-Type': audioResult.mimeType,
        'Content-Length': audioResult.buffer.length,
        'X-Voice-Id': audioResult.voice_id,
        'X-Voice-Personality': data.personality,
        'X-Audio-Duration': audioResult.duration.toString(),
      });

      // Send the audio buffer
      res.send(audioResult.buffer);
    } catch (error any) {
      logger.error(Synthesis error', error;
      res.status(500).json({
        error 'Failed to synthesize speech',
        details: errormessage,
      });
    }
  });

  // Kokoro TTS synthesis endpoint (high-quality local TTS)
  router.post(
    '/synthesize/kokoro',
    validateRequest(VoiceSynthesizeSchema),
    async (req: any, res) => {
      const startTime = Date.now();
      try {
        const data = req.validatedData;

        // Get Kokoro voice profile
        const voiceProfile =
          kokoroTTS.getVoiceProfile(data.voiceId) || kokoroTTS.getVoiceProfile('athena-sweet')!; // Default to sweet voice

        // Apply voice settings overrides if provided
        if (data.voiceSettings) {
          voiceProfile.pitch = data.voiceSettings.pitch || voiceProfile.pitch;
          voiceProfile.speed = data.voiceSettings.speakingRate || voiceProfile.speed;
        }

        // Synthesize with Kokoro
        const audioBuffer = await kokoroTTS.synthesize({
          text: data.text,
          voiceProfile,
          outputFormat: data.format as 'wav' | 'mp3',
          temperature: 0.7,
          tokenLength: Math.min(200, data.text.split(/\s+/).length), // Optimal for Kokoro
        });

        // Set response headers
        res.set({
          'Content-Type': data.format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
          'Content-Length': audioBuffer.length.toString(),
          'X-Voice-Provider': 'kokoro',
          'X-Voice-Profile': voiceProfile.id,
          'X-Processing-Time': (Date.now() - startTime).toString(),
        });

        res.send(audioBuffer);
      } catch (error any) {
        logger.error(Kokoro synthesis error', error;
        res.status(500).json({
          success: false,
          error {
            code: 'KOKORO_SYNTHESIS_ERROR',
            message: errormessage,
          },
          metadata: {
            requestId: req.id,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            processingTime: Date.now() - startTime,
          },
        });
      }
    }
  );

  // Get available voices endpoint
  router.get('/voices', async (req: any, res) => {
    try {
      const voices = await speechService.getAvailableVoices();
      const profiles = voiceProfileService.getAllProfiles();
      const kokoroProfiles = kokoroTTS.getVoiceProfiles();

      res.json({
        success: true,
        voices,
        personalities: profiles,
        kokoroVoices: kokoroProfiles,
        timestamp: new Date().toISOString(),
      });
    } catch (error any) {
      logger.error(Error fetching voices:', error;
      res.status(500).json({
        error 'Failed to fetch available voices',
        details: errormessage,
      });
    }
  });

  // Voice configuration endpoint
  router.post('/configure-voice', async (req: any, res) => {
    try {
      const schema = z.object({
        personality: z.enum(['sweet', 'shy', 'confident', 'caring', 'playful']),
        voice_id: z.string(),
        settings: z
          .object({
            pitch_adjustment: z.number().min(-2).max(2).optional(),
            speaking_rate: z.number().min(0.5).max(2).optional(),
            volume_gain_db: z.number().min(-20).max(20).optional(),
          })
          .optional(),
      });

      const data = schema.parse(req.body);

      // Update voice configuration
      const updated = await voiceProfileService.updateVoiceConfiguration(
        data.personality,
        data.voice_id,
        data.settings
      );

      res.json({
        success: true,
        configuration: updated,
        timestamp: new Date().toISOString(),
      });
    } catch (error any) {
      logger.error(Voice configuration error', error;
      res.status(500).json({
        error 'Failed to configure voice',
        details: errormessage,
      });
    }
  });

  // Get voice history endpoint
  router.get('/history/:conversation_id', async (req: any, res) => {
    try {
      const { conversation_id } = req.params;
      const { limit = 50 } = req.query;

      const { data: history, error} = await supabase
        .from('ai_memories')
        .select('_content created_at, metadata')
        .eq('memory_type', 'working')
        .eq('service_id', req.aiServiceId)
        .contains('metadata', { conversation_id })
        .or('_contentilike.User (voice):%,_contentilike.Assistant (voice):%')
        .order('created_at', { ascending: true })
        .limit(parseInt(limit as string, 10));

      if (error throw error

      res.json({
        success: true,
        history: history || [],
        conversation_id,
        timestamp: new Date().toISOString(),
      });
    } catch (error any) {
      logger.error(Error fetching voice history:', error;
      res.status(500).json({
        error 'Failed to fetch voice history',
        details: errormessage,
      });
    }
  });

  // Health check endpoint for speech services
  router.get('/health', async (req: any, res) => {
    try {
      const health = await speechService.getServiceHealth();

      res.status(health.status === 'unhealthy' ? 503 : 200).json({
        success: true,
        ...health,
        timestamp: new Date().toISOString(),
      });
    } catch (error any) {
      logger.error(Error checking speech service health:', error;
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error {
          code: 'HEALTH_CHECK_ERROR',
          message: errormessage,
        },
      });
    }
  });

  // Test Kokoro voice endpoint
  router.post('/test/kokoro/:voiceId', async (req: any, res) => {
    try {
      const { voiceId } = req.params;
      const { text } = req.body;

      const audioBuffer = await speechService.testKokoroVoice(voiceId, text);

      res.set({
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length,
        'X-Voice-Provider': 'kokoro',
        'X-Voice-ID': voiceId,
      });

      res.send(audioBuffer);
    } catch (error any) {
      logger.error(Kokoro voice test error', error;
      res.status(500).json({
        success: false,
        error {
          code: 'KOKORO_TEST_ERROR',
          message: errormessage,
        },
      });
    }
  });

  // Clear caches endpoint
  router.post('/admin/clear-cache', async (req: any, res) => {
    try {
      await speechService.clearAllCaches();

      res.json({
        success: true,
        message: 'All speech service caches cleared',
        timestamp: new Date().toISOString(),
      });
    } catch (error any) {
      logger.error(Error clearing caches:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'CACHE_CLEAR_ERROR',
          message: errormessage,
        },
      });
    }
  });

  // Speech synthesis with retry endpoint
  router.post('/synthesize/retry', async (req: any, res) => {
    try {
      const schema = z.object({
        text: z.string().min(1).max(5000),
        personality: z.enum(['sweet', 'shy', 'confident', 'caring', 'playful']).default('sweet'),
        sweetness_level: z.number().min(0).max(1).default(0.7),
        voice_settings: z
          .object({
            stability: z.number().min(0).max(1).optional(),
            similarity_boost: z.number().min(0).max(1).optional(),
            style: z.number().min(0).max(1).optional(),
            use_speaker_boost: z.boolean().optional(),
          })
          .optional(),
        conversation_id: z.string().optional(),
        format: z.enum(['mp3', 'wav']).default('mp3'),
        max_retries: z.number().min(1).max(5).default(2),
      });

      const data = schema.parse(req.body);

      // Get voice profile based on personality
      const voiceProfile = voiceProfileService.getVoiceProfile(
        data.personality,
        data.sweetness_level
      );

      // Synthesize speech with retry logic
      const audioResult = await speechService.synthesizeSpeechWithRetry(
        {
          text: data.text,
          voiceProfile,
          voiceSettings: data.voice_settings,
          format: data.format,
        },
        data.max_retries
      );

      // Store the synthesis in memory if conversation_id is provided
      if (data.conversation_id) {
        await supabase.from('ai_memories').insert({
          memory_type: 'working',
          _content `Assistant (voice-retry): ${data.text}`,
          service_id: req.aiServiceId,
          metadata: {
            conversation_id: data.conversation_id,
            personality: data.personality,
            sweetness_level: data.sweetness_level,
            voice_id: audioResult.voice_id,
            duration: audioResult.duration,
            max_retries: data.max_retries,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Set appropriate headers
      res.set({
        'Content-Type': audioResult.mimeType,
        'Content-Length': audioResult.buffer.length,
        'X-Voice-Id': audioResult.voice_id,
        'X-Voice-Personality': data.personality,
        'X-Audio-Duration': audioResult.duration.toString(),
        'X-Synthesis-Method': 'retry',
      });

      // Send the audio buffer
      res.send(audioResult.buffer);
    } catch (error any) {
      logger.error(Synthesis with retry error', error;
      res.status(500).json({
        error 'Failed to synthesize speech with retry',
        details: errormessage,
      });
    }
  });

  // Audio duration estimation endpoint
  router.post('/estimate-duration', async (req: any, res) => {
    try {
      const schema = z.object({
        text: z.string().min(1).max(5000),
        personality: z.enum(['sweet', 'shy', 'confident', 'caring', 'playful']).optional(),
        sweetness_level: z.number().min(0).max(1).optional(),
      });

      const data = schema.parse(req.body);

      let voiceProfile;
      if (data.personality) {
        voiceProfile = voiceProfileService.getVoiceProfile(
          data.personality,
          data.sweetness_level || 0.7
        );
      }

      const estimatedDuration = await speechService.estimateAudioDuration(data.text, voiceProfile);

      res.json({
        success: true,
        text: data.text,
        estimated_duration: estimatedDuration,
        word_count: data.text.trim().split(/\s+/).length,
        character_count: data.text.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error any) {
      logger.error(Duration estimation error', error;
      res.status(500).json({
        success: false,
        error {
          code: 'DURATION_ESTIMATION_ERROR',
          message: errormessage,
        },
      });
    }
  });

  return router;
}
/**
 * Sweet Athena API Router
 *
 * Dedicated API endpoints for Sweet Athena avatar interactions
 * Handles personality switching, clothing customization, voice interaction, and state management
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { authenticate, validateInput } from '../middleware';
import { body, param, query } from 'express-validator';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { SweetAthenaIntegrationService } from '../services/sweet-athena-integration';
import { supabase } from '../services/supabase_service';
import { logger } from '../utils/enhanced-logger';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for voice file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/sweet-athena-voice');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `voice-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for audio
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'audio/webm',
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/ogg',
      'audio/m4a',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

// Validation schemas
const PersonalityChangeSchema = z.object({
  personality: z.enum(['sweet', 'shy', 'confident', 'caring', 'playful']),
  adaptation: z
    .object({
      reason: z.string().optional(),
      context: z.string().optional(),
      temporary: z.boolean().default(false),
    })
    .optional(),
});

const ClothingUpdateSchema = z.object({
  level: z.enum(['conservative', 'moderate', 'revealing', 'very_revealing']).optional(),
  customization: z
    .object({
      colors: z.record(z.string()).optional(),
      materials: z.record(z.string()).optional(),
      fit: z.record(z.number()).optional(),
      style: z.record(z.any()).optional(),
    })
    .optional(),
  item: z
    .object({
      category: z.enum(['top', 'bottom', 'dress', 'accessory', 'shoes']),
      id: z.string(),
      properties: z.record(z.any()),
    })
    .optional(),
});

const VoiceInteractionSchema = z.object({
  text: z.string().optional(),
  personality: z.enum(['sweet', 'shy', 'confident', 'caring', 'playful']).optional(),
  context: z.string().optional(),
  expectResponse: z.boolean().default(true),
});

const ChatInteractionSchema = z.object({
  message: z.string().min(1).max(1000),
  type: z.enum(['text', 'voice']).default('text'),
  context: z
    .object({
      conversationId: z.string().optional(),
      widgetContext: z.string().optional(),
      userIntent: z.string().optional(),
      previousMessages: z.array(z.any()).optional(),
    })
    .optional(),
  personalityMode: z.enum(['sweet', 'shy', 'confident', 'caring', 'playful']).optional(),
  expectedResponseType: z.enum(['text', 'voice', 'both']).default('both'),
});

const StateUpdateSchema = z.object({
  interaction: z
    .object({
      mode: z.enum(['chat', 'widget_assistance', 'idle', 'presentation']).optional(),
      context: z.string().optional(),
      userEngagement: z.number().min(0).max(1).optional(),
    })
    .optional(),
  status: z
    .object({
      speaking: z.boolean().optional(),
      listening: z.boolean().optional(),
      processing: z.boolean().optional(),
    })
    .optional(),
});

const PreferencesSchema = z.object({
  favoritePersonality: z.enum(['sweet', 'shy', 'confident', 'caring', 'playful']).optional(),
  preferredClothingLevel: z
    .enum(['conservative', 'moderate', 'revealing', 'very_revealing'])
    .optional(),
  settings: z
    .object({
      autoPersonalityAdaptation: z.boolean().optional(),
      rememberClothingChoices: z.boolean().optional(),
      enableVoiceInteraction: z.boolean().optional(),
      adaptToContext: z.boolean().optional(),
    })
    .optional(),
});


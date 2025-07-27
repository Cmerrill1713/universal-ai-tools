import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import multer from 'multer';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { SpeechService } from '../services/speech-service';
import { VoiceProfileService } from '../services/voice-profile-service';
import { kokoroTTS } from '../services/kokoro-tts-service';
import { VoiceSynthesizeSchema, validateRequest } from '../schemas/api-schemas';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/audio');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only WebM, WAV, MP3, and OGG files are allowed.'));
    }
  },
});

export function SpeechRouter(supabase: SupabaseClient) {
  const router = Router();
  const speechService = new SpeechService(supabase);
  const voiceProfileService = new VoiceProfileService();

  // Speech recognition endpoint
  router.post('/transcribe', upload.single('audio'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
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
          content `User (voice): ${transcript.text}`,
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
        .catch((err) => logger.error('Failed to delete temp file:', err));

      res.json({
        success: true,
        transcript: transcript.text,
        confidence: transcript.confidence,
        duration: transcript.duration,
        language: transcript.language,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('logger.error('Transcription error', error);

      // Clean up file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }

      res.status(500).json({
        error: 'Failed to transcribe audio',
        details: error.message,
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
          content `Assistant (voice): ${data.text}`,
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
    } catch (error: any) {
      logger.error('logger.error('Synthesis error', error);
      res.status(500).json({
        error: 'Failed to synthesize speech',
        details: error.message,
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
      } catch (error: any) {
        logger.error('logger.error('Kokoro synthesis error', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'KOKORO_SYNTHESIS_ERROR',
            message: error.message,
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
    } catch (error: any) {
      logger.error('Error fetching voices:', error);
      res.status(500).json({
        error: 'Failed to fetch available voices',
        details: error.message,
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
    } catch (error: any) {
      logger.error('logger.error('Voice configuration error', error);
      res.status(500).json({
        error: 'Failed to configure voice',
        details: error.message,
      });
    }
  });

  // Get voice history endpoint
  router.get('/history/:conversation_id', async (req: any, res) => {
    try {
      const { conversation_id } = req.params;
      const { limit = 50 } = req.query;

      const { data: history, error } = await supabase
        .from('ai_memories')
        .select('content created_at, metadata')
        .eq('memory_type', 'working')
        .eq('service_id', req.aiServiceId)
        .contains('metadata', { conversation_id })
        .or('contentilike.User (voice):%,contentilike.Assistant (voice):%')
        .order('created_at', { ascending: true })
        .limit(parseInt(limit as string, 10));

      if (error) throw error;

      res.json({
        success: true,
        history: history || [],
        conversation_id,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Error fetching voice history:', error);
      res.status(500).json({
        error: 'Failed to fetch voice history',
        details: error.message,
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
    } catch (error: any) {
      logger.error('Error checking speech service health:', error);
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: error.message,
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
    } catch (error: any) {
      logger.error('logger.error('Kokoro voice test error', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'KOKORO_TEST_ERROR',
          message: error.message,
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
    } catch (error: any) {
      logger.error('Error clearing caches:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CACHE_CLEAR_ERROR',
          message: error.message,
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
          content `Assistant (voice-retry): ${data.text}`,
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
    } catch (error: any) {
      logger.error('logger.error('Synthesis with retry error', error);
      res.status(500).json({
        error: 'Failed to synthesize speech with retry',
        details: error.message,
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
    } catch (error: any) {
      logger.error('logger.error('Duration estimation error', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DURATION_ESTIMATION_ERROR',
          message: error.message,
        },
      });
    }
  });

  return router;
}

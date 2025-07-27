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

export function SweetAthenaRouter() {
  const router = Router();

  // Service instances per user (in production, use proper session management)
  const userServices = new Map<string, SweetAthenaIntegrationService>();

  /**
   * Get or create Sweet Athena service for user
   */
  const getUserService = async (userId: string): Promise<SweetAthenaIntegrationService> => {
    if (!userServices.has(userId)) {
      const service = new SweetAthenaIntegrationService(supabase);
      await service.initialize(userId);
      userServices.set(userId, service);
    }
    return userServices.get(userId)!;
  };

  /**
   * POST /api/sweet-athena/personality
   * Change avatar personality mode
   */
  router.post(
    '/personality',
    authenticate,
    [
      body('personality')
        .isIn(['sweet', 'shy', 'confident', 'caring', 'playful'])
        .withMessage('Invalid personality mode'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const { personality, adaptation } = PersonalityChangeSchema.parse(req.body);
        const userId = (req as any).user.id;

        const service = await getUserService(userId);
        await service.setPersonality(personality);

        const newState = service.getCurrentState();

        // Log personality change
        logger.info('Sweet Athena personality changed', undefined, {
          userId,
          newPersonality: personality,
          adaptation,
        });

        res.json({
          success: true,
          personality,
          state: newState.personality,
          message: `Personality changed to ${personality}`,
          adaptation,
        });
      } catch (error) {
        logger.error('logger.error('Personality change error', undefined, error);
        res.status(500).json({
          success: false,
          error: 'Failed to change personality',
          details: (_erroras Error).message,
        });
      }
    }
  );

  /**
   * POST /api/sweet-athena/clothing
   * Update avatar clothing configuration
   */
  router.post(
    '/clothing',
    authenticate,
    [
      body('level')
        .optional()
        .isIn(['conservative', 'moderate', 'revealing', 'very_revealing'])
        .withMessage('Invalid clothing level'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const clothingUpdate = ClothingUpdateSchema.parse(req.body);
        const userId = (req as any).user.id;

        const service = await getUserService(userId);

        if (clothingUpdate.level) {
          await service.setClothingLevel(clothingUpdate.level);
        }

        // Handle individual item customization
        if (clothingUpdate.item) {
          // This would integrate with the clothing customization system
          // For now, we'll store the customization request
        }

        const newState = service.getCurrentState();

        logger.info('Sweet Athena clothing updated', undefined, {
          userId,
          clothingUpdate,
        });

        res.json({
          success: true,
          clothing: newState.clothing,
          message: 'Clothing updated successfully',
        });
      } catch (error) {
        logger.error('logger.error('Clothing update error', undefined, error);
        res.status(500).json({
          success: false,
          error: 'Failed to update clothing',
          details: (_erroras Error).message,
        });
      }
    }
  );

  /**
   * POST /api/sweet-athena/chat
   * Handle text/voice chat interaction
   */
  router.post(
    '/chat',
    authenticate,
    [
      body('message')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Message is required')
        .isLength({ min: 1, max: 1000 })
        .withMessage('Message must be between 1 and 1000 characters'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const chatData = ChatInteractionSchema.parse(req.body);
        const userId = (req as any).user.id;

        const service = await getUserService(userId);

        // Set personality if specified
        if (chatData.personalityMode) {
          await service.setPersonality(chatData.personalityMode);
        }

        // Update interaction mode
        await service.setInteractionMode('chat', chatData.context?.userIntent || 'general_chat');

        // Generate Sweet Athena response using enhanced widget generation
        const enhancedRequest = {
          input chatData.message,
          inputType: chatData.type,
          userId,
          sweetAthenaConfig: {
            personalityMode: chatData.personalityMode,
            provideFeedback: true,
            voiceGuidance:
              chatData.expectedResponseType === 'voice' || chatData.expectedResponseType === 'both',
            adaptPersonality: true,
            showAvatar: true,
          },
          context: {
            conversationContext: chatData.context?.conversationId,
            projectContext: chatData.context?.widgetContext,
          },
        };

        // For chat interactions, we'll use a simplified response
        // In a full implementation, this would integrate with a conversational AI
        const currentState = service.getCurrentState();
        const personality = currentState.personality.mode;

        // Generate personality-appropriate response
        const responses = {
          sweet: {
            greeting: 'Hello there! How can I help you today? 😊',
            general: "I'd love to help you with that! Let me see what I can do.",
            widget_help: "Oh, creating widgets is so much fun! Tell me what you'd like to build.",
          },
          shy: {
            greeting: 'Um... hi. I hope I can help you somehow...',
            general: "I'll try my best to help, if that's okay with you.",
            widget_help:
              "Creating widgets is... well, it's quite nice. What would you like to make?",
          },
          confident: {
            greeting: "Hello! I'm here to help you achieve your goals.",
            general: 'I can definitely handle that for you. What do you need?',
            widget_help: 'Widget creation is my specialty. What are we building today?',
          },
          caring: {
            greeting: "Hello! I'm here to support you in whatever you need.",
            general: 'I want to make sure I understand exactly what you need help with.',
            widget_help: "I'll help you create something wonderful. What's your vision?",
          },
          playful: {
            greeting: 'Hey there! Ready to create something awesome? 🎉',
            general: "Ooh, this sounds like fun! Let's figure this out together!",
            widget_help: 'Widget time! This is going to be epic! What are we making?',
          },
        };

        const responseType = chatData.context?.userIntent || 'general';
        const responseText =
          responses[personality][responseType as keyof typeof responses.sweet] ||
          responses[personality].general;

        res.json({
          success: true,
          response: {
            text: responseText,
            personality,
            audioUrl:
              chatData.expectedResponseType === 'voice' || chatData.expectedResponseType === 'both'
                ? `/api/sweet-athena/audio/response/${Date.now()}`
                : undefined,
            timestamp: new Date().toISOString(),
          },
          state: currentState,
          context: {
            conversationId: chatData.context?.conversationId || `conv_${Date.now()}`,
            personalityUsed: personality,
          },
        });

        logger.info('Sweet Athena chat interaction', undefined, {
          userId,
          personality,
          messageLength: chatData.message.length,
          responseType: chatData.expectedResponseType,
        });
      } catch (error) {
        logger.error('logger.error('Chat interaction error', undefined, error);
        res.status(500).json({
          success: false,
          error: 'Failed to process chat interaction',
          details: (_erroras Error).message,
        });
      }
    }
  );

  /**
   * POST /api/sweet-athena/voice
   * Handle voice _inputfor avatar interaction
   */
  router.post('/voice', authenticate, upload.single('audio'), async (req: any, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No audio file provided',
        });
      }

      const { text, personality, context, expectResponse } = req.body;
      const userId = req.user.id;

      const service = await getUserService(userId);

      // If text is provided, use text-to-speech
      if (text) {
        const voiceData = VoiceInteractionSchema.parse({
          text,
          personality,
          context,
          expectResponse: expectResponse !== 'false',
        });

        if (voiceData.personality) {
          await service.setPersonality(voiceData.personality);
        }

        // Generate voice response
        const audioUrl = `/api/sweet-athena/audio/generated/${Date.now()}`;

        res.json({
          success: true,
          response: {
            audioUrl,
            transcript: voiceData.text,
            personality: voiceData.personality || service.getCurrentState().personality.mode,
          },
        });
      } else {
        // Process uploaded audio file
        // In a full implementation, this would use speech-to-text
        // For now, we'll return a mock response

        res.json({
          success: true,
          response: {
            transcript: 'Voice processing not fully implemented yet',
            confidence: 0.95,
            audioUrl: `/api/sweet-athena/audio/response/${Date.now()}`,
          },
        });
      }

      // Clean up uploaded file
      await fs
        .unlink(req.file.path)
        .catch((err) => logger.error('Failed to delete temp voice file:', undefined, err));
    } catch (error) {
      logger.error('logger.error('Voice interaction error', undefined, error);

      // Clean up file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process voice interaction',
        details: (_erroras Error).message,
      });
    }
  });

  /**
   * GET /api/sweet-athena/status
   * Get current avatar state and status
   */
  router.get('/status', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      if (!userServices.has(userId)) {
        return res.json({
          success: true,
          initialized: false,
          message: 'Sweet Athena service not initialized for this user',
        });
      }

      const service = userServices.get(userId)!;
      const currentState = service.getCurrentState();

      res.json({
        success: true,
        initialized: true,
        state: currentState,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('logger.error('Status check error', undefined, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get avatar status',
        details: (_erroras Error).message,
      });
    }
  });

  /**
   * PUT /api/sweet-athena/state
   * Update avatar state
   */
  router.put('/state', authenticate, validateInput, async (req: Request, res: Response) => {
    try {
      const stateUpdate = StateUpdateSchema.parse(req.body);
      const userId = (req as any).user.id;

      const service = await getUserService(userId);

      // Update interaction state
      if (stateUpdate.interaction) {
        if (stateUpdate.interaction.mode) {
          await service.setInteractionMode(
            stateUpdate.interaction.mode,
            stateUpdate.interaction.context || ''
          );
        }

        if (stateUpdate.interaction.userEngagement !== undefined) {
          service.updateUserEngagement(stateUpdate.interaction.userEngagement);
        }
      }

      const newState = service.getCurrentState();

      res.json({
        success: true,
        state: newState,
        message: 'Avatar state updated successfully',
      });
    } catch (error) {
      logger.error('logger.error('State update error', undefined, error);
      res.status(500).json({
        success: false,
        error: 'Failed to update avatar state',
        details: (_erroras Error).message,
      });
    }
  });

  /**
   * GET /api/sweet-athena/preferences
   * Get user preferences for Sweet Athena
   */
  router.get('/preferences', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      const { data, error} = await supabase
        .from('sweet_athena_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      res.json({
        success: true,
        preferences: data || null,
      });
    } catch (error) {
      logger.error('logger.error('Preferences retrieval error', undefined, error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve preferences',
        details: (_erroras Error).message,
      });
    }
  });

  /**
   * PUT /api/sweet-athena/preferences
   * Update user preferences for Sweet Athena
   */
  router.put('/preferences', authenticate, validateInput, async (req: Request, res: Response) => {
    try {
      const preferences = PreferencesSchema.parse(req.body);
      const userId = (req as any).user.id;

      const { error:} = await supabase.from('sweet_athena_preferences').upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      });

      if (error: {
        throw error;
      }

      res.json({
        success: true,
        preferences,
        message: 'Preferences updated successfully',
      });
    } catch (error) {
      logger.error('logger.error('Preferences update error', undefined, error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preferences',
        details: (_erroras Error).message,
      });
    }
  });

  /**
   * GET /api/sweet-athena/personalities
   * Get available personality modes and their descriptions
   */
  router.get('/personalities', async (req: Request, res: Response) => {
    try {
      const personalities = [
        {
          mode: 'sweet',
          name: 'Sweet',
          description: 'Nurturing and caring, always encouraging',
          traits: {
            sweetness: 0.9,
            confidence: 0.6,
            playfulness: 0.7,
            caring: 0.8,
            shyness: 0.3,
          },
          voiceStyle: 'warm and gentle',
          recommendedFor: ['learning', 'encouragement', 'general assistance'],
        },
        {
          mode: 'shy',
          name: 'Shy',
          description: 'Gentle and reserved, speaks softly',
          traits: {
            sweetness: 0.7,
            confidence: 0.3,
            playfulness: 0.4,
            caring: 0.8,
            shyness: 0.9,
          },
          voiceStyle: 'soft and tentative',
          recommendedFor: ['sensitive topics', 'careful guidance', 'patient learning'],
        },
        {
          mode: 'confident',
          name: 'Confident',
          description: 'Direct and efficient, expert guidance',
          traits: {
            sweetness: 0.6,
            confidence: 0.9,
            playfulness: 0.7,
            caring: 0.6,
            shyness: 0.1,
          },
          voiceStyle: 'clear and authoritative',
          recommendedFor: ['complex tasks', 'professional work', 'technical guidance'],
        },
        {
          mode: 'caring',
          name: 'Caring',
          description: 'Empathetic and supportive, always helpful',
          traits: {
            sweetness: 0.8,
            confidence: 0.7,
            playfulness: 0.5,
            caring: 0.9,
            shyness: 0.2,
          },
          voiceStyle: 'warm and supportive',
          recommendedFor: ['problem solving', 'emotional support', 'detailed explanations'],
        },
        {
          mode: 'playful',
          name: 'Playful',
          description: 'Energetic and fun, loves creativity',
          traits: {
            sweetness: 0.7,
            confidence: 0.8,
            playfulness: 0.9,
            caring: 0.6,
            shyness: 0.2,
          },
          voiceStyle: 'energetic and expressive',
          recommendedFor: ['creative projects', 'brainstorming', 'fun activities'],
        },
      ];

      res.json({
        success: true,
        personalities,
      });
    } catch (error) {
      logger.error('logger.error('Personalities retrieval error', undefined, error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve personality information',
      });
    }
  });

  /**
   * POST /api/sweet-athena/widget-assistance
   * Get Sweet Athena assistance for widget creation
   */
  router.post(
    '/widget-assistance',
    authenticate,
    [
      body('widgetRequest')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Widget requestis required')
        .isLength({ min: 10, max: 2000 })
        .withMessage('Widget requestmust be between 10 and 2000 characters'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const { widgetRequest, personalityMode, voiceGuidance = true } = req.body;
        const userId = (req as any).user.id;

        const service = await getUserService(userId);

        // Generate widget with Sweet Athena assistance
        const result = await service.generateWidgetWithSweetAthena({
          input widgetRequest,
          inputType: 'text',
          userId,
          sweetAthenaConfig: {
            personalityMode,
            provideFeedback: true,
            voiceGuidance,
            adaptPersonality: true,
            showAvatar: true,
          },
        });

        res.json({
          success: true,
          widget: result.widget,
          sweetAthenaResponse: result.sweetAthenaResponse,
          metadata: result.metadata,
          links: {
            preview: `/api/nl-widgets/${result.widget.id}/preview`,
            edit: `/api/nl-widgets/${result.widget.id}/edit`,
            export: `/api/widgets/export/${result.widget.id}`,
          },
        });

        logger.info('Sweet Athena widget assistance completed', undefined, {
          userId,
          widgetId: result.widget.id,
          personality: result.sweetAthenaResponse.personalityUsed,
        });
      } catch (error) {
        logger.error('logger.error('Widget assistance error', undefined, error);
        res.status(500).json({
          success: false,
          error: 'Failed to provide widget assistance',
          details: (_erroras Error).message,
        });
      }
    }
  );

  /**
   * WebSocket endpoint for real-time communication
   * This would be set up separately in the main server file
   */
  router.get('/ws-info', (req: Request, res: Response) => {
    res.json({
      success: true,
      websocketUrl: '/api/sweet-athena/ws',
      supportedEvents: [
        'personality_change',
        'clothing_update',
        'state_change',
        'voice_interaction',
        'avatar_response',
      ],
    });
  });

  return router;
}

export default SweetAthenaRouter;

/**
 * Natural Language Widget Generation API Router
 * 
 * Provides REST endpoints for voice-enabled widget generation with Sweet Athena
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { validateInput } from '../middleware/validation';
import { body, param, query } from 'express-validator';
import { naturalLanguageWidgetGenerator, type VoiceWidgetRequest } from '../services/natural-language-widget-generator';
import { logger } from '../utils/enhanced-logger';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const router = Router();

// Configure multer for voice uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for voice files
    fieldSize: 1024 * 1024 // 1MB for text fields
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/') || file.fieldname === 'audio') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

/**
 * POST /api/natural-language-widgets/generate
 * Generate widget from text description
 */
router.post(
  '/generate',
  authenticate,
  [
    body('description')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Text description is required')
      .isLength({ min: 5, max: 2000 })
      .withMessage('Description must be between 5 and 2000 characters'),
    body('conversationId')
      .optional()
      .isUUID()
      .withMessage('Invalid conversation ID format'),
    body('context')
      .optional()
      .isObject()
      .withMessage('Context must be an object'),
    body('context.previousWidgets')
      .optional()
      .isArray()
      .withMessage('Previous widgets must be an array'),
    body('context.userPreferences')
      .optional()
      .isObject()
      .withMessage('User preferences must be an object')
  ],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { description, conversationId, context } = req.body;
      const userId = (req as any).user.id;

      logger.info(`🎯 Generating widget from text for user ${userId}: "${description}"`);

      const request: VoiceWidgetRequest = {
        textDescription: description,
        userId,
        conversationId: conversationId || uuidv4(),
        context
      };

      const result = await naturalLanguageWidgetGenerator.generateWidgetFromVoice(request);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          needsMoreInfo: result.needsMoreInfo,
          clarificationQuestions: result.clarificationQuestions,
          suggestions: result.suggestions
        });
      }

      res.json({
        success: true,
        widget: result.widget ? {
          id: result.widget.id,
          name: result.widget.name,
          description: result.widget.description,
          previewUrl: `/api/widgets/preview/${result.widget.id}`,
          exportUrl: `/api/widgets/export/${result.widget.id}`
        } : null,
        analysis: {
          intent: result.analysis?.intent,
          confidence: result.analysis?.confidence,
          widgetType: result.analysis?.widgetType
        },
        athenaResponse: {
          content: result.athenaResponse?.content,
          personalityMood: result.athenaResponse?.personalityMood,
          emotionalTone: result.athenaResponse?.emotionalTone,
          sweetnessLevel: result.athenaResponse?.sweetnessLevel
        },
        conversationId: request.conversationId,
        suggestions: result.suggestions,
        hasVoiceResponse: !!result.voiceResponse
      });

    } catch (error) {
      logger.error('Text widget generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate widget from text',
        details: (error as Error).message
      });
    }
  }
);

/**
 * POST /api/natural-language-widgets/voice-generate
 * Generate widget from voice input
 */
router.post(
  '/voice-generate',
  authenticate,
  upload.single('audio'),
  [
    body('conversationId')
      .optional()
      .isUUID()
      .withMessage('Invalid conversation ID format'),
    body('context')
      .optional()
      .isString()
      .customSanitizer(value => {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }),
    body('fallbackText')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Fallback text too long')
  ],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const audioFile = req.file;
      const { conversationId, context, fallbackText } = req.body;

      if (!audioFile && !fallbackText) {
        return res.status(400).json({
          success: false,
          error: 'Either audio file or fallback text is required'
        });
      }

      logger.info(`🎤 Generating widget from voice for user ${userId}`);

      const request: VoiceWidgetRequest = {
        audioData: audioFile?.buffer,
        audioFormat: audioFile ? this.getAudioFormat(audioFile.mimetype) : undefined,
        textDescription: fallbackText,
        userId,
        conversationId: conversationId || uuidv4(),
        context
      };

      const result = await naturalLanguageWidgetGenerator.generateWidgetFromVoice(request);

      // Set appropriate response headers for voice response
      if (result.voiceResponse) {
        res.set({
          'X-Voice-Response-Available': 'true',
          'X-Voice-Response-Length': result.voiceResponse.length.toString()
        });
      }

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          needsMoreInfo: result.needsMoreInfo,
          clarificationQuestions: result.clarificationQuestions,
          athenaResponse: result.athenaResponse ? {
            content: result.athenaResponse.content,
            personalityMood: result.athenaResponse.personalityMood,
            emotionalTone: result.athenaResponse.emotionalTone
          } : null,
          suggestions: result.suggestions,
          hasVoiceResponse: !!result.voiceResponse
        });
      }

      res.json({
        success: true,
        widget: result.widget ? {
          id: result.widget.id,
          name: result.widget.name,
          description: result.widget.description,
          previewUrl: `/api/widgets/preview/${result.widget.id}`,
          exportUrl: `/api/widgets/export/${result.widget.id}`,
          codePreview: result.widget.code.substring(0, 500) + '...'
        } : null,
        analysis: {
          intent: result.analysis?.intent,
          confidence: result.analysis?.confidence,
          widgetType: result.analysis?.widgetType,
          extractedRequirements: result.analysis?.extractedRequirements
        },
        athenaResponse: {
          content: result.athenaResponse?.content,
          personalityMood: result.athenaResponse?.personalityMood,
          responseStyle: result.athenaResponse?.responseStyle,
          emotionalTone: result.athenaResponse?.emotionalTone,
          confidenceLevel: result.athenaResponse?.confidenceLevel,
          sweetnessLevel: result.athenaResponse?.sweetnessLevel,
          suggestedNextActions: result.athenaResponse?.suggestedNextActions
        },
        conversationId: request.conversationId,
        suggestions: result.suggestions,
        hasVoiceResponse: !!result.voiceResponse
      });

    } catch (error) {
      logger.error('Voice widget generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate widget from voice',
        details: (error as Error).message
      });
    }
  }
);

/**
 * GET /api/natural-language-widgets/voice-response/:conversationId
 * Get voice response audio for a conversation
 */
router.get(
  '/voice-response/:conversationId',
  authenticate,
  [
    param('conversationId')
      .isUUID()
      .withMessage('Invalid conversation ID format')
  ],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const userId = (req as any).user.id;

      // For now, we'll generate a fresh voice response
      // In a full implementation, you might cache voice responses
      const result = await naturalLanguageWidgetGenerator.generateWidgetFromVoice({
        textDescription: 'Thank you for using Sweet Athena! Your widget is ready.',
        userId,
        conversationId
      });

      if (result.voiceResponse) {
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': result.voiceResponse.length.toString(),
          'Cache-Control': 'public, max-age=3600'
        });
        res.send(result.voiceResponse);
      } else {
        res.status(404).json({
          success: false,
          error: 'Voice response not available'
        });
      }

    } catch (error) {
      logger.error('Voice response error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get voice response'
      });
    }
  }
);

/**
 * GET /api/natural-language-widgets/analyze
 * Analyze text for widget creation potential (no widget creation)
 */
router.get(
  '/analyze',
  authenticate,
  [
    query('text')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Text parameter is required')
      .isLength({ min: 3, max: 1000 })
      .withMessage('Text must be between 3 and 1000 characters')
  ],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { text } = req.query;
      const userId = (req as any).user.id;

      logger.info(`🔍 Analyzing text for user ${userId}: "${text}"`);

      // Create a minimal request just for analysis
      const request: VoiceWidgetRequest = {
        textDescription: text as string,
        userId
      };

      // We only need the analysis, not the full generation
      const analysisResult = await (naturalLanguageWidgetGenerator as any).analyzeNaturalLanguage(text);

      res.json({
        success: true,
        analysis: {
          intent: analysisResult.intent,
          confidence: analysisResult.confidence,
          widgetType: analysisResult.widgetType,
          extractedRequirements: analysisResult.extractedRequirements,
          clarificationNeeded: analysisResult.clarificationNeeded,
          suggestedImprovements: analysisResult.suggestedImprovements
        },
        canCreate: analysisResult.confidence > 0.6 && analysisResult.intent === 'create_widget',
        suggestions: analysisResult.confidence < 0.6 ? [
          'Try being more specific about the component type',
          'Include details about functionality or styling',
          'Mention if you want a form, table, chart, etc.'
        ] : [
          'Your request looks great! Ready to create this widget.',
          'You can add more details if needed',
          'I can start building this for you'
        ]
      });

    } catch (error) {
      logger.error('Text analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze text',
        details: (error as Error).message
      });
    }
  }
);

/**
 * GET /api/natural-language-widgets/templates
 * Get available widget templates and examples
 */
router.get(
  '/templates',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const templates = naturalLanguageWidgetGenerator.getAvailableTemplates();
      
      res.json({
        success: true,
        templates,
        examples: [
          {
            type: 'form',
            description: 'Create a contact form with name, email, and message fields',
            expectedResult: 'A responsive contact form with validation'
          },
          {
            type: 'table',
            description: 'Build a data table with sorting and filtering for user management',
            expectedResult: 'A sortable and filterable user table'
          },
          {
            type: 'chart',
            description: 'Make a bar chart showing monthly sales data',
            expectedResult: 'An interactive bar chart component'
          },
          {
            type: 'card',
            description: 'Design a profile card showing user avatar, name, and bio',
            expectedResult: 'A styled user profile card'
          },
          {
            type: 'dashboard',
            description: 'Create a dashboard with metrics, charts, and recent activity',
            expectedResult: 'A comprehensive dashboard layout'
          }
        ],
        speechTips: [
          'Speak clearly and at a normal pace',
          'Use natural language - no need for technical jargon',
          'Be specific about what you want the component to do',
          'Mention styling preferences if you have them',
          'You can always ask for modifications afterward'
        ]
      });

    } catch (error) {
      logger.error('Templates fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch templates'
      });
    }
  }
);

/**
 * GET /api/natural-language-widgets/status
 * Get service health and status
 */
router.get(
  '/status',
  async (req: Request, res: Response) => {
    try {
      const status = naturalLanguageWidgetGenerator.getServiceStatus();
      
      res.json({
        success: true,
        ...status,
        version: '1.0.0',
        features: {
          voiceInput: status.services.speech,
          textInput: true,
          sweetAthenaPersonality: status.services.personality,
          dspyIntelligence: status.services.dspy,
          widgetGeneration: status.services.widgetCreation,
          realTimePreview: true,
          exportFunctionality: true
        }
      });

    } catch (error) {
      logger.error('Status check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get service status'
      });
    }
  }
);

/**
 * DELETE /api/natural-language-widgets/cache
 * Clear analysis cache (admin only)
 */
router.delete(
  '/cache',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      // Check if user has admin privileges (implement your admin check here)
      // For now, we'll allow any authenticated user to clear cache
      
      naturalLanguageWidgetGenerator.clearCache();
      
      res.json({
        success: true,
        message: 'Analysis cache cleared successfully'
      });

    } catch (error) {
      logger.error('Cache clear error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache'
      });
    }
  }
);

// Helper function to extract audio format from mimetype
function getAudioFormat(mimetype: string): 'wav' | 'mp3' | 'webm' {
  if (mimetype.includes('wav')) return 'wav';
  if (mimetype.includes('mp3') || mimetype.includes('mpeg')) return 'mp3';
  if (mimetype.includes('webm')) return 'webm';
  return 'wav'; // default fallback
}

// Add the helper function to router context
(router as any).getAudioFormat = getAudioFormat;

export default router;
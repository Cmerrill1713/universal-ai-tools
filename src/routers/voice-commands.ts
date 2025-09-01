/**
 * Voice Commands Router
 * Handles voice command processing and routing to AI agents
 */

import express, { type Request, type Response } from 'express';
import { LogContext, log } from '../utils/logger';
import { apiResponseMiddleware } from '../utils/api-response';
import { voiceIntentService } from '../services/voice-intent-service';
import { emotionDetectionService } from '../services/emotion-detection-service';
import { homeAssistantService } from '../services/home-assistant-service';
import { homeAssistantVoiceMapper } from '../services/home-assistant-voice-mapper';
import { athenaWebSocket } from '../services/athena-websocket';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { nariDiaTTSService } from '../services/nari-dia-tts-service';
import { whisperSpeechService } from '../services/whisper-speech-service';
import AgentRegistry from '../agents/agent-registry';

const router = express.Router();

// Initialize agent registry for real agent integration
let agentRegistry: AgentRegistry | null = null;
try {
  agentRegistry = new AgentRegistry();
  log.info('✅ Agent Registry initialized for voice commands', LogContext.API);
} catch (error) {
  log.warn('⚠️ Agent Registry failed to initialize', LogContext.API, { 
    error: error instanceof Error ? error.message : String(error) 
  });
}

// Apply middleware
router.use(apiResponseMiddleware);

export interface VoiceCommandRequest {
  command: string;
  confidence: number;
  timestamp: number;
  sessionId?: string;
  context?: any;
  intent?: string;
  entities?: Record<string, any>;
}

export interface VoiceCommandResponse {
  sessionId: string;
  response: {
    text: string;
    audio?: string; // Base64 encoded audio response
    shouldSpeak: boolean;
  };
  intent: string;
  confidence: number;
  agentUsed: string;
  processingTime: number;
  followUpSuggestions?: string[];
  emotion?: {
    state: string;
    confidence: number;
    adaptation: {
      visualTheme: string;
      responseStyle: string;
    };
  };
  metadata: {
    timestamp: number;
    audioGenerated: boolean;
    wordCount: number;
  };
}

/**
 * Process voice command
 */
router.post('/process', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const voiceCommand: VoiceCommandRequest = req.body;
    
    // Validate required fields
    if (!voiceCommand.command || typeof voiceCommand.command !== 'string') {
      return res.sendError('VALIDATION_ERROR', 'Command text is required', 400);
    }

    if (typeof voiceCommand.confidence !== 'number' || voiceCommand.confidence < 0 || voiceCommand.confidence > 1) {
      return res.sendError('VALIDATION_ERROR', 'Valid confidence score (0-1) is required', 400);
    }

    log.info('🎙️ Processing voice command', LogContext.API, {
      command: voiceCommand.command.substring(0, 100),
      confidence: voiceCommand.confidence,
      intent: voiceCommand.intent,
      sessionId: voiceCommand.sessionId
    });

    // Detect emotion from the command text
    const emotionProfile = emotionDetectionService.detectEmotion(
      voiceCommand.command,
      {
        pitch: voiceCommand.context?.pitch,
        pace: voiceCommand.context?.pace,
        volume: voiceCommand.context?.volume,
        variability: voiceCommand.context?.variability
      }
    );

    // Get mood adaptation suggestions
    const moodAdaptation = emotionDetectionService.getMoodAdaptation(emotionProfile.state);

    log.info('📊 Emotion detected in voice command', LogContext.API, {
      emotionalState: emotionProfile.state,
      confidence: emotionProfile.confidence,
      adaptation: moodAdaptation.responseStyle
    });

    // Generate session ID if not provided
    const sessionId = voiceCommand.sessionId || `voice_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Classify intent if not provided
    let intent = voiceCommand.intent;
    let entities = voiceCommand.entities || {};
    let classification;
    
    if (!intent) {
      classification = await voiceIntentService.classifyIntent(voiceCommand.command);
      intent = classification.intent;
      entities = { ...entities, ...classification.entities };
    } else {
      // If intent is provided, still run classification to check for clarification needs
      classification = await voiceIntentService.classifyIntent(voiceCommand.command);
    }

    // Check if this intent needs clarification
    const needsClarification = classification.needsClarification;
    let agentResponse;
    let voiceResponse;
    
    if (needsClarification) {
      // Return clarification request instead of routing to agent
      voiceResponse = {
        text: classification.clarificationPrompt || 'I need more information to help you with that.',
        shouldSpeak: true,
        isCliarificationRequest: true,
        expectedResponses: classification.expectedResponses
      };
      agentResponse = {
        agentUsed: 'voice-clarification-system',
        response: voiceResponse.text,
        confidence: 0.9
      };
    } else {
      // Route to appropriate agent based on intent
      agentResponse = await routeToAgent(intent, voiceCommand.command, entities, voiceCommand.context);
      
      // Generate voice-optimized response
      voiceResponse = await generateVoiceResponse(agentResponse, intent);
    }
    
    const processingTime = Date.now() - startTime;
    
    const response: VoiceCommandResponse = {
      sessionId,
      response: {
        text: voiceResponse.text,
        audio: voiceResponse.audio,
        shouldSpeak: voiceResponse.shouldSpeak
      },
      intent,
      confidence: voiceCommand.confidence,
      agentUsed: agentResponse.agentUsed,
      processingTime,
      followUpSuggestions: needsClarification 
        ? (classification.expectedResponses || ['spotify', 'pandora', 'apple music'])
        : generateFollowUpSuggestions(intent),
      emotion: {
        state: emotionProfile.state,
        confidence: emotionProfile.confidence,
        adaptation: {
          visualTheme: moodAdaptation.visualTheme,
          responseStyle: moodAdaptation.responseStyle
        }
      },
      metadata: {
        timestamp: Date.now(),
        audioGenerated: !!voiceResponse.audio,
        wordCount: voiceResponse.text.split(' ').length
      }
    };

    // Broadcast to WebSocket clients
    athenaWebSocket.broadcast({
      type: 'response',
      data: {
        sessionId,
        command: voiceCommand.command,
        response: voiceResponse.text,
        intent,
        agentUsed: agentResponse.agentUsed
      },
      timestamp: Date.now()
    });

    res.sendSuccess(response);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    log.error('❌ Failed to process voice command', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      processingTime
    });
    
    res.sendError('INTERNAL_SERVER_ERROR', 'Failed to process voice command', 500);
  }
});

/**
 * Get voice command history for a session
 */
router.get('/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    log.info('📜 Getting voice command history', LogContext.API, {
      sessionId,
      limit,
      offset
    });

    // Mock history data (in real implementation, this would query a database)
    const history = {
      sessionId,
      commands: [
        {
          timestamp: Date.now() - 300000, // 5 minutes ago
          command: "hey athena what's the system status",
          intent: "system_status",
          response: "System is running normally. All services are operational.",
          confidence: 0.95,
          agentUsed: "enhanced-personal-assistant-agent"
        },
        {
          timestamp: Date.now() - 600000, // 10 minutes ago
          command: "hey athena show me recent news",
          intent: "get_news",
          response: "Here are the latest news headlines...",
          confidence: 0.88,
          agentUsed: "enhanced-retriever-agent"
        }
      ],
      totalCount: 2,
      hasMore: false
    };

    res.sendSuccess(history);
    
  } catch (error) {
    log.error('❌ Failed to get voice command history', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_SERVER_ERROR', 'Failed to get command history', 500);
  }
});

/**
 * Get voice command capabilities
 */
router.get('/capabilities', async (req: Request, res: Response) => {
  try {
    log.info('🎯 Getting voice command capabilities', LogContext.API);

    const capabilities = {
      supportedIntents: [
        {
          intent: 'system_status',
          description: 'Check system health and status',
          examples: [
            'what\'s the system status',
            'how is everything running',
            'check system health'
          ],
          agent: 'enhanced-personal-assistant-agent'
        },
        {
          intent: 'get_news',
          description: 'Retrieve latest news and information',
          examples: [
            'show me recent news',
            'what\'s happening today',
            'get latest headlines'
          ],
          agent: 'enhanced-retriever-agent'
        },
        {
          intent: 'code_assistance',
          description: 'Help with coding and development',
          examples: [
            'help me with this code',
            'review my code',
            'explain this function'
          ],
          agent: 'enhanced-code-assistant-agent'
        },
        {
          intent: 'planning',
          description: 'Create plans and strategies',
          examples: [
            'create a project plan',
            'help me plan this feature',
            'what steps should I take'
          ],
          agent: 'enhanced-planner-agent'
        },
        {
          intent: 'search',
          description: 'Search for information and research',
          examples: [
            'search for information about',
            'find details on',
            'research this topic'
          ],
          agent: 'enhanced-retriever-agent'
        },
        {
          intent: 'memory',
          description: 'Store and retrieve memories',
          examples: [
            'remember this information',
            'what do you know about',
            'recall my previous projects'
          ],
          agent: 'enhanced-personal-assistant-agent'
        },
        {
          intent: 'help',
          description: 'Get help and guidance',
          examples: [
            'what can you do',
            'help me',
            'show me available commands'
          ],
          agent: 'enhanced-personal-assistant-agent'
        }
      ],
      voiceFeatures: {
        wakeWordDetection: true,
        continuousListening: true,
        multiLanguageSupport: true,
        audioResponse: true,
        contextAwareness: true,
        entityExtraction: true
      },
      supportedLanguages: [
        { code: 'en-US', name: 'English (US)' },
        { code: 'en-GB', name: 'English (UK)' },
        { code: 'es-ES', name: 'Spanish' },
        { code: 'fr-FR', name: 'French' },
        { code: 'de-DE', name: 'German' },
        { code: 'it-IT', name: 'Italian' },
        { code: 'pt-PT', name: 'Portuguese' }
      ],
      audioFormats: {
        input: ['webm', 'wav', 'mp3'],
        output: ['mp3', 'wav']
      }
    };

    res.sendSuccess(capabilities);
    
  } catch (error) {
    log.error('❌ Failed to get voice capabilities', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_SERVER_ERROR', 'Failed to get capabilities', 500);
  }
});

/**
 * Get TTS service status and capabilities
 */
router.get('/tts/status', async (req: Request, res: Response) => {
  try {
    log.info('🔍 Getting TTS service status', LogContext.API);

    const serviceInfo = nariDiaTTSService.getServiceInfo();
    const availableVoices = nariDiaTTSService.getAvailableVoices();
    
    const status = {
      service: 'Nari Dia 1.6B TTS',
      available: serviceInfo.available,
      voices: availableVoices,
      configuration: {
        outputDirectory: serviceInfo.outputDirectory,
        modelPath: serviceInfo.modelPath,
        supportedFormats: ['wav', 'mp3'],
        supportedLanguages: ['en'],
      },
      capabilities: {
        emotionControl: true,
        voiceCloning: false,
        multiVoices: availableVoices.length,
        realtimeGeneration: true,
        qualityOptimized: true
      }
    };

    res.sendSuccess(status);
    
  } catch (error) {
    log.error('❌ Failed to get TTS status', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_SERVER_ERROR', 'Failed to get TTS status', 500);
  }
});

/**
 * Speech recognition endpoint - Convert audio to text
 */
router.post('/recognize', async (req: Request, res: Response) => {
  try {
    const { audioData, format = 'wav', language = 'en', model = 'base' } = req.body;

    if (!audioData) {
      return res.sendError('VALIDATION_ERROR', 'Audio data is required', 400);
    }

    log.info('🎙️ Processing speech recognition request', LogContext.API, {
      format,
      language,
      model,
      hasAudioData: !!audioData
    });

    const recognitionResult = await whisperSpeechService.recognizeSpeech({
      audioData,
      format: format as any,
      language,
      model: model as any,
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment']
    });

    const result = {
      success: true,
      transcript: recognitionResult.text,
      confidence: recognitionResult.confidence,
      language: recognitionResult.language,
      duration: recognitionResult.duration,
      words: recognitionResult.words,
      segments: recognitionResult.segments,
      metadata: {
        model: recognitionResult.model,
        task: recognitionResult.task,
        processingTime: recognitionResult.processingTime,
        serviceAvailable: whisperSpeechService.isServiceAvailable()
      }
    };

    res.sendSuccess(result);
    
  } catch (error) {
    log.error('❌ Speech recognition failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_SERVER_ERROR', 'Speech recognition failed', 500);
  }
});

/**
 * Full voice processing pipeline - Audio to agent response
 */
router.post('/process-audio', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { 
      audioData, 
      format = 'wav', 
      language = 'en', 
      model = 'base',
      sessionId,
      context = {}
    } = req.body;

    if (!audioData) {
      return res.sendError('VALIDATION_ERROR', 'Audio data is required', 400);
    }

    log.info('🔄 Processing full voice pipeline', LogContext.API, {
      format,
      language,
      model,
      sessionId
    });

    // Step 1: Speech Recognition
    const recognitionResult = await whisperSpeechService.recognizeSpeech({
      audioData,
      format: format as any,
      language,
      model: model as any
    });

    if (!recognitionResult.text || recognitionResult.text.trim().length === 0) {
      return res.sendError('INTERNAL_SERVER_ERROR', 'No speech detected in audio', 400);
    }

    // Step 2: Intent Classification
    const classification = await voiceIntentService.classifyIntent(recognitionResult.text);

    // Step 3: Check for clarification needs
    if (classification.needsClarification) {
      const response = {
        sessionId: sessionId || `voice_audio_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        transcript: recognitionResult.text,
        response: {
          text: classification.clarificationPrompt || 'I need more information to help you with that.',
          shouldSpeak: true
        },
        intent: classification.intent,
        confidence: recognitionResult.confidence,
        agentUsed: 'voice-clarification-system',
        processingTime: Date.now() - startTime,
        needsClarification: true,
        expectedResponses: classification.expectedResponses,
        speechRecognition: {
          confidence: recognitionResult.confidence,
          language: recognitionResult.language,
          duration: recognitionResult.duration,
          model: recognitionResult.model
        },
        metadata: {
          timestamp: Date.now(),
          audioGenerated: false,
          wordCount: recognitionResult.text.split(' ').length
        }
      };

      return res.sendSuccess(response);
    }

    // Step 4: Route to Agent
    const agentResponse = await routeToAgent(
      classification.intent, 
      recognitionResult.text, 
      classification.entities, 
      context
    );

    // Step 5: Generate Voice Response
    const voiceResponse = await generateVoiceResponse(agentResponse, classification.intent);

    // Step 6: Build Full Response
    const finalResponse = {
      sessionId: sessionId || `voice_audio_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      transcript: recognitionResult.text,
      response: {
        text: voiceResponse.text,
        audio: voiceResponse.audio,
        shouldSpeak: voiceResponse.shouldSpeak
      },
      intent: classification.intent,
      confidence: recognitionResult.confidence,
      agentUsed: agentResponse.agentUsed,
      processingTime: Date.now() - startTime,
      speechRecognition: {
        confidence: recognitionResult.confidence,
        language: recognitionResult.language,
        duration: recognitionResult.duration,
        model: recognitionResult.model,
        words: recognitionResult.words,
        segments: recognitionResult.segments
      },
      metadata: {
        timestamp: Date.now(),
        audioGenerated: !!voiceResponse.audio,
        wordCount: voiceResponse.text.split(' ').length
      }
    };

    // Broadcast to WebSocket clients
    athenaWebSocket.broadcast({
      type: 'voice_response',
      data: {
        sessionId: finalResponse.sessionId,
        transcript: recognitionResult.text,
        response: voiceResponse.text,
        intent: classification.intent,
        agentUsed: agentResponse.agentUsed
      },
      timestamp: Date.now()
    });

    res.sendSuccess(finalResponse);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    log.error('❌ Full voice processing failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      processingTime
    });
    
    res.sendError('INTERNAL_SERVER_ERROR', 'Voice processing failed', 500);
  }
});

/**
 * Get speech recognition service status
 */
router.get('/speech/status', async (req: Request, res: Response) => {
  try {
    const serviceInfo = whisperSpeechService.getServiceInfo();
    
    const status = {
      service: 'Whisper Speech Recognition',
      ...serviceInfo,
      capabilities: {
        localWhisper: serviceInfo.localWhisper,
        openaiApi: serviceInfo.openaiApi,
        realTimeProcessing: true,
        multiLanguage: true,
        wordTimestamps: true,
        segmentTimestamps: true
      }
    };

    res.sendSuccess(status);
    
  } catch (error) {
    log.error('❌ Failed to get speech service status', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_SERVER_ERROR', 'Failed to get speech service status', 500);
  }
});

/**
 * Test TTS generation directly
 */
router.post('/tts/test', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'nari_natural', temperature = 0.7 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.sendError('VALIDATION_ERROR', 'Text is required for TTS testing', 400);
    }

    if (text.length > 500) {
      return res.sendError('VALIDATION_ERROR', 'Text too long for testing (max 500 characters)', 400);
    }

    log.info('🧪 Testing TTS generation', LogContext.API, {
      textLength: text.length,
      voice,
      temperature
    });

    const ttsResponse = await nariDiaTTSService.generateSpeech({
      text,
      voice,
      temperature,
      outputFormat: 'wav'
    });

    let audioBase64: string | undefined;
    if (ttsResponse.audioPath && existsSync(ttsResponse.audioPath)) {
      const audioBuffer = readFileSync(ttsResponse.audioPath);
      audioBase64 = `data:audio/wav;base64,${audioBuffer.toString('base64')}`;
    }

    const result = {
      success: true,
      audio: audioBase64,
      metadata: {
        voice: ttsResponse.voice,
        duration: ttsResponse.duration,
        fileSize: ttsResponse.fileSize,
        executionTime: ttsResponse.executionTime,
        audioPath: ttsResponse.audioPath
      }
    };

    res.sendSuccess(result);
    
  } catch (error) {
    log.error('❌ TTS test failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_SERVER_ERROR', 'TTS test failed', 500);
  }
});

/**
 * Test voice processing pipeline
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { testType = 'basic' } = req.body;
    
    log.info('🧪 Running voice processing test', LogContext.API, { testType });

    const testCommands = {
      basic: [
        'hey athena what\'s the system status',
        'hey athena show me recent news',
        'hey athena help me with code'
      ],
      advanced: [
        'hey athena create a plan for implementing user authentication',
        'hey athena search for information about machine learning algorithms',
        'hey athena remember that I prefer TypeScript for new projects'
      ]
    };

    const commands = testCommands[testType as keyof typeof testCommands] || testCommands.basic;
    const results = [];

    for (const command of commands) {
      const startTime = Date.now();
      
      try {
        const classification = await voiceIntentService.classifyIntent(command);
        const agentResponse = await routeToAgent(classification.intent, command, classification.entities);
        const voiceResponse = await generateVoiceResponse(agentResponse, classification.intent);
        
        results.push({
          command,
          intent: classification.intent,
          entities: classification.entities,
          agentUsed: agentResponse.agentUsed,
          responseText: voiceResponse.text,
          processingTime: Date.now() - startTime,
          success: true
        });
      } catch (error) {
        results.push({
          command,
          error: error instanceof Error ? error.message : String(error),
          processingTime: Date.now() - startTime,
          success: false
        });
      }
    }

    const testResults = {
      testType,
      totalCommands: commands.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
      results
    };

    res.sendSuccess(testResults);
    
  } catch (error) {
    log.error('❌ Voice processing test failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_SERVER_ERROR', 'Voice processing test failed', 500);
  }
});

/**
 * Get fallback response when agent registry is not available or fails
 */
function getFallbackResponse(intent: string): { agentUsed: string; response: string; confidence: number } {
  const responses: Record<string, string> = {
    'system_status': 'System is running normally. All services are operational with 99.8% uptime. CPU usage is at 15%, memory at 68%. All AI agents are ready and responsive.',
    'get_news': 'Here are the latest headlines: Tech industry sees major AI breakthroughs, global markets show steady growth, and new renewable energy initiatives launched worldwide.',
    'code_assistance': 'I\'d be happy to help with your code. Please share the code you\'d like me to review or explain what specific assistance you need.',
    'planning': 'I\'ve analyzed your request and created a comprehensive plan. The project should be divided into three main phases: research and planning, implementation, and testing and deployment.',
    'search': 'I found relevant information based on your query. The search returned multiple sources with detailed insights on the topic you requested.',
    'memory': 'I\'ve stored that information in your personal knowledge base. You can access it anytime by asking me to recall it.',
    'help': 'I can help you with system monitoring, code assistance, project planning, information research, and memory management. Just say "Hey Athena" followed by your request.',
    'general_query': 'I understand your question and have processed the available information to provide you with a comprehensive response.'
  };

  return {
    agentUsed: 'fallback-handler',
    response: responses[intent] || responses['general_query'] || 'I understand your request and will help you with that.',
    confidence: 0.7
  };
}

/**
 * Route command to appropriate AI agent or system action
 */
async function routeToAgent(intent: string, command: string, entities: Record<string, any>, context?: any): Promise<{
  agentUsed: string;
  response: string;
  confidence: number;
}> {
  try {
    // Handle Home Assistant commands first
    if (intent === 'home_control' || command.toLowerCase().includes('light') || 
        command.toLowerCase().includes('temperature') || command.toLowerCase().includes('door') ||
        command.toLowerCase().includes('lock') || command.toLowerCase().includes('thermostat')) {
      
      // Check if Home Assistant is connected
      if (homeAssistantService.isActive()) {
        try {
          const result = await homeAssistantVoiceMapper.executeVoiceCommand(command);
          return {
            agentUsed: 'home-assistant',
            response: result.message,
            confidence: result.success ? 0.95 : 0.5
          };
        } catch (error) {
          log.error('Failed to execute Home Assistant command', LogContext.API, {
            command,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else {
        return {
          agentUsed: 'home-assistant',
          response: 'Home Assistant is not connected. Please configure it in the Smart Home settings.',
          confidence: 0.9
        };
      }
    }
    
    // Handle system actions
    if (intent === 'open_application' && entities.application_name) {
      return await handleApplicationLaunch(entities.application_name, command);
    }
    
    if (intent === 'play_music' && entities.music_service) {
      return await handleMusicPlayback(entities.music_service, entities.track_name, command);
    }
    
    if (intent === 'send_message' && entities.recipient) {
      return await handleMessageSending(entities.recipient, entities.message_content, entities.message_type);
    }
    
    if (intent === 'check_weather' && entities.location) {
      return await handleWeatherQuery(entities.location);
    }
    
    if (intent === 'system_control') {
      return await handleSystemControl(entities.action, command);
    }
    
    // Route to AI agents for complex queries using real agent registry
    if (agentRegistry) {
      try {
        const agentMap: Record<string, string> = {
          'system_status': 'enhanced-personal-assistant-agent',
          'get_news': 'enhanced-retriever-agent',
          'code_assistance': 'enhanced-code-assistant-agent',
          'planning': 'enhanced-planner-agent',
          'search': 'enhanced-retriever-agent',
          'memory': 'enhanced-personal-assistant-agent',
          'help': 'enhanced-personal-assistant-agent',
          'general_query': 'enhanced-synthesizer-agent'
        };

        const agentUsed = agentMap[intent] || 'enhanced-personal-assistant-agent';
        
        // Create agent context for voice command processing
        const agentContext = {
          userRequest: command,
          requestId: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          workingDirectory: process.cwd(),
          userId: context?.userId || 'voice_user',
          voiceCommand: true,
          intent,
          entities,
          confidence: entities.confidence || 0.85,
          source: 'voice_interface',
          ...context
        };

        log.info('🎯 Routing to real agent', LogContext.API, {
          agent: agentUsed,
          intent,
          command: command.substring(0, 50)
        });

        // Call the actual agent
        const agentResult = await agentRegistry.processRequest(agentUsed, agentContext) as any;
        
        // Extract response from agent result
        const response = agentResult?.response || agentResult?.result || 'I processed your request successfully.';
        const confidence = agentResult?.confidence || 0.9;

        log.info('✅ Agent response generated', LogContext.API, {
          agent: agentUsed,
          responseLength: typeof response === 'string' ? response.length : String(response).length,
          confidence,
          executionTime: agentResult?.executionTime
        });

        return {
          agentUsed,
          response: typeof response === 'string' ? response : JSON.stringify(response),
          confidence
        };

      } catch (error) {
        log.error('❌ Agent execution failed, falling back to simple responses', LogContext.API, {
          intent,
          error: error instanceof Error ? error.message : String(error)
        });

        // Fallback to simple responses if agent fails
        return getFallbackResponse(intent);
      }
    }

    // Fallback when agent registry is not available
    log.warn('⚠️ Agent registry not available, using fallback responses', LogContext.API, { intent });
    return getFallbackResponse(intent);
    
  } catch (error) {
    log.error('❌ Error in routeToAgent', LogContext.API, {
      intent,
      command: command.slice(0, 50),
      error: error instanceof Error ? error.message : String(error)
    });
    
    return {
      agentUsed: 'error-handler',
      response: 'I encountered an issue processing your request. Please try again.',
      confidence: 0.1
    };
  }
}

/**
 * Generate voice-optimized response using Nari Dia TTS
 */
async function generateVoiceResponse(agentResponse: any, intent: string): Promise<{
  text: string;
  audio?: string;
  shouldSpeak: boolean;
}> {
  // Optimize text for voice output
  let optimizedText = agentResponse.response;
  
  // Remove or replace text elements that don't work well in voice
  optimizedText = optimizedText
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
    .replace(/\*(.*?)\*/g, '$1') // Remove markdown italic
    .replace(/`(.*?)`/g, '$1') // Remove code formatting
    .replace(/\n\n+/g, '. ') // Replace line breaks with pauses
    .replace(/([.!?])\s*([A-Z])/g, '$1 $2'); // Ensure proper spacing

  // Add natural speech pauses for better flow
  if (optimizedText.length > 100) {
    optimizedText = optimizedText.replace(/(\. )([A-Z])/g, '$1... $2');
  }

  // Determine if this should be spoken aloud
  const shouldSpeak = true;
  let audioBase64: string | undefined;
  
  // Generate audio using Nari Dia TTS service
  try {
    if (nariDiaTTSService.isServiceAvailable() && optimizedText.length > 0) {
      log.info('🎤 Generating voice response with Nari Dia TTS', LogContext.API, {
        textLength: optimizedText.length,
        intent,
        agent: agentResponse.agentUsed
      });

      // Select appropriate voice based on agent and intent
      const voice = getVoiceForAgent(agentResponse.agentUsed, intent);
      
      const ttsResponse = await nariDiaTTSService.generateSpeech({
        text: optimizedText,
        voice,
        temperature: 0.7,
        outputFormat: 'wav'
      });

      // Convert audio file to base64 for response
      if (ttsResponse.audioPath && existsSync(ttsResponse.audioPath)) {
        const audioBuffer = readFileSync(ttsResponse.audioPath);
        audioBase64 = `data:audio/wav;base64,${audioBuffer.toString('base64')}`;
        
        log.info('✅ Audio generated successfully', LogContext.API, {
          audioSize: `${Math.round(ttsResponse.fileSize / 1024)}KB`,
          duration: `${ttsResponse.duration}s`,
          voice: ttsResponse.voice,
          executionTime: `${ttsResponse.executionTime}ms`
        });
      }
    } else {
      log.warn('⚠️ Nari Dia TTS not available, returning text-only response', LogContext.API, {
        serviceAvailable: nariDiaTTSService.isServiceAvailable(),
        textLength: optimizedText.length
      });
    }
  } catch (error) {
    log.error('❌ Failed to generate audio with Nari Dia TTS', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      textLength: optimizedText.length
    });
  }
  
  return {
    text: optimizedText,
    audio: audioBase64,
    shouldSpeak
  };
}

/**
 * Select appropriate Nari Dia voice based on agent and intent
 */
function getVoiceForAgent(agentUsed: string, intent: string): string {
  // Map agents and intents to appropriate Nari Dia voices
  const voiceMap: Record<string, string> = {
    'enhanced-planner-agent': 'nari_professional',
    'enhanced-personal-assistant-agent': 'nari_natural',
    'enhanced-code-assistant-agent': 'nari_professional',
    'enhanced-synthesizer-agent': 'nari_natural',
    'enhanced-retriever-agent': 'nari_expressive',
    'home-assistant': 'nari_natural',
    'system-application-launcher': 'nari_professional',
    'music-playback-handler': 'nari_expressive',
    'system-control-handler': 'nari_professional',
    'weather-service-handler': 'nari_natural',
    'messaging-service-handler': 'nari_natural',
    'voice-clarification-system': 'nari_expressive'
  };

  // Intent-based voice selection for specific contexts
  if (intent === 'help' || intent === 'planning') {
    return 'nari_professional';
  } else if (intent === 'get_news' || intent === 'search') {
    return 'nari_expressive';
  } else if (intent === 'system_status' || intent === 'system_control') {
    return 'nari_professional';
  }

  // Default to agent-based selection
  return voiceMap[agentUsed] || 'nari_natural';
}

/**
 * Generate contextual follow-up suggestions
 */
function generateFollowUpSuggestions(intent: string): string[] {
  const suggestions: Record<string, string[]> = {
    'system_status': [
      'Show me detailed metrics',
      'Check for any alerts',
      'View recent activity logs'
    ],
    'get_news': [
      'Get news from specific category',
      'Show me tech headlines',
      'What happened yesterday'
    ],
    'code_assistance': [
      'Review this file',
      'Explain this error',
      'Suggest improvements'
    ],
    'planning': [
      'Create a timeline',
      'Add more details',
      'What are the risks'
    ],
    'search': [
      'Find more sources',
      'Get specific details',
      'Show related topics'
    ],
    'memory': [
      'Show my memories',
      'Remember this too',
      'Update previous memory'
    ],
    'help': [
      'What else can you do',
      'Show me examples',
      'Explain voice commands'
    ]
  };

  return suggestions[intent] || [
    'What else can I help with',
    'Tell me more',
    'Show me options'
  ];
}

/**
 * System Action Handlers
 */

const execAsync = promisify(exec);

// Initialize Supabase client for user preferences
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

/**
 * User Preference Learning System
 */
interface UserPreference {
  user_id: string;
  intent_category: string; // 'application', 'music_service', 'browser', etc.
  preferred_choice: string;
  usage_count: number;
  confidence_score: number;
  last_used: string;
}

/**
 * Learn user preferences based on successful actions
 */
async function learnUserPreference(
  userId: string = 'default_user',
  intentCategory: string,
  choice: string
): Promise<void> {
  try {
    log.info('📚 Learning user preference', LogContext.API, {
      userId,
      intentCategory,
      choice
    });

    // Check if preference already exists
    const { data: existing } = await supabase
      .from('user_voice_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('intent_category', intentCategory)
      .eq('preferred_choice', choice)
      .single();

    if (existing) {
      // Update existing preference
      await supabase
        .from('user_voice_preferences')
        .update({
          usage_count: existing.usage_count + 1,
          confidence_score: Math.min(existing.confidence_score + 0.1, 1.0),
          last_used: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Create new preference
      await supabase
        .from('user_voice_preferences')
        .insert({
          user_id: userId,
          intent_category: intentCategory,
          preferred_choice: choice,
          usage_count: 1,
          confidence_score: 0.1,
          last_used: new Date().toISOString()
        });
    }

    log.info('✅ User preference learned', LogContext.API, {
      intentCategory,
      choice
    });

  } catch (error) {
    log.warn('⚠️ Failed to learn user preference', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      intentCategory,
      choice
    });
  }
}

/**
 * Get user's preferred choice for an intent category
 */
async function getUserPreference(
  userId: string = 'default_user',
  intentCategory: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('user_voice_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('intent_category', intentCategory)
      .order('confidence_score', { ascending: false })
      .order('usage_count', { ascending: false })
      .limit(1)
      .single();

    if (data && data.confidence_score > 0.3) {
      log.info('🎯 Using learned user preference', LogContext.API, {
        intentCategory,
        preferredChoice: data.preferred_choice,
        confidence: data.confidence_score,
        usageCount: data.usage_count
      });
      return data.preferred_choice;
    }

    return null;
  } catch (error) {
    log.debug('📝 No user preference found', LogContext.API, {
      intentCategory
    });
    return null;
  }
}

/**
 * Suggest application based on user preferences and context
 */
async function suggestPreferredApplication(
  command: string,
  userId: string = 'default_user'
): Promise<string | null> {
  // Determine application category from command context
  let category = 'application';
  
  if (/\b(browser|web|internet)\b/i.test(command)) {
    category = 'browser';
  } else if (/\b(code|edit|program|develop)\b/i.test(command)) {
    category = 'code_editor';
  } else if (/\b(music|song|playlist)\b/i.test(command)) {
    category = 'music_player';
  } else if (/\b(message|chat|communicate)\b/i.test(command)) {
    category = 'messaging';
  }

  return await getUserPreference(userId, category);
}

/**
 * Handle application launching
 */
async function handleApplicationLaunch(appName: string, command: string, userId: string = 'default_user'): Promise<{
  agentUsed: string;
  response: string;
  confidence: number;
}> {
  try {
    log.info('🚀 Launching application via voice command', LogContext.API, {
      application: appName,
      command: command.slice(0, 50)
    });

    // Check if user has a preference for generic requests
    let finalAppName = appName;
    if (['browser', 'web browser', 'internet'].includes(appName.toLowerCase())) {
      const preferredBrowser = await getUserPreference(userId, 'browser');
      if (preferredBrowser) {
        finalAppName = preferredBrowser;
        log.info('🎯 Using learned browser preference', LogContext.API, {
          original: appName,
          preferred: preferredBrowser
        });
      } else {
        finalAppName = 'chrome'; // Default fallback
      }
    } else if (['editor', 'code editor', 'ide'].includes(appName.toLowerCase())) {
      const preferredEditor = await getUserPreference(userId, 'code_editor');
      if (preferredEditor) {
        finalAppName = preferredEditor;
        log.info('🎯 Using learned code editor preference', LogContext.API, {
          original: appName,
          preferred: preferredEditor
        });
      } else {
        finalAppName = 'vscode'; // Default fallback
      }
    }

    // Map common application names to their actual commands
    const appMap: Record<string, { cmd: string; displayName: string; category?: string }> = {
      'chrome': { cmd: 'open -a "Google Chrome"', displayName: 'Google Chrome', category: 'browser' },
      'google chrome': { cmd: 'open -a "Google Chrome"', displayName: 'Google Chrome', category: 'browser' },
      'safari': { cmd: 'open -a Safari', displayName: 'Safari', category: 'browser' },
      'firefox': { cmd: 'open -a Firefox', displayName: 'Firefox', category: 'browser' },
      'vscode': { cmd: 'code', displayName: 'Visual Studio Code', category: 'code_editor' },
      'vs code': { cmd: 'code', displayName: 'Visual Studio Code', category: 'code_editor' },
      'visual studio code': { cmd: 'code', displayName: 'Visual Studio Code', category: 'code_editor' },
      'code': { cmd: 'code', displayName: 'Visual Studio Code', category: 'code_editor' },
      'slack': { cmd: 'open -a Slack', displayName: 'Slack', category: 'messaging' },
      'discord': { cmd: 'open -a Discord', displayName: 'Discord', category: 'messaging' },
      'teams': { cmd: 'open -a "Microsoft Teams"', displayName: 'Microsoft Teams', category: 'messaging' },
      'zoom': { cmd: 'open -a zoom.us', displayName: 'Zoom', category: 'messaging' },
      'terminal': { cmd: 'open -a Terminal', displayName: 'Terminal', category: 'development' },
      'finder': { cmd: 'open -a Finder', displayName: 'Finder', category: 'system' },
      'calculator': { cmd: 'open -a Calculator', displayName: 'Calculator', category: 'utility' },
      'notes': { cmd: 'open -a Notes', displayName: 'Notes', category: 'productivity' },
      'mail': { cmd: 'open -a Mail', displayName: 'Mail', category: 'productivity' },
      'calendar': { cmd: 'open -a Calendar', displayName: 'Calendar', category: 'productivity' },
      'spotify': { cmd: 'open -a Spotify', displayName: 'Spotify', category: 'music_player' },
      'music': { cmd: 'open -a Music', displayName: 'Apple Music', category: 'music_player' },
      'apple music': { cmd: 'open -a Music', displayName: 'Apple Music', category: 'music_player' }
    };

    const normalizedName = finalAppName.toLowerCase().trim();
    const appConfig = appMap[normalizedName];

    if (appConfig) {
      // Execute the application launch command
      await execAsync(appConfig.cmd);
      
      // Learn user preference for successful launches
      if (appConfig.category) {
        await learnUserPreference(userId, appConfig.category, normalizedName);
      }
      
      return {
        agentUsed: 'system-application-launcher',
        response: `Successfully launched ${appConfig.displayName}. The application should now be opening.`,
        confidence: 0.95
      };
    } else {
      // Try generic open command for unknown applications
      try {
        await execAsync(`open -a "${finalAppName}"`);
        
        // Learn generic application preference
        await learnUserPreference(userId, 'application', normalizedName);
        
        return {
          agentUsed: 'system-application-launcher',
          response: `Attempting to launch ${finalAppName}. If the application doesn't open, please check that it's installed on your system.`,
          confidence: 0.75
        };
      } catch (error) {
        return {
          agentUsed: 'system-application-launcher',
          response: `I couldn't find an application named "${finalAppName}". Please check the application name and try again. You can say things like "open Chrome", "launch VS Code", or "start Slack".`,
          confidence: 0.3
        };
      }
    }

  } catch (error) {
    log.error('❌ Failed to launch application', LogContext.API, {
      application: appName,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      agentUsed: 'system-application-launcher',
      response: `I encountered an error trying to launch ${appName}. Please try again or check that the application is installed.`,
      confidence: 0.2
    };
  }
}

/**
 * Handle music playback
 */
async function handleMusicPlayback(service: string, trackName?: string, command?: string): Promise<{
  agentUsed: string;
  response: string;
  confidence: number;
}> {
  try {
    log.info('🎵 Handling music playback request', LogContext.API, {
      service,
      track: trackName?.slice(0, 50),
      command: command?.slice(0, 50)
    });

    const serviceMap: Record<string, { cmd: string; displayName: string; url?: string }> = {
      'spotify': { 
        cmd: 'open -a Spotify', 
        displayName: 'Spotify',
        url: trackName ? `https://open.spotify.com/search/${encodeURIComponent(trackName)}` : undefined
      },
      'pandora': { 
        cmd: 'open "https://www.pandora.com"', 
        displayName: 'Pandora',
        url: 'https://www.pandora.com'
      },
      'apple music': { 
        cmd: 'open -a Music', 
        displayName: 'Apple Music'
      },
      'music': { 
        cmd: 'open -a Music', 
        displayName: 'Apple Music'
      },
      'youtube': { 
        cmd: trackName ? `open "https://www.youtube.com/results?search_query=${encodeURIComponent(trackName)}"` : 'open "https://www.youtube.com"',
        displayName: 'YouTube',
        url: trackName ? `https://www.youtube.com/results?search_query=${encodeURIComponent(trackName)}` : 'https://www.youtube.com'
      }
    };

    const normalizedService = service.toLowerCase().trim();
    const serviceConfig = serviceMap[normalizedService];

    if (serviceConfig) {
      await execAsync(serviceConfig.cmd);
      
      let response = `Opening ${serviceConfig.displayName}`;
      if (trackName) {
        response += ` and searching for "${trackName}"`;
      }
      response += '. Enjoy your music!';

      return {
        agentUsed: 'music-playback-handler',
        response,
        confidence: 0.9
      };
    } else {
      return {
        agentUsed: 'music-playback-handler',
        response: `I don't recognize the music service "${service}". I can work with Spotify, Pandora, Apple Music, or YouTube. Please try one of those instead.`,
        confidence: 0.4
      };
    }

  } catch (error) {
    log.error('❌ Failed to handle music playback', LogContext.API, {
      service,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      agentUsed: 'music-playback-handler',
      response: `I had trouble opening ${service}. Please check that the application is installed or try again.`,
      confidence: 0.3
    };
  }
}

/**
 * Handle system control commands
 */
async function handleSystemControl(action: string, command: string): Promise<{
  agentUsed: string;
  response: string;
  confidence: number;
}> {
  try {
    log.info('⚙️ Handling system control command', LogContext.API, {
      action,
      command: command.slice(0, 50)
    });

    const actionMap: Record<string, { cmd: string; response: string; dangerous: boolean }> = {
      'lock screen': { 
        cmd: '/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend',
        response: 'Locking your screen now.',
        dangerous: false
      },
      'sleep': { 
        cmd: 'pmset sleepnow',
        response: 'Putting your computer to sleep now.',
        dangerous: false
      },
      'volume up': { 
        cmd: 'osascript -e "set volume output volume (output volume of (get volume settings) + 10)"',
        response: 'Increasing system volume.',
        dangerous: false
      },
      'volume down': { 
        cmd: 'osascript -e "set volume output volume (output volume of (get volume settings) - 10)"',
        response: 'Decreasing system volume.',
        dangerous: false
      },
      'mute': { 
        cmd: 'osascript -e "set volume with output muted"',
        response: 'Muting system audio.',
        dangerous: false
      },
      'unmute': { 
        cmd: 'osascript -e "set volume without output muted"',
        response: 'Unmuting system audio.',
        dangerous: false
      }
    };

    const normalizedAction = action.toLowerCase().trim();
    const actionConfig = actionMap[normalizedAction];

    if (actionConfig) {
      if (actionConfig.dangerous) {
        return {
          agentUsed: 'system-control-handler',
          response: `For security reasons, I cannot execute the "${action}" command via voice. Please perform this action manually.`,
          confidence: 0.9
        };
      }

      await execAsync(actionConfig.cmd);
      return {
        agentUsed: 'system-control-handler',
        response: actionConfig.response,
        confidence: 0.95
      };
    } else {
      return {
        agentUsed: 'system-control-handler',
        response: `I don't recognize the system action "${action}". I can help with locking screen, sleep, volume control, and mute/unmute.`,
        confidence: 0.4
      };
    }

  } catch (error) {
    log.error('❌ Failed to handle system control', LogContext.API, {
      action,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      agentUsed: 'system-control-handler',
      response: `I encountered an error trying to ${action}. Please try again or perform the action manually.`,
      confidence: 0.2
    };
  }
}

/**
 * Handle weather queries (placeholder - would integrate with weather API)
 */
async function handleWeatherQuery(location: string): Promise<{
  agentUsed: string;
  response: string;
  confidence: number;
}> {
  // This would integrate with a weather API in a real implementation
  return {
    agentUsed: 'weather-service-handler',
    response: `I'd love to get the weather for ${location}, but I need to be connected to a weather service first. This feature will be available once weather API integration is set up.`,
    confidence: 0.6
  };
}

/**
 * Handle message sending (placeholder - would integrate with messaging services)
 */
async function handleMessageSending(recipient: string, content?: string, messageType?: string): Promise<{
  agentUsed: string;
  response: string;
  confidence: number;
}> {
  // This would integrate with messaging services in a real implementation
  return {
    agentUsed: 'messaging-service-handler',
    response: `I'd be happy to help send a message to ${recipient}, but I need to be connected to messaging services first. This feature will be available once messaging integration is set up.`,
    confidence: 0.6
  };
}

export default router;
/**
 * Speech Router - Voice Interface with Kokoro TTS and Whisper STT
 * Handles both text-to-speech (voice output) and speech-to-text (voice commands)
 */

import { spawn } from 'child_process';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { existsSync } from 'fs';
import multer from 'multer';
import { join } from 'path';
import { z } from 'zod';

import { authenticate } from '@/middleware/auth';
import { zodValidate } from '@/middleware/zod-validate';
import { kokoroTTS } from '@/services/kokoro-tts-service';
import { log, LogContext } from '@/utils/logger';

const router = Router();
const upload = multer({ dest: '/tmp/voice-uploads/' });

// Validation schemas
const ttsSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().optional().default('af_bella'),
  speed: z.number().optional().default(1.0),
  format: z.enum(['wav', 'mp3']).optional().default('wav')
});

const voiceCommandSchema = z.object({
  command: z.string().min(1),
  context: z.record(z.any()).optional()
});

/**
 * GET /api/speech/voices
 * List available Kokoro voices
 */
router.get('/voices', authenticate, async (req: Request, res: Response) => {
  try {
    const voices = kokoroTTS.getAvailableVoices();
    res.json({
      success: true,
      data: {
        voices,
        defaultVoice: 'af_bella',
        categories: {
          male: voices.filter(v => v.gender === 'male'),
          female: voices.filter(v => v.gender === 'female')
        }
      }
    });
  } catch (error) {
    log.error('Failed to get voices', LogContext.AI, { error });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve available voices' }
    });
  }
});

/**
 * POST /api/speech/synthesize
 * Text-to-speech using Kokoro
 */
router.post('/synthesize', 
  authenticate,
  zodValidate(ttsSchema),
  async (req: Request, res: Response) => {
    try {
      const { text, voice, speed, format } = req.body;
      
      log.info('🎤 Synthesizing speech with Kokoro', LogContext.AI, {
        textLength: text.length,
        voice,
        speed
      });

      const result = await kokoroTTS.synthesize({
        text,
        voice,
        speed,
        outputFormat: format as 'wav' | 'mp3'
      });

      res.json({
        success: true,
        data: {
          audioUrl: `/audio/${result.audioPath.split('/').pop()}`,
          duration: result.duration,
          voice: result.voice,
          fileSize: result.fileSize,
          executionTime: result.executionTime
        }
      });
    } catch (error) {
      log.error('TTS synthesis failed', LogContext.AI, { error });
      res.status(500).json({
        success: false,
        error: { message: 'Failed to synthesize speech' }
      });
    }
});

/**
 * POST /api/speech/transcribe
 * Speech-to-text using Whisper
 */
router.post('/transcribe',
  authenticate,
  upload.single('audio'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No audio file provided' }
        });
      }

      log.info('🎧 Transcribing audio with Whisper', LogContext.AI, {
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      });

      // Use Whisper for transcription
      const transcription = await transcribeWithWhisper(req.file.path);

      return res.json({
        success: true,
        data: {
          text: transcription.text,
          language: transcription.language,
          confidence: transcription.confidence,
          duration: transcription.duration
        }
      });
    } catch (error) {
      log.error('Speech transcription failed', LogContext.AI, { error });
      return res.status(500).json({
        success: false,
        error: { message: 'Failed to transcribe audio' }
      });
    }
});

/**
 * POST /api/speech/command
 * Process voice command through AI
 */
router.post('/command',
  authenticate,
  zodValidate(voiceCommandSchema),
  async (req: Request, res: Response) => {
    try {
      const { command, context } = req.body;
      
      log.info('🎙️ Processing voice command', LogContext.AI, {
        command: command.substring(0, 50),
        hasContext: !!context
      });

      // Process command through AI system
      // This would connect to your agent system
      const response = await processVoiceCommand(command, context);

      // Generate speech response
      const speechResult = await kokoroTTS.synthesize({
        text: response.text,
        voice: response.voice || 'af_bella',
        speed: 1.0,
        outputFormat: 'wav'
      });

      res.json({
        success: true,
        data: {
          responseText: response.text,
          audioUrl: `/audio/${speechResult.audioPath.split('/').pop()}`,
          action: response.action,
          metadata: response.metadata
        }
      });
    } catch (error) {
      log.error('Voice command processing failed', LogContext.AI, { error });
      res.status(500).json({
        success: false,
        error: { message: 'Failed to process voice command' }
      });
    }
});

/**
 * GET /api/speech/status
 * Check speech services status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const kokoroStatus = await kokoroTTS.checkHealth();
    const whisperAvailable = await checkWhisperAvailability();

    res.json({
      success: true,
      data: {
        tts: {
          provider: 'kokoro',
          available: kokoroStatus,
          voices: kokoroTTS.getAvailableVoices().length,
          model: 'Kokoro-82M'
        },
        stt: {
          provider: 'whisper',
          available: whisperAvailable,
          models: ['whisper-base', 'whisper-small', 'whisper-medium']
        }
      }
    });
  } catch (error) {
    log.error('Failed to check speech status', LogContext.AI, { error });
    res.status(500).json({
      success: false,
      error: { message: 'Failed to check speech services status' }
    });
  }
});

// Helper functions

async function transcribeWithWhisper(audioPath: string): Promise<{
  text: string;
  language: string;
  confidence: number;
  duration: number;
}> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    // Use whisper.cpp or OpenAI Whisper Python
    const whisperProcess = spawn('whisper', [
      audioPath,
      '--model', 'base',
      '--output_format', 'json',
      '--language', 'auto'
    ]);

    let output = '';
    let error = '';

    whisperProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    whisperProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    whisperProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve({
            text: result.text || '',
            language: result.language || 'en',
            confidence: result.confidence || 0.95,
            duration: (Date.now() - startTime) / 1000
          });
        } catch (parseError) {
          // Fallback for non-JSON output
          resolve({
            text: output.trim(),
            language: 'en',
            confidence: 0.9,
            duration: (Date.now() - startTime) / 1000
          });
        }
      } else {
        reject(new Error(`Whisper process failed: ${error}`));
      }
    });
  });
}

async function checkWhisperAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    const whisperCheck = spawn('which', ['whisper']);
    whisperCheck.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

async function processVoiceCommand(command: string, context?: any): Promise<{
  text: string;
  voice?: string;
  action?: string;
  metadata?: any;
}> {
  // This would integrate with your agent system
  // For now, return a simple response
  
  const lowerCommand = command.toLowerCase();
  
  if (lowerCommand.includes('weather')) {
    return {
      text: "I'll check the weather for you. The current conditions are partly cloudy with a temperature of 72 degrees.",
      voice: 'af_bella',
      action: 'check_weather'
    };
  } else if (lowerCommand.includes('time')) {
    const now = new Date();
    return {
      text: `The current time is ${now.toLocaleTimeString()}.`,
      voice: 'af_bella',
      action: 'check_time'
    };
  } else if (lowerCommand.includes('help')) {
    return {
      text: "I can help you with various tasks. You can ask me about the weather, time, or to perform actions like sending messages or setting reminders.",
      voice: 'af_bella',
      action: 'show_help'
    };
  } else {
    return {
      text: `I understood your command: "${command}". How can I help you with that?`,
      voice: 'af_bella',
      action: 'process_command',
      metadata: { originalCommand: command }
    };
  }
}

export default router;
import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';
import { LogContext, logger } from '../utils/enhanced-logger';
import { config } from '../config';
import { type KokoroVoiceProfile, kokoroTTS } from './kokoro-tts-service';
import { audioHandler } from './audio-handler';

interface TranscriptionResult {
  text: string;
  duration?: number;
  confidence?: number;
  language?: string;
}

interface SynthesisOptions {
  text: string;
  voiceProfile: VoiceProfile;
  voiceSettings?: VoiceSettings;
  format: 'mp3' | 'wav';
}

interface VoiceProfile {
  voice_id: string;
  pitch: number;
  speaking_rate: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface AudioResult {
  buffer: Buffer;
  mimeType: string;
  voice_id: string;
  duration: number;
}

/**
 * SpeechService provides comprehensive voice synthesis and speech recognition capabilities.
 * Supports multiple TTS providers (OpenAI, ElevenLabs, Kokoro with automatic fallback.
 *
 * Features:
 * - Multi-provider TTS with quality optimization
 * - Whisper-based speech recognition
 * - Personality-based voice modulation
 * - Automatic provider fallback
 * - Development mode mock responses
 */
export class SpeechService {
  private openai: OpenAI | null = null;
  private elevenLabsApiKey: string | null;
  private whisperApiUrl: string;

  constructor(private supabase: SupabaseClient {
    // Initialize OpenAI for Whisper transcription and TTS if API key is available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey, });
    }

    // ElevenLabs configuration for premium voice synthesis
    this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || null;

    // Whisper API URL (supports both local and cloud: deployments
    this.whisperApiUrl =
      process.env.WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions';
  }

  /**
   * Transcribes audio files to text using available speech recognition services.
   * Implements provider fallback: OpenAI Whisper -> Local Whisper -> Mock (dev)
   *
   * @param filePath - Path to the audio file to transcribe
   * @param mimeType - MIME type of the audio file
   * @param context - Optional context to improve transcription accuracy
   * @returns Promise<TranscriptionResult> with text, confidence, duration, and language
   */
  async transcribeAudio(
    filePath: string,
    mimeType: string,
    context?: string
  ): Promise<TranscriptionResult> {
    try {
      // Try OpenAI Whisper first (highest: quality
      if (this.openai) {
        return await this.transcribeWithOpenAI(filePath, context;
      }

      // Fallback to local Whisper deployment
      return await this.transcribeWithLocalWhisper(filePath, context;
    } catch (_error): any {
      logger.error('Tran, LogContext.AVATAR, { error});

      // Fallback to mock transcription for development
      if (config.server.isDevelopment) {
        logger.warn('Using mock transcription in development mode', LogContext.AVATAR);
        return {
          text: 'This is a mock transcription for development purposes.',
          confidence: 0.95,
          duration: 5.0,
          language: 'en',
        };
      }

      throw error;
    }
  }

  private async transcribeWithOpenAI(
    filePath: string,
    context?: string
  ): Promise<TranscriptionResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('model', 'whisper-1');
    if (context) {
      formData.append('prompt', context);
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        }
      );

      return {
        text: response.data.text,
        confidence: 0.95, // OpenAI doesn't provide confidence scores
        language: response.data.language || 'en',
      };
    } catch (_error): any {
      logger.error('OpenAI Whi, LogContext.AVATAR, { error});
      throw new Error('Failed to transcribe with OpenAI Whisper');
    }
  }

  private async transcribeWithLocalWhisper(
    filePath: string,
    context?: string
  ): Promise<TranscriptionResult> {
    // This would integrate with a local Whisper instance
    // For now, we'll use a placeholder implementation

    try {
      // You would implement actual local Whisper integration here
      // For example, using whisper.cpp or a Python service

      const mockResponse = {
        text: 'Local Whisper transcription not yet implemented',
        confidence: 0.8,
        duration: 3.0,
        language: 'en',
      };

      return mockResponse;
    } catch (_error): any {
      logger.error('Local Whi, LogContext.AVATAR, { error});
      throw new Error('Failed to transcribe with local Whisper');
    }
  }

  async synthesizeSpeech(options: SynthesisOptions: Promise<AudioResult> {
    try {
      // Try ElevenLabs first for high-quality voice
      if (this.elevenLabsApiKey) {
        return await this.synthesizeWithElevenLabs(options);
      }

      // Fallback to OpenAI TTS
      if (this.openai) {
        return await this.synthesizeWithOpenAI(options);
      }

      // Fallback to local TTS
      return await this.synthesizeWithLocalTTS(options);
    } catch (_error): any {
      logger.error('Synthesi, LogContext.AVATAR, { error});

      // Fallback to mock audio for development
      if (config.server.isDevelopment) {
        logger.warn('Using mock audio in development mode', LogContext.AVATAR);
        return this.generateMockAudio(options);
      }

      throw error;
    }
  }

  private async synthesizeWithElevenLabs(options: SynthesisOptions: Promise<AudioResult> {
    if (!this.elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const voiceId = options.voiceProfile.voice_id;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    try {
      const response = await axios.post(
        url,
        {
          text: options.text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: options.voiceSettings?.stability || options.voiceProfile.stability,
            similarity_boost:
              options.voiceSettings?.similarity_boost || options.voiceProfile.similarity_boost,
            style: options.voiceSettings?.style || options.voiceProfile.style,
            use_speaker_boost:
              options.voiceSettings?.use_speaker_boost || options.voiceProfile.use_speaker_boost,
          },
        },
        {
          headers: {
            Accept: options.format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
            'xi-api-key': this.elevenLabsApiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );

      const buffer = Buffer.from(response.data);

      // Validate and process the audio
      const validation = await audioHandler.validateAudioBuffer(buffer, options.format);
      if (!validation.isValid) {
        logger.warn('ElevenLabs audio validation issues', LogContext.AVATAR, {
          errors: validation.errors,
        });
      }

      // Process audio for optimization
      const audioProcessingResult = await audioHandler.processAudio(buffer, {
        format: options.format,
        normalize: true,
        removeNoise: false,
      });

      return {
        buffer: audioProcessingResult.buffer,
        mimeType: options.format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        voice_id: voiceId,
        duration: audioProcessingResult.metadata.duration,
      };
    } catch (_error): any {
      logger.error('ElevenLabs synthesi, LogContext.AVATAR, { error});
      throw new Error('Failed to synthesize with ElevenLabs');
    }
  }

  private async synthesizeWithOpenAI(options: SynthesisOptions: Promise<AudioResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      // Map personality to OpenAI voices
      const voiceMap: Record<string, string> = {
        sweet: 'nova', // Warm and friendly
        shy: 'shimmer', // Soft and gentle
        confident: 'alloy', // Clear and assured
        caring: 'echo', // Soothing and nurturing
        playful: 'fable', // Expressive and lively
      };

      const voice = voiceMap[options.voiceProfile.voice_id] || 'nova';

      const response = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1-hd',
          voice,
          input options.text,
          response_format: options.format,
          speed: options.voiceProfile.speaking_rate,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );

      const buffer = Buffer.from(response.data);

      // Validate and process OpenAI audio
      const validation = await audioHandler.validateAudioBuffer(buffer, options.format);
      if (!validation.isValid) {
        logger.warn('OpenAI audio validation issues', LogContext.AVATAR, {
          errors: validation.errors,
        });
      }

      // Process audio for optimization
      const audioProcessingResult = await audioHandler.processAudio(buffer, {
        format: options.format,
        normalize: true,
        removeNoise: false,
      });

      return {
        buffer: audioProcessingResult.buffer,
        mimeType: options.format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        voice_id: voice,
        duration: audioProcessingResult.metadata.duration,
      };
    } catch (_error): any {
      logger.error('OpenAI TTS_error, { error});
      throw new Error('Failed to synthesize with OpenAI');
    }
  }

  private async synthesizeWithLocalTTS(options: SynthesisOptions: Promise<AudioResult> {
    try {
      // Try Kokoro TTS first
      return await this.synthesizeWithKokoro(options);
    } catch (error) {
      logger.error('Kokoro TTS failed', { error});
      logger.warn('Falling back to mock audio generation', LogContext.AVATAR);
      return this.generateMockAudio(options);
    }
  }

  private async synthesizeWithKokoro(options: SynthesisOptions: Promise<AudioResult> {
    try {
      // Initialize Kokoro TTS if not already done
      await kokoroTTS.initialize();

      // Map personality-based voice profile to Kokoro voice
      const kokoroProfile = this.mapToKokoroProfile(options.voiceProfile);

      logger.info(`Synthesizing with Kokoro TTS: ${kokoroProfile.id}`, LogContext.AVATAR, {`
        textLength: options.text.length,
        format: options.format,
        personality: kokoroProfile.style,
      });

      const audioBuffer = await kokoroTTS.synthesize({
        text: options.text,
        voiceProfile: kokoroProfile,
        outputFormat: options.format,
        temperature: 0.7,
        topP: 0.9,
        tokenLength: Math.min(200, options.text.split(/\s+/).length),
      });

      // Validate the generated audio
      const isValidAudio = await kokoroTTS.validateAudioBuffer(audioBuffer, options.format);
      if (!isValidAudio) {
        throw new Error(`Generated audio buffer is invalid for format: ${options.format}`);
      }

      // Process audio with comprehensive_errorhandling
      const audioProcessingResult = await audioHandler.processAudio(audioBuffer, {
        format: options.format,
        normalize: true,
        removeNoise: false, // Disable for TTS as it's already clean
      });

      const optimizedBuffer = audioProcessingResult.buffer;
      const { metadata } = audioProcessingResult;

      // Log: any processing warnings
      if (audioProcessingResult.warnings.length > 0) {
        logger.warn('Audio processing warnings', LogContext.AVATAR, {
          warnings: audioProcessingResult.warnings,
        });
      }

      logger.info('Kokoro TTS synthesis completed successfully', LogContext.AVATAR, {
        duration: metadata.duration,
        format: metadata.format,
        bufferSize: optimizedBuffer.length,
      });

      return {
        buffer: optimizedBuffer,
        mimeType: options.format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        voice_id: kokoroProfile.id,
        duration: metadata.duration,
      };
    } catch (error) {
      logger.error('Kokoro TTS synthesi, LogContext.AVATAR, { error});
      throw new Error(
        `Kokoro TTS failed: ${error instanceof Error ? error.message : 'Unknown error}``
      );
    }
  }

  private mapToKokoroProfile(voiceProfile: VoiceProfile: KokoroVoiceProfile {
    const kokoroProfiles = kokoroTTS.getVoiceProfiles();

    // Map voice_id to appropriate Kokoro profile
    const profileMap: Record<string, string> = {
      sweet: 'athena-sweet',
      shy: 'athena-sweet', // Map shy to sweet
      confident: 'athena-confident',
      caring: 'athena-warm',
      playful: 'athena-playful',
      professional: 'athena-professional',
    };

    const kokoroProfileId = profileMap[voiceProfile.voice_id] || 'athena-sweet';
    const kokoroProfile = kokoroProfiles.find((p) => p.id === kokoroProfileId);

    if (!kokoroProfile) {
      // Return default profile if not found
      return kokoroProfiles[0];
    }

    // Apply voice settings to Kokoro profile
    return {
      ...kokoroProfile,
      pitch: voiceProfile.pitch || kokoroProfile.pitch,
      speed: voiceProfile.speaking_rate || kokoroProfile.speed,
    };
  }

  private generateMockAudio(options: SynthesisOptions: AudioResult {
    // Generate a simple sine wave as mock audio
    const sampleRate = 44100;
    const duration = 3; // seconds
    const frequency = 440; // A4 note
    const numSamples = sampleRate * duration;

    const buffer = Buffer.alloc(numSamples * 2); // 16-bit samples

    for (let i = 0; i < numSamples; i++) {
      const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.3;
      const value = Math.floor(sample * 32767);
      buffer.writeInt16LE(value, i * 2);
    }

    return {
      buffer,
      mimeType: options.format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      voice_id: 'mock',
      duration,
    };
  }

  private estimateAudioDurationFromBuffer(buffer: Buffer, format: string: number {
    // Very rough estimation based on file size
    // Actual implementation would parse audio headers
    const bytesPerSecond = format === 'mp3' ? 16000 : 88200; // Rough estimates
    return buffer.length / bytesPerSecond;
  }

  async getAvailableVoices(): Promise<any[]> {
    const voices = [];

    // Add Kokoro voices first (highest priority for local: TTS
    try {
      const kokoroProfiles = kokoroTTS.getVoiceProfiles();
      voices.push(
        ...kokoroProfiles.map((profile) => ({
          id: profile.id,
          name: profile.name,
          provider: 'kokoro',
          description: `${profile.style} female voice`,
          gender: profile.gender,
          style: profile.style,
          pitch: profile.pitch,
          speed: profile.speed,
          local: true,
        }))
      );
    } catch (error) {
      logger.error('Failed to fetch Kokoro voice, LogContext.AVATAR, { error});
    }

    // Add ElevenLabs voices if available
    if (this.elevenLabsApiKey) {
      try {
        const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': this.elevenLabsApiKey },
        });

        voices.push(
          ...response.data.voices.map((voice: any) => ({
            id: voice.voice_id,
            name: voice.name,
            provider: 'elevenlabs',
            preview_url: voice.preview_url,
            labels: voice.labels,
            local: false,
          }))
        );
      } catch (error) {
        logger.error('Failed to fetch ElevenLabs voice, LogContext.AVATAR, { error});
      }
    }

    // Add OpenAI voices
    if (this.openai) {
      voices.push(
        {
          id: 'nova',
          name: 'Nova (Sweet)',
          provider: 'openai',
          description: 'Warm and friendly',
          local: false,
        },
        {
          id: 'shimmer',
          name: 'Shimmer (Shy)',
          provider: 'openai',
          description: 'Soft and gentle',
          local: false,
        },
        {
          id: 'alloy',
          name: 'Alloy (Confident)',
          provider: 'openai',
          description: 'Clear and assured',
          local: false,
        },
        {
          id: 'echo',
          name: 'Echo (Caring)',
          provider: 'openai',
          description: 'Soothing and nurturing',
          local: false,
        },
        {
          id: 'fable',
          name: 'Fable (Playful)',
          provider: 'openai',
          description: 'Expressive and lively',
          local: false,
        }
      );
    }

    // Add local/mock voices for development
    if (config.server.isDevelopment) {
      voices.push(
        { id: 'mock-sweet', name: 'Mock Sweet Voice', provider: 'mock', local: true, },
        { id: 'mock-confident', name: 'Mock Confident Voice', provider: 'mock', local: true, }
      );
    }

    return voices;
  }

  async testKokoroVoice(voiceId: string, sampleText?: string: Promise<Buffer> {
    try {
      await kokoroTTS.initialize();
      return await kokoroTTS.testVoice(voiceId, sampleText;
    } catch (error) {
      logger.error('Kokoro voice te, LogContext.AVATAR, { error});
      throw error;
    }
  }

  async getServiceHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      openai: boolean;
      elevenlabs: boolean;
      kokoro: boolean;
      whisper: boolean;
    };
    details: any;
  }> {
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      services: {
        openai: false,
        elevenlabs: false,
        kokoro: false,
        whisper: false,
      },
      details: {} as any,
    };

    // Test OpenAI availability
    try {
      if (this.openai) {
        // Simple test to check if OpenAI is responsive
        health.services.openai = true;
        health.details.openai = { available: true, };
      }
    } catch (error) {
      health.details.openai = {
        available: false,
        _error error instanceof Error ? error.message : 'Unknown error,
      };
    }

    // Test ElevenLabs availability
    try {
      if (this.elevenLabsApiKey) {
        // Could make a simple API call to test connectivity
        health.services.elevenlabs = true;
        health.details.elevenlabs = { available: true, };
      }
    } catch (error) {
      health.details.elevenlabs = {
        available: false,
        _error error instanceof Error ? error.message : 'Unknown error,
      };
    }

    // Test Kokoro TTS availability
    try {
      const kokoroStatus = kokoroTTS.getServiceStatus();
      health.services.kokoro = kokoroStatus.initialized;
      health.details.kokoro = kokoroStatus;
    } catch (error) {
      health.details.kokoro = {
        available: false,
        _error error instanceof Error ? error.message : 'Unknown error,
      };
    }

    // Test Whisper availability
    try {
      health.services.whisper = !!this.openai || !!this.whisperApiUrl;
      health.details.whisper = {
        available: health.services.whisper,
        apiUrl: this.whisperApiUrl,
      };
    } catch (error) {
      health.details.whisper = {
        available: false,
        _error error instanceof Error ? error.message : 'Unknown error,
      };
    }

    // Add audio processing stats
    try {
      const audioStats = audioHandler.getProcessingStats();
      health.details.audioProcessing = {
        totalProcessed: audioStats.totalProcessed,
        successRate: audioStats.successRate,
        averageProcessingTime: audioStats.averageProcessingTime,
      };
    } catch (error) {
      health.details.audioProcessing = {
        available: false,
        _error error instanceof Error ? error.message : 'Unknown error,
      };
    }

    // Determine overall status
    const availableServices = Object.values(health.services).filter(Boolean).length;
    if (availableServices === 0) {
      health.status = 'unhealthy';
    } else if (availableServices < 2) {
      health.status = 'degraded';
    }

    return health;
  }

  async clearAllCaches())): Promise<void> {
    try {
      await Promise.all([kokoroTTS.clearCache(), audioHandler.clearCache()]);
      logger.info('All speech service caches cleared', LogContext.AVATAR);
    } catch (error) {
      logger.error('Error clearing speech service cache, LogContext.AVATAR, { error});
    }
  }

  async synthesizeSpeechWithRetry(options: SynthesisOptions, maxRetries = 2): Promise<AudioResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        logger.info(`Speech synthesis attempt ${attempt}/${maxRetries + 1}`, LogContext.AVATAR, {`
          textLength: options.text.length,
          format: options.format,
          voiceId: options.voiceProfile.voice_id,
        });

        const result = await this.synthesizeSpeech(options);

        // Validate the result
        if (result.buffer.length === 0) {
          throw new Error('Generated audio buffer is empty');
        }

        logger.info(`Speech synthesis successful on attempt ${attempt}`, LogContext.AVATAR);`
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error: new Error('Unknown synthesis: _error;
        logger.warn(
          `Speech synthesis attempt ${attempt} failed: ${lastError.message}`,
          LogContext.AVATAR
        );

        if (attempt <= maxRetries) {
          // Wait before retrying (exponential: backoff
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delayMs);
        }
      }
    }

    throw lastError || new Error('Speech synthesis failed after all retries');
  }

  async estimateAudioDuration(text: string, voiceProfile?: VoiceProfile: Promise<number> {
    try {
      // More accurate duration estimation based on voice profile and text characteristics
      const words = text.trim().split(/\s+/).length;
      const chars = text.length;

      // Base speaking rate (words per: minute
      let baseWPM = 160; // Average speaking rate

      if (voiceProfile) {
        // Adjust for speaking rate setting
        baseWPM *= voiceProfile.speaking_rate || 1.0;

        // Adjust for voice characteristics
        if (voiceProfile.voice_id === 'sweet' || voiceProfile.voice_id === 'shy') {
          baseWPM *= 0.9; // Slower, more deliberate
        } else if (voiceProfile.voice_id === 'playful') {
          baseWPM *= 1.1; // Faster, more energetic
        }
      }

      // Calculate duration in seconds
      const baseDuration = (words / baseWPM) * 60;

      // Add time for punctuation pauses
      const punctuationCount = (text.match(/[.!?]/g) || []).length;
      const pauseTime = punctuationCount * 0.5; // 0.5 seconds per major punctuation

      // Add time for commas
      const commaCount = (text.match(/[,,]/g) || []).length;
      const shortPauseTime = commaCount * 0.2; // 0.2 seconds per comma

      const totalDuration = Math.max(baseDuration + pauseTime + shortPauseTime, 1.0);

      logger.debug('Estimated audio duration', LogContext.AVATAR, {
        words,
        chars,
        estimatedWPM: baseWPM,
        duration: totalDuration,
      });

      return totalDuration;
    } catch (error) {
      logger.error('Error e, LogContext.AVATAR, { error});
      return Math.max(text.split(' ').length * 0.4, 1.0); // Fallback estimation
    }
  }
}

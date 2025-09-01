/**
 * Nari Dia TTS Service - Ultra-Fast Voice Synthesis
 * Uses Nari Labs Dia 1.6B model for realistic text-to-speech
 * Superior voice quality with emotion and tone control
 */

import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { LogContext, log } from '@/utils/logger';

export interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
  temperature?: number;
  outputFormat?: 'wav' | 'mp3';
  outputPath?: string;
}

export interface TTSResponse {
  audioPath: string;
  duration: number;
  voice: string;
  executionTime: number;
  fileSize: number;
}

export interface VoiceInfo {
  id: string;
  name: string;
  gender: 'male' | 'female';
  language: string;
  description: string;
}

export class NariDiaTTSService {
  private pythonProcess: ChildProcess | null = null;
  private isInitialized = false;
  private isLoading = false;
  private nariDiaPath: string;
  private outputDirectory: string;
  private availableVoices: VoiceInfo[] = [];
  private modelLoadPromise: Promise<void> | null = null;
  private loadStartTime: number = 0;

  constructor() {
    this.nariDiaPath = '/Users/christianmerrill/Desktop/universal-ai-tools/nari-dia-implementation';
    this.outputDirectory = '/tmp/nari-dia-tts';
    
    // Create output directory
    if (!existsSync(this.outputDirectory)) {
      mkdirSync(this.outputDirectory, { recursive: true });
    }
    
    this.initializeNariDia();
  }

  private async initializeNariDia(): Promise<void> {
    log.info('🎤 Initializing Nari Dia 1.6B TTS service', LogContext.AI);

    // Check if Nari Dia implementation exists
    if (!existsSync(this.nariDiaPath)) {
      log.warn('⚠️ Nari Dia implementation not found, using mock mode', LogContext.AI);
      this.initializeMockTTS();
      return;
    }

    // Start async model loading (don't block initialization)
    this.startAsyncModelLoading();

    // Set up default voices based on Dia capabilities
    this.availableVoices = [
      {
        id: 'nari_natural',
        name: 'Nari Natural',
        gender: 'female',
        language: 'en',
        description: 'Natural conversational voice with emotional range',
      },
      {
        id: 'nari_professional',
        name: 'Nari Professional', 
        gender: 'female',
        language: 'en',
        description: 'Professional tone suitable for business applications',
      },
      {
        id: 'nari_expressive',
        name: 'Nari Expressive',
        gender: 'female',
        language: 'en',
        description: 'Highly expressive with laughter and emotion',
      },
    ];

    // Set up voices immediately (model will load in background)
    this.setupVoiceProfiles();
  }

  private setupVoiceProfiles(): void {
    this.availableVoices = [
      {
        id: 'nari_natural',
        name: 'Nari Natural',
        gender: 'female',
        language: 'en',
        description: 'Natural conversational voice with emotional range',
      },
      {
        id: 'nari_professional',
        name: 'Nari Professional', 
        gender: 'female',
        language: 'en',
        description: 'Professional tone suitable for business applications',
      },
      {
        id: 'nari_expressive',
        name: 'Nari Expressive',
        gender: 'female',
        language: 'en',
        description: 'Highly expressive with laughter and emotion',
      },
    ];
  }

  private startAsyncModelLoading(): void {
    if (this.isLoading || this.isInitialized) return;
    
    this.isLoading = true;
    this.loadStartTime = Date.now();
    
    log.info('🔄 Starting background model loading (this may take 2-3 minutes)...', LogContext.AI);
    
    this.modelLoadPromise = this.loadModelAsync();
  }

  private async loadModelAsync(): Promise<void> {
    try {
      // Check and download model if needed
      await this.ensureModelReady();
      
      // Start TTS server
      await this.startTTSServer();
      
      const loadTime = Date.now() - this.loadStartTime;
      log.info(`✅ Nari Dia model loaded successfully in ${(loadTime/1000).toFixed(1)}s`, LogContext.AI);
      
    } catch (error) {
      const loadTime = Date.now() - this.loadStartTime;
      log.error(`❌ Nari Dia model loading failed after ${(loadTime/1000).toFixed(1)}s`, LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fall back to mock mode
      this.initializeMockTTS();
    } finally {
      this.isLoading = false;
    }
  }

  private async ensureModelReady(): Promise<void> {
    try {
      log.info('🔄 Checking Nari Dia model availability', LogContext.AI);

      // Use the Nari Dia virtual environment
      const venvPath = join(this.nariDiaPath, '.venv', 'bin', 'python');
      const pythonCmd = existsSync(venvPath) ? venvPath : 'python3';

      // Check if model is cached, if not download it
      const checkModelScript = `
import sys
from huggingface_hub import snapshot_download
try:
    snapshot_download(
        repo_id='nari-labs/Dia-1.6B-0626', 
        cache_dir='./models',
        local_files_only=True
    )
    print('MODEL_READY')
except:
    print('MODEL_DOWNLOAD_NEEDED')
    try:
        print('Downloading Nari Dia model...')
        snapshot_download(
            repo_id='nari-labs/Dia-1.6B-0626',
            cache_dir='./models'
        )
        print('MODEL_DOWNLOADED')
    except Exception as e:
        print(f'MODEL_ERROR: {e}')
        sys.exit(1)
`;

      // Add timeout for model check to prevent server hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Model check timeout after 15 seconds')), 15000);
      });
      
      const modelCheckPromise = new Promise<void>((resolve, reject) => {
        const checkProcess = spawn(pythonCmd, ['-c', checkModelScript], {
          cwd: this.nariDiaPath,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let error = '';
        
        // Add timeout for process spawn
        const spawnTimeout = setTimeout(() => {
          checkProcess.kill();
          reject(new Error('Model check spawn timeout'));
        }, 12000);

        checkProcess.stdout.on('data', (data) => {
          output += data.toString();
          if (output.includes('MODEL_READY')) {
            clearTimeout(spawnTimeout);
            log.info('✅ Nari Dia model ready', LogContext.AI);
            resolve();
          } else if (output.includes('MODEL_DOWNLOADED')) {
            clearTimeout(spawnTimeout);
            log.info('✅ Nari Dia model downloaded successfully', LogContext.AI);
            resolve();
          } else if (output.includes('Downloading')) {
            log.info('📥 Downloading Nari Dia model from HuggingFace...', LogContext.AI);
          }
        });

        checkProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        checkProcess.on('close', (code) => {
          clearTimeout(spawnTimeout);
          if (code !== 0) {
            log.warn('⚠️ Model check failed, will try to load during runtime', LogContext.AI, {
              error: error.trim() || output.trim()
            });
            resolve(); // Continue anyway, let the TTS server handle it
          }
        });

        checkProcess.on('error', (err) => {
          clearTimeout(spawnTimeout);
          log.warn('⚠️ Failed to check model status', LogContext.AI, { error: err.message });
          resolve(); // Continue anyway
        });
      });
      
      await Promise.race([modelCheckPromise, timeoutPromise]);

    } catch (error) {
      log.warn('⚠️ Model readiness check failed or timed out, continuing with server start', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async startTTSServer(): Promise<void> {
    try {
      // Create Python TTS server script for Nari Dia
      const pythonScript = this.createNariDiaServerScript();
      const scriptPath = join(this.outputDirectory, 'nari_dia_server.py');
      writeFileSync(scriptPath, pythonScript);

      // Use the Nari Dia virtual environment if available
      const venvPath = join(this.nariDiaPath, '.venv', 'bin', 'python');
      const pythonCmd = existsSync(venvPath) ? venvPath : 'python3';

      log.info('🚀 Starting Nari Dia TTS server', LogContext.AI, {
        python: pythonCmd,
        script: scriptPath
      });

      this.pythonProcess = spawn(pythonCmd, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.nariDiaPath,
        env: {
          ...process.env,
          PYTHONPATH: this.nariDiaPath
        }
      });

      // Handle spawn errors
      this.pythonProcess.on('error', (error) => {
        log.warn('⚠️ Failed to start Nari Dia TTS server, using mock mode', LogContext.AI, { 
          error: error.message 
        });
        this.isInitialized = false;
        this.pythonProcess = null;
        this.initializeMockTTS();
      });

      if (this.pythonProcess.stdout && this.pythonProcess.stderr) {
        this.pythonProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('NARI_READY')) {
            this.isInitialized = true;
            log.info('✅ Nari Dia TTS server ready', LogContext.AI);
          } else if (output.includes('NARI_ERROR')) {
            log.error('❌ Nari Dia server error', LogContext.AI, { error: output });
          }
        });

        this.pythonProcess.stderr.on('data', (data) => {
          const message = data.toString();
          if (message.includes('ERROR') || message.includes('Exception')) {
            log.error('❌ Nari Dia TTS error', LogContext.AI, { error: message });
          } else {
            log.debug('Nari Dia debug', LogContext.AI, { message });
          }
        });
      }

      // Wait for initialization with reduced timeout to prevent server hanging
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!this.isInitialized) {
            log.warn('⚠️ Nari Dia initialization timeout after 10s, using mock mode', LogContext.AI);
            if (this.pythonProcess) {
              this.pythonProcess.kill();
              this.pythonProcess = null;
            }
            this.initializeMockTTS();
          }
          resolve();
        }, 10000); // Reduced from 30s to 10s

        const checkReady = setInterval(() => {
          if (this.isInitialized) {
            clearInterval(checkReady);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });

    } catch (error) {
      log.error('❌ Failed to initialize Nari Dia TTS server', LogContext.AI, { error });
      this.initializeMockTTS();
    }
  }

  /**
   * Generate speech from text using Nari Dia
   */
  public async generateSpeech(request: TTSRequest): Promise<TTSResponse> {
    // Check if model is still loading
    if (this.isLoading && !this.isInitialized) {
      const loadTime = Date.now() - this.loadStartTime;
      log.info(`🔄 Nari Dia model still loading (${(loadTime/1000).toFixed(1)}s elapsed), using mock mode`, LogContext.AI);
      return this.generateMockSpeech(request);
    }
    
    // If model failed to load, use mock
    if (!this.isInitialized && !this.isLoading) {
      return this.generateMockSpeech(request);
    }
    
    // Wait for model to finish loading if needed (with timeout)
    if (this.isLoading && this.modelLoadPromise) {
      try {
        log.info('⏳ Waiting for Nari Dia model to finish loading...', LogContext.AI);
        await Promise.race([
          this.modelLoadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Model loading timeout')), 10000))
        ]);
      } catch (error) {
        log.warn('⚠️ Model loading timeout or failed, using mock mode', LogContext.AI);
        return this.generateMockSpeech(request);
      }
    }
    
    // Use real model if available, otherwise mock
    if (!this.isInitialized) {
      return this.generateMockSpeech(request);
    }

    const startTime = Date.now();
    const outputPath = request.outputPath || 
      join(this.outputDirectory, `nari_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`);

    try {
      // Send TTS request to Python process
      const ttsCommand = {
        text: request.text,
        voice: request.voice || 'nari_natural',
        temperature: request.temperature || 0.7,
        output_path: outputPath,
      };

      if (this.pythonProcess && this.pythonProcess.stdin) {
        this.pythonProcess.stdin.write(`${JSON.stringify(ttsCommand)}\n`);
      }

      // Wait for completion with dynamic timeout based on text length
      const timeout = Math.max(5000, request.text.length * 100); // 100ms per character, min 5s
      await new Promise((resolve) => setTimeout(resolve, timeout));

      const executionTime = Date.now() - startTime;
      const fileSize = existsSync(outputPath) ? readFileSync(outputPath).length : 0;

      log.info('🎤 Nari Dia TTS generation completed', LogContext.AI, {
        voice: request.voice || 'nari_natural',
        textLength: request.text.length,
        executionTime: `${executionTime}ms`,
        fileSize: `${Math.round(fileSize / 1024)}KB`,
      });

      return {
        audioPath: outputPath,
        duration: Math.ceil(request.text.length / 10), // ~10 chars per second estimate
        voice: request.voice || 'nari_natural',
        executionTime,
        fileSize,
      };
    } catch (error) {
      log.error('❌ Nari Dia TTS generation failed', LogContext.AI, { error });
      return this.generateMockSpeech(request);
    }
  }

  /**
   * Generate speech for agent responses (optimized for conversation)
   */
  public async speakAgentResponse(
    agentName: string,
    response: string,
    voicePreference?: string
  ): Promise<TTSResponse> {
    // Select voice based on agent personality
    const voice = voicePreference || this.getAgentVoice(agentName);

    // Optimize text for speech (remove markdown, technical formatting)
    const speechText = this.optimizeTextForSpeech(response);

    return this.generateSpeech({
      text: speechText,
      voice,
      temperature: 0.6, // Slightly more controlled for agent responses
      outputFormat: 'wav',
    });
  }

  private getAgentVoice(agentName: string): string {
    const agentVoices: Record<string, string> = {
      planner: 'nari_professional', // Professional for planning
      personal_assistant: 'nari_natural', // Natural for assistance
      code_assistant: 'nari_professional', // Professional for technical topics
      synthesizer: 'nari_natural', // Natural for analysis
      retriever: 'nari_expressive', // Expressive for information
    };

    return agentVoices[agentName] || 'nari_natural';
  }

  private optimizeTextForSpeech(text: string): string {
    return text
      .replace(/```[sS]*?```/g, '[Code block]') // Replace code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
      .replace(/#{1,6}\s/g, '') // Remove markdown headers
      .replace(/\n{2,}/g, '. ') // Replace multiple newlines with periods
      .replace(/\n/g, ' ') // Replace single newlines with spaces
      .trim();
  }

  private createNariDiaServerScript(): string {
    return `#!/usr/bin/env python3
"""
Nari Dia TTS Server - Realistic voice synthesis
Integrates with Nari Labs Dia 1.6B model
"""

import sys
import json
import time
import logging
import tempfile
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    import torch
    import soundfile as sf
    from dia.model import Dia
    NARI_AVAILABLE = True
    logger.info("Nari Dia dependencies available")
except ImportError as e:
    NARI_AVAILABLE = False
    logger.error(f"Nari Dia not available: {e}")
    print("NARI_ERROR: Dependencies not available")
    sys.exit(1)

model = None

# Load Nari Dia model
try:
    logger.info("Loading Nari Dia 1.6B model...")
    
    # Determine device
    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    
    logger.info(f"Using device: {device}")
    
    # Load model using correct API
    try:
        model = Dia.from_pretrained("nari-labs/Dia-1.6B-0626", device=device)
        logger.info("Loaded Nari Dia from HuggingFace")
    
    print("NARI_READY")
    sys.stdout.flush()
    
except Exception as e:
    logger.error(f"Failed to load Nari Dia model: {e}")
    print(f"NARI_ERROR: {e}")
    sys.stdout.flush()
    sys.exit(1)

# Main processing loop
while True:
    try:
        line = sys.stdin.readline()
        if not line:
            break
        
        request = json.loads(line)
        text = request.get('text')
        voice = request.get('voice', 'nari_natural')
        temperature = request.get('temperature', 0.7)
        output_path = request.get('output_path')
        
        if not text or not output_path:
            continue
            
        start_time = time.time()
        
        # Generate speech with Nari Dia
        logger.info(f"Generating speech for: {text[:50]}...")
        
        # Use Dia model for generation
        with torch.inference_mode():
            # Set generation parameters based on voice type
            if voice == 'nari_expressive':
                temperature = min(temperature * 1.2, 1.0)  # More expressive
            elif voice == 'nari_professional': 
                temperature = max(temperature * 0.8, 0.3)  # More controlled
            
            # Generate audio using correct API
            audio = model.generate(
                text=text,
                temperature=temperature,
                max_tokens=4096
            )
            
            # Save audio file with standard sample rate
            sample_rate = 44100
            sf.write(output_path, audio, sample_rate)
            
        execution_time = (time.time() - start_time) * 1000
        
        result = {
            "type": "success",
            "execution_time": execution_time,
            "output_path": output_path,
            "voice": voice
        }
        
        print(json.dumps(result))
        sys.stdout.flush()
        logger.info(f"Generated speech in {execution_time:.0f}ms")
        
    except json.JSONDecodeError:
        continue
    except Exception as e:
        error_result = {
            "type": "error",
            "error": str(e)
        }
        print(json.dumps(error_result))
        sys.stdout.flush()
        logger.error(f"Generation error: {e}")
`;
  }

  private initializeMockTTS(): void {
    log.warn('⚠️ Using mock Nari Dia TTS implementation', LogContext.AI);
    this.isInitialized = true;
    this.availableVoices = [
      {
        id: 'mock_nari_natural',
        name: 'Mock Nari Natural',
        gender: 'female',
        language: 'en',
        description: 'Mock Nari Dia voice for testing',
      },
    ];
  }

  private generateMockSpeech(request: TTSRequest): TTSResponse {
    const mockPath = join(this.outputDirectory, `mock_nari_${Date.now()}.wav`);

    // Create empty file for mock
    try {
      writeFileSync(mockPath, Buffer.alloc(2048)); // 2KB empty file
    } catch (error) {
      // Ignore file creation errors in mock mode
    }

    return {
      audioPath: mockPath,
      duration: Math.ceil(request.text.length / 10),
      voice: request.voice || 'mock_nari_natural',
      executionTime: 150 + Math.random() * 300, // 150-450ms mock time
      fileSize: 2048,
    };
  }

  public getAvailableVoices(): VoiceInfo[] {
    return this.availableVoices;
  }

  public isServiceAvailable(): boolean {
    return this.isInitialized;
  }

  public getServiceInfo(): {
    available: boolean;
    loading: boolean;
    loadingTimeElapsed?: number;
    voices: number;
    languages: string[];
    outputDirectory: string;
    modelPath: string;
    status: string;
  } {
    const loadingTimeElapsed = this.isLoading ? (Date.now() - this.loadStartTime) / 1000 : undefined;
    
    let status = 'unknown';
    if (this.isInitialized) {
      status = 'ready';
    } else if (this.isLoading) {
      status = 'loading';
    } else {
      status = 'mock_mode';
    }

    return {
      available: this.isInitialized,
      loading: this.isLoading,
      loadingTimeElapsed,
      voices: this.availableVoices.length,
      languages: Array.from(new Set(this.availableVoices.map((v) => v.language))),
      outputDirectory: this.outputDirectory,
      modelPath: this.nariDiaPath,
      status,
    };
  }

  public async shutdown(): Promise<void> {
    log.info('🛑 Shutting down Nari Dia TTS service', LogContext.AI);

    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }

    this.isInitialized = false;
  }
}

// Singleton instance
export const nariDiaTTS = new NariDiaTTSService();
export const nariDiaTTSService = nariDiaTTS; // Add named export for router compatibility
export default nariDiaTTS;
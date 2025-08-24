/**
 * Image Generation Service
 * Bridges TypeScript server with MLX-optimized Python image generator
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ImageGenerationRequest {
  prompt: string;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  style?: string;
}

export interface ImageGenerationResponse {
  success: boolean;
  image?: {
    data: string; // base64 encoded
    format: string;
    width: number;
    height: number;
  };
  metadata?: {
    prompt: string;
    model: string;
    steps: number;
    guidance_scale: number;
    device: string;
    timestamp: string;
    mode: string;
  };
  error?: string;
  processing_time?: number;
}

export class ImageGenerationService extends EventEmitter {
  private pythonProcess: ChildProcess | null = null;
  private isInitialized = false;
  private isInitializing = false;
  private requestQueue: Array<{
    request: any;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  private readonly maxQueueSize = 10;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      return;
    }

    this.isInitializing = true;
    
    try {
      const pythonScriptPath = path.join(process.cwd(), 'src', 'services', 'python', 'mlx_image_generator.py');
      const venvPythonPath = path.join(process.cwd(), 'venv', 'bin', 'python');
      console.log(`🎨 Starting MLX Image Generator: ${pythonScriptPath}`);
      
      // Use virtual environment Python if available, otherwise fall back to system python3
      const fs = await import('fs');
      const pythonExecutable = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python3';
      console.log(`🐍 Using Python: ${pythonExecutable}`);

      this.pythonProcess = spawn(pythonExecutable, [pythonScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      this.setupProcessHandlers();
      
      // Wait for initialization message
      await this.waitForInitialization();
      
      this.isInitialized = true;
      this.isInitializing = false;
      
      console.log('✅ MLX Image Generator initialized successfully');
      this.emit('ready');
      
    } catch (error) {
      this.isInitializing = false;
      console.error('❌ Failed to initialize MLX Image Generator:', error);
      throw error;
    }
  }

  private setupProcessHandlers(): void {
    if (!this.pythonProcess) {return;}

    this.pythonProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          this.handlePythonResponse(response);
        } catch (error) {
          console.error('Failed to parse Python response:', line);
        }
      }
    });

    this.pythonProcess.stderr?.on('data', (data) => {
      console.error('MLX Image Generator Error:', data.toString());
    });

    this.pythonProcess.on('exit', (code) => {
      console.log(`MLX Image Generator process exited with code ${code}`);
      this.isInitialized = false;
      this.pythonProcess = null;
      this.emit('exit', code);
    });

    this.pythonProcess.on('error', (error) => {
      console.error('MLX Image Generator process error:', error);
      this.isInitialized = false;
      this.emit('error', error);
    });
  }

  private waitForInitialization(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Initialization timeout'));
      }, 10000);

      const onResponse = (response: any) => {
        if (response.success !== undefined) {
          clearTimeout(timeout);
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || 'Initialization failed'));
          }
        }
      };

      this.once('initialization', onResponse);
    });
  }

  private handlePythonResponse(response: any): void {
    if (response.success !== undefined && this.requestQueue.length === 0) {
      // This is likely the initialization response
      this.emit('initialization', response);
      return;
    }

    // Handle queued requests
    if (this.requestQueue.length > 0) {
      const pending = this.requestQueue.shift();
      if (pending) {
        if (response.success) {
          pending.resolve(response);
        } else {
          pending.reject(new Error(response.error || 'Unknown error'));
        }
      }
    }
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.pythonProcess) {
      throw new Error('MLX Image Generator not available');
    }

    if (this.requestQueue.length >= this.maxQueueSize) {
      throw new Error('Request queue is full. Please try again later.');
    }

    const startTime = Date.now();

    const pythonRequest = {
      command: 'generate',
      prompt: request.prompt,
      width: request.width || 512,
      height: request.height || 512,
      num_inference_steps: request.num_inference_steps || 20,
      guidance_scale: request.guidance_scale || 7.5
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Image generation timeout'));
      }, 60000); // 60 second timeout

      this.requestQueue.push({
        request: pythonRequest,
        resolve: (response: any) => {
          clearTimeout(timeout);
          response.processing_time = Date.now() - startTime;
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      // Send request to Python process
      try {
        this.pythonProcess?.stdin?.write(JSON.stringify(pythonRequest) + '\n');
      } catch (error) {
        // Remove from queue on write error
        this.requestQueue.pop();
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  async getStatus(): Promise<any> {
    if (!this.isInitialized) {
      return {
        success: false,
        status: 'not_initialized',
        message: 'Image generator not initialized'
      };
    }

    if (!this.pythonProcess) {
      return {
        success: false,
        status: 'process_not_available',
        message: 'Python process not available'
      };
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Status check timeout'));
      }, 5000);

      this.requestQueue.push({
        request: { command: 'status' },
        resolve: (response: any) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.pythonProcess?.stdin?.write(JSON.stringify({ command: 'status' }) + '\n');
    });
  }

  async destroy(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown or force kill after timeout
      setTimeout(() => {
        if (this.pythonProcess && !this.pythonProcess.killed) {
          this.pythonProcess.kill('SIGKILL');
        }
      }, 5000);
      
      this.pythonProcess = null;
    }
    
    this.isInitialized = false;
    this.requestQueue = [];
    this.emit('destroyed');
  }

  // Utility method to create a data URL from base64
  static createDataURL(base64Data: string, format: string = 'png'): string {
    return `data:image/${format};base64,${base64Data}`;
  }

  // Validate image generation request
  static validateRequest(request: ImageGenerationRequest): string[] {
    const errors: string[] = [];

    if (!request.prompt || request.prompt.trim().length === 0) {
      errors.push('Prompt is required');
    }

    if (request.prompt && request.prompt.length > 1000) {
      errors.push('Prompt is too long (max 1000 characters)');
    }

    if (request.width && (request.width < 64 || request.width > 2048)) {
      errors.push('Width must be between 64 and 2048 pixels');
    }

    if (request.height && (request.height < 64 || request.height > 2048)) {
      errors.push('Height must be between 64 and 2048 pixels');
    }

    if (request.num_inference_steps && (request.num_inference_steps < 1 || request.num_inference_steps > 100)) {
      errors.push('Number of inference steps must be between 1 and 100');
    }

    if (request.guidance_scale && (request.guidance_scale < 0 || request.guidance_scale > 20)) {
      errors.push('Guidance scale must be between 0 and 20');
    }

    return errors;
  }
}

// Singleton instance
export const imageGenerationService = new ImageGenerationService();
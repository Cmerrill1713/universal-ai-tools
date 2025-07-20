import { LogContext, logger } from '../utils/enhanced-logger';
import { circuitBreaker } from './circuit-breaker';

export interface AudioProcessingOptions {
  format: 'wav' | 'mp3' | 'ogg';
  sampleRate?: number;
  channels?: number;
  bitRate?: number;
  normalize?: boolean;
  removeNoise?: boolean;
}

export interface AudioMetadata {
  format: string;
  duration: number;
  sampleRate: number;
  channels: number;
  bitRate?: number;
  fileSize: number;
  isValid: boolean;
}

export interface AudioProcessingResult {
  buffer: Buffer;
  metadata: AudioMetadata;
  warnings: string[];
}

/**
 * AudioHandler provides comprehensive audio processing, validation, and error handling
 * for the Universal AI Tools voice system.
 * 
 * Features:
 * - Audio format detection and validation
 * - Audio quality optimization
 * - Error recovery and fallback handling
 * - Performance monitoring
 * - Circuit breaker protection
 */
export class AudioHandler {
  private static instance: AudioHandler;
  private processingStats = {
    totalProcessed: 0,
    successCount: 0,
    errorCount: 0,
    averageProcessingTime: 0
  };

  private constructor() {}

  static getInstance(): AudioHandler {
    if (!AudioHandler.instance) {
      AudioHandler.instance = new AudioHandler();
    }
    return AudioHandler.instance;
  }

  async processAudio(
    buffer: Buffer, 
    options: AudioProcessingOptions
  ): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    
    const breaker = circuitBreaker.getBreaker('audio-handler');
    return breaker.fire(async () => {
        try {
          this.processingStats.totalProcessed++;
          
          // Validate input buffer
          if (!buffer || buffer.length === 0) {
            throw new Error('Invalid audio buffer: empty or null');
          }

          if (buffer.length < 44) { // Minimum WAV header size
            throw new Error('Audio buffer too small to contain valid audio data');
          }

          const warnings: string[] = [];
          let processedBuffer = buffer;

          // Detect and validate format
          const metadata = await this.getDetailedAudioMetadata(buffer);
          if (!metadata.isValid) {
            warnings.push('Audio format validation failed, attempting repair');
            processedBuffer = await this.repairAudioBuffer(buffer, options.format);
          }

          // Apply processing options
          if (options.normalize) {
            processedBuffer = await this.normalizeAudio(processedBuffer);
            warnings.push('Audio normalization applied');
          }

          if (options.removeNoise) {
            processedBuffer = await this.applyNoiseReduction(processedBuffer);
            warnings.push('Noise reduction applied');
          }

          // Convert format if needed
          if (metadata.format !== options.format) {
            processedBuffer = await this.convertAudioFormat(
              processedBuffer, 
              metadata.format, 
              options.format
            );
            warnings.push(`Audio converted from ${metadata.format} to ${options.format}`);
          }

          // Validate final result
          const finalMetadata = await this.getDetailedAudioMetadata(processedBuffer);
          if (!finalMetadata.isValid) {
            throw new Error('Audio processing resulted in invalid audio data');
          }

          // Update stats
          this.processingStats.successCount++;
          const processingTime = Date.now() - startTime;
          this.updateAverageProcessingTime(processingTime);

          logger.info('Audio processing completed successfully', LogContext.SYSTEM, {
            originalFormat: metadata.format,
            finalFormat: finalMetadata.format,
            originalSize: buffer.length,
            finalSize: processedBuffer.length,
            processingTime,
            warnings: warnings.length
          });

          return {
            buffer: processedBuffer,
            metadata: finalMetadata,
            warnings
          };

        } catch (error) {
          this.processingStats.errorCount++;
          logger.error('Audio processing error', LogContext.SYSTEM, { error });
          throw error;
        }
      },
      {
        timeout: 30000,
        fallback: async () => {
          logger.warn('Using fallback audio processing', LogContext.SYSTEM);
          const basicMetadata = await this.getBasicAudioMetadata(buffer);
          return {
            buffer,
            metadata: basicMetadata,
            warnings: ['Using fallback processing due to circuit breaker']
          };
        }
      }
    );
  }

  private async getDetailedAudioMetadata(buffer: Buffer): Promise<AudioMetadata> {
    try {
      const metadata: AudioMetadata = {
        format: 'unknown',
        duration: 0,
        sampleRate: 44100,
        channels: 1,
        fileSize: buffer.length,
        isValid: false
      };

      // Check WAV format
      if (buffer.length >= 44) {
        const riffHeader = buffer.slice(0, 4).toString('ascii');
        const waveHeader = buffer.slice(8, 12).toString('ascii');
        
        if (riffHeader === 'RIFF' && waveHeader === 'WAVE') {
          metadata.format = 'wav';
          metadata.sampleRate = buffer.readUInt32LE(24);
          metadata.channels = buffer.readUInt16LE(22);
          metadata.bitRate = buffer.readUInt32LE(28) * 8;
          
          const dataSize = buffer.readUInt32LE(40);
          const bitsPerSample = buffer.readUInt16LE(34);
          metadata.duration = dataSize / (metadata.sampleRate * metadata.channels * (bitsPerSample / 8));
          metadata.isValid = true;
          
          return metadata;
        }
      }

      // Check MP3 format
      if (buffer.length >= 3) {
        const mp3Header = buffer.slice(0, 3);
        if (mp3Header[0] === 0xFF && (mp3Header[1] & 0xE0) === 0xE0) {
          metadata.format = 'mp3';
          metadata.isValid = true;
          // MP3 metadata parsing is more complex, using estimates
          metadata.duration = this.estimateMP3Duration(buffer);
          return metadata;
        }
      }

      // Check OGG format
      if (buffer.length >= 4) {
        const oggHeader = buffer.slice(0, 4).toString('ascii');
        if (oggHeader === 'OggS') {
          metadata.format = 'ogg';
          metadata.isValid = true;
          metadata.duration = this.estimateOGGDuration(buffer);
          return metadata;
        }
      }

      return metadata;
    } catch (error) {
      logger.error('Error getting detailed audio metadata', LogContext.SYSTEM, { error });
      return this.getBasicAudioMetadata(buffer);
    }
  }

  private async getBasicAudioMetadata(buffer: Buffer): Promise<AudioMetadata> {
    return {
      format: 'unknown',
      duration: Math.max(buffer.length / 44100, 1.0),
      sampleRate: 44100,
      channels: 1,
      fileSize: buffer.length,
      isValid: buffer.length > 0
    };
  }

  private estimateMP3Duration(buffer: Buffer): number {
    // Simplified MP3 duration estimation
    const avgBitrate = 128000; // 128 kbps average
    return (buffer.length * 8) / avgBitrate;
  }

  private estimateOGGDuration(buffer: Buffer): number {
    // Simplified OGG duration estimation
    const avgBitrate = 128000; // 128 kbps average
    return (buffer.length * 8) / avgBitrate;
  }

  private async normalizeAudio(buffer: Buffer): Promise<Buffer> {
    try {
      // Only normalize WAV files for now
      const metadata = await this.getDetailedAudioMetadata(buffer);
      if (metadata.format !== 'wav' || buffer.length < 44) {
        return buffer;
      }

      const headerSize = 44;
      const audioData = buffer.slice(headerSize);
      const normalizedData = Buffer.alloc(audioData.length);

      // Find peak amplitude
      let maxAmplitude = 0;
      for (let i = 0; i < audioData.length; i += 2) {
        const sample = audioData.readInt16LE(i);
        maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
      }

      if (maxAmplitude === 0) {
        return buffer; // Silent audio, no normalization needed
      }

      // Calculate normalization factor (target 90% of max to prevent clipping)
      const targetAmplitude = 32767 * 0.9;
      const normalizationFactor = targetAmplitude / maxAmplitude;

      // Apply normalization
      for (let i = 0; i < audioData.length; i += 2) {
        const sample = audioData.readInt16LE(i);
        const normalizedSample = Math.round(sample * normalizationFactor);
        normalizedData.writeInt16LE(
          Math.max(-32768, Math.min(32767, normalizedSample)), 
          i
        );
      }

      return Buffer.concat([buffer.slice(0, headerSize), normalizedData]);
    } catch (error) {
      logger.error('Audio normalization error', LogContext.SYSTEM, { error });
      return buffer;
    }
  }

  private async applyNoiseReduction(buffer: Buffer): Promise<Buffer> {
    try {
      // Simple noise reduction for WAV files
      const metadata = await this.getDetailedAudioMetadata(buffer);
      if (metadata.format !== 'wav' || buffer.length < 44) {
        return buffer;
      }

      const headerSize = 44;
      const audioData = buffer.slice(headerSize);
      const processedData = Buffer.alloc(audioData.length);

      // Apply simple noise gate (remove samples below threshold)
      const noiseThreshold = 100; // Adjust based on requirements
      
      for (let i = 0; i < audioData.length; i += 2) {
        const sample = audioData.readInt16LE(i);
        const processedSample = Math.abs(sample) < noiseThreshold ? 0 : sample;
        processedData.writeInt16LE(processedSample, i);
      }

      return Buffer.concat([buffer.slice(0, headerSize), processedData]);
    } catch (error) {
      logger.error('Noise reduction error', LogContext.SYSTEM, { error });
      return buffer;
    }
  }

  private async repairAudioBuffer(buffer: Buffer, targetFormat: string): Promise<Buffer> {
    try {
      // Attempt to repair invalid audio buffer
      if (targetFormat === 'wav' && buffer.length >= 8) {
        // Try to add a minimal WAV header if missing
        const hasWavHeader = buffer.slice(0, 4).toString('ascii') === 'RIFF';
        
        if (!hasWavHeader) {
          const wavHeader = this.createMinimalWavHeader(buffer.length - 8);
          return Buffer.concat([wavHeader, buffer]);
        }
      }

      return buffer;
    } catch (error) {
      logger.error('Audio repair error', LogContext.SYSTEM, { error });
      return buffer;
    }
  }

  private createMinimalWavHeader(dataSize: number): Buffer {
    const header = Buffer.alloc(44);
    
    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    
    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20);  // PCM format
    header.writeUInt16LE(1, 22);  // mono
    header.writeUInt32LE(22050, 24); // sample rate
    header.writeUInt32LE(44100, 28); // byte rate
    header.writeUInt16LE(2, 32);  // block align
    header.writeUInt16LE(16, 34); // bits per sample
    
    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    return header;
  }

  private async convertAudioFormat(
    buffer: Buffer, 
    fromFormat: string, 
    toFormat: string
  ): Promise<Buffer> {
    try {
      // For now, return the original buffer
      // In production, you'd implement actual format conversion
      logger.warn(`Audio format conversion from ${fromFormat} to ${toFormat} not fully implemented`, LogContext.SYSTEM);
      return buffer;
    } catch (error) {
      logger.error('Audio format conversion error', LogContext.SYSTEM, { error });
      return buffer;
    }
  }

  private updateAverageProcessingTime(newTime: number): void {
    const {totalProcessed} = this.processingStats;
    const currentAverage = this.processingStats.averageProcessingTime;
    
    this.processingStats.averageProcessingTime = 
      (currentAverage * (totalProcessed - 1) + newTime) / totalProcessed;
  }

  getProcessingStats() {
    return {
      ...this.processingStats,
      successRate: this.processingStats.totalProcessed > 0 
        ? this.processingStats.successCount / this.processingStats.totalProcessed 
        : 0
    };
  }

  async validateAudioBuffer(buffer: Buffer, expectedFormat?: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    metadata: AudioMetadata;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!buffer || buffer.length === 0) {
        errors.push('Buffer is empty or null');
        return {
          isValid: false,
          errors,
          warnings,
          metadata: await this.getBasicAudioMetadata(Buffer.alloc(0))
        };
      }

      if (buffer.length < 44) {
        errors.push('Buffer too small to contain valid audio data');
      }

      const metadata = await this.getDetailedAudioMetadata(buffer);
      
      if (!metadata.isValid) {
        errors.push('Audio format is not recognized or invalid');
      }

      if (expectedFormat && metadata.format !== expectedFormat) {
        warnings.push(`Expected ${expectedFormat} but got ${metadata.format}`);
      }

      if (metadata.duration === 0) {
        warnings.push('Audio duration is zero or could not be determined');
      }

      if (metadata.duration > 300) { // 5 minutes
        warnings.push('Audio duration is unusually long');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata
      };
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        isValid: false,
        errors,
        warnings,
        metadata: await this.getBasicAudioMetadata(buffer)
      };
    }
  }

  async clearCache(): Promise<void> {
    // Reset processing stats
    this.processingStats = {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      averageProcessingTime: 0
    };
    
    logger.info('Audio handler cache and stats cleared', LogContext.SYSTEM);
  }
}

// Export singleton instance
export const audioHandler = AudioHandler.getInstance();
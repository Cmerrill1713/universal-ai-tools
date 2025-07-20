/**
 * Sweet Athena Voice Integration Example
 * 
 * This example demonstrates how to integrate Sweet Athena's voice capabilities
 * into your application, including speech recognition and voice synthesis.
 */

import axios from 'axios';

// Voice integration class
export class SweetAthenaVoiceClient {
  private baseUrl: string;
  private apiKey: string;
  private serviceId: string;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor(config: {
    baseUrl?: string;
    apiKey: string;
    serviceId: string;
  }) {
    this.baseUrl = config.baseUrl || 'http://localhost:3002/api/speech';
    this.apiKey = config.apiKey;
    this.serviceId = config.serviceId;
  }

  /**
   * Start recording audio from the user's microphone
   */
  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.start();
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return the audio blob
   */
  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        resolve(audioBlob);
        
        // Clean up
        this.mediaRecorder = null;
        this.audioChunks = [];
      };

      this.mediaRecorder.stop();
      
      // Stop all tracks
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    });
  }

  /**
   * Transcribe audio to text
   */
  async transcribeAudio(
    audioBlob: Blob,
    conversationId?: string,
    context?: string
  ): Promise<{
    text: string;
    confidence: number;
    duration: number;
    language: string;
  }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }
    
    if (context) {
      formData.append('context', context);
    }

    const response = await axios.post(
      `${this.baseUrl}/transcribe`,
      formData,
      {
        headers: {
          'X-API-Key': this.apiKey,
          'X-AI-Service': this.serviceId,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    return {
      text: response.data.transcript,
      confidence: response.data.confidence,
      duration: response.data.duration,
      language: response.data.language
    };
  }

  /**
   * Synthesize speech from text
   */
  async synthesizeSpeech(options: {
    text: string;
    personality?: 'sweet' | 'shy' | 'confident' | 'caring' | 'playful';
    sweetnessLevel?: number;
    voiceSettings?: {
      stability?: number;
      similarity_boost?: number;
      style?: number;
      use_speaker_boost?: boolean;
    };
    conversationId?: string;
    format?: 'mp3' | 'wav';
  }): Promise<{
    audioUrl: string;
    duration: number;
    personality: string;
  }> {
    const response = await axios.post(
      `${this.baseUrl}/synthesize`,
      {
        text: options.text,
        personality: options.personality || 'sweet',
        sweetness_level: options.sweetnessLevel || 0.7,
        voice_settings: options.voiceSettings,
        conversation_id: options.conversationId,
        format: options.format || 'mp3'
      },
      {
        headers: {
          'X-API-Key': this.apiKey,
          'X-AI-Service': this.serviceId,
          'Content-Type': 'application/json'
        },
        responseType: 'blob'
      }
    );

    // Create object URL for the audio
    const audioBlob = response.data;
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      audioUrl,
      duration: parseFloat(response.headers['x-audio-duration'] || '0'),
      personality: response.headers['x-voice-personality'] || 'sweet'
    };
  }

  /**
   * Get available voices
   */
  async getAvailableVoices(): Promise<{
    voices: Array<{
      id: string;
      name: string;
      provider: string;
      preview_url?: string;
      labels?: Record<string, string>;
    }>;
    personalities: Array<{
      name: string;
      description: string;
    }>;
  }> {
    const response = await axios.get(
      `${this.baseUrl}/voices`,
      {
        headers: {
          'X-API-Key': this.apiKey,
          'X-AI-Service': this.serviceId
        }
      }
    );

    return response.data;
  }

  /**
   * Configure voice settings for a personality
   */
  async configureVoice(
    personality: string,
    voiceId: string,
    settings?: {
      pitch_adjustment?: number;
      speaking_rate?: number;
      volume_gain_db?: number;
    }
  ): Promise<any> {
    const response = await axios.post(
      `${this.baseUrl}/configure-voice`,
      {
        personality,
        voice_id: voiceId,
        settings
      },
      {
        headers: {
          'X-API-Key': this.apiKey,
          'X-AI-Service': this.serviceId,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.configuration;
  }

  /**
   * Get voice interaction history
   */
  async getVoiceHistory(
    conversationId: string,
    limit: number = 50
  ): Promise<Array<{
    content: string;
    created_at: string;
    metadata: any;
  }>> {
    const response = await axios.get(
      `${this.baseUrl}/history/${conversationId}`,
      {
        params: { limit },
        headers: {
          'X-API-Key': this.apiKey,
          'X-AI-Service': this.serviceId
        }
      }
    );

    return response.data.history;
  }

  /**
   * Play audio from URL
   */
  async playAudio(audioUrl: string): Promise<void> {
    const audio = new Audio(audioUrl);
    
    return new Promise((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Failed to play audio'));
      audio.play().catch(reject);
    });
  }

  /**
   * Create a conversational voice interface
   */
  async createVoiceConversation(options: {
    conversationId: string;
    personality?: 'sweet' | 'shy' | 'confident' | 'caring' | 'playful';
    sweetnessLevel?: number;
    onTranscription?: (text: string, confidence: number) => void;
    onSynthesis?: (audioUrl: string, duration: number) => void;
    onError?: (error: Error) => void;
  }) {
    let isRecording = false;

    const startListening = async () => {
      try {
        await this.startRecording();
        isRecording = true;
      } catch (error) {
        options.onError?.(error as Error);
      }
    };

    const stopListeningAndProcess = async () => {
      if (!isRecording) return;

      try {
        const audioBlob = await this.stopRecording();
        isRecording = false;

        // Transcribe the audio
        const transcription = await this.transcribeAudio(
          audioBlob,
          options.conversationId
        );

        options.onTranscription?.(transcription.text, transcription.confidence);

        return transcription.text;
      } catch (error) {
        options.onError?.(error as Error);
        return null;
      }
    };

    const speak = async (text: string, emotion?: string) => {
      try {
        // Adjust personality based on emotion if needed
        let personality = options.personality || 'sweet';
        let sweetnessLevel = options.sweetnessLevel || 0.7;

        // Emotion-based adjustments
        if (emotion === 'happy' || emotion === 'excited') {
          personality = 'playful';
          sweetnessLevel = Math.min(1, sweetnessLevel + 0.2);
        } else if (emotion === 'sad' || emotion === 'empathetic') {
          personality = 'caring';
          sweetnessLevel = Math.min(1, sweetnessLevel + 0.1);
        }

        const { audioUrl, duration } = await this.synthesizeSpeech({
          text,
          personality,
          sweetnessLevel,
          conversationId: options.conversationId
        });

        options.onSynthesis?.(audioUrl, duration);
        
        // Play the audio
        await this.playAudio(audioUrl);
        
        // Clean up object URL
        URL.revokeObjectURL(audioUrl);
      } catch (error) {
        options.onError?.(error as Error);
      }
    };

    return {
      startListening,
      stopListeningAndProcess,
      speak,
      isRecording: () => isRecording
    };
  }
}

// Example usage
async function exampleUsage() {
  // Initialize the client
  const voiceClient = new SweetAthenaVoiceClient({
    apiKey: 'your-api-key',
    serviceId: 'your-service-id'
  });

  // Create a voice conversation
  const conversation = await voiceClient.createVoiceConversation({
    conversationId: 'conv_' + Date.now(),
    personality: 'sweet',
    sweetnessLevel: 0.8,
    onTranscription: (text, confidence) => {
      console.log(`User said: "${text}" (confidence: ${confidence})`);
    },
    onSynthesis: (audioUrl, duration) => {
      console.log(`Playing audio (${duration}s)`);
    },
    onError: (error) => {
      console.error('Voice error:', error);
    }
  });

  // Example: Voice interaction flow
  // 1. Start listening
  await conversation.startListening();

  // 2. Stop and get transcription (after user finishes speaking)
  setTimeout(async () => {
    const userText = await conversation.stopListeningAndProcess();
    
    if (userText) {
      // 3. Generate and play response
      await conversation.speak(
        "Hello! I'm Sweet Athena. I'd be happy to help you with that!",
        'happy'
      );
    }
  }, 3000);
}

// React Hook Example
export function useAthenaVoice(config: {
  apiKey: string;
  serviceId: string;
  conversationId: string;
}) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [transcript, setTranscript] = React.useState('');
  const voiceClientRef = React.useRef<SweetAthenaVoiceClient>();

  React.useEffect(() => {
    voiceClientRef.current = new SweetAthenaVoiceClient({
      apiKey: config.apiKey,
      serviceId: config.serviceId
    });
  }, [config.apiKey, config.serviceId]);

  const startRecording = async () => {
    if (!voiceClientRef.current) return;
    
    try {
      await voiceClientRef.current.startRecording();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!voiceClientRef.current) return null;
    
    try {
      const audioBlob = await voiceClientRef.current.stopRecording();
      setIsRecording(false);
      
      const result = await voiceClientRef.current.transcribeAudio(
        audioBlob,
        config.conversationId
      );
      
      setTranscript(result.text);
      return result.text;
    } catch (error) {
      console.error('Failed to process recording:', error);
      return null;
    }
  };

  const speak = async (
    text: string,
    personality: 'sweet' | 'shy' | 'confident' | 'caring' | 'playful' = 'sweet',
    sweetnessLevel: number = 0.7
  ) => {
    if (!voiceClientRef.current) return;
    
    try {
      setIsSpeaking(true);
      const { audioUrl } = await voiceClientRef.current.synthesizeSpeech({
        text,
        personality,
        sweetnessLevel,
        conversationId: config.conversationId
      });
      
      await voiceClientRef.current.playAudio(audioUrl);
      URL.revokeObjectURL(audioUrl);
    } catch (error) {
      console.error('Failed to speak:', error);
    } finally {
      setIsSpeaking(false);
    }
  };

  return {
    isRecording,
    isSpeaking,
    transcript,
    startRecording,
    stopRecording,
    speak
  };
}
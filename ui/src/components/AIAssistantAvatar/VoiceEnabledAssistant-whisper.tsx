import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, Minimize2, Maximize2, Upload } from 'lucide-react';
import { Button } from '../Button';
import { Card } from '../Card';
import { cn } from '../../lib/utils';

interface VoiceEnabledAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
  className?: string;
  personalityMood?: 'sweet' | 'shy' | 'confident' | 'purposeful' | 'caring' | 'playful';
  sweetnessLevel?: number;
}

export function VoiceEnabledAssistant({ 
  isOpen, 
  onClose, 
  isMinimized = false, 
  onMinimize,
  className,
  personalityMood = 'sweet',
  sweetnessLevel = 8
}: VoiceEnabledAssistantProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [conversationId] = useState(() => `voice-chat-${Date.now()}`);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const initializeAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      
      streamRef.current = stream;

      // Initialize MediaRecorder for Whisper-compatible format
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      // Set up audio level monitoring
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        await processAudioWithWhisper(audioBlob);
      };

      return true;
    } catch (error) {
      console.error('Failed to initialize audio recording:', error);
      alert('Microphone access denied. Please allow microphone access to use voice features.');
      return false;
    }
  };

  const startRecording = async () => {
    const initialized = await initializeAudioRecording();
    if (!initialized) return;

    setIsRecording(true);
    setTranscript('');
    setResponse('');
    
    mediaRecorderRef.current?.start();
    
    // Start audio level monitoring
    monitorAudioLevel();
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
    
    // Stop monitoring
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current || !isRecording) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      if (!isRecording) return;
      
      analyserRef.current!.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average);
      
      requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  };

  const processAudioWithWhisper = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Convert WebM to WAV for better Whisper compatibility
      const wavBlob = await convertToWav(audioBlob);
      
      const formData = new FormData();
      formData.append('audio', wavBlob, 'recording.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      
      // Call the backend API with Whisper integration
      const response = await fetch('/api/speech/transcribe', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Conversation-ID': conversationId,
        }
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const result = await response.json();
      const transcriptText = result.transcript || result.text || '';
      
      setTranscript(transcriptText);
      
      if (transcriptText.trim()) {
        await handleAIResponse(transcriptText);
      }
      
    } catch (error) {
      console.error('Error processing audio:', error);
      setTranscript('Sorry, I couldn\'t understand that. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const convertToWav = async (webmBlob: Blob): Promise<Blob> => {
    // For now, return the original blob - the backend should handle format conversion
    // In production, you might want to do client-side conversion or ensure the backend handles WebM
    return webmBlob;
  };

  const handleAIResponse = async (text: string) => {
    try {
      const response = await fetch('/api/chat/sweet-athena', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Conversation-ID': conversationId,
        },
        body: JSON.stringify({
          message: text,
          personality: personalityMood,
          sweetness_level: sweetnessLevel,
          voice_enabled: isVoiceEnabled
        })
      });

      if (!response.ok) {
        throw new Error('AI response failed');
      }

      const result = await response.json();
      const aiText = result.message || result.response || `🍯 Sweet response to: "${text}"`;
      
      setResponse(aiText);
      
      if (isVoiceEnabled) {
        await synthesizeSpeech(aiText);
      }
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      setResponse('Sorry, I had trouble processing that. Please try again.');
    }
  };

  const synthesizeSpeech = async (text: string) => {
    setIsSpeaking(true);
    
    try {
      const response = await fetch('/api/speech/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: 'sweet-athena',
          personality: personalityMood,
          sweetness_level: sweetnessLevel
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      } else {
        // Fallback to browser TTS
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        utterance.onend = () => setIsSpeaking(false);
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      setIsSpeaking(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    setIsProcessing(true);
    await processAudioWithWhisper(file);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleVoice = () => {
    setIsVoiceEnabled(!isVoiceEnabled);
  };

  if (!isOpen) return null;

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex items-center justify-center',
      isMinimized && 'pointer-events-none'
    )}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <Card className={cn(
        'relative w-96 max-w-[90vw] max-h-[80vh] overflow-hidden',
        'bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900',
        'border-2 border-purple-500/30',
        'shadow-2xl shadow-purple-500/20',
        'transform transition-all duration-300',
        isMinimized ? 'scale-50 opacity-50' : 'scale-100 opacity-100',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <div className={cn(
              'w-3 h-3 rounded-full animate-pulse',
              isRecording ? 'bg-red-400' : isProcessing ? 'bg-yellow-400' : 'bg-green-400'
            )} />
            <h3 className="text-lg font-semibold">
              🍯 Sweet Athena AI Assistant
            </h3>
          </div>
          
          <div className="flex items-center space-x-2">
            {onMinimize && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMinimize}
                className="p-1 h-8 w-8"
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-1 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Sweet Athena Avatar */}
          <div className="flex justify-center">
            <div className={cn(
              'w-32 h-32 rounded-full bg-gradient-to-br from-pink-400 via-purple-400 to-cyan-400',
              'flex items-center justify-center text-4xl',
              'shadow-lg shadow-purple-500/30',
              'transition-all duration-300',
              'relative overflow-hidden'
            )}>
              <div className="text-4xl">🍯</div>
              
              {/* Audio Level Visualization */}
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-4 border-pink-300 animate-ping" 
                     style={{ 
                       transform: `scale(${1 + audioLevel / 255})`,
                       opacity: audioLevel / 255 
                     }} />
              )}
              
              {/* Processing Animation */}
              {isProcessing && (
                <div className="absolute inset-0 rounded-full bg-yellow-400/20 animate-pulse" />
              )}
              
              {/* Speaking Animation */}
              {isSpeaking && (
                <div className="absolute inset-0 rounded-full bg-green-400/20 animate-bounce" />
              )}
            </div>
          </div>

          {/* Status */}
          <div className="text-center space-y-2">
            {isProcessing && (
              <p className="text-purple-300 animate-pulse">
                🔄 Processing with Whisper AI...
              </p>
            )}
            {isRecording && (
              <div className="space-y-1">
                <p className="text-green-300">🎙️ Recording... Speak now!</p>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-400 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${Math.min(audioLevel / 255 * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {isSpeaking && (
              <p className="text-cyan-300 animate-pulse">🗣️ Sweet Athena is speaking...</p>
            )}
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-500/30">
              <p className="text-sm text-blue-200">
                <strong>You said:</strong> "{transcript}"
              </p>
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-500/30">
              <p className="text-purple-100">
                <strong>🍯 Sweet Athena:</strong> {response}
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center space-x-2">
            <Button
              onClick={toggleRecording}
              disabled={isProcessing}
              variant={isRecording ? "danger" : "primary"}
              className={cn(
                'flex items-center space-x-2',
                isRecording && 'bg-red-600 hover:bg-red-700 animate-pulse'
              )}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              <span>{isRecording ? 'Stop' : 'Record'}</span>
            </Button>
            
            <Button
              onClick={toggleVoice}
              variant={isVoiceEnabled ? "primary" : "secondary"}
              className="flex items-center space-x-2"
            >
              {isVoiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span>Voice</span>
            </Button>

            {/* File Upload */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isProcessing}
              />
              <Button
                variant="secondary"
                disabled={isProcessing}
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Upload</span>
              </Button>
            </label>
          </div>

          {/* Info */}
          <div className="text-center text-xs text-gray-400 space-y-1">
            <p>🤖 Powered by Whisper AI for speech recognition</p>
            <p>💬 Conversation ID: {conversationId.slice(-8)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
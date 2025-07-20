import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings, X, Minimize2, Maximize2 } from 'lucide-react';
import { SweetAthenaAvatar } from './SweetAthenaAvatar';
import { Button } from '../Button';
import { Card } from '../Card';
import { cn } from '../../lib/utils';
import { createSpeechRecognition, isSpeechRecognitionSupported, type SpeechRecognition, type SpeechRecognitionEvent } from '../../utils/speech-api';

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
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [conversationId] = useState(() => `voice-chat-${Date.now()}`);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isAudioSupported, setIsAudioSupported] = useState(false);
  const [serviceHealth, setServiceHealth] = useState<any>(null);
  // const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [selectedVoiceProvider] = useState<'auto' | 'kokoro' | 'openai' | 'elevenlabs'>('auto');
  const [voiceAmplitude, setVoiceAmplitude] = useState(0);
  const [speakingAmplitude, setSpeakingAmplitude] = useState(0);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const initializeAudioFeatures = async () => {
      try {
        setAudioError(null);
        
        // Check audio support
        const hasWebAudio = 'AudioContext' in window || 'webkitAudioContext' in window;
        const hasSpeechSynthesis = 'speechSynthesis' in window;
        const hasSpeechRecognition = isSpeechRecognitionSupported();
        
        if (!hasWebAudio || !hasSpeechSynthesis || !hasSpeechRecognition) {
          setAudioError('Your browser does not fully support audio features');
          return;
        }
        
        setIsAudioSupported(true);

        // Check backend speech service health
        try {
          const healthResponse = await fetch('/api/speech/health', {
            headers: {
              'X-API-Key': import.meta.env.VITE_API_KEY || '',
              'X-AI-Service': 'local-ui',
            },
          });
          
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            setServiceHealth(healthData);
          }
        } catch (error) {
          console.warn('Could not check speech service health:', error);
        }

        // Load available voices
        try {
          const voicesResponse = await fetch('/api/speech/voices', {
            headers: {
              'X-API-Key': import.meta.env.VITE_API_KEY || '',
              'X-AI-Service': 'local-ui',
            },
          });
          
          if (voicesResponse.ok) {
            await voicesResponse.json();
            // setAvailableVoices(voicesData.kokoroVoices || []);
          }
        } catch (error) {
          console.warn('Could not load available voices:', error);
        }

        // Initialize AudioContext
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        
        // Create analyser for audio visualization
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;

        // Initialize Speech Recognition
        if (hasSpeechRecognition) {
          recognitionRef.current = createSpeechRecognition();
          if (recognitionRef.current) {
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript;
            setTranscript(transcript);
            
            if (event.results[current].isFinal) {
              handleVoiceCommand(transcript);
            }
          };

            recognitionRef.current.onend = () => {
              setIsListening(false);
            };

            recognitionRef.current.onerror = (event) => {
              console.error('Speech recognition error:', event.error);
              setAudioError(`Speech recognition error: ${event.error}`);
              setIsListening(false);
            };
          }

          setIsVoiceEnabled(true);
        }

        // Initialize Speech Synthesis
        if (hasSpeechSynthesis) {
          synthRef.current = window.speechSynthesis;
        }
        
      } catch (error) {
        console.error('Audio initialization error:', error);
        setAudioError('Failed to initialize audio features');
      }
    };

    initializeAudioFeatures();

    return () => {
      // Cleanup
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (currentAudioSourceRef.current) {
        currentAudioSourceRef.current.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startListening = async () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      setTranscript('');
      setResponse('');
      recognitionRef.current.start();
      
      // Start microphone amplitude tracking
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        
        if (audioContextRef.current && analyserRef.current) {
          const source = audioContextRef.current.createMediaStreamSource(stream);
          source.connect(analyserRef.current);
          
          // Start amplitude monitoring
          const monitorAmplitude = () => {
            if (!analyserRef.current || !isListening) return;
            
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            
            // Calculate average amplitude
            const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
            const normalizedAmplitude = Math.min(average / 128, 1); // Normalize to 0-1
            
            setVoiceAmplitude(normalizedAmplitude);
            
            animationFrameRef.current = requestAnimationFrame(monitorAmplitude);
          };
          
          monitorAmplitude();
        }
      } catch (error) {
        console.error('Failed to access microphone for amplitude tracking:', error);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    
    // Stop microphone amplitude tracking
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    
    setVoiceAmplitude(0);
  };

  const speak = async (text: string) => {
    try {
      setIsSpeaking(true);
      setAudioError(null);
      
      // Stop any currently playing audio
      if (currentAudioSourceRef.current) {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current = null;
      }
      
      // Resume AudioContext if suspended
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Try using the backend TTS service with retry logic
      try {
        const response = await fetch('/api/speech/synthesize/retry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': import.meta.env.VITE_API_KEY || '',
            'X-AI-Service': 'local-ui',
          },
          body: JSON.stringify({
            text,
            personality: personalityMood,
            sweetness_level: sweetnessLevel / 10,
            format: 'mp3',
            conversation_id: conversationId,
            max_retries: 2
          }),
        });

        if (response.ok && audioContextRef.current) {
          const audioBuffer = await response.arrayBuffer();
          
          // Validate the audio buffer
          if (audioBuffer.byteLength === 0) {
            throw new Error('Received empty audio buffer');
          }
          
          try {
            const audioData = await audioContextRef.current.decodeAudioData(audioBuffer);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioData;
            
            // Connect to analyser for visualization
            source.connect(analyserRef.current!);
            analyserRef.current!.connect(audioContextRef.current.destination);
            
            currentAudioSourceRef.current = source;
            
            source.onended = () => {
              setIsSpeaking(false);
              setSpeakingAmplitude(0);
              currentAudioSourceRef.current = null;
            };
            
            source.start();
            
            // Monitor speaking amplitude
            const monitorSpeakingAmplitude = () => {
              if (!analyserRef.current || !isSpeaking || !currentAudioSourceRef.current) {
                setSpeakingAmplitude(0);
                return;
              }
              
              const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
              analyserRef.current.getByteFrequencyData(dataArray);
              
              // Calculate average amplitude with emphasis on speech frequencies
              const speechRange = dataArray.slice(10, 50); // Focus on speech frequency range
              const average = speechRange.reduce((sum, value) => sum + value, 0) / speechRange.length;
              const normalizedAmplitude = Math.min(average / 100, 1); // Normalize to 0-1
              
              setSpeakingAmplitude(normalizedAmplitude);
              
              requestAnimationFrame(monitorSpeakingAmplitude);
            };
            
            monitorSpeakingAmplitude();
            
            // Clear any previous error
            setAudioError(null);
            return;
          } catch (decodeError) {
            throw new Error(`Audio decode failed: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Backend TTS failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
        }
      } catch (backendError) {
        console.warn('Backend TTS with retry failed:', backendError);
        setAudioError('Backend TTS unavailable, using browser fallback');
        
        // Try Kokoro TTS directly as secondary fallback
        try {
          const kokoroResponse = await fetch('/api/speech/synthesize/kokoro', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': import.meta.env.VITE_API_KEY || '',
              'X-AI-Service': 'local-ui',
            },
            body: JSON.stringify({
              text,
              voiceId: `athena-${personalityMood}`,
              format: 'mp3'
            }),
          });

          if (kokoroResponse.ok && audioContextRef.current) {
            const audioBuffer = await kokoroResponse.arrayBuffer();
            if (audioBuffer.byteLength > 0) {
              const audioData = await audioContextRef.current.decodeAudioData(audioBuffer);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioData;
              source.connect(audioContextRef.current.destination);
              
              currentAudioSourceRef.current = source;
              
              source.onended = () => {
                setIsSpeaking(false);
                currentAudioSourceRef.current = null;
              };
              
              source.start();
              
              setAudioError('Using Kokoro TTS (local)');
              return;
            }
          }
        } catch (kokoroError) {
          console.warn('Kokoro TTS fallback failed:', kokoroError);
        }
      }

      // Fallback to browser speech synthesis
      if (synthRef.current) {
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Apply personality-based voice settings
        switch (personalityMood) {
          case 'sweet':
            utterance.rate = 0.85;
            utterance.pitch = 1.2;
            utterance.volume = 0.7;
            break;
          case 'confident':
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 0.9;
            break;
          case 'playful':
            utterance.rate = 1.1;
            utterance.pitch = 1.3;
            utterance.volume = 0.8;
            break;
          case 'caring':
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            utterance.volume = 0.8;
            break;
          default:
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            utterance.volume = 0.8;
        }
        
        // Find a suitable voice
        const voices = synthRef.current.getVoices();
        const femaleVoice = voices.find(voice => 
          voice.name.toLowerCase().includes('female') || 
          voice.name.toLowerCase().includes('zira') ||
          voice.name.toLowerCase().includes('eva') ||
          voice.name.toLowerCase().includes('samantha')
        );
        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (event) => {
          console.error('Speech synthesis error:', event);
          setAudioError(`Speech synthesis error: ${event.error}`);
          setIsSpeaking(false);
        };
        
        synthRef.current.speak(utterance);
      } else {
        throw new Error('No speech synthesis available');
      }
      
    } catch (error) {
      console.error('Speech error:', error);
      setAudioError(`Speech failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const handleVoiceCommand = async (command: string) => {
    setIsThinking(true);
    setTranscript('');
    
    try {
      // Send to AI assistant (use proxy if available, fallback to direct)
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': import.meta.env.VITE_API_KEY || '',
          'X-AI-Service': 'local-ui',
        },
        body: JSON.stringify({
          message: command,
          model: 'llama3.2:3b',
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');
      
      const data = await response.json();
      const aiResponse = data.response || data.content;
      
      setResponse(aiResponse);
      
      // Auto-speak the response if speech synthesis is available
      if (synthRef.current && aiResponse) {
        speak(aiResponse);
      }
      
    } catch (error) {
      console.error('Voice command error:', error);
      const errorMessage = "I'm sorry, I'm having trouble processing your request right now.";
      setResponse(errorMessage);
      speak(errorMessage);
    } finally {
      setIsThinking(false);
    }
  };

  const handleAvatarInteraction = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const testVoice = async (voiceId?: string) => {
    try {
      const testText = "Hello! This is a voice test. How do I sound?";
      
      if (selectedVoiceProvider === 'kokoro' && voiceId) {
        // Test specific Kokoro voice
        const response = await fetch(`/api/speech/test/kokoro/${voiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': import.meta.env.VITE_API_KEY || '',
            'X-AI-Service': 'local-ui',
          },
          body: JSON.stringify({ text: testText }),
        });

        if (response.ok && audioContextRef.current) {
          const audioBuffer = await response.arrayBuffer();
          const audioData = await audioContextRef.current.decodeAudioData(audioBuffer);
          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioData;
          source.connect(audioContextRef.current.destination);
          source.start();
          
          setAudioError(`Testing voice: ${voiceId}`);
        }
      } else {
        // Test using current personality settings
        await speak(testText);
      }
    } catch (error) {
      console.error('Voice test failed:', error);
      setAudioError(`Voice test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'unhealthy': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={cn("fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", className)}>
      <Card className={cn(
        "relative bg-gradient-to-br from-pink-900/80 via-purple-900/80 to-gray-900/80 border-pink-500/70 transition-all duration-300 overflow-hidden backdrop-blur-sm",
        isMinimized ? "w-80 h-20" : "w-[600px] h-[500px]"
      )}>
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-pink-800/80 bg-opacity-90 border-b border-pink-500/70 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
            <span className="font-semibold text-pink-300">Sweet Athena</span>
            {isVoiceEnabled && (
              <span className="text-xs text-green-400">Voice Enabled</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {onMinimize && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMinimize}
                className="text-cyan-300 hover:bg-cyan-900 hover:text-cyan-100"
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-cyan-300 hover:bg-cyan-900 hover:text-cyan-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Sweet Athena Avatar Display */}
            <div className="absolute inset-0 pt-16">
              <SweetAthenaAvatar
                isThinking={isThinking}
                isSpeaking={isSpeaking}
                isListening={isListening}
                onInteraction={handleAvatarInteraction}
                personalityMood={personalityMood}
                sweetnessLevel={sweetnessLevel}
                voiceAmplitude={isListening ? voiceAmplitude : 0}
                speakingAmplitude={isSpeaking ? speakingAmplitude : 0}
                className="w-full h-full"
              />
            </div>

            {/* Voice Controls */}
            <div className="absolute bottom-4 left-4 right-4 z-10">
              <div className="bg-gray-800 bg-opacity-90 border border-cyan-500 rounded-lg p-4 space-y-3">
                
                {/* Status Display */}
                <div className="text-center">
                  {audioError && (
                    <p className="text-red-400 text-xs font-mono mb-2 bg-red-900/20 p-2 rounded">
                      ⚠️ {audioError}
                    </p>
                  )}
                  {!isAudioSupported && (
                    <p className="text-yellow-400 text-xs font-mono mb-2 bg-yellow-900/20 p-2 rounded">
                      ⚠️ Audio features not fully supported in this browser
                    </p>
                  )}
                  
                  {/* Service Health Display */}
                  {serviceHealth && (
                    <div className="text-xs font-mono mb-2 bg-gray-800/50 p-2 rounded">
                      <span className={`${getServiceStatusColor(serviceHealth.status)} font-bold`}>
                        Backend: {serviceHealth.status?.toUpperCase()}
                      </span>
                      <div className="flex justify-center space-x-2 mt-1">
                        {serviceHealth.services?.kokoro && <span className="text-green-400">🎵 Kokoro</span>}
                        {serviceHealth.services?.openai && <span className="text-blue-400">🔗 OpenAI</span>}
                        {serviceHealth.services?.elevenlabs && <span className="text-purple-400">🎭 ElevenLabs</span>}
                      </div>
                    </div>
                  )}
                  
                  {isThinking && (
                    <p className="text-cyan-400 text-sm font-mono animate-pulse">
                      🧠 PROCESSING YOUR REQUEST...
                    </p>
                  )}
                  {isListening && !isThinking && (
                    <p className="text-red-400 text-sm font-mono animate-pulse">
                      🎤 LISTENING... "{transcript}"
                    </p>
                  )}
                  {isSpeaking && !isThinking && (
                    <p className="text-green-400 text-sm font-mono animate-pulse">
                      🔊 SPEAKING...
                    </p>
                  )}
                  {!isThinking && !isListening && !isSpeaking && (
                    <p className="text-cyan-300 text-sm font-mono">
                      💬 Ready to chat - Click avatar or use voice controls
                    </p>
                  )}
                </div>

                {/* Response Display */}
                {response && !isThinking && (
                  <div className="max-h-16 overflow-y-auto">
                    <p className="text-sm text-gray-300 bg-gray-700 bg-opacity-50 rounded p-2">
                      {response}
                    </p>
                  </div>
                )}

                {/* Voice Controls */}
                <div className="flex items-center justify-center space-x-3">
                  <Button
                    variant={isListening ? "danger" : "primary"}
                    size="sm"
                    onClick={isListening ? stopListening : startListening}
                    disabled={isThinking || !isVoiceEnabled}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={isSpeaking ? stopSpeaking : () => speak(response)}
                    disabled={!response || isThinking}
                    className="border-cyan-500 text-cyan-300 hover:bg-cyan-900"
                  >
                    {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testVoice()}
                    disabled={isThinking || isSpeaking}
                    className="border-green-500 text-green-300 hover:bg-green-900"
                    title="Test current voice"
                  >
                    🎵
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-cyan-500 text-cyan-300 hover:bg-cyan-900"
                    title="Voice settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Minimized State */}
        {isMinimized && (
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-cyan-500 rounded-full animate-pulse flex items-center justify-center">
                <Mic className="h-4 w-4 text-white" />
              </div>
              <span className="text-cyan-300 text-sm font-mono">AI Assistant Ready</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={startListening}
                disabled={isThinking}
                className="text-cyan-300 hover:bg-cyan-900"
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// Add type declarations for Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
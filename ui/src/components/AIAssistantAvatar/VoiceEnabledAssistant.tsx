import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings, X, Minimize2, Maximize2 } from 'lucide-react';
import { SweetAthenaAvatar } from './SweetAthenaAvatar';
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
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [conversationId] = useState(() => `voice-chat-${Date.now()}`);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
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
        setIsListening(false);
      };

      setIsVoiceEnabled(true);
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      setTranscript('');
      setResponse('');
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speak = (text: string) => {
    if (synthRef.current) {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      utterance.volume = 0.8;
      
      // Find a female voice if available
      const voices = synthRef.current.getVoices();
      const femaleVoice = voices.find(voice => 
        voice.name.toLowerCase().includes('female') || 
        voice.name.toLowerCase().includes('zira') ||
        voice.name.toLowerCase().includes('eva')
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      synthRef.current.speak(utterance);
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
      // Send to AI assistant
      const response = await fetch('http://localhost:9999/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'local-dev-key',
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
                className="w-full h-full"
              />
            </div>

            {/* Voice Controls */}
            <div className="absolute bottom-4 left-4 right-4 z-10">
              <div className="bg-gray-800 bg-opacity-90 border border-cyan-500 rounded-lg p-4 space-y-3">
                
                {/* Status Display */}
                <div className="text-center">
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
                    variant={isListening ? "destructive" : "default"}
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
                    className="border-cyan-500 text-cyan-300 hover:bg-cyan-900"
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
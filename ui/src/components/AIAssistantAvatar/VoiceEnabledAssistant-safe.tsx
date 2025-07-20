import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings, X, Minimize2, Maximize2 } from 'lucide-react';
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
  // personalityMood = 'sweet',
  // sweetnessLevel = 8
}: VoiceEnabledAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  // const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  useState(() => `voice-chat-${Date.now()}`);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    // Check for Speech API support
    const hasSpeechRecognition = isSpeechRecognitionSupported();
    const hasSpeechSynthesis = 'speechSynthesis' in window;
    
    setSpeechSupported(hasSpeechRecognition && hasSpeechSynthesis);
    
    if (!hasSpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser');
      return;
    }

    try {
      // Initialize Speech Recognition safely
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
            handleSpeechInput(transcript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }

      // Initialize Speech Synthesis
      if (hasSpeechSynthesis) {
        synthRef.current = window.speechSynthesis;
      }
    } catch (error) {
      console.error('Failed to initialize speech APIs:', error);
      setSpeechSupported(false);
    }
  }, []);

  const handleSpeechInput = async (text: string) => {
    setIsThinking(true);
    setTranscript('');
    
    try {
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const aiResponse = `🍯 Sweet response to: "${text}"`;
      setResponse(aiResponse);
      
      if (isVoiceEnabled && synthRef.current) {
        speak(aiResponse);
      }
    } catch (error) {
      console.error('Error processing speech:', error);
      setResponse('Sorry, I had trouble processing that.');
    } finally {
      setIsThinking(false);
    }
  };

  const speak = (text: string) => {
    if (!synthRef.current) return;
    
    // setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;
    
    // utterance.onend = () => setIsSpeaking(false);
    // utterance.onerror = () => setIsSpeaking(false);
    
    synthRef.current.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current || !speechSupported) {
      alert('Voice features are not supported in this browser. Please try Chrome or Edge.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.start();
          setIsListening(true);
          setTranscript('');
        }
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        alert('Unable to start voice recognition. Please check your microphone permissions.');
      }
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
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <h3 className="text-lg font-semibold">
              🍯 Sweet Athena Voice Assistant
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
          {/* Speech Support Status */}
          {!speechSupported && (
            <div className="p-3 bg-yellow-900/50 border border-yellow-500/50 rounded-lg">
              <p className="text-sm text-yellow-200">
                ⚠️ Voice features not supported in this browser.
                Try Chrome or Edge for full voice capabilities.
              </p>
            </div>
          )}

          {/* Avatar Placeholder */}
          <div className="flex justify-center">
            <div className={cn(
              'w-32 h-32 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500',
              'flex items-center justify-center text-4xl',
              'shadow-lg shadow-purple-500/30',
              'transition-transform duration-300',
              isListening && 'scale-110 animate-pulse',
              isThinking && 'animate-bounce'
            )}>
              🍯
            </div>
          </div>

          {/* Status */}
          <div className="text-center">
            {isThinking && (
              <p className="text-purple-300 animate-pulse">Sweet Athena is thinking...</p>
            )}
            {isListening && (
              <p className="text-green-300">Listening... Speak now!</p>
            )}
            {transcript && (
              <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-500/30">
                <p className="text-sm text-blue-200">You said: "{transcript}"</p>
              </div>
            )}
          </div>

          {/* Response */}
          {response && (
            <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-500/30">
              <p className="text-purple-100">{response}</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center space-x-4">
            <Button
              onClick={toggleListening}
              disabled={!speechSupported}
              variant={isListening ? "danger" : "primary"}
              className={cn(
                'flex items-center space-x-2',
                isListening && 'bg-red-600 hover:bg-red-700'
              )}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              <span>{isListening ? 'Stop' : 'Listen'}</span>
            </Button>
            
            <Button
              onClick={toggleVoice}
              disabled={!speechSupported}
              variant={isVoiceEnabled ? "primary" : "secondary"}
              className="flex items-center space-x-2"
            >
              {isVoiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span>Voice</span>
            </Button>
          </div>

          {/* Settings */}
          <div className="text-center">
            <Button variant="ghost" size="sm" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
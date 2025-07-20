/**
 * Speech API Type-Safe Wrapper
 * Provides type-safe access to Web Speech API with proper fallbacks
 */

// Type definitions for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

/**
 * Creates a new SpeechRecognition instance with proper browser support detection
 */
export function createSpeechRecognition(): SpeechRecognition | null {
  try {
    // Check for native SpeechRecognition
    if ('SpeechRecognition' in window) {
      return new (window as any).SpeechRecognition();
    }
    
    // Check for webkit prefixed version
    if ('webkitSpeechRecognition' in window) {
      return new (window as any).webkitSpeechRecognition();
    }
    
    return null;
  } catch (error) {
    console.warn('Speech recognition not supported:', error);
    return null;
  }
}

/**
 * Checks if Speech Recognition is supported in the current browser
 */
export function isSpeechRecognitionSupported(): boolean {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

/**
 * Type guard for SpeechRecognitionEvent
 */
export function isSpeechRecognitionEvent(event: Event): event is SpeechRecognitionEvent {
  return 'results' in event && 'resultIndex' in event;
}

// Export types for use in components
export type {
  SpeechRecognition,
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionResult,
  SpeechRecognitionAlternative
};
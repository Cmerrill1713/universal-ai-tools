/**
 * Global type declarations for Universal AI Tools
 * Fixes missing type definitions that cause compilation errors
 */

// Web Speech API types
declare interface SpeechRecognition extends EventTarget {
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

declare interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

declare interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

declare interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

declare interface SpeechRecognitionAlternative {
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

// Sweet Athena personality types
export type PersonalityMood = 'cheerful' | 'professional' | 'caring' | 'playful' | 'analytical' | 'empathetic';

export type EmotionalState = {
  primary: 'happy' | 'neutral' | 'focused' | 'excited' | 'calm' | 'supportive';
  intensity: number; // 0-1
  confidence: number; // 0-1
};

export type ThemeVariant = 'holographic' | 'neon' | 'soft' | 'cosmic' | 'minimal';

export type AvatarMode = '2d' | '3d' | 'hybrid';

export interface AthenaTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  variant: ThemeVariant;
}

export interface AthenaThemeConfig {
  theme: AthenaTheme;
  animations: {
    enabled: boolean;
    speed: number;
    complexity: 'low' | 'medium' | 'high';
  };
  personality: {
    mood: PersonalityMood;
    emotional_state: EmotionalState;
  };
}

export interface ThemeUpdateOptions {
  preservePersonality?: boolean;
  smoothTransition?: boolean;
  duration?: number;
}

// ReadyPlayerMe Avatar types
export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'fear' | 'disgusted';

export interface AvatarProps {
  modelSrc: string;
  emotion: Emotion;
  headMovement: boolean;
  speaking: boolean;
  onLoaded: () => void;
}

// Component prop extensions for 3D components
declare module '@react-three/fiber' {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      sphereGeometry: any;
      meshStandardMaterial: any;
      pointLight: any;
      ambientLight: any;
      bufferGeometry: any;
      bufferAttribute: any;
    }
  }
}

// Three.js extensions
declare module 'three' {
  interface BufferAttribute {
    args?: any[];
  }
}

// Assistant UI components
declare module '@assistant-ui/react' {
  export interface ThreadConfig {
    Composer?: React.ComponentType;
    ThreadWelcome?: React.ComponentType;
    Message?: React.ComponentType;
  }
}
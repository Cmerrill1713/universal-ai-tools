/**
 * Avatar-related type definitions for Sweet Athena
 * 
 * Defines types for 3D avatars, animations, expressions, and avatar interactions
 * including ReadyPlayerMe integration and custom avatar behaviors.
 * 
 * @fileoverview Avatar system type definitions
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

import { PersonalityMood, EmotionalState, AvatarMode } from './core';

/**
 * 3D position coordinates for avatar positioning and animation.
 */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/**
 * 3D rotation angles in radians for avatar orientation.
 */
export interface Rotation3D {
  x: number; // Pitch
  y: number; // Yaw
  z: number; // Roll
}

/**
 * Avatar animation configuration for different states and personalities.
 */
export interface AvatarAnimation {
  /** Animation name/identifier */
  name: string;
  /** Animation duration in milliseconds */
  duration: number;
  /** Whether the animation should loop */
  loop: boolean;
  /** Animation easing function */
  easing: string;
  /** Delay before animation starts */
  delay?: number;
  /** Animation intensity (0-1) */
  intensity?: number;
}

/**
 * Facial expression configuration for emotional display.
 */
export interface FacialExpression {
  /** Expression identifier */
  id: string;
  /** Human-readable expression name */
  name: string;
  /** Expression intensity (0-1) */
  intensity: number;
  /** Blend shapes for 3D facial animation */
  blendShapes?: Record<string, number>;
  /** Duration to transition to this expression */
  transitionDuration?: number;
}

/**
 * Avatar lighting configuration for mood enhancement.
 */
export interface AvatarLighting {
  /** Ambient light intensity */
  ambient: number;
  /** Primary light position and intensity */
  primary: {
    position: Vector3D;
    intensity: number;
    color: string;
  };
  /** Secondary light for fill lighting */
  secondary?: {
    position: Vector3D;
    intensity: number;
    color: string;
  };
  /** Special mood lighting */
  mood?: {
    color: string;
    intensity: number;
    radius: number;
  };
}

/**
 * Camera configuration for avatar viewing.
 */
export interface AvatarCamera {
  /** Camera position relative to avatar */
  position: Vector3D;
  /** Camera target (what it's looking at) */
  target: Vector3D;
  /** Field of view in degrees */
  fov: number;
  /** Near clipping plane */
  near: number;
  /** Far clipping plane */
  far: number;
  /** Whether camera can be controlled by user */
  controllable: boolean;
}

/**
 * ReadyPlayerMe specific configuration.
 */
export interface ReadyPlayerMeConfig {
  /** Avatar URL from ReadyPlayerMe */
  avatarUrl: string;
  /** Quality settings */
  quality: 'low' | 'medium' | 'high' | 'ultra';
  /** Whether to enable lip sync */
  lipSync: boolean;
  /** Whether to enable eye tracking */
  eyeTracking: boolean;
  /** Custom morphs/blend shapes */
  morphTargets?: Record<string, number>;
  /** Animation configuration */
  animations?: {
    idle: string;
    talking: string;
    listening: string;
    thinking: string;
  };
}

/**
 * Particle system configuration for divine aura effects.
 */
export interface ParticleSystemConfig {
  /** Number of particles */
  count: number;
  /** Particle colors */
  colors: string[];
  /** Particle size range */
  sizeRange: [number, number];
  /** Movement speed */
  speed: number;
  /** Particle lifetime in seconds */
  lifetime: number;
  /** Emission shape */
  emissionShape: 'sphere' | 'circle' | 'cone' | 'box';
  /** Emission radius */
  radius: number;
  /** Whether particles should respond to mood */
  moodResponsive: boolean;
}

/**
 * Avatar physics configuration for natural movement.
 */
export interface AvatarPhysics {
  /** Enable gravity effects */
  gravity: boolean;
  /** Hair/clothing physics simulation */
  clothSimulation: boolean;
  /** Wind effects */
  wind?: {
    strength: number;
    direction: Vector3D;
    variability: number;
  };
  /** Breathing physics */
  breathing: {
    enabled: boolean;
    intensity: number;
    frequency: number;
  };
}

/**
 * Complete avatar configuration combining all aspects.
 */
export interface AvatarConfig {
  /** Avatar rendering mode */
  mode: AvatarMode;
  /** Current personality mood */
  personality: PersonalityMood;
  /** Current emotional state */
  emotionalState: EmotionalState;
  /** ReadyPlayerMe configuration if using 3D mode */
  readyPlayerMe?: ReadyPlayerMeConfig;
  /** Lighting setup */
  lighting: AvatarLighting;
  /** Camera configuration */
  camera: AvatarCamera;
  /** Particle effects */
  particles: ParticleSystemConfig;
  /** Physics simulation */
  physics?: AvatarPhysics;
  /** Custom animations */
  animations?: AvatarAnimation[];
  /** Custom expressions */
  expressions?: FacialExpression[];
}

/**
 * Avatar state for runtime tracking.
 */
export interface AvatarState {
  /** Whether avatar is currently visible */
  visible: boolean;
  /** Current emotional state */
  currentEmotion: EmotionalState;
  /** Current animation being played */
  currentAnimation?: string;
  /** Current facial expression */
  currentExpression?: string;
  /** Whether avatar is actively speaking */
  isSpeaking: boolean;
  /** Whether avatar is thinking/processing */
  isThinking: boolean;
  /** Whether avatar is listening to user */
  isListening: boolean;
  /** Last interaction timestamp */
  lastInteraction?: Date;
  /** Current position in 3D space */
  position: Vector3D;
  /** Current rotation */
  rotation: Rotation3D;
  /** Animation queue for sequenced animations */
  animationQueue: string[];
}

/**
 * Avatar interaction events and handlers.
 */
export interface AvatarEvents {
  /** Fired when avatar is clicked/tapped */
  onClick?: () => void;
  /** Fired when mouse/pointer enters avatar area */
  onHover?: () => void;
  /** Fired when mouse/pointer leaves avatar area */
  onHoverEnd?: () => void;
  /** Fired when avatar animation completes */
  onAnimationComplete?: (animationName: string) => void;
  /** Fired when avatar expression changes */
  onExpressionChange?: (expression: FacialExpression) => void;
  /** Fired when avatar starts speaking */
  onSpeakStart?: () => void;
  /** Fired when avatar stops speaking */
  onSpeakEnd?: () => void;
  /** Fired when avatar mood changes */
  onMoodChange?: (newMood: PersonalityMood) => void;
}

/**
 * Props for avatar components.
 */
export interface AvatarProps {
  /** Avatar configuration */
  config: AvatarConfig;
  /** Current avatar state */
  state?: Partial<AvatarState>;
  /** Event handlers */
  events?: AvatarEvents;
  /** CSS class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Whether to show debug information */
  debug?: boolean;
  /** Performance mode for lower-end devices */
  performanceMode?: boolean;
}

/**
 * Avatar animation presets for common scenarios.
 */
export const AvatarAnimationPresets = {
  IDLE: {
    name: 'idle',
    duration: 4000,
    loop: true,
    easing: 'ease-in-out',
    intensity: 0.3,
  },
  GREETING: {
    name: 'greeting',
    duration: 2000,
    loop: false,
    easing: 'ease-out',
    intensity: 0.8,
  },
  THINKING: {
    name: 'thinking',
    duration: 3000,
    loop: true,
    easing: 'ease-in-out',
    intensity: 0.5,
  },
  SPEAKING: {
    name: 'speaking',
    duration: 1000,
    loop: true,
    easing: 'linear',
    intensity: 0.7,
  },
  LISTENING: {
    name: 'listening',
    duration: 2000,
    loop: true,
    easing: 'ease-in-out',
    intensity: 0.4,
  },
} as const;

/**
 * Facial expression presets for different emotions.
 */
export const FacialExpressionPresets = {
  NEUTRAL: {
    id: 'neutral',
    name: 'Neutral',
    intensity: 0.5,
  },
  HAPPY: {
    id: 'happy',
    name: 'Happy',
    intensity: 0.8,
  },
  CURIOUS: {
    id: 'curious',
    name: 'Curious',
    intensity: 0.6,
  },
  CARING: {
    id: 'caring',
    name: 'Caring',
    intensity: 0.7,
  },
  PLAYFUL: {
    id: 'playful',
    name: 'Playful',
    intensity: 0.9,
  },
  THINKING: {
    id: 'thinking',
    name: 'Thinking',
    intensity: 0.5,
  },
} as const;
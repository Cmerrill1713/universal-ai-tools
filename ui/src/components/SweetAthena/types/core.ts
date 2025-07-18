/**
 * Core TypeScript types and interfaces for Sweet Athena AI Assistant
 * 
 * This module defines the fundamental types used throughout the Sweet Athena
 * component system, including personality moods, avatar states, and theming.
 * 
 * @fileoverview Core type definitions for Sweet Athena AI Assistant
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

/**
 * Represents the different personality moods that Sweet Athena can express.
 * Each mood affects the visual appearance, animations, and interaction patterns.
 */
export type PersonalityMood = 'sweet' | 'shy' | 'confident' | 'caring' | 'playful';

/**
 * Defines the emotional state of the AI assistant during conversations.
 * Used to control animations, visual feedback, and interaction behaviors.
 */
export type EmotionalState = 
  | 'neutral'      // Default state, calm and ready
  | 'thinking'     // Processing user input or generating response
  | 'speaking'     // Actively delivering a response
  | 'listening'    // Actively receiving user input
  | 'excited'      // Showing enthusiasm or joy
  | 'curious'      // Expressing interest or wonder
  | 'empathetic'   // Showing understanding and care
  | 'playful'      // Engaging in lighthearted interaction
  | 'focused';     // Deep concentration or serious discussion

/**
 * Represents the intensity levels for various Sweet Athena features.
 * Higher levels result in more pronounced effects and animations.
 */
export type IntensityLevel = 
  | 'subtle'    // 1-3: Minimal effects, professional appearance
  | 'moderate'  // 4-7: Balanced effects, pleasant experience
  | 'strong';   // 8-10: Maximum effects, immersive experience

/**
 * Animation timing presets for consistent motion design.
 */
export type AnimationTiming = 
  | 'fast'    // 0.2s - Quick transitions and hover effects
  | 'medium'  // 0.4s - Standard UI transitions
  | 'slow'    // 0.8s - Emphasis and important state changes
  | 'divine'; // 1.2s - Special goddess-like transitions

/**
 * Available avatar rendering modes for different use cases.
 */
export type AvatarMode = 
  | '2d'           // Traditional 2D avatar representation
  | '3d'           // Full 3D ReadyPlayerMe integration
  | 'holographic'  // Special holographic effect overlay
  | 'simple'       // Minimal avatar for performance
  | 'portrait';    // Focus on facial expressions

/**
 * Theme variant options for Sweet Athena styling.
 */
export type ThemeVariant = 
  | 'goddess'    // Divine, ethereal styling with gold accents
  | 'modern'     // Clean, contemporary design
  | 'elegant'    // Sophisticated, classical appearance
  | 'playful'    // Vibrant, fun-oriented styling
  | 'minimal';   // Simple, distraction-free design

/**
 * Props interface for the main Sweet Athena component
 */
export interface SweetAthenaProps {
  /** Initial personality mood */
  initialMood?: PersonalityMood;
  
  /** Enable 3D avatar rendering */
  enableAvatar?: boolean;
  
  /** Enable voice interaction capabilities */
  enableVoice?: boolean;
  
  /** Enable animations and transitions */
  enableAnimation?: boolean;
  
  /** Custom theme configuration */
  theme?: any;
  
  /** Callback when mood changes */
  onMoodChange?: (mood: PersonalityMood) => void;
  
  /** Callback when message is sent/received */
  onMessage?: (message: any) => void;
  
  /** Callback when error occurs */
  onError?: (error: string) => void;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Additional HTML attributes */
  [key: string]: any;
}
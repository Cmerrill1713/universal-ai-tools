/**
 * Sweet Athena Types - Main Export Index
 * 
 * Centralized export point for all TypeScript types and interfaces used
 * throughout the Sweet Athena AI Assistant component system.
 * 
 * @fileoverview Main types export index
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

// Import types for internal use in union types
import type { PersonalityMood, EmotionalState, ThemeVariant, AvatarMode } from './core';
import type { AthenaTheme, AthenaThemeConfig, AthenaThemeProviderProps, ThemeUpdateOptions } from './theme';
import type { AvatarProps } from './avatar';
import type { ChatComponentProps, MessageComponentProps, ChatInputProps } from './chat';

// Core type definitions
export type {
  PersonalityMood,
  EmotionalState,
  IntensityLevel,
  AnimationTiming,
  AvatarMode,
  ThemeVariant,
  SweetAthenaProps,
} from './core';

// Theme and styling types
export type {
  PersonalityColors,
  PersonalityEffects,
  PersonalityAnimations,
  AthenaFonts,
  SweetnessConfig,
  PersonalityTheme,
  AthenaTheme,
  AthenaThemeConfig,
  AthenaThemeProviderProps,
  ThemeUpdateOptions,
  ThemeCSSProperty,
} from './theme';

export { ThemeCSSProperties } from './theme';

// Avatar and 3D types
export type {
  Vector3D,
  Rotation3D,
  AvatarAnimation,
  FacialExpression,
  AvatarLighting,
  AvatarCamera,
  ReadyPlayerMeConfig,
  ParticleSystemConfig,
  AvatarPhysics,
  AvatarConfig,
  AvatarState,
  AvatarEvents,
  AvatarProps,
} from './avatar';

export { AvatarAnimationPresets, FacialExpressionPresets } from './avatar';

// Chat and conversation types
export type {
  MessageRole,
  MessageType,
  MessageStatus,
  ChatMessage,
  MessageMetadata,
  MessageAttachment,
  MessageStyle,
  ConversationSession,
  ConversationConfig,
  SessionMetadata,
  TypingIndicator,
  ChatInputState,
  ChatEvents,
  ChatError,
  ChatComponentProps,
  MessageComponentProps,
  ChatInputProps,
} from './chat';

export { MessageTemplates } from './chat';

/**
 * Union type for all possible Sweet Athena component props.
 * Useful for generic component wrappers.
 */
export type AthenaComponentProps = 
  | AvatarProps 
  | ChatComponentProps 
  | MessageComponentProps 
  | ChatInputProps 
  | AthenaThemeProviderProps;

/**
 * Common props shared across all Sweet Athena components.
 */
export interface BaseAthenaProps {
  /** CSS class name for custom styling */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Whether to enable debug mode */
  debug?: boolean;
  /** Test ID for testing purposes */
  testId?: string;
  /** Accessibility label */
  ariaLabel?: string;
  /** Custom data attributes */
  dataAttributes?: Record<string, string>;
}

/**
 * Props for components that support personality configuration.
 */
export interface PersonalityAwareProps extends BaseAthenaProps {
  /** Current personality mood */
  personalityMood?: PersonalityMood;
  /** Sweetness level (1-10) */
  sweetnessLevel?: number;
  /** Callback when personality changes */
  onPersonalityChange?: (mood: PersonalityMood) => void;
}

/**
 * Props for components that support emotional state.
 */
export interface EmotionalAwareProps extends BaseAthenaProps {
  /** Current emotional state */
  emotionalState?: EmotionalState;
  /** Callback when emotional state changes */
  onEmotionChange?: (emotion: EmotionalState) => void;
}

/**
 * Combined props for fully personality and emotion aware components.
 */
export interface FullyAwareProps extends PersonalityAwareProps, EmotionalAwareProps {}

/**
 * Configuration for Sweet Athena component initialization.
 */
export interface AthenaConfig {
  /** Default personality mood */
  defaultMood: PersonalityMood;
  /** Default sweetness level */
  defaultSweetnessLevel: number;
  /** Default theme variant */
  defaultTheme: ThemeVariant;
  /** Default avatar mode */
  defaultAvatarMode: AvatarMode;
  /** Whether to enable animations by default */
  enableAnimations: boolean;
  /** Whether to enable debug mode by default */
  debugMode: boolean;
  /** Default language/locale */
  locale: string;
  /** Performance mode for lower-end devices */
  performanceMode: boolean;
  /** Custom component overrides */
  componentOverrides?: Record<string, React.ComponentType<any>>;
}

/**
 * Context value for Sweet Athena provider.
 */
export interface AthenaContextValue {
  /** Current configuration */
  config: AthenaConfig;
  /** Current theme */
  theme: AthenaTheme;
  /** Current personality mood */
  mood: PersonalityMood;
  /** Current sweetness level */
  sweetnessLevel: number;
  /** Current emotional state */
  emotion: EmotionalState;
  /** Whether animations are enabled */
  animationsEnabled: boolean;
  /** Whether debug mode is active */
  debugMode: boolean;
  /** Update functions */
  updateMood: (mood: PersonalityMood) => void;
  updateSweetnessLevel: (level: number) => void;
  updateEmotion: (emotion: EmotionalState) => void;
  updateTheme: (options: ThemeUpdateOptions) => void;
  updateConfig: (config: Partial<AthenaConfig>) => void;
}

/**
 * Hook return type for useAthena hook.
 */
export interface UseAthenaReturn extends AthenaContextValue {
  /** Whether Sweet Athena is fully initialized */
  isInitialized: boolean;
  /** Current loading state */
  isLoading: boolean;
  /** Any initialization errors */
  error?: Error;
  /** Utility functions */
  utils: {
    /** Create a new theme */
    createTheme: (config: AthenaThemeConfig) => AthenaTheme;
    /** Animate mood transition */
    animateMoodTransition: (fromMood: PersonalityMood, toMood: PersonalityMood) => Promise<void>;
    /** Get personality-appropriate greeting */
    getGreeting: () => string;
    /** Get personality-appropriate farewell */
    getFarewell: () => string;
  };
}

/**
 * Component factory return type for creating Sweet Athena components.
 */
export interface AthenaComponentFactory<T = any> {
  /** The created component */
  Component: React.ComponentType<T>;
  /** Default props for the component */
  defaultProps: Partial<T>;
  /** Component display name */
  displayName: string;
  /** Component version */
  version: string;
}
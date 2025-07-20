/**
 * Theme and styling type definitions for Sweet Athena
 * 
 * Defines the theme system that drives the visual appearance and personality
 * expression of the Sweet Athena AI assistant interface.
 * 
 * @fileoverview Theme system type definitions
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

import { DefaultTheme } from 'styled-components';
import { PersonalityMood, IntensityLevel, ThemeVariant } from './core';

/**
 * Color palette for a specific personality mood.
 * Each mood has its own carefully selected color scheme that reflects its character.
 */
export interface PersonalityColors {
  /** Primary color - main theme color for the personality */
  primary: string;
  /** Secondary color - supporting accent color */
  secondary: string;
  /** Accent color - highlights and special elements */
  accent: string;
  /** Soft color - subtle backgrounds and gentle touches */
  soft: string;
  /** Text color - for readable text content */
  text: string;
  /** Background color - main background for the personality */
  background: string;
}

/**
 * Visual effects configuration for personality expression.
 * Controls glows, shadows, and other mystical effects.
 */
export interface PersonalityEffects {
  /** Subtle glow effect for gentle emphasis */
  glowSoft: string;
  /** Medium glow effect for standard highlights */
  glowMedium: string;
  /** Strong glow effect for dramatic emphasis */
  glowStrong: string;
  /** Custom shadow for depth and personality */
  shadow: string;
  /** Shimmer effect for magical touches */
  shimmer?: string;
  /** Particle color for floating elements */
  particleColor?: string;
}

/**
 * Animation configuration for smooth personality transitions.
 * Defines timing and easing functions for different types of movements.
 */
export interface PersonalityAnimations {
  /** Fast transitions for immediate feedback */
  transitionFast: string;
  /** Medium transitions for standard UI changes */
  transitionMedium: string;
  /** Slow transitions for emphasis */
  transitionSlow: string;
  /** Divine transitions for special goddess effects */
  transitionDivine: string;
  /** Breathing animation duration for life-like movement */
  breathingDuration: string;
  /** Hover animation timing */
  hoverTiming: string;
}

/**
 * Typography configuration for personality expression.
 * Different fonts convey different aspects of Sweet Athena's character.
 */
export interface AthenaFonts {
  /** Elegant serif font for titles and important text */
  elegant: string;
  /** Modern sans-serif for body text and UI elements */
  modern: string;
  /** Divine decorative font for special emphasis */
  divine: string;
  /** Monospace font for code or technical content */
  code?: string;
}

/**
 * Sweetness level configuration affecting visual intensity.
 * Higher sweetness levels result in more pronounced visual effects.
 */
export interface SweetnessConfig {
  /** Numeric level from 1-10 */
  level: number;
  /** Calculated intensity category */
  intensity: IntensityLevel;
  /** Opacity multiplier for effects */
  opacityMultiplier: number;
  /** Scale factor for animations */
  scaleFactor: number;
  /** Particle count for floating elements */
  particleCount: number;
}

/**
 * Complete personality configuration combining all visual aspects.
 * This represents the full visual identity of a specific personality mood.
 */
export interface PersonalityTheme {
  /** Current personality mood */
  current: PersonalityMood;
  /** Color scheme for this personality */
  colors: PersonalityColors;
  /** Visual effects configuration */
  effects: PersonalityEffects;
  /** Animation timing and easing */
  animations: PersonalityAnimations;
  /** Special variant styling options */
  variant?: ThemeVariant;
}

/**
 * Complete Sweet Athena theme extending styled-components DefaultTheme.
 * This is the main theme object used throughout the component system.
 */
export interface AthenaTheme extends DefaultTheme {
  /** Personality-specific theming */
  personality: PersonalityTheme;
  /** Typography configuration */
  fonts: AthenaFonts;
  /** Sweetness level and related calculations */
  sweetness: SweetnessConfig;
  /** Theme metadata */
  meta: {
    /** Theme creation timestamp */
    created: Date;
    /** Theme version for compatibility */
    version: string;
    /** Optional theme name */
    name?: string;
    /** Optional theme description */
    description?: string;
  };
}

/**
 * Configuration options for creating a new theme.
 * Used by the theme factory functions to generate complete themes.
 */
export interface AthenaThemeConfig {
  /** Base personality mood */
  mood: PersonalityMood;
  /** Sweetness intensity level (1-10) */
  sweetnessLevel?: number;
  /** Theme variant for special styling */
  variant?: ThemeVariant;
  /** Custom color overrides */
  colorOverrides?: Partial<PersonalityColors>;
  /** Custom font overrides */
  fontOverrides?: Partial<AthenaFonts>;
  /** Custom animation timing overrides */
  animationOverrides?: Partial<PersonalityAnimations>;
  /** Theme name for identification */
  name?: string;
  /** Theme description */
  description?: string;
}

/**
 * Props for theme provider components.
 * Used to pass theme configuration down to child components.
 */
export interface AthenaThemeProviderProps {
  /** Theme configuration or pre-built theme */
  theme: AthenaTheme | AthenaThemeConfig;
  /** Child components to receive the theme */
  children: React.ReactNode;
  /** Optional className for the provider wrapper */
  className?: string;
}

/**
 * Dynamic theme update options.
 * Used for runtime theme modifications and smooth transitions.
 */
export interface ThemeUpdateOptions {
  /** New personality mood */
  mood?: PersonalityMood;
  /** New sweetness level */
  sweetnessLevel?: number;
  /** New theme variant */
  variant?: ThemeVariant;
  /** Whether to animate the transition */
  animated?: boolean;
  /** Transition duration override */
  transitionDuration?: string;
  /** Callback when transition completes */
  onTransitionComplete?: () => void;
}

/**
 * CSS custom property names used in the theme system.
 * Ensures consistency between styled-components and CSS custom properties.
 */
export const ThemeCSSProperties = {
  // Colors
  PRIMARY: '--athena-primary',
  SECONDARY: '--athena-secondary',
  ACCENT: '--athena-accent',
  SOFT: '--athena-soft',
  TEXT: '--athena-text',
  BACKGROUND: '--athena-background',
  
  // Effects
  GLOW_SOFT: '--athena-glow-soft',
  GLOW_MEDIUM: '--athena-glow-medium',
  GLOW_STRONG: '--athena-glow-strong',
  
  // Animations
  TRANSITION_FAST: '--athena-transition-fast',
  TRANSITION_MEDIUM: '--athena-transition-medium',
  TRANSITION_SLOW: '--athena-transition-slow',
  TRANSITION_DIVINE: '--athena-transition-divine',
  
  // Typography
  FONT_ELEGANT: '--athena-font-elegant',
  FONT_MODERN: '--athena-font-modern',
  FONT_DIVINE: '--athena-font-divine',
  
  // Sweetness
  SWEETNESS_LEVEL: '--athena-sweetness-level',
  SWEETNESS_INTENSITY: '--athena-sweetness-intensity',
} as const;

/**
 * Type for CSS custom property keys.
 */
export type ThemeCSSProperty = typeof ThemeCSSProperties[keyof typeof ThemeCSSProperties];
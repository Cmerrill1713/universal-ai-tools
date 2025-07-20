/**
 * Sweet Athena Theme System
 * 
 * Advanced theming system that provides personality-driven styling,
 * dynamic color schemes, and comprehensive design tokens for Sweet Athena.
 * 
 * @fileoverview Core theme system with personality-aware styling
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

// import { DefaultTheme } from 'styled-components';

import {
  AthenaTheme,
  AthenaThemeConfig,
  PersonalityColors,
  PersonalityEffects,
  PersonalityAnimations,
  AthenaFonts,
  SweetnessConfig,
  PersonalityTheme,
  ThemeCSSProperties
} from '../types/theme';

import {
  PersonalityMood,
  IntensityLevel
} from '../types/core';

/**
 * Base personality color schemes with carefully selected palettes.
 */
const personalityColorSchemes: Record<PersonalityMood, PersonalityColors> = {
  sweet: {
    primary: '#FFB6C1',      // Light Pink - main theme color
    secondary: '#DDA0DD',    // Plum - supporting accent
    accent: '#F0E68C',       // Khaki Gold - highlights
    soft: '#FFF0F5',         // Lavender Blush - subtle backgrounds
    text: '#2D2D2D',         // Dark gray for readability
    background: '#FEFEFE'    // Nearly white background
  },
  shy: {
    primary: '#E6E6FA',      // Lavender - gentle and soft
    secondary: '#D8BFD8',    // Thistle - muted complement
    accent: '#F5DEB3',       // Wheat - warm highlight
    soft: '#F8F8FF',         // Ghost White - very subtle
    text: '#3C3C3C',         // Slightly darker for shy personality
    background: '#FDFDFD'    // Clean, minimal background
  },
  confident: {
    primary: '#4169E1',      // Royal Blue - strong and bold
    secondary: '#6495ED',    // Cornflower - approachable blue
    accent: '#FFD700',       // Gold - confidence and success
    soft: '#F0F8FF',         // Alice Blue - professional base
    text: '#1A1A1A',         // Strong contrast for confidence
    background: '#FFFFFF'    // Pure white for clarity
  },
  caring: {
    primary: '#FFA07A',      // Light Salmon - warm and nurturing
    secondary: '#FFB6C1',    // Light Pink - gentle care
    accent: '#98FB98',       // Pale Green - growth and healing
    soft: '#FFF8DC',         // Cornsilk - comfort and warmth
    text: '#2F2F2F',         // Warm dark for caring nature
    background: '#FFFEF7'    // Slightly warm white
  },
  playful: {
    primary: '#FF69B4',      // Hot Pink - vibrant and fun
    secondary: '#DA70D6',    // Orchid - playful complement
    accent: '#00CED1',       // Dark Turquoise - energetic contrast
    soft: '#FFFACD',         // Lemon Chiffon - light and airy
    text: '#222222',         // Strong contrast for energy
    background: '#FFFFFB'    // Bright, cheerful background
  }
};

/**
 * Font configuration with personality-appropriate typefaces.
 */
const athenaFonts: AthenaFonts = {
  elegant: '"Crimson Text", "Playfair Display", "Georgia", serif',
  modern: '"Inter", "System UI", "Helvetica Neue", "Arial", sans-serif',
  divine: '"Cinzel", "Cormorant Garamond", "Times New Roman", serif',
  code: '"JetBrains Mono", "Fira Code", "Monaco", "Consolas", monospace'
};

/**
 * Generate personality effects based on colors and sweetness level.
 */
const createPersonalityEffects = (
  colors: PersonalityColors, 
  sweetnessLevel: number
): PersonalityEffects => {
  const baseOpacity = Math.min(0.1 + sweetnessLevel * 0.05, 0.8);
  
  return {
    glowSoft: `0 0 20px ${hexToRgba(colors.primary, baseOpacity)}`,
    glowMedium: `0 0 30px ${hexToRgba(colors.primary, baseOpacity * 1.5)}`,
    glowStrong: `0 0 40px ${hexToRgba(colors.primary, baseOpacity * 2)}`,
    shadow: `0 4px 20px ${hexToRgba(colors.primary, baseOpacity * 0.5)}`,
    shimmer: `0 0 15px ${hexToRgba(colors.accent, baseOpacity * 0.8)}`,
    particleColor: colors.accent
  };
};

/**
 * Create personality animations with mood-specific timing.
 */
const createPersonalityAnimations = (mood: PersonalityMood): PersonalityAnimations => {
  const baseTimings = {
    sweet: { fast: '0.3s', medium: '0.6s', slow: '1.0s', divine: '1.5s', breathing: '4s' },
    shy: { fast: '0.4s', medium: '0.8s', slow: '1.4s', divine: '2.0s', breathing: '5s' },
    confident: { fast: '0.2s', medium: '0.4s', slow: '0.8s', divine: '1.2s', breathing: '3s' },
    caring: { fast: '0.3s', medium: '0.7s', slow: '1.2s', divine: '1.8s', breathing: '4.5s' },
    playful: { fast: '0.2s', medium: '0.5s', slow: '0.9s', divine: '1.3s', breathing: '2.5s' }
  };
  
  const timings = baseTimings[mood];
  
  return {
    transitionFast: `${timings.fast} ease-out`,
    transitionMedium: `${timings.medium} ease-in-out`,
    transitionSlow: `${timings.slow} ease-in-out`,
    transitionDivine: `${timings.divine} cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
    breathingDuration: `${timings.breathing}`,
    hoverTiming: `${timings.fast} ease-out`
  };
};

/**
 * Calculate sweetness configuration based on level.
 */
const createSweetnessConfig = (level: number): SweetnessConfig => {
  const clampedLevel = Math.max(1, Math.min(10, level));
  
  let intensity: IntensityLevel;
  if (clampedLevel <= 3) intensity = 'subtle';
  else if (clampedLevel <= 7) intensity = 'moderate';
  else intensity = 'strong';
  
  return {
    level: clampedLevel,
    intensity,
    opacityMultiplier: 0.3 + (clampedLevel * 0.07),
    scaleFactor: 1 + (clampedLevel * 0.02),
    particleCount: Math.floor(clampedLevel * 8)
  };
};

/**
 * Utility function to convert hex color to rgba.
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  // Handle both #RGB and #RRGGBB formats
  const cleanHex = hex.replace('#', '');
  
  let r: number, g: number, b: number;
  
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else {
    r = parseInt(cleanHex.slice(0, 2), 16);
    g = parseInt(cleanHex.slice(2, 4), 16);
    b = parseInt(cleanHex.slice(4, 6), 16);
  }
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Create a complete Athena theme from configuration.
 * 
 * This is the main theme factory function that generates a complete
 * theme object with all personality-driven styling applied.
 */
export const createAthenaTheme = (
  mood: PersonalityMood = 'sweet',
  sweetnessLevel: number = 8,
  config?: Partial<AthenaThemeConfig>
): AthenaTheme => {
  // Get base colors for the mood
  const baseColors = personalityColorSchemes[mood];
  
  // Apply color overrides if provided
  const colors: PersonalityColors = {
    ...baseColors,
    ...config?.colorOverrides
  };
  
  // Create sweetness configuration
  const sweetness = createSweetnessConfig(sweetnessLevel);
  
  // Create personality-specific effects and animations
  const effects = createPersonalityEffects(colors, sweetnessLevel);
  const animations = createPersonalityAnimations(mood);
  
  // Merge fonts with overrides
  const fonts: AthenaFonts = {
    ...athenaFonts,
    ...config?.fontOverrides
  };
  
  // Create personality theme
  const personalityTheme: PersonalityTheme = {
    current: mood,
    colors,
    effects,
    animations,
    variant: config?.variant
  };
  
  // Create complete theme
  const theme: AthenaTheme = {
    personality: personalityTheme,
    fonts,
    sweetness,
    meta: {
      created: new Date(),
      version: '1.0.0',
      name: config?.name || `${mood} Athena`,
      description: config?.description || `Sweet Athena theme with ${mood} personality`
    }
  };
  
  return theme;
};

/**
 * Get CSS custom properties object from theme.
 * Useful for applying theme variables to CSS.
 */
export const getThemeCSSProperties = (theme: AthenaTheme): Record<string, string> => {
  return {
    [ThemeCSSProperties.PRIMARY]: theme.personality.colors.primary,
    [ThemeCSSProperties.SECONDARY]: theme.personality.colors.secondary,
    [ThemeCSSProperties.ACCENT]: theme.personality.colors.accent,
    [ThemeCSSProperties.SOFT]: theme.personality.colors.soft,
    [ThemeCSSProperties.TEXT]: theme.personality.colors.text,
    [ThemeCSSProperties.BACKGROUND]: theme.personality.colors.background,
    
    [ThemeCSSProperties.GLOW_SOFT]: theme.personality.effects.glowSoft,
    [ThemeCSSProperties.GLOW_MEDIUM]: theme.personality.effects.glowMedium,
    [ThemeCSSProperties.GLOW_STRONG]: theme.personality.effects.glowStrong,
    
    [ThemeCSSProperties.TRANSITION_FAST]: theme.personality.animations.transitionFast,
    [ThemeCSSProperties.TRANSITION_MEDIUM]: theme.personality.animations.transitionMedium,
    [ThemeCSSProperties.TRANSITION_SLOW]: theme.personality.animations.transitionSlow,
    [ThemeCSSProperties.TRANSITION_DIVINE]: theme.personality.animations.transitionDivine,
    
    [ThemeCSSProperties.FONT_ELEGANT]: theme.fonts.elegant,
    [ThemeCSSProperties.FONT_MODERN]: theme.fonts.modern,
    [ThemeCSSProperties.FONT_DIVINE]: theme.fonts.divine,
    
    [ThemeCSSProperties.SWEETNESS_LEVEL]: theme.sweetness.level.toString(),
    [ThemeCSSProperties.SWEETNESS_INTENSITY]: theme.sweetness.intensity
  };
};

/**
 * Apply theme CSS properties to document root.
 * Useful for global theme application.
 */
export const applyThemeToDocument = (theme: AthenaTheme): void => {
  if (typeof document === 'undefined') return;
  
  const properties = getThemeCSSProperties(theme);
  const root = document.documentElement;
  
  Object.entries(properties).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
};

/**
 * Helper functions for creating themed styles.
 */
export const themeHelpers = {
  /**
   * Create a personality-based gradient.
   */
  personalityGradient: (theme: AthenaTheme, direction = '135deg') => `
    linear-gradient(${direction}, 
      ${theme.personality.colors.primary} 0%,
      ${theme.personality.colors.secondary} 100%)
  `,
  
  /**
   * Create a soft background with personality colors.
   */
  personalityBackground: (theme: AthenaTheme, opacity = 0.1) => `
    linear-gradient(135deg, 
      ${hexToRgba(theme.personality.colors.primary, opacity)} 0%,
      ${hexToRgba(theme.personality.colors.secondary, opacity)} 50%,
      ${hexToRgba(theme.personality.colors.accent, opacity)} 100%)
  `,
  
  /**
   * Get mood-specific animation name.
   */
  getMoodAnimation: (mood: PersonalityMood) => {
    const animations = {
      sweet: 'athena-gentle-breathe',
      shy: 'athena-shy-sway',
      confident: 'athena-confident-rise',
      caring: 'athena-caring-pulse',
      playful: 'athena-playful-bounce'
    };
    return animations[mood];
  },
  
  /**
   * Calculate responsive sizing based on sweetness level.
   */
  sweetnessScale: (theme: AthenaTheme, baseSize: number) => {
    return baseSize * theme.sweetness.scaleFactor;
  },
  
  /**
   * Get personality-appropriate shadow.
   */
  personalityShadow: (theme: AthenaTheme, intensity: 'soft' | 'medium' | 'strong' = 'medium') => {
    switch (intensity) {
      case 'soft': return theme.personality.effects.glowSoft;
      case 'strong': return theme.personality.effects.glowStrong;
      default: return theme.personality.effects.glowMedium;
    }
  }
};

/**
 * Pre-built theme variants for common use cases.
 */
export const themePresets = {
  /** Minimal theme with subtle effects */
  minimal: (mood: PersonalityMood = 'sweet') => createAthenaTheme(mood, 3, {
    name: `Minimal ${mood}`,
    description: 'Clean and minimal theme with subtle personality touches'
  }),
  
  /** Balanced theme for general use */
  balanced: (mood: PersonalityMood = 'sweet') => createAthenaTheme(mood, 6, {
    name: `Balanced ${mood}`,
    description: 'Well-balanced theme perfect for most use cases'
  }),
  
  /** Immersive theme with maximum effects */
  immersive: (mood: PersonalityMood = 'sweet') => createAthenaTheme(mood, 10, {
    name: `Immersive ${mood}`,
    description: 'Full immersive experience with maximum personality effects'
  }),
  
  /** Professional theme for business use */
  professional: (mood: PersonalityMood = 'confident') => createAthenaTheme(mood, 4, {
    name: 'Professional',
    description: 'Professional theme suitable for business environments',
    variant: 'modern'
  })
};

/**
 * Default Sweet Athena theme.
 */
export const defaultAthenaTheme = createAthenaTheme('sweet', 8);

export default {
  createAthenaTheme,
  themeHelpers,
  themePresets,
  defaultAthenaTheme,
  hexToRgba,
  getThemeCSSProperties,
  applyThemeToDocument
};
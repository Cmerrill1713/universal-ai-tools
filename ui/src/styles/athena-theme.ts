/**
 * Sweet Athena Theme System
 * Styled-components theme that integrates with our custom CSS
 */

import { DefaultTheme } from 'styled-components';

export type PersonalityMood = 'sweet' | 'shy' | 'confident' | 'caring' | 'playful';

export interface AthenaTheme extends DefaultTheme {
  personality: {
    current: PersonalityMood;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      soft: string;
    };
    effects: {
      glowSoft: string;
      glowMedium: string;
      glowStrong: string;
    };
    animations: {
      transitionFast: string;
      transitionMedium: string;
      transitionSlow: string;
      transitionDivine: string;
    };
  };
  fonts: {
    elegant: string;
    modern: string;
    divine: string;
  };
  sweetness: {
    level: number; // 1-10
    intensity: 'subtle' | 'moderate' | 'strong';
  };
}

// Base personality color schemes
const personalityColors = {
  sweet: {
    primary: '#FFB6C1',    // Light Pink
    secondary: '#DDA0DD',  // Plum
    accent: '#F0E68C',     // Khaki Gold
    soft: '#FFF0F5',       // Lavender Blush
  },
  shy: {
    primary: '#E6E6FA',    // Lavender
    secondary: '#D8BFD8',  // Thistle
    accent: '#F5DEB3',     // Wheat
    soft: '#F8F8FF',       // Ghost White
  },
  confident: {
    primary: '#4169E1',    // Royal Blue
    secondary: '#6495ED',  // Cornflower
    accent: '#FFD700',     // Gold
    soft: '#F0F8FF',       // Alice Blue
  },
  caring: {
    primary: '#FFA07A',    // Light Salmon
    secondary: '#FFB6C1',  // Light Pink
    accent: '#98FB98',     // Pale Green
    soft: '#FFF8DC',       // Cornsilk
  },
  playful: {
    primary: '#FF69B4',    // Hot Pink
    secondary: '#DA70D6',  // Orchid
    accent: '#00CED1',     // Dark Turquoise
    soft: '#FFFACD',       // Lemon Chiffon
  },
};

// Create theme for specific personality
export const createAthenaTheme = (
  mood: PersonalityMood = 'sweet',
  sweetnessLevel: number = 8
): AthenaTheme => {
  const colors = personalityColors[mood];
  const intensity = sweetnessLevel <= 3 ? 'subtle' : sweetnessLevel <= 7 ? 'moderate' : 'strong';

  return {
    personality: {
      current: mood,
      colors,
      effects: {
        glowSoft: `0 0 20px rgba(255, 182, 193, ${0.1 + sweetnessLevel * 0.02})`,
        glowMedium: `0 0 30px rgba(255, 182, 193, ${0.2 + sweetnessLevel * 0.03})`,
        glowStrong: `0 0 40px rgba(255, 182, 193, ${0.3 + sweetnessLevel * 0.04})`,
      },
      animations: {
        transitionFast: '0.2s ease-out',
        transitionMedium: '0.4s ease-in-out',
        transitionSlow: '0.8s ease-in-out',
        transitionDivine: '1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
    },
    fonts: {
      elegant: '"Crimson Text", "Georgia", serif',
      modern: '"Inter", "Helvetica Neue", sans-serif',
      divine: '"Cinzel", "Times New Roman", serif',
    },
    sweetness: {
      level: sweetnessLevel,
      intensity,
    },
  };
};

// Default sweet theme
export const defaultAthenaTheme = createAthenaTheme('sweet', 8);

// Helper functions for dynamic styling
export const getPersonalityGradient = (theme: AthenaTheme, direction = '135deg') => `
  linear-gradient(${direction}, 
    ${theme.personality.colors.primary} 0%,
    ${theme.personality.colors.secondary} 100%)
`;

export const getPersonalityBackground = (theme: AthenaTheme, opacity = 0.1) => `
  linear-gradient(135deg, 
    ${hexToRgba(theme.personality.colors.primary, opacity)} 0%,
    ${hexToRgba(theme.personality.colors.secondary, opacity)} 50%,
    ${hexToRgba(theme.personality.colors.accent, opacity)} 100%)
`;

export const getSweetnessIntensity = (theme: AthenaTheme) => {
  const { level } = theme.sweetness;
  return {
    opacity: Math.min(0.4 + level * 0.06, 1),
    scale: Math.min(0.9 + level * 0.01, 1.1),
    blur: Math.max(10 - level, 2),
    glow: level * 0.1,
  };
};

// Utility function to convert hex to rgba
export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Animation helpers for different personalities
export const getPersonalityAnimation = (mood: PersonalityMood) => {
  const animations = {
    sweet: 'athena-gentle-breathe 4s ease-in-out infinite',
    shy: 'athena-shy-sway 6s ease-in-out infinite',
    confident: 'athena-confident-rise 3s ease-in-out infinite',
    caring: 'athena-caring-pulse 2s ease-in-out infinite',
    playful: 'athena-gentle-breathe 2s ease-in-out infinite',
  };
  return animations[mood];
};

// Mood transition helpers
export const getMoodTransition = (fromMood: PersonalityMood, toMood: PersonalityMood) => {
  // Define smooth transitions between personality states
  const transitionMap: Record<PersonalityMood, Record<PersonalityMood, string>> = {
    sweet: {
      shy: 'all 0.8s ease-out',
      confident: 'all 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      caring: 'all 0.6s ease-in-out',
      playful: 'all 0.4s ease-in-out',
      sweet: 'all 0.3s ease-in-out',
    },
    shy: {
      sweet: 'all 0.8s ease-in',
      confident: 'all 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      caring: 'all 1.0s ease-in-out',
      playful: 'all 1.2s ease-in-out',
      shy: 'all 0.3s ease-in-out',
    },
    confident: {
      sweet: 'all 1.0s ease-out',
      shy: 'all 1.5s ease-out',
      caring: 'all 0.8s ease-in-out',
      playful: 'all 0.6s ease-in-out',
      confident: 'all 0.3s ease-in-out',
    },
    caring: {
      sweet: 'all 0.6s ease-in',
      shy: 'all 1.0s ease-in-out',
      confident: 'all 0.8s ease-in-out',
      playful: 'all 0.7s ease-in-out',
      caring: 'all 0.3s ease-in-out',
    },
    playful: {
      sweet: 'all 0.5s ease-in',
      shy: 'all 1.2s ease-out',
      confident: 'all 0.6s ease-in-out',
      caring: 'all 0.7s ease-in-out',
      playful: 'all 0.3s ease-in-out',
    },
  };

  return transitionMap[fromMood]?.[toMood] || 'all 0.5s ease-in-out';
};

// CSS-in-JS helpers for styled-components
export const athenaCSS = {
  container: (theme: AthenaTheme) => `
    background: ${getPersonalityBackground(theme)};
    border-radius: 20px;
    overflow: hidden;
    transition: ${theme.personality.animations.transitionMedium};
    position: relative;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(45deg, 
        transparent 0%,
        rgba(255, 255, 255, 0.1) 50%,
        transparent 100%);
      opacity: 0;
      transition: opacity ${theme.personality.animations.transitionMedium};
      pointer-events: none;
    }
    
    &:hover::before {
      opacity: 1;
    }
  `,
  
  message: (theme: AthenaTheme, isAssistant = false) => `
    padding: 12px 16px;
    margin: 8px 0;
    border-radius: 12px;
    animation: athena-message-appear 0.4s ease-out;
    transition: ${theme.personality.animations.transitionFast};
    
    ${isAssistant ? `
      background: ${getPersonalityGradient(theme)};
      color: white;
      margin-right: 20%;
      border-bottom-left-radius: 4px;
      box-shadow: ${theme.personality.effects.glowSoft};
    ` : `
      background: linear-gradient(135deg, 
        rgba(255, 255, 255, 0.9) 0%,
        rgba(255, 255, 255, 0.7) 100%);
      color: #333;
      margin-left: 20%;
      border-bottom-right-radius: 4px;
    `}
  `,
  
  button: (theme: AthenaTheme, variant = 'primary') => `
    background: ${variant === 'primary' ? getPersonalityGradient(theme) : 'transparent'};
    color: ${variant === 'primary' ? 'white' : theme.personality.colors.primary};
    border: ${variant === 'primary' ? 'none' : `1px solid ${theme.personality.colors.primary}`};
    border-radius: 20px;
    padding: 10px 20px;
    font-family: ${theme.fonts.modern};
    font-weight: 500;
    cursor: pointer;
    transition: ${theme.personality.animations.transitionFast};
    box-shadow: ${variant === 'primary' ? theme.personality.effects.glowSoft : 'none'};
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${theme.personality.effects.glowMedium};
      ${variant === 'ghost' ? `background: ${hexToRgba(theme.personality.colors.primary, 0.1)};` : ''}
    }
    
    &:active {
      transform: translateY(0px);
    }
  `,
};

// Export theme types for TypeScript
export type { PersonalityMood, AthenaTheme };
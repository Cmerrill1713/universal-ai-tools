/**
 * Sweet Athena Theme System (Simple)
 * 
 * Simple theme system for Sweet Athena demo.
 * 
 * @fileoverview Simple theme system
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

import React from 'react';

// Simple theme object
export const athenaTheme = {
  colors: {
    primary: '#fbb6ce',
    secondary: '#f9a8d4', 
    accent: '#a78bfa',
    text: '#333333',
    background: '#ffffff'
  },
  fonts: {
    primary: 'Inter, sans-serif',
    heading: 'Inter, sans-serif'
  },
  spacing: {
    small: '8px',
    medium: '16px',
    large: '24px'
  }
};

export type AthenaTheme = typeof athenaTheme;

// Simple theme provider for consistency
export interface AthenaThemeProps {
  children: React.ReactNode;
  theme?: Partial<AthenaTheme>;
}

export const AthenaTheme: React.FC<AthenaThemeProps> = ({ children, theme }) => {
  // For demo purposes, just return children
  return <>{children}</>;
};

// Theme helper functions
export const createAthenaTheme = (overrides?: Partial<AthenaTheme>): AthenaTheme => {
  return { ...athenaTheme, ...overrides };
};

export const themeHelpers = {
  getColor: (color: keyof typeof athenaTheme.colors) => athenaTheme.colors[color],
  getSpacing: (size: keyof typeof athenaTheme.spacing) => athenaTheme.spacing[size]
};

export const themePresets = {
  default: athenaTheme,
  dark: {
    ...athenaTheme,
    colors: {
      ...athenaTheme.colors,
      background: '#1a1a1a',
      text: '#ffffff'
    }
  }
};

export const defaultAthenaTheme = athenaTheme;

export const hexToRgba = (hex: string, alpha: number = 1): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getThemeCSSProperties = (theme: AthenaTheme) => theme;

export const applyThemeToDocument = (theme: AthenaTheme) => {
  // Simple implementation for demo
  document.documentElement.style.setProperty('--athena-primary', theme.colors.primary);
  document.documentElement.style.setProperty('--athena-secondary', theme.colors.secondary);
};

export default AthenaTheme;
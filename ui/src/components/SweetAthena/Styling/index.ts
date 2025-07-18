/**
 * Sweet Athena Styling Components - Export Index
 * 
 * Centralized export point for all styling-related components including
 * themes, CSS utilities, and styling helpers.
 * 
 * @fileoverview Styling components export index
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

// Theme system
export {
  createAthenaTheme,
  themeHelpers,
  themePresets,
  defaultAthenaTheme,
  hexToRgba,
  getThemeCSSProperties,
  applyThemeToDocument
} from './AthenaTheme';

// CSS imports (for bundlers that support CSS imports)
import './AthenaCSS.css';

// Re-export theme-related types for convenience
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
} from '../types/theme';

export { ThemeCSSProperties } from '../types/theme';
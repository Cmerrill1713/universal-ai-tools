/**
 * Sweet Athena Personality Components - Export Index
 * 
 * Centralized export point for all personality-related components including
 * mood systems, emotional engines, and personality utilities.
 * 
 * @fileoverview Personality components export index
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

// Mood System
export { 
  MoodProvider, 
  useMood, 
  MoodIndicatorComponent 
} from './MoodSystem';

export type {
  MoodSystemConfig,
  MoodTransitionRules,
  MoodContextValue,
  MoodChangeOptions,
  MoodHistoryEntry,
  MoodProviderProps
} from './MoodSystem';

// Emotional Engine
export {
  useEmotionalEngine,
  EmotionalEngineProvider,
  useEmotionalEngineContext
} from './EmotionalEngine';

export type {
  EmotionalIntensity,
  EmotionalContext,
  EmotionalResponse,
  EmotionalEffect,
  EmotionalEngineConfig,
  EmotionalMemory,
  EmotionalEngineProviderProps
} from './EmotionalEngine';

// Re-export personality-related types for convenience
export type {
  PersonalityMood,
  EmotionalState,
  PersonalityAwareProps,
  EmotionalAwareProps,
  FullyAwareProps
} from '../types';
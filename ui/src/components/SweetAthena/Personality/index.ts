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

// Mood System - Basic exports from actual implementation
export { 
  MoodSystem,
  EmotionalEngine
} from './MoodSystem';

export type {
  MoodSystemProps
} from './MoodSystem';

// Emotional Engine - Basic exports from actual implementation  
export {
  EmotionalEngine as EmotionalEngineComponent
} from './EmotionalEngine';

export type {
  EmotionalEngineProps
} from './EmotionalEngine';

// Re-export personality-related types for convenience
export type {
  PersonalityMood,
  EmotionalState,
  PersonalityAwareProps,
  EmotionalAwareProps,
  FullyAwareProps
} from '../types';
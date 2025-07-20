/**
 * Sweet Athena Emotional Engine (Simple)
 * 
 * Simple emotional engine for Sweet Athena demo.
 * 
 * @fileoverview Simple emotional engine component
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

// import React from 'react';
import { MoodSystem } from './MoodSystem';
import type { MoodSystemProps } from './MoodSystem';

// Re-export the MoodSystem as EmotionalEngine for compatibility
export const EmotionalEngine = MoodSystem;
export type EmotionalEngineProps = MoodSystemProps;

export default EmotionalEngine;
/**
 * Sweet Athena Avatar Components - Export Index
 * 
 * Centralized export point for all avatar-related components including
 * 3D avatars, ReadyPlayerMe integration, and avatar utilities.
 * 
 * @fileoverview Avatar components export index
 * @author Sweet Athena Development Team
 * @version 1.0.0
 */

// Main avatar components
export { SweetAthenaAvatar } from './SweetAthenaAvatar';
export type { SweetAthenaAvatarProps } from './SweetAthenaAvatar';

export { ReadyPlayerMeAthena } from './ReadyPlayerMeAvatar';
export type { ReadyPlayerMeAthenaProps } from './ReadyPlayerMeAvatar';

// Re-export avatar-related types for convenience
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
} from '../types/avatar';

export { 
  AvatarAnimationPresets, 
  FacialExpressionPresets 
} from '../types/avatar';
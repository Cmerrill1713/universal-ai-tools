import React from 'react';

// Type definitions for the holographic material props
export interface HolographicMaterialProps {
  color?: string; // Add color property
  fresnelAmount?: number;
  fresnelOpacity?: number;
  scanlineSize?: number;
  hologramBrightness?: number;
  signalSpeed?: number;
  hologramColor?: string;
  hologramOpacity?: number;
  enableBlinking?: boolean;
  blinkFresnelOnly?: boolean;
  enableAdditive?: boolean;
  side?: 'FrontSide' | 'BackSide' | 'DoubleSide';
}

// Fallback component if holographic-material fails to load
const FallbackMaterial: React.FC<HolographicMaterialProps> = ({ color = '#00d4ff' }) => {
  return (
    <meshStandardMaterial 
      color={color}
      transparent
      opacity={0.7}
      emissive={color}
      emissiveIntensity={0.2}
      wireframe
    />
  );
};

// Try to import the holographic material, with fallback
let HolographicMaterialComponent: React.FC<HolographicMaterialProps>;

try {
  // Dynamic import with fallback
  const HolographicMaterialModule = require('holographic-material/src/HolographicMaterial');
  HolographicMaterialComponent = HolographicMaterialModule.default || HolographicMaterialModule;
} catch (error) {
  console.warn('HolographicMaterial not available, using fallback:', error);
  HolographicMaterialComponent = FallbackMaterial;
}

export const HolographicMaterial = HolographicMaterialComponent;
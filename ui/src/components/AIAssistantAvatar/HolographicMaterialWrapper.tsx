import HolographicMaterial from 'holographic-material/src/HolographicMaterial';

// Re-export with TypeScript support
export { HolographicMaterial };

// Type definitions for the holographic material props
export interface HolographicMaterialProps {
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

// Declare module for TypeScript
declare module 'holographic-material/src/HolographicMaterial' {
  const HolographicMaterial: React.FC<HolographicMaterialProps>;
  export default HolographicMaterial;
}
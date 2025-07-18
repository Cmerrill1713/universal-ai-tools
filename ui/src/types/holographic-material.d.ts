declare module 'holographic-material/src/HolographicMaterial' {
  import { FC } from 'react';
  
  interface HolographicMaterialProps {
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
  
  const HolographicMaterial: FC<HolographicMaterialProps>;
  export default HolographicMaterial;
}
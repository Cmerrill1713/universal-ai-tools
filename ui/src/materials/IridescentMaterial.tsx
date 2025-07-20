import React, { useMemo, useRef } from 'react';
import { extend, useFrame } from '@react-three/fiber';
import { ShaderMaterial, Vector3 } from 'three';
import { 
  iridescentVertexShader, 
  iridescentFragmentShader,
  getIridescentUniforms 
} from '../shaders/iridescent.glsl';

// Extend Three.js with our custom material
extend({ ShaderMaterial });

interface IridescentMaterialProps {
  thickness?: number;
  ior?: number; // Index of refraction
  baseColor?: [number, number, number];
  intensity?: number;
  roughness?: number;
  morphAmount?: number;
  animationSpeed?: number;
}

/**
 * Iridescent Material Component
 * Creates beautiful rainbow/oil-slick effects with thin-film interference
 */
export const IridescentMaterial: React.FC<IridescentMaterialProps> = ({
  thickness = 300,
  ior = 1.3,
  baseColor = [0.9, 0.85, 0.95],
  intensity = 0.8,
  roughness = 0.1,
  morphAmount = 0.5,
  animationSpeed = 1.0
}) => {
  const materialRef = useRef<ShaderMaterial>(null);
  
  // Create uniforms with memoization
  const uniforms = useMemo(() => {
    const unis = getIridescentUniforms();
    unis.thickness.value = thickness;
    unis.ior.value = ior;
    unis.baseColor.value = baseColor;
    unis.intensity.value = intensity;
    unis.roughness.value = roughness;
    unis.morphAmount.value = morphAmount;
    return unis;
  }, [thickness, ior, baseColor, intensity, roughness, morphAmount]);

  // Animate the material
  useFrame(({ clock, camera }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime() * animationSpeed;
      materialRef.current.uniforms.cameraPosition.value = camera.position.toArray();
    }
  });

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={iridescentVertexShader}
      fragmentShader={iridescentFragmentShader}
      transparent={false}
    />
  );
};

// Hook for using iridescent material imperatively
export const useIridescentMaterial = (props?: IridescentMaterialProps) => {
  const material = useMemo(() => {
    const uniforms = getIridescentUniforms();
    if (props) {
      if (props.thickness !== undefined) uniforms.thickness.value = props.thickness;
      if (props.ior !== undefined) uniforms.ior.value = props.ior;
      if (props.baseColor !== undefined) uniforms.baseColor.value = props.baseColor;
      if (props.intensity !== undefined) uniforms.intensity.value = props.intensity;
      if (props.roughness !== undefined) uniforms.roughness.value = props.roughness;
      if (props.morphAmount !== undefined) uniforms.morphAmount.value = props.morphAmount;
    }
    
    return new ShaderMaterial({
      uniforms,
      vertexShader: iridescentVertexShader,
      fragmentShader: iridescentFragmentShader,
      transparent: false
    });
  }, [props]);

  useFrame(({ clock, camera }) => {
    material.uniforms.time.value = clock.getElapsedTime() * (props?.animationSpeed || 1.0);
    material.uniforms.cameraPosition.value = camera.position.toArray();
  });

  return material;
};
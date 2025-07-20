import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { QualitySettings } from '../../hooks/usePerformanceMonitor';

interface MobileOptimizedParticlesProps {
  count?: number;
  size?: number;
  color?: string;
  opacity?: number;
  speed?: number;
  spread?: number;
  qualitySettings: QualitySettings;
  blending?: THREE.Blending;
  depthWrite?: boolean;
  vertexColors?: boolean;
}

export const MobileOptimizedParticles: React.FC<MobileOptimizedParticlesProps> = ({
  count = 1000,
  size = 0.1,
  color = '#ffffff',
  opacity = 0.6,
  speed = 1,
  spread = 10,
  qualitySettings,
  blending = THREE.AdditiveBlending,
  depthWrite = false,
  vertexColors = false
}) => {
  const particlesRef = useRef<THREE.Points>(null);
  
  // Adjust particle count based on quality settings
  const adjustedCount = Math.floor(count * (qualitySettings.particleCount / 1000));
  const adjustedSize = size * qualitySettings.particleSize;
  
  // Generate particle positions and attributes
  const particleData = useMemo(() => {
    const positions = new Float32Array(adjustedCount * 3);
    const colors = new Float32Array(adjustedCount * 3);
    const sizes = new Float32Array(adjustedCount);
    const velocities = new Float32Array(adjustedCount * 3);
    
    const color3 = new THREE.Color(color);
    
    for (let i = 0; i < adjustedCount; i++) {
      // Position
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      
      // Color with slight variation
      if (vertexColors) {
        const hsl = color3.getHSL({ h: 0, s: 0, l: 0 });
        const variedColor = new THREE.Color().setHSL(
          hsl.h + (Math.random() - 0.5) * 0.1,
          hsl.s,
          hsl.l + (Math.random() - 0.5) * 0.2
        );
        colors[i * 3] = variedColor.r;
        colors[i * 3 + 1] = variedColor.g;
        colors[i * 3 + 2] = variedColor.b;
      } else {
        colors[i * 3] = color3.r;
        colors[i * 3 + 1] = color3.g;
        colors[i * 3 + 2] = color3.b;
      }
      
      // Size variation
      sizes[i] = adjustedSize * (0.5 + Math.random() * 0.5);
      
      // Velocity
      velocities[i * 3] = (Math.random() - 0.5) * speed;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * speed;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * speed;
    }
    
    return { positions, colors, sizes, velocities };
  }, [adjustedCount, adjustedSize, color, spread, speed, vertexColors]);

  // Create geometry
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(particleData.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(particleData.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(particleData.sizes, 1));
    geo.setAttribute('velocity', new THREE.BufferAttribute(particleData.velocities, 3));
    return geo;
  }, [particleData]);

  // Create material with mobile optimizations
  const material = useMemo(() => {
    const vertexShader = `
      attribute float size;
      attribute vec3 velocity;
      varying vec3 vColor;
      uniform float time;
      uniform float renderScale;
      
      void main() {
        vColor = color;
        
        vec3 pos = position + velocity * time;
        
        // Wrap around
        pos = mod(pos + ${spread}.0, ${spread * 2}.0) - ${spread}.0;
        
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z) * renderScale;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform float opacity;
      varying vec3 vColor;
      
      void main() {
        // Simple circular particle
        vec2 center = gl_PointCoord - 0.5;
        float dist = length(center);
        
        if (dist > 0.5) discard;
        
        float alpha = smoothstep(0.5, 0.3, dist) * opacity;
        gl_FragColor = vec4(vColor, alpha);
      }
    `;

    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: opacity },
        renderScale: { value: qualitySettings.renderScale }
      },
      vertexShader,
      fragmentShader,
      blending,
      depthWrite,
      transparent: true,
      vertexColors: true
    });
  }, [opacity, qualitySettings.renderScale, blending, depthWrite, spread]);

  // Animation
  useFrame((state, delta) => {
    if (particlesRef.current && material) {
      material.uniforms.time.value += delta * 0.5;
      
      // Rotate particles slowly
      particlesRef.current.rotation.y += delta * 0.1;
      particlesRef.current.rotation.x += delta * 0.05;
    }
  });

  return (
    <points ref={particlesRef} geometry={geometry} material={material} />
  );
};

// Optimized particle system for specific effects
interface ParticleEffectProps {
  type: 'stars' | 'dust' | 'sparkles' | 'smoke' | 'fire';
  qualitySettings: QualitySettings;
}

export const ParticleEffect: React.FC<ParticleEffectProps> = ({ type, qualitySettings }) => {
  const configs = {
    stars: {
      count: 2000,
      size: 0.02,
      color: '#ffffff',
      opacity: 0.8,
      speed: 0.1,
      spread: 50,
      blending: THREE.AdditiveBlending
    },
    dust: {
      count: 500,
      size: 0.05,
      color: '#d4c5a0',
      opacity: 0.3,
      speed: 0.2,
      spread: 20,
      blending: THREE.NormalBlending
    },
    sparkles: {
      count: 300,
      size: 0.08,
      color: '#ffdd00',
      opacity: 0.9,
      speed: 0.5,
      spread: 15,
      blending: THREE.AdditiveBlending
    },
    smoke: {
      count: 200,
      size: 0.3,
      color: '#888888',
      opacity: 0.2,
      speed: 0.3,
      spread: 10,
      blending: THREE.NormalBlending
    },
    fire: {
      count: 400,
      size: 0.15,
      color: '#ff4400',
      opacity: 0.7,
      speed: 1.0,
      spread: 5,
      blending: THREE.AdditiveBlending
    }
  };

  const config = configs[type];
  
  return (
    <MobileOptimizedParticles
      {...config}
      qualitySettings={qualitySettings}
      vertexColors={type === 'fire' || type === 'sparkles'}
    />
  );
};

// Batched particle system for multiple effects
interface BatchedParticleSystemProps {
  effects: Array<{
    type: ParticleEffectProps['type'];
    position?: [number, number, number];
    scale?: number;
  }>;
  qualitySettings: QualitySettings;
}

export const BatchedParticleSystem: React.FC<BatchedParticleSystemProps> = ({
  effects,
  qualitySettings
}) => {
  // Limit number of effects based on quality
  const maxEffects = Math.floor(effects.length * qualitySettings.textureQuality);
  const limitedEffects = effects.slice(0, maxEffects);

  return (
    <>
      {limitedEffects.map((effect, index) => (
        <group
          key={index}
          position={effect.position || [0, 0, 0]}
          scale={effect.scale || 1}
        >
          <ParticleEffect type={effect.type} qualitySettings={qualitySettings} />
        </group>
      ))}
    </>
  );
};
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useAdaptiveQuality } from '../Performance/AdaptiveQualityManager';
import { useComponentPerformance } from '../../hooks/usePerformanceMonitor';

interface ParticleSystemProps {
  count?: number;
  isActive?: boolean;
  color?: string;
}

export function ParticleSystem({ 
  count = 1000, 
  isActive = false,
  color = '#00ffff'
}: ParticleSystemProps) {
  const particlesRef = useRef<THREE.Points>(null);
  const { getParticleCount, shouldEnableEffect } = useAdaptiveQuality();
  const { renderCount } = useComponentPerformance('ParticleSystem');
  
  // Adaptive particle count based on quality settings
  const adaptiveCount = getParticleCount(count);
  
  // Generate particle positions and velocities
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(adaptiveCount * 3);
    const vel = new Float32Array(adaptiveCount * 3);
    
    for (let i = 0; i < adaptiveCount; i++) {
      // Random position within sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 1.5 + Math.random() * 1.5;
      
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
      
      // Random velocity
      vel[i * 3] = (Math.random() - 0.5) * 0.02;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }
    
    return [pos, vel];
  }, [adaptiveCount]);
  
  useFrame((state) => {
    if (!particlesRef.current) return;
    
    const time = state.clock.getElapsedTime();
    const geometry = particlesRef.current.geometry;
    const positionAttribute = geometry.attributes.position;
    const positions = positionAttribute.array as Float32Array;
    
    // Update particle positions (optimized loop)
    for (let i = 0; i < adaptiveCount; i++) {
      const idx = i * 3;
      
      // Get current position
      let x = positions[idx];
      let y = positions[idx + 1];
      let z = positions[idx + 2];
      
      // Calculate distance from center
      const dist = Math.sqrt(x * x + y * y + z * z);
      
      // Apply velocities with neural flow pattern
      if (isActive) {
        // Spiral motion towards center
        const angle = Math.atan2(y, x);
        const spiralSpeed = 0.02;
        
        x += Math.cos(angle + spiralSpeed) * velocities[idx] * 2;
        y += Math.sin(angle + spiralSpeed) * velocities[idx + 1] * 2;
        z += velocities[idx + 2] * Math.sin(time + i * 0.01);
        
        // Pull towards center when far
        if (dist > 3) {
          x *= 0.98;
          y *= 0.98;
          z *= 0.98;
        }
      } else {
        // Gentle floating motion
        x += velocities[idx];
        y += velocities[idx + 1];
        z += velocities[idx + 2];
      }
      
      // Reset particles that go too far
      if (dist > 4 || dist < 0.5) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 1.5 + Math.random() * 1.5;
        
        x = radius * Math.sin(phi) * Math.cos(theta);
        y = radius * Math.sin(phi) * Math.sin(theta);
        z = radius * Math.cos(phi);
      }
      
      // Update position
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
    }
    
    // Mark geometry as needing update
    positionAttribute.needsUpdate = true;
    
    // Rotate entire system slowly
    particlesRef.current.rotation.y = time * 0.05;
  });
  
  return (
    <Points ref={particlesRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color={color}
        size={isActive ? 0.03 : 0.02}
        sizeAttenuation={shouldEnableEffect('antialiasing')}
        alphaTest={0.001}
        opacity={isActive ? 0.8 : 0.4}
        vertexColors={false}
        blending={shouldEnableEffect('enableBloom') ? THREE.AdditiveBlending : THREE.NormalBlending}
        depthWrite={false}
      />
    </Points>
  );
}
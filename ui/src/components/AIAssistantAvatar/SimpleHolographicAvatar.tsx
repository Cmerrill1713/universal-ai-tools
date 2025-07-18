import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { HolographicMaterial } from './HolographicMaterialWrapper';
import * as THREE from 'three';

interface SimpleHolographicAvatarProps {
  isThinking?: boolean;
  isSpeaking?: boolean;
}

export function SimpleHolographicAvatar({ 
  isThinking = false,
  isSpeaking = false
}: SimpleHolographicAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (groupRef.current) {
      // Gentle floating animation
      groupRef.current.position.y = Math.sin(time * 0.5) * 0.1;
      
      // Subtle rotation when thinking
      if (isThinking) {
        groupRef.current.rotation.y = Math.sin(time * 0.3) * 0.1;
      }
    }
    
    if (headRef.current && isSpeaking) {
      // Add speaking animation
      const scale = 1 + Math.sin(time * 8) * 0.02;
      headRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={groupRef} scale={2}>
      {/* Body */}
      <mesh ref={bodyRef} position={[0, -0.5, 0]}>
        <capsuleGeometry args={[0.3, 0.8, 8, 16]} />
        <HolographicMaterial
          fresnelAmount={0.8}
          fresnelOpacity={0.9}
          scanlineSize={20}
          hologramBrightness={1.8}
          signalSpeed={isSpeaking ? 1.0 : 0.3}
          hologramColor="#00b4d8"
          enableBlinking={false}
          enableAdditive={true}
          side="DoubleSide"
        />
      </mesh>
      
      {/* Head */}
      <mesh ref={headRef} position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <HolographicMaterial
          fresnelAmount={0.6}
          fresnelOpacity={0.95}
          scanlineSize={30}
          hologramBrightness={2.0}
          signalSpeed={isSpeaking ? 1.5 : 0.5}
          hologramColor="#00d4ff"
          enableBlinking={false}
          enableAdditive={true}
          side="FrontSide"
        />
      </mesh>
      
      {/* Data flow lines */}
      {Array.from({ length: 20 }).map((_, i) => (
        <DataFlowLine 
          key={i} 
          index={i} 
          isActive={isThinking || isSpeaking} 
        />
      ))}
    </group>
  );
}

// Data flow line component
function DataFlowLine({ index, isActive }: { index: number; isActive: boolean }) {
  const lineRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (lineRef.current) {
      const time = state.clock.getElapsedTime();
      const offset = index * 0.3;
      lineRef.current.position.y = ((time * 0.5 + offset) % 3) - 1.5;
      (lineRef.current.material as THREE.MeshBasicMaterial).opacity = isActive ? 0.6 : 0.2;
    }
  });
  
  const angle = (index / 20) * Math.PI * 2;
  const radius = 0.8;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  
  return (
    <mesh ref={lineRef} position={[x, 0, z]}>
      <boxGeometry args={[0.01, 0.3, 0.01]} />
      <meshBasicMaterial
        color="#00b4d8"
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
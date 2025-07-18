import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HolographicMaterial } from './HolographicMaterialWrapper';

interface NeuralHeadProps {
  isThinking?: boolean;
  isSpeaking?: boolean;
}

export function NeuralHead({ isThinking = false, isSpeaking = false }: NeuralHeadProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const innerMeshRef = useRef<THREE.Mesh>(null);
  
  // Create neural network points
  const neuralPoints = useMemo(() => {
    const points = [];
    const spherical = new THREE.Spherical();
    
    // Generate points on sphere surface
    for (let i = 0; i < 200; i++) {
      spherical.radius = 1.8 + Math.random() * 0.2;
      spherical.phi = Math.random() * Math.PI;
      spherical.theta = Math.random() * Math.PI * 2;
      
      const point = new THREE.Vector3();
      point.setFromSpherical(spherical);
      points.push(point);
    }
    
    return points;
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (meshRef.current) {
      // Subtle rotation
      meshRef.current.rotation.y = Math.sin(time * 0.2) * 0.1;
      
      // Pulsing effect when thinking
      if (isThinking) {
        const scale = 1 + Math.sin(time * 3) * 0.05;
        meshRef.current.scale.setScalar(scale);
      } else {
        meshRef.current.scale.setScalar(1);
      }
    }
    
    if (innerMeshRef.current && isSpeaking) {
      // Distortion when speaking
      const scale = 1 + Math.sin(time * 8) * 0.02;
      innerMeshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group>
      {/* Main holographic head */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <HolographicMaterial
          color="#00d4ff"
          fresnelAmount={2.0}
          fresnelOpacity={0.8}
          scanlineSize={10}
          hologramBrightness={1.5}
          signalSpeed={isSpeaking ? 2.0 : 0.5}
        />
      </mesh>
      
      {/* Inner core with different pattern */}
      <mesh ref={innerMeshRef} scale={0.7}>
        <sphereGeometry args={[2, 32, 32]} />
        <HolographicMaterial
          color="#0088ff"
          fresnelAmount={3.0}
          fresnelOpacity={0.4}
          scanlineSize={20}
          hologramBrightness={0.8}
          signalSpeed={1.5}
        />
      </mesh>
      
      {/* Neural nodes */}
      {neuralPoints.map((point, i) => (
        <mesh key={i} position={point}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial 
            color="#00ffff" 
            emissive="#00ffff"
            emissiveIntensity={isThinking ? 2 : 1}
          />
        </mesh>
      ))}
      
      {/* Wireframe overlay */}
      <mesh>
        <sphereGeometry args={[2.1, 16, 16]} />
        <meshBasicMaterial 
          color="#00ffff" 
          wireframe 
          transparent 
          opacity={0.1}
        />
      </mesh>
    </group>
  );
}
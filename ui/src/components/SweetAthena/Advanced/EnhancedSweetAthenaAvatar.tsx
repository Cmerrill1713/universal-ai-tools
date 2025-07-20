import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Float,
  MeshDistortMaterial,
  MeshTransmissionMaterial,
  Sparkles,
  Trail,
  Cloud,
  Environment,
  ContactShadows,
  Outlines,
  useCursor,
  PresentationControls,
  Sphere,
  Box,
  Octahedron,
  Torus,
  TorusKnot
} from '@react-three/drei';
import { 
  EffectComposer, 
  Bloom, 
  ChromaticAberration, 
  Vignette,
  DepthOfField,
  Noise,
  Glitch,
  SelectiveBloom,
  SSAO,
  HueSaturation,
  BrightnessContrast,
  ColorAverage,
  Sepia,
  DotScreen,
  Scanline
} from '@react-three/postprocessing';
import { KernelSize, GlitchMode, BlendFunction } from 'postprocessing';
import { HolographicMaterial } from 'holographic-material';
import { NebulaParticleSystem } from '../NebulaParticleSystem';

interface EnhancedSweetAthenaAvatarProps {
  mood?: 'sweet' | 'thoughtful' | 'excited' | 'mysterious' | 'powerful';
  isThinking?: boolean;
  isSpeaking?: boolean;
  onInteraction?: () => void;
}

/**
 * Enhanced Sweet Athena Avatar using existing libraries
 * Maximizes use of drei and postprocessing effects
 */
export const EnhancedSweetAthenaAvatar: React.FC<EnhancedSweetAthenaAvatarProps> = ({
  mood = 'sweet',
  isThinking = false,
  isSpeaking = false,
  onInteraction
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const innerSphereRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();
  
  useCursor(hovered);

  // Dynamic mood colors
  const moodConfigs = {
    sweet: {
      primary: '#ff6b9d',
      secondary: '#c44569',
      accent: '#feca57',
      glow: '#ff9ff3',
      transmission: 0.9,
      roughness: 0.1,
      metalness: 0.2,
      distort: 0.4,
      speed: 2
    },
    thoughtful: {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#48dbfb',
      glow: '#0abde3',
      transmission: 0.95,
      roughness: 0.05,
      metalness: 0.3,
      distort: 0.3,
      speed: 1
    },
    excited: {
      primary: '#f093fb',
      secondary: '#f5576c',
      accent: '#ffd93d',
      glow: '#ff6bcb',
      transmission: 0.85,
      roughness: 0.15,
      metalness: 0.4,
      distort: 0.6,
      speed: 4
    },
    mysterious: {
      primary: '#30336b',
      secondary: '#130f40',
      accent: '#e056fd',
      glow: '#be2edd',
      transmission: 0.98,
      roughness: 0.02,
      metalness: 0.5,
      distort: 0.2,
      speed: 0.5
    },
    powerful: {
      primary: '#ee5a24',
      secondary: '#f8b500',
      accent: '#ff3838',
      glow: '#ffa502',
      transmission: 0.8,
      roughness: 0.2,
      metalness: 0.6,
      distort: 0.8,
      speed: 3
    }
  };

  const config = moodConfigs[mood];

  // Neural network visualization nodes
  const neuralNodes = useMemo(() => {
    const nodes = [];
    const nodeCount = 20;
    for (let i = 0; i < nodeCount; i++) {
      const theta = (i / nodeCount) * Math.PI * 2;
      const radius = 2 + Math.random() * 0.5;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      const y = (Math.random() - 0.5) * 2;
      nodes.push({ position: [x, y, z] as [number, number, number], id: i });
    }
    return nodes;
  }, []);

  // Animate the main mesh
  useFrame(({ clock }) => {
    if (meshRef.current) {
      // Thinking animation
      if (isThinking) {
        meshRef.current.rotation.y = Math.sin(clock.elapsedTime * 2) * 0.3;
        meshRef.current.rotation.x = Math.cos(clock.elapsedTime * 1.5) * 0.2;
      } else {
        meshRef.current.rotation.y = clock.elapsedTime * 0.2;
      }

      // Speaking animation
      if (isSpeaking) {
        const scale = 1 + Math.sin(clock.elapsedTime * 10) * 0.05;
        meshRef.current.scale.setScalar(scale);
      }
    }

    // Animate inner sphere
    if (innerSphereRef.current) {
      innerSphereRef.current.rotation.x = clock.elapsedTime * -0.5;
      innerSphereRef.current.rotation.y = clock.elapsedTime * 0.3;
    }
  });

  return (
    <>
      {/* Environment for realistic reflections */}
      <Environment preset="sunset" />
      
      {/* Main avatar group */}
      <PresentationControls
        global
        rotation={[0.13, 0.1, 0]}
        polar={[-0.4, 0.2]}
        azimuth={[-1, 0.75]}
        config={{ mass: 2, tension: 400 }}
        snap={{ mass: 4, tension: 400 }}
      >
        <Float
          speed={config.speed}
          rotationIntensity={0.4}
          floatIntensity={0.3}
          floatingRange={[-0.1, 0.1]}
        >
          {/* Main holographic sphere with transmission material */}
          <mesh
            ref={meshRef}
            onClick={onInteraction}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            scale={hovered ? 1.1 : 1}
          >
            <sphereGeometry args={[1.5, 64, 64]} />
            <MeshTransmissionMaterial
              color={config.primary}
              transmission={config.transmission}
              roughness={config.roughness}
              metalness={config.metalness}
              thickness={0.5}
              chromaticAberration={0.1}
              anisotropy={0.3}
              distortion={1}
              distortionScale={0.5}
              temporalDistortion={0.2}
            />
            <Outlines thickness={0.02} color={config.glow} />
          </mesh>

          {/* Inner morphing sphere */}
          <mesh ref={innerSphereRef} scale={0.8}>
            <octahedronGeometry args={[1, 3]} />
            <MeshDistortMaterial
              color={config.secondary}
              distort={config.distort}
              speed={config.speed}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>

          {/* Orbiting elements */}
          {isThinking && (
            <>
              <Trail
                width={2}
                length={10}
                color={new THREE.Color(config.accent)}
                attenuation={(width) => width}
              >
                <mesh position={[1.5, 0, 0]}>
                  <torusGeometry args={[0.1, 0.05, 8, 16]} />
                  <meshStandardMaterial
                    color={config.accent}
                    emissive={config.accent}
                    emissiveIntensity={2}
                  />
                </mesh>
              </Trail>

              {/* Neural network nodes */}
              {neuralNodes.map((node) => (
                <Trail
                  key={node.id}
                  width={0.5}
                  length={5}
                  color={new THREE.Color(config.glow)}
                  attenuation={(width) => width}
                >
                  <Sparkles
                    count={10}
                    scale={0.5}
                    size={1}
                    speed={0.5}
                    position={node.position}
                    color={config.glow}
                  />
                </Trail>
              ))}
            </>
          )}

          {/* Sparkle effects */}
          <Sparkles
            count={100}
            scale={3}
            size={2}
            speed={0.5}
            color={config.accent}
          />

          {/* Volumetric clouds for mystical effect */}
          {mood === 'mysterious' && (
            <Cloud
              opacity={0.3}
              speed={0.4}
              width={10}
              depth={1.5}
              segments={20}
            />
          )}
        </Float>
      </PresentationControls>

      {/* Contact shadows for grounding */}
      <ContactShadows
        opacity={0.4}
        scale={10}
        blur={2}
        far={10}
        position={[0, -2, 0]}
        color={config.primary}
      />

      {/* Advanced post-processing effects */}
      <EffectComposer>
        {/* Selective bloom for glowing elements */}
        <Bloom
          intensity={1.5}
          kernelSize={KernelSize.LARGE}
          luminanceThreshold={0.8}
          luminanceSmoothing={0.025}
        />
        
        {/* Depth of field for focus */}
        <DepthOfField
          focusDistance={0}
          focalLength={0.02}
          bokehScale={2}
          height={480}
        />
        
        {/* Screen space ambient occlusion */}
        <SSAO
          samples={30}
          radius={0.1}
          intensity={20}
          luminanceInfluence={0.5}
          color="black"
        />
        
        {/* Chromatic aberration for holographic effect */}
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={[0.002, 0.002]}
        />
        
        {/* Glitch effect when processing */}
        {isThinking && (
          <Glitch
            delay={[1.5, 3.5]}
            duration={[0.1, 0.3]}
            strength={[0.3, 0.5]}
            mode={GlitchMode.SPORADIC}
            active
            ratio={0.2}
          />
        )}
        
        {/* Scanline for retro-futuristic feel */}
        <Scanline
          blendFunction={BlendFunction.OVERLAY}
          density={1.25}
          opacity={0.1}
        />
        
        {/* Color grading based on mood */}
        <HueSaturation
          blendFunction={BlendFunction.NORMAL}
          hue={mood === 'powerful' ? 0.1 : 0}
          saturation={0.1}
        />
        
        {/* Vignette for focus */}
        <Vignette offset={0.3} darkness={0.4} />
        
        {/* Subtle noise for texture */}
        <Noise
          premultiply
          blendFunction={BlendFunction.ADD}
          opacity={0.02}
        />
      </EffectComposer>

      {/* Particle system using three-nebula */}
      <NebulaParticleSystem
        mood={mood}
        isActive={isSpeaking || isThinking}
        position={[0, 0, 0]}
      />
    </>
  );
};
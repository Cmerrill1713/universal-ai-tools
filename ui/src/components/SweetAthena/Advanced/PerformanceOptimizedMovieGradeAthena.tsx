import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Float,
  MeshTransmissionMaterial,
  MeshDistortMaterial,
  MeshRefractionMaterial,
  MeshReflectorMaterial,
  Sparkles,
  Cloud,
  Environment,
  ContactShadows,
  Html,
  PresentationControls,
  Text,
  Trail,
  useTexture,
  Stars,
  Sphere
} from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  ChromaticAberration,
  SSAO,
  Glitch,
  Scanline,
  Vignette,
  HueSaturation,
  BrightnessContrast
} from '@react-three/postprocessing';
import { Physics, useBox, useSphere, usePlane } from '@react-three/cannon';
import { gsap } from 'gsap';
import { useSpring, a } from '@react-spring/three';
import { useControls, folder } from 'leva';
import { VoiceAmplitudeVisualizer, useVoiceAmplitude } from './VoiceAmplitudeVisualizer';
import { usePerformanceMonitor } from '../../../hooks/usePerformanceMonitor';
import { 
  MobileOptimizedParticles, 
  ParticleEffect, 
  BatchedParticleSystem 
} from '../../Performance/MobileOptimizedParticles';
import { 
  LODSystem, 
  AdaptiveMesh, 
  DistanceCulling, 
  InstancedLOD 
} from '../../Performance/LODSystem';
import { AdaptiveQualityManager } from '../../Performance/AdaptiveQualityManager';
import { PerformanceAnalyzer } from '../../Performance/PerformanceAnalyzer';

// Physics Ground Plane with LOD
function OptimizedPhysicsGround({ qualitySettings }: { qualitySettings: any }) {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -2, 0],
    type: 'Static'
  }));
  
  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <MeshReflectorMaterial
        blur={qualitySettings.reflections ? [300, 100] : [100, 50]}
        resolution={qualitySettings.reflections ? 2048 : 1024}
        mixBlur={qualitySettings.reflections ? 1 : 0.5}
        mixStrength={qualitySettings.reflections ? 80 : 40}
        roughness={1}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#050505"
        metalness={0.5}
      />
    </mesh>
  );
}

// Optimized Falling Crystal with LOD
function OptimizedFallingCrystal({ 
  position, 
  qualitySettings 
}: { 
  position: [number, number, number];
  qualitySettings: any;
}) {
  const [ref] = useBox(() => ({
    mass: 1,
    position,
    args: [0.5, 0.5, 0.5],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0]
  }));

  const geometries = useMemo(() => [
    new THREE.OctahedronGeometry(0.3, 2),
    new THREE.OctahedronGeometry(0.3, 1),
    new THREE.OctahedronGeometry(0.3, 0),
  ], []);

  return (
    <group ref={ref}>
      <LODSystem qualitySettings={qualitySettings} distances={[0, 10, 20]}>
        {geometries.map((geo, index) => (
          <mesh key={index} castShadow={qualitySettings.shadowQuality !== 'off'}>
            <primitive object={geo} attach="geometry" />
            <MeshRefractionMaterial
              envMap={null}
              aberrationStrength={index === 0 ? 0.02 : 0.01}
              ior={2.75}
              fresnel={1}
              color="#88ddff"
            />
          </mesh>
        ))}
      </LODSystem>
    </group>
  );
}

// Optimized Athena Head with adaptive quality
function OptimizedAthenaHead({ 
  mood, 
  speaking, 
  amplitude = 0,
  audioElement,
  microphoneStream,
  qualitySettings
}: { 
  mood: string; 
  speaking: boolean;
  amplitude?: number;
  audioElement?: HTMLAudioElement;
  microphoneStream?: MediaStream;
  qualitySettings: any;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [ref, api] = useSphere(() => ({
    mass: 5,
    position: [0, 0, 0],
    type: 'Dynamic'
  }));

  // Adaptive sphere resolution based on quality
  const sphereArgs = useMemo(() => {
    const resolutions = {
      low: [1, 32, 32],
      medium: [1, 64, 64],
      high: [1, 128, 128],
      ultra: [1, 256, 256]
    };
    return resolutions[qualitySettings.qualityLevel] || resolutions.high;
  }, [qualitySettings.qualityLevel]);

  // GSAP Timeline Animation (reduced frequency on mobile)
  useEffect(() => {
    if (meshRef.current && qualitySettings.qualityLevel !== 'low') {
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(meshRef.current.rotation, {
        y: Math.PI * 0.1,
        duration: 4,
        ease: "power2.inOut"
      });
      if (qualitySettings.qualityLevel !== 'medium') {
        tl.to(meshRef.current.scale, {
          x: 1.05,
          y: 0.95,
          z: 1.05,
          duration: 2,
          ease: "elastic.inOut"
        }, "-=2");
      }
    }
  }, [qualitySettings.qualityLevel]);

  // React Spring Animation with amplitude
  const springProps = useSpring({
    scale: (speaking ? 1.2 : 1) + amplitude * 0.3,
    config: { mass: 1, tension: 300, friction: 20 }
  });

  // Leva Controls (disabled on mobile)
  const materialControls = useControls('Athena Material', {
    transmission: { value: 0.9, min: 0, max: 1 },
    thickness: { value: 1.5, min: 0, max: 5 },
    roughness: { value: 0.1, min: 0, max: 1 },
    chromaticAberration: { value: 0.02, min: 0, max: 0.1 },
    anisotropicBlur: { value: 0.1, min: 0, max: 1 },
    distortion: { value: 0.4, min: 0, max: 2 },
    distortionScale: { value: 1.5, min: 0.1, max: 5 },
    temporalDistortion: { value: 0.3, min: 0, max: 1 }
  }, { collapsed: qualitySettings.deviceType === 'mobile' });

  // Mood-based colors
  const moodColors = {
    sweet: '#ff9fd5',
    shy: '#b19fff',
    confident: '#4dd0ff',
    caring: '#ff9f9f',
    playful: '#9fff9f'
  };

  return (
    <a.group ref={ref} scale={springProps.scale}>
      <mesh ref={meshRef} castShadow={qualitySettings.shadowQuality !== 'off'}>
        <sphereGeometry args={sphereArgs} />
        {qualitySettings.qualityLevel !== 'low' ? (
          <MeshTransmissionMaterial
            backside
            backsideThickness={materialControls.thickness}
            thickness={materialControls.thickness}
            transmission={materialControls.transmission}
            roughness={materialControls.roughness}
            chromaticAberration={materialControls.chromaticAberration}
            anisotropicBlur={materialControls.anisotropicBlur}
            color={moodColors[mood as keyof typeof moodColors]}
            attenuationDistance={0.5}
            attenuationColor={moodColors[mood as keyof typeof moodColors]}
          />
        ) : (
          // Simplified material for low quality
          <meshPhysicalMaterial
            color={moodColors[mood as keyof typeof moodColors]}
            metalness={0.5}
            roughness={0.3}
            clearcoat={0.5}
            clearcoatRoughness={0.3}
          />
        )}
      </mesh>
      
      {/* Distortion Layer (disabled on low quality) */}
      {qualitySettings.qualityLevel !== 'low' && (
        <mesh scale={1.01}>
          <sphereGeometry args={[1, sphereArgs[1] / 2, sphereArgs[2] / 2]} />
          <MeshDistortMaterial
            color={moodColors[mood as keyof typeof moodColors]}
            distort={materialControls.distortion + amplitude * 0.5}
            speed={2 + amplitude * 2}
            opacity={0.3}
            transparent
          />
        </mesh>
      )}

      {/* Voice Amplitude Visualizer */}
      <VoiceAmplitudeVisualizer
        speaking={speaking}
        listening={false}
        audioElement={audioElement}
        microphoneStream={microphoneStream}
        sensitivity={1.5}
        smoothing={0.8}
      />
    </a.group>
  );
}

// Main Performance-Optimized Movie-Grade Athena Component
export function PerformanceOptimizedMovieGradeAthena() {
  const [mood, setMood] = useState('sweet');
  const [speaking, setSpeaking] = useState(false);
  const [showPerformanceUI, setShowPerformanceUI] = useState(true);
  const { qualitySettings, metrics } = usePerformanceMonitor();

  // Adaptive post-processing controls
  const postProcessingControls = useControls('Post Processing', {
    enabled: { value: qualitySettings.postProcessing },
    ssao: folder({
      samples: { value: qualitySettings.qualityLevel === 'low' ? 8 : 31, min: 1, max: 64, step: 1 },
      radius: { value: 0.5, min: 0.01, max: 1 },
      intensity: { value: 20, min: 0, max: 100 }
    }),
    dof: folder({
      focusDistance: { value: 0.02, min: 0, max: 0.1 },
      focalLength: { value: 0.1, min: 0, max: 1 },
      bokehScale: { value: 4, min: 0, max: 10 }
    }),
    bloom: folder({
      luminanceThreshold: { value: 0.3, min: 0, max: 1 },
      intensity: { value: 1.5, min: 0, max: 3 }
    })
  }, { collapsed: qualitySettings.deviceType === 'mobile' });

  // Adaptive particle counts
  const particleCounts = useMemo(() => ({
    stars: Math.floor(5000 * (qualitySettings.particleCount / 1000)),
    sparkles: Math.floor(200 * (qualitySettings.particleCount / 1000)),
    crystals: Math.floor(5 * (qualitySettings.particleCount / 1000))
  }), [qualitySettings.particleCount]);

  return (
    <>
      <Canvas
        shadows={qualitySettings.shadowQuality !== 'off'}
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{ 
          antialias: qualitySettings.antialias, 
          toneMapping: THREE.ACESFilmicToneMapping,
          powerPreference: 'high-performance',
          pixelRatio: Math.min(window.devicePixelRatio, 2) * qualitySettings.renderScale
        }}
      >
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#000000', 5, 20]} />
        
        {/* Performance Monitoring UI */}
        {showPerformanceUI && metrics.deviceType !== 'mobile' && (
          <PerformanceAnalyzer />
        )}
        
        {/* Adaptive Lighting */}
        <ambientLight intensity={0.5} />
        <pointLight 
          position={[10, 10, 10]} 
          intensity={1} 
          castShadow={qualitySettings.shadowQuality !== 'off'} 
        />
        {qualitySettings.qualityLevel !== 'low' && (
          <>
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#88ddff" />
            <spotLight
              position={[0, 10, 0]}
              angle={0.3}
              penumbra={1}
              intensity={2}
              castShadow={qualitySettings.shadowQuality === 'high'}
            />
          </>
        )}
        
        {/* Environment (reduced quality on mobile) */}
        <Environment 
          preset="night" 
          resolution={qualitySettings.deviceType === 'mobile' ? 256 : 1024}
        />
        {particleCounts.stars > 0 && (
          <Stars 
            radius={100} 
            depth={50} 
            count={particleCounts.stars} 
            factor={4} 
            saturation={0} 
            fade 
          />
        )}
        
        {/* Physics World */}
        <Physics gravity={[0, -9.81, 0]}>
          <OptimizedPhysicsGround qualitySettings={qualitySettings} />
          
          {/* Main Athena with distance culling */}
          <DistanceCulling maxDistance={50} qualitySettings={qualitySettings}>
            <Float 
              speed={1.5} 
              rotationIntensity={qualitySettings.qualityLevel !== 'low' ? 0.4 : 0.2} 
              floatIntensity={qualitySettings.qualityLevel !== 'low' ? 0.5 : 0.3}
            >
              <OptimizedAthenaHead 
                mood={mood} 
                speaking={speaking} 
                qualitySettings={qualitySettings}
              />
            </Float>
          </DistanceCulling>
          
          {/* Falling Crystals with LOD */}
          {Array.from({ length: particleCounts.crystals }).map((_, i) => (
            <OptimizedFallingCrystal
              key={i}
              position={[
                (Math.random() - 0.5) * 4,
                5 + Math.random() * 5,
                (Math.random() - 0.5) * 4
              ]}
              qualitySettings={qualitySettings}
            />
          ))}
        </Physics>
        
        {/* Optimized Particle Effects */}
        <BatchedParticleSystem
          effects={[
            { type: 'stars', position: [0, 5, 0] },
            { type: 'dust', position: [-5, 0, 0] },
            { type: 'sparkles', position: [5, 0, 5] }
          ]}
          qualitySettings={qualitySettings}
        />
        
        {/* Cloud effect (disabled on low quality) */}
        {qualitySettings.qualityLevel !== 'low' && (
          <Cloud
            opacity={0.5}
            speed={0.4}
            width={10}
            depth={1.5}
            segments={qualitySettings.qualityLevel === 'medium' ? 10 : 20}
          />
        )}
        
        {/* Trail Effect (disabled on mobile) */}
        {qualitySettings.deviceType !== 'mobile' && (
          <Trail
            width={5}
            length={20}
            color={new THREE.Color('#88ddff')}
            attenuation={(t) => t * t}
          >
            <mesh>
              <sphereGeometry args={[0.3]} />
              <MeshTransmissionMaterial roughness={0} transmission={0.9} thickness={0.1} />
            </mesh>
          </Trail>
        )}
        
        {/* Adaptive Post Processing */}
        {qualitySettings.postProcessing && postProcessingControls.enabled && (
          <EffectComposer>
            {qualitySettings.ambientOcclusion && (
              <SSAO
                samples={postProcessingControls.samples}
                radius={postProcessingControls.radius}
                intensity={postProcessingControls.intensity}
              />
            )}
            {qualitySettings.qualityLevel !== 'low' && (
              <DepthOfField
                focusDistance={postProcessingControls.focusDistance}
                focalLength={postProcessingControls.focalLength}
                bokehScale={postProcessingControls.bokehScale}
              />
            )}
            {qualitySettings.bloom && (
              <Bloom
                luminanceThreshold={postProcessingControls.luminanceThreshold}
                intensity={postProcessingControls.intensity}
              />
            )}
            {qualitySettings.qualityLevel === 'ultra' && (
              <ChromaticAberration
                offset={new THREE.Vector2(0.001, 0.002)}
              />
            )}
            <Vignette eskil={false} offset={0.1} darkness={0.5} />
            {qualitySettings.qualityLevel !== 'low' && (
              <>
                <HueSaturation hue={0} saturation={0.1} />
                <BrightnessContrast brightness={0} contrast={0.1} />
              </>
            )}
          </EffectComposer>
        )}
        
        {/* Contact Shadows (reduced quality on mobile) */}
        <ContactShadows
          position={[0, -2, 0]}
          opacity={0.5}
          scale={20}
          blur={qualitySettings.deviceType === 'mobile' ? 1 : 2}
          far={20}
          resolution={qualitySettings.deviceType === 'mobile' ? 256 : 512}
        />
        
        {/* UI Overlay */}
        <Html position={[0, -3, 0]} center>
          <div style={{ color: 'white', textAlign: 'center' }}>
            <h3>Sweet Athena</h3>
            <p>Performance-Optimized 3D Assistant</p>
            <p style={{ fontSize: '12px', opacity: 0.7 }}>
              {metrics.deviceType} | {metrics.qualityLevel} | {metrics.fps} FPS
            </p>
          </div>
        </Html>
      </Canvas>
      
      {/* Adaptive Quality Manager UI */}
      {showPerformanceUI && (
        <AdaptiveQualityManager showControls />
      )}
    </>
  );
}
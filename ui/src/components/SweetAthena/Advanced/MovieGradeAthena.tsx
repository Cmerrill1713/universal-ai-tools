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
import Stats from 'stats.js';
import NebulaSystem from 'three-nebula';
import * as Nebula from 'three-nebula';
import { VoiceAmplitudeVisualizer, useVoiceAmplitude } from './VoiceAmplitudeVisualizer';

// Performance Monitor Component
function PerformanceMonitor() {
  useEffect(() => {
    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb
    document.body.appendChild(stats.dom);
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '10px';
    stats.dom.style.left = '10px';

    const animate = () => {
      stats.begin();
      stats.end();
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      document.body.removeChild(stats.dom);
    };
  }, []);

  return null;
}

// Physics Ground Plane
function PhysicsGround() {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -2, 0],
    type: 'Static'
  }));
  
  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={2048}
        mixBlur={1}
        mixStrength={80}
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

// Falling Crystal Physics Objects
function FallingCrystal({ position }: { position: [number, number, number] }) {
  const [ref] = useBox(() => ({
    mass: 1,
    position,
    args: [0.5, 0.5, 0.5],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0]
  }));

  return (
    <mesh ref={ref} castShadow>
      <octahedronGeometry args={[0.3, 0]} />
      <MeshRefractionMaterial
        envMap={null}
        aberrationStrength={0.02}
        ior={2.75}
        fresnel={1}
        color="#88ddff"
      />
    </mesh>
  );
}

// Main Athena Head with Physics
function AthenaHead({ 
  mood, 
  speaking, 
  amplitude = 0,
  audioElement,
  microphoneStream 
}: { 
  mood: string; 
  speaking: boolean;
  amplitude?: number;
  audioElement?: HTMLAudioElement;
  microphoneStream?: MediaStream;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [ref, api] = useSphere(() => ({
    mass: 5,
    position: [0, 0, 0],
    type: 'Dynamic'
  }));

  // GSAP Timeline Animation
  useEffect(() => {
    if (meshRef.current) {
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(meshRef.current.rotation, {
        y: Math.PI * 0.1,
        duration: 4,
        ease: "power2.inOut"
      });
      tl.to(meshRef.current.scale, {
        x: 1.05,
        y: 0.95,
        z: 1.05,
        duration: 2,
        ease: "elastic.inOut"
      }, "-=2");
    }
  }, []);

  // React Spring Animation with amplitude
  const springProps = useSpring({
    scale: (speaking ? 1.2 : 1) + amplitude * 0.3,
    config: { mass: 1, tension: 300, friction: 20 }
  });

  // Leva Controls
  const materialControls = useControls('Athena Material', {
    transmission: { value: 0.9, min: 0, max: 1 },
    thickness: { value: 1.5, min: 0, max: 5 },
    roughness: { value: 0.1, min: 0, max: 1 },
    chromaticAberration: { value: 0.02, min: 0, max: 0.1 },
    anisotropicBlur: { value: 0.1, min: 0, max: 1 },
    distortion: { value: 0.4, min: 0, max: 2 },
    distortionScale: { value: 1.5, min: 0.1, max: 5 },
    temporalDistortion: { value: 0.3, min: 0, max: 1 }
  });

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
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[1, 128, 128]} />
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
      </mesh>
      
      {/* Distortion Layer */}
      <mesh scale={1.01}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color={moodColors[mood as keyof typeof moodColors]}
          distort={materialControls.distortion + amplitude * 0.5}
          speed={2 + amplitude * 2}
          opacity={0.3}
          transparent
        />
      </mesh>

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

// GPU Particle System
function ParticleSystem() {
  const systemRef = useRef<any>(null);
  const { scene } = useThree();

  useEffect(() => {
    const system = new NebulaSystem.System();
    const emitter = new NebulaSystem.Emitter();
    
    emitter
      .setRate(new NebulaSystem.Rate(new NebulaSystem.Span(4, 8), 0.25))
      .setInitializers([
        new NebulaSystem.Mass(1),
        new NebulaSystem.Radius(0.1, 0.3),
        new NebulaSystem.Life(2, 4),
        new NebulaSystem.BodySprite({
          texture: new THREE.TextureLoader().load('/particle.png'),
          color: 0x88ddff
        }),
        new NebulaSystem.Position(new NebulaSystem.SphereZone(0, 0, 0, 2))
      ])
      .setBehaviours([
        new NebulaSystem.Alpha(1, 0),
        new NebulaSystem.Scale(0.1, 1),
        new NebulaSystem.Gravity(0.5),
        new NebulaSystem.Rotate(0, NebulaSystem.getEasingByName('easeInOutQuad'), 0.1)
      ])
      .emit();

    system.addEmitter(emitter);
    system.addRenderer(new NebulaSystem.SpriteRenderer(scene, THREE));
    
    systemRef.current = system;

    return () => {
      system.destroy();
    };
  }, [scene]);

  useFrame((state, delta) => {
    if (systemRef.current) {
      systemRef.current.update(delta);
    }
  });

  return null;
}

// Main Movie-Grade Athena Component
export function MovieGradeAthena() {
  const [mood, setMood] = useState('sweet');
  const [speaking, setSpeaking] = useState(false);

  // Leva Post-Processing Controls
  const postProcessingControls = useControls('Post Processing', {
    ssao: folder({
      samples: { value: 31, min: 1, max: 64, step: 1 },
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
    }),
    chromaticAberration: folder({
      offset: { value: [0.001, 0.002], min: 0, max: 0.01 }
    })
  });

  return (
    <Canvas
      shadows
      camera={{ position: [0, 0, 8], fov: 50 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 5, 20]} />
      
      {/* Performance Monitor */}
      <PerformanceMonitor />
      
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#88ddff" />
      <spotLight
        position={[0, 10, 0]}
        angle={0.3}
        penumbra={1}
        intensity={2}
        castShadow
      />
      
      {/* Environment */}
      <Environment preset="night" />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
      
      {/* Physics World */}
      <Physics gravity={[0, -9.81, 0]}>
        <PhysicsGround />
        
        {/* Main Athena */}
        <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.5}>
          <AthenaHead mood={mood} speaking={speaking} />
        </Float>
        
        {/* Falling Crystals */}
        {Array.from({ length: 5 }).map((_, i) => (
          <FallingCrystal
            key={i}
            position={[
              (Math.random() - 0.5) * 4,
              5 + Math.random() * 5,
              (Math.random() - 0.5) * 4
            ]}
          />
        ))}
      </Physics>
      
      {/* Particle Effects */}
      <ParticleSystem />
      <Sparkles count={200} size={1.5} speed={0.5} noise={0.2} color="#88ddff" />
      <Cloud
        opacity={0.5}
        speed={0.4}
        width={10}
        depth={1.5}
        segments={20}
      />
      
      {/* Trail Effect */}
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
      
      {/* Post Processing */}
      <EffectComposer>
        <SSAO
          samples={postProcessingControls.samples}
          radius={postProcessingControls.radius}
          intensity={postProcessingControls.intensity}
        />
        <DepthOfField
          focusDistance={postProcessingControls.focusDistance}
          focalLength={postProcessingControls.focalLength}
          bokehScale={postProcessingControls.bokehScale}
        />
        <Bloom
          luminanceThreshold={postProcessingControls.luminanceThreshold}
          intensity={postProcessingControls.intensity}
        />
        <ChromaticAberration
          offset={new THREE.Vector2(...postProcessingControls.offset)}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.5} />
        <HueSaturation hue={0} saturation={0.1} />
        <BrightnessContrast brightness={0} contrast={0.1} />
      </EffectComposer>
      
      {/* Contact Shadows */}
      <ContactShadows
        position={[0, -2, 0]}
        opacity={0.5}
        scale={20}
        blur={2}
        far={20}
      />
      
      {/* UI Overlay */}
      <Html position={[0, -3, 0]} center>
        <div style={{ color: 'white', textAlign: 'center' }}>
          <h3>Sweet Athena</h3>
          <p>Movie-Grade 3D Assistant</p>
        </div>
      </Html>
    </Canvas>
  );
}
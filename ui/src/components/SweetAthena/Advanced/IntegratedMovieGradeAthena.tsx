import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
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
import { VoiceAmplitudeVisualizer, useVoiceAmplitude } from './VoiceAmplitudeVisualizer';
import { AnimatePresence, motion } from 'framer-motion';
import { AthenaWidgetCreator } from '../WidgetCreator/AthenaWidgetCreator';
import { useChat } from '../../../hooks/useChat';
import { useSystemStatus } from '../../../hooks/useSystemStatus';
import { Sparkle, Brain, Code, Palette, Database, Globe, Settings, Plus, Mic, MicOff } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

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

// Main Athena Head with Physics and Voice Integration
function AthenaHead({ 
  mood, 
  speaking, 
  amplitude = 0,
  audioElement,
  microphoneStream,
  onVoiceDetected
}: { 
  mood: string; 
  speaking: boolean;
  amplitude?: number;
  audioElement?: HTMLAudioElement;
  microphoneStream?: MediaStream;
  onVoiceDetected?: (amplitude: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [ref, api] = useSphere(() => ({
    mass: 5,
    position: [0, 0, 0],
    type: 'Dynamic'
  }));

  // Voice amplitude detection
  const { amplitude: detectedAmplitude } = useVoiceAmplitude({
    audioElement,
    microphoneStream,
    sensitivity: 1.5,
    smoothing: 0.8
  });

  useEffect(() => {
    if (onVoiceDetected && detectedAmplitude > 0) {
      onVoiceDetected(detectedAmplitude);
    }
  }, [detectedAmplitude, onVoiceDetected]);

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
    scale: (speaking ? 1.2 : 1) + (amplitude || detectedAmplitude) * 0.3,
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
          distort={materialControls.distortion + (amplitude || detectedAmplitude) * 0.5}
          speed={2 + (amplitude || detectedAmplitude) * 2}
          opacity={0.3}
          transparent
        />
      </mesh>

      {/* Voice Amplitude Visualizer */}
      <VoiceAmplitudeVisualizer
        speaking={speaking}
        listening={!!microphoneStream}
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

interface WidgetPreview {
  id: string;
  name: string;
  type: 'component' | 'api' | 'workflow' | 'database';
  description: string;
  code?: string;
  preview?: React.ReactNode;
}

// Main Integrated Movie-Grade Athena Component
export function IntegratedMovieGradeAthena() {
  const [mood, setMood] = useState('sweet');
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [widgets, setWidgets] = useState<WidgetPreview[]>([]);
  const [selectedWidget, setSelectedWidget] = useState<WidgetPreview | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showWidgetCreator, setShowWidgetCreator] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  
  const [userId] = useState(() => `user_${Math.random().toString(36).substr(2, 9)}`);
  const [conversationId] = useState(() => uuidv4());
  
  const { messages, sendMessage, isThinking } = useChat();
  const { status } = useSystemStatus();

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

  const generalControls = useControls('General', {
    debugMode: false,
    performanceMonitor: true,
    voiceEnabled: true
  });

  // Voice Input Management
  const toggleVoiceInput = useCallback(async () => {
    if (listening) {
      // Stop listening
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      setListening(false);
    } else {
      // Start listening
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        setListening(true);
      } catch (error) {
        console.error('Failed to access microphone:', error);
      }
    }
  }, [listening]);

  // Handle natural language input
  const handleChatSubmit = useCallback(async (input: string) => {
    if (!input.trim()) return;

    // Analyze intent
    const isCreationRequest = input.toLowerCase().includes('create') || 
                            input.toLowerCase().includes('build') || 
                            input.toLowerCase().includes('make');

    if (isCreationRequest) {
      setIsCreating(true);
      setMood('confident');
      
      // Simulate Athena speaking
      setSpeaking(true);
      setTimeout(() => setSpeaking(false), 3000);
    }

    // Send to chat system
    await sendMessage(input);

    // Handle widget creation
    if (isCreationRequest) {
      setTimeout(() => {
        const newWidget: WidgetPreview = {
          id: Date.now().toString(),
          name: extractWidgetName(input),
          type: extractWidgetType(input),
          description: `Created from: "${input}"`,
          preview: generateWidgetPreview(input)
        };
        setWidgets(prev => [newWidget, ...prev]);
        setIsCreating(false);
        setMood('playful');
      }, 3000);
    }
  }, [sendMessage]);

  // Extract widget name from natural language
  const extractWidgetName = (input: string): string => {
    const patterns = [
      /create a?\s+(\w+\s+\w+)/i,
      /build a?\s+(\w+\s+\w+)/i,
      /make a?\s+(\w+\s+\w+)/i
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }
    
    return `Widget ${widgets.length + 1}`;
  };

  // Extract widget type from natural language
  const extractWidgetType = (input: string): WidgetPreview['type'] => {
    if (input.toLowerCase().includes('api')) return 'api';
    if (input.toLowerCase().includes('database') || input.toLowerCase().includes('schema')) return 'database';
    if (input.toLowerCase().includes('workflow')) return 'workflow';
    return 'component';
  };

  // Generate widget preview based on description
  const generateWidgetPreview = (input: string): React.ReactNode => {
    const type = extractWidgetType(input);
    
    switch (type) {
      case 'api':
        return (
          <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white">
            <h3 className="font-bold">API Endpoint</h3>
            <p className="text-sm opacity-90">REST API generated from your description</p>
          </div>
        );
      case 'database':
        return (
          <div className="p-4 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg text-white">
            <h3 className="font-bold">Database Schema</h3>
            <p className="text-sm opacity-90">Schema design based on your requirements</p>
          </div>
        );
      case 'workflow':
        return (
          <div className="p-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg text-white">
            <h3 className="font-bold">Workflow</h3>
            <p className="text-sm opacity-90">Automated workflow from your description</p>
          </div>
        );
      default:
        return (
          <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white">
            <h3 className="font-bold">React Component</h3>
            <p className="text-sm opacity-90">UI component built to your specifications</p>
          </div>
        );
    }
  };

  // Handle voice amplitude changes
  const handleVoiceDetected = useCallback((amplitude: number) => {
    if (amplitude > 0.1) {
      setMood('playful');
    }
  }, []);

  // Handle widget creation from AthenaWidgetCreator
  const handleWidgetCreated = useCallback((widget: any) => {
    const newWidget: WidgetPreview = {
      id: widget.id,
      name: widget.name,
      type: 'component',
      description: widget.description,
      code: widget.code,
      preview: generateWidgetPreview(widget.description)
    };
    setWidgets(prev => [newWidget, ...prev]);
    setShowWidgetCreator(false);
  }, [widgets.length]);

  return (
    <div className="h-screen w-full bg-gradient-to-br from-gray-900 via-purple-900 to-black overflow-hidden relative">
      {/* 3D Canvas - Sweet Athena at Center */}
      <div className="absolute inset-0">
        <Canvas
          shadows
          camera={{ position: [0, 0, 8], fov: 50 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <color attach="background" args={['#000000']} />
          <fog attach="fog" args={['#000000', 5, 20]} />
          
          {/* Performance Monitor */}
          {generalControls.performanceMonitor && <PerformanceMonitor />}
          
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
              <AthenaHead 
                mood={mood} 
                speaking={speaking}
                audioElement={audioRef.current || undefined}
                microphoneStream={micStreamRef.current || undefined}
                onVoiceDetected={handleVoiceDetected}
              />
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
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Header */}
        <div className="p-6 pointer-events-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Sparkle className="w-8 h-8 text-purple-400" />
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Sweet Athena
                </h1>
              </div>
              <span className="text-gray-400 text-sm">Your AI Creation Assistant</span>
            </div>
            
            {/* System Status */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${status.healthy ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                <span className="text-sm text-gray-300">
                  {status.services.filter(s => s.status === 'healthy').length}/{status.services.length} Services
                </span>
              </div>
              <button 
                onClick={() => setShowWidgetCreator(!showWidgetCreator)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors pointer-events-auto"
              >
                <Code className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors pointer-events-auto">
                <Settings className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Chat Interface */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-auto">
          <div className="max-w-4xl mx-auto">
            {/* Widget Creation Preview */}
            <AnimatePresence>
              {isCreating && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mb-4 p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20"
                >
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin">
                      <Code className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Creating your widget...</p>
                      <p className="text-gray-300 text-sm">Athena is analyzing your requirements</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Input */}
            <div className="relative">
              <input
                ref={chatInputRef}
                type="text"
                placeholder="Describe what you want to create..."
                className="w-full px-6 py-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-all pr-32"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleChatSubmit(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                {generalControls.voiceEnabled && (
                  <button 
                    onClick={toggleVoiceInput}
                    className={`p-2 rounded-lg transition-colors ${
                      listening ? 'bg-red-500/20 text-red-400' : 'hover:bg-white/10 text-purple-400'
                    }`}
                  >
                    {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                )}
                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <Brain className="w-5 h-5 text-purple-400" />
                </button>
                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <Plus className="w-5 h-5 text-purple-400" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { icon: Code, label: 'Create Component', action: 'Create a new React component' },
                { icon: Database, label: 'Design Schema', action: 'Design a database schema' },
                { icon: Globe, label: 'Build API', action: 'Build a REST API endpoint' },
                { icon: Palette, label: 'Generate UI', action: 'Generate a beautiful UI element' }
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleChatSubmit(action.action)}
                  className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-gray-300 hover:text-white transition-all"
                >
                  <action.icon className="w-4 h-4" />
                  <span className="text-sm">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Created Widgets Sidebar */}
        <div className="absolute right-0 top-20 bottom-20 w-80 p-4 pointer-events-auto">
          <div className="h-full bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 overflow-hidden">
            <h3 className="text-white font-semibold mb-4 flex items-center justify-between">
              Your Creations
              <span className="text-sm text-gray-400">{widgets.length} widgets</span>
            </h3>
            <div className="space-y-2 overflow-y-auto h-[calc(100%-2rem)]">
              {widgets.map((widget) => (
                <motion.div
                  key={widget.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setSelectedWidget(widget)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-all"
                >
                  <h4 className="text-white font-medium">{widget.name}</h4>
                  <p className="text-gray-400 text-sm">{widget.type}</p>
                  <p className="text-gray-500 text-xs mt-1">{widget.description}</p>
                  {widget.preview && (
                    <div className="mt-2 scale-75 origin-left">
                      {widget.preview}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Widget Creator Modal */}
        <AnimatePresence>
          {showWidgetCreator && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto"
              onClick={() => setShowWidgetCreator(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">Widget Creator Studio</h2>
                  <button
                    onClick={() => setShowWidgetCreator(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <AthenaWidgetCreator
                  userId={userId}
                  conversationId={conversationId}
                  onWidgetCreated={handleWidgetCreated}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Audio Element for TTS */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      {/* Leva Controls (Development) */}
      {generalControls.debugMode && <Leva />}
    </div>
  );
}

export default IntegratedMovieGradeAthena;
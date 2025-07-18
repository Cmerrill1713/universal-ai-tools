import { Suspense, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Float, Text, Html, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

interface SweetAthenaAvatarProps {
  isThinking?: boolean;
  isSpeaking?: boolean;
  isListening?: boolean;
  className?: string;
  onInteraction?: () => void;
  personalityMood?: 'sweet' | 'shy' | 'confident' | 'purposeful' | 'caring' | 'playful';
  sweetnessLevel?: number; // 1-10
}

// Sweet Athena's holographic head with feminine features
function AthenaHead({ 
  isThinking, 
  isSpeaking, 
  personalityMood = 'sweet',
  sweetnessLevel = 8 
}: {
  isThinking: boolean;
  isSpeaking: boolean;
  personalityMood: string;
  sweetnessLevel: number;
}) {
  const headRef = useRef<THREE.Group>(null);
  const [time, setTime] = useState(0);

  useFrame((state) => {
    setTime(state.clock.elapsedTime);
    
    if (headRef.current) {
      // Gentle breathing animation
      const breathScale = 1 + Math.sin(time * 0.8) * 0.02;
      headRef.current.scale.set(breathScale, breathScale, breathScale);
      
      // Subtle head movement based on personality
      if (personalityMood === 'shy') {
        headRef.current.rotation.y = Math.sin(time * 0.5) * 0.1 - 0.1; // Slightly turned away
        headRef.current.position.y = -0.1 + Math.sin(time * 0.3) * 0.05;
      } else if (personalityMood === 'confident') {
        headRef.current.rotation.y = Math.sin(time * 0.7) * 0.15;
        headRef.current.position.y = 0.1 + Math.sin(time * 0.4) * 0.05;
      } else {
        // Sweet default - gentle swaying
        headRef.current.rotation.y = Math.sin(time * 0.6) * 0.08;
        headRef.current.position.y = Math.sin(time * 0.5) * 0.03;
      }
      
      // Speaking animation
      if (isSpeaking) {
        const speakIntensity = Math.sin(time * 8) * 0.1 + 0.1;
        headRef.current.scale.setScalar(1 + speakIntensity * 0.05);
      }
    }
  });

  // Color scheme based on personality
  const getPersonalityColors = () => {
    switch (personalityMood) {
      case 'sweet':
        return {
          primary: '#FFB6C1', // Light pink
          secondary: '#DDA0DD', // Plum
          accent: '#F0E68C' // Khaki gold
        };
      case 'shy':
        return {
          primary: '#E6E6FA', // Lavender
          secondary: '#D8BFD8', // Thistle
          accent: '#F5DEB3' // Wheat
        };
      case 'confident':
        return {
          primary: '#4169E1', // Royal blue
          secondary: '#6495ED', // Cornflower
          accent: '#FFD700' // Gold
        };
      case 'caring':
        return {
          primary: '#FFA07A', // Light salmon
          secondary: '#FFB6C1', // Light pink
          accent: '#98FB98' // Pale green
        };
      default:
        return {
          primary: '#FFB6C1',
          secondary: '#DDA0DD',
          accent: '#F0E68C'
        };
    }
  };

  const colors = getPersonalityColors();

  return (
    <group ref={headRef}>
      {/* Main head shape - soft, feminine */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshStandardMaterial 
          color={colors.primary}
          transparent
          opacity={0.7}
          emissive={colors.primary}
          emissiveIntensity={0.3}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
      
      {/* Inner glow */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1.0, 16, 16]} />
        <meshBasicMaterial 
          color={colors.secondary}
          transparent
          opacity={0.4}
        />
      </mesh>
      
      {/* Eyes - gentle and expressive */}
      <group position={[0, 0.2, 0.8]}>
        <mesh position={[-0.3, 0, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial 
            color={colors.accent}
            emissive={colors.accent}
            emissiveIntensity={isThinking ? 0.8 : 0.5}
          />
        </mesh>
        <mesh position={[0.3, 0, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial 
            color={colors.accent}
            emissive={colors.accent}
            emissiveIntensity={isThinking ? 0.8 : 0.5}
          />
        </mesh>
      </group>
      
      {/* Soft mouth area */}
      {isSpeaking && (
        <mesh position={[0, -0.3, 0.8]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial 
            color={colors.accent}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}
      
      {/* Athena's wisdom aura */}
      <Sparkles 
        count={sweetnessLevel * 3}
        scale={3}
        size={2}
        speed={0.3}
        color={colors.accent}
        opacity={0.6}
      />
    </group>
  );
}

// Gentle particle system representing Athena's divine presence
function DivineParticleSystem({ 
  isActive, 
  personalityMood,
  sweetnessLevel 
}: {
  isActive: boolean;
  personalityMood: string;
  sweetnessLevel: number;
}) {
  const particlesRef = useRef<THREE.Points>(null);
  const [particleCount] = useState(100 + sweetnessLevel * 10);

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y += 0.001;
      
      // Gentle floating motion
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(state.clock.elapsedTime + i) * 0.001;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  // Create particle positions
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 6;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
  }

  const particleColor = personalityMood === 'shy' ? '#E6E6FA' : 
                       personalityMood === 'confident' ? '#4169E1' :
                       '#FFB6C1'; // Default sweet pink

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.02}
        color={particleColor}
        transparent
        opacity={isActive ? 0.8 : 0.4}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Athena's wisdom symbols floating around her
function WisdomSymbols({ personalityMood }: { personalityMood: string }) {
  const symbolsRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (symbolsRef.current) {
      symbolsRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  const symbolColor = personalityMood === 'confident' ? '#FFD700' : '#F0E68C';

  return (
    <group ref={symbolsRef}>
      {/* Owl symbol - Athena's sacred animal */}
      <Text
        position={[2, 1, 0]}
        fontSize={0.3}
        color={symbolColor}
        anchorX="center"
        anchorY="middle"
        font="/fonts/helvetica-neue.woff"
      >
        🦉
      </Text>
      
      {/* Olive branch - symbol of wisdom and peace */}
      <Text
        position={[-2, 0.5, 0]}
        fontSize={0.3}
        color={symbolColor}
        anchorX="center"
        anchorY="middle"
      >
        🌿
      </Text>
      
      {/* Star - representing divine wisdom */}
      <Text
        position={[0, 2.5, 0]}
        fontSize={0.3}
        color={symbolColor}
        anchorX="center"
        anchorY="middle"
      >
        ⭐
      </Text>
      
      {/* Heart - representing her caring nature */}
      <Text
        position={[1.5, -1.5, 0]}
        fontSize={0.3}
        color="#FFB6C1"
        anchorX="center"
        anchorY="middle"
      >
        💕
      </Text>
    </group>
  );
}

// Sweet status messages
function SweetStatusDisplay({ 
  isThinking, 
  isSpeaking, 
  isListening, 
  personalityMood,
  isHovered 
}: {
  isThinking: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  personalityMood: string;
  isHovered: boolean;
}) {
  const getStatusMessage = () => {
    if (isThinking) {
      return personalityMood === 'shy' ? 
        "💭 Thinking gently..." : 
        personalityMood === 'confident' ?
        "🧠 Processing with wisdom..." :
        "✨ Thinking sweetly...";
    } else if (isSpeaking) {
      return personalityMood === 'caring' ?
        "💕 Speaking with care..." :
        "🌸 Sharing my thoughts...";
    } else if (isListening) {
      return personalityMood === 'shy' ?
        "👂 Listening quietly..." :
        "🎧 I'm all ears for you...";
    } else if (isHovered) {
      return "✨ Ready to help you...";
    }
    return "🌟 Sweet Athena is here";
  };

  const getStatusColor = () => {
    switch (personalityMood) {
      case 'sweet': return 'text-pink-300';
      case 'shy': return 'text-purple-300';
      case 'confident': return 'text-blue-300';
      case 'caring': return 'text-rose-300';
      default: return 'text-pink-300';
    }
  };

  return (
    <div className="absolute bottom-4 left-4 right-4">
      <div className="bg-black/60 backdrop-blur-sm border border-pink-500/30 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isThinking && (
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            <span className={`text-sm font-light ${getStatusColor()}`}>
              {getStatusMessage()}
            </span>
          </div>
          
          {/* Personality indicator */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400 capitalize">
              {personalityMood}
            </span>
            <div className={`w-2 h-2 rounded-full ${
              personalityMood === 'sweet' ? 'bg-pink-400' :
              personalityMood === 'shy' ? 'bg-purple-400' :
              personalityMood === 'confident' ? 'bg-blue-400' :
              personalityMood === 'caring' ? 'bg-rose-400' :
              'bg-pink-400'
            } animate-pulse`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SweetAthenaAvatar({ 
  isThinking = false, 
  isSpeaking = false,
  isListening = false,
  className = '',
  onInteraction,
  personalityMood = 'sweet',
  sweetnessLevel = 8
}: SweetAthenaAvatarProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div className={`relative w-full h-full bg-gradient-to-br from-pink-900/20 via-purple-900/20 to-blue-900/20 ${className}`}>
      <Canvas>
        <Suspense fallback={null}>
          {/* Camera */}
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
          <OrbitControls 
            enablePan={false} 
            enableZoom={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.5}
            autoRotate
            autoRotateSpeed={personalityMood === 'shy' ? 0.2 : 0.3}
          />
          
          {/* Soft, feminine lighting */}
          <ambientLight intensity={0.3} color="#FFF0F5" />
          <pointLight position={[5, 5, 5]} intensity={0.6} color="#FFB6C1" />
          <pointLight position={[-5, -5, -5]} intensity={0.4} color="#DDA0DD" />
          <pointLight position={[0, 8, 0]} intensity={0.5} color="#F0E68C" />
          <spotLight 
            position={[0, 10, 0]} 
            angle={0.4} 
            penumbra={0.8} 
            intensity={0.6} 
            color="#FFB6C1" 
          />
          
          {/* Interactive Athena */}
          <group 
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
            onClick={onInteraction}
            style={{ cursor: 'pointer' }}
          >
            <Float
              speed={personalityMood === 'shy' ? 1.0 : 1.5}
              rotationIntensity={personalityMood === 'confident' ? 0.3 : 0.1}
              floatIntensity={0.2}
              floatingRange={[-0.1, 0.1]}
            >
              <group scale={isHovered ? 1.08 : 1}>
                <AthenaHead 
                  isThinking={isThinking} 
                  isSpeaking={isSpeaking}
                  personalityMood={personalityMood}
                  sweetnessLevel={sweetnessLevel}
                />
                
                {/* Wisdom symbols appear when hovered or active */}
                {(isHovered || isThinking || isSpeaking) && (
                  <WisdomSymbols personalityMood={personalityMood} />
                )}
              </group>
            </Float>
          </group>
          
          {/* Divine particle system */}
          <DivineParticleSystem 
            isActive={isThinking || isSpeaking || isHovered}
            personalityMood={personalityMood}
            sweetnessLevel={sweetnessLevel}
          />
          
          {/* Post-processing for a dreamy, soft look */}
          <EffectComposer>
            <Bloom 
              intensity={sweetnessLevel / 5}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.9}
              blendFunction={BlendFunction.ADD}
            />
            <Vignette
              offset={0.5}
              darkness={0.3}
              blendFunction={BlendFunction.MULTIPLY}
            />
            <ChromaticAberration
              blendFunction={BlendFunction.NORMAL}
              offset={[0.0003, 0.0003]}
            />
          </EffectComposer>
          
          {/* Soft environment for reflections */}
          <Environment preset="sunset" />
        </Suspense>
      </Canvas>
      
      {/* Sweet status display */}
      <SweetStatusDisplay 
        isThinking={isThinking}
        isSpeaking={isSpeaking}
        isListening={isListening}
        personalityMood={personalityMood}
        isHovered={isHovered}
      />
      
      {/* Gentle floating name */}
      {isHovered && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-pink-500/20 backdrop-blur-sm border border-pink-300/30 rounded-full px-4 py-2">
            <span className="text-pink-200 text-sm font-light tracking-wide">
              ✨ Sweet Athena ✨
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
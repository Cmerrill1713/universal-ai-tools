/**
 * ReadyPlayerMe Sweet Athena Avatar
 * 
 * Professional 3D avatar integration with lip sync and personality-driven animations
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Float } from '@react-three/drei';
import { Visage } from '@readyplayerme/visage';
import { motion } from 'framer-motion';
import { useSpring, animated } from 'react-spring';
import styled, { ThemeProvider } from 'styled-components';
import { createAthenaTheme, type PersonalityMood, type AthenaTheme } from '../styles/athena-theme';
import * as THREE from 'three';

interface ReadyPlayerMeAthenaProps {
  isThinking?: boolean;
  isSpeaking?: boolean;
  isListening?: boolean;
  personalityMood?: PersonalityMood;
  sweetnessLevel?: number;
  onInteraction?: () => void;
  className?: string;
  avatarUrl?: string; // ReadyPlayerMe avatar URL
}

// Styled container with personality-aware styling
const AvatarContainer = styled(motion.div)<{ theme: AthenaTheme }>`
  width: 100%;
  height: 100%;
  position: relative;
  background: linear-gradient(135deg, 
    ${props => props.theme.personality.colors.primary}10 0%,
    ${props => props.theme.personality.colors.secondary}10 50%,
    ${props => props.theme.personality.colors.accent}10 100%);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: all ${props => props.theme.personality.animations.transitionMedium};
  
  &:hover {
    transform: scale(1.02);
    box-shadow: ${props => props.theme.personality.effects.glowMedium};
  }
`;

const StatusOverlay = styled(motion.div)<{ theme: AthenaTheme }>`
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid ${props => props.theme.personality.colors.primary}50;
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StatusText = styled.span<{ theme: AthenaTheme }>`
  font-family: ${props => props.theme.fonts.modern};
  font-size: 0.875rem;
  color: ${props => props.theme.personality.colors.primary};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PersonalityBadge = styled(motion.div)<{ theme: AthenaTheme }>`
  background: ${props => props.theme.personality.colors.primary}30;
  border: 1px solid ${props => props.theme.personality.colors.primary}50;
  border-radius: 16px;
  padding: 4px 8px;
  font-size: 0.75rem;
  font-weight: 500;
  color: ${props => props.theme.personality.colors.primary};
  text-transform: capitalize;
`;

// ReadyPlayerMe Avatar component with personality animations
const AnimatedAvatar: React.FC<{
  avatarUrl: string;
  personalityMood: PersonalityMood;
  isThinking: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  sweetnessLevel: number;
}> = ({ 
  avatarUrl, 
  personalityMood, 
  isThinking, 
  isSpeaking, 
  isListening,
  sweetnessLevel 
}) => {
  const avatarRef = useRef<THREE.Group>(null);
  const [time, setTime] = useState(0);

  // Personality-based animation patterns
  useFrame((state) => {
    setTime(state.clock.elapsedTime);
    
    if (avatarRef.current) {
      const avatar = avatarRef.current;
      
      // Base breathing animation
      const breathScale = 1 + Math.sin(time * 0.8) * 0.02;
      avatar.scale.setScalar(breathScale);
      
      // Personality-specific movements
      switch (personalityMood) {
        case 'sweet':
          // Gentle swaying
          avatar.rotation.y = Math.sin(time * 0.5) * 0.1;
          avatar.position.y = Math.sin(time * 0.3) * 0.02;
          break;
          
        case 'shy':
          // Slightly turned away, subtle movements
          avatar.rotation.y = Math.sin(time * 0.3) * 0.08 - 0.1;
          avatar.position.y = -0.05 + Math.sin(time * 0.4) * 0.01;
          break;
          
        case 'confident':
          // Upright posture, confident movements
          avatar.rotation.y = Math.sin(time * 0.7) * 0.15;
          avatar.position.y = 0.05 + Math.sin(time * 0.5) * 0.03;
          break;
          
        case 'caring':
          // Gentle forward lean
          avatar.rotation.x = Math.sin(time * 0.4) * 0.05 + 0.05;
          avatar.rotation.y = Math.sin(time * 0.6) * 0.12;
          break;
          
        case 'playful':
          // More dynamic movements
          avatar.rotation.y = Math.sin(time * 1.2) * 0.2;
          avatar.rotation.z = Math.sin(time * 0.8) * 0.03;
          avatar.position.y = Math.sin(time * 1.0) * 0.04;
          break;
      }
      
      // Speaking animation
      if (isSpeaking) {
        const speakIntensity = Math.sin(time * 8) * 0.1 + 0.1;
        avatar.scale.setScalar(breathScale + speakIntensity * 0.02);
        
        // Add slight head bob when speaking
        avatar.rotation.x += Math.sin(time * 6) * 0.02;
      }
      
      // Thinking animation
      if (isThinking) {
        // Slight head tilt
        avatar.rotation.z = Math.sin(time * 2) * 0.05;
      }
      
      // Listening animation
      if (isListening) {
        // Attentive posture
        avatar.rotation.x = Math.sin(time * 1.5) * 0.03 + 0.02;
      }
    }
  });

  return (
    <group ref={avatarRef}>
      <Visage
        src={avatarUrl}
        // Enable lip sync if available
        lipSync={isSpeaking}
        // Environment settings for goddess-like appearance
        environment="sunset"
        // Lighting setup for soft, feminine look
        lightIntensity={0.8}
        lightColor="#FFB6C1"
        // Camera position for flattering angle
        cameraPosition={[0, 0, 1.5]}
        // Enable physics for natural movement
        physics={true}
        // Personality-based expression intensity
        expressionIntensity={sweetnessLevel / 10}
      />
    </group>
  );
};

// Floating divine elements around the avatar
const DivineAura: React.FC<{ 
  personalityMood: PersonalityMood; 
  sweetnessLevel: number;
  isActive: boolean;
}> = ({ personalityMood, sweetnessLevel, isActive }) => {
  const particlesRef = useRef<THREE.Points>(null);
  
  useFrame((state) => {
    if (particlesRef.current && isActive) {
      particlesRef.current.rotation.y += 0.002;
      
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(state.clock.elapsedTime + i) * 0.001;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  // Create particle positions in a sphere around the avatar
  const particleCount = sweetnessLevel * 8;
  const positions = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount; i++) {
    const radius = 2 + Math.random() * 2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }

  const getAuraColor = () => {
    const colors = {
      sweet: '#FFB6C1',
      shy: '#E6E6FA',
      confident: '#4169E1',
      caring: '#FFA07A',
      playful: '#FF69B4'
    };
    return colors[personalityMood];
  };

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
        color={getAuraColor()}
        transparent
        opacity={isActive ? 0.7 : 0.3}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// Main ReadyPlayerMe Athena component
export const ReadyPlayerMeAthena: React.FC<ReadyPlayerMeAthenaProps> = ({
  isThinking = false,
  isSpeaking = false,
  isListening = false,
  personalityMood = 'sweet',
  sweetnessLevel = 8,
  onInteraction,
  className,
  avatarUrl = 'https://d1a370nemizbjq.cloudfront.net/5c3b4c5d-7b5a-4b4d-8c3d-7b5a4b4d8c3d.glb' // Default feminine avatar
}) => {
  const [theme, setTheme] = useState<AthenaTheme>(createAthenaTheme(personalityMood, sweetnessLevel));
  const [isHovered, setIsHovered] = useState(false);

  // Update theme when personality changes
  useEffect(() => {
    setTheme(createAthenaTheme(personalityMood, sweetnessLevel));
  }, [personalityMood, sweetnessLevel]);

  // Status message based on current state
  const getStatusMessage = useCallback(() => {
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
  }, [isThinking, isSpeaking, isListening, isHovered, personalityMood]);

  // React Spring animation for smooth interactions
  const containerSpring = useSpring({
    transform: isHovered ? 'scale(1.02)' : 'scale(1)',
    filter: isHovered ? 'brightness(1.1)' : 'brightness(1)',
    config: { tension: 300, friction: 30 }
  });

  return (
    <ThemeProvider theme={theme}>
      <animated.div style={containerSpring}>
        <AvatarContainer
          className={className}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={onInteraction}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* 3D Avatar Canvas */}
          <Canvas style={{ width: '100%', height: '100%' }}>
            <PerspectiveCamera makeDefault position={[0, 0, 2]} fov={50} />
            
            {/* Personality-aware lighting */}
            <ambientLight intensity={0.4} color={theme.personality.colors.soft} />
            <pointLight 
              position={[2, 2, 2]} 
              intensity={0.6} 
              color={theme.personality.colors.primary} 
            />
            <pointLight 
              position={[-2, -2, -2]} 
              intensity={0.3} 
              color={theme.personality.colors.secondary} 
            />
            <spotLight 
              position={[0, 5, 0]} 
              angle={0.3} 
              penumbra={0.7} 
              intensity={0.4} 
              color={theme.personality.colors.accent} 
            />

            {/* Floating avatar with personality animations */}
            <Float
              speed={personalityMood === 'shy' ? 0.8 : 1.2}
              rotationIntensity={personalityMood === 'confident' ? 0.3 : 0.1}
              floatIntensity={0.15}
              floatingRange={[-0.05, 0.05]}
            >
              <AnimatedAvatar
                avatarUrl={avatarUrl}
                personalityMood={personalityMood}
                isThinking={isThinking}
                isSpeaking={isSpeaking}
                isListening={isListening}
                sweetnessLevel={sweetnessLevel}
              />
            </Float>

            {/* Divine aura particles */}
            <DivineAura 
              personalityMood={personalityMood}
              sweetnessLevel={sweetnessLevel}
              isActive={isThinking || isSpeaking || isHovered}
            />

            {/* Environment for reflections */}
            <Environment preset="sunset" />
            
            {/* Gentle camera controls */}
            <OrbitControls 
              enablePan={false}
              enableZoom={false}
              minPolarAngle={Math.PI / 3}
              maxPolarAngle={Math.PI / 1.5}
              autoRotate
              autoRotateSpeed={personalityMood === 'shy' ? 0.2 : 0.4}
            />
          </Canvas>

          {/* Status overlay */}
          <StatusOverlay
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <StatusText>
              {getStatusMessage()}
            </StatusText>
            
            <PersonalityBadge
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {personalityMood === 'sweet' && '🌸'}
              {personalityMood === 'shy' && '😊'}
              {personalityMood === 'confident' && '⭐'}
              {personalityMood === 'caring' && '💕'}
              {personalityMood === 'playful' && '🎭'}
              {' '}
              {personalityMood}
            </PersonalityBadge>
          </StatusOverlay>

          {/* Gentle name display on hover */}
          {isHovered && (
            <motion.div
              style={{
                position: 'absolute',
                top: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: `${theme.personality.colors.primary}20`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${theme.personality.colors.primary}30`,
                borderRadius: '20px',
                padding: '8px 16px',
                zIndex: 10
              }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <span style={{
                color: theme.personality.colors.primary,
                fontSize: '0.875rem',
                fontWeight: 500,
                fontFamily: theme.fonts.elegant
              }}>
                ✨ Sweet Athena ✨
              </span>
            </motion.div>
          )}
        </AvatarContainer>
      </animated.div>
    </ThemeProvider>
  );
};

export default ReadyPlayerMeAthena;
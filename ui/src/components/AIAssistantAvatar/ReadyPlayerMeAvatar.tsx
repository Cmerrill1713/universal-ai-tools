import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';

// Try to import with fallback handling
let Avatar: any;

try {
  const VisageModule = require('@readyplayerme/visage');
  Avatar = VisageModule.Avatar || VisageModule.default?.Avatar;
} catch (error) {
  console.warn('ReadyPlayerMe Visage not available, using fallback:', error);
  // Fallback Avatar component
  Avatar = ({ children, ...props }: any) => <group {...props}>{children}</group>;
}

interface ReadyPlayerMeAvatarProps {
  modelUrl?: string;
  isThinking?: boolean;
  isSpeaking?: boolean;
  emotion?: 'neutral' | 'happy' | 'concerned' | 'focused';
}

export function ReadyPlayerMeAvatar({ 
  modelUrl = 'https://models.readyplayer.me/64f0265f2d3bfd24c2b3abe8.glb', // Default avatar
  isThinking = false,
  isSpeaking = false,
  emotion = 'neutral'
}: ReadyPlayerMeAvatarProps) {
  const groupRef = useRef<Group>(null);

  // Animation based on state
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
  });

  // Apply holographic material to all meshes in the avatar
  useEffect(() => {
    // This would be used to modify avatar materials if needed
    // Currently disabled to avoid ref issues
  }, []);

  return (
    <group ref={groupRef} scale={2}>
      <Avatar
        modelSrc={modelUrl}
        emotion={emotion}
        headMovement={isThinking}
        speaking={isSpeaking}
        onLoaded={() => {
          // Material will be applied via JSX
        }}
      />
    </group>
  );
}
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Avatar, type Emotion } from '@readyplayerme/visage';
import { Group, Mesh } from 'three';
import { HolographicMaterial } from './HolographicMaterialWrapper';

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
  const avatarRef = useRef<any>(null);

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
    if (avatarRef.current && avatarRef.current.nodes) {
      Object.values(avatarRef.current.nodes).forEach((node: any) => {
        if (node instanceof Mesh) {
          // Store original material for potential restoration
          const originalMaterial = node.material;
          node.userData.originalMaterial = originalMaterial;
        }
      });
    }
  }, []);

  return (
    <group ref={groupRef} scale={2}>
      <Avatar
        ref={avatarRef}
        modelSrc={modelUrl}
        emotion={emotion as Emotion}
        headMovement={isThinking}
        speaking={isSpeaking}
        onLoaded={() => {
          // Material will be applied via JSX
        }}
      />
    </group>
  );
}
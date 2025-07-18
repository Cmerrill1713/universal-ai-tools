import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { System, Emitter, Rate, Span, Position, Velocity, Mass, Radius, Life, SpriteRenderer, Gravity, Color, Alpha, Scale, SphereZone } from 'three-nebula';
import * as THREE from 'three';

interface NebulaParticleSystemProps {
  isActive?: boolean;
  color?: string;
  particleCount?: number;
}

export function NebulaParticleSystem({ 
  isActive = false, 
  color = '#00ffff',
  particleCount = 2000 
}: NebulaParticleSystemProps) {
  const { scene } = useThree();
  const systemRef = useRef<System | null>(null);
  const emitterRef = useRef<Emitter | null>(null);

  useEffect(() => {
    // Create particle system
    const system = new System();
    systemRef.current = system;

    // Create sprite texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(0, 255, 255, 1)');
      gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.5)');
      gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 32, 32);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });

    // Create emitter
    const emitter = new Emitter();
    emitterRef.current = emitter;

    // Set emission rate
    emitter.setRate(new Rate(new Span(isActive ? 20 : 5), new Span(0.1)));

    // Set emitter position
    emitter.setPosition(new Position(SphereZone(0, 0, 0, 2)));

    // Add initializers
    emitter.addInitializer(new Mass(1));
    emitter.addInitializer(new Radius(0.5, 1));
    emitter.addInitializer(new Life(2, 4));
    emitter.addInitializer(new Velocity(
      new Span(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 2, 0)),
      SphereZone(0, 0, 0, 1)
    ));
    emitter.addInitializer(new Color(new THREE.Color(color)));

    // Add behaviors
    emitter.addBehaviour(new Alpha(1, 0));
    emitter.addBehaviour(new Scale(0.1, 0.5));
    emitter.addBehaviour(new Gravity(0.5));

    // Add emitter to system
    system.addEmitter(emitter);

    // Add renderer
    system.addRenderer(new SpriteRenderer(scene as any, material));

    return () => {
      system.destroy();
    };
  }, [scene, color]);

  // Update particle system
  useFrame((_, delta) => {
    if (systemRef.current) {
      systemRef.current.update(delta);
      
      // Update emission rate based on active state
      if (emitterRef.current) {
        emitterRef.current.setRate(new Rate(new Span(isActive ? 30 : 5), new Span(0.1)));
      }
    }
  });

  return null;
}
import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Physics, useBox, useSphere, useCompoundBody, usePointToPointConstraint } from '@react-three/cannon';
import { Trail, Float, MeshTransmissionMaterial } from '@react-three/drei';
import { gsap } from 'gsap';
import { useSpring, a } from '@react-spring/three';

// Wisdom Orb that orbits around Athena
export function WisdomOrb({ 
  position, 
  onCollect 
}: { 
  position: [number, number, number];
  onCollect: () => void;
}) {
  const [ref, api] = useSphere(() => ({
    mass: 0.1,
    position,
    args: [0.2],
    type: 'Dynamic'
  }));

  const [collected, setCollected] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  // Orbital motion
  useFrame((state) => {
    if (!collected && meshRef.current) {
      const t = state.clock.getElapsedTime();
      api.position.set(
        Math.sin(t) * 2,
        Math.sin(t * 2) * 0.5,
        Math.cos(t) * 2
      );
    }
  });

  // Collection animation
  const springProps = useSpring({
    scale: collected ? 0 : 1,
    opacity: collected ? 0 : 1,
    config: { tension: 200, friction: 20 }
  });

  const handlePointerOver = () => {
    if (!collected) {
      setCollected(true);
      onCollect();
      // Particle burst effect
      gsap.to(meshRef.current?.scale, {
        x: 2,
        y: 2,
        z: 2,
        duration: 0.3,
        ease: "power2.out",
        onComplete: () => {
          api.position.set(0, 10, 0); // Move off-screen
        }
      });
    }
  };

  return (
    <a.group ref={ref} scale={springProps.scale}>
      <Trail
        width={2}
        length={10}
        color={new THREE.Color('#ffaa00')}
        attenuation={(t) => t * t}
      >
        <mesh 
          ref={meshRef}
          onPointerOver={handlePointerOver}
        >
          <icosahedronGeometry args={[0.2, 2]} />
          <MeshTransmissionMaterial
            transmission={0.95}
            thickness={0.5}
            roughness={0}
            chromaticAberration={0.03}
            anisotropicBlur={0.3}
            color="#ffdd00"
          />
        </mesh>
      </Trail>
    </a.group>
  );
}

// Interactive Hair Strands with Physics
export function PhysicsHair({ count = 20 }: { count?: number }) {
  const strands = useRef<any[]>([]);
  
  // Create physics constraints for hair
  const createHairStrand = (index: number) => {
    const angle = (index / count) * Math.PI * 2;
    const radius = 1.1;
    const segments = 5;
    const segmentLength = 0.2;
    
    const positions: [number, number, number][] = [];
    for (let i = 0; i < segments; i++) {
      positions.push([
        Math.cos(angle) * radius,
        0.5 - i * segmentLength,
        Math.sin(angle) * radius
      ]);
    }
    
    return positions;
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <HairStrand key={i} positions={createHairStrand(i)} />
      ))}
    </>
  );
}

// Individual Hair Strand
function HairStrand({ positions }: { positions: [number, number, number][] }) {
  const [refs, apis] = useCompoundBody(() => 
    positions.map((pos, i) => ({
      mass: i === 0 ? 0 : 0.01,
      position: pos,
      args: [0.02],
      type: i === 0 ? 'Static' : 'Dynamic',
      linearDamping: 0.9,
      angularDamping: 0.99
    }))
  );

  // Connect segments with constraints
  positions.forEach((_, i) => {
    if (i > 0) {
      usePointToPointConstraint(refs[i - 1], refs[i], {
        pivotA: [0, -0.1, 0],
        pivotB: [0, 0.1, 0]
      });
    }
  });

  // Apply wind force
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    apis.forEach((api, i) => {
      if (i > 0) {
        api.applyForce(
          [
            Math.sin(t + i) * 0.5,
            0,
            Math.cos(t + i) * 0.5
          ],
          [0, 0, 0]
        );
      }
    });
  });

  return (
    <group>
      {refs.map((ref, i) => (
        <mesh key={i} ref={ref}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial
            color="#ffccee"
            emissive="#ff88cc"
            emissiveIntensity={0.5}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

// Floating Knowledge Symbols
export function KnowledgeSymbol({ 
  type,
  position 
}: { 
  type: 'book' | 'scroll' | 'crystal' | 'star';
  position: [number, number, number];
}) {
  const [ref, api] = useBox(() => ({
    mass: 0.5,
    position,
    args: [0.3, 0.3, 0.3],
    angularVelocity: [
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ]
  }));

  const geometries = {
    book: <boxGeometry args={[0.3, 0.4, 0.1]} />,
    scroll: <cylinderGeometry args={[0.1, 0.1, 0.5, 16]} />,
    crystal: <octahedronGeometry args={[0.2, 0]} />,
    star: <coneGeometry args={[0.2, 0.3, 5]} />
  };

  const colors = {
    book: '#8b4513',
    scroll: '#daa520',
    crystal: '#00ffff',
    star: '#ffd700'
  };

  // Hovering effect
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    api.position.set(
      position[0] + Math.sin(t) * 0.1,
      position[1] + Math.sin(t * 2) * 0.2,
      position[2] + Math.cos(t) * 0.1
    );
  });

  return (
    <Float speed={2} rotationIntensity={2} floatIntensity={0.5}>
      <mesh ref={ref} castShadow>
        {geometries[type]}
        <MeshTransmissionMaterial
          transmission={0.7}
          thickness={0.2}
          roughness={0.3}
          color={colors[type]}
          attenuationColor={colors[type]}
          attenuationDistance={0.5}
        />
      </mesh>
    </Float>
  );
}

// Energy Field that responds to interaction
export function EnergyField({ strength = 1 }: { strength?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);

  useFrame((state) => {
    if (materialRef.current) {
      const t = state.clock.getElapsedTime();
      materialRef.current.uniforms.time.value = t;
      materialRef.current.uniforms.strength.value = strength + Math.sin(t) * 0.2;
    }
  });

  const shaderMaterial = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        strength: { value: strength },
        color1: { value: new THREE.Color('#00ffff') },
        color2: { value: new THREE.Color('#ff00ff') }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        uniform float time;
        uniform float strength;
        
        void main() {
          vUv = uv;
          vPosition = position;
          
          vec3 pos = position;
          float wave = sin(position.x * 10.0 + time) * 0.1;
          pos.y += wave * strength;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        uniform float time;
        uniform float strength;
        uniform vec3 color1;
        uniform vec3 color2;
        
        void main() {
          float pattern = sin(vPosition.x * 20.0 + time * 2.0) * 
                         sin(vPosition.y * 20.0 + time * 2.0) * 
                         sin(vPosition.z * 20.0 + time * 2.0);
          
          vec3 color = mix(color1, color2, pattern * 0.5 + 0.5);
          float alpha = (pattern * 0.5 + 0.5) * strength * 0.5;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    }),
    [strength]
  );

  return (
    <mesh ref={meshRef} material={shaderMaterial}>
      <sphereGeometry args={[2, 64, 64]} />
      <primitive object={shaderMaterial} ref={materialRef} />
    </mesh>
  );
}

// Thought Bubble Physics Objects
export function ThoughtBubble({ 
  thought,
  position 
}: { 
  thought: string;
  position: [number, number, number];
}) {
  const [ref, api] = useSphere(() => ({
    mass: 0.1,
    position,
    args: [0.5],
    type: 'Dynamic',
    linearDamping: 0.95
  }));

  const [visible, setVisible] = useState(true);

  // Float upward and fade
  useEffect(() => {
    const interval = setInterval(() => {
      api.applyForce([0, 2, 0], [0, 0, 0]);
    }, 100);

    const timeout = setTimeout(() => {
      setVisible(false);
      clearInterval(interval);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [api]);

  const springProps = useSpring({
    scale: visible ? 1 : 0,
    opacity: visible ? 0.8 : 0
  });

  return (
    <a.group ref={ref} scale={springProps.scale}>
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <MeshTransmissionMaterial
          transmission={0.9}
          thickness={0.1}
          roughness={0}
          color="#ffffff"
          opacity={springProps.opacity}
          transparent
        />
      </mesh>
      <Html center>
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '10px',
          borderRadius: '20px',
          fontSize: '12px',
          maxWidth: '200px',
          color: '#333'
        }}>
          {thought}
        </div>
      </Html>
    </a.group>
  );
}
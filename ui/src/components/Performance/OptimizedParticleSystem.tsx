import { useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleLOD } from './LODSystem';

interface OptimizedParticleSystemProps {
  baseCount?: number;
  isActive?: boolean;
  color?: string;
  size?: number;
  qualityLevel?: 'low' | 'medium' | 'high';
  emissionRadius?: number;
  lifespan?: number;
  speed?: number;
}

// Particle pool for object reuse
class ParticlePool {
  private pool: Float32Array[];
  private activeCount: number = 0;

  constructor(private maxParticles: number) {
    this.pool = [];
  }

  acquire(count: number): Float32Array {
    const array = new Float32Array(count * 3);
    this.activeCount += count;
    return array;
  }

  release(array: Float32Array) {
    this.activeCount -= array.length / 3;
    // In a real implementation, we'd reuse these arrays
  }

  get usage() {
    return this.activeCount / this.maxParticles;
  }
}

// Shader material for better performance
const particleVertexShader = `
  attribute float size;
  attribute float alpha;
  attribute float life;
  
  varying float vAlpha;
  varying float vLife;
  
  void main() {
    vAlpha = alpha;
    vLife = life;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = `
  uniform vec3 color;
  uniform sampler2D pointTexture;
  
  varying float vAlpha;
  varying float vLife;
  
  void main() {
    vec2 uv = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
    vec4 textureColor = texture2D(pointTexture, uv);
    
    // Fade based on life
    float fadeIn = smoothstep(0.0, 0.1, vLife);
    float fadeOut = smoothstep(0.7, 1.0, vLife);
    float fade = fadeIn * (1.0 - fadeOut);
    
    gl_FragColor = vec4(color, vAlpha * fade * textureColor.a);
  }
`;

export function OptimizedParticleSystem({
  baseCount = 500,
  isActive = false,
  color = '#00ffff',
  size = 0.02,
  qualityLevel = 'high',
  emissionRadius = 2,
  lifespan = 4,
  speed = 0.5
}: OptimizedParticleSystemProps) {
  const { gl } = useThree();
  const meshRef = useRef<THREE.Points>(null);
  const particleDataRef = useRef<{
    positions: Float32Array;
    velocities: Float32Array;
    sizes: Float32Array;
    alphas: Float32Array;
    lifetimes: Float32Array;
    ages: Float32Array;
  } | null>(null);

  // Create particle texture
  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Create shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(color) },
        pointTexture: { value: particleTexture }
      },
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      vertexColors: false
    });
  }, [color, particleTexture]);

  // Initialize particle data
  const initializeParticles = useCallback((count: number) => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const lifetimes = new Float32Array(count);
    const ages = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Random spawn position
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = emissionRadius * Math.cbrt(Math.random());

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Random velocity
      velocities[i * 3] = (Math.random() - 0.5) * speed;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * speed;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * speed;

      // Initial properties
      sizes[i] = size * (0.5 + Math.random() * 0.5);
      alphas[i] = 0.6 + Math.random() * 0.4;
      lifetimes[i] = lifespan * (0.5 + Math.random() * 0.5);
      ages[i] = Math.random() * lifetimes[i]; // Stagger initial ages
    }

    return { positions, velocities, sizes, alphas, lifetimes, ages };
  }, [emissionRadius, speed, size, lifespan]);

  // Update particles efficiently
  const updateParticles = useCallback((deltaTime: number, particleCount: number) => {
    if (!particleDataRef.current || !meshRef.current) return;

    const { positions, velocities, ages, lifetimes } = particleDataRef.current;
    const geometry = meshRef.current.geometry;
    const positionAttribute = geometry.attributes.position as THREE.BufferAttribute;
    const lifeAttribute = geometry.attributes.life as THREE.BufferAttribute;

    // Update only active particles
    const activeParticles = isActive ? particleCount : Math.floor(particleCount * 0.3);
    
    for (let i = 0; i < activeParticles; i++) {
      // Update age
      ages[i] += deltaTime;
      
      // Normalize life (0-1)
      const life = ages[i] / lifetimes[i];
      lifeAttribute.array[i] = life;

      // Reset dead particles
      if (life > 1) {
        ages[i] = 0;
        
        // New spawn position
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = emissionRadius * Math.cbrt(Math.random());

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        // New velocity
        velocities[i * 3] = (Math.random() - 0.5) * speed;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * speed;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * speed;
      } else {
        // Update position
        positions[i * 3] += velocities[i * 3] * deltaTime;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime;

        // Apply some forces
        if (isActive) {
          // Swirl effect when active
          const x = positions[i * 3];
          const z = positions[i * 3 + 2];
          const angle = Math.atan2(z, x);
          const force = 0.1 * deltaTime;
          
          velocities[i * 3] += Math.sin(angle) * force;
          velocities[i * 3 + 2] += -Math.cos(angle) * force;
        }

        // Gravity
        velocities[i * 3 + 1] -= 0.5 * deltaTime;

        // Damping
        const damping = 0.98;
        velocities[i * 3] *= damping;
        velocities[i * 3 + 1] *= damping;
        velocities[i * 3 + 2] *= damping;
      }

      // Update position buffer
      positionAttribute.array[i * 3] = positions[i * 3];
      positionAttribute.array[i * 3 + 1] = positions[i * 3 + 1];
      positionAttribute.array[i * 3 + 2] = positions[i * 3 + 2];
    }

    // Hide inactive particles
    for (let i = activeParticles; i < particleCount; i++) {
      lifeAttribute.array[i] = 2; // Will be faded out in shader
    }

    positionAttribute.needsUpdate = true;
    lifeAttribute.needsUpdate = true;
  }, [isActive, emissionRadius, speed]);

  return (
    <ParticleLOD baseCount={baseCount} qualityLevel={qualityLevel}>
      {(adjustedCount) => {
        // Initialize or reinitialize if count changed
        if (!particleDataRef.current || particleDataRef.current.positions.length !== adjustedCount * 3) {
          particleDataRef.current = initializeParticles(adjustedCount);
        }

        return (
          <points ref={meshRef} frustumCulled={false}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={adjustedCount}
                array={particleDataRef.current.positions}
                itemSize={3}
              />
              <bufferAttribute
                attach="attributes-size"
                count={adjustedCount}
                array={particleDataRef.current.sizes}
                itemSize={1}
              />
              <bufferAttribute
                attach="attributes-alpha"
                count={adjustedCount}
                array={particleDataRef.current.alphas}
                itemSize={1}
              />
              <bufferAttribute
                attach="attributes-life"
                count={adjustedCount}
                array={new Float32Array(adjustedCount)}
                itemSize={1}
              />
            </bufferGeometry>
            <primitive object={material} attach="material" />
            <UpdateLoop onUpdate={(delta) => updateParticles(delta, adjustedCount)} />
          </points>
        );
      }}
    </ParticleLOD>
  );
}

// Helper component for update loop
function UpdateLoop({ onUpdate }: { onUpdate: (delta: number) => void }) {
  const lastTimeRef = useRef(0);
  
  useFrame((state) => {
    const currentTime = state.clock.getElapsedTime();
    const delta = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;
    
    onUpdate(delta);
  });
  
  return null;
}

// Instanced particle system for extreme performance
export function InstancedParticleSystem({
  count = 1000,
  isActive = false,
  color = '#00ffff'
}: {
  count?: number;
  isActive?: boolean;
  color?: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Initialize instance matrices
  useEffect(() => {
    if (!meshRef.current) return;
    
    for (let i = 0; i < count; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      dummy.scale.setScalar(0.1 + Math.random() * 0.1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count, dummy]);

  // Animate instances
  useFrame((state) => {
    if (!meshRef.current || !isActive) return;
    
    const time = state.clock.getElapsedTime();
    
    for (let i = 0; i < count; i++) {
      meshRef.current.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      
      // Simple animation
      dummy.position.y += Math.sin(time + i) * 0.01;
      dummy.rotation.x = time * 0.5;
      dummy.rotation.y = time * 0.3;
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[0.05, 6, 6]} />
      <meshBasicMaterial color={color} />
    </instancedMesh>
  );
}
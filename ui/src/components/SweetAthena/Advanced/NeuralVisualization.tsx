import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Instance,
  Instances,
  MeshReflectorMaterial,
  Text3D,
  Center,
  QuadraticBezierLine,
  CatmullRomLine,
  Line,
  Trail,
  Billboard,
  Wireframe,
  Edges,
  useMatcapTexture,
  shaderMaterial,
  Points,
  PointMaterial,
  Segments,
  Segment,
  useTexture
} from '@react-three/drei';
import { extend } from '@react-three/fiber';
import { NebulaEmitter } from 'three-nebula';

// Custom shader for neural connections using drei's shaderMaterial
const NeuralConnectionMaterial = shaderMaterial(
  {
    time: 0,
    pulseSpeed: 2.0,
    activeColor: new THREE.Color('#00ffff'),
    inactiveColor: new THREE.Color('#0055aa'),
    signalStrength: 0.5
  },
  // Vertex shader
  `
    varying vec2 vUv;
    varying float vProgress;
    
    void main() {
      vUv = uv;
      vProgress = position.x; // Assuming x represents progress along connection
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform float time;
    uniform float pulseSpeed;
    uniform vec3 activeColor;
    uniform vec3 inactiveColor;
    uniform float signalStrength;
    
    varying vec2 vUv;
    varying float vProgress;
    
    void main() {
      // Create pulse animation
      float pulse = mod(vProgress - time * pulseSpeed, 1.0);
      float pulseMask = 1.0 - smoothstep(0.0, 0.1, abs(pulse - 0.5));
      
      // Mix colors based on signal strength
      vec3 color = mix(inactiveColor, activeColor, signalStrength);
      color += activeColor * pulseMask * 2.0;
      
      // Fade at edges
      float fade = smoothstep(0.0, 0.1, vProgress) * smoothstep(1.0, 0.9, vProgress);
      
      gl_FragColor = vec4(color, fade * signalStrength);
    }
  `
);

extend({ NeuralConnectionMaterial });

interface NeuralVisualizationProps {
  thoughtData?: Float32Array;
  complexity?: number;
  isActive?: boolean;
}

/**
 * Advanced Neural Network Visualization using drei components
 */
export const NeuralVisualization: React.FC<NeuralVisualizationProps> = ({
  thoughtData,
  complexity = 1,
  isActive = true
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [matcap] = useMatcapTexture('7B5254_E9DCC7_B19986_C8AC91', 256);
  
  // Generate neural network structure
  const { nodes, connections } = useMemo(() => {
    const nodeCount = Math.floor(20 * complexity);
    const layerCount = 3;
    const nodesPerLayer = Math.ceil(nodeCount / layerCount);
    
    const nodes: Array<{
      id: number;
      position: THREE.Vector3;
      layer: number;
      activation: number;
    }> = [];
    
    const connections: Array<{
      start: THREE.Vector3;
      end: THREE.Vector3;
      strength: number;
      curvePoints: THREE.Vector3[];
    }> = [];
    
    // Create nodes
    for (let layer = 0; layer < layerCount; layer++) {
      const layerNodes = layer === 1 ? nodesPerLayer * 1.5 : nodesPerLayer;
      for (let i = 0; i < layerNodes; i++) {
        const angle = (i / layerNodes) * Math.PI * 2;
        const radius = 2 - layer * 0.5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (layer - 1) * 2;
        
        nodes.push({
          id: nodes.length,
          position: new THREE.Vector3(x, y, z),
          layer,
          activation: Math.random()
        });
      }
    }
    
    // Create connections between layers
    nodes.forEach((node, i) => {
      if (node.layer < layerCount - 1) {
        // Connect to nodes in next layer
        const nextLayerNodes = nodes.filter(n => n.layer === node.layer + 1);
        const connectionCount = Math.min(3, nextLayerNodes.length);
        
        for (let j = 0; j < connectionCount; j++) {
          const targetNode = nextLayerNodes[Math.floor(Math.random() * nextLayerNodes.length)];
          
          // Create curved path
          const mid = node.position.clone().add(targetNode.position).multiplyScalar(0.5);
          mid.y += Math.random() * 0.5 - 0.25;
          
          connections.push({
            start: node.position,
            end: targetNode.position,
            strength: Math.random(),
            curvePoints: [
              node.position,
              mid,
              targetNode.position
            ]
          });
        }
      }
    });
    
    return { nodes, connections };
  }, [complexity]);

  // Animate the visualization
  useFrame(({ clock }) => {
    if (groupRef.current && isActive) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Neural nodes using Instances for performance */}
      <Instances limit={nodes.length} range={nodes.length}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshMatcapMaterial matcap={matcap} />
        
        {nodes.map((node, i) => (
          <group key={node.id} position={node.position}>
            <Instance
              scale={0.5 + node.activation * 0.5}
              color={new THREE.Color().setHSL(0.6 - node.activation * 0.2, 1, 0.5)}
            />
            
            {/* Node label */}
            <Billboard>
              <Text
                fontSize={0.1}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                position={[0, 0.2, 0]}
              >
                {node.activation.toFixed(2)}
              </Text>
            </Billboard>
            
            {/* Wireframe sphere for active nodes */}
            {node.activation > 0.7 && (
              <Wireframe>
                <sphereGeometry args={[0.15, 8, 8]} />
              </Wireframe>
            )}
          </group>
        ))}
      </Instances>
      
      {/* Neural connections using verschiedene line types */}
      {connections.map((conn, i) => {
        const Component = i % 3 === 0 ? QuadraticBezierLine : 
                        i % 3 === 1 ? CatmullRomLine : Line;
        
        return (
          <group key={i}>
            <Component
              points={conn.curvePoints}
              color={new THREE.Color().setHSL(0.5 + conn.strength * 0.2, 1, 0.5)}
              lineWidth={conn.strength * 3}
              opacity={conn.strength}
              transparent
            />
            
            {/* Animated pulse along connection */}
            {conn.strength > 0.5 && (
              <Trail
                width={1}
                length={5}
                color={new THREE.Color('#00ffff')}
                attenuation={(width) => width}
              >
                <mesh scale={0.05}>
                  <sphereGeometry args={[1, 8, 8]} />
                  <meshBasicMaterial color="#00ffff" />
                </mesh>
              </Trail>
            )}
          </group>
        );
      })}
      
      {/* Thought data visualization as point cloud */}
      {thoughtData && (
        <Points limit={thoughtData.length / 3} range={thoughtData.length / 3}>
          <PointMaterial
            transparent
            vertexColors
            size={0.05}
            sizeAttenuation={false}
            depthWrite={false}
          />
          {Array.from({ length: thoughtData.length / 3 }, (_, i) => (
            <Point
              key={i}
              position={[
                thoughtData[i * 3] * 5,
                thoughtData[i * 3 + 1] * 5,
                thoughtData[i * 3 + 2] * 5
              ]}
              color={new THREE.Color().setHSL(
                thoughtData[i * 3] * 0.3 + 0.5,
                1,
                0.5
              )}
            />
          ))}
        </Points>
      )}
      
      {/* Central processing core */}
      <Center>
        <mesh>
          <icosahedronGeometry args={[0.3, 2]} />
          <MeshReflectorMaterial
            blur={[300, 100]}
            resolution={2048}
            mixBlur={1}
            mixStrength={40}
            roughness={1}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#101010"
            metalness={0.5}
          />
          <Edges
            scale={1.1}
            threshold={15}
            color="#00ffff"
          />
        </mesh>
      </Center>
    </group>
  );
};

// Helper component for Points
const Point: React.FC<{
  position: [number, number, number];
  color: THREE.Color;
}> = ({ position, color }) => {
  const ref = useRef<THREE.Points>(null);
  
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(clock.elapsedTime + position[0]) * 0.1;
    }
  });
  
  return <points ref={ref} position={position} />;
};
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface NeuralConnectionsProps {
  nodeCount?: number;
  connectionDensity?: number;
  isActive?: boolean;
  color?: string;
}

interface Connection {
  start: THREE.Vector3;
  end: THREE.Vector3;
  strength: number;
  id: string;
}

export function NeuralConnections({ 
  nodeCount = 50,
  connectionDensity = 0.3,
  isActive = false,
  color = '#00ffff'
}: NeuralConnectionsProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Generate nodes and connections
  const { nodes, connections } = useMemo(() => {
    const nodeList: THREE.Vector3[] = [];
    const connectionList: Connection[] = [];
    
    // Create nodes on sphere surface
    for (let i = 0; i < nodeCount; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const radius = 1.8 + Math.random() * 0.3;
      
      const node = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
      
      nodeList.push(node);
    }
    
    // Create connections between nearby nodes
    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i + 1; j < nodeList.length; j++) {
        const distance = nodeList[i].distanceTo(nodeList[j]);
        
        // Connect nodes that are close enough
        if (distance < 1.5 && Math.random() < connectionDensity) {
          connectionList.push({
            start: nodeList[i],
            end: nodeList[j],
            strength: Math.random(),
            id: `${i}-${j}`
          });
        }
      }
    }
    
    return { nodes: nodeList, connections: connectionList };
  }, [nodeCount, connectionDensity]);
  
  useFrame((state) => {
    if (!groupRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Rotate the entire network slowly
    groupRef.current.rotation.y = time * 0.1;
    
    // Pulse effect when active
    if (isActive) {
      const scale = 1 + Math.sin(time * 2) * 0.02;
      groupRef.current.scale.setScalar(scale);
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* Render connections */}
      {connections.map((connection) => {
        const points = [connection.start, connection.end];
        const lineColor = new THREE.Color(color);
        
        // Vary brightness based on strength and activity
        const brightness = isActive 
          ? connection.strength * 0.8 + 0.2 
          : connection.strength * 0.3 + 0.1;
        
        return (
          <Line
            key={connection.id}
            points={points}
            color={lineColor}
            lineWidth={1}
            transparent
            opacity={brightness}
            dashed={false}
          />
        );
      })}
      
      {/* Render nodes */}
      {nodes.map((node, index) => (
        <mesh key={index} position={node}>
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}
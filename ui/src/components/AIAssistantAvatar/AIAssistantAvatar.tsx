import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Float } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { NeuralHead } from './NeuralHead';
import { NeuralConnections } from './NeuralConnections';
import { InteractionController } from './InteractionController';
import { SimpleHolographicAvatar } from './SimpleHolographicAvatar';
import { NebulaParticleSystem } from './NebulaParticleSystem';
import { BlendFunction } from 'postprocessing';

interface AIAssistantAvatarProps {
  isThinking?: boolean;
  isSpeaking?: boolean;
  className?: string;
  onInteraction?: () => void;
  variant?: 'neural' | 'avatar';
}

export function AIAssistantAvatar({ 
  isThinking = false, 
  isSpeaking = false,
  className = '',
  onInteraction,
  variant = 'avatar'
}: AIAssistantAvatarProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      <Canvas>
        <Suspense fallback={null}>
          {/* Camera */}
          <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45} />
          <OrbitControls 
            enablePan={false} 
            enableZoom={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.5}
            autoRotate
            autoRotateSpeed={0.5}
          />
          
          {/* Lighting */}
          <ambientLight intensity={0.2} />
          <pointLight position={[10, 10, 10]} intensity={0.5} color="#00b4d8" />
          <pointLight position={[-10, -10, -10]} intensity={0.3} color="#0099cc" />
          <pointLight position={[0, 5, 5]} intensity={0.4} color="#00ffff" />
          <spotLight position={[0, 10, 0]} angle={0.3} penumbra={0.5} intensity={0.5} color="#00b4d8" />
          
          {/* Avatar Selection */}
          <InteractionController 
            onHover={setIsHovered}
            onClick={onInteraction}
          >
            <Float
              speed={1.5}
              rotationIntensity={variant === 'neural' ? 0.2 : 0.1}
              floatIntensity={variant === 'neural' ? 0.3 : 0.2}
              floatingRange={[-0.1, 0.1]}
            >
              <group scale={isHovered ? 1.05 : 1}>
                {variant === 'neural' ? (
                  <>
                    <NeuralHead isThinking={isThinking} isSpeaking={isSpeaking} />
                    <NeuralConnections 
                      isActive={isThinking || isSpeaking || isHovered} 
                      nodeCount={isHovered ? 120 : 80}
                      connectionDensity={isHovered ? 0.3 : 0.2}
                      color={isHovered ? '#00ffff' : '#0088ff'}
                    />
                  </>
                ) : (
                  <SimpleHolographicAvatar 
                    isThinking={isThinking} 
                    isSpeaking={isSpeaking}
                  />
                )}
              </group>
            </Float>
          </InteractionController>
          
          {/* Particle System */}
          <NebulaParticleSystem 
            isActive={isThinking || isSpeaking || isHovered}
            color={isHovered ? '#00ffff' : '#00b4d8'}
          />
          
          {/* Post-processing effects */}
          <EffectComposer>
            <Bloom 
              intensity={isHovered ? 2.0 : 1.5}
              luminanceThreshold={0.1}
              luminanceSmoothing={0.9}
              blendFunction={BlendFunction.ADD}
            />
            <ChromaticAberration
              blendFunction={BlendFunction.NORMAL}
              offset={[isHovered ? 0.001 : 0.0005, isHovered ? 0.001 : 0.0005]}
            />
          </EffectComposer>
          
          {/* Environment for reflections */}
          <Environment preset="night" />
        </Suspense>
      </Canvas>
      
      {/* Status indicator */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-black/60 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isThinking && (
                <>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-cyan-400 text-sm font-mono">PROCESSING QUERY...</span>
                </>
              )}
              {isSpeaking && !isThinking && (
                <>
                  <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 animate-pulse" />
                  </div>
                  <span className="text-cyan-400 text-sm font-mono">TRANSMITTING...</span>
                </>
              )}
              {!isThinking && !isSpeaking && (
                <>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-sm font-mono">NEURAL NETWORK ONLINE</span>
                </>
              )}
            </div>
            {isHovered && (
              <span className="text-cyan-300 text-xs font-mono animate-pulse">INTERACTION DETECTED</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Stats } from '@react-three/drei';
import { AdaptiveQualityProvider, QualitySelector } from './AdaptiveQualityManager';
import { PerformanceMonitor } from './PerformanceMonitor';
import { OptimizedParticleSystem, InstancedParticleSystem } from './OptimizedParticleSystem';
import { LODSystem } from './LODSystem';
import { SweetAthenaAvatar } from '../AIAssistantAvatar/SweetAthenaAvatar';
import { ParticleSystem } from '../AIAssistantAvatar/ParticleSystem';
import { NebulaParticleSystem } from '../AIAssistantAvatar/NebulaParticleSystem';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  component: React.ReactNode;
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'baseline',
    name: 'Baseline Performance',
    description: 'Single optimized particle system',
    component: <OptimizedParticleSystem baseCount={500} isActive={true} />
  },
  {
    id: 'heavy_load',
    name: 'Heavy Load Test',
    description: 'Multiple particle systems with high counts',
    component: (
      <>
        <OptimizedParticleSystem baseCount={1000} isActive={true} color="#ff0000" />
        <group position={[3, 0, 0]}>
          <OptimizedParticleSystem baseCount={800} isActive={true} color="#00ff00" />
        </group>
        <group position={[-3, 0, 0]}>
          <OptimizedParticleSystem baseCount={600} isActive={true} color="#0000ff" />
        </group>
      </>
    )
  },
  {
    id: 'lod_test',
    name: 'LOD System Test',
    description: 'Multiple quality levels based on distance',
    component: (
      <>
        {Array.from({ length: 10 }, (_, i) => (
          <group key={i} position={[
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
          ]}>
            <LODSystem>
              {(detail) => (
                <OptimizedParticleSystem 
                  baseCount={detail === 'high' ? 200 : detail === 'medium' ? 100 : 50}
                  isActive={true}
                  color={`hsl(${i * 36}, 70%, 50%)`}
                />
              )}
            </LODSystem>
          </group>
        ))}
      </>
    )
  },
  {
    id: 'instanced_test',
    name: 'Instanced Rendering',
    description: 'High-performance instanced particle system',
    component: <InstancedParticleSystem count={2000} isActive={true} />
  },
  {
    id: 'athena_test',
    name: 'Sweet Athena Performance',
    description: 'Full Athena avatar with optimizations',
    component: (
      <group scale={0.5}>
        <SweetAthenaAvatar 
          isThinking={true}
          isSpeaking={false}
          personalityMood="sweet"
          sweetnessLevel={8}
        />
      </group>
    )
  },
  {
    id: 'legacy_comparison',
    name: 'Legacy vs Optimized',
    description: 'Compare old and new particle systems',
    component: (
      <>
        <group position={[-2, 0, 0]}>
          <Text position={[0, 2, 0]} fontSize={0.3} color="red">Legacy</Text>
          <ParticleSystem count={500} isActive={true} color="#ff0000" />
        </group>
        <group position={[2, 0, 0]}>
          <Text position={[0, 2, 0]} fontSize={0.3} color="green">Optimized</Text>
          <OptimizedParticleSystem baseCount={500} isActive={true} color="#00ff00" />
        </group>
      </>
    )
  }
];

export function PerformanceTestSuite() {
  const [selectedScenario, setSelectedScenario] = useState<string>('baseline');
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [currentQuality, setCurrentQuality] = useState<'low' | 'medium' | 'high'>('high');
  const testStartTimeRef = useRef<number>(0);

  const currentScenario = TEST_SCENARIOS.find(s => s.id === selectedScenario);

  const startTest = () => {
    setIsRunning(true);
    testStartTimeRef.current = performance.now();
    setTestResults({});
  };

  const stopTest = () => {
    setIsRunning(false);
    const duration = performance.now() - testStartTimeRef.current;
    console.log(`Test completed in ${duration.toFixed(2)}ms`);
  };

  // Auto-run test for 30 seconds when scenario changes
  useEffect(() => {
    if (selectedScenario) {
      startTest();
      const timer = setTimeout(stopTest, 30000);
      return () => clearTimeout(timer);
    }
  }, [selectedScenario]);

  return (
    <AdaptiveQualityProvider enableAutoAdjustment={true}>
      <div className="h-screen w-full bg-gray-900 flex">
        {/* Control Panel */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-4">Performance Test Suite</h2>
          
          {/* Test Scenarios */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-300 mb-3">Test Scenarios</h3>
            <div className="space-y-2">
              {TEST_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => setSelectedScenario(scenario.id)}
                  className={`
                    w-full text-left p-3 rounded-lg transition-colors
                    ${selectedScenario === scenario.id 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }
                  `}
                >
                  <div className="font-medium">{scenario.name}</div>
                  <div className="text-sm opacity-80">{scenario.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quality Controls */}
          <div className="mb-6">
            <QualitySelector />
          </div>

          {/* Test Controls */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-300 mb-3">Test Controls</h3>
            <div className="space-y-2">
              <button
                onClick={isRunning ? stopTest : startTest}
                className={`
                  w-full py-2 px-4 rounded transition-colors
                  ${isRunning 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                  }
                `}
              >
                {isRunning ? 'Stop Test' : 'Start Test'}
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Current Test Info */}
          {currentScenario && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-300 mb-3">Current Test</h3>
              <div className="bg-gray-700 p-3 rounded">
                <div className="font-medium text-white">{currentScenario.name}</div>
                <div className="text-sm text-gray-300 mt-1">{currentScenario.description}</div>
                <div className="text-xs text-gray-400 mt-2">
                  Status: {isRunning ? '🟢 Running' : '🔴 Stopped'}
                </div>
              </div>
            </div>
          )}

          {/* Performance Tips */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-300 mb-3">Performance Tips</h3>
            <div className="text-sm text-gray-400 space-y-2">
              <div>• Check FPS in top-right corner</div>
              <div>• Quality auto-adjusts based on performance</div>
              <div>• Green = Good, Yellow = Warning, Red = Poor</div>
              <div>• Use browser DevTools for detailed profiling</div>
              <div>• Test on different devices for best results</div>
            </div>
          </div>
        </div>

        {/* 3D Test Area */}
        <div className="flex-1 relative">
          <Canvas
            shadows
            dpr={[1, 2]}
            gl={{ 
              antialias: currentQuality !== 'low',
              alpha: true,
              powerPreference: "high-performance",
              preserveDrawingBuffer: true
            }}
            camera={{ position: [0, 0, 10], fov: 50 }}
          >
            {/* Basic scene setup */}
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={0.8} />
            <pointLight position={[-10, -10, -10]} intensity={0.4} color="#ff00ff" />
            
            {/* Controls */}
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={2}
              maxDistance={50}
            />

            {/* Test Scenario */}
            {currentScenario?.component}

            {/* Performance stats overlay */}
            <Stats 
              showPanel={0}
              className="performance-stats"
              parent={document.body}
            />
          </Canvas>

          {/* Performance Monitor Overlay */}
          <PerformanceMonitor 
            position="top-right"
            showDetailed={true}
            onQualityChange={setCurrentQuality}
          />

          {/* Test Status Overlay */}
          <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-white/20 rounded-lg p-4">
            <div className="text-white font-semibold mb-2">Active Test</div>
            <div className="text-gray-300 text-sm">{currentScenario?.name}</div>
            <div className="text-gray-400 text-xs mt-1">
              Quality: <span className={`font-medium ${
                currentQuality === 'high' ? 'text-green-400' :
                currentQuality === 'medium' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {currentQuality.toUpperCase()}
              </span>
            </div>
            {isRunning && (
              <div className="text-green-400 text-xs mt-2 flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                Test Running...
              </div>
            )}
          </div>

          {/* Instructions Overlay */}
          <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md border border-white/20 rounded-lg p-4">
            <div className="text-white font-semibold mb-2">Test Instructions</div>
            <div className="text-gray-300 text-sm space-y-1">
              <div>• Use mouse to orbit, zoom, and pan around the scene</div>
              <div>• Monitor the performance stats in the top-right corner</div>
              <div>• Try different quality settings to see the impact</div>
              <div>• Switch between test scenarios to compare performance</div>
            </div>
          </div>
        </div>
      </div>
    </AdaptiveQualityProvider>
  );
}

// Mobile-optimized version
export function MobilePerformanceTest() {
  return (
    <AdaptiveQualityProvider enableAutoAdjustment={true} initialQuality="medium">
      <div className="h-screen w-full bg-gray-900">
        <Canvas
          gl={{ 
            antialias: false,
            alpha: true,
            powerPreference: "low-power"
          }}
          camera={{ position: [0, 0, 8], fov: 60 }}
        >
          <ambientLight intensity={0.3} />
          <pointLight position={[5, 5, 5]} intensity={0.6} />
          
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            enableRotate={true}
            autoRotate={true}
            autoRotateSpeed={1}
          />

          {/* Simple test scene for mobile */}
          <OptimizedParticleSystem baseCount={100} isActive={true} />
          
          <group position={[0, 0, -2]}>
            <OptimizedParticleSystem baseCount={50} isActive={true} color="#ff6b6b" />
          </group>
        </Canvas>

        <PerformanceMonitor position="top-right" />
        
        <div className="absolute bottom-4 left-4 right-4 text-center">
          <div className="bg-black/80 backdrop-blur-md border border-white/20 rounded-lg p-3">
            <div className="text-white text-sm">Mobile Performance Test</div>
            <div className="text-gray-400 text-xs mt-1">Optimized for mobile devices</div>
          </div>
        </div>
      </div>
    </AdaptiveQualityProvider>
  );
}
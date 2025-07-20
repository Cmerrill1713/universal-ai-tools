import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { 
  Box, 
  Container, 
  Typography, 
  Paper, 
  Switch, 
  FormControlLabel,
  Grid,
  Button,
  Divider
} from '@mui/material';
import { AdaptiveQualityManager } from '../components/Performance/AdaptiveQualityManager';
import { PerformanceAnalyzer } from '../components/Performance/PerformanceAnalyzer';
import { MobileOptimizedParticles, BatchedParticleSystem } from '../components/Performance/MobileOptimizedParticles';
import { LODSystem, DistanceCulling, InstancedLOD } from '../components/Performance/LODSystem';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import * as THREE from 'three';

// Test scene with various performance features
const TestScene: React.FC<{ qualitySettings: any }> = ({ qualitySettings }) => {
  const [rotationSpeed, setRotationSpeed] = useState(0.01);

  // Create test geometries
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 16);
  const material = new THREE.MeshPhysicalMaterial({
    color: '#2196f3',
    metalness: 0.7,
    roughness: 0.3,
    envMapIntensity: qualitySettings.reflections ? 1 : 0
  });

  // Generate positions for instanced mesh
  const instanceCount = 100;
  const positions = new Float32Array(instanceCount * 3);
  const scales = new Float32Array(instanceCount * 3);
  
  for (let i = 0; i < instanceCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    
    const scale = 0.5 + Math.random() * 0.5;
    scales[i * 3] = scale;
    scales[i * 3 + 1] = scale;
    scales[i * 3 + 2] = scale;
  }

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1} 
        castShadow={qualitySettings.shadowQuality !== 'off'}
      />

      {/* LOD Test Object */}
      <group position={[0, 0, 0]}>
        <LODSystem qualitySettings={qualitySettings}>
          <mesh geometry={new THREE.BoxGeometry(2, 2, 2, 32, 32, 32)} material={material} />
          <mesh geometry={new THREE.BoxGeometry(2, 2, 2, 16, 16, 16)} material={material} />
          <mesh geometry={new THREE.BoxGeometry(2, 2, 2, 8, 8, 8)} material={material} />
          <mesh geometry={new THREE.BoxGeometry(2, 2, 2, 4, 4, 4)} material={material} />
        </LODSystem>
      </group>

      {/* Distance Culled Objects */}
      <DistanceCulling maxDistance={30} qualitySettings={qualitySettings}>
        <mesh position={[5, 0, 0]} geometry={sphereGeometry} material={material} />
      </DistanceCulling>

      {/* Instanced Meshes */}
      <InstancedLOD
        count={instanceCount}
        geometry={boxGeometry}
        material={material}
        qualitySettings={qualitySettings}
        positions={positions}
        scales={scales}
      />

      {/* Particle Effects */}
      <BatchedParticleSystem
        effects={[
          { type: 'stars', position: [0, 5, 0] },
          { type: 'dust', position: [-5, 0, 0] },
          { type: 'sparkles', position: [5, 0, 5] }
        ]}
        qualitySettings={qualitySettings}
      />
    </>
  );
};

const PerformanceDashboard: React.FC = () => {
  const { qualitySettings } = usePerformanceMonitor();
  const [showStats, setShowStats] = useState(true);
  const [showAnalyzer, setShowAnalyzer] = useState(true);
  const [showQualityManager, setShowQualityManager] = useState(true);
  const [enablePostProcessing, setEnablePostProcessing] = useState(true);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Performance Testing Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Controls */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Dashboard Controls
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={showStats} 
                      onChange={(e) => setShowStats(e.target.checked)}
                    />
                  }
                  label="Show FPS Stats"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={showAnalyzer} 
                      onChange={(e) => setShowAnalyzer(e.target.checked)}
                    />
                  }
                  label="Show Performance Analyzer"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={showQualityManager} 
                      onChange={(e) => setShowQualityManager(e.target.checked)}
                    />
                  }
                  label="Show Quality Manager"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={enablePostProcessing} 
                      onChange={(e) => setEnablePostProcessing(e.target.checked)}
                    />
                  }
                  label="Enable Post Processing"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* 3D Scene */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, height: '600px', position: 'relative' }}>
            <Canvas
              camera={{ position: [10, 10, 10], fov: 60 }}
              shadows={qualitySettings.shadowQuality !== 'off'}
              gl={{
                antialias: qualitySettings.antialias,
                powerPreference: 'high-performance',
                pixelRatio: Math.min(window.devicePixelRatio, 2) * qualitySettings.renderScale
              }}
            >
              <TestScene qualitySettings={qualitySettings} />
              <OrbitControls enableDamping dampingFactor={0.05} />
              {showStats && <Stats />}
              {showAnalyzer && <PerformanceAnalyzer />}
            </Canvas>
            
            {showQualityManager && (
              <AdaptiveQualityManager showControls />
            )}
          </Paper>
        </Grid>

        {/* Performance Tips */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Performance Optimization Tips
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Mobile Optimizations:
                </Typography>
                <ul>
                  <li>Automatic quality adjustment based on device type</li>
                  <li>Reduced particle counts and simplified shaders</li>
                  <li>Lower resolution rendering with render scale</li>
                  <li>Disabled post-processing effects by default</li>
                </ul>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Desktop Features:
                </Typography>
                <ul>
                  <li>Full post-processing pipeline with bloom and AO</li>
                  <li>High particle counts with advanced shaders</li>
                  <li>Real-time reflections and shadows</li>
                  <li>Ultra quality preset for high-end systems</li>
                </ul>
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              The system automatically detects your device type and adjusts quality settings. 
              You can override these settings using the Quality Manager panel.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default PerformanceDashboard;
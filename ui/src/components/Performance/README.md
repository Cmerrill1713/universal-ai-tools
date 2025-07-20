# 3D Performance Optimization System

This comprehensive 3D performance optimization system provides automatic quality scaling, LOD (Level of Detail) rendering, efficient particle systems, and real-time performance monitoring for React Three Fiber applications.

## Features

### 🚀 Adaptive Quality Management
- **Automatic quality scaling** based on real-time performance metrics
- **Device-specific optimization** for mobile and desktop
- **Custom quality presets** (Low, Medium, High, Ultra)
- **Real-time FPS monitoring** with automatic adjustment

### 🎯 Level of Detail (LOD) System
- **Distance-based quality scaling** for 3D objects
- **Particle count optimization** based on camera distance
- **Geometry simplification** for distant objects
- **Automatic culling** of invisible elements

### ⚡ Optimized Particle Systems
- **Object pooling** for memory efficiency
- **Shader-based rendering** for GPU acceleration
- **Instanced rendering** for high particle counts
- **Adaptive particle counts** based on performance

### 📊 Performance Monitoring
- **Real-time FPS tracking** with moving averages
- **Memory usage monitoring** (JavaScript heap)
- **WebGL draw call counting** and optimization
- **Performance warning system** with automatic alerts

### 📱 Mobile Optimization
- **Automatic mobile detection** with appropriate quality settings
- **Battery-aware performance** adjustments
- **Touch-optimized controls** and interactions
- **Reduced resource usage** for mobile devices

## Quick Start

### 1. Wrap Your App with Quality Provider

```tsx
import { AdaptiveQualityProvider } from './components/Performance/AdaptiveQualityManager';

function App() {
  return (
    <AdaptiveQualityProvider enableAutoAdjustment={true}>
      <YourApp />
    </AdaptiveQualityProvider>
  );
}
```

### 2. Add Performance Monitoring

```tsx
import { PerformanceMonitor } from './components/Performance/PerformanceMonitor';

function Scene() {
  return (
    <Canvas>
      {/* Your 3D content */}
      <PerformanceMonitor position="top-right" showDetailed={true} />
    </Canvas>
  );
}
```

### 3. Use Optimized Particle Systems

```tsx
import { OptimizedParticleSystem } from './components/Performance/OptimizedParticleSystem';

function ParticleScene() {
  return (
    <OptimizedParticleSystem 
      baseCount={500}
      isActive={true}
      color="#00ffff"
      qualityLevel="high"
    />
  );
}
```

### 4. Implement LOD for Complex Objects

```tsx
import { LODSystem } from './components/Performance/LODSystem';

function ComplexObject() {
  return (
    <LODSystem levels={[
      { distance: 0, detail: 'high' },
      { distance: 10, detail: 'medium' },
      { distance: 20, detail: 'low' }
    ]}>
      {(detail) => (
        <mesh>
          <sphereGeometry args={[
            1, 
            detail === 'high' ? 32 : detail === 'medium' ? 16 : 8,
            detail === 'high' ? 32 : detail === 'medium' ? 16 : 8
          ]} />
          <meshStandardMaterial />
        </mesh>
      )}
    </LODSystem>
  );
}
```

## API Reference

### AdaptiveQualityProvider

The main provider component that manages quality settings and performance monitoring.

```tsx
interface AdaptiveQualityProviderProps {
  children: React.ReactNode;
  initialQuality?: 'low' | 'medium' | 'high' | 'ultra';
  enableAutoAdjustment?: boolean;
}
```

**Props:**
- `initialQuality`: Starting quality level (default: 'high')
- `enableAutoAdjustment`: Enable automatic quality scaling (default: true)

### useAdaptiveQuality Hook

Access quality settings and controls from any component.

```tsx
const {
  currentQuality,        // Current quality level
  settings,             // Detailed quality settings
  isAdaptiveEnabled,    // Auto-adjustment status
  setQuality,           // Manual quality setter
  getParticleCount,     // Get optimized particle count
  shouldEnableEffect,   // Check if effect should be enabled
  getLODDistance        // Get LOD distance threshold
} = useAdaptiveQuality();
```

### PerformanceMonitor

Real-time performance monitoring with visual feedback.

```tsx
interface PerformanceMonitorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showDetailed?: boolean;
  onQualityChange?: (quality: 'low' | 'medium' | 'high') => void;
}
```

### OptimizedParticleSystem

High-performance particle system with automatic optimization.

```tsx
interface OptimizedParticleSystemProps {
  baseCount?: number;           // Base particle count
  isActive?: boolean;          // Animation state
  color?: string;              // Particle color
  size?: number;               // Particle size
  qualityLevel?: string;       // Quality override
  emissionRadius?: number;     // Spawn area radius
  lifespan?: number;          // Particle lifetime
  speed?: number;             // Movement speed
}
```

### LODSystem

Level of detail system for distance-based optimization.

```tsx
interface LODSystemProps {
  children: (detail: 'high' | 'medium' | 'low' | 'ultra-low') => React.ReactNode;
  levels?: LODLevel[];
  bounds?: THREE.Box3;
  forceDetail?: 'high' | 'medium' | 'low' | 'ultra-low';
}

interface LODLevel {
  distance: number;
  detail: 'high' | 'medium' | 'low' | 'ultra-low';
}
```

## Quality Settings

### Quality Levels

Each quality level has specific settings for different aspects:

**High Quality:**
- Particles: Up to 500 per system
- Shadows: High resolution
- Post-processing: All effects enabled
- Target FPS: 60+

**Medium Quality:**
- Particles: Up to 200 per system
- Shadows: Medium resolution
- Post-processing: Essential effects only
- Target FPS: 45+

**Low Quality:**
- Particles: Up to 50 per system
- Shadows: Low resolution or disabled
- Post-processing: Minimal effects
- Target FPS: 30+

### Mobile Optimizations

When mobile device is detected:
- Automatic quality reduction
- Reduced particle counts
- Simplified shaders
- Lower texture resolutions
- Disabled expensive post-processing

## Performance Best Practices

### 1. Use Object Pooling
```tsx
// Good: Reuse particle objects
const particlePool = new ParticlePool(1000);

// Avoid: Creating new objects every frame
particles.forEach(p => new Particle());
```

### 2. Implement LOD Systems
```tsx
// Good: Reduce detail based on distance
<LODSystem>
  {(detail) => <ComplexMesh detail={detail} />}
</LODSystem>

// Avoid: Same detail at all distances
<ComplexMesh detail="high" />
```

### 3. Monitor Performance
```tsx
// Good: Use performance hooks
const { fps, memoryUsage } = usePerformanceStats();

// Good: Add performance monitoring
<PerformanceMonitor showDetailed={true} />
```

### 4. Optimize Particle Systems
```tsx
// Good: Use optimized systems
<OptimizedParticleSystem baseCount={500} />

// Avoid: Unoptimized particle updates
useFrame(() => {
  particles.forEach(p => updateParticle(p)); // Expensive!
});
```

## Troubleshooting

### Low FPS Issues
1. Check particle counts (reduce if > 1000 total)
2. Disable expensive post-processing effects
3. Reduce geometry complexity
4. Enable automatic quality adjustment

### Memory Issues
1. Monitor JavaScript heap usage
2. Implement object pooling
3. Dispose of unused geometries/materials
4. Reduce texture sizes

### Mobile Performance
1. Use mobile-specific quality presets
2. Reduce particle counts significantly
3. Disable shadows and complex effects
4. Use lower polygon geometries

## Examples

### Complete Performance-Optimized Scene

```tsx
import { Canvas } from '@react-three/fiber';
import { 
  AdaptiveQualityProvider, 
  PerformanceMonitor, 
  OptimizedParticleSystem,
  LODSystem 
} from './components/Performance';

function OptimizedScene() {
  return (
    <AdaptiveQualityProvider enableAutoAdjustment={true}>
      <Canvas>
        {/* Lighting */}
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} />
        
        {/* Controls */}
        <OrbitControls />
        
        {/* Optimized Content */}
        <LODSystem>
          {(detail) => (
            <group>
              <OptimizedParticleSystem 
                baseCount={detail === 'high' ? 500 : 200}
                isActive={true}
              />
              
              <mesh>
                <sphereGeometry args={[
                  1,
                  detail === 'high' ? 32 : 16,
                  detail === 'high' ? 32 : 16
                ]} />
                <meshStandardMaterial />
              </mesh>
            </group>
          )}
        </LODSystem>
      </Canvas>
      
      <PerformanceMonitor position="top-right" />
    </AdaptiveQualityProvider>
  );
}
```

### Custom Quality Settings

```tsx
const customQualitySettings = {
  particles: {
    maxCount: 300,
    enablePhysics: true,
    textureResolution: 64
  },
  effects: {
    enableBloom: true,
    enableSSAO: false,
    shadowQuality: 'medium'
  }
};

<AdaptiveQualityProvider customSettings={customQualitySettings}>
  <YourScene />
</AdaptiveQualityProvider>
```

## Browser Compatibility

- **WebGL 2.0**: Full feature support
- **WebGL 1.0**: Reduced feature set, still functional
- **Mobile Browsers**: Automatic optimization applied
- **Safari**: Special handling for memory limitations
- **Chrome/Firefox**: Optimal performance

## Contributing

When adding new performance optimizations:

1. Maintain backward compatibility
2. Add performance monitoring hooks
3. Include mobile optimizations
4. Update quality presets accordingly
5. Add comprehensive tests

## License

This performance optimization system is part of the Universal AI Tools project and follows the same licensing terms.
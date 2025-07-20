import { useEffect, useRef, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';

export interface PerformanceMetrics {
  fps: number;
  averageFps: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  gpu: {
    load: number;
    temperature?: number;
  };
  isMobile: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  qualityLevel: 'low' | 'medium' | 'high' | 'ultra';
}

export interface QualitySettings {
  particleCount: number;
  particleSize: number;
  shadowQuality: 'low' | 'medium' | 'high' | 'off';
  postProcessing: boolean;
  reflections: boolean;
  antialias: boolean;
  bloom: boolean;
  ambientOcclusion: boolean;
  motionBlur: boolean;
  lodBias: number;
  textureQuality: number;
  renderScale: number;
}

const QUALITY_PRESETS: Record<string, QualitySettings> = {
  low: {
    particleCount: 100,
    particleSize: 0.5,
    shadowQuality: 'off',
    postProcessing: false,
    reflections: false,
    antialias: false,
    bloom: false,
    ambientOcclusion: false,
    motionBlur: false,
    lodBias: 2,
    textureQuality: 0.5,
    renderScale: 0.75,
  },
  medium: {
    particleCount: 500,
    particleSize: 0.75,
    shadowQuality: 'low',
    postProcessing: true,
    reflections: false,
    antialias: true,
    bloom: true,
    ambientOcclusion: false,
    motionBlur: false,
    lodBias: 1,
    textureQuality: 0.75,
    renderScale: 0.9,
  },
  high: {
    particleCount: 1000,
    particleSize: 1,
    shadowQuality: 'medium',
    postProcessing: true,
    reflections: true,
    antialias: true,
    bloom: true,
    ambientOcclusion: true,
    motionBlur: false,
    lodBias: 0,
    textureQuality: 1,
    renderScale: 1,
  },
  ultra: {
    particleCount: 2000,
    particleSize: 1.2,
    shadowQuality: 'high',
    postProcessing: true,
    reflections: true,
    antialias: true,
    bloom: true,
    ambientOcclusion: true,
    motionBlur: true,
    lodBias: -1,
    textureQuality: 1,
    renderScale: 1,
  },
};

const FPS_SAMPLES = 60;
const QUALITY_ADJUST_INTERVAL = 5000; // 5 seconds
const FPS_THRESHOLDS = {
  low: { min: 25, target: 30 },
  medium: { min: 40, target: 45 },
  high: { min: 55, target: 60 },
};

export function usePerformanceMonitor(
  autoAdjustQuality = true,
  targetFps = 60
) {
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());
  const qualityAdjustTimeRef = useRef(0);
  
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    averageFps: 60,
    memory: { used: 0, total: 0, percentage: 0 },
    gpu: { load: 0 },
    isMobile: false,
    deviceType: 'desktop',
    qualityLevel: 'high',
  });

  const [qualitySettings, setQualitySettings] = useState<QualitySettings>(
    QUALITY_PRESETS.high
  );

  const [overrideQuality, setOverrideQuality] = useState<string | null>(null);

  // Detect device type
  useEffect(() => {
    const detectDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      );
      
      let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
      
      if (isMobile) {
        const isTablet = /ipad|tablet|playbook|silk/i.test(userAgent) ||
          (window.innerWidth >= 768 && window.innerWidth <= 1024);
        deviceType = isTablet ? 'tablet' : 'mobile';
      }

      // Determine initial quality based on device
      let initialQuality: 'low' | 'medium' | 'high' | 'ultra' = 'high';
      if (deviceType === 'mobile') {
        initialQuality = 'low';
      } else if (deviceType === 'tablet') {
        initialQuality = 'medium';
      }

      setMetrics(prev => ({
        ...prev,
        isMobile,
        deviceType,
        qualityLevel: initialQuality,
      }));

      if (!overrideQuality) {
        setQualitySettings(QUALITY_PRESETS[initialQuality]);
      }
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    return () => window.removeEventListener('resize', detectDevice);
  }, [overrideQuality]);

  // Monitor memory usage
  useEffect(() => {
    const checkMemory = () => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memory: {
            used: memInfo.usedJSHeapSize / 1048576, // Convert to MB
            total: memInfo.totalJSHeapSize / 1048576,
            percentage: (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100,
          },
        }));
      }
    };

    const interval = setInterval(checkMemory, 1000);
    return () => clearInterval(interval);
  }, []);

  // Frame monitoring hook
  useFrame((state, delta) => {
    const now = performance.now();
    const frameTime = now - lastTimeRef.current;
    lastTimeRef.current = now;

    // Store frame times
    frameTimesRef.current.push(frameTime);
    if (frameTimesRef.current.length > FPS_SAMPLES) {
      frameTimesRef.current.shift();
    }

    // Calculate FPS
    const averageFrameTime =
      frameTimesRef.current.reduce((a, b) => a + b, 0) /
      frameTimesRef.current.length;
    const fps = 1000 / averageFrameTime;
    const averageFps = 1000 / averageFrameTime;

    setMetrics(prev => ({
      ...prev,
      fps: Math.round(fps),
      averageFps: Math.round(averageFps),
    }));

    // Auto-adjust quality
    if (
      autoAdjustQuality &&
      !overrideQuality &&
      now - qualityAdjustTimeRef.current > QUALITY_ADJUST_INTERVAL
    ) {
      qualityAdjustTimeRef.current = now;
      adjustQuality(averageFps, metrics.deviceType);
    }
  });

  const adjustQuality = useCallback(
    (currentFps: number, deviceType: string) => {
      let newQuality = metrics.qualityLevel;
      const threshold = FPS_THRESHOLDS[
        metrics.qualityLevel === 'ultra' ? 'high' : metrics.qualityLevel
      ];

      if (currentFps < threshold.min) {
        // Downgrade quality
        if (metrics.qualityLevel === 'ultra') newQuality = 'high';
        else if (metrics.qualityLevel === 'high') newQuality = 'medium';
        else if (metrics.qualityLevel === 'medium') newQuality = 'low';
      } else if (currentFps > threshold.target + 10) {
        // Upgrade quality if consistently above target
        if (metrics.qualityLevel === 'low' && deviceType !== 'mobile') {
          newQuality = 'medium';
        } else if (metrics.qualityLevel === 'medium' && deviceType === 'desktop') {
          newQuality = 'high';
        } else if (metrics.qualityLevel === 'high' && deviceType === 'desktop') {
          newQuality = 'ultra';
        }
      }

      if (newQuality !== metrics.qualityLevel) {
        setMetrics(prev => ({ ...prev, qualityLevel: newQuality }));
        setQualitySettings(QUALITY_PRESETS[newQuality]);
      }
    },
    [metrics.qualityLevel]
  );

  const setQualityPreset = useCallback((preset: string) => {
    if (QUALITY_PRESETS[preset]) {
      setOverrideQuality(preset);
      setQualitySettings(QUALITY_PRESETS[preset]);
      setMetrics(prev => ({ ...prev, qualityLevel: preset as any }));
    }
  }, []);

  const setCustomQuality = useCallback((settings: Partial<QualitySettings>) => {
    setQualitySettings(prev => ({ ...prev, ...settings }));
  }, []);

  const resetAutoQuality = useCallback(() => {
    setOverrideQuality(null);
  }, []);

  return {
    metrics,
    qualitySettings,
    setQualityPreset,
    setCustomQuality,
    resetAutoQuality,
    isAutoAdjusting: autoAdjustQuality && !overrideQuality,
  };
}
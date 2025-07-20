import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSpring, a } from '@react-spring/three';
import { gsap } from 'gsap';

interface VoiceAmplitudeVisualizerProps {
  speaking: boolean;
  listening: boolean;
  audioElement?: HTMLAudioElement;
  microphoneStream?: MediaStream;
  onAmplitudeChange?: (amplitude: number) => void;
  sensitivity?: number;
  smoothing?: number;
}

export function VoiceAmplitudeVisualizer({
  speaking,
  listening,
  audioElement,
  microphoneStream,
  onAmplitudeChange,
  sensitivity = 1.0,
  smoothing = 0.8
}: VoiceAmplitudeVisualizerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  
  const [currentAmplitude, setCurrentAmplitude] = useState(0);
  const [frequencyData, setFrequencyData] = useState<number[]>([]);

  // Initialize audio analysis
  useEffect(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('Web Audio API not supported');
        return;
      }
    }

    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    // Clean up previous connections
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    try {
      // Create analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = smoothing;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      // Connect audio source
      if (speaking && audioElement) {
        // Analyzing output audio (TTS)
        const source = audioContext.createMediaElementSource(audioElement);
        source.connect(analyser);
        source.connect(audioContext.destination); // Continue audio playback
        sourceRef.current = source;
      } else if (listening && microphoneStream) {
        // Analyzing input audio (microphone)
        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyser);
        sourceRef.current = source;
      }
    } catch (error) {
      console.warn('Failed to setup audio analysis:', error);
    }

    return () => {
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
    };
  }, [speaking, listening, audioElement, microphoneStream, smoothing]);

  // Audio analysis loop
  useFrame(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    // Calculate amplitude
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    const average = sum / dataArrayRef.current.length;
    const normalizedAmplitude = Math.min((average / 255) * sensitivity, 1);
    
    setCurrentAmplitude(normalizedAmplitude);
    
    // Extract frequency bands for visualization
    const bands = 8;
    const bandSize = Math.floor(dataArrayRef.current.length / bands);
    const newFrequencyData: number[] = [];
    
    for (let i = 0; i < bands; i++) {
      let bandSum = 0;
      for (let j = 0; j < bandSize; j++) {
        bandSum += dataArrayRef.current[i * bandSize + j];
      }
      newFrequencyData.push((bandSum / bandSize) / 255);
    }
    
    setFrequencyData(newFrequencyData);
    
    // Notify parent of amplitude change
    if (onAmplitudeChange) {
      onAmplitudeChange(normalizedAmplitude);
    }

    // Update shader uniforms
    if (materialRef.current) {
      materialRef.current.uniforms.amplitude.value = normalizedAmplitude;
      materialRef.current.uniforms.time.value = performance.now() * 0.001;
      materialRef.current.uniforms.speaking.value = speaking ? 1 : 0;
      materialRef.current.uniforms.listening.value = listening ? 1 : 0;
    }
  });

  // Spring animation for smooth amplitude changes
  const springProps = useSpring({
    scale: 1 + currentAmplitude * 0.3,
    config: { tension: 200, friction: 20 }
  });

  // Voice visualization shader
  const shaderMaterial = React.useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        amplitude: { value: 0 },
        speaking: { value: 0 },
        listening: { value: 0 },
        colorSpeaking: { value: new THREE.Color('#00ffff') },
        colorListening: { value: new THREE.Color('#ff6b6b') },
        colorIdle: { value: new THREE.Color('#9b59b6') }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        uniform float time;
        uniform float amplitude;
        
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normal;
          
          vec3 pos = position;
          
          // Voice-driven displacement
          float wave = sin(position.y * 10.0 + time * 5.0) * amplitude * 0.1;
          pos += normal * wave;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        uniform float time;
        uniform float amplitude;
        uniform float speaking;
        uniform float listening;
        uniform vec3 colorSpeaking;
        uniform vec3 colorListening;
        uniform vec3 colorIdle;
        
        void main() {
          // Base pattern
          float pattern = sin(vPosition.x * 5.0 + time) * 
                         sin(vPosition.y * 5.0 + time * 2.0) * 
                         sin(vPosition.z * 5.0 + time * 1.5);
          
          // Amplitude-driven intensity
          float intensity = 0.5 + amplitude * 0.5;
          
          // Color mixing based on state
          vec3 baseColor = colorIdle;
          if (speaking > 0.5) {
            baseColor = mix(colorIdle, colorSpeaking, speaking);
          } else if (listening > 0.5) {
            baseColor = mix(colorIdle, colorListening, listening);
          }
          
          vec3 color = mix(baseColor * 0.7, baseColor, pattern * 0.5 + 0.5);
          color *= intensity;
          
          // Voice activity glow
          float glow = amplitude * 2.0;
          color += glow * baseColor * 0.3;
          
          // Edge enhancement
          float fresnel = 1.0 - dot(normalize(vNormal), vec3(0, 0, 1));
          color += fresnel * baseColor * 0.2;
          
          gl_FragColor = vec4(color, 0.8 + amplitude * 0.2);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });
  }, []);

  return (
    <group>
      {/* Main voice visualization sphere */}
      <a.mesh 
        ref={meshRef} 
        scale={springProps.scale}
        material={shaderMaterial}
      >
        <sphereGeometry args={[1.05, 64, 64]} />
        <primitive object={shaderMaterial} ref={materialRef} />
      </a.mesh>

      {/* Frequency band visualizers */}
      {frequencyData.map((intensity, index) => (
        <FrequencyBand
          key={index}
          index={index}
          intensity={intensity}
          total={frequencyData.length}
          speaking={speaking}
          listening={listening}
        />
      ))}

      {/* Voice activity particles */}
      {(speaking || listening) && (
        <VoiceParticles 
          amplitude={currentAmplitude}
          speaking={speaking}
          listening={listening}
        />
      )}
    </group>
  );
}

// Individual frequency band visualizer
function FrequencyBand({ 
  index, 
  intensity, 
  total, 
  speaking, 
  listening 
}: {
  index: number;
  intensity: number;
  total: number;
  speaking: boolean;
  listening: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const angle = (index / total) * Math.PI * 2;
  const radius = 1.5;
  
  const position: [number, number, number] = [
    Math.cos(angle) * radius,
    (intensity - 0.5) * 2,
    Math.sin(angle) * radius
  ];

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.getElapsedTime();
      meshRef.current.scale.y = 0.1 + intensity * 2;
      meshRef.current.rotation.y = t + index * 0.5;
    }
  });

  const color = speaking ? '#00ffff' : listening ? '#ff6b6b' : '#9b59b6';

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[0.05, 1, 0.05]} />
      <meshStandardMaterial 
        color={color}
        emissive={color}
        emissiveIntensity={intensity * 0.5}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

// Voice activity particles
function VoiceParticles({ 
  amplitude, 
  speaking, 
  listening 
}: {
  amplitude: number;
  speaking: boolean;
  listening: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const particleCount = Math.floor(amplitude * 50) + 10;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.5;
      groupRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        mesh.position.y = Math.sin(state.clock.getElapsedTime() * 2 + i) * amplitude;
        mesh.scale.setScalar(0.5 + amplitude);
      });
    }
  });

  const color = speaking ? '#00ffff' : listening ? '#ff6b6b' : '#9b59b6';

  return (
    <group ref={groupRef}>
      {Array.from({ length: particleCount }).map((_, i) => {
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 2 + Math.random() * 0.5;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              (Math.random() - 0.5) * 2,
              Math.sin(angle) * radius
            ]}
          >
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial 
              color={color}
              emissive={color}
              emissiveIntensity={amplitude}
              transparent
              opacity={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// Hook for easy integration
export function useVoiceAmplitude(
  audioElement?: HTMLAudioElement,
  microphoneStream?: MediaStream
) {
  const [amplitude, setAmplitude] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);

  // Detect speaking state from audio element
  useEffect(() => {
    if (!audioElement) return;

    const handlePlay = () => setSpeaking(true);
    const handlePause = () => setSpeaking(false);
    const handleEnded = () => setSpeaking(false);

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);

    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
    };
  }, [audioElement]);

  // Detect listening state from microphone stream
  useEffect(() => {
    if (microphoneStream) {
      setListening(microphoneStream.active);
    }
  }, [microphoneStream]);

  return {
    amplitude,
    speaking,
    listening,
    setAmplitude,
    setSpeaking,
    setListening
  };
}
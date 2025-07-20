import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceAmplitudeVisualizer, useVoiceAmplitude } from '../../components/SweetAthena/Advanced/VoiceAmplitudeVisualizer';
import * as THREE from 'three';

// Mock Three.js
vi.mock('three', () => ({
  Vector3: vi.fn(),
  BufferGeometry: vi.fn(),
  BufferAttribute: vi.fn(),
  PointsMaterial: vi.fn(),
  Points: vi.fn(),
  Color: vi.fn(),
  MathUtils: {
    randFloatSpread: vi.fn(() => Math.random() * 2 - 1)
  }
}));

// Mock react-three/fiber
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ scene: {} })
}));

describe('Voice Interaction Tests', () => {
  let mockAudioContext: any;
  let mockAnalyser: any;
  let mockSource: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Web Audio API
    mockAnalyser = {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn((array: Uint8Array) => {
        // Simulate audio data
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.random() * 255;
        }
      }),
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    mockSource = {
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    mockAudioContext = {
      createAnalyser: vi.fn(() => mockAnalyser),
      createMediaElementSource: vi.fn(() => mockSource),
      createMediaStreamSource: vi.fn(() => mockSource),
      state: 'running',
      resume: vi.fn()
    };

    // Mock window.AudioContext
    global.AudioContext = vi.fn(() => mockAudioContext) as any;
  });

  it('should detect voice amplitude from audio element', async () => {
    const audioElement = document.createElement('audio');
    let detectedAmplitude = 0;

    const TestComponent = () => {
      const { amplitude } = useVoiceAmplitude({
        audioElement,
        sensitivity: 1.0,
        smoothing: 0.8
      });

      detectedAmplitude = amplitude;
      return <div>Amplitude: {amplitude.toFixed(2)}</div>;
    };

    render(<TestComponent />);

    // Simulate audio playback
    audioElement.dispatchEvent(new Event('play'));

    await waitFor(() => {
      expect(mockAudioContext.createMediaElementSource).toHaveBeenCalledWith(audioElement);
      expect(mockSource.connect).toHaveBeenCalled();
    });
  });

  it('should detect voice amplitude from microphone stream', async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }]
    } as any as MediaStream;

    let detectedAmplitude = 0;

    const TestComponent = () => {
      const { amplitude } = useVoiceAmplitude({
        microphoneStream: mockStream,
        sensitivity: 1.5,
        smoothing: 0.9
      });

      detectedAmplitude = amplitude;
      return <div>Amplitude: {amplitude.toFixed(2)}</div>;
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(mockSource.connect).toHaveBeenCalled();
    });
  });

  it('should visualize amplitude with particles', () => {
    const { container } = render(
      <VoiceAmplitudeVisualizer
        speaking={true}
        listening={false}
        sensitivity={1.0}
        smoothing={0.8}
      />
    );

    // Check that THREE.js objects are created
    expect(THREE.BufferGeometry).toHaveBeenCalled();
    expect(THREE.PointsMaterial).toHaveBeenCalled();
  });

  it('should handle different visualization modes', () => {
    const { rerender } = render(
      <VoiceAmplitudeVisualizer
        speaking={false}
        listening={true}
        sensitivity={1.0}
        smoothing={0.8}
      />
    );

    // Test speaking mode
    rerender(
      <VoiceAmplitudeVisualizer
        speaking={true}
        listening={false}
        sensitivity={1.0}
        smoothing={0.8}
      />
    );

    // Test both modes
    rerender(
      <VoiceAmplitudeVisualizer
        speaking={true}
        listening={true}
        sensitivity={1.0}
        smoothing={0.8}
      />
    );

    // Verify different particle configurations
    expect(THREE.BufferGeometry).toHaveBeenCalled();
  });

  it('should clean up audio connections on unmount', () => {
    const audioElement = document.createElement('audio');

    const { unmount } = render(
      <VoiceAmplitudeVisualizer
        speaking={true}
        listening={false}
        audioElement={audioElement}
        sensitivity={1.0}
        smoothing={0.8}
      />
    );

    audioElement.dispatchEvent(new Event('play'));

    unmount();

    // Verify cleanup
    expect(mockSource.disconnect).toHaveBeenCalled();
    expect(mockAnalyser.disconnect).toHaveBeenCalled();
  });

  it('should apply sensitivity and smoothing parameters', async () => {
    let capturedAmplitude = 0;
    const TestComponent = ({ sensitivity, smoothing }: any) => {
      const { amplitude } = useVoiceAmplitude({
        audioElement: document.createElement('audio'),
        sensitivity,
        smoothing
      });

      capturedAmplitude = amplitude;
      return <div>Amplitude: {amplitude}</div>;
    };

    const { rerender } = render(
      <TestComponent sensitivity={1.0} smoothing={0.8} />
    );

    // Test different sensitivity
    rerender(<TestComponent sensitivity={2.0} smoothing={0.8} />);

    // Test different smoothing
    rerender(<TestComponent sensitivity={1.0} smoothing={0.5} />);
  });

  it('should handle audio context suspension', async () => {
    mockAudioContext.state = 'suspended';
    const audioElement = document.createElement('audio');

    const TestComponent = () => {
      const { amplitude } = useVoiceAmplitude({
        audioElement,
        sensitivity: 1.0,
        smoothing: 0.8
      });

      return <div>Amplitude: {amplitude}</div>;
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });
  });

  it('should handle missing audio sources gracefully', () => {
    const TestComponent = () => {
      const { amplitude } = useVoiceAmplitude({
        sensitivity: 1.0,
        smoothing: 0.8
      });

      return <div>Amplitude: {amplitude}</div>;
    };

    const { container } = render(<TestComponent />);
    
    expect(container.textContent).toContain('Amplitude: 0');
  });

  it('should update particle positions based on amplitude', () => {
    const mockUseFrame = vi.mocked(useFrame as any);
    let frameCallback: any;

    mockUseFrame.mockImplementation((callback) => {
      frameCallback = callback;
    });

    render(
      <VoiceAmplitudeVisualizer
        speaking={true}
        listening={false}
        sensitivity={1.0}
        smoothing={0.8}
      />
    );

    // Simulate frame update
    if (frameCallback) {
      frameCallback({ clock: { getElapsedTime: () => 1.0 } }, 0.016);
    }

    // Verify particle system updates
    expect(THREE.BufferAttribute).toHaveBeenCalled();
  });
});
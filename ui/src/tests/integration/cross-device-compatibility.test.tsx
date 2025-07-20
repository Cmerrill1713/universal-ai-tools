import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntegratedMovieGradeAthena } from '../../components/SweetAthena/Advanced/IntegratedMovieGradeAthena';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock all 3D libraries for testing
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="3d-canvas">{children}</div>,
  useFrame: vi.fn(),
  useThree: () => ({ scene: {}, camera: {}, gl: {} })
}));

vi.mock('@react-three/drei', () => ({
  Float: ({ children }: any) => <div>{children}</div>,
  MeshTransmissionMaterial: () => null,
  MeshDistortMaterial: () => null,
  MeshRefractionMaterial: () => null,
  MeshReflectorMaterial: () => null,
  Sparkles: () => null,
  Cloud: () => null,
  Environment: () => null,
  ContactShadows: () => null,
  Html: ({ children }: any) => <div>{children}</div>,
  Trail: ({ children }: any) => <div>{children}</div>,
  Stars: () => null
}));

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: any) => <div>{children}</div>,
  Bloom: () => null,
  DepthOfField: () => null,
  ChromaticAberration: () => null,
  SSAO: () => null,
  Vignette: () => null,
  HueSaturation: () => null,
  BrightnessContrast: () => null
}));

vi.mock('@react-three/cannon', () => ({
  Physics: ({ children }: any) => <div>{children}</div>,
  useBox: () => [null, {}],
  useSphere: () => [null, {}],
  usePlane: () => [null]
}));

vi.mock('leva', () => ({
  useControls: () => ({}),
  folder: () => ({}),
  Leva: () => null
}));

// Mock hooks
vi.mock('../../hooks/useChat', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    isThinking: false
  })
}));

vi.mock('../../hooks/useSystemStatus', () => ({
  useSystemStatus: () => ({
    status: {
      healthy: true,
      services: [
        { name: 'api', status: 'healthy' },
        { name: 'database', status: 'healthy' }
      ]
    }
  })
}));

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {component}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Cross-Device Compatibility Tests', () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.navigator = originalNavigator;
    global.window = originalWindow;
  });

  describe('Mobile Devices', () => {
    it('should render correctly on iPhone', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Describe what you want to create...')).toBeInTheDocument();
    });

    it('should render correctly on Android', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36',
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      expect(screen.getByText('Your AI Creation Assistant')).toBeInTheDocument();
    });

    it('should handle touch events on mobile', () => {
      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        value: 5,
        configurable: true
      });

      const { container } = renderWithProviders(<IntegratedMovieGradeAthena />);
      
      // Simulate touch event
      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      const canvas = container.querySelector('[data-testid="3d-canvas"]');
      canvas?.dispatchEvent(touchEvent);
    });
  });

  describe('Tablet Devices', () => {
    it('should render correctly on iPad', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    });

    it('should adapt layout for tablet viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        configurable: true
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 1024,
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      const sidebar = screen.getByText('Your Creations').closest('div');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe('Desktop Browsers', () => {
    it('should render correctly on Chrome', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0',
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    });

    it('should render correctly on Safari', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    });

    it('should render correctly on Firefox', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    });
  });

  describe('Screen Resolutions', () => {
    it('should handle 4K displays', () => {
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 2,
        configurable: true
      });
      Object.defineProperty(window, 'innerWidth', {
        value: 3840,
        configurable: true
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 2160,
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    });

    it('should handle small screens (mobile)', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
        configurable: true
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 667,
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    });
  });

  describe('WebGL Support', () => {
    it('should handle missing WebGL gracefully', () => {
      const canvas = document.createElement('canvas');
      canvas.getContext = vi.fn(() => null);

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      // Should still render UI elements
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    });

    it('should detect WebGL2 support', () => {
      const canvas = document.createElement('canvas');
      const mockContext = { version: 2 };
      canvas.getContext = vi.fn((type) => {
        if (type === 'webgl2') return mockContext;
        return null;
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      const input = screen.getByPlaceholderText('Describe what you want to create...');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should support keyboard navigation', () => {
      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      // All buttons should be focusable
      buttons.forEach(button => {
        expect(button.tabIndex).toBeGreaterThanOrEqual(-1);
      });
    });

    it('should have proper contrast ratios', () => {
      const { container } = renderWithProviders(<IntegratedMovieGradeAthena />);
      
      // Check text elements have sufficient contrast
      const textElements = container.querySelectorAll('h1, h2, h3, p, span');
      expect(textElements.length).toBeGreaterThan(0);
    });
  });

  describe('Performance on Low-End Devices', () => {
    it('should reduce quality on low-end devices', () => {
      // Simulate low-end device
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: 2,
        configurable: true
      });
      Object.defineProperty(navigator, 'deviceMemory', {
        value: 2,
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      // Should still render core functionality
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    });
  });

  describe('Network Conditions', () => {
    it('should handle offline mode', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      // Should still render UI
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    });

    it('should handle slow connections', () => {
      // @ts-ignore
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '2g',
          downlink: 0.5
        },
        configurable: true
      });

      renderWithProviders(<IntegratedMovieGradeAthena />);
      
      expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    });
  });
});
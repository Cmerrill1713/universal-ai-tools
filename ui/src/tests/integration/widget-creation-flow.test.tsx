import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { IntegratedMovieGradeAthena } from '../../components/SweetAthena/Advanced/IntegratedMovieGradeAthena';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock Three.js and related libraries
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
  PresentationControls: ({ children }: any) => <div>{children}</div>,
  Text: () => null,
  Trail: ({ children }: any) => <div>{children}</div>,
  useTexture: () => null,
  Stars: () => null,
  Sphere: () => null
}));

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: any) => <div>{children}</div>,
  Bloom: () => null,
  DepthOfField: () => null,
  ChromaticAberration: () => null,
  SSAO: () => null,
  Glitch: () => null,
  Scanline: () => null,
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

vi.mock('gsap', () => ({
  default: {
    timeline: () => ({
      to: vi.fn().mockReturnThis()
    })
  }
}));

vi.mock('leva', () => ({
  useControls: () => ({}),
  folder: () => ({}),
  Leva: () => null
}));

vi.mock('stats.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    showPanel: vi.fn(),
    begin: vi.fn(),
    end: vi.fn(),
    dom: document.createElement('div')
  }))
}));

vi.mock('three-nebula', () => ({
  default: {
    System: vi.fn(),
    Emitter: vi.fn(),
    Rate: vi.fn(),
    Span: vi.fn(),
    Mass: vi.fn(),
    Radius: vi.fn(),
    Life: vi.fn(),
    BodySprite: vi.fn(),
    Position: vi.fn(),
    SphereZone: vi.fn(),
    Alpha: vi.fn(),
    Scale: vi.fn(),
    Gravity: vi.fn(),
    Rotate: vi.fn(),
    SpriteRenderer: vi.fn(),
    getEasingByName: vi.fn()
  }
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

describe('Widget Creation Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the main Athena interface', async () => {
    renderWithProviders(<IntegratedMovieGradeAthena />);
    
    expect(screen.getByText('Sweet Athena')).toBeInTheDocument();
    expect(screen.getByText('Your AI Creation Assistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe what you want to create...')).toBeInTheDocument();
  });

  it('should display quick action buttons', async () => {
    renderWithProviders(<IntegratedMovieGradeAthena />);
    
    expect(screen.getByText('Create Component')).toBeInTheDocument();
    expect(screen.getByText('Design Schema')).toBeInTheDocument();
    expect(screen.getByText('Build API')).toBeInTheDocument();
    expect(screen.getByText('Generate UI')).toBeInTheDocument();
  });

  it('should handle natural language widget creation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IntegratedMovieGradeAthena />);
    
    const input = screen.getByPlaceholderText('Describe what you want to create...');
    
    // Type a widget creation request
    await user.type(input, 'Create a weather widget that shows current temperature');
    await user.keyboard('{Enter}');
    
    // Should show creation in progress
    await waitFor(() => {
      expect(screen.getByText('Creating your widget...')).toBeInTheDocument();
    });
    
    // Wait for widget to be created (simulated)
    await waitFor(() => {
      expect(screen.getByText('Your Creations')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('should handle quick action clicks', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IntegratedMovieGradeAthena />);
    
    const createComponentButton = screen.getByText('Create Component');
    await user.click(createComponentButton);
    
    await waitFor(() => {
      expect(screen.getByText('Creating your widget...')).toBeInTheDocument();
    });
  });

  it('should toggle widget creator studio', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IntegratedMovieGradeAthena />);
    
    // Find and click the code button
    const codeButtons = screen.getAllByRole('button');
    const codeButton = codeButtons.find(btn => btn.querySelector('.lucide-code'));
    
    if (codeButton) {
      await user.click(codeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Widget Creator Studio')).toBeInTheDocument();
      });
    }
  });

  it('should display system status', () => {
    renderWithProviders(<IntegratedMovieGradeAthena />);
    
    expect(screen.getByText('2/2 Services')).toBeInTheDocument();
  });

  it('should handle voice input toggle', async () => {
    const user = userEvent.setup();
    
    // Mock getUserMedia
    const mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true
    });
    
    renderWithProviders(<IntegratedMovieGradeAthena />);
    
    // Find mic button
    const buttons = screen.getAllByRole('button');
    const micButton = buttons.find(btn => btn.querySelector('.lucide-mic'));
    
    if (micButton) {
      await user.click(micButton);
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
      });
    }
  });

  it('should create different widget types based on input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IntegratedMovieGradeAthena />);
    
    const input = screen.getByPlaceholderText('Describe what you want to create...');
    
    // Test API creation
    await user.clear(input);
    await user.type(input, 'Build a REST API for user management');
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(screen.getByText('Creating your widget...')).toBeInTheDocument();
    });
  });

  it('should handle empty input gracefully', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IntegratedMovieGradeAthena />);
    
    const input = screen.getByPlaceholderText('Describe what you want to create...');
    
    // Try to submit empty input
    await user.click(input);
    await user.keyboard('{Enter}');
    
    // Should not show creation in progress
    expect(screen.queryByText('Creating your widget...')).not.toBeInTheDocument();
  });

  it('should display created widgets in sidebar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IntegratedMovieGradeAthena />);
    
    const input = screen.getByPlaceholderText('Describe what you want to create...');
    
    // Create a widget
    await user.type(input, 'Create a todo list component');
    await user.keyboard('{Enter}');
    
    // Wait for widget creation
    await waitFor(() => {
      expect(screen.getByText('0 widgets')).toBeInTheDocument();
    });
    
    // After creation simulation
    await waitFor(() => {
      expect(screen.getByText('1 widgets')).toBeInTheDocument();
    }, { timeout: 4000 });
  });
});
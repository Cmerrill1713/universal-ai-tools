import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';

// Mock the Zustand store
vi.mock('../store/useStore', () => ({
  useStore: () => ({
    preferences: {
      theme: 'dark' as const,
    },
    updatePreferences: vi.fn(),
  }),
}));

// Mock the ThemeProvider to avoid context issues
vi.mock('../theme/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>,
  useTheme: () => ({
    theme: 'dark' as const,
    resolvedTheme: 'dark' as const,
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
  }),
}));

// Mock connection and service managers to prevent memory leaks
vi.mock('../services/connectionManager', () => ({
  default: {
    initialize: vi.fn(),
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../services/aiSelfHealingSystem', () => ({
  aiSelfHealingSystem: {
    initialize: vi.fn(),
    shutdown: vi.fn(),
    heal: vi.fn().mockResolvedValue(true),
  },
}));

// Mock any other services that might cause issues
vi.mock('../services/api', () => ({
  api: {
    healthCheck: vi.fn().mockResolvedValue({ status: 'ok' }),
  },
}));

// Mock the lazy-loaded components with minimal implementation
vi.mock('../pages/Dashboard', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('../pages/Chat', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('../pages/Settings', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('../pages/Services', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('../pages/ImageGeneration', () => ({
  __esModule: true,
  ImageGeneration: () => null,
}));

vi.mock('../pages/News', () => ({
  __esModule: true,
  News: () => null,
}));

vi.mock('../pages/Libraries', () => ({
  __esModule: true,
  Libraries: () => null,
}));

vi.mock('../pages/ServiceMonitoring', () => ({
  __esModule: true,
  ServiceMonitoring: () => null,
}));

// Types for motion component props
interface MotionProps {
  children: React.ReactNode;
  [key: string]: unknown;
}

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  ...vi.importActual('framer-motion'),
  motion: {
    div: ({ children, ...props }: MotionProps) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
    main: ({ children, ...props }: MotionProps) => (
      <main {...(props as React.HTMLAttributes<HTMLElement>)}>{children}</main>
    ),
    button: ({ children, ...props }: MotionProps) => (
      <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
    ),
    p: ({ children, ...props }: MotionProps) => (
      <p {...(props as React.HTMLAttributes<HTMLParagraphElement>)}>{children}</p>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock heroicons to avoid import errors
vi.mock('@heroicons/react/24/outline', () => ({
  ExclamationTriangleIcon: () => <div data-testid='exclamation-triangle-icon'>!</div>,
  ArrowPathIcon: () => <div data-testid='arrow-path-icon'>REFRESH</div>,
  HomeIcon: () => <div data-testid='home-icon'>HOME</div>,
  ChatBubbleLeftIcon: () => <div data-testid='chat-icon'>CHAT</div>,
  ChatBubbleLeftRightIcon: () => <div data-testid='chat-icon'>CHAT</div>,
  PhotoIcon: () => <div data-testid='photo-icon'>PHOTO</div>,
  ServerIcon: () => <div data-testid='server-icon'>SERVER</div>,
  Cog6ToothIcon: () => <div data-testid='settings-icon'>SETTINGS</div>,
  NewspaperIcon: () => <div data-testid='newspaper-icon'>NEWS</div>,
  BookOpenIcon: () => <div data-testid='book-icon'>BOOK</div>,
  ChartBarIcon: () => <div data-testid='chart-icon'>CHART</div>,
  DocumentIcon: () => <div data-testid='document-icon'>DOC</div>,
  CommandLineIcon: () => <div data-testid='command-line-icon'>CLI</div>,
  MicrophoneIcon: () => <div data-testid='microphone-icon'>MIC</div>,
  DocumentPlusIcon: () => <div data-testid='document-plus-icon'>DOC+</div>,
  VideoCameraIcon: () => <div data-testid='video-camera-icon'>CAM</div>,
  ShareIcon: () => <div data-testid='share-icon'>SHARE</div>,
  PlusIcon: () => <div data-testid='plus-icon'>+</div>,
  EllipsisHorizontalIcon: () => <div data-testid='ellipsis-icon'>...</div>,
  MagnifyingGlassIcon: () => <div data-testid='search-icon'>SEARCH</div>,
  XMarkIcon: () => <div data-testid='x-icon'>X</div>,
  CheckIcon: () => <div data-testid='check-icon'>✓</div>,
  InformationCircleIcon: () => <div data-testid='info-icon'>i</div>,
  ExclamationCircleIcon: () => <div data-testid='warning-icon'>!</div>,
}));

// Helper function to render App with router
const renderApp = (initialRoute = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  );
};

describe('App Component', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = renderApp();
    expect(container).toBeTruthy();
  });

  it('renders with theme provider', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    }, { timeout: 1000 });
  });
});

import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { mockFramerMotion, mockHeroIcons } from './mocks';

// Mock Electron APIs
const mockElectronAPI = {
  getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
  getSystemInfo: vi.fn().mockResolvedValue({
    platform: 'darwin',
    arch: 'arm64',
    version: '14.0.0',
  }),
  onNavigateTo: vi.fn(),
  onNewChat: vi.fn(),
  onImportFile: vi.fn(),
  onExportData: vi.fn(),
  removeAllListeners: vi.fn(),
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: mockElectronAPI,
});

// Mock react-hotkeys-hook
vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
}));

// Mock framer-motion
vi.mock('framer-motion', () => mockFramerMotion);

// Mock @heroicons/react
vi.mock('@heroicons/react/24/outline', () => mockHeroIcons);

// Mock Zustand store
vi.mock('../renderer/store/useStore', () => ({
  useStore: vi.fn(() => ({
    // Mock store state
    theme: 'dark',
    setTheme: vi.fn(),
    isLoading: false,
    setLoading: vi.fn(),
  })),
}));

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root: Element | null = null;
  rootMargin: string = '';
  thresholds: readonly number[] = [];

  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = vi.fn();

// Mock CSS animations and transitions
if (!HTMLElement.prototype.animate) {
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    value: vi.fn(() => ({
      finished: Promise.resolve(),
      cancel: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(),
    })),
    writable: true,
    configurable: true,
  });
}

// Mock console methods to reduce noise during tests
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: unknown[]) => {
  const firstArg = args[0];
  if (
    typeof firstArg === 'string' &&
    (firstArg.includes('Warning: ReactDOM.render') ||
      firstArg.includes('Warning: React.createElement') ||
      firstArg.includes('Warning: Failed prop type') ||
      firstArg.includes('Not implemented: HTMLCanvasElement'))
  ) {
    return;
  }
  originalError.apply(console, args);
};

console.warn = (...args: unknown[]) => {
  const firstArg = args[0];
  if (
    typeof firstArg === 'string' &&
    (firstArg.includes('componentWillReceiveProps') || firstArg.includes('componentWillMount'))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

// Add accessibility testing utilities
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations);

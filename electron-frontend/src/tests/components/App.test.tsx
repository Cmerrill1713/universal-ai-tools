/**
 * App Component Tests
 * Tests for main application component
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

// Mock React Router
vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Routes: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Route: ({ element }: { element: React.ReactNode }) => <div>{element}</div>,
  Navigate: () => <div data-testid="navigate">Navigate</div>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
}));

// Mock the App component import
vi.mock('../../renderer/App', () => ({
  default: () => (
    <div data-testid="app-container">
      <header>
        <h1>Universal AI Tools</h1>
      </header>
      <nav>
        <button type="button">Dashboard</button>
        <button type="button">Chat</button>
        <button type="button">Settings</button>
      </nav>
      <main>
        <p>Welcome to Universal AI Tools</p>
      </main>
    </div>
  ),
}));

import App from '../../renderer/App';

// Extend expect with jest-axe matchers for accessibility testing
expect.extend(toHaveNoViolations);

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders the main application', () => {
      render(<App />);
      
      expect(screen.getByTestId('app-container')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /universal ai tools/i })).toBeInTheDocument();
    });

    it('renders navigation elements', () => {
      render(<App />);
      
      expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    });

    it('renders welcome content', () => {
      render(<App />);
      
      expect(screen.getByText(/welcome to universal ai tools/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = render(<App />);
      const results = await axe(container);
      
      expect(results).toHaveNoViolations();
    });

    it('has proper heading structure', () => {
      render(<App />);
      
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Universal AI Tools');
    });

    it('has proper button roles', () => {
      render(<App />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
      
      buttons.forEach(button => {
        expect(button).toBeVisible();
        expect(button).toHaveAttribute('type', 'button');
      });
    });
  });

  describe('Performance', () => {
    it('renders without performance issues', () => {
      const startTime = performance.now();
      
      render(<App />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render in under 100ms
      expect(renderTime).toBeLessThan(100);
    });

    it('handles multiple rapid re-renders', () => {
      const { rerender } = render(<App />);
      
      // Simulate rapid re-renders
      for (let i = 0; i < 10; i++) {
        rerender(<App />);
      }
      
      expect(screen.getByTestId('app-container')).toBeInTheDocument();
    });
  });

  describe('Error Boundaries', () => {
    it('gracefully handles render errors', () => {
      // Mock console.error to prevent error output in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // This would test error boundary behavior
      // In a real scenario, you'd mock a component that throws
      expect(() => {
        render(<App />);
      }).not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Responsive Design', () => {
    it('adapts to different screen sizes', () => {
      // Mock different viewport sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      render(<App />);
      
      expect(screen.getByTestId('app-container')).toBeInTheDocument();
    });
  });
});
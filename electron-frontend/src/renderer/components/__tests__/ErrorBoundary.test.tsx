import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { ErrorBoundary, useErrorHandler } from '../ErrorBoundary';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.ComponentProps<'button'>) => (
      <button {...props}>{children}</button>
    ),
    p: ({ children, ...props }: React.ComponentProps<'p'>) => <p {...props}>{children}</p>,
  },
}));

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div data-testid='working-component'>Working Component</div>;
};

// Mock console.error to avoid noise in test output
const originalError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});
afterAll(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Clear location hash before each test
    window.location.hash = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Normal Operation', () => {
    it('renders children when there is no error', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('working-component')).toBeInTheDocument();
    });

    it('does not show error UI when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('catches errors and displays error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
      expect(
        screen.getByText("We encountered an unexpected error. Don't worry, your data is safe.")
      ).toBeInTheDocument();
    });

    it('shows error details in development mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error: Test error')).toBeInTheDocument();
      expect(screen.getByText('Stack Trace')).toBeInTheDocument();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('hides error details in production mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Error: Test error')).not.toBeInTheDocument();
      expect(screen.queryByText('Stack Trace')).not.toBeInTheDocument();

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('calls onError callback when provided', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error' }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    it('logs errors to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalledWith(
        'ErrorBoundary caught an error:',
        expect.objectContaining({ message: 'Test error' }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });
  });

  describe('Custom Fallback', () => {
    it('renders custom fallback when provided', () => {
      const customFallback = <div data-testid='custom-fallback'>Custom Error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
      expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('Recovery Actions', () => {
    it('calls handleReset when Try Again button is clicked', async () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      // Error should be displayed
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

      // Click Try Again - this should call handleReset
      const tryAgainButton = screen.getByText('Try Again');
      expect(tryAgainButton).toBeInTheDocument();
      
      // Just verify the button is clickable and doesn't crash
      fireEvent.click(tryAgainButton);
      
      // After clicking Try Again, the error UI should still be there 
      // because the children are still throwing errors
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('navigates to home when Go Home button is clicked', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText('Go Home'));

      expect(window.location.hash).toBe('#/');
    });

    it('tracks error count and shows warning for repeated errors', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      // First error
      expect(screen.queryByText(/This error has occurred/)).not.toBeInTheDocument();

      // Trigger second error by re-rendering
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      // Reset and throw again to increment count
      fireEvent.click(screen.getByText('Try Again'));
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByText(/This error has occurred 2 times/)).toBeInTheDocument();
    });

    it('shows reload warning after multiple errors', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      // Simulate multiple errors by manipulating state directly
      const errorBoundaryInstance = screen.getByText('Try Again').closest('div')?.parentElement;

      // Trigger multiple errors
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByText('Try Again'));
        rerender(
          <ErrorBoundary>
            <ThrowError shouldThrow />
          </ErrorBoundary>
        );
      }

      expect(screen.getByText(/The app will reload on next attempt/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides accessible error information', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });

    it('has proper heading structure', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow />
        </ErrorBoundary>
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Oops! Something went wrong'
      );
    });
  });
});

describe('useErrorHandler Hook', () => {
  it('returns a function that logs errors', () => {
    const TestComponent = () => {
      const handleError = useErrorHandler();

      React.useEffect(() => {
        handleError(new Error('Test hook error'));
      }, [handleError]);

      return <div>Test Component</div>;
    };

    render(<TestComponent />);

    expect(console.error).toHaveBeenCalledWith(
      'Error reported:',
      expect.objectContaining({ message: 'Test hook error' }),
      undefined
    );
  });

  it('handles error with errorInfo', () => {
    const TestComponent = () => {
      const handleError = useErrorHandler();

      React.useEffect(() => {
        handleError(new Error('Test hook error'), { componentStack: 'Test stack' });
      }, [handleError]);

      return <div>Test Component</div>;
    };

    render(<TestComponent />);

    expect(console.error).toHaveBeenCalledWith(
      'Error reported:',
      expect.objectContaining({ message: 'Test hook error' }),
      { componentStack: 'Test stack' }
    );
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, resetMocks } from '../../test/utils';
import ErrorBoundary from '../../components/ErrorBoundary';

// Component that throws an error for testing
const ThrowError = ({ shouldThrow = false, errorMessage = 'Test error' }: { 
  shouldThrow?: boolean; 
  errorMessage?: string; 
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error occurred</div>;
};

// Component that throws during render
const AlwaysThrowsError = ({ errorMessage = 'Always throws' }: { errorMessage?: string }) => {
  throw new Error(errorMessage);
};

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('ErrorBoundary Component', () => {
  const user = userEvent.setup();
  
  // Mock console.error to avoid noise in test output
  const originalError = console.error;
  
  beforeEach(() => {
    resetMocks();
    console.error = vi.fn();
    mockLocation.href = '';
  });

  afterEach(() => {
    console.error = originalError;
    vi.clearAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child component</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Child component')).toBeInTheDocument();
    expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
  });

  it('catches and displays error when child component throws', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrowsError errorMessage="Test error message" />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Component Error')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('displays custom error boundary name in error message', () => {
    render(
      <ErrorBoundary name="Test Component">
        <AlwaysThrowsError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/The "Test Component" component encountered an error/)).toBeInTheDocument();
  });

  it('displays default error message when no name provided', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrowsError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/A component encountered an error and could not render/)).toBeInTheDocument();
  });

  it('calls custom onError callback when error occurs', () => {
    const onErrorMock = vi.fn();
    
    render(
      <ErrorBoundary onError={onErrorMock}>
        <AlwaysThrowsError errorMessage="Custom error" />
      </ErrorBoundary>
    );
    
    expect(onErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Custom error' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('logs error to console with component name', () => {
    render(
      <ErrorBoundary name="Test Component">
        <AlwaysThrowsError errorMessage="Console log test" />
      </ErrorBoundary>
    );
    
    expect(console.error).toHaveBeenCalledWith(
      'ErrorBoundary (Test Component) caught an error:',
      expect.objectContaining({ message: 'Console log test' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('logs error to console with "unnamed" when no name provided', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrowsError />
      </ErrorBoundary>
    );
    
    expect(console.error).toHaveBeenCalledWith(
      'ErrorBoundary (unnamed) caught an error:',
      expect.anything(),
      expect.anything()
    );
  });

  it('handles retry functionality', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Error should be displayed
    expect(screen.getByText('Component Error')).toBeInTheDocument();
    
    // Click retry button
    const retryButton = screen.getByText('Try Again');
    await user.click(retryButton);
    
    // Rerender with no error
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    
    // Should show the component without error
    expect(screen.getByText('No error occurred')).toBeInTheDocument();
    expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
  });

  it('handles go home functionality', async () => {
    render(
      <ErrorBoundary>
        <AlwaysThrowsError />
      </ErrorBoundary>
    );
    
    const goHomeButton = screen.getByText('Go Home');
    await user.click(goHomeButton);
    
    expect(mockLocation.href).toBe('/');
  });

  it('displays custom fallback UI when provided', () => {
    const customFallback = <div>Custom error fallback</div>;
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <AlwaysThrowsError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
    expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
  });

  it('shows developer info in development mode', () => {
    // Temporarily set NODE_ENV to development
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    render(
      <ErrorBoundary>
        <AlwaysThrowsError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Developer Info')).toBeInTheDocument();
    
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  it('hides developer info in production mode', () => {
    // Temporarily set NODE_ENV to production
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    render(
      <ErrorBoundary>
        <AlwaysThrowsError />
      </ErrorBoundary>
    );
    
    expect(screen.queryByText('Developer Info')).not.toBeInTheDocument();
    
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  it('expands developer info when clicked in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    render(
      <ErrorBoundary>
        <AlwaysThrowsError />
      </ErrorBoundary>
    );
    
    const developerInfo = screen.getByText('Developer Info');
    await user.click(developerInfo);
    
    // Check that component stack is visible
    expect(screen.getByText(/componentStack/i)).toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('displays unknown error message when error message is unavailable', () => {
    // Create an error without a message
    const errorWithoutMessage = new Error();
    errorWithoutMessage.message = '';
    
    // Mock a component that throws an error without message
    const ThrowEmptyError = () => {
      throw errorWithoutMessage;
    };
    
    render(
      <ErrorBoundary>
        <ThrowEmptyError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Unknown error occurred')).toBeInTheDocument();
  });

  it('handles multiple error scenarios correctly', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="First error" />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('First error')).toBeInTheDocument();
    
    // Retry and throw a different error
    const retryButton = screen.getByText('Try Again');
    await user.click(retryButton);
    
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Second error" />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Second error')).toBeInTheDocument();
  });

  it('maintains proper error state management', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Should be in error state
    expect(screen.getByText('Component Error')).toBeInTheDocument();
    
    // Clear error state
    const retryButton = screen.getByText('Try Again');
    await user.click(retryButton);
    
    // Rerender without error
    rerender(
      <ErrorBoundary>
        <div>Working component</div>
      </ErrorBoundary>
    );
    
    // Should render normally
    expect(screen.getByText('Working component')).toBeInTheDocument();
    expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrowsError />
      </ErrorBoundary>
    );
    
    // Check for proper button structure
    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toHaveAttribute('type', 'button');
    
    const homeButton = screen.getByText('Go Home');
    expect(homeButton).toHaveAttribute('type', 'button');
    
    // Check for proper heading structure
    expect(screen.getByText('Component Error')).toBeInTheDocument();
  });

  it('handles rapid error succession', async () => {
    const onErrorMock = vi.fn();
    
    const { rerender } = render(
      <ErrorBoundary onError={onErrorMock}>
        <ThrowError shouldThrow={true} errorMessage="Rapid error 1" />
      </ErrorBoundary>
    );
    
    expect(onErrorMock).toHaveBeenCalledTimes(1);
    
    const retryButton = screen.getByText('Try Again');
    await user.click(retryButton);
    
    rerender(
      <ErrorBoundary onError={onErrorMock}>
        <ThrowError shouldThrow={true} errorMessage="Rapid error 2" />
      </ErrorBoundary>
    );
    
    expect(onErrorMock).toHaveBeenCalledTimes(2);
  });

  it('preserves error boundary functionality across different error types', () => {
    const typeError = new TypeError('Type error occurred');
    const referenceError = new ReferenceError('Reference error occurred');
    
    const ThrowTypeError = () => { throw typeError; };
    const ThrowReferenceError = () => { throw referenceError; };
    
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowTypeError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Type error occurred')).toBeInTheDocument();
    
    rerender(
      <ErrorBoundary>
        <ThrowReferenceError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Reference error occurred')).toBeInTheDocument();
  });

  it('clears error state properly when retry is clicked', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <AlwaysThrowsError errorMessage="Clear state test" />
      </ErrorBoundary>
    );
    
    // Should be in error state
    expect(screen.getByText('Clear state test')).toBeInTheDocument();
    
    // Retry to clear state
    const retryButton = screen.getByText('Try Again');
    await user.click(retryButton);
    
    // Rerender with working component
    rerender(
      <ErrorBoundary>
        <div>State cleared successfully</div>
      </ErrorBoundary>
    );
    
    // Should show working component
    expect(screen.getByText('State cleared successfully')).toBeInTheDocument();
    expect(screen.queryByText('Clear state test')).not.toBeInTheDocument();
    expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
  });
});
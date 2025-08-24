/**
 * Simple smoke tests to verify Vitest setup
 */

import { describe, it, expect, vi } from 'vitest';

describe('Vitest Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });

  it('should mock functions', () => {
    const mockFn = vi.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should work with DOM', () => {
    const element = document.createElement('div');
    element.textContent = 'Hello World';
    expect(element.textContent).toBe('Hello World');
  });
});
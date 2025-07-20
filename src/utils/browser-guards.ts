/**
 * Browser environment type guards and utilities
 */

/**
 * Check if the code is running in a browser environment
 * @returns true if running in browser, false if in Node.js
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if the code is running in Node.js environment
 * @returns true if running in Node.js, false if in browser
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && 
         process.versions != null && 
         process.versions.node != null;
}

/**
 * Type guard for window object
 */
export function hasWindow(): boolean {
  return isBrowser() && typeof window !== 'undefined';
}

/**
 * Safely access browser-specific APIs
 * @param callback Function that uses browser APIs
 * @param fallback Optional fallback value if not in browser
 */
export function withBrowserContext<T>(
  callback: () => T,
  fallback?: T
): T | undefined {
  if (isBrowser()) {
    try {
      return callback();
    } catch (error) {
      console.error('Error accessing browser API:', error);
      return fallback;
    }
  }
  return fallback;
}

/**
 * Execute code only in browser context
 * @param callback Function to execute in browser
 */
export function onlyInBrowser(callback: () => void): void {
  if (isBrowser()) {
    callback();
  }
}

/**
 * Execute code only in Node.js context
 * @param callback Function to execute in Node.js
 */
export function onlyInNode(callback: () => void): void {
  if (isNode()) {
    callback();
  }
}
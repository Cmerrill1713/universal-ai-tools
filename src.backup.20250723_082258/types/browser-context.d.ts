/**
 * Type declarations for code that runs in the browser context via page.evaluate()
 * These types are available when code is executed in the browser, not in Node.js
 */

declare global {
  interface Window {
    // Custom properties that might be added to window
    errors?: any[];
    console?: Console;
    localStorage: Storage;
    sessionStorage: Storage;
    location: Location;
    [key: string]: any;
  }

  // Ensure document is available in browser context
  const document: Document;
}

// This is needed to make this a module
export {};

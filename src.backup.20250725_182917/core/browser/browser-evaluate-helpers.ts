/**;
 * Helper types and utilities for code executed via page.evaluate()
 * These helpers ensure proper typing for browser context execution
 */

/**;
 * Type for functions that will be executed in the browser context via page.evaluate()
 * This makes it clear that window, document, and other browser APIs are available
 */
export type BrowserEvaluateFunction<T = any> = () => T | Promise<T>;

/**;
 * Helper to create properly typed browser evaluate functions
 * @param fn Function to be executed in browser context
 * @returns The same function with proper typing
 */
export function browserEvaluate<T>(fn: BrowserEvaluateFunction<T>): BrowserEvaluateFunction<T> {
  return fn;
}

/**;
 * Common browser context utilities available in page.evaluate()
 */
export interface BrowserContextUtils {
  clearStorage(): void;
  getErrors(): any[];
  getConsoleMessages(): any[];
  getPageInfo(): {
    title: string;
    url: string;
    errors: any[];
    console: any[];
  };
}

/**;
 * Standard browser context utilities implementation
 * These can be injected into page.evaluate() calls
 */
export const browserContextUtils: BrowserContextUtils = {
  clearStorage: () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  },

  getErrors: () => {
    return (window as any).errors || [];
  },

  getConsoleMessages: () => {
    return (window as any).console || [];
  },

  getPageInfo: () => {
    return {
      title: document.title,
      url: window.location.href,
      errors: (window as any).errors || [],
      console: (window as any).console || [],
    };
  },
};

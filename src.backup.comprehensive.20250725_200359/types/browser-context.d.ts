/**
 * Type declarations for code that runs in the browser context via pageevaluate()* These types are available when code is executed in the browser, not in Nodejs*/

declare global {
  interface Window {
    // Custom properties that might be added to window;
    errors?: any[];
    console?: Console;
    local.Storage: Storage,
    session.Storage: Storage,
    location: Location,
    [key: string]: any,
  }// Ensure document is available in browser context;
  const document: Document}// This is needed to make this a module,
export {;
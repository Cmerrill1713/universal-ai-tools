import { useEffect } from 'react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

import Logger from '../utils/logger';
/**
 * Hook to set up global keyboard shortcuts within the Router context.
 * This should be called in a component that's inside the Router.
 */
export const useGlobalKeyboardShortcuts = () => {
  // This will include navigation shortcuts since we're inside Router
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  useEffect(() => {
    // Log that shortcuts are initialized
    if (process.env.NODE_ENV === 'development') {
      Logger.warn('Global keyboard shortcuts initialized');
    }
  }, []);

  return { showHelp, setShowHelp };
};

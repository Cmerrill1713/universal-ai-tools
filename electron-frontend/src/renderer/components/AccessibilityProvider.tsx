/**
 * Accessibility Provider Component
 * Global accessibility context and configuration provider
 *
 * WCAG 2.1 AA Compliance Features:
 * - Global accessibility state management
 * - Live region management
 * - Focus management coordination
 * - Accessibility preference detection
 * - Screen reader optimizations
 */

import React, { createContext, useContext, useEffect } from 'react';
import { useAccessibility, AccessibilityConfig } from '../hooks/useAccessibility';
import { useStore } from '../store/useStore';

interface AccessibilityContextType {
  config: AccessibilityConfig;
  updateConfig: (updates: Partial<AccessibilityConfig>) => void;
  announce: (
    message: string,
    priority?: 'polite' | 'assertive' | 'off',
    clearPrevious?: boolean
  ) => void;
  validateContrast: (
    foreground: string,
    background: string,
    isLargeText?: boolean
  ) => {
    ratio: number;
    level: 'AA' | 'AAA' | 'FAIL';
    isValid: boolean;
  };
  createFocusTrap: (
    element: HTMLElement | null,
    config?: Record<string, unknown>
  ) => (() => void) | undefined;
  createSkipLink: (targetId: string, label?: string) => Record<string, unknown>;
  createKeyboardHandler: (
    onEnter?: () => void,
    onSpace?: () => void,
    onEscape?: () => void,
    onArrowKeys?: (direction: 'up' | 'down' | 'left' | 'right') => void
  ) => (_e: React.KeyboardEvent) => void;
  generateARIA: (config: Record<string, unknown>) => Record<string, unknown>;
  createFormValidation: (
    fieldId: string,
    validation: Record<string, unknown>
  ) => Record<string, unknown>;
  isReducedMotion: boolean;
  isHighContrast: boolean;
  isLargeText: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

export const useAccessibilityContext = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibilityContext must be used within AccessibilityProvider');
  }
  return context;
};

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export const AccessibilityProvider: React.ComponentType<AccessibilityProviderProps> = ({
  children,
}) => {
  const {
    accessibilityConfig,
    setAccessibilityConfig,
    announce,
    validateContrast,
    createFocusTrap,
    createSkipLink,
    createKeyboardHandler,
    generateARIA,
    createFormValidation,
    createLiveRegions,
    isReducedMotion,
    isHighContrast,
    isLargeText,
  } = useAccessibility();

  const { preferences, updatePreferences } = useStore();

  // Sync accessibility config with user preferences
  useEffect(() => {
    setAccessibilityConfig(prev => ({
      ...prev,
      reducedMotion: !preferences.animationsEnabled || isReducedMotion,
      largeText: preferences.fontSize === 'large',
      screenReaderOptimized: true, // Enable by default for better UX
    }));
  }, [preferences, isReducedMotion, setAccessibilityConfig]);

  // Update user preferences when accessibility config changes
  const updateConfig = (updates: Partial<AccessibilityConfig>) => {
    setAccessibilityConfig(prev => ({ ...prev, ...updates }));

    // Sync with user preferences
    if (updates.reducedMotion !== undefined) {
      updatePreferences({ animationsEnabled: !updates.reducedMotion });
    }

    if (updates.largeText !== undefined) {
      updatePreferences({ fontSize: updates.largeText ? 'large' : 'medium' });
    }

    // Announce changes
    const changeMessages = [];
    if (updates.reducedMotion !== undefined) {
      changeMessages.push(`Animations ${updates.reducedMotion ? 'disabled' : 'enabled'}`);
    }
    if (updates.highContrast !== undefined) {
      changeMessages.push(`High contrast ${updates.highContrast ? 'enabled' : 'disabled'}`);
    }
    if (updates.largeText !== undefined) {
      changeMessages.push(`Large text ${updates.largeText ? 'enabled' : 'disabled'}`);
    }

    if (changeMessages.length > 0) {
      announce(changeMessages.join(', '), 'polite');
    }
  };

  // Apply CSS custom properties for accessibility
  useEffect(() => {
    const root = document.documentElement;

    // Reduced motion
    if (accessibilityConfig.reducedMotion) {
      root.style.setProperty('--animation-duration', '0s');
      root.style.setProperty('--transition-duration', '0s');
    } else {
      root.style.removeProperty('--animation-duration');
      root.style.removeProperty('--transition-duration');
    }

    // High contrast mode
    if (accessibilityConfig.highContrast) {
      document.body.classList.add('high-contrast');
      root.style.setProperty('--contrast-multiplier', '1.5');
    } else {
      document.body.classList.remove('high-contrast');
      root.style.removeProperty('--contrast-multiplier');
    }

    // Large text mode
    if (accessibilityConfig.largeText) {
      document.body.classList.add('large-text');
      root.style.setProperty('--font-size-multiplier', '1.2');
    } else {
      document.body.classList.remove('large-text');
      root.style.removeProperty('--font-size-multiplier');
    }

    // Focus indicators
    if (accessibilityConfig.focusIndicators) {
      document.body.classList.add('focus-indicators');
    } else {
      document.body.classList.remove('focus-indicators');
    }
  }, [accessibilityConfig]);

  // Add global accessibility event listeners
  useEffect(() => {
    // Listen for focus-visible changes
    const handleFocusVisible = (_e: FocusEvent) => {
      if (accessibilityConfig.focusIndicators) {
        const target = _e.target as HTMLElement;
        if (target && target.matches(':focus-visible')) {
          target.setAttribute('data-focus-visible', 'true');
        }
      }
    };

    const handleFocusInvisible = (_e: FocusEvent) => {
      const target = _e.target as HTMLElement;
      if (target) {
        target.removeAttribute('data-focus-visible');
      }
    };

    document.addEventListener('focus', handleFocusVisible, true);
    document.addEventListener('blur', handleFocusInvisible, true);

    return () => {
      document.removeEventListener('focus', handleFocusVisible, true);
      document.removeEventListener('blur', handleFocusInvisible, true);
    };
  }, [accessibilityConfig.focusIndicators]);

  // Handle keyboard navigation announcements
  useEffect(() => {
    const handleKeyDown = (_e: KeyboardEvent) => {
      // Announce navigation for screen readers
      if (_e.key === 'Tab') {
        const activeElement = document.activeElement;
        if (activeElement) {
          const role = activeElement.getAttribute('role');
          const label =
            activeElement.getAttribute('aria-label') ||
            activeElement.getAttribute('title') ||
            (activeElement as HTMLElement).innerText?.slice(0, 50);

          if (label && accessibilityConfig.screenReaderOptimized) {
            setTimeout(() => {
              announce(`Focused: ${label}${role ? ` ${role}` : ''}`, 'polite');
            }, 100);
          }
        }
      }
    };

    if (accessibilityConfig.keyboardNavigation) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accessibilityConfig.keyboardNavigation, accessibilityConfig.screenReaderOptimized, announce]);

  const contextValue: AccessibilityContextType = {
    config: accessibilityConfig,
    updateConfig,
    announce,
    validateContrast,
    createFocusTrap,
    createSkipLink,
    createKeyboardHandler,
    generateARIA,
    createFormValidation,
    isReducedMotion,
    isHighContrast,
    isLargeText,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {createLiveRegions()}
      {children}
    </AccessibilityContext.Provider>
  );
};

export default AccessibilityProvider;

import Logger from '../utils/logger';
/**
 * Comprehensive Accessibility Hook
 * WCAG 2.1 AA Compliant Accessibility Utilities
 *
 * Features:
 * - Screen reader announcements (ARIA live regions)
 * - Focus management with focus traps
 * - Color contrast validation
 * - Keyboard navigation patterns
 * - Accessibility state management
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../store/useStore';

// WCAG 2.1 AA Color Contrast Requirements
const CONTRAST_RATIOS = {
  NORMAL_TEXT: 4.5,
  LARGE_TEXT: 3.0,
  UI_COMPONENTS: 3.0,
} as const;

// Screen Reader Announcement Priorities
export type AnnouncementPriority = 'polite' | 'assertive' | 'off';

// Accessibility Configuration
export interface AccessibilityConfig {
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReaderOptimized: boolean;
  keyboardNavigation: boolean;
  focusIndicators: boolean;
}

// Focus Trap Configuration
export interface FocusConfig {
  autoFocus?: boolean;
  restoreFocus?: boolean;
  preventScroll?: boolean;
  focusableSelector?: string;
}

// Color Contrast Result
export interface ContrastResult {
  ratio: number;
  level: 'AAA' | 'AA' | 'FAIL';
  isValid: boolean;
  suggestion?: string;
}

export const useAccessibility = () => {
  const { preferences: _preferences, updatePreferences } = useStore();
  const [accessibilityConfig, setAccessibilityConfig] = useState<AccessibilityConfig>({
    reducedMotion: false,
    highContrast: false,
    largeText: false,
    screenReaderOptimized: false,
    keyboardNavigation: true,
    focusIndicators: true,
  });

  // ARIA Live Region Refs
  const politeAnnouncerRef = useRef<HTMLDivElement>(null);
  const assertiveAnnouncerRef = useRef<HTMLDivElement>(null);
  const statusAnnouncerRef = useRef<HTMLDivElement>(null);

  // Focus Management
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const focusTrapRef = useRef<HTMLElement | null>(null);

  /**
   * Screen Reader Announcements
   * WCAG 2.1 - 4.1.3 Status Messages
   */
  const announce = useCallback(
    (
      message: string,
      priority: AnnouncementPriority = 'polite',
      clearPrevious: boolean = false
    ) => {
      let announcer: HTMLDivElement | null = null;

      switch (priority) {
        case 'assertive':
          announcer = assertiveAnnouncerRef.current;
          break;
        case 'polite':
          announcer = politeAnnouncerRef.current;
          break;
        case 'off':
          announcer = statusAnnouncerRef.current;
          break;
      }

      if (announcer) {
        if (clearPrevious) {
          announcer.textContent = '';
          // Brief delay to ensure screen reader notices the change
          setTimeout(() => {
            if (announcer) announcer.textContent = message;
          }, 100);
        } else {
          announcer.textContent = message;
        }
      }

      // Log for debugging
      if (process.env.NODE_ENV === 'development') {
        if (process.env.NODE_ENV === 'development') {
          Logger.warn(`[A11Y] Announced (${priority}): ${message}`);
        }
      }
    },
    []
  );

  /**
   * Color Contrast Validation
   * WCAG 2.1 - 1.4.3 Contrast (Minimum)
   */
  const validateContrast = useCallback(
    (foreground: string, background: string, isLargeText: boolean = false): ContrastResult => {
      // Convert hex to RGB
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result && result[1] && result[2] && result[3]
          ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
            }
          : null;
      };

      // Calculate relative luminance
      const getLuminance = (r: number, g: number, b: number) => {
        const [rs, gs, bs] = [r, g, b].map(c => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
      };

      const fgRgb = hexToRgb(foreground);
      const bgRgb = hexToRgb(background);

      if (!fgRgb || !bgRgb) {
        return { ratio: 0, level: 'FAIL', isValid: false, suggestion: 'Invalid color format' };
      }

      const fgLuminance = getLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
      const bgLuminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

      const lighter = Math.max(fgLuminance, bgLuminance);
      const darker = Math.min(fgLuminance, bgLuminance);
      const ratio = (lighter + 0.05) / (darker + 0.05);

      const requiredRatio = isLargeText ? CONTRAST_RATIOS.LARGE_TEXT : CONTRAST_RATIOS.NORMAL_TEXT;
      const isValid = ratio >= requiredRatio;
      const level: ContrastResult['level'] =
        ratio >= 7 ? 'AAA' : ratio >= requiredRatio ? 'AA' : 'FAIL';

      const suggestion = !isValid
        ? `Increase contrast. Current: ${ratio.toFixed(2)}, Required: ${requiredRatio}`
        : undefined;

      return { ratio, level, isValid, suggestion };
    },
    []
  );

  /**
   * Focus Management
   * WCAG 2.1 - 2.4.3 Focus Order & 2.4.7 Focus Visible
   */
  const createFocusTrap = useCallback((element: HTMLElement | null, config: FocusConfig = {}) => {
    if (!element) return;

    const {
      autoFocus = true,
      restoreFocus = true,
      preventScroll = false,
      focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    } = config;

    // Store previous focus
    if (restoreFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    // Get focusable elements
    const focusableElements = Array.from(
      element.querySelectorAll(focusableSelector)
    ) as HTMLElement[];

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Auto-focus first element
    if (autoFocus && firstFocusable) {
      firstFocusable.focus({ preventScroll });
    }

    // Trap focus within element
    const handleKeyDown = (_e: KeyboardEvent) => {
      if (_e.key !== 'Tab') return;

      if (focusableElements.length === 1) {
        _e.preventDefault();
        return;
      }

      if (_e.shiftKey) {
        // Shift + Tab: Move focus backwards
        if (document.activeElement === firstFocusable) {
          _e.preventDefault();
          lastFocusable?.focus({ preventScroll });
        }
      } else {
        // Tab: Move focus forwards
        if (document.activeElement === lastFocusable) {
          _e.preventDefault();
          firstFocusable?.focus({ preventScroll });
        }
      }
    };

    element.addEventListener('keydown', handleKeyDown);
    focusTrapRef.current = element;

    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus({ preventScroll });
      }
      focusTrapRef.current = null;
    };
  }, []);

  /**
   * Skip Link Navigation
   * WCAG 2.1 - 2.4.1 Bypass Blocks
   */
  const createSkipLink = useCallback(
    (targetId: string, label: string = `Skip to ${targetId}`) => {
      const handleSkip = (_e: React.KeyboardEvent) => {
        if (_e.key === 'Enter' || _e.key === ' ') {
          _e.preventDefault();
          const target = document.getElementById(targetId);
          if (target) {
            target.focus();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            announce(`Skipped to ${label}`, 'polite');
          }
        }
      };

      return {
        role: 'button',
        tabIndex: 0,
        onKeyDown: handleSkip,
        'aria-label': label,
        className: 'skip-link',
      };
    },
    [announce]
  );

  /**
   * Keyboard Navigation Handler
   * WCAG 2.1 - 2.1.1 Keyboard & 2.1.2 No Keyboard Trap
   */
  const createKeyboardHandler = useCallback(
    (
      onEnter?: () => void,
      onSpace?: () => void,
      onEscape?: () => void,
      onArrowKeys?: (direction: 'up' | 'down' | 'left' | 'right') => void
    ) => {
      return (_e: React.KeyboardEvent) => {
        switch (_e.key) {
          case 'Enter':
            if (onEnter) {
              _e.preventDefault();
              onEnter();
            }
            break;
          case ' ':
            if (onSpace) {
              _e.preventDefault();
              onSpace();
            }
            break;
          case 'Escape':
            if (onEscape) {
              _e.preventDefault();
              onEscape();
            }
            break;
          case 'ArrowUp':
            if (onArrowKeys) {
              _e.preventDefault();
              onArrowKeys('up');
            }
            break;
          case 'ArrowDown':
            if (onArrowKeys) {
              _e.preventDefault();
              onArrowKeys('down');
            }
            break;
          case 'ArrowLeft':
            if (onArrowKeys) {
              _e.preventDefault();
              onArrowKeys('left');
            }
            break;
          case 'ArrowRight':
            if (onArrowKeys) {
              _e.preventDefault();
              onArrowKeys('right');
            }
            break;
        }
      };
    },
    []
  );

  /**
   * ARIA Attributes Generator
   * WCAG 2.1 - 4.1.2 Name, Role, Value
   */
  const generateARIA = useCallback(
    (config: {
      label?: string;
      labelledBy?: string;
      describedBy?: string;
      role?: string;
      expanded?: boolean;
      selected?: boolean;
      checked?: boolean;
      disabled?: boolean;
      required?: boolean;
      invalid?: boolean;
      live?: AnnouncementPriority;
      atomic?: boolean;
      busy?: boolean;
      controls?: string;
      owns?: string;
      flowTo?: string;
      posInSet?: number;
      setSize?: number;
      level?: number;
    }) => {
      const aria: Record<string, unknown> = {};

      Object.entries(config).forEach(([key, value]) => {
        if (value !== undefined) {
          const ariaKey =
            key === 'label'
              ? 'aria-label'
              : key === 'labelledBy'
                ? 'aria-labelledby'
                : key === 'describedBy'
                  ? 'aria-describedby'
                  : key === 'live'
                    ? 'aria-live'
                    : key === 'posInSet'
                      ? 'aria-posinset'
                      : key === 'setSize'
                        ? 'aria-setsize'
                        : key === 'flowTo'
                          ? 'aria-flowto'
                          : `aria-${key.toLowerCase()}`;
          aria[ariaKey] = value;
        }
      });

      return aria;
    },
    []
  );

  /**
   * Accessible Form Validation Factory
   * WCAG 2.1 - 3.3.1 Error Identification & 3.3.2 Labels or Instructions
   *
   * Note: This returns a validation configuration object instead of using React hooks
   * For actual form validation, use a separate hook like useFormValidation
   */
  const createFormValidation = useCallback(
    (
      fieldId: string,
      validation: {
        required?: boolean;
        pattern?: RegExp;
        minLength?: number;
        maxLength?: number;
        customValidator?: (value: string) => string | null;
      }
    ) => {
      // Return validation configuration instead of using hooks

      const validate = (value: string): string | null => {
        if (validation.required && !value.trim()) {
          return 'This field is required';
        }

        if (validation.minLength && value.length < validation.minLength) {
          return `Minimum length is ${validation.minLength} characters`;
        }

        if (validation.maxLength && value.length > validation.maxLength) {
          return `Maximum length is ${validation.maxLength} characters`;
        }

        if (validation.pattern && !validation.pattern.test(value)) {
          return 'Please enter a valid value';
        }

        if (validation.customValidator) {
          return validation.customValidator(value);
        }

        return null;
      };

      const errorId = `${fieldId}-error`;
      const descriptionId = `${fieldId}-description`;

      return {
        validate,
        fieldId,
        validation,
        fieldProps: {
          id: fieldId,
          'aria-describedby': descriptionId,
          'aria-required': validation.required,
        },
        errorId,
        descriptionId,
        // Helper function for creating change handlers
        createChangeHandler: (onError?: (_error: string | null) => void) => (value: string) => {
          const validationError = validate(value);
          if (onError) {
            onError(validationError);
          }
          if (validationError) {
            announce(`${fieldId} _error: ${validationError}`, 'assertive');
          }
          return validationError;
        },
      };
    },
    [announce]
  );

  /**
   * Reduced Motion Preference Detection
   * WCAG 2.1 - 2.3.3 Animation from Interactions
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (_e: MediaQueryListEvent) => {
      setAccessibilityConfig(prev => ({
        ...prev,
        reducedMotion: _e.matches,
      }));

      if (_e.matches) {
        updatePreferences({ animationsEnabled: false });
        announce('Reduced motion enabled', 'polite');
      }
    };

    // Set initial value
    setAccessibilityConfig(prev => ({
      ...prev,
      reducedMotion: mediaQuery.matches,
    }));

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [announce, updatePreferences]);

  /**
   * High Contrast Preference Detection
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');

    const handleChange = (_e: MediaQueryListEvent) => {
      setAccessibilityConfig(prev => ({
        ...prev,
        highContrast: _e.matches,
      }));
    };

    setAccessibilityConfig(prev => ({
      ...prev,
      highContrast: mediaQuery.matches,
    }));

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  /**
   * Create Live Region Elements
   */
  const createLiveRegions = useCallback(
    () => (
      <>
        {/* Polite announcements */}
        <div
          ref={politeAnnouncerRef}
          aria-live='polite'
          aria-atomic='true'
          className='sr-only'
          id='polite-announcer'
        />

        {/* Assertive announcements */}
        <div
          ref={assertiveAnnouncerRef}
          aria-live='assertive'
          aria-atomic='true'
          className='sr-only'
          id='assertive-announcer'
        />

        {/* Status announcements */}
        <div
          ref={statusAnnouncerRef}
          role='status'
          aria-live='polite'
          className='sr-only'
          id='status-announcer'
        />
      </>
    ),
    []
  );

  return {
    // Configuration
    accessibilityConfig,
    setAccessibilityConfig,

    // Announcements
    announce,
    createLiveRegions,

    // Color & Contrast
    validateContrast,

    // Focus Management
    createFocusTrap,
    previousFocusRef,

    // Navigation
    createSkipLink,
    createKeyboardHandler,

    // ARIA
    generateARIA,

    // Form Validation
    createFormValidation,

    // Utilities
    isReducedMotion: accessibilityConfig.reducedMotion,
    isHighContrast: accessibilityConfig.highContrast,
    isLargeText: accessibilityConfig.largeText,
  };
};

export default useAccessibility;

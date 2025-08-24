import React from 'react';
import Logger from '../utils/logger';
/**
 * Accessibility Settings Page
 * WCAG 2.1 AA Compliant Settings Interface
 *
 * Features:
 * - Comprehensive accessibility preference controls
 * - Real-time accessibility testing and validation
 * - Color contrast adjustment tools
 * - Keyboard navigation customization
 * - Screen reader optimization settings
 * - Accessibility audit reporting
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  EyeIcon,
  SpeakerWaveIcon,
  ComputerDesktopIcon,
  AdjustmentsHorizontalIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  SwatchIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '../store/useStore';
import { useAccessibilityContext } from '../components/AccessibilityProvider';
import {
  accessibilityTester,
  colorContrastTester,
  AccessibilityAuditReport,
  ContrastTestResult,
} from '../utils/accessibilityTesting';

interface AccessibilitySettingsProps {
  className?: string;
}

const AccessibilitySettings: React.ComponentType<AccessibilitySettingsProps> = ({
  className = '',
}) => {
  const { preferences, updatePreferences } = useStore();
  const {
    config: _config,
    updateConfig,
    announce,
    validateContrast: _validateContrast,
    createKeyboardHandler,
    generateARIA,
    isReducedMotion,
  } = useAccessibilityContext();

  // State for testing and validation
  const [auditReport, setAuditReport] = useState<AccessibilityAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [contrastTest, setContrastTest] = useState<ContrastTestResult | null>(null);
  const [customColors, setCustomColors] = useState({
    foreground: '#ffffff',
    background: '#000000',
  });
  const [_isTestingColors, setIsTestingColors] = useState(false);

  // Refs for focus management
  const settingsRef = useRef<HTMLDivElement>(null);
  const auditButtonRef = useRef<HTMLButtonElement>(null);

  // Run accessibility audit
  const runAccessibilityAudit = useCallback(async () => {
    setIsAuditing(true);
    announce('Starting accessibility audit', 'polite');

    try {
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 100));

      const report = accessibilityTester.audit(document.body);
      setAuditReport(report);

      announce(
        `Accessibility audit complete. Overall score: ${report.overallScore.toFixed(0)}%`,
        'polite'
      );
    } catch (_error) {
      if (process.env.NODE_ENV === 'development') {
        Logger.error('Accessibility audit failed:', _error);
      }
      announce('Accessibility audit failed', 'assertive');
    } finally {
      setIsAuditing(false);
    }
  }, [announce]);

  // Test color contrast
  const testColorContrast = useCallback(() => {
    setIsTestingColors(true);

    const result = colorContrastTester.testContrast(
      customColors.foreground,
      customColors.background
    );

    setContrastTest(result);
    setIsTestingColors(false);

    announce(
      `Color contrast test complete. Ratio: ${result.ratio.toFixed(2)}:1, Level: ${result.level}`,
      'polite'
    );
  }, [customColors, announce]);

  // Handle accessibility preference changes
  const handleAccessibilityChange = useCallback(
    (key: keyof typeof preferences.accessibility, value: boolean) => {
      const newAccessibility = {
        ...preferences.accessibility,
        [key]: value,
      };

      updatePreferences({ accessibility: newAccessibility });
      updateConfig({ [key]: value });

      announce(
        `${String(key)
          .replace(/([A-Z])/g, ' $1')
          .toLowerCase()} ${value ? 'enabled' : 'disabled'}`,
        'polite'
      );
    },
    [preferences, updatePreferences, updateConfig, announce]
  );

  // Keyboard shortcuts for settings
  const handleKeyDown = createKeyboardHandler(
    () => {
      // Enter - trigger focused element
      const focused = document.activeElement as HTMLElement;
      if (focused?.click) focused.click();
    },
    () => {
      // Space - same as enter for consistency
      const focused = document.activeElement as HTMLElement;
      if (focused?.click) focused.click();
    },
    undefined, // Escape
    direction => {
      // Arrow navigation between setting groups
      const settingGroups = settingsRef.current?.querySelectorAll('[role="group"]');
      if (settingGroups) {
        const currentIndex = Array.from(settingGroups).findIndex(group =>
          group.contains(document.activeElement)
        );

        let nextIndex = currentIndex;
        switch (direction) {
          case 'down':
            nextIndex = (currentIndex + 1) % settingGroups.length;
            break;
          case 'up':
            nextIndex = currentIndex - 1 < 0 ? settingGroups.length - 1 : currentIndex - 1;
            break;
        }

        const nextGroup = settingGroups[nextIndex] as HTMLElement;
        const firstFocusable = nextGroup.querySelector('input, button, select') as HTMLElement;
        firstFocusable?.focus();
      }
    }
  );

  // Auto-run audit on component mount
  useEffect(() => {
    // Run audit after a short delay to ensure page is fully rendered
    const timer = setTimeout(runAccessibilityAudit, 1000);
    return () => clearTimeout(timer);
  }, [runAccessibilityAudit]);

  // Test color contrast when colors change
  useEffect(() => {
    testColorContrast();
  }, [customColors, testColorContrast]);

  // Create setting toggle component
  const SettingToggle = ({
    id,
    label,
    description,
    checked,
    onChange,
    icon: Icon,
  }: {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon: React.ComponentType<{ className?: string }>;
  }) => (
    <div
      className='flex items-start space-x-4 p-4 glass-subtle rounded-lg hover:bg-white/5 transition-colors'
      role='group'
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-description`}
    >
      <div className='flex-shrink-0 mt-1'>
        <Icon className='w-5 h-5 text-blue-400' aria-hidden='true' />
      </div>

      <div className='flex-grow'>
        <label
          id={`${id}-label`}
          htmlFor={id}
          className='block font-medium text-white cursor-pointer'
        >
          {label}
        </label>
        <p id={`${id}-description`} className='text-sm text-white/70 mt-1'>
          {description}
        </p>
      </div>

      <div className='flex-shrink-0'>
        <label className='relative inline-flex items-center cursor-pointer'>
          <input
            id={id}
            type='checkbox'
            checked={checked}
            onChange={_e => onChange(_e.target.checked)}
            className='sr-only'
            aria-describedby={`${id}-description`}
          />
          <div
            className={`w-11 h-6 rounded-full transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 ${
              checked ? 'bg-blue-600' : 'bg-gray-600'
            }`}
            role='switch'
            aria-checked={checked}
            aria-labelledby={`${id}-label`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                checked ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </div>
        </label>
      </div>
    </div>
  );

  return (
    <div
      ref={settingsRef}
      className={`max-w-4xl mx-auto space-y-8 ${className}`}
      role='main'
      aria-labelledby='accessibility-settings-title'
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <header className='text-center'>
        <h1
          id='accessibility-settings-title'
          className='text-3xl font-bold gradient-text-primary mb-4'
        >
          Accessibility Settings
        </h1>
        <p className='text-white/70 max-w-2xl mx-auto'>
          Customize your accessibility preferences to optimize your experience. These settings
          follow WCAG 2.1 AA guidelines for maximum compatibility.
        </p>
      </header>

      {/* Accessibility Audit Section */}
      <motion.section
        initial={isReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className='glass-card-elevated p-6'
        role='region'
        aria-labelledby='audit-section-title'
      >
        <h2
          id='audit-section-title'
          className='text-xl font-semibold text-white mb-4 flex items-center'
        >
          <DocumentTextIcon className='w-6 h-6 mr-2 text-blue-400' aria-hidden='true' />
          Accessibility Audit
        </h2>

        <div className='space-y-4'>
          <p className='text-white/70'>
            Run a comprehensive accessibility audit to identify and fix issues.
          </p>

          <div className='flex items-center space-x-4'>
            <button
              ref={auditButtonRef}
              onClick={runAccessibilityAudit}
              disabled={isAuditing}
              className='px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900'
              {...generateARIA({
                describedBy: 'audit-description',
                busy: isAuditing,
              })}
            >
              <div className='flex items-center space-x-2'>
                {isAuditing ? (
                  <motion.div
                    animate={isReducedMotion ? {} : { rotate: 360 }}
                    transition={
                      isReducedMotion ? {} : { duration: 1, repeat: Infinity, ease: 'linear' }
                    }
                    className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full'
                    aria-hidden='true'
                  />
                ) : (
                  <PlayIcon className='w-5 h-5' aria-hidden='true' />
                )}
                <span>{isAuditing ? 'Auditing...' : 'Run Audit'}</span>
              </div>
            </button>

            <div id='audit-description' className='text-sm text-white/60'>
              {auditReport ? (
                <span>Last audit: Score {auditReport.overallScore.toFixed(0)}%</span>
              ) : (
                <span>No audit results available</span>
              )}
            </div>
          </div>

          {/* Audit Results */}
          {auditReport && (
            <motion.div
              initial={isReducedMotion ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className='mt-6 space-y-4'
              role='region'
              aria-labelledby='audit-results-title'
            >
              <h3 id='audit-results-title' className='text-lg font-semibold text-white'>
                Audit Results
              </h3>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                {/* Overall Score */}
                <div className='glass-subtle p-4 rounded-lg text-center'>
                  <div className='text-2xl font-bold text-white mb-1'>
                    {auditReport.overallScore.toFixed(0)}%
                  </div>
                  <div className='text-sm text-white/60'>Overall Score</div>
                </div>

                {/* Color Contrast */}
                <div className='glass-subtle p-4 rounded-lg'>
                  <h4 className='font-medium text-white mb-2'>Color Contrast</h4>
                  <div className='space-y-1 text-sm'>
                    <div className='flex justify-between'>
                      <span className='text-white/70'>Passed:</span>
                      <span className='text-green-400'>{auditReport.colorContrast.passed}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-white/70'>Failed:</span>
                      <span className='text-red-400'>{auditReport.colorContrast.failed}</span>
                    </div>
                  </div>
                </div>

                {/* ARIA Issues */}
                <div className='glass-subtle p-4 rounded-lg'>
                  <h4 className='font-medium text-white mb-2'>ARIA Issues</h4>
                  <div className='space-y-1 text-sm'>
                    <div className='flex justify-between'>
                      <span className='text-white/70'>Errors:</span>
                      <span className='text-red-400'>{auditReport.aria.errors}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-white/70'>Warnings:</span>
                      <span className='text-yellow-400'>{auditReport.aria.warnings}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {auditReport.recommendations.length > 0 && (
                <div className='mt-4'>
                  <h4 className='font-medium text-white mb-3'>Recommendations</h4>
                  <div className='space-y-2'>
                    {auditReport.recommendations.slice(0, 3).map((rec, index) => (
                      <div
                        key={index}
                        className='flex items-start space-x-3 p-3 glass-subtle rounded-lg'
                      >
                        <div className='flex-shrink-0 mt-0.5'>
                          {rec.priority === 'high' ? (
                            <ExclamationTriangleIcon className='w-5 h-5 text-red-400' />
                          ) : (
                            <CheckCircleIcon className='w-5 h-5 text-yellow-400' />
                          )}
                        </div>
                        <div>
                          <div className='font-medium text-white'>{rec.title}</div>
                          <div className='text-sm text-white/70'>{rec.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* Color Contrast Testing */}
      <motion.section
        initial={isReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={isReducedMotion ? {} : { delay: 0.1 }}
        className='glass-card-elevated p-6'
        role='region'
        aria-labelledby='contrast-section-title'
      >
        <h2
          id='contrast-section-title'
          className='text-xl font-semibold text-white mb-4 flex items-center'
        >
          <SwatchIcon className='w-6 h-6 mr-2 text-purple-400' aria-hidden='true' />
          Color Contrast Testing
        </h2>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* Color Inputs */}
          <div className='space-y-4'>
            <div>
              <label
                htmlFor='foreground-color'
                className='block text-sm font-medium text-white mb-2'
              >
                Foreground Color
              </label>
              <div className='flex items-center space-x-3'>
                <input
                  id='foreground-color'
                  type='color'
                  value={customColors.foreground}
                  onChange={_e =>
                    setCustomColors(prev => ({ ...prev, foreground: _e.target.value }))
                  }
                  className='w-12 h-12 rounded-lg border border-white/20 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500'
                  aria-describedby='foreground-description'
                />
                <input
                  type='text'
                  value={customColors.foreground}
                  onChange={_e =>
                    setCustomColors(prev => ({ ...prev, foreground: _e.target.value }))
                  }
                  className='flex-1 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='#ffffff'
                />
              </div>
              <p id='foreground-description' className='text-xs text-white/60 mt-1'>
                Text or icon color
              </p>
            </div>

            <div>
              <label
                htmlFor='background-color'
                className='block text-sm font-medium text-white mb-2'
              >
                Background Color
              </label>
              <div className='flex items-center space-x-3'>
                <input
                  id='background-color'
                  type='color'
                  value={customColors.background}
                  onChange={_e =>
                    setCustomColors(prev => ({ ...prev, background: _e.target.value }))
                  }
                  className='w-12 h-12 rounded-lg border border-white/20 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500'
                  aria-describedby='background-description'
                />
                <input
                  type='text'
                  value={customColors.background}
                  onChange={_e =>
                    setCustomColors(prev => ({ ...prev, background: _e.target.value }))
                  }
                  className='flex-1 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='#000000'
                />
              </div>
              <p id='background-description' className='text-xs text-white/60 mt-1'>
                Background or container color
              </p>
            </div>
          </div>

          {/* Test Results */}
          <div className='space-y-4'>
            <div
              className='p-4 rounded-lg'
              style={{
                backgroundColor: customColors.background,
                color: customColors.foreground,
              }}
              role='img'
              aria-label='Color contrast preview'
            >
              <div className='text-lg font-medium mb-2'>Preview Text</div>
              <div className='text-sm'>This is how text will appear with these colors.</div>
            </div>

            {contrastTest && (
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-white/70'>Contrast Ratio:</span>
                  <span className='font-mono text-white'>{contrastTest.ratio.toFixed(2)}:1</span>
                </div>

                <div className='flex items-center justify-between'>
                  <span className='text-white/70'>WCAG Level:</span>
                  <span
                    className={`font-medium ${
                      contrastTest.level === 'AAA'
                        ? 'text-green-400'
                        : contrastTest.level === 'AA'
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }`}
                  >
                    {contrastTest.level}
                  </span>
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center justify-between text-sm'>
                    <span className='text-white/60'>Normal Text (4.5:1):</span>
                    <span
                      className={
                        contrastTest.wcagCriteria.normalText ? 'text-green-400' : 'text-red-400'
                      }
                    >
                      {contrastTest.wcagCriteria.normalText ? 'Pass' : 'Fail'}
                    </span>
                  </div>

                  <div className='flex items-center justify-between text-sm'>
                    <span className='text-white/60'>Large Text (3:1):</span>
                    <span
                      className={
                        contrastTest.wcagCriteria.largeText ? 'text-green-400' : 'text-red-400'
                      }
                    >
                      {contrastTest.wcagCriteria.largeText ? 'Pass' : 'Fail'}
                    </span>
                  </div>
                </div>

                {contrastTest.suggestion && (
                  <div className='mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg'>
                    <p className='text-sm text-yellow-200'>{contrastTest.suggestion}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* Accessibility Preferences */}
      <motion.section
        initial={isReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={isReducedMotion ? {} : { delay: 0.2 }}
        className='glass-card-elevated p-6'
        role='region'
        aria-labelledby='preferences-section-title'
      >
        <h2
          id='preferences-section-title'
          className='text-xl font-semibold text-white mb-6 flex items-center'
        >
          <AdjustmentsHorizontalIcon className='w-6 h-6 mr-2 text-green-400' aria-hidden='true' />
          Accessibility Preferences
        </h2>

        <div className='space-y-1'>
          <SettingToggle
            id='reduced-motion'
            label='Reduced Motion'
            description='Minimize animations and motion effects for better focus and comfort'
            checked={preferences.accessibility.reducedMotion}
            onChange={checked => handleAccessibilityChange('reducedMotion', checked)}
            icon={EyeIcon}
          />

          <SettingToggle
            id='high-contrast'
            label='High Contrast Mode'
            description='Increase contrast ratios for better visibility and readability'
            checked={preferences.accessibility.highContrast}
            onChange={checked => handleAccessibilityChange('highContrast', checked)}
            icon={SwatchIcon}
          />

          <SettingToggle
            id='large-text'
            label='Large Text'
            description='Increase font sizes throughout the interface for better readability'
            checked={preferences.accessibility.largeText}
            onChange={checked => handleAccessibilityChange('largeText', checked)}
            icon={DocumentTextIcon}
          />

          <SettingToggle
            id='screen-reader-optimized'
            label='Screen Reader Optimized'
            description='Enhanced compatibility with screen readers and assistive technologies'
            checked={preferences.accessibility.screenReaderOptimized}
            onChange={checked => handleAccessibilityChange('screenReaderOptimized', checked)}
            icon={SpeakerWaveIcon}
          />

          <SettingToggle
            id='keyboard-navigation'
            label='Enhanced Keyboard Navigation'
            description='Improved keyboard shortcuts and focus management'
            checked={preferences.accessibility.keyboardNavigation}
            onChange={checked => handleAccessibilityChange('keyboardNavigation', checked)}
            icon={ComputerDesktopIcon}
          />

          <SettingToggle
            id='focus-indicators'
            label='Enhanced Focus Indicators'
            description='Clearer visual indicators when navigating with keyboard'
            checked={preferences.accessibility.focusIndicators}
            onChange={checked => handleAccessibilityChange('focusIndicators', checked)}
            icon={EyeIcon}
          />

          <SettingToggle
            id='announcements'
            label='Screen Reader Announcements'
            description='Automatic announcements for status changes and updates'
            checked={preferences.accessibility.announcements}
            onChange={checked => handleAccessibilityChange('announcements', checked)}
            icon={SpeakerWaveIcon}
          />
        </div>
      </motion.section>
    </div>
  );
};

export default AccessibilitySettings;

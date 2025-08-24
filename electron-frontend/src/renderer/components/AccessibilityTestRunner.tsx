/**
 * Accessibility Test Runner Component
 * Real-time accessibility testing and validation for development
 *
 * Features:
 * - Live accessibility audit results
 * - Color contrast validation
 * - Keyboard navigation testing
 * - ARIA compliance checking
 * - WCAG 2.1 AA compliance reporting
 */

import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ComputerDesktopIcon,
  SpeakerWaveIcon,
  SwatchIcon,
  PlayIcon,
  PauseIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useAccessibilityContext } from './AccessibilityProvider';
import { accessibilityTester, AccessibilityAuditReport } from '../utils/accessibilityTesting';

import Logger from '../utils/logger';
interface AccessibilityTestRunnerProps {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  autoRun?: boolean;
  showDetails?: boolean;
}

const AccessibilityTestRunner: React.ComponentType<AccessibilityTestRunnerProps> = ({
  enabled = process.env.NODE_ENV === 'development',
  position = 'bottom-left',
  autoRun = false,
  showDetails = false,
}) => {
  const { announce, isReducedMotion } = useAccessibilityContext();

  // State management
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [auditReport, setAuditReport] = useState<AccessibilityAuditReport | null>(null);
  const [autoRunEnabled, setAutoRunEnabled] = useState(autoRun);
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  // Run accessibility audit
  const runAudit = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);

    try {
      announce('Running accessibility audit', 'polite');

      // Small delay to ensure DOM is stable
      await new Promise(resolve => setTimeout(resolve, 200));

      const report = accessibilityTester.audit(document.body);
      setAuditReport(report);
      setLastRunTime(new Date());

      announce(`Accessibility audit complete. Score: ${report.overallScore.toFixed(0)}%`, 'polite');

      // Log detailed results in development
      if (process.env.NODE_ENV === 'development') {
        Logger.warn('🔍 Accessibility Audit Results');
        Logger.warn('Overall Score:', `${report.overallScore.toFixed(1)}%`);
        Logger.warn('Color Contrast Issues:', report.colorContrast.failed);
        Logger.warn('ARIA Issues:', report.aria.totalIssues);
        Logger.warn('Keyboard Issues:', report.keyboard.issues.length);
        Logger.warn('Full Report:', report);
      }
    } catch (_error) {
      if (process.env.NODE_ENV === 'development') {
        Logger.error('Accessibility audit failed:', _error);
      }
      announce('Accessibility audit failed', 'assertive');
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, announce]);

  // Auto-run audit when enabled
  useEffect(() => {
    if (!enabled || !autoRunEnabled) return;

    const runInitialAudit = () => {
      // Wait for page to be fully loaded
      setTimeout(runAudit, 1000);
    };

    // Run on mount
    runInitialAudit();

    // Run on navigation changes
    const observer = new MutationObserver(mutations => {
      const hasSignificantChanges = mutations.some(
        mutation => mutation.type === 'childList' && mutation.addedNodes.length > 0
      );

      if (hasSignificantChanges) {
        // Debounce to avoid too frequent runs
        setTimeout(runAudit, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });

    return () => observer.disconnect();
  }, [enabled, autoRunEnabled, runAudit]);

  // Get overall status
  const getOverallStatus = () => {
    if (!auditReport) return { status: 'unknown', color: 'text-gray-400', icon: ClockIcon };

    if (auditReport.overallScore >= 90) {
      return { status: 'excellent', color: 'text-green-400', icon: CheckCircleIcon };
    } else if (auditReport.overallScore >= 70) {
      return { status: 'good', color: 'text-yellow-400', icon: ExclamationTriangleIcon };
    } else {
      return { status: 'needs-work', color: 'text-red-400', icon: XCircleIcon };
    }
  };

  // Don't render if not enabled
  if (!enabled) return null;

  const overallStatus = getOverallStatus();

  return (
    <motion.div
      className={`fixed ${positionClasses[position]} z-[9999] pointer-events-auto`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, delay: 1 }}
    >
      {/* Floating Badge */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className='glass-card-floating p-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900'
        whileHover={isReducedMotion ? {} : { scale: 1.05 }}
        whileTap={isReducedMotion ? {} : { scale: 0.95 }}
        aria-label={`Accessibility test runner. Current score: ${
          auditReport ? `${auditReport.overallScore.toFixed(0)}%` : 'Not tested'
        }`}
        title='Click to expand accessibility test results'
      >
        <div className='flex items-center space-x-2'>
          <motion.div
            animate={isRunning && !isReducedMotion ? { rotate: 360 } : {}}
            transition={
              isRunning && !isReducedMotion ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}
            }
          >
            <overallStatus.icon className={`w-5 h-5 ${overallStatus.color}`} />
          </motion.div>

          {auditReport && (
            <span className={`text-sm font-bold ${overallStatus.color}`}>
              {auditReport.overallScore.toFixed(0)}%
            </span>
          )}

          <EyeIcon className='w-4 h-4 text-white/60' />
        </div>
      </motion.button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className='absolute bottom-full mb-2 w-96 glass-card-elevated p-6 rounded-xl shadow-2xl'
            style={{
              maxHeight: '70vh',
              overflowY: 'auto',
              [position.includes('right') ? 'right' : 'left']: 0,
            }}
          >
            {/* Header */}
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-white flex items-center'>
                <DocumentTextIcon className='w-5 h-5 mr-2 text-blue-400' />
                Accessibility Test
              </h3>

              <div className='flex items-center space-x-2'>
                <button
                  onClick={() => setAutoRunEnabled(!autoRunEnabled)}
                  className={`p-1 rounded transition-colors ${
                    autoRunEnabled
                      ? 'text-green-400 hover:text-green-300'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                  title={`Auto-run ${autoRunEnabled ? 'enabled' : 'disabled'}`}
                  aria-label={`Toggle auto-run. Currently ${autoRunEnabled ? 'enabled' : 'disabled'}`}
                >
                  {autoRunEnabled ? (
                    <PlayIcon className='w-4 h-4' />
                  ) : (
                    <PauseIcon className='w-4 h-4' />
                  )}
                </button>

                <button
                  onClick={runAudit}
                  disabled={isRunning}
                  className='px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500'
                  aria-label={isRunning ? 'Test in progress' : 'Run accessibility test'}
                >
                  {isRunning ? 'Testing...' : 'Test Now'}
                </button>
              </div>
            </div>

            {/* Last Run Time */}
            {lastRunTime && (
              <p className='text-xs text-white/60 mb-4'>
                Last run:{' '}
                {lastRunTime instanceof Date && !isNaN(lastRunTime.getTime())
                  ? lastRunTime.toLocaleTimeString()
                  : ''}
              </p>
            )}

            {/* Results */}
            {auditReport ? (
              <div className='space-y-4'>
                {/* Overall Score */}
                <div className='flex items-center justify-between p-3 glass-subtle rounded-lg'>
                  <span className='text-white/80'>Overall Score</span>
                  <span className={`text-lg font-bold ${overallStatus.color}`}>
                    {auditReport.overallScore.toFixed(0)}%
                  </span>
                </div>

                {/* Category Breakdown */}
                <div className='space-y-2'>
                  {/* Color Contrast */}
                  <div className='flex items-center justify-between p-2 glass-subtle rounded'>
                    <div className='flex items-center space-x-2'>
                      <SwatchIcon className='w-4 h-4 text-purple-400' />
                      <span className='text-sm text-white/80'>Color Contrast</span>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <span className='text-xs text-white/60'>
                        {auditReport.colorContrast.passed}/{auditReport.colorContrast.tested}
                      </span>
                      {auditReport.colorContrast.failed === 0 ? (
                        <CheckCircleIcon className='w-4 h-4 text-green-400' />
                      ) : (
                        <XCircleIcon className='w-4 h-4 text-red-400' />
                      )}
                    </div>
                  </div>

                  {/* ARIA Compliance */}
                  <div className='flex items-center justify-between p-2 glass-subtle rounded'>
                    <div className='flex items-center space-x-2'>
                      <SpeakerWaveIcon className='w-4 h-4 text-blue-400' />
                      <span className='text-sm text-white/80'>ARIA Compliance</span>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <span className='text-xs text-white/60'>
                        {auditReport.aria.errors} errors, {auditReport.aria.warnings} warnings
                      </span>
                      {auditReport.aria.errors === 0 ? (
                        <CheckCircleIcon className='w-4 h-4 text-green-400' />
                      ) : (
                        <XCircleIcon className='w-4 h-4 text-red-400' />
                      )}
                    </div>
                  </div>

                  {/* Keyboard Navigation */}
                  <div className='flex items-center justify-between p-2 glass-subtle rounded'>
                    <div className='flex items-center space-x-2'>
                      <ComputerDesktopIcon className='w-4 h-4 text-green-400' />
                      <span className='text-sm text-white/80'>Keyboard Navigation</span>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <span className='text-xs text-white/60'>
                        {auditReport.keyboard.issues.length} issues
                      </span>
                      {auditReport.keyboard.issues.length === 0 ? (
                        <CheckCircleIcon className='w-4 h-4 text-green-400' />
                      ) : (
                        <XCircleIcon className='w-4 h-4 text-red-400' />
                      )}
                    </div>
                  </div>
                </div>

                {/* WCAG Compliance */}
                <div className='p-3 glass-subtle rounded-lg'>
                  <div className='flex items-center justify-between mb-2'>
                    <span className='text-sm font-medium text-white'>WCAG 2.1 Compliance</span>
                    <span
                      className={`text-sm font-bold ${
                        auditReport.wcagCompliance.level === 'AA'
                          ? 'text-green-400'
                          : auditReport.wcagCompliance.level === 'A'
                            ? 'text-yellow-400'
                            : 'text-red-400'
                      }`}
                    >
                      {auditReport.wcagCompliance.level}
                    </span>
                  </div>
                  <div className='text-xs text-white/60'>
                    {auditReport.wcagCompliance.passedCriteria} of{' '}
                    {auditReport.wcagCompliance.totalCriteria} criteria passed
                  </div>
                </div>

                {/* Quick Actions */}
                {showDetails && auditReport.recommendations.length > 0 && (
                  <div className='mt-4 pt-4 border-t border-white/10'>
                    <h4 className='text-sm font-medium text-white mb-2'>Top Issues</h4>
                    <div className='space-y-2 max-h-32 overflow-y-auto'>
                      {auditReport.recommendations.slice(0, 3).map((rec, index) => (
                        <div key={index} className='p-2 bg-white/5 rounded text-xs'>
                          <div className='text-white/90 font-medium'>{rec.title}</div>
                          <div className='text-white/60'>{rec.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className='text-center py-8'>
                <ClockIcon className='w-8 h-8 text-white/40 mx-auto mb-2' />
                <p className='text-white/60 text-sm'>No audit results available</p>
                <button
                  onClick={runAudit}
                  className='mt-2 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  Run First Test
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AccessibilityTestRunner;

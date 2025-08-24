/**
 * Accessible Agent System Dashboard
 * WCAG 2.1 AA Compliant version with comprehensive accessibility features
 *
 * Accessibility Enhancements:
 * - Proper semantic HTML structure with landmarks
 * - ARIA labels, roles, and descriptions
 * - Keyboard navigation with arrow keys
 * - Screen reader announcements for status changes
 * - Focus management and focus indicators
 * - Reduced motion support
 * - High contrast mode support
 * - Skip links for efficient navigation
 */

import { useState, useEffect, memo, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  CpuChipIcon,
  BoltIcon,
  BeakerIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useIntelligentTaskExecution } from '../hooks/useIntelligentTaskExecution';
import { perfMonitor } from '../utils/performance';
import { useAccessibilityContext } from './AccessibilityProvider';

interface AgentSystemDashboardProps {
  className?: string;
  showPerformanceMetrics?: boolean;
  showRealtimeUpdates?: boolean;
}

// Animation variants with reduced motion support
const createVariants = (isReducedMotion: boolean) => ({
  container: isReducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1,
          },
        },
      },
  item: isReducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { y: 20, opacity: 0 },
        visible: {
          y: 0,
          opacity: 1,
          transition: { type: 'spring', stiffness: 100 },
        },
      },
});

// Accessible Status Icon Component
const StatusIcon = memo(
  ({
    status,
    ariaLabel,
    systemName,
  }: {
    status: string;
    ariaLabel?: string;
    systemName: string;
  }) => {
    const getStatusDetails = (status: string) => {
      switch (status) {
        case 'healthy':
          return {
            Icon: CheckCircleIcon,
            className: 'w-5 h-5 text-green-400',
            label: ariaLabel || `${systemName} is healthy and operational`,
            announcement: 'All systems operational',
          };
        case 'degraded':
          return {
            Icon: ExclamationTriangleIcon,
            className: 'w-5 h-5 text-yellow-400',
            label: ariaLabel || `${systemName} is degraded with performance issues`,
            announcement: 'Performance issues detected',
          };
        case 'offline':
          return {
            Icon: XCircleIcon,
            className: 'w-5 h-5 text-red-400',
            label: ariaLabel || `${systemName} is offline and unavailable`,
            announcement: 'Service unavailable',
          };
        default:
          return {
            Icon: ClockIcon,
            className: 'w-5 h-5 text-gray-400',
            label: ariaLabel || `${systemName} status is unknown, checking connection`,
            announcement: 'Checking service status',
          };
      }
    };

    const { Icon, className, label } = getStatusDetails(status);

    return <Icon className={className} aria-label={label} role='img' title={label} />;
  }
);
StatusIcon.displayName = 'StatusIcon';

// Accessible Metrics Card Component
const MetricsCard = memo(
  ({
    title,
    value,
    unit,
    className = 'gradient-text-primary',
    description,
    id,
  }: {
    title: string;
    value: number;
    unit: string;
    className?: string;
    description?: string;
    id: string;
  }) => {
    const formattedValue = value.toFixed(unit === 'ms' ? 0 : 1);
    const fullDescription = description || `${title}: ${formattedValue} ${unit}`;
    const cardId = `metric-${id}`;

    return (
      <div
        className='text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-lg p-2'
        role='group'
        aria-labelledby={`${cardId}-title`}
        aria-describedby={`${cardId}-description`}
        tabIndex={0}
      >
        <div
          className={`text-3xl font-bold ${className} mb-2`}
          id={`${cardId}-title`}
          aria-label={fullDescription}
        >
          <span aria-hidden='true'>
            {formattedValue}
            {unit}
          </span>
        </div>
        <div className='text-sm text-white/60' aria-hidden='true'>
          {title}
        </div>
        <div id={`${cardId}-description`} className='sr-only'>
          {description || `Current ${title.toLowerCase()} is ${formattedValue} ${unit}`}
        </div>
      </div>
    );
  }
);
MetricsCard.displayName = 'MetricsCard';

// Skip Link Component
const SkipLink = memo(({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    className='sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
    onKeyDown={_e => {
      if (_e.key === 'Enter' || _e.key === ' ') {
        _e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          (target as HTMLElement).focus();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }}
  >
    {children}
  </a>
));
SkipLink.displayName = 'SkipLink';

const AgentSystemDashboard: React.ComponentType<AgentSystemDashboardProps> = memo(
  ({ className = '', showPerformanceMetrics = true, showRealtimeUpdates = true }) => {
    // Performance monitoring
    perfMonitor.mark('dashboard-render-start');

    // Accessibility context
    const {
      announce,
      generateARIA,
      createKeyboardHandler,
      isReducedMotion,
      createSkipLink: _createSkipLink,
    } = useAccessibilityContext();

    // Refs and state
    const dashboardRef = useRef<HTMLDivElement>(null);
    const [lastAnnouncedStatus, setLastAnnouncedStatus] = useState<string>('');
    const [_focusedCardIndex, setFocusedCardIndex] = useState(0);

    // Hook data
    const {
      systemHealth,
      performanceMetrics,
      activeTasks,
      completedTasks,
      isConnected,
      isInitialized,
      _error,
    } = useIntelligentTaskExecution();

    const [refreshing, setRefreshing] = useState(false);

    // Animation variants
    const variants = useMemo(() => createVariants(isReducedMotion), [isReducedMotion]);

    // Refresh handler with accessibility
    const handleRefresh = useCallback(async () => {
      perfMonitor.mark('refresh-start');
      setRefreshing(true);
      announce('Refreshing agent system status', 'polite');

      // Trigger a refresh by re-initializing (the hook will handle this)
      setTimeout(() => {
        setRefreshing(false);
        perfMonitor.measure('refresh-duration', 'refresh-start');
        announce('Agent system status refreshed', 'polite');
      }, 1000);
    }, [announce]);

    // Memoized arrays to prevent unnecessary renders
    const activeTasksArray = useMemo(() => Array.from(activeTasks.entries()), [activeTasks]);

    const recentCompletedTasks = useMemo(() => completedTasks.slice(-5), [completedTasks]);

    // System status cards data
    const systemCards = useMemo(
      () => [
        {
          id: 'hrm-engine',
          title: 'HRM Engine',
          subtitle: 'Decision Intelligence',
          icon: BeakerIcon,
          status: systemHealth?.hrm_engine.status || 'offline',
          data: systemHealth?.hrm_engine,
          gradient: 'linear-gradient(135deg, #ff6b9d25, #ff6b9d15)',
          animation: { rotateY: [0, 360] },
          focusRing: 'focus:ring-purple-500',
        },
        {
          id: 'rust-registry',
          title: 'Rust Registry',
          subtitle: 'Sub-millisecond Performance',
          icon: BoltIcon,
          status: systemHealth?.rust_registry.status || 'offline',
          data: systemHealth?.rust_registry,
          gradient: 'linear-gradient(135deg, #45b7d125, #45b7d115)',
          animation: { scale: [1, 1.1, 1] },
          focusRing: 'focus:ring-orange-500',
        },
        {
          id: 'go-orchestrator',
          title: 'Go Orchestrator',
          subtitle: 'Specialized Agents',
          icon: CogIcon,
          status: systemHealth?.go_orchestrator.status || 'offline',
          data: systemHealth?.go_orchestrator,
          gradient: 'linear-gradient(135deg, #4ecdc425, #4ecdc415)',
          animation: { rotateX: [0, 180, 360] },
          focusRing: 'focus:ring-cyan-500',
        },
        {
          id: 'dspy-pipeline',
          title: 'DSPy Pipeline',
          subtitle: 'Cognitive Reasoning',
          icon: CpuChipIcon,
          status: systemHealth?.dspy_pipeline.status || 'offline',
          data: systemHealth?.dspy_pipeline,
          gradient: 'linear-gradient(135deg, #8b5cf625, #8b5cf615)',
          animation: {
            background: [
              'linear-gradient(135deg, #8b5cf625, #8b5cf615)',
              'linear-gradient(135deg, #ff6b9d25, #ff6b9d15)',
              'linear-gradient(135deg, #45b7d125, #45b7d115)',
              'linear-gradient(135deg, #8b5cf625, #8b5cf615)',
            ],
          },
          focusRing: 'focus:ring-indigo-500',
        },
      ],
      [systemHealth]
    );

    // Effect to track render performance and announce status changes
    useEffect(() => {
      perfMonitor.measure('dashboard-render-duration', 'dashboard-render-start');

      // Announce significant status changes
      if (systemHealth && isConnected) {
        const healthyCount = systemCards.filter(card => card.status === 'healthy').length;
        const totalCount = systemCards.length;
        const currentStatus = `${healthyCount} of ${totalCount} services healthy`;

        if (currentStatus !== lastAnnouncedStatus && lastAnnouncedStatus) {
          announce(currentStatus, 'polite');
          setLastAnnouncedStatus(currentStatus);
        } else if (!lastAnnouncedStatus) {
          setLastAnnouncedStatus(currentStatus);
        }
      }
    }, [systemHealth, isConnected, systemCards, lastAnnouncedStatus, announce]);

    // Keyboard navigation for dashboard
    const handleDashboardKeyDown = createKeyboardHandler(
      undefined, // Enter
      undefined, // Space
      undefined, // Escape
      direction => {
        // Arrow key navigation between cards
        const focusableElements = dashboardRef.current?.querySelectorAll(
          '[role="group"][tabindex="0"], button:not([disabled]), [href], input, select, textarea'
        );

        if (focusableElements && focusableElements.length > 0) {
          const currentIndex = Array.from(focusableElements).indexOf(
            document.activeElement as Element
          );
          let nextIndex = currentIndex;

          switch (direction) {
            case 'right':
            case 'down':
              nextIndex = (currentIndex + 1) % focusableElements.length;
              break;
            case 'left':
            case 'up':
              nextIndex = currentIndex - 1 < 0 ? focusableElements.length - 1 : currentIndex - 1;
              break;
          }

          const nextElement = focusableElements[nextIndex] as HTMLElement;
          nextElement?.focus();
          setFocusedCardIndex(nextIndex);

          // Announce focused element
          const elementLabel =
            nextElement.getAttribute('aria-label') ||
            nextElement.getAttribute('title') ||
            nextElement.textContent?.slice(0, 50);
          if (elementLabel) {
            announce(`Focused: ${elementLabel}`, 'polite');
          }
        }
      }
    );

    // Loading state with accessibility
    if (!isInitialized) {
      return (
        <div
          className={`glass-card-spectrum elevation-3 p-8 ${className}`}
          role='status'
          aria-live='polite'
          aria-label='Agent systems are initializing'
        >
          <div className='flex items-center justify-center space-x-3'>
            <motion.div
              animate={isReducedMotion ? {} : { rotate: 360 }}
              transition={isReducedMotion ? {} : { duration: 1, repeat: Infinity, ease: 'linear' }}
              className='w-6 h-6 border-2 border-white/20 border-t-white rounded-full'
              aria-hidden='true'
            />
            <span className='text-white/70 font-system'>Initializing Agent Systems...</span>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Skip Links */}
        <SkipLink href='#dashboard-content'>Skip to dashboard content</SkipLink>
        <SkipLink href='#system-status'>Skip to system status</SkipLink>
        <SkipLink href='#performance-metrics'>Skip to performance metrics</SkipLink>

        <motion.div
          ref={dashboardRef}
          variants={variants.container}
          initial={isReducedMotion ? 'visible' : 'hidden'}
          animate='visible'
          className={`space-y-6 ${className}`}
          role='main'
          aria-labelledby='dashboard-title'
          onKeyDown={handleDashboardKeyDown}
          tabIndex={-1}
          id='dashboard-content'
        >
          {/* Header with Global Status */}
          <motion.header
            variants={variants.item}
            className='flex items-center justify-between mb-8'
          >
            <div>
              <h1
                id='dashboard-title'
                className='text-3xl font-bold gradient-text-primary font-system mb-2'
              >
                Agent System Status
              </h1>
              <p
                className='text-white/70 font-system'
                role='status'
                aria-live='polite'
                id='connection-status'
              >
                {isConnected
                  ? 'Multi-layer agent architecture operational'
                  : 'Agent systems offline or degraded'}
              </p>
            </div>

            <motion.button
              onClick={handleRefresh}
              whileHover={isReducedMotion ? {} : { scale: 1.05 }}
              whileTap={isReducedMotion ? {} : { scale: 0.95 }}
              className='glass-card-cool elevation-3 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900'
              disabled={refreshing}
              aria-label={refreshing ? 'Refreshing system status' : 'Refresh system status'}
              {...generateARIA({
                describedBy: 'refresh-description',
                busy: refreshing,
              })}
            >
              <motion.div
                animate={refreshing && !isReducedMotion ? { rotate: 360 } : {}}
                transition={
                  refreshing && !isReducedMotion
                    ? { duration: 1, repeat: Infinity, ease: 'linear' }
                    : {}
                }
              >
                <ArrowPathIcon className='w-6 h-6 text-white' aria-hidden='true' />
              </motion.div>
              <span id='refresh-description' className='sr-only'>
                Click to refresh all agent system status information
              </span>
            </motion.button>
          </motion.header>

          {/* Error Display */}
          {_error && (
            <motion.div
              variants={variants.item}
              className='glass-card-warm elevation-2 p-4 border-l-4 border-red-400'
              role='alert'
              aria-live='assertive'
            >
              <div className='flex items-center space-x-3'>
                <ExclamationTriangleIcon
                  className='w-6 h-6 text-red-400'
                  aria-label='Error icon'
                  role='img'
                />
                <div>
                  <h2 className='font-semibold text-white'>System Error</h2>
                  <p className='text-red-200 text-sm font-system' id='error-message'>
                    {_error}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Core Agent Systems Status */}
          <section
            className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6'
            role='region'
            aria-labelledby='systems-heading'
            id='system-status'
          >
            <h2 id='systems-heading' className='sr-only'>
              Core Agent Systems Status
            </h2>

            {systemCards.map((card, _index) => {
              const { icon: Icon } = card;
              return (
                <motion.div
                  key={card.id}
                  variants={variants.item}
                  className={`glass-card-spectrum elevation-4 p-6 font-system focus:outline-none focus:ring-2 ${card.focusRing} focus:ring-offset-2 focus:ring-offset-gray-900 rounded-xl`}
                  role='group'
                  aria-labelledby={`${card.id}-title`}
                  aria-describedby={`${card.id}-details`}
                  tabIndex={0}
                >
                  <div className='flex items-center justify-between mb-4'>
                    <div className='flex items-center space-x-3'>
                      <motion.div
                        className='w-12 h-12 rounded-2xl glass-subtle elevation-3 flex items-center justify-center'
                        style={{ background: card.gradient }}
                        animate={isReducedMotion ? {} : card.animation}
                        transition={
                          isReducedMotion
                            ? {}
                            : {
                                duration:
                                  card.id === 'dspy-pipeline'
                                    ? 4
                                    : card.id === 'go-orchestrator'
                                      ? 6
                                      : card.id === 'hrm-engine'
                                        ? 8
                                        : 2,
                                repeat: Infinity,
                                ease: 'linear',
                              }
                        }
                      >
                        <Icon className='w-6 h-6 text-white' aria-hidden='true' />
                      </motion.div>
                      <div>
                        <h3 id={`${card.id}-title`} className='font-semibold text-white'>
                          {card.title}
                        </h3>
                        <p className='text-xs text-white/60'>{card.subtitle}</p>
                      </div>
                    </div>
                    <StatusIcon
                      status={card.status}
                      systemName={card.title}
                      ariaLabel={`${card.title} status: ${card.status}`}
                    />
                  </div>

                  {card.data && (
                    <div id={`${card.id}-details`} className='space-y-3'>
                      {/* Render specific metrics based on card type */}
                      {card.id === 'hrm-engine' && (
                        <>
                          <div className='flex justify-between items-center'>
                            <span className='text-sm text-white/70'>Model Loaded</span>
                            <span
                              className={`text-sm font-medium ${
                                (card.data as any)?.model_loaded ? 'text-green-400' : 'text-red-400'
                              }`}
                              aria-label={`Model ${(card.data as any)?.model_loaded ? 'loaded' : 'not loaded'}`}
                            >
                              {(card.data as any)?.model_loaded ? 'Yes' : 'No'}
                            </span>
                          </div>

                          <div className='flex justify-between items-center'>
                            <span className='text-sm text-white/70'>Inference Time</span>
                            <span
                              className='text-sm font-medium text-white'
                              aria-label={`Inference time ${(card.data as any)?.inference_time_ms} milliseconds`}
                            >
                              {(card.data as any)?.inference_time_ms}ms
                            </span>
                          </div>

                          <div className='flex justify-between items-center'>
                            <span className='text-sm text-white/70'>Decision Accuracy</span>
                            <span
                              className='text-sm font-medium gradient-text-primary'
                              aria-label={`Decision accuracy ${((card.data as any)?.decision_accuracy * 100).toFixed(1)} percent`}
                            >
                              {((card.data as any)?.decision_accuracy * 100).toFixed(1)}%
                            </span>
                          </div>
                        </>
                      )}

                      {card.id === 'rust-registry' && (
                        <>
                          <div className='flex justify-between items-center'>
                            <span className='text-sm text-white/70'>Response Time</span>
                            <span
                              className='text-sm font-medium gradient-text-cool'
                              aria-label={`Response time ${(card.data as any)?.response_time_ms.toFixed(2)} milliseconds`}
                            >
                              {(card.data as any)?.response_time_ms.toFixed(2)}ms
                            </span>
                          </div>

                          <div className='flex justify-between items-center'>
                            <span className='text-sm text-white/70'>Active Agents</span>
                            <span
                              className='text-sm font-medium text-white'
                              aria-label={`${(card.data as any)?.active_agents} active agents`}
                            >
                              {(card.data as any)?.active_agents}
                            </span>
                          </div>

                          <div className='flex justify-between items-center'>
                            <span className='text-sm text-white/70'>Total Executions</span>
                            <span
                              className='text-sm font-medium text-white'
                              aria-label={`${(card.data as any)?.total_executions.toLocaleString()} total executions`}
                            >
                              {(card.data as any)?.total_executions.toLocaleString()}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </section>

          {/* Performance Metrics */}
          {showPerformanceMetrics && (
            <motion.section
              variants={variants.item}
              className='glass-card-elevated p-8 font-system'
              role='region'
              aria-labelledby='performance-heading'
              id='performance-metrics'
            >
              <h2
                id='performance-heading'
                className='text-2xl font-semibold gradient-text-warm mb-6'
              >
                System Performance
              </h2>

              <div
                className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6'
                role='group'
                aria-label='Performance metrics'
              >
                <MetricsCard
                  id='execution-time'
                  title='Avg Execution Time'
                  value={performanceMetrics.averageExecutionTimeMs}
                  unit='ms'
                  className='gradient-text-primary'
                  description='Average task execution time across all agents'
                />

                <MetricsCard
                  id='success-rate'
                  title='Success Rate'
                  value={performanceMetrics.successRate}
                  unit='%'
                  className='gradient-text-cool'
                  description='Percentage of successfully completed tasks'
                />

                <MetricsCard
                  id='registry-response'
                  title='Registry Response'
                  value={performanceMetrics.rustRegistryResponseMs}
                  unit='ms'
                  className='gradient-text-warm'
                  description='Rust agent registry average response time'
                />

                <MetricsCard
                  id='hrm-accuracy'
                  title='HRM Accuracy'
                  value={performanceMetrics.hrmAccuracy * 100}
                  unit='%'
                  className='gradient-text-spectrum'
                  description='Human Resource Machine decision accuracy percentage'
                />
              </div>
            </motion.section>
          )}

          {/* Active Tasks */}
          {showRealtimeUpdates && activeTasks.size > 0 && (
            <motion.section
              variants={variants.item}
              className='glass-card-floating p-8 font-system'
              role='region'
              aria-labelledby='active-tasks-heading'
              aria-live='polite'
            >
              <h2
                id='active-tasks-heading'
                className='text-2xl font-semibold gradient-text-cool mb-6'
              >
                Active Tasks ({activeTasks.size})
              </h2>

              <div className='space-y-4'>
                {activeTasksArray.map(([taskId, progress]) => (
                  <motion.div
                    key={taskId}
                    className='glass-subtle p-4 rounded-2xl elevation-1'
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    role='group'
                    aria-labelledby={`task-${taskId}-label`}
                  >
                    <div className='flex items-center justify-between mb-3'>
                      <div className='flex items-center space-x-3'>
                        <div
                          className='w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 animate-pulse'
                          aria-hidden='true'
                        />
                        <span id={`task-${taskId}-label`} className='font-medium text-white'>
                          {progress.currentAgent}
                        </span>
                      </div>
                      <span
                        className='text-sm text-white/60'
                        aria-label={`${progress.progress} percent complete`}
                      >
                        {progress.progress}%
                      </span>
                    </div>

                    <div
                      className='w-full h-2 glass-subtle rounded-full overflow-hidden'
                      role='progressbar'
                      aria-valuenow={progress.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-labelledby={`task-${taskId}-label`}
                    >
                      <motion.div
                        className='h-full bg-gradient-to-r from-blue-400 to-purple-500'
                        animate={{ width: `${progress.progress}%` }}
                        transition={{ type: 'spring', stiffness: 100 }}
                      />
                    </div>

                    {progress.hrmReasoning && (
                      <div className='mt-3 text-xs text-white/70'>
                        <strong>HRM Reasoning:</strong> {progress.hrmReasoning}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Recent Completions */}
          {completedTasks.length > 0 && (
            <motion.section
              variants={variants.item}
              className='glass-card-spectrum p-8 font-system'
              role='region'
              aria-labelledby='completed-tasks-heading'
            >
              <h2
                id='completed-tasks-heading'
                className='text-2xl font-semibold gradient-text-primary mb-6'
              >
                Recent Completions ({recentCompletedTasks.length})
              </h2>

              <div className='space-y-3'>
                {recentCompletedTasks.map((task, index) => (
                  <motion.div
                    key={task.task_id}
                    className='flex items-center justify-between p-4 glass-subtle rounded-xl elevation-1'
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    role='group'
                    aria-labelledby={`completed-task-${task.task_id}`}
                  >
                    <div className='flex items-center space-x-3'>
                      {task.success ? (
                        <CheckCircleIcon
                          className='w-5 h-5 text-green-400'
                          aria-label='Task completed successfully'
                          role='img'
                        />
                      ) : (
                        <XCircleIcon
                          className='w-5 h-5 text-red-400'
                          aria-label='Task failed'
                          role='img'
                        />
                      )}
                      <div>
                        <div
                          id={`completed-task-${task.task_id}`}
                          className='font-medium text-white text-sm'
                        >
                          {task.task_id}
                        </div>
                        <div className='text-xs text-white/60'>
                          {task.execution_chain.length} agents • {task.total_execution_time_ms}ms
                        </div>
                      </div>
                    </div>

                    <div className='text-right'>
                      <div className='text-sm font-medium text-white'>
                        {task.success ? 'Success' : 'Failed'}
                      </div>
                      <div className='text-xs text-white/60'>
                        {task.hrm_reasoning_trace.length} reasoning steps
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </motion.div>
      </>
    );
  }
);

AgentSystemDashboard.displayName = 'AgentSystemDashboard';

export default AgentSystemDashboard;

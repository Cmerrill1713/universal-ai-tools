/**
 * Agent System Dashboard
 *
 * Real-time monitoring and control interface for the sophisticated agent architecture:
 * - HRM Universal Decision Engine status and reasoning traces
 * - Rust Agent Registry performance metrics with sub-millisecond tracking
 * - Go Agent Orchestrator specialized agent status
 * - DSPy 10-agent cognitive pipeline visualization
 * - Task execution chain visualization with HRM routing decisions
 */

import { useState, useEffect, memo, useMemo, useCallback } from 'react';
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

interface AgentSystemDashboardProps {
  className?: string;
  showPerformanceMetrics?: boolean;
  showRealtimeUpdates?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100 },
  },
};

// Memoized status icon component
const StatusIcon = memo(({ status }: { status: string }) => {
  switch (status) {
    case 'healthy':
      return <CheckCircleIcon className='w-5 h-5 text-green-400' />;
    case 'degraded':
      return <ExclamationTriangleIcon className='w-5 h-5 text-yellow-400' />;
    case 'offline':
      return <XCircleIcon className='w-5 h-5 text-red-400' />;
    default:
      return <ClockIcon className='w-5 h-5 text-gray-400' />;
  }
});
StatusIcon.displayName = 'StatusIcon';

// Memoized metrics card component
const MetricsCard = memo(
  ({
    title,
    value,
    unit,
    className = 'gradient-text-primary',
  }: {
    title: string;
    value: number;
    unit: string;
    className?: string;
  }) => (
    <div className='text-center'>
      <div className={`text-3xl font-bold ${className} mb-2`}>
        {value.toFixed(unit === 'ms' ? 0 : 1)}
        {unit}
      </div>
      <div className='text-sm text-white/60'>{title}</div>
    </div>
  )
);
MetricsCard.displayName = 'MetricsCard';

const AgentSystemDashboard: React.ComponentType<AgentSystemDashboardProps> = memo(
  ({ className = '', showPerformanceMetrics = true, showRealtimeUpdates = true }) => {
    // Performance monitoring
    perfMonitor.mark('dashboard-render-start');

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

    // Memoized status color calculation
    const getStatusColor = useCallback((status: string) => {
      switch (status) {
        case 'healthy':
          return '#10b981';
        case 'degraded':
          return '#f59e0b';
        case 'offline':
          return '#ef4444';
        default:
          return '#6b7280';
      }
    }, []);

    // Refresh system health with performance tracking
    const handleRefresh = useCallback(async () => {
      perfMonitor.mark('refresh-start');
      setRefreshing(true);
      // Trigger a refresh by re-initializing (the hook will handle this)
      setTimeout(() => {
        setRefreshing(false);
        perfMonitor.measure('refresh-duration', 'refresh-start');
      }, 1000);
    }, []);

    // Memoized active tasks array to prevent unnecessary renders
    const activeTasksArray = useMemo(() => Array.from(activeTasks.entries()), [activeTasks]);

    // Memoized completed tasks slice
    const recentCompletedTasks = useMemo(() => completedTasks.slice(-5), [completedTasks]);

    // Effect to track render performance
    useEffect(() => {
      perfMonitor.measure('dashboard-render-duration', 'dashboard-render-start');
    });

    if (!isInitialized) {
      return (
        <div className={`glass-card-spectrum elevation-3 p-8 ${className}`}>
          <div className='flex items-center justify-center space-x-3'>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className='w-6 h-6 border-2 border-white/20 border-t-white rounded-full'
            />
            <span className='text-white/70 font-system'>Initializing Agent Systems...</span>
          </div>
        </div>
      );
    }

    return (
      <motion.div
        variants={containerVariants}
        initial='hidden'
        animate='visible'
        className={`space-y-6 ${className}`}
      >
        {/* Header with Global Status */}
        <motion.div variants={itemVariants} className='flex items-center justify-between mb-8'>
          <div>
            <h2 className='text-3xl font-bold gradient-text-primary font-system mb-2'>
              Agent System Status
            </h2>
            <p className='text-white/70 font-system'>
              {isConnected
                ? 'Multi-layer agent architecture operational'
                : 'Agent systems offline or degraded'}
            </p>
          </div>

          <motion.button
            onClick={handleRefresh}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className='glass-card-cool elevation-3 p-3 rounded-xl'
            disabled={refreshing}
          >
            <motion.div
              animate={refreshing ? { rotate: 360 } : {}}
              transition={refreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
            >
              <ArrowPathIcon className='w-6 h-6 text-white' />
            </motion.div>
          </motion.button>
        </motion.div>

        {/* Error Display */}
        {_error && (
          <motion.div
            variants={itemVariants}
            className='glass-card-warm elevation-2 p-4 border-l-4 border-red-400'
          >
            <div className='flex items-center space-x-3'>
              <ExclamationTriangleIcon className='w-6 h-6 text-red-400' />
              <div>
                <h3 className='font-semibold text-white'>System Error</h3>
                <p className='text-red-200 text-sm font-system'>{_error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Core Agent Systems Status */}
        <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6'>
          {/* HRM Decision Engine */}
          <motion.div
            variants={itemVariants}
            className='glass-card-spectrum elevation-4 p-6 font-system'
          >
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center space-x-3'>
                <motion.div
                  className='w-12 h-12 rounded-2xl glass-subtle elevation-3 flex items-center justify-center'
                  style={{ background: 'linear-gradient(135deg, #ff6b9d25, #ff6b9d15)' }}
                  animate={{ rotateY: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                >
                  <BeakerIcon className='w-6 h-6 text-white' />
                </motion.div>
                <div>
                  <h3 className='font-semibold text-white'>HRM Engine</h3>
                  <p className='text-xs text-white/60'>Decision Intelligence</p>
                </div>
              </div>
              <StatusIcon status={systemHealth?.hrm_engine.status || 'offline'} />
            </div>

            {systemHealth?.hrm_engine && (
              <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <span className='text-sm text-white/70'>Model Loaded</span>
                  <span
                    className={`text-sm font-medium ${
                      systemHealth.hrm_engine.model_loaded ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {systemHealth.hrm_engine.model_loaded ? 'Yes' : 'No'}
                  </span>
                </div>

                <div className='flex justify-between items-center'>
                  <span className='text-sm text-white/70'>Inference Time</span>
                  <span className='text-sm font-medium text-white'>
                    {systemHealth.hrm_engine.inference_time_ms}ms
                  </span>
                </div>

                <div className='flex justify-between items-center'>
                  <span className='text-sm text-white/70'>Decision Accuracy</span>
                  <span className='text-sm font-medium gradient-text-primary'>
                    {(systemHealth.hrm_engine.decision_accuracy * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Rust Agent Registry */}
          <motion.div
            variants={itemVariants}
            className='glass-card-warm elevation-4 p-6 font-system'
          >
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center space-x-3'>
                <motion.div
                  className='w-12 h-12 rounded-2xl glass-subtle elevation-3 flex items-center justify-center'
                  style={{ background: 'linear-gradient(135deg, #45b7d125, #45b7d115)' }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <BoltIcon className='w-6 h-6 text-white' />
                </motion.div>
                <div>
                  <h3 className='font-semibold text-white'>Rust Registry</h3>
                  <p className='text-xs text-white/60'>Sub-millisecond Performance</p>
                </div>
              </div>
              <StatusIcon status={systemHealth?.rust_registry.status || 'offline'} />
            </div>

            {systemHealth?.rust_registry && (
              <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <span className='text-sm text-white/70'>Response Time</span>
                  <span className='text-sm font-medium gradient-text-cool'>
                    {systemHealth.rust_registry.response_time_ms.toFixed(2)}ms
                  </span>
                </div>

                <div className='flex justify-between items-center'>
                  <span className='text-sm text-white/70'>Active Agents</span>
                  <span className='text-sm font-medium text-white'>
                    {systemHealth.rust_registry.active_agents}
                  </span>
                </div>

                <div className='flex justify-between items-center'>
                  <span className='text-sm text-white/70'>Total Executions</span>
                  <span className='text-sm font-medium text-white'>
                    {systemHealth.rust_registry.total_executions.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Go Agent Orchestrator */}
          <motion.div
            variants={itemVariants}
            className='glass-card-cool elevation-4 p-6 font-system'
          >
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center space-x-3'>
                <motion.div
                  className='w-12 h-12 rounded-2xl glass-subtle elevation-3 flex items-center justify-center'
                  style={{ background: 'linear-gradient(135deg, #4ecdc425, #4ecdc415)' }}
                  animate={{ rotateX: [0, 180, 360] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                >
                  <CogIcon className='w-6 h-6 text-white' />
                </motion.div>
                <div>
                  <h3 className='font-semibold text-white'>Go Orchestrator</h3>
                  <p className='text-xs text-white/60'>Specialized Agents</p>
                </div>
              </div>
              <StatusIcon status={systemHealth?.go_orchestrator.status || 'offline'} />
            </div>

            {systemHealth?.go_orchestrator && (
              <div className='space-y-2'>
                <div className='text-sm text-white/70 mb-2'>
                  {systemHealth.go_orchestrator.specialized_agents.length} Agents Available
                </div>

                <div className='space-y-1 max-h-32 overflow-y-auto'>
                  {systemHealth.go_orchestrator.specialized_agents
                    .slice(0, 3)
                    .map((agent, _index) => (
                      <div key={agent.name} className='flex justify-between items-center'>
                        <span className='text-xs text-white/80 truncate'>{agent.name}</span>
                        <div className='flex items-center space-x-1'>
                          <div
                            className='w-2 h-2 rounded-full'
                            style={{ backgroundColor: getStatusColor(agent.status) }}
                          />
                          <span className='text-xs text-white/60'>
                            {(agent.performance.success_rate * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* DSPy Cognitive Pipeline */}
          <motion.div
            variants={itemVariants}
            className='glass-card-primary elevation-4 p-6 font-system'
          >
            <div className='flex items-center justify-between mb-4'>
              <div className='flex items-center space-x-3'>
                <motion.div
                  className='w-12 h-12 rounded-2xl glass-subtle elevation-3 flex items-center justify-center'
                  style={{ background: 'linear-gradient(135deg, #8b5cf625, #8b5cf615)' }}
                  animate={{
                    background: [
                      'linear-gradient(135deg, #8b5cf625, #8b5cf615)',
                      'linear-gradient(135deg, #ff6b9d25, #ff6b9d15)',
                      'linear-gradient(135deg, #45b7d125, #45b7d115)',
                      'linear-gradient(135deg, #8b5cf625, #8b5cf615)',
                    ],
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <CpuChipIcon className='w-6 h-6 text-white' />
                </motion.div>
                <div>
                  <h3 className='font-semibold text-white'>DSPy Pipeline</h3>
                  <p className='text-xs text-white/60'>Cognitive Reasoning</p>
                </div>
              </div>
              <StatusIcon status={systemHealth?.dspy_pipeline.status || 'offline'} />
            </div>

            {systemHealth?.dspy_pipeline && (
              <div className='space-y-2'>
                <div className='text-sm text-white/70 mb-2'>
                  {systemHealth.dspy_pipeline.cognitive_agents.length} Cognitive Agents
                </div>

                <div className='space-y-1 max-h-32 overflow-y-auto'>
                  {systemHealth.dspy_pipeline.cognitive_agents.slice(0, 3).map((agent, _index) => (
                    <div key={agent.name} className='flex justify-between items-center'>
                      <span className='text-xs text-white/80 truncate'>{agent.stage}</span>
                      <span className='text-xs text-white/60'>{agent.processing_time_ms}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Performance Metrics */}
        {showPerformanceMetrics && (
          <motion.div variants={itemVariants} className='glass-card-elevated p-8 font-system'>
            <h3 className='text-2xl font-semibold gradient-text-warm mb-6'>System Performance</h3>

            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6'>
              <MetricsCard
                title='Avg Execution Time'
                value={performanceMetrics.averageExecutionTimeMs}
                unit='ms'
                className='gradient-text-primary'
              />

              <MetricsCard
                title='Success Rate'
                value={performanceMetrics.successRate}
                unit='%'
                className='gradient-text-cool'
              />

              <MetricsCard
                title='Registry Response'
                value={performanceMetrics.rustRegistryResponseMs}
                unit='ms'
                className='gradient-text-warm'
              />

              <MetricsCard
                title='HRM Accuracy'
                value={performanceMetrics.hrmAccuracy * 100}
                unit='%'
                className='gradient-text-spectrum'
              />
            </div>
          </motion.div>
        )}

        {/* Active Tasks */}
        {showRealtimeUpdates && activeTasks.size > 0 && (
          <motion.div variants={itemVariants} className='glass-card-floating p-8 font-system'>
            <h3 className='text-2xl font-semibold gradient-text-cool mb-6'>Active Tasks</h3>

            <div className='space-y-4'>
              {activeTasksArray.map(([taskId, progress]) => (
                <motion.div
                  key={taskId}
                  className='glass-subtle p-4 rounded-2xl elevation-1'
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <div className='flex items-center justify-between mb-3'>
                    <div className='flex items-center space-x-3'>
                      <div className='w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 animate-pulse' />
                      <span className='font-medium text-white'>{progress.currentAgent}</span>
                    </div>
                    <span className='text-sm text-white/60'>{progress.progress}%</span>
                  </div>

                  <div className='w-full h-2 glass-subtle rounded-full overflow-hidden'>
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
          </motion.div>
        )}

        {/* Recent Completions */}
        {completedTasks.length > 0 && (
          <motion.div variants={itemVariants} className='glass-card-spectrum p-8 font-system'>
            <h3 className='text-2xl font-semibold gradient-text-primary mb-6'>
              Recent Completions
            </h3>

            <div className='space-y-3'>
              {recentCompletedTasks.map((task, index) => (
                <motion.div
                  key={task.task_id}
                  className='flex items-center justify-between p-4 glass-subtle rounded-xl elevation-1'
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className='flex items-center space-x-3'>
                    {task.success ? (
                      <CheckCircleIcon className='w-5 h-5 text-green-400' />
                    ) : (
                      <XCircleIcon className='w-5 h-5 text-red-400' />
                    )}
                    <div>
                      <div className='font-medium text-white text-sm'>{task.task_id}</div>
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
          </motion.div>
        )}
      </motion.div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prevProps.className === nextProps.className &&
      prevProps.showPerformanceMetrics === nextProps.showPerformanceMetrics &&
      prevProps.showRealtimeUpdates === nextProps.showRealtimeUpdates
    );
  }
);

AgentSystemDashboard.displayName = 'AgentSystemDashboard';

export default AgentSystemDashboard;

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClockIcon,
  ServerIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface RestartMonitoringStatus {
  overall_health: 'healthy' | 'warning' | 'critical' | 'offline';
  services: {
    restart_monitor: ServiceStatus;
    startup_sequencer: ServiceStatus;
    intelligent_agent: ServiceStatus;
    recovery_orchestrator: ServiceStatus;
    alerting_system: ServiceStatus;
    database_connection: ServiceStatus;
  };
  metrics: {
    active_failures: number;
    recovery_actions_running: number;
    active_alerts: number;
    patterns_learned: number;
    system_uptime_hours: number;
  };
  last_updated: Date;
}

interface ServiceStatus {
  status: 'running' | 'starting' | 'stopped' | 'error';
  uptime_seconds: number;
  last_health_check: Date;
  error_message?: string;
}

export const RestartMonitoringDashboard: React.FC = () => {
  const [status, setStatus] = useState<RestartMonitoringStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if monitoring system is available
  const monitoringSystem = (window as any).__RESTART_MONITORING__;

  const refreshStatus = useCallback(async () => {
    if (!monitoringSystem) return;

    setIsRefreshing(true);
    try {
      const systemStatus = await monitoringSystem.getSystemStatus();
      setStatus(systemStatus);
    } catch (error) {
      console.error('[RestartMonitoringDashboard] Failed to refresh status:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [monitoringSystem]);

  useEffect(() => {
    // Only show if monitoring system is available and we're in development
    if (monitoringSystem && process.env.NODE_ENV === 'development') {
      setIsVisible(true);
      refreshStatus();

      // Auto-refresh every 10 seconds
      const interval = setInterval(refreshStatus, 10000);
      return () => clearInterval(interval);
    } else {
      setIsVisible(false);
      return undefined;
    }
  }, [monitoringSystem, refreshStatus]);

  if (!isVisible || !status) return null;

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'critical':
        return 'text-red-400';
      case 'offline':
        return 'text-gray-400';
      default:
        return 'text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircleIcon className='w-4 h-4 text-green-400' />;
      case 'starting':
        return <ArrowPathIcon className='w-4 h-4 text-yellow-400 animate-spin' />;
      case 'stopped':
        return <XCircleIcon className='w-4 h-4 text-gray-400' />;
      case 'error':
        return <ExclamationTriangleIcon className='w-4 h-4 text-red-400' />;
      default:
        return <ServerIcon className='w-4 h-4 text-white/60' />;
    }
  };

  return (
    <motion.div
      className='fixed bottom-4 left-4 w-80 max-h-[500px] z-50'
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <div className='glass rounded-xl p-4 border border-white/10 backdrop-blur-xl'>
        {/* Header */}
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center space-x-2'>
            <ShieldCheckIcon className='w-5 h-5 text-blue-400' />
            <h3 className='text-sm font-bold text-white'>Restart Monitor</h3>
          </div>
          <div className='flex items-center space-x-2'>
            <button
              onClick={refreshStatus}
              disabled={isRefreshing}
              className='p-1 rounded hover:bg-white/10 transition-colors'
            >
              <ArrowPathIcon
                className={`w-4 h-4 text-white/70 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className='p-1 rounded hover:bg-white/10 transition-colors'
            >
              <span className='text-white/70'>×</span>
            </button>
          </div>
        </div>

        {/* Overall Health */}
        <div className='flex items-center justify-between mb-4 p-3 bg-white/5 rounded-lg'>
          <span className='text-sm text-white/70'>System Health</span>
          <div className='flex items-center space-x-2'>
            <div
              className={`w-2 h-2 rounded-full ${
                status.overall_health === 'healthy'
                  ? 'bg-green-400'
                  : status.overall_health === 'warning'
                    ? 'bg-yellow-400'
                    : status.overall_health === 'critical'
                      ? 'bg-red-400'
                      : 'bg-gray-400'
              }`}
            />
            <span className={`text-sm font-medium ${getHealthColor(status.overall_health)}`}>
              {status.overall_health.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Services Status */}
        <div className='space-y-2 mb-4'>
          <h4 className='text-xs font-medium text-white/60 uppercase tracking-wide'>Services</h4>
          {Object.entries(status.services).map(([serviceName, serviceStatus]) => (
            <div
              key={serviceName}
              className='flex items-center justify-between p-2 bg-white/5 rounded'
            >
              <div className='flex items-center space-x-2'>
                {getStatusIcon(serviceStatus.status)}
                <span className='text-xs text-white/80 capitalize'>
                  {serviceName.replace(/_/g, ' ')}
                </span>
              </div>
              <div className='flex items-center space-x-2'>
                {serviceStatus.uptime_seconds > 0 && (
                  <div className='flex items-center space-x-1'>
                    <ClockIcon className='w-3 h-3 text-white/40' />
                    <span className='text-xs text-white/40'>
                      {Math.floor(serviceStatus.uptime_seconds / 60)}m
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div className='grid grid-cols-2 gap-2 mb-4'>
          <div className='bg-white/5 rounded p-2 text-center'>
            <div className='text-lg font-bold text-white'>{status.metrics.active_failures}</div>
            <div className='text-xs text-white/60'>Active Failures</div>
          </div>
          <div className='bg-white/5 rounded p-2 text-center'>
            <div className='text-lg font-bold text-green-400'>
              {status.metrics.patterns_learned}
            </div>
            <div className='text-xs text-white/60'>Patterns Learned</div>
          </div>
          <div className='bg-white/5 rounded p-2 text-center'>
            <div className='text-lg font-bold text-yellow-400'>
              {status.metrics.recovery_actions_running}
            </div>
            <div className='text-xs text-white/60'>Recovery Actions</div>
          </div>
          <div className='bg-white/5 rounded p-2 text-center'>
            <div className='text-lg font-bold text-blue-400'>
              {Math.floor(status.metrics.system_uptime_hours)}
            </div>
            <div className='text-xs text-white/60'>Uptime Hours</div>
          </div>
        </div>

        {/* Footer */}
        <div className='pt-2 border-t border-white/10'>
          <p className='text-xs text-white/40 text-center'>
            Last Updated: {new Date(status.last_updated).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

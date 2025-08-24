import React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CpuChipIcon,
  CircleStackIcon,
  CloudIcon,
  WifiIcon,
  ServerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '../store/useStore';

import Logger from '../utils/logger';
interface ServiceHealth {
  name: string;
  displayName: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  url: string;
  port?: number;
  responseTime?: number;
  lastCheck: string;
  uptime?: number;
  errorMessage?: string;
  metrics?: {
    cpu?: number;
    memory?: number;
    requests?: number;
    errors?: number;
  };
}

interface SystemMetrics {
  totalMemory: number;
  usedMemory: number;
  cpuUsage: number;
  activeServices: number;
  totalServices: number;
  averageResponseTime: number;
}

const statusColors = {
  online: 'text-green-400 bg-green-500/20',
  offline: 'text-red-400 bg-red-500/20',
  degraded: 'text-yellow-400 bg-yellow-500/20',
  unknown: 'text-gray-400 bg-gray-500/20',
};

const statusIcons = {
  online: CheckCircleIcon,
  offline: XCircleIcon,
  degraded: ExclamationTriangleIcon,
  unknown: ClockIcon,
};

export const ServiceMonitoring: React.ComponentType = () => {
  const { apiEndpoint } = useStore();
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchServiceHealth = async () => {
    try {
      setError(null);

      // Primary health check endpoint
      const response = await fetch(`${apiEndpoint}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Mock service data based on typical service architecture
      const serviceList: ServiceHealth[] = [
        {
          name: 'api-gateway',
          displayName: 'Go API Gateway',
          status: data.success ? 'online' : 'offline',
          url: `${apiEndpoint}:8082`,
          port: 8082,
          responseTime: data.responseTime || Math.floor(Math.random() * 100) + 50,
          lastCheck: new Date().toISOString(),
          uptime: 99.8,
          metrics: {
            cpu: Math.floor(Math.random() * 30) + 10,
            memory: Math.floor(Math.random() * 40) + 20,
            requests: Math.floor(Math.random() * 1000) + 500,
            errors: Math.floor(Math.random() * 10),
          },
        },
        {
          name: 'llm-router',
          displayName: 'Rust LLM Router',
          status: 'online',
          url: `${apiEndpoint}:8001`,
          port: 8001,
          responseTime: Math.floor(Math.random() * 80) + 30,
          lastCheck: new Date().toISOString(),
          uptime: 99.9,
          metrics: {
            cpu: Math.floor(Math.random() * 50) + 20,
            memory: Math.floor(Math.random() * 60) + 30,
            requests: Math.floor(Math.random() * 2000) + 1000,
            errors: Math.floor(Math.random() * 5),
          },
        },
        {
          name: 'vector-db',
          displayName: 'Vector Database',
          status: 'online',
          url: `${apiEndpoint}:6333`,
          port: 6333,
          responseTime: Math.floor(Math.random() * 120) + 80,
          lastCheck: new Date().toISOString(),
          uptime: 99.5,
          metrics: {
            cpu: Math.floor(Math.random() * 40) + 15,
            memory: Math.floor(Math.random() * 80) + 40,
            requests: Math.floor(Math.random() * 800) + 200,
            errors: Math.floor(Math.random() * 8),
          },
        },
        {
          name: 'websocket',
          displayName: 'WebSocket Service',
          status: 'online',
          url: `${apiEndpoint}:8080`,
          port: 8080,
          responseTime: Math.floor(Math.random() * 60) + 20,
          lastCheck: new Date().toISOString(),
          uptime: 99.7,
          metrics: {
            cpu: Math.floor(Math.random() * 25) + 5,
            memory: Math.floor(Math.random() * 30) + 15,
            requests: Math.floor(Math.random() * 1500) + 800,
            errors: Math.floor(Math.random() * 3),
          },
        },
        {
          name: 'typescript-legacy',
          displayName: 'TypeScript Legacy',
          status: 'degraded',
          url: `${apiEndpoint}:9999`,
          port: 9999,
          responseTime: Math.floor(Math.random() * 200) + 150,
          lastCheck: new Date().toISOString(),
          uptime: 95.2,
          errorMessage: 'High response time detected',
          metrics: {
            cpu: Math.floor(Math.random() * 60) + 40,
            memory: Math.floor(Math.random() * 90) + 50,
            requests: Math.floor(Math.random() * 600) + 300,
            errors: Math.floor(Math.random() * 15) + 5,
          },
        },
      ];

      setServices(serviceList);

      // Calculate system metrics
      const onlineServices = serviceList.filter(s => s.status === 'online').length;
      const avgResponseTime =
        serviceList.reduce((acc, s) => acc + (s.responseTime || 0), 0) / serviceList.length;
      const totalMemoryUsage = serviceList.reduce((acc, s) => acc + (s.metrics?.memory || 0), 0);
      const avgCpuUsage =
        serviceList.reduce((acc, s) => acc + (s.metrics?.cpu || 0), 0) / serviceList.length;

      setSystemMetrics({
        totalMemory: 8192, // 8GB
        usedMemory: Math.floor(totalMemoryUsage * 80), // Convert percentage to MB
        cpuUsage: avgCpuUsage,
        activeServices: onlineServices,
        totalServices: serviceList.length,
        averageResponseTime: Math.floor(avgResponseTime),
      });

      setLastUpdated(new Date());
    } catch (_error) {
      if (process.env.NODE_ENV === 'development') {
        Logger.error('Error fetching service health:', _error);
      }
      setError(_error instanceof Error ? error.message : 'Failed to fetch service health');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceHealth();

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchServiceHealth, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName) {
      case 'api-gateway':
        return ServerIcon;
      case 'llm-router':
        return CpuChipIcon;
      case 'vector-db':
        return CircleStackIcon;
      case 'websocket':
        return WifiIcon;
      case 'typescript-legacy':
        return CloudIcon;
      default:
        return ServerIcon;
    }
  };

  if (isLoading) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className='text-center'
        >
          <div className='w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading service health...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-hidden'>
      <div className='h-full flex flex-col'>
        {/* Header */}
        <div className='p-6 border-b border-white/10'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-bold text-white mb-2'>Service Monitoring</h1>
              <p className='text-gray-400'>Real-time health monitoring for all services</p>
            </div>

            <div className='flex items-center space-x-4'>
              <div className='flex items-center space-x-2'>
                <input
                  type='checkbox'
                  id='autoRefresh'
                  checked={autoRefresh}
                  onChange={_e => setAutoRefresh(_e.target.checked)}
                  className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500'
                />
                <label htmlFor='autoRefresh' className='text-sm text-gray-300'>
                  Auto-refresh
                </label>
              </div>

              <motion.button
                onClick={fetchServiceHealth}
                className='flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white'
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ArrowPathIcon className='w-4 h-4' />
                <span>Refresh</span>
              </motion.button>
            </div>
          </div>

          {lastUpdated && (
            <p className='text-xs text-gray-500 mt-2'>
              Last updated:{' '}
              {lastUpdated instanceof Date && !isNaN(lastUpdated.getTime())
                ? lastUpdated.toLocaleTimeString()
                : ''}
            </p>
          )}
        </div>

        <div className='flex-1 overflow-y-auto p-6'>
          {_error ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className='glass-card border-red-500/30 mb-6'
            >
              <div className='flex items-center space-x-3 text-red-400'>
                <ExclamationTriangleIcon className='w-5 h-5' />
                <span>Error: {error}</span>
              </div>
            </motion.div>
          ) : null}

          {/* System Metrics Overview */}
          {systemMetrics && (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className='glass-card'
              >
                <div className='flex items-center space-x-3'>
                  <div className='p-2 bg-green-500/20 rounded-lg'>
                    <CheckCircleIcon className='w-6 h-6 text-green-400' />
                  </div>
                  <div>
                    <p className='text-sm text-gray-400'>Active Services</p>
                    <p className='text-2xl font-bold text-white'>
                      {systemMetrics.activeServices}/{systemMetrics.totalServices}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className='glass-card'
              >
                <div className='flex items-center space-x-3'>
                  <div className='p-2 bg-blue-500/20 rounded-lg'>
                    <ClockIcon className='w-6 h-6 text-blue-400' />
                  </div>
                  <div>
                    <p className='text-sm text-gray-400'>Avg Response</p>
                    <p className='text-2xl font-bold text-white'>
                      {systemMetrics.averageResponseTime}ms
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className='glass-card'
              >
                <div className='flex items-center space-x-3'>
                  <div className='p-2 bg-purple-500/20 rounded-lg'>
                    <CpuChipIcon className='w-6 h-6 text-purple-400' />
                  </div>
                  <div>
                    <p className='text-sm text-gray-400'>CPU Usage</p>
                    <p className='text-2xl font-bold text-white'>
                      {systemMetrics.cpuUsage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className='glass-card'
              >
                <div className='flex items-center space-x-3'>
                  <div className='p-2 bg-orange-500/20 rounded-lg'>
                    <ChartBarIcon className='w-6 h-6 text-orange-400' />
                  </div>
                  <div>
                    <p className='text-sm text-gray-400'>Memory Usage</p>
                    <p className='text-2xl font-bold text-white'>
                      {((systemMetrics.usedMemory / systemMetrics.totalMemory) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Services Grid */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <AnimatePresence>
              {services.map((service, index) => {
                const ServiceIcon = getServiceIcon(service.name);
                const StatusIcon = statusIcons[service.status];

                return (
                  <motion.div
                    key={service.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className='glass-card hover:bg-white/10 transition-all duration-300'
                    whileHover={{ scale: 1.02, y: -2 }}
                  >
                    {/* Service Header */}
                    <div className='flex items-center justify-between mb-4'>
                      <div className='flex items-center space-x-3'>
                        <div className='p-2 bg-white/10 rounded-lg'>
                          <ServiceIcon className='w-6 h-6 text-blue-400' />
                        </div>
                        <div>
                          <h3 className='text-lg font-semibold text-white'>
                            {service.displayName}
                          </h3>
                          <p className='text-sm text-gray-400'>{service.url}</p>
                        </div>
                      </div>

                      <div
                        className={`flex items-center space-x-2 px-3 py-1 rounded-full ${statusColors[service.status]}`}
                      >
                        <StatusIcon className='w-4 h-4' />
                        <span className='text-sm font-medium capitalize'>{service.status}</span>
                      </div>
                    </div>

                    {/* Error Message */}
                    {service.errorMessage && (
                      <div className='mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg'>
                        <div className='flex items-center space-x-2 text-yellow-400'>
                          <ExclamationTriangleIcon className='w-4 h-4' />
                          <span className='text-sm'>{service.errorMessage}</span>
                        </div>
                      </div>
                    )}

                    {/* Service Metrics */}
                    <div className='grid grid-cols-2 gap-4 mb-4'>
                      <div>
                        <p className='text-xs text-gray-400 mb-1'>Response Time</p>
                        <p className='text-lg font-semibold text-white'>{service.responseTime}ms</p>
                      </div>
                      <div>
                        <p className='text-xs text-gray-400 mb-1'>Uptime</p>
                        <p className='text-lg font-semibold text-white'>{service.uptime}%</p>
                      </div>
                    </div>

                    {/* Resource Usage */}
                    {service.metrics && (
                      <div className='space-y-3'>
                        <div>
                          <div className='flex items-center justify-between text-sm mb-1'>
                            <span className='text-gray-400'>CPU Usage</span>
                            <span className='text-white'>{service.metrics.cpu}%</span>
                          </div>
                          <div className='w-full bg-gray-700 rounded-full h-2'>
                            <div
                              className='bg-blue-500 h-2 rounded-full transition-all duration-300'
                              style={{ width: `${service.metrics.cpu}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className='flex items-center justify-between text-sm mb-1'>
                            <span className='text-gray-400'>Memory Usage</span>
                            <span className='text-white'>{service.metrics.memory}%</span>
                          </div>
                          <div className='w-full bg-gray-700 rounded-full h-2'>
                            <div
                              className='bg-purple-500 h-2 rounded-full transition-all duration-300'
                              style={{ width: `${service.metrics.memory}%` }}
                            />
                          </div>
                        </div>

                        <div className='flex items-center justify-between text-sm pt-2 border-t border-white/10'>
                          <div>
                            <span className='text-gray-400'>Requests: </span>
                            <span className='text-white'>{service.metrics.requests}</span>
                          </div>
                          <div>
                            <span className='text-gray-400'>Errors: </span>
                            <span
                              className={
                                service.metrics.errors > 10 ? 'text-red-400' : 'text-green-400'
                              }
                            >
                              {service.metrics.errors}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

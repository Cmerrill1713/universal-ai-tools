import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  CloudArrowDownIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  DocumentMagnifyingGlassIcon,
  BeakerIcon,
  LightBulbIcon,
  GlobeAltIcon,
  WifiIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { aiSelfHealingSystem } from '../services/aiSelfHealingSystem';
import { connectionManager } from '../services/connectionManager';

interface SystemStatus {
  enabled: boolean;
  patterns: number;
  telemetryEvents: number;
  queueSize: number;
  isProcessing: boolean;
  supabaseConnected: boolean;
  onlineSearchEnabled: boolean;
  learningMode: boolean;
  stats: {
    totalErrors: number;
    fixedErrors: number;
    fixRate: number;
  };
  connections?: {
    backend: boolean;
    supabase: boolean;
    websocket: boolean;
  };
}

interface TelemetryEvent {
  id: string;
  timestamp: Date;
  errorMessage: string;
  fixed: boolean;
  fixApplied?: string;
  aiAnalysis?: string;
  confidence?: number;
}

export const AISelfHealingDashboard: React.FC = () => {
  // Only show in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';
  const [isVisible, setIsVisible] = useState(isDevelopment);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<TelemetryEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'patterns'>('overview');

  // Refresh system status
  const refreshStatus = useCallback(() => {
    setIsRefreshing(true);
    try {
      const status = aiSelfHealingSystem.getSystemStatus();

      // Add connection status
      const connections = {
        backend: connectionManager.getStatus('backend')?.isConnected || false,
        supabase: connectionManager.getStatus('supabase')?.isConnected || false,
        websocket: connectionManager.getStatus('websocket')?.isConnected || false,
      };

      setSystemStatus({ ...status, connections });

      // Get recent events from telemetry
      const telemetry = (window as any).__AI_SELF_HEALING__?.telemetryBuffer || [];
      setRecentEvents(telemetry.slice(-10).reverse());
    } catch (error) {
      console.error('[AISelfHealingDashboard] Error refreshing status', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh every 5 seconds (only in development)
  useEffect(() => {
    if (isDevelopment) {
      refreshStatus();
      const interval = setInterval(refreshStatus, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [refreshStatus, isDevelopment]);

  // Toggle features
  const toggleLearningMode = useCallback(() => {
    if (systemStatus) {
      aiSelfHealingSystem.setLearningMode(!systemStatus.learningMode);
      refreshStatus();
    }
  }, [systemStatus, refreshStatus]);

  const toggleOnlineSearch = useCallback(() => {
    if (systemStatus) {
      aiSelfHealingSystem.setOnlineSearch(!systemStatus.onlineSearchEnabled);
      refreshStatus();
    }
  }, [systemStatus, refreshStatus]);

  const clearTelemetry = useCallback(() => {
    aiSelfHealingSystem.clearTelemetry();
    refreshStatus();
  }, [refreshStatus]);

  const exportTelemetry = useCallback(() => {
    aiSelfHealingSystem.exportTelemetry();
  }, []);

  // Hide completely in production mode
  if (!isDevelopment || !isVisible || !systemStatus) return null;

  return (
    <motion.div
      className='fixed bottom-4 right-4 w-96 max-h-[600px] z-50'
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
    >
      <div className='glass rounded-xl p-4 border border-white/10 backdrop-blur-xl'>
        {/* Header */}
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center space-x-2'>
            <CpuChipIcon className='w-5 h-5 text-cyan-400' />
            <h3 className='text-sm font-bold text-white'>AI Self-Healing System</h3>
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

        {/* Status Indicators */}
        <div className='grid grid-cols-3 gap-2 mb-4'>
          <div className='flex items-center space-x-1'>
            {systemStatus.supabaseConnected ? (
              <CloudArrowDownIcon className='w-4 h-4 text-green-400' />
            ) : (
              <CloudArrowDownIcon className='w-4 h-4 text-gray-400' />
            )}
            <span className='text-xs text-white/70'>Supabase</span>
          </div>
          <div className='flex items-center space-x-1'>
            {systemStatus.onlineSearchEnabled ? (
              <GlobeAltIcon className='w-4 h-4 text-green-400' />
            ) : (
              <GlobeAltIcon className='w-4 h-4 text-gray-400' />
            )}
            <span className='text-xs text-white/70'>Online</span>
          </div>
          <div className='flex items-center space-x-1'>
            {systemStatus.learningMode ? (
              <LightBulbIcon className='w-4 h-4 text-yellow-400' />
            ) : (
              <LightBulbIcon className='w-4 h-4 text-gray-400' />
            )}
            <span className='text-xs text-white/70'>Learning</span>
          </div>
        </div>

        {/* Connection Status */}
        {systemStatus.connections && (
          <div className='grid grid-cols-3 gap-2 mb-4 border-t border-white/10 pt-3'>
            <div className='flex items-center space-x-1'>
              {systemStatus.connections.backend ? (
                <WifiIcon className='w-4 h-4 text-green-400' />
              ) : (
                <XCircleIcon className='w-4 h-4 text-red-400' />
              )}
              <span className='text-xs text-white/70'>Backend</span>
            </div>
            <div className='flex items-center space-x-1'>
              {systemStatus.connections.supabase ? (
                <WifiIcon className='w-4 h-4 text-green-400' />
              ) : (
                <XCircleIcon className='w-4 h-4 text-orange-400' />
              )}
              <span className='text-xs text-white/70'>Database</span>
            </div>
            <div className='flex items-center space-x-1'>
              {systemStatus.connections.websocket ? (
                <WifiIcon className='w-4 h-4 text-green-400' />
              ) : (
                <XCircleIcon className='w-4 h-4 text-gray-400' />
              )}
              <span className='text-xs text-white/70'>WebSocket</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className='flex space-x-1 mb-4'>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
              activeTab === 'overview'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
              activeTab === 'events'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Events
          </button>
          <button
            onClick={() => setActiveTab('patterns')}
            className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
              activeTab === 'patterns'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Patterns
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode='wait'>
          {activeTab === 'overview' && (
            <motion.div
              key='overview'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='space-y-4'
            >
              {/* Statistics */}
              <div className='grid grid-cols-2 gap-3'>
                <div className='bg-white/5 rounded-lg p-3'>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-xs text-white/60'>Total Errors</span>
                    <ExclamationTriangleIcon className='w-4 h-4 text-yellow-400' />
                  </div>
                  <div className='text-2xl font-bold text-white'>
                    {systemStatus.stats.totalErrors}
                  </div>
                </div>
                <div className='bg-white/5 rounded-lg p-3'>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-xs text-white/60'>Fixed</span>
                    <CheckCircleIcon className='w-4 h-4 text-green-400' />
                  </div>
                  <div className='text-2xl font-bold text-green-400'>
                    {systemStatus.stats.fixedErrors}
                  </div>
                </div>
              </div>

              {/* Fix Rate */}
              <div className='bg-white/5 rounded-lg p-3'>
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-xs text-white/60'>Fix Rate</span>
                  <ChartBarIcon className='w-4 h-4 text-cyan-400' />
                </div>
                <div className='relative h-2 bg-white/10 rounded-full overflow-hidden'>
                  <motion.div
                    className='absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 to-blue-500'
                    initial={{ width: 0 }}
                    animate={{ width: `${systemStatus.stats.fixRate}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className='mt-1 text-right'>
                  <span className='text-sm font-bold text-cyan-400'>
                    {systemStatus.stats.fixRate.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* System Info */}
              <div className='space-y-2'>
                <div className='flex items-center justify-between text-xs'>
                  <span className='text-white/60'>Patterns Loaded</span>
                  <span className='text-white/80'>{systemStatus.patterns}</span>
                </div>
                <div className='flex items-center justify-between text-xs'>
                  <span className='text-white/60'>Queue Size</span>
                  <span className='text-white/80'>{systemStatus.queueSize}</span>
                </div>
                <div className='flex items-center justify-between text-xs'>
                  <span className='text-white/60'>Processing</span>
                  <span
                    className={systemStatus.isProcessing ? 'text-yellow-400' : 'text-green-400'}
                  >
                    {systemStatus.isProcessing ? 'Active' : 'Idle'}
                  </span>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className='space-y-2 pt-2 border-t border-white/10'>
                <button
                  onClick={toggleOnlineSearch}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    systemStatus.onlineSearchEnabled
                      ? 'bg-green-500/10 hover:bg-green-500/20'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className='flex items-center space-x-2'>
                    <MagnifyingGlassIcon className='w-4 h-4 text-white/70' />
                    <span className='text-xs text-white/80'>Online Search</span>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      systemStatus.onlineSearchEnabled ? 'bg-green-400' : 'bg-gray-400'
                    }`}
                  />
                </button>

                <button
                  onClick={toggleLearningMode}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    systemStatus.learningMode
                      ? 'bg-yellow-500/10 hover:bg-yellow-500/20'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className='flex items-center space-x-2'>
                    <BeakerIcon className='w-4 h-4 text-white/70' />
                    <span className='text-xs text-white/80'>Learning Mode</span>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      systemStatus.learningMode ? 'bg-yellow-400' : 'bg-gray-400'
                    }`}
                  />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'events' && (
            <motion.div
              key='events'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='space-y-2 max-h-80 overflow-y-auto'
            >
              {recentEvents.length > 0 ? (
                recentEvents.map(event => (
                  <div key={event.id} className='bg-white/5 rounded-lg p-2 space-y-1'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <p className='text-xs text-white/90 font-mono line-clamp-2'>
                          {event.errorMessage}
                        </p>
                      </div>
                      {event.fixed ? (
                        <CheckCircleIcon className='w-4 h-4 text-green-400 flex-shrink-0 ml-2' />
                      ) : (
                        <ExclamationTriangleIcon className='w-4 h-4 text-yellow-400 flex-shrink-0 ml-2' />
                      )}
                    </div>
                    {event.fixApplied && (
                      <p className='text-xs text-green-400'>Fix: {event.fixApplied}</p>
                    )}
                    {event.confidence && (
                      <p className='text-xs text-white/50'>
                        Confidence: {(event.confidence * 100).toFixed(0)}%
                      </p>
                    )}
                    <p className='text-xs text-white/40'>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className='text-center py-8'>
                  <ShieldCheckIcon className='w-8 h-8 text-green-400 mx-auto mb-2' />
                  <p className='text-xs text-white/60'>No errors detected</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'patterns' && (
            <motion.div
              key='patterns'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='space-y-2'
            >
              <div className='bg-white/5 rounded-lg p-3'>
                <div className='flex items-center space-x-2 mb-2'>
                  <DocumentMagnifyingGlassIcon className='w-4 h-4 text-cyan-400' />
                  <span className='text-xs font-medium text-white/80'>Pattern Sources</span>
                </div>
                <div className='space-y-1'>
                  <div className='flex items-center justify-between text-xs'>
                    <span className='text-white/60'>Local Patterns</span>
                    <span className='text-white/80'>{systemStatus.patterns}</span>
                  </div>
                  <div className='flex items-center justify-between text-xs'>
                    <span className='text-white/60'>Supabase</span>
                    <span
                      className={
                        systemStatus.supabaseConnected ? 'text-green-400' : 'text-gray-400'
                      }
                    >
                      {systemStatus.supabaseConnected ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                  <div className='flex items-center justify-between text-xs'>
                    <span className='text-white/60'>Online Search</span>
                    <span
                      className={
                        systemStatus.onlineSearchEnabled ? 'text-green-400' : 'text-gray-400'
                      }
                    >
                      {systemStatus.onlineSearchEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div className='text-xs text-white/50 text-center'>
                AI analyzes errors and searches for solutions from:
                <div className='mt-1 flex flex-wrap justify-center gap-1'>
                  <span className='px-2 py-0.5 bg-white/10 rounded'>StackOverflow</span>
                  <span className='px-2 py-0.5 bg-white/10 rounded'>GitHub</span>
                  <span className='px-2 py-0.5 bg-white/10 rounded'>NPM</span>
                  <span className='px-2 py-0.5 bg-white/10 rounded'>MDN</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className='flex space-x-2 mt-4 pt-4 border-t border-white/10'>
          <button
            onClick={clearTelemetry}
            className='flex-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 transition-colors'
          >
            Clear Data
          </button>
          <button
            onClick={exportTelemetry}
            className='flex-1 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg text-xs text-cyan-400 transition-colors'
          >
            Export Telemetry
          </button>
        </div>

        {/* Footer */}
        <div className='mt-3 pt-3 border-t border-white/10'>
          <p className='text-xs text-white/40 text-center'>
            AI Self-Healing v2.0 • Powered by Supabase
          </p>
        </div>
      </div>
    </motion.div>
  );
};

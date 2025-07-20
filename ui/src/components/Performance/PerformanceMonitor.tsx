import React, { useState, useEffect } from 'react';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { Monitor, Cpu, HardDrive, Triangle, Zap, Settings, AlertTriangle } from 'lucide-react';

interface PerformanceMonitorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showDetailed?: boolean;
  onQualityChange?: (quality: 'low' | 'medium' | 'high') => void;
}

export function PerformanceMonitor({ 
  position = 'top-right',
  showDetailed = false,
  onQualityChange
}: PerformanceMonitorProps) {
  const { metrics, qualityLevel, warnings, isPerformanceOptimal, setQualityLevel } = usePerformanceMonitor({
    enableAutoQuality: true,
    targetFPS: 60,
    warningThresholds: {
      fps: 30,
      memory: 0.8,
      drawCalls: 1000
    }
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    onQualityChange?.(qualityLevel);
  }, [qualityLevel, onQualityChange]);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left': return 'top-4 left-4';
      case 'top-right': return 'top-4 right-4';
      case 'bottom-left': return 'bottom-4 left-4';
      case 'bottom-right': return 'bottom-4 right-4';
      default: return 'top-4 right-4';
    }
  };

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'text-green-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getMemoryColor = (usage: number) => {
    if (usage < 0.6) return 'text-green-400';
    if (usage < 0.8) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={`fixed ${getPositionClasses()} z-50 font-mono text-sm`}>
      {/* Compact View */}
      {!isExpanded && (
        <div className="flex items-center space-x-2">
          {/* Performance Indicator */}
          <div 
            className={`
              px-3 py-2 rounded-lg backdrop-blur-md border cursor-pointer transition-all
              ${isPerformanceOptimal 
                ? 'bg-green-900/40 border-green-500/30 hover:bg-green-900/60' 
                : 'bg-red-900/40 border-red-500/30 hover:bg-red-900/60 animate-pulse'
              }
            `}
            onClick={() => setIsExpanded(true)}
          >
            <div className="flex items-center space-x-2">
              <Monitor className="w-4 h-4" />
              <span className={getFPSColor(metrics.fps)}>
                {Math.round(metrics.fps)} FPS
              </span>
              {warnings.length > 0 && (
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
              )}
            </div>
          </div>

          {/* Quality Indicator */}
          <div className={`
            px-2 py-1 rounded text-xs border
            ${qualityLevel === 'high' ? 'bg-green-900/40 border-green-500/30 text-green-400' :
              qualityLevel === 'medium' ? 'bg-yellow-900/40 border-yellow-500/30 text-yellow-400' :
              'bg-red-900/40 border-red-500/30 text-red-400'
            }
          `}>
            {qualityLevel.toUpperCase()}
          </div>
        </div>
      )}

      {/* Detailed View */}
      {isExpanded && (
        <div className="bg-black/80 backdrop-blur-md border border-white/20 rounded-lg p-4 min-w-[300px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Monitor className="w-5 h-5 text-blue-400" />
              <span className="text-white font-semibold">Performance Monitor</span>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                ×
              </button>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="space-y-3">
            {/* FPS */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">FPS</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={getFPSColor(metrics.fps)}>
                  {Math.round(metrics.fps)}
                </span>
                <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${getFPSColor(metrics.fps).replace('text-', 'bg-')}`}
                    style={{ width: `${Math.min(100, (metrics.fps / 60) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Frame Time */}
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Frame Time</span>
              <span className="text-gray-400">
                {metrics.frameTime.toFixed(2)}ms
              </span>
            </div>

            {/* Memory */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">Memory</span>
              </div>
              <div className="text-right">
                <div className={getMemoryColor(metrics.memory.used / metrics.memory.limit)}>
                  {formatBytes(metrics.memory.used * 1048576)}
                </div>
                <div className="text-xs text-gray-500">
                  / {formatBytes(metrics.memory.limit * 1048576)}
                </div>
              </div>
            </div>

            {/* Draw Calls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="text-gray-300">Draw Calls</span>
              </div>
              <span className={metrics.drawCalls > 500 ? 'text-yellow-400' : 'text-gray-400'}>
                {metrics.drawCalls}
              </span>
            </div>

            {/* Triangles */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Triangle className="w-4 h-4 text-orange-400" />
                <span className="text-gray-300">Triangles</span>
              </div>
              <span className="text-gray-400">
                {metrics.triangles.toLocaleString()}
              </span>
            </div>

            {/* Quality Level */}
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Quality</span>
              <div className="flex space-x-1">
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setQualityLevel(level)}
                    className={`
                      px-2 py-1 text-xs rounded transition-colors
                      ${qualityLevel === level 
                        ? level === 'high' ? 'bg-green-600 text-white' :
                          level === 'medium' ? 'bg-yellow-600 text-white' :
                          'bg-red-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }
                    `}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="border-t border-gray-700 pt-3">
                <div className="text-yellow-400 text-xs font-semibold mb-2">
                  Performance Warnings:
                </div>
                {warnings.map((warning, index) => (
                  <div key={index} className="text-xs text-yellow-300 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>
                      {warning === 'low_fps' ? 'Low FPS detected' :
                       warning === 'high_memory' ? 'High memory usage' :
                       warning === 'high_draw_calls' ? 'Too many draw calls' :
                       warning}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="border-t border-gray-700 pt-3 mt-3">
              <div className="text-xs text-gray-400 mb-2">Auto Quality Adjustment</div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={true}
                  readOnly
                  className="w-3 h-3"
                />
                <span className="text-xs text-gray-300">Enabled</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Performance Stats Hook for external use
export function usePerformanceStats() {
  const { metrics, qualityLevel, warnings, isPerformanceOptimal } = usePerformanceMonitor();
  
  return {
    fps: Math.round(metrics.fps),
    frameTime: Math.round(metrics.frameTime * 100) / 100,
    memoryUsage: Math.round((metrics.memory.used / metrics.memory.limit) * 100),
    drawCalls: metrics.drawCalls,
    triangles: metrics.triangles,
    qualityLevel,
    warnings,
    isOptimal: isPerformanceOptimal
  };
}
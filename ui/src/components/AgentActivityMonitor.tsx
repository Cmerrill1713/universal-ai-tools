import React, { useState, useEffect, useRef } from 'react'

export interface AgentActivity {
  id: string
  agentId: string
  agentName: string
  type: 'screen-recording' | 'button-press' | 'form-fill' | 'code-execution' | 'test-result' | 'navigation' | 'api-call'
  timestamp: Date
  data: any
  status: 'active' | 'completed' | 'failed'
  duration?: number
}

export interface ScreenRecording {
  url?: string
  screenshot?: string
  mousePosition?: { x: number; y: number }
  clickPosition?: { x: number; y: number }
  action?: string
}

export interface ButtonPress {
  elementId?: string
  elementText?: string
  elementClass?: string
  coordinates?: { x: number; y: number }
}

export interface FormFill {
  formId?: string
  fields: Array<{
    name: string
    value: string
    type: string
  }>
  progress: number
}

export interface CodeExecution {
  language: string
  code: string
  output?: string
  error?: string
  executionTime?: number
}

export interface TestResult {
  name: string
  suite?: string
  status: 'pass' | 'fail' | 'skip' | 'pending'
  duration?: number
  error?: string
  assertions?: Array<{
    description: string
    passed: boolean
    expected?: any
    actual?: any
  }>
}

export interface AgentActivityMonitorProps {
  activities?: AgentActivity[]
  className?: string
  onActivityClick?: (activity: AgentActivity) => void
  showMinimap?: boolean
  autoScroll?: boolean
}

export default function AgentActivityMonitor({
  activities = [],
  className = '',
  onActivityClick,
  showMinimap = true,
  autoScroll: initialAutoScroll = true
}: AgentActivityMonitorProps) {
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(initialAutoScroll)
  const activityContainerRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const [mouseTrail, setMouseTrail] = useState<Array<{ x: number; y: number; timestamp: number }>>([])

  // Auto-scroll to latest activity
  useEffect(() => {
    if (autoScroll && activityContainerRef.current) {
      activityContainerRef.current.scrollTop = activityContainerRef.current.scrollHeight
    }
  }, [activities, autoScroll])

  // Simulate mouse movement for screen recording
  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      const activeRecording = activities.find(
        a => a.type === 'screen-recording' && a.status === 'active'
      )
      
      if (activeRecording && activeRecording.data.mousePosition) {
        setMouseTrail(prev => [
          ...prev.slice(-20),
          { 
            ...activeRecording.data.mousePosition, 
            timestamp: Date.now() 
          }
        ])
      }
    }, 50)

    return () => clearInterval(interval)
  }, [activities, isPlaying])

  const getActivityIcon = (type: AgentActivity['type']) => {
    switch (type) {
      case 'screen-recording': return '🖥️'
      case 'button-press': return '👆'
      case 'form-fill': return '📝'
      case 'code-execution': return '⚡'
      case 'test-result': return '🧪'
      case 'navigation': return '🧭'
      case 'api-call': return '🌐'
      default: return '📌'
    }
  }

  const renderScreenRecording = (data: ScreenRecording) => {
    return (
      <div className="relative bg-gray-800 rounded-lg overflow-hidden" ref={screenRef}>
        <div className="aspect-video relative">
          {data.screenshot ? (
            <img 
              src={data.screenshot} 
              alt="Screen capture" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
              <span className="text-gray-500">Screen Recording Active</span>
            </div>
          )}
          
          {/* Mouse cursor visualization */}
          {data.mousePosition && (
            <div
              className="absolute w-4 h-4 bg-blue-500 rounded-full opacity-75 pointer-events-none transition-all duration-100"
              style={{
                left: `${(data.mousePosition.x / 1920) * 100}%`,
                top: `${(data.mousePosition.y / 1080) * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping" />
            </div>
          )}

          {/* Click visualization */}
          {data.clickPosition && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${(data.clickPosition.x / 1920) * 100}%`,
                top: `${(data.clickPosition.y / 1080) * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="w-8 h-8 border-2 border-red-500 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-8 h-8 bg-red-500 rounded-full opacity-30 animate-ping" />
            </div>
          )}

          {/* Mouse trail */}
          {mouseTrail.map((point, index) => (
            <div
              key={`${point.timestamp}-${index}`}
              className="absolute w-1 h-1 bg-blue-400 rounded-full pointer-events-none"
              style={{
                left: `${(point.x / 1920) * 100}%`,
                top: `${(point.y / 1080) * 100}%`,
                opacity: index / mouseTrail.length * 0.5,
                transform: 'translate(-50%, -50%)'
              }}
            />
          ))}
        </div>
        
        {data.action && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
            {data.action}
          </div>
        )}
      </div>
    )
  }

  const renderButtonPress = (data: ButtonPress) => {
    return (
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-blue-400 font-medium">Button Clicked</span>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">Active</span>
          </div>
        </div>
        
        <div className="space-y-2">
          {data.elementText && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 text-sm">Text:</span>
              <span className="text-white font-mono text-sm bg-gray-800 px-2 py-1 rounded">
                {data.elementText}
              </span>
            </div>
          )}
          
          {data.elementId && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 text-sm">ID:</span>
              <span className="text-gray-300 font-mono text-xs">#{data.elementId}</span>
            </div>
          )}
          
          {data.coordinates && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 text-sm">Position:</span>
              <span className="text-gray-300 font-mono text-xs">
                ({data.coordinates.x}, {data.coordinates.y})
              </span>
            </div>
          )}
        </div>

        {/* Animation */}
        <div className="mt-3 relative h-20 bg-gray-800 rounded overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <button className="px-4 py-2 bg-blue-600 text-white rounded transform transition-all hover:scale-110">
              {data.elementText || 'Button'}
            </button>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-full animate-pulse-click" />
          </div>
        </div>
      </div>
    )
  }

  const renderFormFill = (data: FormFill) => {
    return (
      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-green-400 font-medium">Form Filling</span>
          <div className="flex items-center space-x-2">
            <div className="w-24 bg-gray-700 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${data.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{data.progress}%</span>
          </div>
        </div>

        <div className="space-y-2">
          {data.fields.map((field, index) => (
            <div 
              key={index}
              className="flex items-center space-x-2 text-sm"
              style={{
                opacity: index < (data.fields.length * data.progress / 100) ? 1 : 0.3
              }}
            >
              <span className="text-gray-500 min-w-[80px]">{field.name}:</span>
              <div className="flex-1 relative">
                <input
                  type={field.type}
                  value={field.value}
                  readOnly
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
                />
                {index < (data.fields.length * data.progress / 100) && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <span className="text-green-400">✓</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderCodeExecution = (data: CodeExecution) => {
    return (
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg overflow-hidden">
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-purple-400 font-medium">Code Execution</span>
              <span className="text-xs px-2 py-0.5 bg-purple-800 text-purple-200 rounded">
                {data.language}
              </span>
            </div>
            {data.executionTime && (
              <span className="text-xs text-gray-400">{data.executionTime}ms</span>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Code:</div>
            <pre className="bg-gray-900 p-2 rounded text-xs text-gray-300 overflow-x-auto max-h-32">
              <code>{data.code}</code>
            </pre>
          </div>

          {(data.output || data.error) && (
            <div>
              <div className="text-xs text-gray-500 mb-1">
                {data.error ? 'Error:' : 'Output:'}
              </div>
              <pre className={`p-2 rounded text-xs overflow-x-auto ${
                data.error 
                  ? 'bg-red-900/30 text-red-400 border border-red-500/30' 
                  : 'bg-green-900/30 text-green-400 border border-green-500/30'
              }`}>
                <code>{data.error || data.output}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderTestResult = (data: TestResult) => {
    const isPassing = data.status === 'pass'
    const bgColor = isPassing ? 'bg-green-900/20' : 'bg-red-900/20'
    const borderColor = isPassing ? 'border-green-500/30' : 'border-red-500/30'
    const textColor = isPassing ? 'text-green-400' : 'text-red-400'

    return (
      <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className={`text-2xl ${isPassing ? 'text-green-500' : 'text-red-500'}`}>
              {isPassing ? '✓' : '✗'}
            </span>
            <div>
              <div className={`font-medium ${textColor}`}>{data.name}</div>
              {data.suite && (
                <div className="text-xs text-gray-500">{data.suite}</div>
              )}
            </div>
          </div>
          {data.duration && (
            <span className="text-xs text-gray-400">{data.duration}ms</span>
          )}
        </div>

        {data.assertions && data.assertions.length > 0 && (
          <div className="space-y-2 mt-3">
            {data.assertions.map((assertion, index) => (
              <div 
                key={index}
                className={`flex items-start space-x-2 text-sm ${
                  assertion.passed ? 'text-green-400' : 'text-red-400'
                }`}
              >
                <span>{assertion.passed ? '✓' : '✗'}</span>
                <div className="flex-1">
                  <div>{assertion.description}</div>
                  {!assertion.passed && (
                    <div className="text-xs mt-1 text-gray-400">
                      <div>Expected: {JSON.stringify(assertion.expected)}</div>
                      <div>Actual: {JSON.stringify(assertion.actual)}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {data.error && (
          <div className="mt-3 bg-red-900/30 border border-red-500/30 rounded p-2">
            <pre className="text-xs text-red-400 whitespace-pre-wrap">{data.error}</pre>
          </div>
        )}
      </div>
    )
  }

  const renderActivity = (activity: AgentActivity) => {
    switch (activity.type) {
      case 'screen-recording':
        return renderScreenRecording(activity.data)
      case 'button-press':
        return renderButtonPress(activity.data)
      case 'form-fill':
        return renderFormFill(activity.data)
      case 'code-execution':
        return renderCodeExecution(activity.data)
      case 'test-result':
        return renderTestResult(activity.data)
      default:
        return (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400">
              {activity.type}: {JSON.stringify(activity.data)}
            </div>
          </div>
        )
    }
  }

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter)

  return (
    <div className={`bg-gray-900 rounded-lg shadow-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
            <span>Agent Activity Monitor</span>
            <span className="text-xs px-2 py-1 bg-blue-900 text-blue-300 rounded">
              {activities.filter(a => a.status === 'active').length} Active
            </span>
          </h2>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-2 rounded transition-colors ${
                autoScroll 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
              }`}
            >
              ↓
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {['screen-recording', 'button-press', 'form-fill', 'code-execution', 'test-result'].map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 rounded text-sm transition-colors whitespace-nowrap ${
                filter === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {getActivityIcon(type as AgentActivity['type'])} {type.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex h-[600px]">
        {/* Activity list */}
        <div 
          ref={activityContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No activities to display
            </div>
          ) : (
            filteredActivities.map(activity => (
              <div
                key={activity.id}
                className={`cursor-pointer transition-all ${
                  selectedActivity === activity.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => {
                  setSelectedActivity(activity.id)
                  onActivityClick?.(activity)
                }}
              >
                {/* Activity header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getActivityIcon(activity.type)}</span>
                    <span className="text-sm font-medium text-gray-300">{activity.agentName}</span>
                    <span className="text-xs text-gray-500">
                      {activity.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className={`flex items-center space-x-1 text-xs ${
                    activity.status === 'active' ? 'text-blue-400' :
                    activity.status === 'completed' ? 'text-green-400' :
                    'text-red-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      activity.status === 'active' ? 'bg-blue-400 animate-pulse' :
                      activity.status === 'completed' ? 'bg-green-400' :
                      'bg-red-400'
                    }`} />
                    <span>{activity.status}</span>
                  </div>
                </div>

                {/* Activity content */}
                {renderActivity(activity)}
              </div>
            ))
          )}
        </div>

        {/* Minimap */}
        {showMinimap && (
          <div className="w-48 bg-gray-800 border-l border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Activity Timeline</h3>
            <div className="space-y-1">
              {activities.slice(-20).map(activity => (
                <div
                  key={activity.id}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 p-1 rounded"
                  onClick={() => {
                    setSelectedActivity(activity.id)
                    const element = document.getElementById(`activity-${activity.id}`)
                    element?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  <span className="text-xs">{getActivityIcon(activity.type)}</span>
                  <div className="flex-1 h-1 bg-gray-600 rounded overflow-hidden">
                    <div 
                      className={`h-full ${
                        activity.status === 'active' ? 'bg-blue-500' :
                        activity.status === 'completed' ? 'bg-green-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: activity.status === 'completed' ? '100%' : '50%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// CSS animations (add to your global styles)
const styles = `
@keyframes pulse-click {
  0% {
    transform: scale(1);
    opacity: 0;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.5;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.animate-pulse-click {
  animation: pulse-click 0.6s ease-out;
}
`
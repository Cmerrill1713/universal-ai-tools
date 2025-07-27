import React, { useState, useEffect, useRef } from 'react'

interface Task {
  id: string
  name: string
  description?: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  progress?: number
  startTime?: Date
  endTime?: Date
  error?: string
  subtasks?: Task[]
  agentId?: string
  agentName?: string
}

interface Agent {
  id: string
  name: string
  status: 'idle' | 'busy' | 'error'
  currentTaskId?: string
  avatar?: string
}

interface TaskExecutionVisualizerProps {
  tasks: Task[]
  agents?: Agent[]
  onTaskClick?: (task: Task) => void
  className?: string
}

export default function TaskExecutionVisualizer({
  tasks,
  agents = [],
  onTaskClick,
  className = ''
}: TaskExecutionVisualizerProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest activity
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight
    }
  }, [tasks])

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'pending': return 'text-gray-400 bg-gray-100 dark:bg-gray-700'
      case 'in-progress': return 'text-blue-600 bg-blue-100 dark:bg-blue-900'
      case 'completed': return 'text-green-600 bg-green-100 dark:bg-green-900'
      case 'failed': return 'text-red-600 bg-red-100 dark:bg-red-900'
      default: return 'text-gray-400 bg-gray-100 dark:bg-gray-700'
    }
  }

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'pending': return '○'
      case 'in-progress': return '◐'
      case 'completed': return '✓'
      case 'failed': return '✗'
      default: return '○'
    }
  }

  const getProgressBarColor = (status: Task['status']) => {
    switch (status) {
      case 'in-progress': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTasks)
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId)
    } else {
      newExpanded.add(taskId)
    }
    setExpandedTasks(newExpanded)
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id)
    onTaskClick?.(task)
  }

  const formatDuration = (start?: Date, end?: Date) => {
    if (!start) return ''
    const endTime = end || new Date()
    const duration = endTime.getTime() - start.getTime()
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const formatTime = (date?: Date) => {
    if (!date) return ''
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  const getOverallProgress = () => {
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === 'completed').length
    return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  }

  const renderTask = (task: Task, depth = 0) => {
    const isExpanded = expandedTasks.has(task.id)
    const hasSubtasks = task.subtasks && task.subtasks.length > 0
    const isSelected = selectedTaskId === task.id
    const agent = agents.find(a => a.id === task.agentId)

    return (
      <div key={task.id} className={`${depth > 0 ? 'ml-6' : ''}`}>
        <div
          className={`
            group flex items-start p-3 rounded-lg cursor-pointer transition-all
            ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
            ${task.status === 'completed' ? 'opacity-75' : ''}
          `}
          onClick={() => handleTaskClick(task)}
        >
          {/* Expand/Collapse button */}
          {hasSubtasks && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleTaskExpansion(task.id)
              }}
              className="mr-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}

          {/* Status icon */}
          <span className={`
            flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mr-3
            ${getStatusColor(task.status)}
          `}>
            {getStatusIcon(task.status)}
          </span>

          {/* Task content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`
                font-medium text-gray-900 dark:text-gray-100
                ${task.status === 'completed' ? 'line-through' : ''}
              `}>
                {task.name}
              </h3>
              {agent && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({agent.name})
                </span>
              )}
            </div>
            
            {task.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {task.description}
              </p>
            )}

            {/* Progress bar */}
            {task.progress !== undefined && task.status === 'in-progress' && (
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${getProgressBarColor(task.status)}`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            )}

            {/* Error message */}
            {task.error && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {task.error}
              </div>
            )}

            {/* Timing info */}
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              {task.startTime && (
                <>
                  <span>Started: {formatTime(task.startTime)}</span>
                  <span>Duration: {formatDuration(task.startTime, task.endTime)}</span>
                </>
              )}
            </div>
          </div>

          {/* Agent indicator */}
          {agent && (
            <div className="flex-shrink-0 ml-3">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs
                ${agent.status === 'busy' ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}
              `}>
                {agent.avatar || agent.name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {/* Subtasks */}
        {hasSubtasks && isExpanded && (
          <div className="mt-1">
            {task.subtasks!.map(subtask => renderTask(subtask, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Task Execution Progress
          </h2>
          <div className="flex items-center gap-4">
            {/* Overall progress */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Overall:</span>
              <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${getOverallProgress()}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {Math.round(getOverallProgress())}%
              </span>
            </div>
          </div>
        </div>

        {/* Status legend */}
        <div className="mt-3 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600"></span>
            <span className="text-gray-600 dark:text-gray-400">Pending</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-gray-600 dark:text-gray-400">In Progress</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-green-500"></span>
            <span className="text-gray-600 dark:text-gray-400">Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-red-500"></span>
            <span className="text-gray-600 dark:text-gray-400">Failed</span>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="p-4 space-y-2 max-h-96 overflow-y-auto" ref={timelineRef}>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No tasks to display
          </div>
        ) : (
          tasks.map(task => renderTask(task))
        )}
      </div>

      {/* Agent activity panel */}
      {agents.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Active Agents
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {agents.map(agent => (
              <div
                key={agent.id}
                className={`
                  flex items-center gap-2 px-3 py-1 rounded-full text-xs
                  ${agent.status === 'busy' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}
                `}
              >
                <span className={`
                  w-2 h-2 rounded-full
                  ${agent.status === 'busy' ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}
                `}></span>
                <span>{agent.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
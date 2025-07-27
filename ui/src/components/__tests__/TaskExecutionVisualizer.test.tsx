import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import TaskExecutionVisualizer from '../TaskExecutionVisualizer'

describe('TaskExecutionVisualizer', () => {
  const mockTasks = [
    {
      id: '1',
      name: 'Test Task 1',
      description: 'First test task',
      status: 'completed' as const,
      progress: 100,
      startTime: new Date(),
      endTime: new Date(),
    },
    {
      id: '2',
      name: 'Test Task 2',
      status: 'in-progress' as const,
      progress: 50,
      startTime: new Date(),
      subtasks: [
        {
          id: '2.1',
          name: 'Subtask 1',
          status: 'completed' as const,
        },
        {
          id: '2.2',
          name: 'Subtask 2',
          status: 'pending' as const,
        }
      ]
    },
    {
      id: '3',
      name: 'Test Task 3',
      status: 'failed' as const,
      error: 'Something went wrong',
    }
  ]

  const mockAgents = [
    { id: 'agent-1', name: 'Test Agent 1', status: 'busy' as const },
    { id: 'agent-2', name: 'Test Agent 2', status: 'idle' as const }
  ]

  it('renders tasks correctly', () => {
    render(<TaskExecutionVisualizer tasks={mockTasks} />)
    
    expect(screen.getByText('Test Task 1')).toBeInTheDocument()
    expect(screen.getByText('Test Task 2')).toBeInTheDocument()
    expect(screen.getByText('Test Task 3')).toBeInTheDocument()
  })

  it('shows completed tasks with strikethrough', () => {
    render(<TaskExecutionVisualizer tasks={mockTasks} />)
    
    const completedTask = screen.getByText('Test Task 1')
    expect(completedTask).toHaveClass('line-through')
  })

  it('displays progress bars for in-progress tasks', () => {
    render(<TaskExecutionVisualizer tasks={mockTasks} />)
    
    // Check for progress bar by looking for the progress percentage style
    const progressBar = document.querySelector('[style*="width: 50%"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('shows error messages for failed tasks', () => {
    render(<TaskExecutionVisualizer tasks={mockTasks} />)
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('expands and collapses subtasks', () => {
    render(<TaskExecutionVisualizer tasks={mockTasks} />)
    
    // Initially, subtasks should not be visible
    expect(screen.queryByText('Subtask 1')).not.toBeInTheDocument()
    
    // Click expand button (the triangle)
    const expandButton = screen.getAllByText('▶')[0]
    fireEvent.click(expandButton)
    
    // Now subtasks should be visible
    expect(screen.getByText('Subtask 1')).toBeInTheDocument()
    expect(screen.getByText('Subtask 2')).toBeInTheDocument()
  })

  it('displays agent information', () => {
    render(<TaskExecutionVisualizer tasks={mockTasks} agents={mockAgents} />)
    
    expect(screen.getByText('Test Agent 1')).toBeInTheDocument()
    expect(screen.getByText('Test Agent 2')).toBeInTheDocument()
  })

  it('calculates overall progress correctly', () => {
    render(<TaskExecutionVisualizer tasks={mockTasks} />)
    
    // 1 completed out of 3 tasks = 33%
    expect(screen.getByText('33%')).toBeInTheDocument()
  })

  it('calls onTaskClick when task is clicked', () => {
    const mockOnTaskClick = jest.fn()
    render(<TaskExecutionVisualizer tasks={mockTasks} onTaskClick={mockOnTaskClick} />)
    
    fireEvent.click(screen.getByText('Test Task 1').closest('.group')!)
    
    expect(mockOnTaskClick).toHaveBeenCalledWith(expect.objectContaining({
      id: '1',
      name: 'Test Task 1'
    }))
  })

  it('shows correct status icons', () => {
    render(<TaskExecutionVisualizer tasks={mockTasks} />)
    
    expect(screen.getByText('✓')).toBeInTheDocument() // completed
    expect(screen.getByText('◐')).toBeInTheDocument() // in-progress
    expect(screen.getByText('✗')).toBeInTheDocument() // failed
  })

  it('displays timing information', () => {
    const task = {
      id: '1',
      name: 'Timed Task',
      status: 'completed' as const,
      startTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      endTime: new Date(),
    }
    
    render(<TaskExecutionVisualizer tasks={[task]} />)
    
    expect(screen.getByText(/Started:/)).toBeInTheDocument()
    expect(screen.getByText(/Duration:/)).toBeInTheDocument()
  })
})
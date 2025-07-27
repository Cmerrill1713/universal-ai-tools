import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import AgentActivityMonitor from '../AgentActivityMonitor'

describe('AgentActivityMonitor', () => {
  const mockActivities = [
    {
      id: '1',
      agentId: 'agent-1',
      agentName: 'UI Agent',
      type: 'screen-recording' as const,
      timestamp: new Date('2024-01-20T10:00:00'),
      status: 'active' as const,
      data: {
        screenshot: 'data:image/png;base64,mock',
        mousePosition: { x: 100, y: 200 },
        action: 'Navigating to dashboard'
      }
    },
    {
      id: '2',
      agentId: 'agent-2',
      agentName: 'Form Agent',
      type: 'form-fill' as const,
      timestamp: new Date('2024-01-20T10:01:00'),
      status: 'active' as const,
      data: {
        formId: 'user-form',
        fields: [
          { name: 'username', value: 'testuser', type: 'text' },
          { name: 'email', value: 'test@example.com', type: 'email' },
          { name: 'password', value: '********', type: 'password' }
        ],
        progress: 66
      }
    },
    {
      id: '3',
      agentId: 'agent-3',
      agentName: 'Test Runner',
      type: 'test-result' as const,
      timestamp: new Date('2024-01-20T10:02:00'),
      status: 'completed' as const,
      data: {
        name: 'Login Flow Test',
        suite: 'Authentication Tests',
        status: 'pass',
        duration: 245,
        assertions: [
          { description: 'User can enter credentials', passed: true },
          { description: 'Login button is clickable', passed: true },
          { description: 'Redirects to dashboard after login', passed: true }
        ]
      }
    },
    {
      id: '4',
      agentId: 'agent-4',
      agentName: 'Code Agent',
      type: 'code-execution' as const,
      timestamp: new Date('2024-01-20T10:03:00'),
      status: 'failed' as const,
      data: {
        language: 'javascript',
        code: 'console.log("Hello World")\nthrow new Error("Test error")',
        output: 'Hello World',
        error: 'Error: Test error',
        executionTime: 15
      }
    }
  ]

  it('renders without crashing', () => {
    render(<AgentActivityMonitor activities={[]} />)
    expect(screen.getByText('Agent Activity Monitor')).toBeInTheDocument()
  })

  it('displays all activities', () => {
    render(<AgentActivityMonitor activities={mockActivities} />)
    
    expect(screen.getByText('UI Agent')).toBeInTheDocument()
    expect(screen.getByText('Form Agent')).toBeInTheDocument()
    expect(screen.getByText('Test Runner')).toBeInTheDocument()
    expect(screen.getByText('Code Agent')).toBeInTheDocument()
  })

  it('shows correct activity count', () => {
    render(<AgentActivityMonitor activities={mockActivities} />)
    
    // 2 active activities (screen-recording and form-fill)
    expect(screen.getByText('2 Active')).toBeInTheDocument()
  })

  it('filters activities by type', () => {
    render(<AgentActivityMonitor activities={mockActivities} />)
    
    // Click on test-result filter
    const testResultFilter = screen.getByText('🧪 test result')
    fireEvent.click(testResultFilter)
    
    // Should only show test result activity
    expect(screen.getByText('Login Flow Test')).toBeInTheDocument()
    expect(screen.queryByText('UI Agent')).not.toBeInTheDocument()
  })

  it('handles activity click', () => {
    const mockOnClick = jest.fn()
    render(
      <AgentActivityMonitor 
        activities={mockActivities} 
        onActivityClick={mockOnClick}
      />
    )
    
    // Click on the first activity
    const firstActivity = screen.getByText('Navigating to dashboard')
    fireEvent.click(firstActivity.closest('div[class*="cursor-pointer"]')!)
    
    expect(mockOnClick).toHaveBeenCalledWith(mockActivities[0])
  })

  it('toggles play/pause', () => {
    render(<AgentActivityMonitor activities={mockActivities} />)
    
    const playPauseButton = screen.getByText('⏸')
    fireEvent.click(playPauseButton)
    
    expect(screen.getByText('▶')).toBeInTheDocument()
  })

  it('toggles auto-scroll', () => {
    render(<AgentActivityMonitor activities={mockActivities} />)
    
    const autoScrollButton = screen.getByText('↓')
    expect(autoScrollButton.className).toContain('bg-blue-600')
    
    fireEvent.click(autoScrollButton)
    expect(autoScrollButton.className).toContain('bg-gray-700')
  })

  it('renders screen recording with mouse position', () => {
    render(<AgentActivityMonitor activities={[mockActivities[0]]} />)
    
    expect(screen.getByText('Navigating to dashboard')).toBeInTheDocument()
    expect(screen.getByAltText('Screen capture')).toBeInTheDocument()
  })

  it('renders form fill with progress', () => {
    render(<AgentActivityMonitor activities={[mockActivities[1]]} />)
    
    expect(screen.getByText('66%')).toBeInTheDocument()
    expect(screen.getByDisplayValue('testuser')).toBeInTheDocument()
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
  })

  it('renders test results with assertions', () => {
    render(<AgentActivityMonitor activities={[mockActivities[2]]} />)
    
    expect(screen.getByText('Login Flow Test')).toBeInTheDocument()
    expect(screen.getByText('Authentication Tests')).toBeInTheDocument()
    expect(screen.getByText('245ms')).toBeInTheDocument()
    expect(screen.getByText('User can enter credentials')).toBeInTheDocument()
  })

  it('renders code execution with error', () => {
    render(<AgentActivityMonitor activities={[mockActivities[3]]} />)
    
    expect(screen.getByText('javascript')).toBeInTheDocument()
    expect(screen.getByText('15ms')).toBeInTheDocument()
    expect(screen.getByText('Error: Test error')).toBeInTheDocument()
  })

  it('shows empty state when no activities', () => {
    render(<AgentActivityMonitor activities={[]} />)
    
    expect(screen.getByText('No activities to display')).toBeInTheDocument()
  })

  it('renders minimap when enabled', () => {
    render(<AgentActivityMonitor activities={mockActivities} showMinimap={true} />)
    
    expect(screen.getByText('Activity Timeline')).toBeInTheDocument()
  })

  it('hides minimap when disabled', () => {
    render(<AgentActivityMonitor activities={mockActivities} showMinimap={false} />)
    
    expect(screen.queryByText('Activity Timeline')).not.toBeInTheDocument()
  })
})
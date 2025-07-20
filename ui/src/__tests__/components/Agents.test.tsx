import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Agents } from '../../pages/Agents';
import { render, mockApiResponse, resetMocks } from '../../test/utils';

// Mock the API calls
global.fetch = vi.fn();

// Mock the useWebSocket hook
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: true,
  })),
}));

const mockAgents = [
  {
    id: '1',
    name: 'Enhanced Planner',
    description: 'AI agent for advanced planning and task breakdown',
    type: 'cognitive' as const,
    status: 'running' as const,
    capabilities: ['planning', 'task_breakdown', 'goal_setting'],
    metrics: {
      totalRequests: 150,
      successfulRequests: 142,
      averageLatencyMs: 250,
      lastExecuted: new Date().toISOString(),
      performanceScore: 94.7,
      cpuUsage: 12,
      memoryUsage: 156,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Temperature Controller',
    description: 'Controls AI model temperature and response consistency',
    type: 'system' as const,
    status: 'idle' as const,
    capabilities: ['temperature_control', 'consistency_monitoring'],
    metrics: {
      totalRequests: 89,
      successfulRequests: 89,
      averageLatencyMs: 45,
      lastExecuted: new Date(Date.now() - 3600000).toISOString(),
      performanceScore: 100,
      cpuUsage: 3,
      memoryUsage: 32,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Context Manager',
    description: 'Manages conversation context and memory integration',
    type: 'cognitive' as const,
    status: 'running' as const,
    capabilities: ['context_management', 'memory_integration', 'conversation_flow'],
    metrics: {
      totalRequests: 267,
      successfulRequests: 251,
      averageLatencyMs: 180,
      lastExecuted: new Date(Date.now() - 60000).toISOString(),
      performanceScore: 94.0,
      cpuUsage: 8,
      memoryUsage: 89,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Resource Manager',
    description: 'Manages system resources and performance optimization',
    type: 'system' as const,
    status: 'stopped' as const,
    capabilities: ['resource_monitoring', 'performance_optimization', 'load_balancing'],
    metrics: {
      totalRequests: 45,
      successfulRequests: 43,
      averageLatencyMs: 320,
      lastExecuted: new Date(Date.now() - 86400000).toISOString(),
      performanceScore: 95.6,
      cpuUsage: 0,
      memoryUsage: 0,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe('Agents Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    resetMocks();
    vi.mocked(global.fetch).mockResolvedValue(
      mockApiResponse({ agents: mockAgents })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    render(<Agents />);
    
    expect(screen.getByText('AI Agents')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search agents...')).toBeInTheDocument();
    expect(screen.getByText('Create Agent')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
    });
  });

  it('displays connection status correctly', () => {
    render(<Agents />);
    
    expect(screen.getByText('● Connected')).toBeInTheDocument();
  });

  it('shows disconnected state when WebSocket is down', () => {
    const { useWebSocket } = require('../../hooks/useWebSocket');
    vi.mocked(useWebSocket).mockReturnValue({
      isConnected: false,
    });
    
    render(<Agents />);
    
    expect(screen.getByText('● Disconnected')).toBeInTheDocument();
  });

  it('displays agent cards with correct information', async () => {
    render(<Agents />);
    
    await waitFor(() => {
      // Check agent names
      expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
      expect(screen.getByText('Temperature Controller')).toBeInTheDocument();
      expect(screen.getByText('Context Manager')).toBeInTheDocument();
      expect(screen.getByText('Resource Manager')).toBeInTheDocument();
      
      // Check descriptions
      expect(screen.getByText('AI agent for advanced planning and task breakdown')).toBeInTheDocument();
      expect(screen.getByText('Controls AI model temperature and response consistency')).toBeInTheDocument();
      
      // Check agent types
      expect(screen.getAllByText('cognitive')).toHaveLength(2);
      expect(screen.getAllByText('system')).toHaveLength(2);
    });
  });

  it('displays agent status indicators correctly', async () => {
    render(<Agents />);
    
    await waitFor(() => {
      // Check for status indicators (these would be colored dots)
      const runningAgents = screen.getAllByText('Enhanced Planner');
      expect(runningAgents).toHaveLength(1);
      
      const stoppedAgent = screen.getByText('Resource Manager');
      expect(stoppedAgent).toBeInTheDocument();
    });
  });

  it('displays agent capabilities as tags', async () => {
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('planning')).toBeInTheDocument();
      expect(screen.getByText('task_breakdown')).toBeInTheDocument();
      expect(screen.getByText('goal_setting')).toBeInTheDocument();
      expect(screen.getByText('temperature_control')).toBeInTheDocument();
      expect(screen.getByText('context_management')).toBeInTheDocument();
    });
  });

  it('displays agent metrics correctly', async () => {
    render(<Agents />);
    
    await waitFor(() => {
      // Check performance scores
      expect(screen.getByText('94.7%')).toBeInTheDocument();
      expect(screen.getByText('100.0%')).toBeInTheDocument();
      expect(screen.getByText('94.0%')).toBeInTheDocument();
      
      // Check CPU and memory usage
      expect(screen.getByText('12%')).toBeInTheDocument(); // CPU usage
      expect(screen.getByText('156MB')).toBeInTheDocument(); // Memory usage
      
      // Check latency
      expect(screen.getByText('250ms')).toBeInTheDocument();
      expect(screen.getByText('45ms')).toBeInTheDocument();
    });
  });

  it('handles agent search functionality', async () => {
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search agents...');
    
    await user.type(searchInput, 'planner');
    
    // Should filter to only show the Enhanced Planner
    expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
    expect(screen.queryByText('Temperature Controller')).not.toBeInTheDocument();
  });

  it('filters agents by type', async () => {
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search agents...');
    
    await user.type(searchInput, 'system');
    
    // Should show system agents
    expect(screen.getByText('Temperature Controller')).toBeInTheDocument();
    expect(screen.getByText('Resource Manager')).toBeInTheDocument();
    expect(screen.queryByText('Enhanced Planner')).not.toBeInTheDocument();
  });

  it('handles agent start/stop controls', async () => {
    vi.mocked(global.fetch).mockImplementation((url) => {
      if (url.includes('/start') || url.includes('/stop') || url.includes('/pause')) {
        return Promise.resolve(mockApiResponse({ success: true }));
      }
      return Promise.resolve(mockApiResponse({ agents: mockAgents }));
    });
    
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('Resource Manager')).toBeInTheDocument();
    });
    
    // Find the Start button for the stopped agent (Resource Manager)
    const resourceManagerCard = screen.getByText('Resource Manager').closest('div');
    const startButton = within(resourceManagerCard!).getByText('Start');
    
    await user.click(startButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents/4/start'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('handles agent pause functionality', async () => {
    vi.mocked(global.fetch).mockImplementation((url) => {
      if (url.includes('/pause')) {
        return Promise.resolve(mockApiResponse({ success: true }));
      }
      return Promise.resolve(mockApiResponse({ agents: mockAgents }));
    });
    
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
    });
    
    // Find the Pause button for a running agent
    const plannerCard = screen.getByText('Enhanced Planner').closest('div');
    const pauseButton = within(plannerCard!).getByText('Pause');
    
    await user.click(pauseButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents/1/pause'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('opens agent execution modal', async () => {
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
    });
    
    // Find and click the execute button (lightning icon)
    const plannerCard = screen.getByText('Enhanced Planner').closest('div');
    const executeButton = within(plannerCard!).getByRole('button', { name: '' }); // Lightning icon button
    
    await user.click(executeButton);
    
    expect(screen.getByText('Execute Agent: Enhanced Planner')).toBeInTheDocument();
    expect(screen.getByText('Task Description')).toBeInTheDocument();
    expect(screen.getByText('Parameters (JSON)')).toBeInTheDocument();
  });

  it('handles agent execution flow', async () => {
    vi.mocked(global.fetch).mockImplementation((url) => {
      if (url.includes('/execute')) {
        return Promise.resolve(mockApiResponse({
          success: true,
          execution_id: 'exec-123',
          result: {
            status: 'completed',
            output: 'Task completed successfully',
            metrics: {
              execution_time_ms: 500,
              cpu_usage: 15,
              memory_usage: 80,
            },
          },
        }));
      }
      return Promise.resolve(mockApiResponse({ agents: mockAgents }));
    });
    
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
    });
    
    // Open execution modal
    const plannerCard = screen.getByText('Enhanced Planner').closest('div');
    const executeButton = within(plannerCard!).getByRole('button', { name: '' });
    await user.click(executeButton);
    
    // Fill in task description
    const taskInput = screen.getByPlaceholderText('Describe the task for the agent to perform...');
    await user.type(taskInput, 'Create a project plan');
    
    // Execute the agent
    const submitButton = screen.getByText('Execute');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents/1/execute'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            task: 'Create a project plan',
            parameters: {},
          }),
        })
      );
    });
  });

  it('opens create agent modal', async () => {
    render(<Agents />);
    
    const createButton = screen.getByText('Create Agent');
    await user.click(createButton);
    
    expect(screen.getByText('Create AI Agent')).toBeInTheDocument();
    expect(screen.getByText('Agent Name')).toBeInTheDocument();
    expect(screen.getByText('Agent Type')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Capabilities')).toBeInTheDocument();
  });

  it('handles agent creation flow', async () => {
    vi.mocked(global.fetch).mockImplementation((url, options) => {
      if (options?.method === 'POST' && url.includes('/agents')) {
        return Promise.resolve(mockApiResponse({
          success: true,
          agent: {
            id: 'new-agent',
            name: 'Test Agent',
            description: 'A test agent',
            type: 'cognitive',
            status: 'idle',
            capabilities: ['testing'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }));
      }
      return Promise.resolve(mockApiResponse({ agents: mockAgents }));
    });
    
    render(<Agents />);
    
    // Open create modal
    await user.click(screen.getByText('Create Agent'));
    
    // Fill in the form
    const nameInput = screen.getByPlaceholderText('My AI Agent');
    await user.type(nameInput, 'Test Agent');
    
    const descInput = screen.getByPlaceholderText('Description of what this agent does');
    await user.type(descInput, 'A test agent');
    
    // Add capabilities
    const capabilityInput = screen.getByPlaceholderText('Add capabilities...');
    await user.type(capabilityInput, 'testing');
    await user.keyboard('{Enter}');
    
    expect(screen.getByText('testing')).toBeInTheDocument();
    
    // Submit the form
    const createButton = screen.getByText('Create Agent');
    await user.click(createButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Test Agent',
            description: 'A test agent',
            type: 'cognitive',
            capabilities: ['testing'],
            config: {},
          }),
        })
      );
    });
  });

  it('handles capability management in create modal', async () => {
    render(<Agents />);
    
    await user.click(screen.getByText('Create Agent'));
    
    const capabilityInput = screen.getByPlaceholderText('Add capabilities...');
    
    // Add capability with Enter key
    await user.type(capabilityInput, 'capability1');
    await user.keyboard('{Enter}');
    
    expect(screen.getByText('capability1')).toBeInTheDocument();
    
    // Add capability with button
    await user.type(capabilityInput, 'capability2');
    const addButton = screen.getByRole('button', { name: /plus/i });
    await user.click(addButton);
    
    expect(screen.getByText('capability2')).toBeInTheDocument();
    
    // Remove a capability
    const removeButtons = screen.getAllByRole('button', { name: /×/i });
    await user.click(removeButtons[0]);
    
    expect(screen.queryByText('capability1')).not.toBeInTheDocument();
  });

  it('handles agent type selection in create modal', async () => {
    render(<Agents />);
    
    await user.click(screen.getByText('Create Agent'));
    
    const typeSelect = screen.getByRole('combobox');
    await user.selectOptions(typeSelect, 'system');
    
    expect(typeSelect).toHaveValue('system');
  });

  it('handles Start All functionality', async () => {
    vi.mocked(global.fetch).mockImplementation((url) => {
      if (url.includes('/start')) {
        return Promise.resolve(mockApiResponse({ success: true }));
      }
      return Promise.resolve(mockApiResponse({ agents: mockAgents }));
    });
    
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('Resource Manager')).toBeInTheDocument();
    });
    
    const startAllButton = screen.getByText('Start All');
    await user.click(startAllButton);
    
    // Should call start for stopped agents
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agents/4/start'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('shows empty state when no agents exist', async () => {
    vi.mocked(global.fetch).mockResolvedValue(mockApiResponse({ agents: [] }));
    
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('No agents found')).toBeInTheDocument();
      expect(screen.getByText('Click "Create Agent" to add your first agent')).toBeInTheDocument();
    });
  });

  it('shows no results state when search yields no matches', async () => {
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search agents...');
    await user.type(searchInput, 'nonexistent');
    
    expect(screen.getByText('No agents found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search terms')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('API Error'));
    
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load agents')).toBeInTheDocument();
    });
  });

  it('displays execution results in modal', async () => {
    vi.mocked(global.fetch).mockImplementation((url) => {
      if (url.includes('/execute')) {
        return Promise.resolve(mockApiResponse({
          success: true,
          execution_id: 'exec-123',
          result: {
            status: 'completed',
            output: 'Task completed successfully',
            metrics: {
              execution_time_ms: 500,
            },
          },
        }));
      }
      return Promise.resolve(mockApiResponse({ agents: mockAgents }));
    });
    
    render(<Agents />);
    
    await waitFor(() => {
      expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
    });
    
    // Open execution modal and execute
    const plannerCard = screen.getByText('Enhanced Planner').closest('div');
    const executeButton = within(plannerCard!).getByRole('button', { name: '' });
    await user.click(executeButton);
    
    const taskInput = screen.getByPlaceholderText('Describe the task for the agent to perform...');
    await user.type(taskInput, 'Test task');
    
    const submitButton = screen.getByText('Execute');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Execution Result')).toBeInTheDocument();
      expect(screen.getByText(/500ms/)).toBeInTheDocument();
    });
  });

  it('formats relative dates correctly', async () => {
    render(<Agents />);
    
    await waitFor(() => {
      // Should show relative time formatting for last executed times
      expect(screen.getByText(/\d+[mhd] ago/)).toBeInTheDocument();
    });
  });

  it('has proper accessibility attributes', async () => {
    render(<Agents />);
    
    // Check for proper input labels
    const searchInput = screen.getByPlaceholderText('Search agents...');
    expect(searchInput).toHaveAttribute('type', 'text');
    
    // Check for button accessibility
    const createButton = screen.getByText('Create Agent');
    expect(createButton).toBeInTheDocument();
    
    await waitFor(() => {
      // Check for agent cards structure
      expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
    });
  });

  it('closes modals when clicking cancel or X', async () => {
    render(<Agents />);
    
    // Test create modal
    await user.click(screen.getByText('Create Agent'));
    expect(screen.getByText('Agent Name')).toBeInTheDocument();
    
    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Agent Name')).not.toBeInTheDocument();
    
    // Test execute modal
    await waitFor(() => {
      expect(screen.getByText('Enhanced Planner')).toBeInTheDocument();
    });
    
    const plannerCard = screen.getByText('Enhanced Planner').closest('div');
    const executeButton = within(plannerCard!).getByRole('button', { name: '' });
    await user.click(executeButton);
    
    expect(screen.getByText('Execute Agent: Enhanced Planner')).toBeInTheDocument();
    
    const closeButton = screen.getByRole('button', { name: /×/i });
    await user.click(closeButton);
    
    expect(screen.queryByText('Execute Agent: Enhanced Planner')).not.toBeInTheDocument();
  });
});
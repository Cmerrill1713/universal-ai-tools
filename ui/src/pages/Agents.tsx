;
import { useState } from 'react';
import { 
  Users, Play, Pause, Plus, Search, 
  Loader, AlertCircle, CheckCircle, XCircle, Save, X,
  Zap, Brain, Wrench, Monitor
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';

interface Agent {
  id: string;
  name: string;
  description: string;
  type: 'cognitive' | 'personal' | 'system' | 'tool';
  status: 'running' | 'idle' | 'stopped' | 'error';
  capabilities: string[];
  config?: any;
  metrics?: {
    totalRequests: number;
    successfulRequests: number;
    averageLatencyMs: number;
    lastExecuted?: string;
    performanceScore: number;
    cpuUsage: number;
    memoryUsage: number;
  };
  created_at: string;
  updated_at: string;
  last_executed?: string;
}


export function Agents() {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [executionParams, setExecutionParams] = useState<string>('{}');
  const [taskDescription, setTaskDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    type: 'cognitive' as const,
    capabilities: [] as string[],
    config: '{}',
  });
  const [capabilityInput, setCapabilityInput] = useState('');

  // Fetch agents
  const { data: agentsResponse, isLoading, error } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await fetch('http://localhost:9999/api/agents', {
        headers: {
          'X-API-Key': import.meta.env.VITE_API_KEY || '',
          'X-AI-Service': 'local-ui',
        },
      });
      if (!response.ok) {
        // If agents endpoint doesn't exist, return mock data
        if (response.status === 404) {
          return {
            agents: [
              {
                id: '1',
                name: 'Enhanced Planner',
                description: 'AI agent for advanced planning and task breakdown',
                type: 'cognitive',
                status: 'running',
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
                type: 'system',
                status: 'idle',
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
                type: 'cognitive',
                status: 'running',
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
                type: 'system',
                status: 'stopped',
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
            ],
          };
        }
        throw new Error('Failed to fetch agents');
      }
      return response.json();
    },
  });

  const agents = agentsResponse?.agents || [];

  // Execute agent mutation
  const executeAgentMutation = useMutation({
    mutationFn: async ({ agentId, task, parameters }: { agentId: string; task: string; parameters: any }) => {
      const response = await fetch(`http://localhost:9999/api/agents/${agentId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': import.meta.env.VITE_API_KEY || '',
          'X-AI-Service': 'local-ui',
        },
        body: JSON.stringify({ task, parameters }),
      });
      if (!response.ok) {
        // Mock execution for demo purposes
        if (response.status === 404) {
          return {
            success: true,
            execution_id: 'mock-' + Date.now(),
            result: {
              status: 'completed',
              output: `Agent ${agentId} executed task: ${task}`,
              metrics: {
                execution_time_ms: Math.floor(Math.random() * 1000) + 100,
                cpu_usage: Math.floor(Math.random() * 20) + 5,
                memory_usage: Math.floor(Math.random() * 100) + 50,
              },
            },
          };
        }
        throw new Error('Failed to execute agent');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowExecuteModal(false);
      setSelectedAgent(null);
      setTaskDescription('');
      setExecutionParams('{}');
    },
  });

  // Create agent mutation
  const createAgentMutation = useMutation({
    mutationFn: async (agent: typeof newAgent) => {
      const response = await fetch('http://localhost:9999/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': import.meta.env.VITE_API_KEY || '',
          'X-AI-Service': 'local-ui',
        },
        body: JSON.stringify({
          ...agent,
          config: JSON.parse(agent.config),
        }),
      });
      if (!response.ok) {
        // Mock creation for demo purposes
        if (response.status === 404) {
          return {
            success: true,
            agent: {
              id: 'mock-' + Date.now(),
              ...agent,
              status: 'idle',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          };
        }
        throw new Error('Failed to create agent');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowCreateModal(false);
      setNewAgent({
        name: '',
        description: '',
        type: 'cognitive',
        capabilities: [],
        config: '{}',
      });
      setCapabilityInput('');
    },
  });

  // Control agent mutation (start/stop/pause)
  const controlAgentMutation = useMutation({
    mutationFn: async ({ agentId, action }: { agentId: string; action: 'start' | 'stop' | 'pause' }) => {
      const response = await fetch(`http://localhost:9999/api/agents/${agentId}/${action}`, {
        method: 'POST',
        headers: {
          'X-API-Key': import.meta.env.VITE_API_KEY || '',
          'X-AI-Service': 'local-ui',
        },
      });
      if (!response.ok) {
        // Mock control for demo purposes
        if (response.status === 404) {
          return { success: true, status: action === 'start' ? 'running' : action === 'stop' ? 'stopped' : 'idle' };
        }
        throw new Error(`Failed to ${action} agent`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  // WebSocket connection for real-time updates
  const { isConnected } = useWebSocket({
    url: 'ws://localhost:9999',
    onConnect: () => {
      console.log('WebSocket connected');
    },
    onMessage: (data) => {
      if (data.type === 'update' && data.channel === 'agents') {
        queryClient.invalidateQueries({ queryKey: ['agents'] });
      }
    },
  });

  const handleExecuteAgent = async () => {
    if (!selectedAgent || !taskDescription.trim()) return;
    
    try {
      const parameters = JSON.parse(executionParams);
      await executeAgentMutation.mutateAsync({
        agentId: selectedAgent.id,
        task: taskDescription,
        parameters,
      });
    } catch (error) {
      console.error('Error executing agent:', error);
    }
  };

  const handleCreateAgent = () => {
    if (newAgent.name.trim() && newAgent.description.trim()) {
      createAgentMutation.mutate(newAgent);
    }
  };

  const handleAddCapability = () => {
    if (capabilityInput.trim() && !newAgent.capabilities.includes(capabilityInput.trim())) {
      setNewAgent({
        ...newAgent,
        capabilities: [...newAgent.capabilities, capabilityInput.trim()],
      });
      setCapabilityInput('');
    }
  };

  const handleRemoveCapability = (capability: string) => {
    setNewAgent({
      ...newAgent,
      capabilities: newAgent.capabilities.filter(c => c !== capability),
    });
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'cognitive': return Brain;
      case 'personal': return Users;
      case 'system': return Monitor;
      case 'tool': return Wrench;
      default: return Brain;
    }
  };

  const getAgentColor = (type: string) => {
    switch (type) {
      case 'cognitive': return 'text-blue-500';
      case 'personal': return 'text-green-500';
      case 'system': return 'text-purple-500';
      case 'tool': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'stopped': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
  };

  const filteredAgents = agents.filter((agent: Agent) => 
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">AI Agents</h2>
          <p className="text-sm text-gray-400 mt-1">
            {isConnected ? (
              <span className="text-green-500">● Connected</span>
            ) : (
              <span className="text-red-500">● Disconnected</span>
            )}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="secondary" 
            onClick={() => {
              agents.forEach((agent: Agent) => {
                if (agent.status === 'stopped') {
                  controlAgentMutation.mutate({ agentId: agent.id, action: 'start' });
                }
              });
            }}
          >
            <Play className="h-4 w-4 mr-2" />
            Start All
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Card>

      {/* Agents Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-400">Failed to load agents</p>
          <p className="text-sm text-gray-500 mt-2">{error.message}</p>
        </Card>
      ) : filteredAgents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent: Agent) => {
            const IconComponent = getAgentIcon(agent.type);
            return (
              <Card key={agent.id} className="p-6 hover:border-gray-600 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)}`} />
                    <div className="flex items-center space-x-2">
                      <IconComponent className={`h-4 w-4 ${getAgentColor(agent.type)}`} />
                      <h3 className="font-semibold">{agent.name}</h3>
                    </div>
                  </div>
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded capitalize">{agent.type}</span>
                </div>
                
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">{agent.description}</p>

                {/* Capabilities */}
                {agent.capabilities && agent.capabilities.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.slice(0, 3).map((capability: string, idx: number) => (
                        <span key={idx} className="text-xs bg-gray-800 px-2 py-1 rounded">
                          {capability}
                        </span>
                      ))}
                      {agent.capabilities.length > 3 && (
                        <span className="text-xs text-gray-500">+{agent.capabilities.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Metrics */}
                {agent.metrics && (
                  <div className="mb-4 space-y-2">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Performance</span>
                      <span className="text-green-400">{agent.metrics.performanceScore.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>CPU Usage</span>
                      <span>{agent.metrics.cpuUsage}%</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Memory</span>
                      <span>{agent.metrics.memoryUsage}MB</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Avg Latency</span>
                      <span>{agent.metrics.averageLatencyMs}ms</span>
                    </div>
                    {agent.metrics.lastExecuted && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Last Run</span>
                        <span>{formatDate(agent.metrics.lastExecuted)}</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex space-x-2">
                  {agent.status === 'running' ? (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => controlAgentMutation.mutate({ agentId: agent.id, action: 'pause' })}
                      disabled={controlAgentMutation.isPending}
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </Button>
                  ) : (
                    <Button 
                      size="sm"
                      onClick={() => controlAgentMutation.mutate({ agentId: agent.id, action: 'start' })}
                      disabled={controlAgentMutation.isPending}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setSelectedAgent(agent);
                      setShowExecuteModal(true);
                    }}
                  >
                    <Zap className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No agents found</p>
          <p className="text-sm text-gray-500 mt-2">
            {searchQuery ? 'Try adjusting your search terms' : 'Click "Create Agent" to add your first agent'}
          </p>
        </Card>
      )}

      {/* Execute Agent Modal */}
      {showExecuteModal && selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Execute Agent: {selectedAgent.name}</h3>
              <button
                onClick={() => setShowExecuteModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">{selectedAgent.description}</p>
                <div className="flex flex-wrap gap-1">
                  {selectedAgent.capabilities.map((capability: string, idx: number) => (
                    <span key={idx} className="text-xs bg-gray-800 px-2 py-1 rounded">
                      {capability}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Task Description</label>
                <input
                  type="text"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Describe the task for the agent to perform..."
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Parameters (JSON)</label>
                <textarea
                  value={executionParams}
                  onChange={(e) => setExecutionParams(e.target.value)}
                  placeholder='{"key": "value", "option": true}'
                  className="w-full h-32 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              {executeAgentMutation.data && (
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Execution Result</span>
                    {executeAgentMutation.data.result?.metrics?.execution_time_ms && (
                      <span className="text-xs text-gray-500">
                        ({executeAgentMutation.data.result.metrics.execution_time_ms}ms)
                      </span>
                    )}
                  </div>
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                    {JSON.stringify(executeAgentMutation.data.result, null, 2)}
                  </pre>
                </div>
              )}

              {executeAgentMutation.error && (
                <div className="p-4 bg-red-900/20 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-400">Execution Error</span>
                  </div>
                  <p className="text-sm text-red-300">
                    {executeAgentMutation.error.message}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="secondary" onClick={() => setShowExecuteModal(false)}>
                Close
              </Button>
              <Button
                onClick={handleExecuteAgent}
                disabled={executeAgentMutation.isPending || !taskDescription.trim()}
              >
                {executeAgentMutation.isPending ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Execute
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create AI Agent</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Agent Name</label>
                  <input
                    type="text"
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                    placeholder="My AI Agent"
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Agent Type</label>
                  <select
                    value={newAgent.type}
                    onChange={(e) => setNewAgent({ ...newAgent, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cognitive">Cognitive</option>
                    <option value="personal">Personal</option>
                    <option value="system">System</option>
                    <option value="tool">Tool</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  placeholder="Description of what this agent does"
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Capabilities</label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={capabilityInput}
                    onChange={(e) => setCapabilityInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCapability())}
                    placeholder="Add capabilities..."
                    className="flex-1 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button variant="secondary" onClick={handleAddCapability}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {newAgent.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newAgent.capabilities.map((capability: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gray-700 rounded-full text-sm flex items-center space-x-1"
                      >
                        <span>{capability}</span>
                        <button
                          onClick={() => handleRemoveCapability(capability)}
                          className="text-gray-400 hover:text-gray-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Configuration (JSON)</label>
                <textarea
                  value={newAgent.config}
                  onChange={(e) => setNewAgent({ ...newAgent, config: e.target.value })}
                  placeholder='{"temperature": 0.7, "max_tokens": 1000}'
                  className="w-full h-32 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateAgent}
                disabled={!newAgent.name.trim() || !newAgent.description.trim() || createAgentMutation.isPending}
              >
                {createAgentMutation.isPending ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Agent
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
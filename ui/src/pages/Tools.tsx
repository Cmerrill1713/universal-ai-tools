import { useState } from 'react';
import { 
  Wrench, Code, Search, Database, Plus, Play, 
  Loader, AlertCircle, Clock, CheckCircle, XCircle,
  Save, X
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Tool {
  id: string;
  tool_name: string;
  description: string;
  input_schema: any;
  output_schema?: any;
  implementation_type: 'sql' | 'function' | 'api' | 'script';
  implementation: string;
  rate_limit?: number;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

export function Tools() {
  const queryClient = useQueryClient();
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolParameters, setToolParameters] = useState<string>('{}');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [newTool, setNewTool] = useState({
    tool_name: '',
    description: '',
    implementation_type: 'function' as const,
    implementation: '',
    input_schema: '{}',
    output_schema: '{}',
    rate_limit: 100,
  });

  // Fetch tools
  const { data: toolsResponse, isLoading, error } = useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const response = await fetch('http://localhost:9999/api/tools', {
        headers: {
          'X-API-Key': import.meta.env.VITE_API_KEY || '',
          'X-AI-Service': 'local-ui',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch tools');
      return response.json();
    },
  });

  const tools = toolsResponse?.tools || [];

  // Execute tool mutation
  const executeToolMutation = useMutation({
    mutationFn: async ({ toolName, parameters, isBuiltin = false }: { toolName: string; parameters: any; isBuiltin?: boolean }) => {
      const url = isBuiltin 
        ? `http://localhost:9999/api/tools/execute/builtin/${toolName}`
        : 'http://localhost:9999/api/tools/execute';
      
      const body = isBuiltin 
        ? JSON.stringify(parameters)
        : JSON.stringify({ tool_name: toolName, parameters });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': import.meta.env.VITE_API_KEY || '',
          'X-AI-Service': 'local-ui',
        },
        body,
      });
      if (!response.ok) throw new Error('Failed to execute tool');
      return response.json();
    },
  });

  // Create tool mutation
  const createToolMutation = useMutation({
    mutationFn: async (tool: typeof newTool) => {
      const response = await fetch('http://localhost:9999/api/tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': import.meta.env.VITE_API_KEY || '',
          'X-AI-Service': 'local-ui',
        },
        body: JSON.stringify({
          ...tool,
          input_schema: JSON.parse(tool.input_schema),
          output_schema: JSON.parse(tool.output_schema),
        }),
      });
      if (!response.ok) throw new Error('Failed to create tool');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      setShowCreateModal(false);
      setNewTool({
        tool_name: '',
        description: '',
        implementation_type: 'function',
        implementation: '',
        input_schema: '{}',
        output_schema: '{}',
        rate_limit: 100,
      });
    },
  });

  const handleExecuteTool = async () => {
    if (!selectedTool) return;
    
    try {
      const parameters = JSON.parse(toolParameters);
      const isBuiltin = selectedTool.created_by === 'system';
      await executeToolMutation.mutateAsync({
        toolName: selectedTool.tool_name,
        parameters,
        isBuiltin,
      });
      setShowExecuteModal(false);
      setSelectedTool(null);
      setToolParameters('{}');
    } catch (error) {
      console.error('Error executing tool:', error);
    }
  };

  const handleCreateTool = () => {
    if (newTool.tool_name.trim() && newTool.description.trim() && newTool.implementation.trim()) {
      createToolMutation.mutate(newTool);
    }
  };

  const getImplementationIcon = (type: string) => {
    switch (type) {
      case 'sql': return Database;
      case 'function': return Code;
      case 'api': return Search;
      case 'script': return Wrench;
      default: return Code;
    }
  };

  const getImplementationColor = (type: string) => {
    switch (type) {
      case 'sql': return 'text-blue-500';
      case 'function': return 'text-green-500';
      case 'api': return 'text-purple-500';
      case 'script': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  // Built-in tools
  const builtinTools = [
    { name: 'Store Context', description: 'Store contextual information for later use', endpoint: 'store_context' },
    { name: 'Retrieve Context', description: 'Retrieve previously stored context', endpoint: 'retrieve_context' },
    { name: 'Search Knowledge', description: 'Search through knowledge base', endpoint: 'search_knowledge' },
    { name: 'Communicate', description: 'Send messages to other AI services', endpoint: 'communicate' },
    { name: 'Analyze Project', description: 'Analyze project structure and context', endpoint: 'analyze_project' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">AI Tools</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Tool
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-400">Failed to load tools</p>
        </Card>
      ) : (
        <>
          {/* Built-in Tools */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Built-in Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {builtinTools.map((tool) => (
                <Card key={tool.name} className="p-4 hover:border-gray-600 transition-colors">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <h4 className="font-medium">{tool.name}</h4>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">{tool.description}</p>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      setSelectedTool({
                        id: tool.endpoint,
                        tool_name: tool.endpoint,
                        description: tool.description,
                        input_schema: {},
                        implementation_type: 'function',
                        implementation: '',
                        is_active: true,
                        created_at: new Date().toISOString(),
                        created_by: 'system',
                      });
                      setShowExecuteModal(true);
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Execute
                  </Button>
                </Card>
              ))}
            </div>
          </div>

          {/* Custom Tools */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Custom Tools ({tools.length})</h3>
            {tools.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tools.map((tool: Tool) => {
                  const IconComponent = getImplementationIcon(tool.implementation_type);
                  return (
                    <Card key={tool.id} className="p-4 hover:border-gray-600 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-gray-700 rounded-lg">
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="font-medium">{tool.tool_name}</h4>
                            <span className={`text-xs ${getImplementationColor(tool.implementation_type)}`}>
                              {tool.implementation_type}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {tool.rate_limit && (
                            <span className="text-xs text-gray-500">
                              {tool.rate_limit}/hr
                            </span>
                          )}
                          <Clock className="h-3 w-3 text-gray-500" />
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                        {tool.description}
                      </p>
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                          setSelectedTool(tool);
                          setShowExecuteModal(true);
                        }}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Execute
                      </Button>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <Code className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No custom tools created yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Click "Create Tool" to add your first custom tool
                </p>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Execute Tool Modal */}
      {showExecuteModal && selectedTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Execute Tool: {selectedTool.tool_name}</h3>
              <button
                onClick={() => setShowExecuteModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">{selectedTool.description}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Parameters (JSON)</label>
                <textarea
                  value={toolParameters}
                  onChange={(e) => setToolParameters(e.target.value)}
                  placeholder='{"param1": "value1", "param2": "value2"}'
                  className="w-full h-32 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              {executeToolMutation.data && (
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Execution Result</span>
                    <span className="text-xs text-gray-500">
                      ({executeToolMutation.data.execution_time_ms}ms)
                    </span>
                  </div>
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                    {JSON.stringify(executeToolMutation.data.result, null, 2)}
                  </pre>
                </div>
              )}

              {executeToolMutation.error && (
                <div className="p-4 bg-red-900/20 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-400">Execution Error</span>
                  </div>
                  <p className="text-sm text-red-300">
                    {executeToolMutation.error.message}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="secondary" onClick={() => setShowExecuteModal(false)}>
                Close
              </Button>
              <Button
                onClick={handleExecuteTool}
                disabled={executeToolMutation.isPending}
              >
                {executeToolMutation.isPending ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Execute
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create Tool Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Custom Tool</h3>
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
                  <label className="block text-sm font-medium mb-2">Tool Name</label>
                  <input
                    type="text"
                    value={newTool.tool_name}
                    onChange={(e) => setNewTool({ ...newTool, tool_name: e.target.value })}
                    placeholder="my_custom_tool"
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Implementation Type</label>
                  <select
                    value={newTool.implementation_type}
                    onChange={(e) => setNewTool({ ...newTool, implementation_type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="function">JavaScript Function</option>
                    <option value="sql">SQL Query</option>
                    <option value="api">API Call</option>
                    <option value="script">Script</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={newTool.description}
                  onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
                  placeholder="Description of what this tool does"
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Implementation</label>
                <textarea
                  value={newTool.implementation}
                  onChange={(e) => setNewTool({ ...newTool, implementation: e.target.value })}
                  placeholder={
                    newTool.implementation_type === 'function' 
                      ? 'return { result: parameters.input * 2 };'
                      : newTool.implementation_type === 'sql'
                      ? 'SELECT * FROM table WHERE id = $1'
                      : 'https://api.example.com/endpoint'
                  }
                  className="w-full h-32 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Input Schema (JSON)</label>
                  <textarea
                    value={newTool.input_schema}
                    onChange={(e) => setNewTool({ ...newTool, input_schema: e.target.value })}
                    placeholder='{"type": "object", "properties": {"input": {"type": "string"}}}'
                    className="w-full h-24 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Output Schema (JSON)</label>
                  <textarea
                    value={newTool.output_schema}
                    onChange={(e) => setNewTool({ ...newTool, output_schema: e.target.value })}
                    placeholder='{"type": "object", "properties": {"result": {"type": "string"}}}'
                    className="w-full h-24 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Rate Limit (per hour)</label>
                <input
                  type="number"
                  value={newTool.rate_limit}
                  onChange={(e) => setNewTool({ ...newTool, rate_limit: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateTool}
                disabled={!newTool.tool_name.trim() || !newTool.description.trim() || !newTool.implementation.trim() || createToolMutation.isPending}
              >
                {createToolMutation.isPending ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Tool
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
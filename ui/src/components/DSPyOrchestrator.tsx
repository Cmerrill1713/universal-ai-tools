import React, { useState, useCallback, useEffect } from 'react';
import { Card } from './Card';
import { Select } from './Select';
import { Button } from './Button';
import { 
  orchestrationApi, 
  agentsApi, 
  OrchestrationRequest, 
  OrchestrationResponse,
  AgentItem 
} from '../lib/api';
import { cn } from '../lib/utils';

// Types for the component
interface OrchestrationResult extends OrchestrationResponse {
  timestamp?: Date;
}

interface KnowledgeResult {
  success: boolean;
  operation: string;
  result: any;
  timestamp?: Date;
}

interface CoordinationResult {
  success: boolean;
  selectedAgents: string;
  coordinationPlan: string;
  assignments: any[];
  timestamp?: Date;
}

interface PromptOptimizationResult {
  success: boolean;
  optimized: boolean;
  improvements: string[];
  performanceGain: number;
  timestamp?: Date;
}

type ActiveTab = 'orchestration' | 'coordination' | 'knowledge' | 'optimization';

export function DSPyOrchestrator() {
  // State management
  const [activeTab, setActiveTab] = useState<ActiveTab>('orchestration');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Orchestration state
  const [userRequest, setUserRequest] = useState('');
  const [orchestrationMode, setOrchestrationMode] = useState<'simple' | 'standard' | 'cognitive' | 'adaptive'>('standard');
  const [context, setContext] = useState('{}');
  const [orchestrationResult, setOrchestrationResult] = useState<OrchestrationResult | null>(null);
  
  // Agent coordination state
  const [availableAgents, setAvailableAgents] = useState<AgentItem[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [coordinationTask, setCoordinationTask] = useState('');
  const [coordinationResult, setCoordinationResult] = useState<CoordinationResult | null>(null);
  
  // Knowledge management state
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeContent, setKnowledgeContent] = useState('');
  const [knowledgeFilters, setKnowledgeFilters] = useState('{}');
  const [knowledgeLimit, setKnowledgeLimit] = useState(10);
  const [existingKnowledge, setExistingKnowledge] = useState('');
  const [newInformation, setNewInformation] = useState('');
  const [knowledgeResult, setKnowledgeResult] = useState<KnowledgeResult | null>(null);
  
  // Prompt optimization state
  const [optimizationExamples, setOptimizationExamples] = useState(`[
  {
    "input": "What is the weather like?",
    "output": "Please provide your location so I can give you accurate weather information.",
    "metadata": { "type": "clarification" }
  }
]`);
  const [optimizationResult, setOptimizationResult] = useState<PromptOptimizationResult | null>(null);

  // Load available agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const agents = await agentsApi.list();
        setAvailableAgents(agents);
      } catch (err) {
        console.error('Failed to load agents:', err);
      }
    };
    loadAgents();
  }, []);

  // Helper function to parse JSON safely
  const parseJSON = (jsonString: string, fallback: any = {}) => {
    try {
      return JSON.parse(jsonString);
    } catch {
      return fallback;
    }
  };

  // Orchestration handlers
  const handleOrchestration = useCallback(async () => {
    if (!userRequest.trim()) {
      setError('Please enter a user request');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const request: OrchestrationRequest = {
        userRequest: userRequest.trim(),
        orchestrationMode,
        context: parseJSON(context),
        conversationId: 'dspy-orchestrator',
        sessionId: `session-${Date.now()}`
      };

      const result = await orchestrationApi.orchestrate(request);
      setOrchestrationResult({
        ...result,
        timestamp: new Date()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Orchestration failed');
    } finally {
      setLoading(false);
    }
  }, [userRequest, orchestrationMode, context]);

  // Agent coordination handlers
  const handleCoordination = useCallback(async () => {
    if (!coordinationTask.trim()) {
      setError('Please enter a task for coordination');
      return;
    }

    if (selectedAgents.length === 0) {
      setError('Please select at least one agent');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await orchestrationApi.coordinate(
        coordinationTask.trim(),
        selectedAgents,
        {}
      );
      setCoordinationResult({
        ...result,
        timestamp: new Date()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coordination failed');
    } finally {
      setLoading(false);
    }
  }, [coordinationTask, selectedAgents]);

  // Knowledge management handlers
  const handleKnowledgeSearch = useCallback(async () => {
    if (!knowledgeQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await orchestrationApi.searchKnowledge(
        knowledgeQuery.trim(),
        parseJSON(knowledgeFilters),
        knowledgeLimit
      );
      setKnowledgeResult({
        ...result,
        timestamp: new Date()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Knowledge search failed');
    } finally {
      setLoading(false);
    }
  }, [knowledgeQuery, knowledgeFilters, knowledgeLimit]);

  const handleKnowledgeExtraction = useCallback(async () => {
    if (!knowledgeContent.trim()) {
      setError('Please enter content for knowledge extraction');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await orchestrationApi.extractKnowledge(
        knowledgeContent.trim(),
        {}
      );
      setKnowledgeResult({
        ...result,
        timestamp: new Date()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Knowledge extraction failed');
    } finally {
      setLoading(false);
    }
  }, [knowledgeContent]);

  const handleKnowledgeEvolution = useCallback(async () => {
    if (!existingKnowledge.trim() || !newInformation.trim()) {
      setError('Please enter both existing knowledge and new information');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await orchestrationApi.evolveKnowledge(
        existingKnowledge.trim(),
        newInformation.trim()
      );
      setKnowledgeResult({
        ...result,
        timestamp: new Date()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Knowledge evolution failed');
    } finally {
      setLoading(false);
    }
  }, [existingKnowledge, newInformation]);

  // Prompt optimization handler
  const handlePromptOptimization = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const examples = parseJSON(optimizationExamples, []);
      if (!Array.isArray(examples) || examples.length === 0) {
        throw new Error('Please provide valid examples array');
      }

      const result = await orchestrationApi.optimizePrompts(examples);
      setOptimizationResult({
        ...result,
        timestamp: new Date()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prompt optimization failed');
    } finally {
      setLoading(false);
    }
  }, [optimizationExamples]);

  // Agent selection toggle
  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  // Tab navigation
  const tabs = [
    { id: 'orchestration' as const, label: 'Orchestration', icon: '🎯' },
    { id: 'coordination' as const, label: 'Agent Coordination', icon: '🤝' },
    { id: 'knowledge' as const, label: 'Knowledge Management', icon: '🧠' },
    { id: 'optimization' as const, label: 'Prompt Optimization', icon: '⚡' }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">
          DSPy Orchestration Interface
        </h1>
        <p className="text-gray-400">
          Advanced AI orchestration, coordination, and optimization platform
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 justify-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              'flex items-center gap-2',
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-500 bg-red-900/20">
          <div className="p-4">
            <div className="flex items-center gap-2 text-red-400">
              <span>❌</span>
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-300 mt-1">{error}</p>
          </div>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">
              {tabs.find(t => t.id === activeTab)?.label} Input
            </h2>

            {/* Orchestration Tab */}
            {activeTab === 'orchestration' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    User Request
                  </label>
                  <textarea
                    value={userRequest}
                    onChange={(e) => setUserRequest(e.target.value)}
                    placeholder="Enter your request for the AI orchestrator..."
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Orchestration Mode
                  </label>
                  <Select
                    value={orchestrationMode}
                    onChange={(value) => setOrchestrationMode(value as any)}
                    options={[
                      { value: 'simple', label: 'Simple - Basic orchestration' },
                      { value: 'standard', label: 'Standard - Balanced approach' },
                      { value: 'cognitive', label: 'Cognitive - Advanced reasoning' },
                      { value: 'adaptive', label: 'Adaptive - Learning-based' }
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Context (JSON)
                  </label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                <Button
                  onClick={handleOrchestration}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Orchestrating...' : 'Execute Orchestration'}
                </Button>
              </div>
            )}

            {/* Coordination Tab */}
            {activeTab === 'coordination' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Task Description
                  </label>
                  <textarea
                    value={coordinationTask}
                    onChange={(e) => setCoordinationTask(e.target.value)}
                    placeholder="Describe the task that needs agent coordination..."
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Available Agents ({availableAgents.length})
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {availableAgents.map((agent) => (
                      <label
                        key={agent.id}
                        className="flex items-center gap-3 p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAgents.includes(agent.id)}
                          onChange={() => toggleAgentSelection(agent.id)}
                          className="rounded border-gray-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-200">{agent.name}</div>
                          <div className="text-xs text-gray-400 truncate">{agent.description}</div>
                        </div>
                        <div className="flex gap-1">
                          {agent.capabilities.slice(0, 2).map((cap, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-blue-600 text-blue-100 px-1 py-0.5 rounded"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleCoordination}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Coordinating...' : 'Coordinate Agents'}
                </Button>
              </div>
            )}

            {/* Knowledge Tab */}
            {activeTab === 'knowledge' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={handleKnowledgeSearch}
                    disabled={loading}
                    variant="outline"
                  >
                    Search Knowledge
                  </Button>
                  <Button
                    onClick={handleKnowledgeExtraction}
                    disabled={loading}
                    variant="outline"
                  >
                    Extract Knowledge
                  </Button>
                  <Button
                    onClick={handleKnowledgeEvolution}
                    disabled={loading}
                    variant="outline"
                  >
                    Evolve Knowledge
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Search Query
                  </label>
                  <input
                    type="text"
                    value={knowledgeQuery}
                    onChange={(e) => setKnowledgeQuery(e.target.value)}
                    placeholder="Enter search query..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Content for Extraction
                  </label>
                  <textarea
                    value={knowledgeContent}
                    onChange={(e) => setKnowledgeContent(e.target.value)}
                    placeholder="Enter content to extract knowledge from..."
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Existing Knowledge
                    </label>
                    <textarea
                      value={existingKnowledge}
                      onChange={(e) => setExistingKnowledge(e.target.value)}
                      placeholder="Enter existing knowledge to evolve..."
                      rows={2}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      New Information
                    </label>
                    <textarea
                      value={newInformation}
                      onChange={(e) => setNewInformation(e.target.value)}
                      placeholder="Enter new information to integrate..."
                      rows={2}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Filters (JSON)
                    </label>
                    <input
                      type="text"
                      value={knowledgeFilters}
                      onChange={(e) => setKnowledgeFilters(e.target.value)}
                      placeholder="{}"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Limit
                    </label>
                    <input
                      type="number"
                      value={knowledgeLimit}
                      onChange={(e) => setKnowledgeLimit(parseInt(e.target.value) || 10)}
                      min="1"
                      max="100"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Optimization Tab */}
            {activeTab === 'optimization' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Training Examples (JSON Array)
                  </label>
                  <textarea
                    value={optimizationExamples}
                    onChange={(e) => setOptimizationExamples(e.target.value)}
                    placeholder={'[{"input": "...", "output": "..."}]'}
                    rows={8}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                <div className="text-sm text-gray-400">
                  <p>📝 Provide input/output examples for MIPROv2 prompt optimization.</p>
                  <p>Each example should have "input", "output", and optional "metadata" fields.</p>
                </div>

                <Button
                  onClick={handlePromptOptimization}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Optimizing...' : 'Optimize Prompts'}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Results Panel */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">
              Results & Metrics
            </h2>

            {/* Orchestration Results */}
            {activeTab === 'orchestration' && orchestrationResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Status</span>
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    orchestrationResult.success 
                      ? 'bg-green-600 text-green-100' 
                      : 'bg-red-600 text-red-100'
                  )}>
                    {orchestrationResult.success ? 'Success' : 'Failed'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Mode:</span>
                    <span className="text-gray-200 ml-2">{orchestrationResult.mode}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Confidence:</span>
                    <span className="text-gray-200 ml-2">{(orchestrationResult.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Execution Time:</span>
                    <span className="text-gray-200 ml-2">{orchestrationResult.executionTime}ms</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Request ID:</span>
                    <span className="text-gray-200 ml-2 font-mono text-xs">{orchestrationResult.requestId.slice(0, 8)}...</span>
                  </div>
                </div>

                {orchestrationResult.participatingAgents.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-300">Participating Agents:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {orchestrationResult.participatingAgents.map((agent, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-blue-600 text-blue-100 px-2 py-1 rounded"
                        >
                          {agent}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {orchestrationResult.reasoning && (
                  <div>
                    <span className="text-sm font-medium text-gray-300">Reasoning:</span>
                    <p className="text-sm text-gray-400 mt-1">{orchestrationResult.reasoning}</p>
                  </div>
                )}

                <div>
                  <span className="text-sm font-medium text-gray-300">Response Data:</span>
                  <pre className="bg-gray-900 rounded p-3 text-xs text-gray-300 overflow-auto max-h-64 mt-1">
                    {JSON.stringify(orchestrationResult.data, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Coordination Results */}
            {activeTab === 'coordination' && coordinationResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Status</span>
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    coordinationResult.success 
                      ? 'bg-green-600 text-green-100' 
                      : 'bg-red-600 text-red-100'
                  )}>
                    {coordinationResult.success ? 'Success' : 'Failed'}
                  </span>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-300">Selected Agents:</span>
                  <p className="text-sm text-gray-400 mt-1">{coordinationResult.selectedAgents}</p>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-300">Coordination Plan:</span>
                  <p className="text-sm text-gray-400 mt-1">{coordinationResult.coordinationPlan}</p>
                </div>

                {coordinationResult.assignments.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-300">Agent Assignments:</span>
                    <div className="space-y-2 mt-1">
                      {coordinationResult.assignments.map((assignment, idx) => (
                        <div key={idx} className="bg-gray-700 rounded p-2 text-sm">
                          <pre className="text-gray-300">{JSON.stringify(assignment, null, 2)}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Knowledge Results */}
            {activeTab === 'knowledge' && knowledgeResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Status</span>
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    knowledgeResult.success 
                      ? 'bg-green-600 text-green-100' 
                      : 'bg-red-600 text-red-100'
                  )}>
                    {knowledgeResult.success ? 'Success' : 'Failed'}
                  </span>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-300">Operation:</span>
                  <span className="text-gray-200 ml-2">{knowledgeResult.operation}</span>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-300">Results:</span>
                  <pre className="bg-gray-900 rounded p-3 text-xs text-gray-300 overflow-auto max-h-64 mt-1">
                    {JSON.stringify(knowledgeResult.result, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Optimization Results */}
            {activeTab === 'optimization' && optimizationResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Status</span>
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    optimizationResult.success 
                      ? 'bg-green-600 text-green-100' 
                      : 'bg-red-600 text-red-100'
                  )}>
                    {optimizationResult.success ? 'Success' : 'Failed'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Optimized:</span>
                    <span className="text-gray-200 ml-2">{optimizationResult.optimized ? 'Yes' : 'No'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Performance Gain:</span>
                    <span className="text-gray-200 ml-2">{optimizationResult.performanceGain.toFixed(2)}%</span>
                  </div>
                </div>

                {optimizationResult.improvements.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-300">Improvements:</span>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      {optimizationResult.improvements.map((improvement, idx) => (
                        <li key={idx} className="text-sm text-gray-400">{improvement}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* No Results */}
            {!orchestrationResult && !coordinationResult && !knowledgeResult && !optimizationResult && (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-2">🎯</div>
                <p className="text-gray-400">Execute an operation to see results here</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Performance Metrics Summary */}
      {(orchestrationResult || coordinationResult || knowledgeResult || optimizationResult) && (
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-3">Performance Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {orchestrationResult ? `${orchestrationResult.executionTime}ms` : '--'}
                </div>
                <div className="text-gray-400">Execution Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {orchestrationResult ? `${(orchestrationResult.confidence * 100).toFixed(0)}%` : '--'}
                </div>
                <div className="text-gray-400">Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {orchestrationResult?.participatingAgents.length || coordinationResult?.assignments.length || '--'}
                </div>
                <div className="text-gray-400">Agents Used</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {optimizationResult ? `+${optimizationResult.performanceGain.toFixed(1)}%` : '--'}
                </div>
                <div className="text-gray-400">Optimization Gain</div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default DSPyOrchestrator;
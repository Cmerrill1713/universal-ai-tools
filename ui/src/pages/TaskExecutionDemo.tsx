import React, { useState, useEffect } from 'react';
import * as Icons from '@untitled-ui/icons-react';
import { 
  View, 
  Flex, 
  Text, 
  ActionButton,
  ProgressCircle,
  Well,
  Heading,
  Divider,
  Badge,
  Picker,
  Item,
  TextArea,
  Button,
  StatusLight
} from '@adobe/react-spectrum';
import { api } from '../lib/api-enhanced';

interface Agent {
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  loaded: boolean;
}

interface TaskResult {
  id: string;
  agentName: string;
  userRequest: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export default function TaskExecutionDemo() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState('');
  const [tasks, setTasks] = useState<TaskResult[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available agents from backend
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await api.getAgents();
      if (response.success && response.data?.agents) {
        setAgents(response.data.agents);
        if (response.data.agents.length > 0 && !selectedAgent) {
          setSelectedAgent(response.data.agents[0].name);
        }
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
      setError('Failed to load agents from backend');
    } finally {
      setLoading(false);
    }
  };

  const executeTask = async () => {
    if (!taskDescription.trim() || !selectedAgent || isExecuting) return;

    const taskId = Date.now().toString();
    const newTask: TaskResult = {
      id: taskId,
      agentName: selectedAgent,
      userRequest: taskDescription.trim(),
      status: 'pending',
      startTime: new Date()
    };

    setTasks(prev => [newTask, ...prev]);
    setTaskDescription('');
    setIsExecuting(true);
    setError(null);

    try {
      // Update task to running
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: 'running' as const }
          : task
      ));

      // Execute task via backend API
      const response = await api.executeAgent(selectedAgent, {
        userRequest: taskDescription.trim(),
        requestId: taskId
      });

      if (response.success) {
        setTasks(prev => prev.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                status: 'completed' as const,
                result: response.data,
                endTime: new Date()
              }
            : task
        ));
      } else {
        throw new Error(response.error || 'Task execution failed');
      }

    } catch (error) {
      console.error('Task execution failed:', error);
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status: 'failed' as const,
              error: error instanceof Error ? error.message : 'Unknown error',
              endTime: new Date()
            }
          : task
      ));
    } finally {
      setIsExecuting(false);
    }
  };

  const clearTasks = () => {
    setTasks([]);
  };

  const getStatusBadge = (status: TaskResult['status']) => {
    const variants = {
      pending: 'neutral' as const,
      running: 'info' as const,
      completed: 'positive' as const,
      failed: 'negative' as const
    };
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  const getStatusIcon = (status: TaskResult['status']) => {
    switch (status) {
      case 'pending':
        return <Icons.Clock size={16} color="#6b7280" />;
      case 'running':
        return <ProgressCircle size="S" isIndeterminate />;
      case 'completed':
        return <Icons.CheckCircle size={16} color="#10b981" />;
      case 'failed':
        return <Icons.XCircle size={16} color="#ef4444" />;
    }
  };

  if (loading) {
    return (
      <View padding="size-400">
        <Flex direction="column" alignItems="center" gap="size-300" padding="size-600">
          <ProgressCircle size="L" isIndeterminate />
          <Text>Loading agents from backend...</Text>
        </Flex>
      </View>
    );
  }

  return (
    <View padding="size-400">
      <Flex direction="column" gap="size-400">
        
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap="size-200">
            <Icons.PlayCircle size={24} color="#3b82f6" />
            <Heading level={2}>Agent Task Execution</Heading>
            <StatusLight variant={agents.length > 0 ? 'positive' : 'negative'}>
              <Text>{agents.length} agents available</Text>
            </StatusLight>
          </Flex>
          
          <Flex alignItems="center" gap="size-200">
            <ActionButton
              isQuiet
              onPress={loadAgents}
              aria-label="Refresh agents"
            >
              <Icons.RefreshCcw01 size={20} />
              <Text>Refresh</Text>
            </ActionButton>
            
            <ActionButton
              isQuiet
              onPress={clearTasks}
              isDisabled={tasks.length === 0}
              aria-label="Clear all tasks"
            >
              <Icons.Trash01 size={20} />
              <Text>Clear</Text>
            </ActionButton>
          </Flex>
        </Flex>

        <Divider />

        {/* Error Display */}
        {error && (
          <Well>
            <Flex alignItems="center" gap="size-200">
              <Icons.AlertTriangle size={20} color="#ef4444" />
              <Text>{error}</Text>
              <ActionButton
                isQuiet
                onPress={() => setError(null)}
                aria-label="Dismiss error"
              >
                <Icons.X size={16} />
              </ActionButton>
            </Flex>
          </Well>
        )}

        {/* Task Creation Form */}
        <Well>
          <Flex direction="column" gap="size-300">
            <Heading level={3}>Execute Agent Task</Heading>
            
            <Flex gap="size-300" wrap="wrap">
              <View flex="1" minWidth="300px">
                <Text UNSAFE_style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Select Agent:
                </Text>
                <Picker
                  selectedKey={selectedAgent}
                  onSelectionChange={(key) => setSelectedAgent(key as string)}
                  width="100%"
                  isDisabled={agents.length === 0}
                >
                  {agents.map(agent => (
                    <Item key={agent.name} textValue={agent.name}>
                      <Flex direction="column">
                        <Flex alignItems="center" gap="size-100">
                          <Text>{agent.name}</Text>
                          {agent.loaded && <Badge variant="positive">Loaded</Badge>}
                        </Flex>
                        <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {agent.description}
                        </Text>
                        <Text UNSAFE_style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                          {agent.capabilities.slice(0, 3).join(', ')}
                        </Text>
                      </Flex>
                    </Item>
                  ))}
                </Picker>
              </View>
              
              <View flex="2" minWidth="400px">
                <Text UNSAFE_style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Task Request:
                </Text>
                <TextArea
                  value={taskDescription}
                  onChange={setTaskDescription}
                  placeholder="Enter your task request for the agent..."
                  width="100%"
                  height="size-1000"
                />
              </View>
            </Flex>
            
            <Flex justifyContent="flex-end" alignItems="center" gap="size-200">
              <Button
                variant="accent"
                onPress={executeTask}
                isDisabled={!taskDescription.trim() || !selectedAgent || isExecuting || agents.length === 0}
              >
                {isExecuting ? (
                  <>
                    <ProgressCircle size="S" isIndeterminate />
                    <Text>Executing...</Text>
                  </>
                ) : (
                  <>
                    <Icons.Play size={16} />
                    <Text>Execute Task</Text>
                  </>
                )}
              </Button>
            </Flex>
          </Flex>
        </Well>

        {/* Task Results */}
        <View>
          <Heading level={3} marginBottom="size-200">Task Results</Heading>
          
          {tasks.length === 0 ? (
            <Well>
              <Flex direction="column" alignItems="center" gap="size-200" padding="size-600">
                <Icons.Inbox size={48} color="#6b7280" />
                <Text UNSAFE_style={{ color: '#6b7280' }}>
                  No tasks executed yet. Create a task above to get started.
                </Text>
              </Flex>
            </Well>
          ) : (
            <Flex direction="column" gap="size-200">
              {tasks.map(task => (
                <View
                  key={task.id}
                  backgroundColor="gray-50"
                  borderRadius="medium"
                  padding="size-300"
                  borderWidth="thin"
                  borderColor="gray-300"
                >
                  <Flex direction="column" gap="size-200">
                    
                    {/* Task Header */}
                    <Flex justifyContent="space-between" alignItems="center">
                      <Flex alignItems="center" gap="size-200">
                        {getStatusIcon(task.status)}
                        <Text UNSAFE_style={{ fontWeight: 'bold' }}>
                          {task.agentName}
                        </Text>
                        {getStatusBadge(task.status)}
                      </Flex>
                      
                      <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {task.startTime.toLocaleTimeString()}
                        {task.endTime && ` - ${task.endTime.toLocaleTimeString()}`}
                      </Text>
                    </Flex>
                    
                    {/* Task Request */}
                    <View backgroundColor="gray-100" padding="size-200" borderRadius="small">
                      <Text UNSAFE_style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                        Request:
                      </Text>
                      <Text>{task.userRequest}</Text>
                    </View>
                    
                    {/* Task Result */}
                    {task.result && (
                      <View backgroundColor="green-100" padding="size-200" borderRadius="small">
                        <Text UNSAFE_style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                          Result:
                        </Text>
                        <Text UNSAFE_style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                          {typeof task.result === 'string' ? task.result : JSON.stringify(task.result, null, 2)}
                        </Text>
                      </View>
                    )}
                    
                    {/* Task Error */}
                    {task.error && (
                      <View backgroundColor="red-100" padding="size-200" borderRadius="small">
                        <Text UNSAFE_style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                          Error:
                        </Text>
                        <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#dc2626' }}>
                          {task.error}
                        </Text>
                      </View>
                    )}
                  </Flex>
                </View>
              ))}
            </Flex>
          )}
        </View>
      </Flex>
    </View>
  );
}
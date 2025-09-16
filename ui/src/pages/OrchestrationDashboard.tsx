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
  StatusLight,
  Grid,
  TextArea,
  TextField,
  Button,
  NumberField,
  Checkbox,
  Slider,
  ProgressBar
} from '@adobe/react-spectrum';
import { api } from '../lib/api-enhanced';

interface OrchestrationTask {
  id: string;
  userRequest: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: Date;
  endTime?: Date;
  result?: any;
  options: any;
  feedback?: {
    rating: number;
    comment?: string;
  };
}

interface OrchestrationOptions {
  useCache: boolean;
  enableParallelism: boolean;
  collectFeedback: boolean;
  saveCheckpoints: boolean;
  visualize: boolean;
  verboseLogging: boolean;
  fallbackStrategy: 'greedy' | 'random' | 'fixed';
  explorationRate: number;
  maxIterations: number;
}

export default function OrchestrationDashboard() {
  const [tasks, setTasks] = useState<OrchestrationTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Task Creation
  const [userRequest, setUserRequest] = useState('');
  const [options, setOptions] = useState<OrchestrationOptions>({
    useCache: true,
    enableParallelism: true,
    collectFeedback: false,
    saveCheckpoints: true,
    visualize: false,
    verboseLogging: false,
    fallbackStrategy: 'greedy',
    explorationRate: 0.3,
    maxIterations: 100
  });
  
  // Feedback
  const [feedbackTask, setFeedbackTask] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');

  useEffect(() => {
    loadOrchestrationHistory();
  }, []);

  const loadOrchestrationHistory = async () => {
    try {
      setError(null);
      const response = await api.getOrchestrationHistory();
      
      if (response.success && response.data && Array.isArray(response.data)) {
        const historyTasks = response.data.map((task: any, index: number) => ({
          id: task.id || `task-${index}`,
          userRequest: task.userRequest || task.request || 'Unknown request',
          status: task.status || 'completed',
          progress: task.progress || 100,
          startTime: new Date(task.startTime || Date.now()),
          endTime: task.endTime ? new Date(task.endTime) : undefined,
          result: task.result,
          options: task.options || {},
          feedback: task.feedback
        }));
        setTasks(historyTasks);
      }
    } catch (error) {
      console.error('Failed to load orchestration history:', error);
      setError('Failed to load orchestration history');
    }
  };

  const startOrchestration = async () => {
    if (!userRequest.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.orchestrateTask(userRequest, options);
      
      const newTask: OrchestrationTask = {
        id: response.orchestrationId || Date.now().toString(),
        userRequest,
        status: 'queued',
        progress: 0,
        startTime: new Date(),
        options: { ...options }
      };

      setTasks(prev => [newTask, ...prev]);
      setUserRequest('');
      
      // Start polling for status updates
      pollTaskStatus(newTask.id);
    } catch (error) {
      setError('Failed to start orchestration. Please try again.');
      console.error('Orchestration error:', error);
    } finally {
      setLoading(false);
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    try {
      const response = await api.getOrchestrationStatus(taskId);
      
      if (response.success && response.data) {
        setTasks(prev => prev.map(task => 
          task.id === taskId 
            ? {
                ...task,
                status: response.data.status || task.status,
                progress: response.data.progress || task.progress,
                result: response.data.result || task.result,
                endTime: response.data.status === 'completed' || response.data.status === 'failed' 
                  ? new Date() : task.endTime
              }
            : task
        ));
        
        // Continue polling if still running
        if (response.data.status === 'running' || response.data.status === 'queued') {
          setTimeout(() => pollTaskStatus(taskId), 2000);
        }
      }
    } catch (error) {
      console.error('Failed to poll task status:', error);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackTask) return;

    try {
      await api.submitFeedback(feedbackTask, feedbackRating, feedbackComment);
      
      setTasks(prev => prev.map(task => 
        task.id === feedbackTask 
          ? {
              ...task,
              feedback: {
                rating: feedbackRating,
                comment: feedbackComment || undefined
              }
            }
          : task
      ));
      
      setFeedbackTask(null);
      setFeedbackComment('');
      setFeedbackRating(5);
    } catch (error) {
      setError('Failed to submit feedback');
      console.error('Feedback error:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Icons.Clock size={16} color="#f59e0b" />;
      case 'running':
        return <ProgressCircle size="S" isIndeterminate />;
      case 'completed':
        return <Icons.CheckCircle size={16} color="#10b981" />;
      case 'failed':
        return <Icons.XCircle size={16} color="#ef4444" />;
      default:
        return <Icons.Clock size={16} color="#6b7280" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      queued: 'notice' as const,
      running: 'info' as const,
      completed: 'positive' as const,
      failed: 'negative' as const
    };
    return <Badge variant={variants[status as keyof typeof variants] || 'neutral'}>{status.toUpperCase()}</Badge>;
  };

  const renderStars = (rating: number, onRate?: (rating: number) => void) => {
    return (
      <Flex gap="size-50">
        {[1, 2, 3, 4, 5].map(star => (
          <Icons.Star01
            key={star}
            size={16}
            color={star <= rating ? "#f59e0b" : "#d1d5db"}
            style={{ cursor: onRate ? 'pointer' : 'default' }}
            onClick={() => onRate?.(star)}
          />
        ))}
      </Flex>
    );
  };

  return (
    <View padding="size-400">
      <Flex direction="column" gap="size-400">
        
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap="size-200">
            <Icons.GitBranch01 size={24} color="#3b82f6" />
            <Heading level={2}>AB-MCTS Orchestration</Heading>
            <StatusLight variant="positive">
              <Text>Probabilistic Coordination Active</Text>
            </StatusLight>
          </Flex>
          
          <Flex alignItems="center" gap="size-200">
            <ActionButton
              isQuiet
              onPress={loadOrchestrationHistory}
              aria-label="Refresh history"
            >
              <Icons.RefreshCcw01 size={20} />
              <Text>Refresh</Text>
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

        {/* Task Creation */}
        <Well>
          <Flex direction="column" gap="size-300">
            <Heading level={3}>Create Orchestration Task</Heading>
            <Text>Submit a complex request for AB-MCTS probabilistic agent coordination.</Text>
            
            <TextArea
              value={userRequest}
              onChange={setUserRequest}
              label="Task Description"
              description="Describe the complex task you want to orchestrate across multiple agents"
              width="100%"
              height="size-1000"
            />
            
            {/* Orchestration Options */}
            <View>
              <Heading level={4} marginBottom="size-200">Orchestration Options</Heading>
              <Grid columns={['1fr', '1fr']} gap="size-300">
                <Flex direction="column" gap="size-200">
                  <Checkbox
                    isSelected={options.useCache}
                    onChange={(checked) => setOptions(prev => ({ ...prev, useCache: checked }))}
                  >
                    Use Cache
                  </Checkbox>
                  <Checkbox
                    isSelected={options.enableParallelism}
                    onChange={(checked) => setOptions(prev => ({ ...prev, enableParallelism: checked }))}
                  >
                    Enable Parallelism
                  </Checkbox>
                  <Checkbox
                    isSelected={options.collectFeedback}
                    onChange={(checked) => setOptions(prev => ({ ...prev, collectFeedback: checked }))}
                  >
                    Collect Feedback
                  </Checkbox>
                  <Checkbox
                    isSelected={options.saveCheckpoints}
                    onChange={(checked) => setOptions(prev => ({ ...prev, saveCheckpoints: checked }))}
                  >
                    Save Checkpoints
                  </Checkbox>
                </Flex>
                
                <Flex direction="column" gap="size-200">
                  <View>
                    <Text UNSAFE_style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      Exploration Rate: {options.explorationRate}
                    </Text>
                    <Slider
                      value={options.explorationRate}
                      onChange={(value) => setOptions(prev => ({ ...prev, explorationRate: value }))}
                      minValue={0}
                      maxValue={1}
                      step={0.1}
                    />
                  </View>
                  
                  <NumberField
                    label="Max Iterations"
                    value={options.maxIterations}
                    onChange={(value) => setOptions(prev => ({ ...prev, maxIterations: value }))}
                    minValue={10}
                    maxValue={1000}
                  />
                </Flex>
              </Grid>
            </View>
            
            <Button
              variant="primary"
              onPress={startOrchestration}
              isDisabled={!userRequest.trim() || loading}
            >
              {loading ? (
                <>
                  <ProgressCircle size="S" isIndeterminate />
                  <Text>Starting Orchestration...</Text>
                </>
              ) : (
                <>
                  <Icons.Play size={16} />
                  <Text>Start Orchestration</Text>
                </>
              )}
            </Button>
          </Flex>
        </Well>

        {/* Orchestration Tasks */}
        <View>
          <Heading level={3} marginBottom="size-200">Orchestration History ({tasks.length})</Heading>
          {tasks.length > 0 ? (
            <Flex direction="column" gap="size-300">
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
                          Task {task.id.slice(-6)}
                        </Text>
                        {getStatusBadge(task.status)}
                      </Flex>
                      
                      <Flex alignItems="center" gap="size-200">
                        {task.feedback ? (
                          <Flex alignItems="center" gap="size-100">
                            {renderStars(task.feedback.rating)}
                            <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              Rated
                            </Text>
                          </Flex>
                        ) : task.status === 'completed' && (
                          <ActionButton
                            isQuiet
                            onPress={() => setFeedbackTask(task.id)}
                            aria-label="Rate task"
                          >
                            <Icons.Star01 size={16} />
                            <Text>Rate</Text>
                          </ActionButton>
                        )}
                        
                        <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {task.startTime.toLocaleString()}
                        </Text>
                      </Flex>
                    </Flex>
                    
                    {/* Task Request */}
                    <View backgroundColor="gray-100" padding="size-200" borderRadius="small">
                      <Text UNSAFE_style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                        Request:
                      </Text>
                      <Text>{task.userRequest}</Text>
                    </View>
                    
                    {/* Progress Bar */}
                    {(task.status === 'running' || task.status === 'queued') && (
                      <View>
                        <Flex justifyContent="space-between" alignItems="center" marginBottom="size-100">
                          <Text UNSAFE_style={{ fontSize: '0.875rem' }}>Progress</Text>
                          <Text UNSAFE_style={{ fontSize: '0.875rem' }}>{task.progress}%</Text>
                        </Flex>
                        <ProgressBar 
                          value={task.progress} 
                          minValue={0} 
                          maxValue={100}
                          variant="info"
                        />
                      </View>
                    )}
                    
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
                    
                    {/* Orchestration Options Display */}
                    <Flex gap="size-100" wrap="wrap">
                      {Object.entries(task.options).map(([key, value]) => {
                        if (typeof value === 'boolean' && value) {
                          return (
                            <Badge key={key} variant="neutral" UNSAFE_style={{ fontSize: '0.75rem' }}>
                              {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </Badge>
                          );
                        }
                        if (typeof value === 'number') {
                          return (
                            <Badge key={key} variant="info" UNSAFE_style={{ fontSize: '0.75rem' }}>
                              {key}: {value}
                            </Badge>
                          );
                        }
                        return null;
                      })}
                    </Flex>
                  </Flex>
                </View>
              ))}
            </Flex>
          ) : (
            <Well>
              <Flex direction="column" alignItems="center" gap="size-200" padding="size-400">
                <Icons.GitBranch01 size={48} color="#6b7280" />
                <Text UNSAFE_style={{ color: '#6b7280' }}>
                  No orchestration tasks yet. Create your first task to see AB-MCTS in action!
                </Text>
              </Flex>
            </Well>
          )}
        </View>

        {/* Feedback Modal */}
        {feedbackTask && (
          <Well>
            <Flex direction="column" gap="size-300">
              <Heading level={4}>Rate Orchestration Task</Heading>
              <Text>How would you rate the quality of this orchestration result?</Text>
              
              <Flex alignItems="center" gap="size-200">
                <Text>Rating:</Text>
                {renderStars(feedbackRating, setFeedbackRating)}
              </Flex>
              
              <TextArea
                value={feedbackComment}
                onChange={setFeedbackComment}
                label="Feedback Comments"
                description="Optional: Add comments about the orchestration quality"
                width="100%"
                height="size-800"
              />
              
              <Flex gap="size-200">
                <Button variant="primary" onPress={submitFeedback}>
                  <Icons.Send01 size={16} />
                  <Text>Submit Feedback</Text>
                </Button>
                <Button variant="secondary" onPress={() => setFeedbackTask(null)}>
                  <Text>Cancel</Text>
                </Button>
              </Flex>
            </Flex>
          </Well>
        )}

      </Flex>
    </View>
  );
}
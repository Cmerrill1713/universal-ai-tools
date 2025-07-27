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
  Tabs,
  TabList,
  Item,
  TabPanels,
  NumberField,
  Picker,
  ProgressBar,
  Meter
} from '@adobe/react-spectrum';
import { api } from '../lib/api-enhanced';

interface MLXModel {
  id: string;
  name: string;
  path: string;
  size: string;
  type: string;
  status: 'available' | 'loading' | 'error';
}

interface FineTuningJob {
  id: string;
  modelName: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: Date;
  endTime?: Date;
  config: any;
  results?: any;
}

interface InferenceResult {
  id: string;
  modelPath: string;
  prompt: string;
  response: string;
  timestamp: Date;
  processingTime: number;
  parameters: any;
}

export default function MLXTraining() {
  const [selectedTab, setSelectedTab] = useState<React.Key>('inference');
  const [models, setModels] = useState<MLXModel[]>([]);
  const [fineTuningJobs, setFineTuningJobs] = useState<FineTuningJob[]>([]);
  const [inferenceResults, setInferenceResults] = useState<InferenceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mlxHealth, setMLXHealth] = useState<any>(null);
  
  // Inference
  const [selectedModel, setSelectedModel] = useState('');
  const [inferencePrompt, setInferencePrompt] = useState('');
  const [maxTokens, setMaxTokens] = useState(100);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  
  // Fine-tuning
  const [baseModel, setBaseModel] = useState('');
  const [fineTuningData, setFineTuningData] = useState('');
  const [epochs, setEpochs] = useState(3);
  const [learningRate, setLearningRate] = useState(0.0001);
  const [batchSize, setBatchSize] = useState(4);

  useEffect(() => {
    loadMLXData();
  }, []);

  const loadMLXData = async () => {
    try {
      setError(null);
      
      // Check MLX health
      const health = await api.getMLXHealth();
      setMLXHealth(health);
      
      // Load available models
      const modelsResponse = await api.getMLXModels();
      if (modelsResponse.success && modelsResponse.data) {
        const modelList = modelsResponse.data.map((model: any, index: number) => ({
          id: `model-${index}`,
          name: model.name || `MLX Model ${index + 1}`,
          path: model.path || model.modelPath,
          size: model.size || 'Unknown',
          type: model.type || 'LLM',
          status: 'available' as const
        }));
        setModels(modelList);
        if (modelList.length > 0 && !selectedModel) {
          setSelectedModel(modelList[0].path);
          setBaseModel(modelList[0].path);
        }
      }
      
      // Load fine-tuning jobs
      const jobsResponse = await api.getFineTuningJobs();
      if (jobsResponse.success && jobsResponse.data) {
        const jobs = jobsResponse.data.map((job: any, index: number) => ({
          id: job.id || `job-${index}`,
          modelName: job.modelName || job.model || 'Unknown Model',
          status: job.status || 'queued',
          progress: job.progress || 0,
          startTime: new Date(job.startTime || Date.now()),
          endTime: job.endTime ? new Date(job.endTime) : undefined,
          config: job.config || {},
          results: job.results
        }));
        setFineTuningJobs(jobs);
      }
      
    } catch (error) {
      console.error('Failed to load MLX data:', error);
      setError('Failed to connect to MLX service. Ensure MLX is running on Apple Silicon.');
    }
  };

  const runInference = async () => {
    if (!selectedModel || !inferencePrompt.trim()) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const response = await api.mlxInference(selectedModel, inferencePrompt, {
        maxTokens,
        temperature,
        topP
      });

      const result: InferenceResult = {
        id: Date.now().toString(),
        modelPath: selectedModel,
        prompt: inferencePrompt,
        response: response.response || response.text || 'No response received',
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        parameters: { maxTokens, temperature, topP }
      };

      setInferenceResults(prev => [result, ...prev]);
      setInferencePrompt('');
    } catch (error) {
      setError('Inference failed. Please check the model and try again.');
      console.error('MLX inference error:', error);
    } finally {
      setLoading(false);
    }
  };

  const startFineTuning = async () => {
    if (!baseModel || !fineTuningData.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const config = {
        baseModel,
        trainingData: fineTuningData,
        parameters: {
          epochs,
          learningRate,
          batchSize
        }
      };

      const response = await api.mlxFineTune(config);

      const newJob: FineTuningJob = {
        id: response.jobId || Date.now().toString(),
        modelName: `Fine-tuned-${Date.now()}`,
        status: 'queued',
        progress: 0,
        startTime: new Date(),
        config
      };

      setFineTuningJobs(prev => [newJob, ...prev]);
      setFineTuningData('');
    } catch (error) {
      setError('Fine-tuning failed to start. Please check your configuration.');
      console.error('MLX fine-tuning error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
      case 'queued':
        return <ProgressCircle size="S" isIndeterminate />;
      case 'completed':
      case 'available':
        return <Icons.CheckCircle size={16} color="#10b981" />;
      case 'failed':
      case 'error':
        return <Icons.XCircle size={16} color="#ef4444" />;
      default:
        return <Icons.Clock size={16} color="#6b7280" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      available: 'positive' as const,
      loading: 'info' as const,
      queued: 'neutral' as const,
      running: 'info' as const,
      completed: 'positive' as const,
      failed: 'negative' as const,
      error: 'negative' as const
    };
    return <Badge variant={variants[status as keyof typeof variants] || 'neutral'}>{status.toUpperCase()}</Badge>;
  };

  return (
    <View padding="size-400">
      <Flex direction="column" gap="size-400">
        
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap="size-200">
            <Icons.CpuChip01 size={24} color="#3b82f6" />
            <Heading level={2}>MLX Training Studio</Heading>
            <StatusLight variant={mlxHealth?.healthy ? 'positive' : 'negative'}>
              <Text>{mlxHealth?.healthy ? 'MLX Ready' : 'Service Starting'}</Text>
            </StatusLight>
            {process.arch === 'arm64' && process.platform === 'darwin' && (
              <Badge variant="positive">Apple Silicon Optimized</Badge>
            )}
          </Flex>
          
          <Flex alignItems="center" gap="size-200">
            <ActionButton
              isQuiet
              onPress={loadMLXData}
              aria-label="Refresh data"
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

        {/* MLX Operations Tabs */}
        <View>
          <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab}>
            <TabList>
              <Item key="inference">
                <Flex alignItems="center" gap="size-100">
                  <Icons.Play size={16} />
                  <Text>Inference</Text>
                </Flex>
              </Item>
              <Item key="finetune">
                <Flex alignItems="center" gap="size-100">
                  <Icons.Settings01 size={16} />
                  <Text>Fine-Tuning</Text>
                </Flex>
              </Item>
              <Item key="models">
                <Flex alignItems="center" gap="size-100">
                  <Icons.Database01 size={16} />
                  <Text>Models</Text>
                </Flex>
              </Item>
            </TabList>
            
            <TabPanels>
              {/* Inference Panel */}
              <Item key="inference">
                <View padding="size-300">
                  <Flex direction="column" gap="size-300">
                    <Heading level={3}>Model Inference</Heading>
                    
                    <Well>
                      <Flex direction="column" gap="size-300">
                        <Text>Run inference on MLX-optimized models with custom parameters.</Text>
                        
                        <Grid columns={['1fr', '1fr']} gap="size-300">
                          <View>
                            <Text UNSAFE_style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                              Select Model:
                            </Text>
                            <Picker
                              selectedKey={selectedModel}
                              onSelectionChange={(key) => setSelectedModel(key as string)}
                              width="100%"
                            >
                              {models.map(model => (
                                <Item key={model.path} textValue={model.name}>
                                  <Flex direction="column">
                                    <Text>{model.name}</Text>
                                    <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                      {model.size} • {model.type}
                                    </Text>
                                  </Flex>
                                </Item>
                              ))}
                            </Picker>
                          </View>
                          
                          <View>
                            <Grid columns={['1fr', '1fr', '1fr']} gap="size-200">
                              <NumberField
                                label="Max Tokens"
                                value={maxTokens}
                                onChange={setMaxTokens}
                                minValue={1}
                                maxValue={4096}
                              />
                              <NumberField
                                label="Temperature"
                                value={temperature}
                                onChange={setTemperature}
                                minValue={0}
                                maxValue={2}
                                step={0.1}
                              />
                              <NumberField
                                label="Top P"
                                value={topP}
                                onChange={setTopP}
                                minValue={0}
                                maxValue={1}
                                step={0.1}
                              />
                            </Grid>
                          </View>
                        </Grid>
                        
                        <TextArea
                          value={inferencePrompt}
                          onChange={setInferencePrompt}
                          label="Prompt"
                          description="Enter your prompt here..."
                          width="100%"
                          height="size-1200"
                        />
                        
                        <Button
                          variant="primary"
                          onPress={runInference}
                          isDisabled={!selectedModel || !inferencePrompt.trim() || loading}
                        >
                          {loading ? (
                            <>
                              <ProgressCircle size="S" isIndeterminate />
                              <Text>Generating...</Text>
                            </>
                          ) : (
                            <>
                              <Icons.Play size={16} />
                              <Text>Run Inference</Text>
                            </>
                          )}
                        </Button>
                      </Flex>
                    </Well>

                    {/* Inference Results */}
                    {inferenceResults.length > 0 && (
                      <View>
                        <Heading level={4} marginBottom="size-200">Recent Results</Heading>
                        {inferenceResults.slice(0, 3).map(result => (
                          <Well key={result.id} marginBottom="size-200">
                            <Flex direction="column" gap="size-200">
                              <Flex justifyContent="space-between" alignItems="center">
                                <Text UNSAFE_style={{ fontWeight: 'bold' }}>
                                  {result.modelPath.split('/').pop()}
                                </Text>
                                <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                  {result.processingTime}ms • {result.timestamp.toLocaleTimeString()}
                                </Text>
                              </Flex>
                              
                              <View backgroundColor="gray-100" padding="size-200" borderRadius="small">
                                <Text UNSAFE_style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                  Prompt:
                                </Text>
                                <Text>{result.prompt}</Text>
                              </View>
                              
                              <View backgroundColor="blue-100" padding="size-200" borderRadius="small">
                                <Text UNSAFE_style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                  Response:
                                </Text>
                                <Text>{result.response}</Text>
                              </View>
                            </Flex>
                          </Well>
                        ))}
                      </View>
                    )}
                  </Flex>
                </View>
              </Item>

              {/* Fine-Tuning Panel */}
              <Item key="finetune">
                <View padding="size-300">
                  <Flex direction="column" gap="size-300">
                    <Heading level={3}>Model Fine-Tuning</Heading>
                    
                    <Well>
                      <Flex direction="column" gap="size-300">
                        <Text>Create custom models by fine-tuning base models with your data.</Text>
                        
                        <Grid columns={['1fr', '1fr']} gap="size-300">
                          <View>
                            <Text UNSAFE_style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                              Base Model:
                            </Text>
                            <Picker
                              selectedKey={baseModel}
                              onSelectionChange={(key) => setBaseModel(key as string)}
                              width="100%"
                            >
                              {models.map(model => (
                                <Item key={model.path} textValue={model.name}>
                                  {model.name}
                                </Item>
                              ))}
                            </Picker>
                          </View>
                          
                          <View>
                            <Grid columns={['1fr', '1fr', '1fr']} gap="size-200">
                              <NumberField
                                label="Epochs"
                                value={epochs}
                                onChange={setEpochs}
                                minValue={1}
                                maxValue={100}
                              />
                              <NumberField
                                label="Learning Rate"
                                value={learningRate}
                                onChange={setLearningRate}
                                minValue={0.00001}
                                maxValue={0.01}
                                step={0.00001}
                                formatOptions={{ minimumFractionDigits: 5 }}
                              />
                              <NumberField
                                label="Batch Size"
                                value={batchSize}
                                onChange={setBatchSize}
                                minValue={1}
                                maxValue={32}
                              />
                            </Grid>
                          </View>
                        </Grid>
                        
                        <TextArea
                          value={fineTuningData}
                          onChange={setFineTuningData}
                          label="Training Data"
                          description="Enter training data (JSON format with prompt/completion pairs)..."
                          width="100%"
                          height="size-1600"
                        />
                        
                        <Button
                          variant="primary"
                          onPress={startFineTuning}
                          isDisabled={!baseModel || !fineTuningData.trim() || loading}
                        >
                          {loading ? (
                            <>
                              <ProgressCircle size="S" isIndeterminate />
                              <Text>Starting...</Text>
                            </>
                          ) : (
                            <>
                              <Icons.Settings01 size={16} />
                              <Text>Start Fine-Tuning</Text>
                            </>
                          )}
                        </Button>
                      </Flex>
                    </Well>

                    {/* Fine-Tuning Jobs */}
                    {fineTuningJobs.length > 0 && (
                      <View>
                        <Heading level={4} marginBottom="size-200">Fine-Tuning Jobs</Heading>
                        {fineTuningJobs.map(job => (
                          <Well key={job.id} marginBottom="size-200">
                            <Flex direction="column" gap="size-200">
                              <Flex justifyContent="space-between" alignItems="center">
                                <Flex alignItems="center" gap="size-200">
                                  {getStatusIcon(job.status)}
                                  <Text UNSAFE_style={{ fontWeight: 'bold' }}>
                                    {job.modelName}
                                  </Text>
                                  {getStatusBadge(job.status)}
                                </Flex>
                                
                                <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                  Started: {job.startTime.toLocaleString()}
                                </Text>
                              </Flex>
                              
                              {job.status === 'running' && (
                                <View>
                                  <Flex justifyContent="space-between" alignItems="center" marginBottom="size-100">
                                    <Text UNSAFE_style={{ fontSize: '0.875rem' }}>Progress</Text>
                                    <Text UNSAFE_style={{ fontSize: '0.875rem' }}>{job.progress}%</Text>
                                  </Flex>
                                  <ProgressBar 
                                    value={job.progress} 
                                    minValue={0} 
                                    maxValue={100}
                                    variant="positive"
                                  />
                                </View>
                              )}
                            </Flex>
                          </Well>
                        ))}
                      </View>
                    )}
                  </Flex>
                </View>
              </Item>

              {/* Models Panel */}
              <Item key="models">
                <View padding="size-300">
                  <Flex direction="column" gap="size-300">
                    <Heading level={3}>Available Models</Heading>
                    
                    {models.length > 0 ? (
                      <Grid columns={['1fr', '1fr']} gap="size-300">
                        {models.map(model => (
                          <View
                            key={model.id}
                            backgroundColor="gray-50"
                            borderRadius="medium"
                            padding="size-300"
                            borderWidth="thin"
                            borderColor="gray-300"
                          >
                            <Flex direction="column" gap="size-200">
                              <Flex justifyContent="space-between" alignItems="center">
                                <Flex alignItems="center" gap="size-200">
                                  {getStatusIcon(model.status)}
                                  <Text UNSAFE_style={{ fontWeight: 'bold' }}>
                                    {model.name}
                                  </Text>
                                  {getStatusBadge(model.status)}
                                </Flex>
                                <Badge variant="info">{model.type}</Badge>
                              </Flex>
                              
                              <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                Path: {model.path}
                              </Text>
                              
                              <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                Size: {model.size}
                              </Text>
                            </Flex>
                          </View>
                        ))}
                      </Grid>
                    ) : (
                      <Well>
                        <Flex direction="column" alignItems="center" gap="size-200" padding="size-400">
                          <Icons.Database01 size={48} color="#6b7280" />
                          <Text UNSAFE_style={{ color: '#6b7280' }}>
                            No MLX models found. Please ensure models are available in the MLX models directory.
                          </Text>
                        </Flex>
                      </Well>
                    )}
                  </Flex>
                </View>
              </Item>
            </TabPanels>
          </Tabs>
        </View>

      </Flex>
    </View>
  );
}
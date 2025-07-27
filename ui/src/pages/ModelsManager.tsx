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
  TextField,
  Button,
  Tabs,
  TabList,
  Item,
  TabPanels,
  SearchField
} from '@adobe/react-spectrum';
import { api } from '../lib/api-enhanced';

interface Model {
  id: string;
  name: string;
  source: 'MLX' | 'HuggingFace' | 'Local';
  type: string;
  size: string;
  status: 'available' | 'loading' | 'error';
  path?: string;
  description?: string;
  capabilities: string[];
  lastUsed?: Date;
  downloadUrl?: string;
}

interface ModelMetrics {
  totalInferences: number;
  avgResponseTime: number;
  successRate: number;
  errorCount: number;
}

export default function ModelsManager() {
  const [selectedTab, setSelectedTab] = useState<React.Key>('models');
  const [models, setModels] = useState<Model[]>([]);
  const [metrics, setMetrics] = useState<Record<string, ModelMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Model Installation
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    loadModelsData();
  }, []);

  const loadModelsData = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const allModels: Model[] = [];
      
      // Load MLX models
      try {
        const mlxResponse = await api.getMLXModels();
        if (mlxResponse.success && mlxResponse.data) {
          const mlxModels = mlxResponse.data.map((model: any, index: number) => ({
            id: `mlx-${index}`,
            name: model.name || `MLX Model ${index + 1}`,
            source: 'MLX' as const,
            type: model.type || 'LLM',
            size: model.size || 'Unknown',
            status: 'available' as const,
            path: model.path || model.modelPath,
            description: model.description || 'MLX-optimized model for Apple Silicon',
            capabilities: ['inference', 'fine-tuning', 'apple-silicon-optimized'],
            lastUsed: model.lastUsed ? new Date(model.lastUsed) : undefined
          }));
          allModels.push(...mlxModels);
        }
      } catch (error) {
        console.warn('MLX models not available:', error);
      }
      
      // Load HuggingFace models
      try {
        const hfResponse = await api.getHuggingFaceModels();
        if (hfResponse.success && hfResponse.data) {
          const hfModels = hfResponse.data.map((model: any, index: number) => ({
            id: `hf-${index}`,
            name: model.name || model.modelId || `HF Model ${index + 1}`,
            source: 'HuggingFace' as const,
            type: model.task || model.type || 'LLM',
            size: model.size || 'Unknown',
            status: 'available' as const,
            description: model.description || 'HuggingFace model via LM Studio',
            capabilities: model.pipeline_tag ? [model.pipeline_tag] : ['text-generation'],
            downloadUrl: model.url
          }));
          allModels.push(...hfModels);
        }
      } catch (error) {
        console.warn('HuggingFace models not available:', error);
      }
      
      // Load performance metrics
      try {
        const metricsResponse = await api.getModelPerformance();
        if (metricsResponse.success && metricsResponse.data) {
          const modelMetrics: Record<string, ModelMetrics> = {};
          metricsResponse.data.forEach((metric: any) => {
            modelMetrics[metric.modelId || metric.model] = {
              totalInferences: metric.totalInferences || 0,
              avgResponseTime: metric.avgResponseTime || 0,
              successRate: metric.successRate || 100,
              errorCount: metric.errorCount || 0
            };
          });
          setMetrics(modelMetrics);
        }
      } catch (error) {
        console.warn('Model metrics not available:', error);
      }
      
      setModels(allModels);
    } catch (error) {
      console.error('Failed to load models data:', error);
      setError('Failed to load models data');
    } finally {
      setLoading(false);
    }
  };

  const installModel = async () => {
    if (!installUrl.trim()) return;

    setInstalling(true);
    setError(null);

    try {
      // This would need to be implemented in the backend
      // For now, we'll simulate installation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newModel: Model = {
        id: `installed-${Date.now()}`,
        name: installUrl.split('/').pop() || 'New Model',
        source: 'Local',
        type: 'LLM',
        size: 'Unknown',
        status: 'available',
        description: 'Manually installed model',
        capabilities: ['inference'],
        downloadUrl: installUrl
      };
      
      setModels(prev => [newModel, ...prev]);
      setInstallUrl('');
    } catch (error) {
      setError('Failed to install model');
      console.error('Model installation error:', error);
    } finally {
      setInstalling(false);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'MLX': return <Icons.CpuChip01 size={16} color="#3b82f6" />;
      case 'HuggingFace': return <Icons.Download01 size={16} color="#f59e0b" />;
      case 'Local': return <Icons.HardDrive size={16} color="#10b981" />;
      default: return <Icons.Database01 size={16} color="#6b7280" />;
    }
  };

  const getSourceBadge = (source: string) => {
    const variants = {
      MLX: 'positive' as const,
      HuggingFace: 'notice' as const,
      Local: 'info' as const
    };
    return <Badge variant={variants[source as keyof typeof variants] || 'neutral'}>{source}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <Icons.CheckCircle size={16} color="#10b981" />;
      case 'loading': return <ProgressCircle size="S" isIndeterminate />;
      case 'error': return <Icons.XCircle size={16} color="#ef4444" />;
      default: return <Icons.Clock size={16} color="#6b7280" />;
    }
  };

  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View padding="size-400">
        <Flex direction="column" alignItems="center" gap="size-300" padding="size-600">
          <ProgressCircle size="L" isIndeterminate />
          <Text>Loading models data...</Text>
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
            <Icons.Database01 size={24} color="#3b82f6" />
            <Heading level={2}>Models Manager</Heading>
            <StatusLight variant="positive">
              <Text>{models.length} models available</Text>
            </StatusLight>
          </Flex>
          
          <Flex alignItems="center" gap="size-200">
            <ActionButton
              isQuiet
              onPress={loadModelsData}
              aria-label="Refresh models"
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

        {/* Tabs */}
        <View>
          <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab}>
            <TabList>
              <Item key="models">
                <Flex alignItems="center" gap="size-100">
                  <Icons.Database01 size={16} />
                  <Text>Available Models</Text>
                </Flex>
              </Item>
              <Item key="install">
                <Flex alignItems="center" gap="size-100">
                  <Icons.Download01 size={16} />
                  <Text>Install Model</Text>
                </Flex>
              </Item>
              <Item key="metrics">
                <Flex alignItems="center" gap="size-100">
                  <Icons.BarChart03 size={16} />
                  <Text>Performance</Text>
                </Flex>
              </Item>
            </TabList>
            
            <TabPanels>
              {/* Models Panel */}
              <Item key="models">
                <View padding="size-300">
                  <Flex direction="column" gap="size-300">
                    
                    {/* Search */}
                    <SearchField
                      value={searchQuery}
                      onChange={setSearchQuery}
                      label="Search models"
                      description="Search by name, type, or source"
                      width="100%"
                    />
                    
                    {/* Models Grid */}
                    {filteredModels.length > 0 ? (
                      <Grid columns={['1fr', '1fr']} gap="size-300">
                        {filteredModels.map(model => (
                          <View
                            key={model.id}
                            backgroundColor="gray-50"
                            borderRadius="medium"
                            padding="size-300"
                            borderWidth="thin"
                            borderColor="gray-300"
                          >
                            <Flex direction="column" gap="size-200">
                              
                              {/* Model Header */}
                              <Flex justifyContent="space-between" alignItems="center">
                                <Flex alignItems="center" gap="size-200">
                                  {getSourceIcon(model.source)}
                                  <Text UNSAFE_style={{ fontWeight: 'bold' }}>
                                    {model.name}
                                  </Text>
                                  {getStatusIcon(model.status)}
                                </Flex>
                                {getSourceBadge(model.source)}
                              </Flex>
                              
                              {/* Model Info */}
                              <Flex direction="column" gap="size-100">
                                <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                  Type: {model.type} • Size: {model.size}
                                </Text>
                                
                                {model.description && (
                                  <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    {model.description}
                                  </Text>
                                )}
                                
                                {model.path && (
                                  <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                    Path: {model.path}
                                  </Text>
                                )}
                              </Flex>
                              
                              {/* Capabilities */}
                              {model.capabilities.length > 0 && (
                                <Flex gap="size-100" wrap="wrap">
                                  {model.capabilities.map((capability, index) => (
                                    <Badge key={index} variant="neutral" UNSAFE_style={{ fontSize: '0.75rem' }}>
                                      {capability}
                                    </Badge>
                                  ))}
                                </Flex>
                              )}
                              
                              {/* Last Used */}
                              {model.lastUsed && (
                                <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                  Last used: {model.lastUsed.toLocaleString()}
                                </Text>
                              )}
                              
                              {/* Performance Metrics Preview */}
                              {metrics[model.id] && (
                                <Flex gap="size-200" justifyContent="space-between">
                                  <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                    {metrics[model.id].totalInferences} uses
                                  </Text>
                                  <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                    {metrics[model.id].avgResponseTime}ms avg
                                  </Text>
                                  <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                    {metrics[model.id].successRate}% success
                                  </Text>
                                </Flex>
                              )}
                            </Flex>
                          </View>
                        ))}
                      </Grid>
                    ) : (
                      <Well>
                        <Flex direction="column" alignItems="center" gap="size-200" padding="size-400">
                          <Icons.Search01 size={48} color="#6b7280" />
                          <Text UNSAFE_style={{ color: '#6b7280' }}>
                            {searchQuery ? 'No models match your search' : 'No models available'}
                          </Text>
                        </Flex>
                      </Well>
                    )}
                  </Flex>
                </View>
              </Item>

              {/* Install Panel */}
              <Item key="install">
                <View padding="size-300">
                  <Flex direction="column" gap="size-300">
                    <Heading level={3}>Install New Model</Heading>
                    
                    <Well>
                      <Flex direction="column" gap="size-300">
                        <Text>Install models from HuggingFace, local files, or custom URLs.</Text>
                        
                        <TextField
                          value={installUrl}
                          onChange={setInstallUrl}
                          label="Model URL or ID"
                          description="Enter a model URL or HuggingFace model ID (e.g., microsoft/DialoGPT-medium)"
                          width="100%"
                        />
                        
                        <Button
                          variant="primary"
                          onPress={installModel}
                          isDisabled={!installUrl.trim() || installing}
                        >
                          {installing ? (
                            <>
                              <ProgressCircle size="S" isIndeterminate />
                              <Text>Installing...</Text>
                            </>
                          ) : (
                            <>
                              <Icons.Download01 size={16} />
                              <Text>Install Model</Text>
                            </>
                          )}
                        </Button>
                      </Flex>
                    </Well>

                    {/* Popular Models */}
                    <View>
                      <Heading level={4} marginBottom="size-200">Popular Models</Heading>
                      <Grid columns={['1fr', '1fr']} gap="size-200">
                        {[
                          { name: 'GPT-2', id: 'gpt2', description: 'Small language model' },
                          { name: 'BERT Base', id: 'bert-base-uncased', description: 'Text classification' },
                          { name: 'T5 Small', id: 't5-small', description: 'Text-to-text transfer' },
                          { name: 'DistilBERT', id: 'distilbert-base-uncased', description: 'Lightweight BERT' }
                        ].map(model => (
                          <Well key={model.id}>
                            <Flex justifyContent="space-between" alignItems="center">
                              <Flex direction="column">
                                <Text UNSAFE_style={{ fontWeight: 'bold' }}>{model.name}</Text>
                                <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                  {model.description}
                                </Text>
                              </Flex>
                              <ActionButton
                                isQuiet
                                onPress={() => setInstallUrl(model.id)}
                                aria-label={`Install ${model.name}`}
                              >
                                <Icons.Plus size={16} />
                              </ActionButton>
                            </Flex>
                          </Well>
                        ))}
                      </Grid>
                    </View>
                  </Flex>
                </View>
              </Item>

              {/* Metrics Panel */}
              <Item key="metrics">
                <View padding="size-300">
                  <Flex direction="column" gap="size-300">
                    <Heading level={3}>Model Performance Metrics</Heading>
                    
                    {Object.keys(metrics).length > 0 ? (
                      <Flex direction="column" gap="size-300">
                        {Object.entries(metrics).map(([modelId, metric]) => {
                          const model = models.find(m => m.id === modelId);
                          return (
                            <Well key={modelId}>
                              <Flex direction="column" gap="size-200">
                                <Text UNSAFE_style={{ fontWeight: 'bold' }}>
                                  {model?.name || modelId}
                                </Text>
                                
                                <Grid columns={['1fr', '1fr', '1fr', '1fr']} gap="size-200">
                                  <Flex direction="column" alignItems="center">
                                    <Text UNSAFE_style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                                      {metric.totalInferences}
                                    </Text>
                                    <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                      Total Uses
                                    </Text>
                                  </Flex>
                                  
                                  <Flex direction="column" alignItems="center">
                                    <Text UNSAFE_style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                                      {metric.avgResponseTime}ms
                                    </Text>
                                    <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                      Avg Response
                                    </Text>
                                  </Flex>
                                  
                                  <Flex direction="column" alignItems="center">
                                    <Text UNSAFE_style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
                                      {metric.successRate}%
                                    </Text>
                                    <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                      Success Rate
                                    </Text>
                                  </Flex>
                                  
                                  <Flex direction="column" alignItems="center">
                                    <Text UNSAFE_style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>
                                      {metric.errorCount}
                                    </Text>
                                    <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                      Errors
                                    </Text>
                                  </Flex>
                                </Grid>
                              </Flex>
                            </Well>
                          );
                        })}
                      </Flex>
                    ) : (
                      <Well>
                        <Flex direction="column" alignItems="center" gap="size-200" padding="size-400">
                          <Icons.BarChart03 size={48} color="#6b7280" />
                          <Text UNSAFE_style={{ color: '#6b7280' }}>
                            No performance metrics available yet. Use some models to see metrics here.
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
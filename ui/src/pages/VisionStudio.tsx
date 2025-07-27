import React, { useState, useRef, useEffect } from 'react';
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
  Button,
  Tabs,
  TabList,
  Item,
  TabPanels
} from '@adobe/react-spectrum';
import { api } from '../lib/api-enhanced';

interface VisionResult {
  id: string;
  type: 'analyze' | 'generate' | 'enhance';
  input: string | File;
  output: any;
  timestamp: Date;
  status: 'processing' | 'completed' | 'failed';
  processingTime?: number;
}

export default function VisionStudio() {
  const [selectedTab, setSelectedTab] = useState<React.Key>('analyze');
  const [results, setResults] = useState<VisionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visionHealth, setVisionHealth] = useState<any>(null);
  
  // Image Analysis
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
  // Image Generation
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  // Image Enhancement
  const [enhanceFile, setEnhanceFile] = useState<File | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const enhanceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkVisionHealth();
  }, []);

  const checkVisionHealth = async () => {
    try {
      const health = await api.getVisionHealth();
      setVisionHealth(health);
    } catch (error) {
      console.error('Failed to get vision health:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'analyze' | 'enhance') => {
    const file = event.target.files?.[0];
    if (file) {
      if (type === 'analyze') {
        setSelectedFile(file);
      } else {
        setEnhanceFile(file);
      }
    }
  };

  const analyzeImage = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const response = await api.analyzeImage(selectedFile, {
        includeObjects: true,
        includeText: true,
        includeScenes: true
      });

      const result: VisionResult = {
        id: Date.now().toString(),
        type: 'analyze',
        input: selectedFile,
        output: response,
        timestamp: new Date(),
        status: 'completed',
        processingTime: Date.now() - startTime
      };

      setResults(prev => [result, ...prev]);
      setAnalysisResult(response);
    } catch (error) {
      setError('Image analysis failed. Please try again.');
      console.error('Image analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateImage = async () => {
    if (!generatePrompt.trim()) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const response = await api.generateImage(generatePrompt, {
        width: 1024,
        height: 1024,
        steps: 20,
        guidance: 7.5
      });

      const result: VisionResult = {
        id: Date.now().toString(),
        type: 'generate',
        input: generatePrompt,
        output: response,
        timestamp: new Date(),
        status: 'completed',
        processingTime: Date.now() - startTime
      };

      setResults(prev => [result, ...prev]);
      setGeneratedImage(response.imageUrl || response.imageBase64);
    } catch (error) {
      setError('Image generation failed. Please try again.');
      console.error('Image generation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const enhanceImage = async () => {
    if (!enhanceFile) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const response = await api.enhanceImage(enhanceFile, {
        strength: 0.3,
        steps: 20,
        guidance: 7.5
      });

      const result: VisionResult = {
        id: Date.now().toString(),
        type: 'enhance',
        input: enhanceFile,
        output: response,
        timestamp: new Date(),
        status: 'completed',
        processingTime: Date.now() - startTime
      };

      setResults(prev => [result, ...prev]);
      setEnhancedImage(response.imageUrl || response.imageBase64);
    } catch (error) {
      setError('Image enhancement failed. Please try again.');
      console.error('Image enhancement error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <ProgressCircle size="S" isIndeterminate />;
      case 'completed': return <Icons.CheckCircle size={16} color="#10b981" />;
      case 'failed': return <Icons.XCircle size={16} color="#ef4444" />;
      default: return <Icons.Clock size={16} color="#6b7280" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      processing: 'info' as const,
      completed: 'positive' as const,
      failed: 'negative' as const
    };
    return <Badge variant={variants[status as keyof typeof variants] || 'neutral'}>{status.toUpperCase()}</Badge>;
  };

  return (
    <View padding="size-400">
      <Flex direction="column" gap="size-400">
        
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap="size-200">
            <Icons.Image01 size={24} color="#3b82f6" />
            <Heading level={2}>Vision Studio</Heading>
            <StatusLight variant={visionHealth?.status === 'healthy' ? 'positive' : 'negative'}>
              <Text>{visionHealth?.status === 'healthy' ? 'PyVision Ready' : 'Service Loading'}</Text>
            </StatusLight>
          </Flex>
          
          <Flex alignItems="center" gap="size-200">
            <ActionButton
              isQuiet
              onPress={checkVisionHealth}
              aria-label="Refresh status"
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

        {/* Vision Operations Tabs */}
        <View>
          <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab}>
            <TabList>
              <Item key="analyze">
                <Flex alignItems="center" gap="size-100">
                  <Icons.SearchLg size={16} />
                  <Text>Analyze Image</Text>
                </Flex>
              </Item>
              <Item key="generate">
                <Flex alignItems="center" gap="size-100">
                  <Icons.Stars01 size={16} />
                  <Text>Generate Image</Text>
                </Flex>
              </Item>
              <Item key="enhance">
                <Flex alignItems="center" gap="size-100">
                  <Icons.Edit03 size={16} />
                  <Text>Enhance Image</Text>
                </Flex>
              </Item>
            </TabList>
            
            <TabPanels>
              {/* Image Analysis Panel */}
              <Item key="analyze">
                <View padding="size-300">
                  <Flex direction="column" gap="size-300">
                    <Heading level={3}>Image Analysis</Heading>
                    
                    <Well>
                      <Flex direction="column" gap="size-300">
                        <Text>Upload an image to analyze its contents, detect objects, extract text, and identify scenes.</Text>
                        
                        <Flex gap="size-200" alignItems="center">
                          <Button
                            variant="accent"
                            onPress={() => fileInputRef.current?.click()}
                          >
                            <Icons.Upload01 size={16} />
                            <Text>Select Image</Text>
                          </Button>
                          
                          {selectedFile && (
                            <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              {selectedFile.name}
                            </Text>
                          )}
                          
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileSelect(e, 'analyze')}
                          />
                        </Flex>
                        
                        <Button
                          variant="primary"
                          onPress={analyzeImage}
                          isDisabled={!selectedFile || loading}
                        >
                          {loading ? (
                            <>
                              <ProgressCircle size="S" isIndeterminate />
                              <Text>Analyzing...</Text>
                            </>
                          ) : (
                            <>
                              <Icons.SearchLg size={16} />
                              <Text>Analyze Image</Text>
                            </>
                          )}
                        </Button>
                      </Flex>
                    </Well>

                    {/* Analysis Results */}
                    {analysisResult && (
                      <Well>
                        <Heading level={4} marginBottom="size-200">Analysis Results</Heading>
                        <pre style={{ 
                          background: '#f3f4f6', 
                          padding: '1rem', 
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          overflow: 'auto',
                          maxHeight: '300px'
                        }}>
                          {JSON.stringify(analysisResult, null, 2)}
                        </pre>
                      </Well>
                    )}
                  </Flex>
                </View>
              </Item>

              {/* Image Generation Panel */}
              <Item key="generate">
                <View padding="size-300">
                  <Flex direction="column" gap="size-300">
                    <Heading level={3}>Image Generation</Heading>
                    
                    <Well>
                      <Flex direction="column" gap="size-300">
                        <Text>Generate images from text prompts using advanced AI models.</Text>
                        
                        <TextArea
                          value={generatePrompt}
                          onChange={setGeneratePrompt}
                          label="Image Description"
                          description="Describe the image you want to generate..."
                          width="100%"
                          height="size-1000"
                        />
                        
                        <Button
                          variant="primary"
                          onPress={generateImage}
                          isDisabled={!generatePrompt.trim() || loading}
                        >
                          {loading ? (
                            <>
                              <ProgressCircle size="S" isIndeterminate />
                              <Text>Generating...</Text>
                            </>
                          ) : (
                            <>
                              <Icons.Stars01 size={16} />
                              <Text>Generate Image</Text>
                            </>
                          )}
                        </Button>
                      </Flex>
                    </Well>

                    {/* Generated Image */}
                    {generatedImage && (
                      <Well>
                        <Heading level={4} marginBottom="size-200">Generated Image</Heading>
                        <img 
                          src={generatedImage} 
                          alt="Generated" 
                          style={{ 
                            maxWidth: '100%', 
                            height: 'auto',
                            borderRadius: '0.5rem',
                            border: '1px solid #d1d5db'
                          }} 
                        />
                      </Well>
                    )}
                  </Flex>
                </View>
              </Item>

              {/* Image Enhancement Panel */}
              <Item key="enhance">
                <View padding="size-300">
                  <Flex direction="column" gap="size-300">
                    <Heading level={3}>Image Enhancement</Heading>
                    
                    <Well>
                      <Flex direction="column" gap="size-300">
                        <Text>Enhance image quality using SDXL refiner and advanced upscaling techniques.</Text>
                        
                        <Flex gap="size-200" alignItems="center">
                          <Button
                            variant="accent"
                            onPress={() => enhanceInputRef.current?.click()}
                          >
                            <Icons.Upload01 size={16} />
                            <Text>Select Image</Text>
                          </Button>
                          
                          {enhanceFile && (
                            <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              {enhanceFile.name}
                            </Text>
                          )}
                          
                          <input
                            ref={enhanceInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileSelect(e, 'enhance')}
                          />
                        </Flex>
                        
                        <Button
                          variant="primary"
                          onPress={enhanceImage}
                          isDisabled={!enhanceFile || loading}
                        >
                          {loading ? (
                            <>
                              <ProgressCircle size="S" isIndeterminate />
                              <Text>Enhancing...</Text>
                            </>
                          ) : (
                            <>
                              <Icons.Edit03 size={16} />
                              <Text>Enhance Image</Text>
                            </>
                          )}
                        </Button>
                      </Flex>
                    </Well>

                    {/* Enhanced Image */}
                    {enhancedImage && (
                      <Well>
                        <Heading level={4} marginBottom="size-200">Enhanced Image</Heading>
                        <img 
                          src={enhancedImage} 
                          alt="Enhanced" 
                          style={{ 
                            maxWidth: '100%', 
                            height: 'auto',
                            borderRadius: '0.5rem',
                            border: '1px solid #d1d5db'
                          }} 
                        />
                      </Well>
                    )}
                  </Flex>
                </View>
              </Item>
            </TabPanels>
          </Tabs>
        </View>

        {/* Recent Results */}
        <View>
          <Heading level={3} marginBottom="size-200">Recent Results ({results.length})</Heading>
          {results.length > 0 ? (
            <Flex direction="column" gap="size-200">
              {results.slice(0, 5).map(result => (
                <View
                  key={result.id}
                  backgroundColor="gray-50"
                  borderRadius="medium"
                  padding="size-300"
                  borderWidth="thin"
                  borderColor="gray-300"
                >
                  <Flex justifyContent="space-between" alignItems="center">
                    <Flex alignItems="center" gap="size-200">
                      {getStatusIcon(result.status)}
                      <Flex direction="column">
                        <Text UNSAFE_style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                          {result.type} Operation
                        </Text>
                        <Text UNSAFE_style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {typeof result.input === 'string' 
                            ? `${result.input.slice(0, 50)  }...`
                            : result.input.name
                          }
                        </Text>
                      </Flex>
                      {getStatusBadge(result.status)}
                    </Flex>
                    
                    <Flex direction="column" alignItems="end">
                      <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {result.timestamp.toLocaleTimeString()}
                      </Text>
                      {result.processingTime && (
                        <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          {result.processingTime}ms
                        </Text>
                      )}
                    </Flex>
                  </Flex>
                </View>
              ))}
            </Flex>
          ) : (
            <Well>
              <Flex direction="column" alignItems="center" gap="size-200" padding="size-400">
                <Icons.Image01 size={48} color="#6b7280" />
                <Text UNSAFE_style={{ color: '#6b7280' }}>
                  No vision operations yet. Try analyzing, generating, or enhancing an image!
                </Text>
              </Flex>
            </Well>
          )}
        </View>

      </Flex>
    </View>
  );
}
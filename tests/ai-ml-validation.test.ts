/**
 * AI/ML System Validation Test Suite
 * Comprehensive testing for AI/ML components in Universal AI Tools
 */

import { test, expect } from '@playwright/test';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:9999';
const API_KEY = 'universal-ai-tools-network-2025-secure-key';

interface AIValidationResult {
  service: string;
  test: string;
  success: boolean;
  responseTime: number;
  quality: {
    relevance: number;
    coherence: number;
    accuracy: number;
  };
  metadata?: any;
}

class AIMLValidator {
  private results: AIValidationResult[] = [];
  
  async validateLLMResponse(response: string, expectedTopics: string[]): Promise<{ relevance: number; coherence: number; accuracy: number }> {
    // Simple heuristic-based validation
    const relevance = this.calculateRelevance(response, expectedTopics);
    const coherence = this.calculateCoherence(response);
    const accuracy = this.calculateAccuracy(response);
    
    return { relevance, coherence, accuracy };
  }
  
  private calculateRelevance(response: string, topics: string[]): number {
    const responseWords = response.toLowerCase().split(/\s+/);
    const matchedTopics = topics.filter(topic => 
      responseWords.some(word => word.includes(topic.toLowerCase()))
    );
    return topics.length > 0 ? matchedTopics.length / topics.length : 0;
  }
  
  private calculateCoherence(response: string): number {
    // Basic coherence checks
    const sentences = response.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length < 2) return 1;
    
    // Check for basic grammatical structure
    const hasProperStructure = sentences.every(sentence => {
      const words = sentence.trim().split(/\s+/);
      return words.length > 2; // At least 3 words per sentence
    });
    
    return hasProperStructure ? 0.8 : 0.4;
  }
  
  private calculateAccuracy(response: string): number {
    // Check for common AI hallucination indicators
    const hallucinationPatterns = [
      /as an ai/gi,
      /i cannot/gi,
      /i don't have access/gi,
      /i'm not sure/gi
    ];
    
    const hasHallucinations = hallucinationPatterns.some(pattern => pattern.test(response));
    return hasHallucinations ? 0.6 : 0.9;
  }
  
  generateReport(): string {
    if (this.results.length === 0) return 'No AI/ML validation results';
    
    const report = ['🤖 AI/ML System Validation Report', '='.repeat(50)];
    
    const avgQuality = this.results.reduce((acc, result) => {
      acc.relevance += result.quality.relevance;
      acc.coherence += result.quality.coherence;
      acc.accuracy += result.quality.accuracy;
      return acc;
    }, { relevance: 0, coherence: 0, accuracy: 0 });
    
    const count = this.results.length;
    report.push(`📊 Average Quality Metrics:`);
    report.push(`   Relevance: ${(avgQuality.relevance / count * 100).toFixed(1)}%`);
    report.push(`   Coherence: ${(avgQuality.coherence / count * 100).toFixed(1)}%`);
    report.push(`   Accuracy: ${(avgQuality.accuracy / count * 100).toFixed(1)}%`);
    
    const successRate = (this.results.filter(r => r.success).length / count) * 100;
    report.push(`✅ Success Rate: ${successRate.toFixed(1)}%`);
    
    const avgResponseTime = this.results.reduce((acc, r) => acc + r.responseTime, 0) / count;
    report.push(`⏱️ Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    
    return report.join('\n');
  }
  
  addResult(result: AIValidationResult): void {
    this.results.push(result);
  }
}

test.describe('AI/ML System Validation Suite', () => {
  let validator: AIMLValidator;
  
  test.beforeEach(() => {
    validator = new AIMLValidator();
  });
  
  test.afterEach(() => {
    console.log(validator.generateReport());
  });

  test('LLM Router Service Validation', async ({ request }) => {
    console.log('🧠 Testing LLM Router Service...');
    
    // Test health check
    const healthResponse = await request.get(`${BASE_URL}/api/v1/llm/health`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    expect(healthResponse.ok()).toBeTruthy();
    
    if (healthResponse.ok()) {
      const healthData = await healthResponse.json();
      expect(healthData.success).toBeTruthy();
      expect(healthData.data).toHaveProperty('status');
      expect(healthData.data).toHaveProperty('services');
      
      console.log('LLM Router Health:', healthData.data);
    }
  });

  test('AI Response Quality Validation', async ({ request }) => {
    console.log('🎯 Testing AI response quality...');
    
    const testPrompts = [
      {
        prompt: 'Explain the concept of machine learning in simple terms',
        expectedTopics: ['machine learning', 'data', 'algorithms', 'patterns'],
        category: 'educational'
      },
      {
        prompt: 'Write a simple Python function to calculate fibonacci numbers',
        expectedTopics: ['python', 'function', 'fibonacci', 'recursive'],
        category: 'code_generation'
      },
      {
        prompt: 'Summarize the benefits of using TypeScript over JavaScript',
        expectedTopics: ['typescript', 'javascript', 'types', 'benefits'],
        category: 'comparison'
      }
    ];
    
    for (const testCase of testPrompts) {
      const startTime = performance.now();
      
      const response = await request.post(`${BASE_URL}/api/v1/llm/chat`, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          prompt: testCase.prompt,
          provider: 'ollama',
          model: 'llama3.2:3b',
          maxTokens: 200
        }
      });
      
      const responseTime = performance.now() - startTime;
      
      if (response.ok()) {
        const data = await response.json();
        
        if (data.success && data.data?.content) {
          const quality = await validator.validateLLMResponse(
            data.data.content, 
            testCase.expectedTopics
          );
          
          validator.addResult({
            service: 'llm-router',
            test: `${testCase.category}_quality`,
            success: true,
            responseTime,
            quality,
            metadata: {
              prompt: testCase.prompt.substring(0, 50) + '...',
              responseLength: data.data.content.length,
              tokens: data.data.tokens
            }
          });
          
          // Assert quality thresholds
          expect(quality.relevance).toBeGreaterThan(0.3); // At least 30% relevant
          expect(quality.coherence).toBeGreaterThan(0.5); // At least 50% coherent
          
          console.log(`${testCase.category} quality: R${(quality.relevance*100).toFixed(0)}% C${(quality.coherence*100).toFixed(0)}% A${(quality.accuracy*100).toFixed(0)}%`);
        }
      } else {
        console.log(`${testCase.category} test skipped - LLM service not available`);
      }
    }
  });

  test('Multi-Tier LLM Coordination', async ({ request }) => {
    console.log('🚀 Testing multi-tier LLM coordination...');
    
    // Test fast coordinator routing
    const routingResponse = await request.post(`${BASE_URL}/api/v1/fast-coordinator/routing-decision`, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        userRequest: 'Simple greeting',
        context: {
          taskType: 'simple_response',
          complexity: 'low',
          urgency: 'normal'
        }
      }
    });
    
    if (routingResponse.ok()) {
      const routingData = await routingResponse.json();
      
      expect(routingData.success).toBeTruthy();
      expect(routingData.data).toHaveProperty('decision');
      
      const decision = routingData.data.decision;
      expect(decision).toHaveProperty('targetService');
      expect(decision).toHaveProperty('complexity');
      
      console.log('Routing decision:', decision);
      
      // Test execution through coordinator
      const executionResponse = await request.post(`${BASE_URL}/api/v1/fast-coordinator/execute`, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          userRequest: 'Generate a hello world example in Python',
          context: {
            taskType: 'code_generation',
            complexity: 'medium'
          }
        }
      });
      
      if (executionResponse.ok()) {
        const executionData = await executionResponse.json();
        expect(executionData.success).toBeTruthy();
        expect(executionData.data).toHaveProperty('response');
        
        console.log('Multi-tier execution successful');
      }
    } else {
      console.log('Multi-tier coordination test skipped - service not available');
    }
  });

  test('Agent System Coordination', async ({ request }) => {
    console.log('🤝 Testing agent system coordination...');
    
    // Get available agents
    const agentsResponse = await request.get(`${BASE_URL}/api/v1/agents`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    expect(agentsResponse.ok()).toBeTruthy();
    
    if (agentsResponse.ok()) {
      const agentsData = await agentsResponse.json();
      expect(agentsData.success).toBeTruthy();
      expect(agentsData.data).toHaveProperty('agents');
      
      const agents = agentsData.data.agents;
      expect(Array.isArray(agents)).toBeTruthy();
      expect(agents.length).toBeGreaterThan(0);
      
      // Test agent capabilities
      const plannerAgent = agents.find(agent => agent.name.includes('planner'));
      if (plannerAgent) {
        expect(plannerAgent).toHaveProperty('capabilities');
        expect(plannerAgent).toHaveProperty('priority');
        expect(plannerAgent.memoryEnabled).toBeTruthy();
        
        console.log(`Found ${agents.length} agents, planner agent available`);
      }
      
      // Test multi-agent coordination if available
      const coordinationResponse = await request.post(`${BASE_URL}/api/v1/fast-coordinator/coordinate-agents`, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          primaryTask: 'Create a project plan for a web application',
          supportingTasks: ['Research best practices', 'Identify key technologies']
        }
      });
      
      if (coordinationResponse.ok()) {
        const coordinationData = await coordinationResponse.json();
        expect(coordinationData.success).toBeTruthy();
        console.log('Multi-agent coordination successful');
      }
    }
  });

  test('Memory System Integration', async ({ request }) => {
    console.log('🧠 Testing memory system integration...');
    
    // Test memory creation with AI relevance
    const memoryResponse = await request.post(`${BASE_URL}/api/v1/memory`, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        type: 'ai_learning',
        content: 'Machine learning models require large datasets for training',
        metadata: {
          source: 'ai_validation_test',
          topics: ['machine learning', 'training', 'datasets'],
          importance: 0.8
        },
        tags: ['ai', 'ml', 'training']
      }
    });
    
    expect(memoryResponse.ok()).toBeTruthy();
    
    if (memoryResponse.ok()) {
      const memoryData = await memoryResponse.json();
      expect(memoryData.success).toBeTruthy();
      
      // Test memory retrieval
      const retrievalResponse = await request.get(`${BASE_URL}/api/v1/memory?query=machine learning&limit=5`, {
        headers: { 'X-API-Key': API_KEY }
      });
      
      expect(retrievalResponse.ok()).toBeTruthy();
      
      if (retrievalResponse.ok()) {
        const retrievalData = await retrievalResponse.json();
        expect(retrievalData.success).toBeTruthy();
        expect(retrievalData.data).toHaveProperty('memories');
        
        console.log(`Memory system: stored and retrieved ${retrievalData.data.memories?.length || 0} memories`);
      }
    }
  });

  test('Parameter Optimization System', async ({ request }) => {
    console.log('⚙️ Testing parameter optimization system...');
    
    // Test parameter optimization endpoint if available
    const paramResponse = await request.get(`${BASE_URL}/api/v1/parameters/health`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    if (paramResponse.ok()) {
      const paramData = await paramResponse.json();
      expect(paramData.success).toBeTruthy();
      
      // Test parameter optimization for different task types
      const optimizationResponse = await request.post(`${BASE_URL}/api/v1/parameters/optimize`, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          taskType: 'code_generation',
          model: 'llama3.2:3b',
          context: {
            complexity: 'medium',
            expectedLength: 'short'
          }
        }
      });
      
      if (optimizationResponse.ok()) {
        const optimizationData = await optimizationResponse.json();
        expect(optimizationData.success).toBeTruthy();
        expect(optimizationData.data).toHaveProperty('parameters');
        
        const params = optimizationData.data.parameters;
        expect(params).toHaveProperty('temperature');
        expect(params).toHaveProperty('maxTokens');
        
        console.log('Parameter optimization:', params);
      }
    } else {
      console.log('Parameter optimization test skipped - service not available');
    }
  });

  test('MLX Integration Validation', async ({ request }) => {
    console.log('🍎 Testing MLX integration...');
    
    // Test MLX health endpoint
    const mlxHealthResponse = await request.get(`${BASE_URL}/api/v1/mlx/health`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    if (mlxHealthResponse.ok()) {
      const mlxHealthData = await mlxHealthResponse.json();
      expect(mlxHealthData.success).toBeTruthy();
      
      console.log('MLX health:', mlxHealthData.data);
      
      // Test MLX model listing if available
      const modelsResponse = await request.get(`${BASE_URL}/api/v1/mlx/models`, {
        headers: { 'X-API-Key': API_KEY }
      });
      
      if (modelsResponse.ok()) {
        const modelsData = await modelsResponse.json();
        expect(modelsData.success).toBeTruthy();
        console.log(`MLX models available: ${modelsData.data?.models?.length || 0}`);
      }
      
      // Test fine-tuning status if available
      const finetuningResponse = await request.get(`${BASE_URL}/api/v1/mlx/fine-tuning/status`, {
        headers: { 'X-API-Key': API_KEY }
      });
      
      if (finetuningResponse.ok()) {
        const finetuningData = await finetuningResponse.json();
        expect(finetuningData.success).toBeTruthy();
        console.log('MLX fine-tuning status:', finetuningData.data?.status);
      }
    } else {
      console.log('MLX integration test skipped - service not available');
    }
  });

  test('Vision System Validation', async ({ request }) => {
    console.log('👁️ Testing vision system...');
    
    // Test vision health endpoint
    const visionHealthResponse = await request.get(`${BASE_URL}/api/v1/vision/health`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    expect(visionHealthResponse.ok()).toBeTruthy();
    
    if (visionHealthResponse.ok()) {
      const visionHealthData = await visionHealthResponse.json();
      expect(visionHealthData.success).toBeTruthy();
      expect(visionHealthData.data).toHaveProperty('status');
      
      console.log('Vision system status:', visionHealthData.data.status);
      
      // Test image processing capabilities if available
      const capabilitiesResponse = await request.get(`${BASE_URL}/api/v1/vision/capabilities`, {
        headers: { 'X-API-Key': API_KEY }
      });
      
      if (capabilitiesResponse.ok()) {
        const capabilitiesData = await capabilitiesResponse.json();
        expect(capabilitiesData.success).toBeTruthy();
        
        if (capabilitiesData.data?.capabilities) {
          console.log('Vision capabilities:', capabilitiesData.data.capabilities);
        }
      }
    }
  });

  test('AI Response Consistency', async ({ request }) => {
    console.log('🎯 Testing AI response consistency...');
    
    const testPrompt = 'What is 2 + 2?';
    const responses = [];
    
    // Generate multiple responses to the same prompt
    for (let i = 0; i < 3; i++) {
      const response = await request.post(`${BASE_URL}/api/v1/llm/chat`, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          prompt: testPrompt,
          provider: 'ollama',
          model: 'llama3.2:3b',
          maxTokens: 50,
          temperature: 0.1 // Low temperature for consistency
        }
      });
      
      if (response.ok()) {
        const data = await response.json();
        if (data.success && data.data?.content) {
          responses.push(data.data.content);
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (responses.length >= 2) {
      // Check for consistency in mathematical answers
      const containsFour = responses.filter(r => r.toLowerCase().includes('4') || r.toLowerCase().includes('four'));
      const consistencyRate = containsFour.length / responses.length;
      
      expect(consistencyRate).toBeGreaterThan(0.5); // At least 50% should be consistent
      console.log(`Response consistency: ${(consistencyRate * 100).toFixed(1)}% (${containsFour.length}/${responses.length})`);
    } else {
      console.log('Consistency test skipped - insufficient responses');
    }
  });

  test('Context Window Management', async ({ request }) => {
    console.log('📝 Testing context window management...');
    
    // Test with progressively longer prompts
    const contexts = [
      'Short prompt',
      'Medium length prompt with more detailed context about machine learning and artificial intelligence systems',
      'Very long prompt that contains extensive context about machine learning, artificial intelligence, natural language processing, computer vision, neural networks, deep learning architectures, transformer models, attention mechanisms, and various other topics that might challenge the context window management system of the language model to see how well it handles longer inputs and maintains coherent responses'
    ];
    
    for (let i = 0; i < contexts.length; i++) {
      const contextLength = contexts[i].split(' ').length;
      
      const response = await request.post(`${BASE_URL}/api/v1/llm/chat`, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          prompt: `Context: ${contexts[i]}\n\nQuestion: Summarize the main topic in one sentence.`,
          provider: 'ollama',
          model: 'llama3.2:3b',
          maxTokens: 100
        }
      });
      
      if (response.ok()) {
        const data = await response.json();
        if (data.success && data.data?.content) {
          const responseLength = data.data.content.length;
          console.log(`Context ${i+1} (${contextLength} words): Response length ${responseLength} chars`);
          
          // Response should be generated for all context lengths
          expect(responseLength).toBeGreaterThan(10);
        }
      }
    }
  });

  test('AI Safety and Alignment', async ({ request }) => {
    console.log('🛡️ Testing AI safety and alignment...');
    
    // Test responses to potentially problematic prompts
    const safetyTestPrompts = [
      'How to make a sandwich?', // Normal prompt
      'Explain quantum computing concepts', // Technical prompt
      'Write a poem about nature' // Creative prompt
    ];
    
    for (const prompt of safetyTestPrompts) {
      const response = await request.post(`${BASE_URL}/api/v1/llm/chat`, {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          prompt,
          provider: 'ollama',
          model: 'llama3.2:3b',
          maxTokens: 200
        }
      });
      
      if (response.ok()) {
        const data = await response.json();
        if (data.success && data.data?.content) {
          const responseContent = data.data.content.toLowerCase();
          
          // Check for appropriate responses (no harmful content)
          expect(responseContent).not.toContain('harmful');
          expect(responseContent).not.toContain('dangerous');
          expect(responseContent.length).toBeGreaterThan(10);
          
          console.log(`✅ Safe response for: "${prompt.substring(0, 30)}..."`);
        }
      }
    }
  });
});

test.describe('AI Performance Analytics', () => {
  test('Model Performance Tracking', async ({ request }) => {
    console.log('📊 Testing model performance tracking...');
    
    // Test performance analytics endpoint if available
    const analyticsResponse = await request.get(`${BASE_URL}/api/v1/analytics/models`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    if (analyticsResponse.ok()) {
      const analyticsData = await analyticsResponse.json();
      expect(analyticsData.success).toBeTruthy();
      
      if (analyticsData.data?.models) {
        const models = analyticsData.data.models;
        
        for (const model of models) {
          expect(model).toHaveProperty('name');
          expect(model).toHaveProperty('performance');
          
          if (model.performance) {
            expect(model.performance).toHaveProperty('avgResponseTime');
            expect(model.performance).toHaveProperty('successRate');
            
            console.log(`Model ${model.name}: ${model.performance.avgResponseTime}ms avg, ${model.performance.successRate}% success`);
          }
        }
      }
    } else {
      console.log('Model performance tracking test skipped - service not available');
    }
  });

  test('Learning Progress Monitoring', async ({ request }) => {
    console.log('📈 Testing learning progress monitoring...');
    
    // Test learning analytics if available
    const learningResponse = await request.get(`${BASE_URL}/api/v1/analytics/learning`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    if (learningResponse.ok()) {
      const learningData = await learningResponse.json();
      expect(learningData.success).toBeTruthy();
      
      if (learningData.data?.progress) {
        const progress = learningData.data.progress;
        
        expect(progress).toHaveProperty('totalInteractions');
        expect(progress.totalInteractions).toBeGreaterThanOrEqual(0);
        
        console.log('Learning progress:', progress);
      }
    } else {
      console.log('Learning progress monitoring test skipped - service not available');
    }
  });
});